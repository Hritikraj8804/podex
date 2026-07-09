import datetime
from typing import Dict, Any, List, Optional
from kubernetes import client
# pyrefly: ignore [missing-import]
from kubernetes.client.exceptions import ApiException
from backend.kubernetes.client import get_core_api, get_apps_api

class K8sService:
    @property
    def core_api(self) -> client.CoreV1Api:
        return get_core_api()

    @property
    def apps_api(self) -> client.AppsV1Api:
        return get_apps_api()

    def get_cluster_stats(self) -> Dict[str, Any]:
        """
        Gathers count stats for nodes, pods, deployments, services, and namespace status.
        """
        try:
            nodes = self.core_api.list_node()
            node_count = len(nodes.items)
            cluster_healthy = all(
                any(cond.type == "Ready" and cond.status == "True" for cond in node.status.conditions)
                for node in nodes.items
            ) if node_count > 0 else False
        except Exception as e:
            print(f"Error reading nodes: {e}")
            node_count = 0
            cluster_healthy = False

        try:
            pods = self.core_api.list_pod_for_all_namespaces()
            pod_count = len(pods.items)
        except Exception:
            pod_count = 0

        try:
            deployments = self.apps_api.list_deployment_for_all_namespaces()
            deployment_count = len(deployments.items)
        except Exception:
            deployment_count = 0

        try:
            services = self.core_api.list_service_for_all_namespaces()
            service_count = len(services.items)
        except Exception:
            service_count = 0

        return {
            "status": "healthy" if cluster_healthy else "unhealthy",
            "node_count": node_count,
            "pod_count": pod_count,
            "deployment_count": deployment_count,
            "service_count": service_count,
        }

    def list_pods(self, namespace: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List all pods or filter by namespace, returning summarized data for the UI.
        """
        try:
            if namespace:
                pods = self.core_api.list_namespaced_pod(namespace)
            else:
                pods = self.core_api.list_pod_for_all_namespaces()

            result = []
            for pod in pods.items:
                # Calculate age
                creation_timestamp = pod.metadata.creation_timestamp
                age = self._format_age(creation_timestamp)

                # Determine status
                status = pod.status.phase
                restarts = 0
                if pod.status.container_statuses:
                    restarts = sum(cs.restart_count for cs in pod.status.container_statuses)
                    # Detect specific issues (e.g. CrashLoopBackOff, ImagePullBackOff)
                    for cs in pod.status.container_statuses:
                        if cs.state.waiting:
                            status = cs.state.waiting.reason
                        elif cs.state.terminated:
                            status = cs.state.terminated.reason

                result.append({
                    "name": pod.metadata.name,
                    "namespace": pod.metadata.namespace,
                    "status": status,
                    "restarts": restarts,
                    "pod_ip": pod.status.pod_ip or "None",
                    "node": pod.spec.node_name or "None",
                    "age": age,
                })
            return result
        except Exception as e:
            print(f"Error listing pods: {e}")
            return []

    def list_deployments(self, namespace: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List all deployments, returning summarized data for the UI.
        """
        try:
            if namespace:
                deployments = self.apps_api.list_namespaced_deployment(namespace)
            else:
                deployments = self.apps_api.list_deployment_for_all_namespaces()

            result = []
            for deploy in deployments.items:
                age = self._format_age(deploy.metadata.creation_timestamp)
                replicas = deploy.spec.replicas or 0
                ready_replicas = deploy.status.ready_replicas or 0
                available_replicas = deploy.status.available_replicas or 0
                
                status = "Ready" if ready_replicas == replicas else "Progressing"
                if replicas == 0:
                    status = "Stopped"

                result.append({
                    "name": deploy.metadata.name,
                    "namespace": deploy.metadata.namespace,
                    "status": status,
                    "replicas_desired": replicas,
                    "replicas_ready": ready_replicas,
                    "replicas_available": available_replicas,
                    "age": age,
                })
            return result
        except Exception as e:
            print(f"Error listing deployments: {e}")
            return []

    def list_services(self, namespace: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        List all services, returning summarized data.
        """
        try:
            if namespace:
                services = self.core_api.list_namespaced_service(namespace)
            else:
                services = self.core_api.list_service_for_all_namespaces()

            result = []
            for svc in services.items:
                age = self._format_age(svc.metadata.creation_timestamp)
                
                # Format ports
                ports = []
                if svc.spec.ports:
                    for p in svc.spec.ports:
                        p_str = f"{p.port}:{p.target_port}/{p.protocol}"
                        if p.node_port:
                            p_str = f"{p.port}:{p.target_port} (NodePort: {p.node_port})/{p.protocol}"
                        ports.append(p_str)

                result.append({
                    "name": svc.metadata.name,
                    "namespace": svc.metadata.namespace,
                    "type": svc.spec.type,
                    "cluster_ip": svc.spec.cluster_ip or "None",
                    "external_ip": self._get_service_external_ip(svc),
                    "ports": ", ".join(ports),
                    "age": age,
                })
            return result
        except Exception as e:
            print(f"Error listing services: {e}")
            return []

    def get_pod_details(self, namespace: str, name: str) -> Dict[str, Any]:
        """
        Fetches full details for a Pod.
        """
        pod = self.core_api.read_namespaced_pod(name, namespace)
        return client.ApiClient().sanitize_for_serialization(pod)

    def get_deployment_details(self, namespace: str, name: str) -> Dict[str, Any]:
        """
        Fetches full details for a Deployment.
        """
        deploy = self.apps_api.read_namespaced_deployment(name, namespace)
        return client.ApiClient().sanitize_for_serialization(deploy)

    def get_service_details(self, namespace: str, name: str) -> Dict[str, Any]:
        """
        Fetches full details for a Service.
        """
        svc = self.core_api.read_namespaced_service(name, namespace)
        return client.ApiClient().sanitize_for_serialization(svc)

    def get_pod_logs(self, namespace: str, name: str, container: Optional[str] = None, tail_lines: int = 100, timestamps: bool = False) -> str:
        """
        Reads container logs for a pod.
        """
        try:
            res = self.core_api.read_namespaced_pod_log(
                name=name,
                namespace=namespace,
                container=container,
                tail_lines=tail_lines,
                timestamps=timestamps,
                _preload_content=False
            )
            return res.data.decode("utf-8")
        except ApiException as e:
            return f"Error reading logs: {e.reason}\nDetail: {e.body}"
        except Exception as e:
            return f"Error reading logs: {str(e)}"

    def get_deployment_logs(self, namespace: str, name: str, tail_lines: int = 100, timestamps: bool = False) -> str:
        """
        Aggregates logs for pods managed by this deployment by finding the pods first.
        """
        try:
            deploy = self.apps_api.read_namespaced_deployment(name, namespace)
            labels = deploy.spec.selector.match_labels
            if not labels:
                return "No label selector found on deployment."
                
            label_selector = ",".join(f"{k}={v}" for k, v in labels.items())
            pods = self.core_api.list_namespaced_pod(namespace, label_selector=label_selector)
            
            if not pods.items:
                return "No pods found matching this deployment selector."
                
            # Read first pod logs as representation
            pod_name = pods.items[0].metadata.name
            log_header = f"--- Logs for Pod {pod_name} (managed by Deployment {name}) ---\n"
            return log_header + self.get_pod_logs(namespace, pod_name, tail_lines=tail_lines, timestamps=timestamps)
        except Exception as e:
            return f"Error fetching deployment logs: {str(e)}"

    def get_service_logs(self, namespace: str, name: str, tail_lines: int = 100, timestamps: bool = False) -> str:
        """
        Aggregates logs for pods targeted by this service.
        """
        try:
            svc = self.core_api.read_namespaced_service(name, namespace)
            selector = svc.spec.selector
            if not selector:
                return "No selectors found on service."
                
            label_selector = ",".join(f"{k}={v}" for k, v in selector.items())
            pods = self.core_api.list_namespaced_pod(namespace, label_selector=label_selector)
            
            if not pods.items:
                return "No pods found matching this service selector."
                
            pod_name = pods.items[0].metadata.name
            log_header = f"--- Logs for Pod {pod_name} (targeted by Service {name}) ---\n"
            return log_header + self.get_pod_logs(namespace, pod_name, tail_lines=tail_lines, timestamps=timestamps)
        except Exception as e:
            return f"Error fetching service logs: {str(e)}"

    def get_resource_events(self, namespace: str, name: str, kind: str) -> List[Dict[str, Any]]:
        """
        Gathers list of events related to a specific resource by namespace.
        """
        try:
            events = self.core_api.list_namespaced_event(namespace)
            matched_events = []
            
            for ev in events.items:
                # Filter by matching name and kind of the involved object
                obj = ev.involved_object
                if obj.name == name and obj.kind.lower() == kind.lower():
                    matched_events.append({
                        "type": ev.type,
                        "reason": ev.reason,
                        "message": ev.message,
                        "count": ev.count or 1,
                        "last_timestamp": self._format_age(ev.last_timestamp or ev.event_time or datetime.datetime.now(datetime.timezone.utc)),
                    })
            return matched_events
        except Exception as e:
            print(f"Error fetching events: {e}")
            return []

    # Operations
    def scale_deployment(self, namespace: str, name: str, replicas: int) -> Dict[str, Any]:
        """
        Scales a deployment to desired replicas count.
        """
        try:
            body = {"spec": {"replicas": replicas}}
            self.apps_api.patch_namespaced_deployment_scale(name, namespace, body)
            return {"success": True, "message": f"Deployment scaled to {replicas}"}
        except ApiException as e:
            return {"success": False, "message": f"API error: {e.reason}"}

    def restart_deployment(self, namespace: str, name: str) -> Dict[str, Any]:
        """
        Triggers a rolling restart of a deployment by adding/updating an annotation
        on the pod template specs.
        """
        try:
            now = datetime.datetime.now(datetime.timezone.utc).isoformat()
            body = {
                "spec": {
                    "template": {
                        "metadata": {
                            "annotations": {
                                "kubectl.kubernetes.io/restartedAt": now
                            }
                        }
                    }
                }
            }
            self.apps_api.patch_namespaced_deployment(name, namespace, body)
            return {"success": True, "message": f"Deployment restarted at {now}"}
        except ApiException as e:
            return {"success": False, "message": f"API error: {e.reason}"}

    def delete_pod(self, namespace: str, name: str) -> Dict[str, Any]:
        """
        Deletes a pod from a namespace.
        """
        try:
            self.core_api.delete_namespaced_pod(name, namespace)
            return {"success": True, "message": f"Pod {name} deletion triggered."}
        except ApiException as e:
            return {"success": False, "message": f"API error: {e.reason}"}

    # Helpers
    def _format_age(self, timestamp) -> str:
        if not timestamp:
            return "Unknown"
        if isinstance(timestamp, str):
            try:
                timestamp = datetime.datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            except ValueError:
                return "Unknown"
                
        now = datetime.datetime.now(datetime.timezone.utc)
        
        # Ensure timestamp is timezone-aware
        if timestamp.tzinfo is None:
            timestamp = timestamp.replace(tzinfo=datetime.timezone.utc)
            
        diff = now - timestamp
        seconds = int(diff.total_seconds())
        
        if seconds < 60:
            return f"{seconds}s"
        minutes = seconds // 60
        if minutes < 60:
            return f"{minutes}m"
        hours = minutes // 60
        if hours < 24:
            return f"{hours}h"
        days = hours // 24
        return f"{days}d"

    def _get_service_external_ip(self, svc) -> str:
        if svc.status.load_balancer and svc.status.load_balancer.ingress:
            ingress = svc.status.load_balancer.ingress[0]
            return ingress.ip or ingress.hostname or "Pending"
        return "None"
