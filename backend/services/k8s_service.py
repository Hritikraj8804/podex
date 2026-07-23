import datetime
from typing import Dict, Any, List, Optional
from kubernetes import client
from kubernetes.stream import stream
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

    @property
    def networking_api(self) -> client.NetworkingV1Api:
        return client.NetworkingV1Api()

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

                # Collect ports from containers
                port_strs = []
                if pod.spec.containers:
                    for c in pod.spec.containers:
                        if c.ports:
                            for p in c.ports:
                                proto = p.protocol or "TCP"
                                port_strs.append(f"{p.container_port}/{proto}")
                ports_str = ", ".join(port_strs) if port_strs else ""

                result.append({
                    "name": pod.metadata.name,
                    "namespace": pod.metadata.namespace,
                    "status": status,
                    "restarts": restarts,
                    "pod_ip": pod.status.pod_ip or "None",
                    "node": pod.spec.node_name or "None",
                    "age": age,
                    "ports": ports_str,
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

    def list_nodes(self) -> List[Dict[str, Any]]:
        try:
            nodes = self.core_api.list_node()
            result = []
            for n in nodes.items:
                age = self._format_age(n.metadata.creation_timestamp)
                ready = any(c.type == "Ready" and c.status == "True" for c in n.status.conditions) if n.status.conditions else False
                result.append({
                    "name": n.metadata.name,
                    "status": "Ready" if ready else "NotReady",
                    "role": n.metadata.labels.get("kubernetes.io/role", n.metadata.labels.get("node-role.kubernetes.io/control-plane", "worker")),
                    "internal_ip": n.status.addresses[0].address if n.status.addresses else "Unknown",
                    "kubelet": n.status.node_info.kubelet_version if n.status.node_info else "Unknown",
                    "age": age,
                })
            return result
        except Exception as e:
            print(f"Error listing nodes: {e}")
            return []

    def list_configmaps(self, namespace: Optional[str] = None) -> List[Dict[str, Any]]:
        try:
            if namespace:
                items = self.core_api.list_namespaced_config_map(namespace)
            else:
                items = self.core_api.list_config_map_for_all_namespaces()
            result = []
            for cm in items.items:
                age = self._format_age(cm.metadata.creation_timestamp)
                data_keys = list(cm.data.keys()) if cm.data else []
                result.append({
                    "name": cm.metadata.name,
                    "namespace": cm.metadata.namespace,
                    "keys": data_keys,
                    "data_count": len(data_keys),
                    "age": age,
                })
            return result
        except Exception as e:
            print(f"Error listing configmaps: {e}")
            return []

    def list_secrets(self, namespace: Optional[str] = None) -> List[Dict[str, Any]]:
        try:
            if namespace:
                items = self.core_api.list_namespaced_secret(namespace)
            else:
                items = self.core_api.list_secret_for_all_namespaces()
            result = []
            for s in items.items:
                if s.type == "kubernetes.io/service-account-token":
                    continue
                age = self._format_age(s.metadata.creation_timestamp)
                key_count = len(s.data) if s.data else 0
                result.append({
                    "name": s.metadata.name,
                    "namespace": s.metadata.namespace,
                    "type": s.type,
                    "key_count": key_count,
                    "age": age,
                })
            return result
        except Exception as e:
            print(f"Error listing secrets: {e}")
            return []

    def list_statefulsets(self, namespace: Optional[str] = None) -> List[Dict[str, Any]]:
        try:
            if namespace:
                items = self.apps_api.list_namespaced_stateful_set(namespace)
            else:
                items = self.apps_api.list_stateful_set_for_all_namespaces()
            result = []
            for s in items.items:
                age = self._format_age(s.metadata.creation_timestamp)
                desired = s.spec.replicas or 0
                ready = s.status.ready_replicas or 0
                result.append({
                    "name": s.metadata.name,
                    "namespace": s.metadata.namespace,
                    "status": "Ready" if ready == desired else "Progressing",
                    "replicas_desired": desired,
                    "replicas_ready": ready,
                    "service_name": s.spec.service_name or "",
                    "age": age,
                })
            return result
        except Exception as e:
            print(f"Error listing statefulsets: {e}")
            return []

    def list_daemonsets(self, namespace: Optional[str] = None) -> List[Dict[str, Any]]:
        try:
            if namespace:
                items = self.apps_api.list_namespaced_daemon_set(namespace)
            else:
                items = self.apps_api.list_daemon_set_for_all_namespaces()
            result = []
            for ds in items.items:
                age = self._format_age(ds.metadata.creation_timestamp)
                desired = ds.status.desired_number_scheduled or 0
                ready = ds.status.number_ready or 0
                result.append({
                    "name": ds.metadata.name,
                    "namespace": ds.metadata.namespace,
                    "status": "Ready" if ready == desired else "Progressing",
                    "desired": desired,
                    "ready": ready,
                    "current": ds.status.current_number_scheduled or 0,
                    "age": age,
                })
            return result
        except Exception as e:
            print(f"Error listing daemonsets: {e}")
            return []

    def list_events(self, namespace: Optional[str] = None) -> List[Dict[str, Any]]:
        try:
            if namespace:
                items = self.core_api.list_namespaced_event(namespace)
            else:
                items = self.core_api.list_event_for_all_namespaces()
            result = []
            for ev in items.items:
                age = self._format_age(ev.last_timestamp or ev.event_time or ev.metadata.creation_timestamp)
                result.append({
                    "type": ev.type,
                    "reason": ev.reason,
                    "message": ev.message,
                    "count": ev.count or 1,
                    "namespace": ev.metadata.namespace,
                    "involved_kind": ev.involved_object.kind if ev.involved_object else "",
                    "involved_name": ev.involved_object.name if ev.involved_object else "",
                    "age": age,
                })
            return result
        except Exception as e:
            print(f"Error listing events: {e}")
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

    def get_node_details(self, name: str) -> Dict[str, Any]:
        node = self.core_api.read_node(name)
        return client.ApiClient().sanitize_for_serialization(node)

    def get_configmap_details(self, namespace: str, name: str) -> Dict[str, Any]:
        cm = self.core_api.read_namespaced_config_map(name, namespace)
        return client.ApiClient().sanitize_for_serialization(cm)

    def get_secret_details(self, namespace: str, name: str) -> Dict[str, Any]:
        s = self.core_api.read_namespaced_secret(name, namespace)
        return client.ApiClient().sanitize_for_serialization(s)

    def get_statefulset_details(self, namespace: str, name: str) -> Dict[str, Any]:
        s = self.apps_api.read_namespaced_stateful_set(name, namespace)
        return client.ApiClient().sanitize_for_serialization(s)

    def get_daemonset_details(self, namespace: str, name: str) -> Dict[str, Any]:
        ds = self.apps_api.read_namespaced_daemon_set(name, namespace)
        return client.ApiClient().sanitize_for_serialization(ds)

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

    def execute_pod_command(self, namespace: str, name: str, container: str, command: str) -> Dict[str, Any]:
        """
        Executes a shell command inside the specified pod container.
        """
        try:
            resp = stream(
                self.core_api.connect_get_namespaced_pod_exec,
                name=name,
                namespace=namespace,
                container=container,
                command=["/bin/sh", "-c", command],
                stderr=True,
                stdin=False,
                stdout=True,
                tty=False
            )
            return {"success": True, "output": resp}
        except ApiException as e:
            return {"success": False, "error": f"API Error: {e.reason}\nDetail: {e.body}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_topology(self, namespace: str = "default") -> Dict[str, Any]:
        """
        Builds a relationship topology map of the resources in the specified namespace.
        """
        nodes = []
        edges = []

        try:
            # 1. Fetch Ingresses
            try:
                ingresses = self.networking_api.list_namespaced_ingress(namespace)
                ingress_list = ingresses.items
            except Exception:
                ingress_list = []

            for ing in ingress_list:
                node_id = f"ingress/{namespace}/{ing.metadata.name}"
                nodes.append({
                    "id": node_id,
                    "type": "ingress",
                    "name": ing.metadata.name,
                    "namespace": namespace,
                    "status": "healthy"
                })

                # Trace paths to Services
                if ing.spec and ing.spec.rules:
                    for rule in ing.spec.rules:
                        if rule.http and rule.http.paths:
                            for path in rule.http.paths:
                                if path.backend and path.backend.service:
                                    svc_name = path.backend.service.name
                                    target_svc_id = f"service/{namespace}/{svc_name}"
                                    edges.append({
                                        "source": node_id,
                                        "target": target_svc_id,
                                        "relation": "routes_to"
                                    })

            # 2. Fetch ConfigMaps
            try:
                configmaps = self.core_api.list_namespaced_config_map(namespace)
                configmap_list = configmaps.items
            except Exception:
                configmap_list = []

            for cm in configmap_list:
                if ".crt" in cm.metadata.name.lower():
                    continue
                node_id = f"configmap/{namespace}/{cm.metadata.name}"
                data_keys = list(cm.data.keys()) if cm.data else []
                nodes.append({
                    "id": node_id,
                    "type": "configmap",
                    "name": cm.metadata.name,
                    "namespace": namespace,
                    "status": "healthy"
                })

            # 3. Fetch Secrets
            try:
                secrets = self.core_api.list_namespaced_secret(namespace)
                secret_list = secrets.items
            except Exception:
                secret_list = []

            for sec in secret_list:
                if sec.type == "kubernetes.io/service-account-token":
                    continue
                if ".crt" in sec.metadata.name.lower():
                    continue
                node_id = f"secret/{namespace}/{sec.metadata.name}"
                nodes.append({
                    "id": node_id,
                    "type": "secret",
                    "name": sec.metadata.name,
                    "namespace": namespace,
                    "status": "healthy"
                })

            # 4. Fetch Services
            try:
                services = self.core_api.list_namespaced_service(namespace)
                service_list = services.items
            except Exception:
                service_list = []

            for svc in service_list:
                node_id = f"service/{namespace}/{svc.metadata.name}"
                nodes.append({
                    "id": node_id,
                    "type": "service",
                    "name": svc.metadata.name,
                    "namespace": namespace,
                    "status": "healthy",
                    "details": {
                        "type": svc.spec.type,
                        "cluster_ip": svc.spec.cluster_ip
                    }
                })

            # 3. Fetch Deployments
            try:
                deployments = self.apps_api.list_namespaced_deployment(namespace)
                deployment_list = deployments.items
            except Exception:
                deployment_list = []

            for depl in deployment_list:
                node_id = f"deployment/{namespace}/{depl.metadata.name}"
                
                # Check status
                replicas = depl.status.replicas or 0
                ready_replicas = depl.status.ready_replicas or 0
                status = "healthy"
                if ready_replicas < replicas:
                    status = "degraded" if ready_replicas > 0 else "critical"

                nodes.append({
                    "id": node_id,
                    "type": "deployment",
                    "name": depl.metadata.name,
                    "namespace": namespace,
                    "status": status,
                    "details": {
                        "replicas": f"{ready_replicas}/{replicas}"
                    }
                })

            # 5. Fetch StatefulSets
            try:
                statefulsets = self.apps_api.list_namespaced_stateful_set(namespace)
                statefulset_list = statefulsets.items
            except Exception:
                statefulset_list = []

            for sts in statefulset_list:
                node_id = f"statefulset/{namespace}/{sts.metadata.name}"
                replicas = sts.status.replicas or 0
                ready_replicas = sts.status.ready_replicas or 0
                status = "healthy"
                if ready_replicas < replicas:
                    status = "degraded" if ready_replicas > 0 else "critical"
                nodes.append({
                    "id": node_id,
                    "type": "statefulset",
                    "name": sts.metadata.name,
                    "namespace": namespace,
                    "status": status,
                    "details": {
                        "replicas": f"{ready_replicas}/{replicas}"
                    }
                })

            # 6. Fetch Pods
            try:
                pods = self.core_api.list_namespaced_pod(namespace)
                pod_list = pods.items
            except Exception:
                pod_list = []

            # Helper to check matching labels
            def labels_match(selector: dict, labels: dict) -> bool:
                if not selector or not labels:
                    return False
                return all(labels.get(k) == v for k, v in selector.items())

            for pod in pod_list:
                pod_id = f"pod/{namespace}/{pod.metadata.name}"
                
                # Determine phase status
                phase = (pod.status.phase or "Unknown").lower()
                status = "healthy"
                if phase == "running":
                    status = "healthy"
                    if pod.status.container_statuses:
                        for cs in pod.status.container_statuses:
                            if cs.state and cs.state.waiting:
                                status = "degraded"
                            if cs.restart_count > 5 and not cs.ready:
                                status = "degraded"
                elif phase in ["pending", "succeeded"]:
                    status = "degraded"
                else:
                    status = "critical"

                nodes.append({
                    "id": pod_id,
                    "type": "pod",
                    "name": pod.metadata.name,
                    "namespace": namespace,
                    "status": status
                })

                # Service ──► Pod edge connections
                for svc in service_list:
                    if svc.spec.selector:
                        if labels_match(svc.spec.selector, pod.metadata.labels or {}):
                            edges.append({
                                "source": f"service/{namespace}/{svc.metadata.name}",
                                "target": pod_id,
                                "relation": "routes_to"
                            })

                # Deployment ──► Pod edge connections
                matched_to_deploy = False
                if pod.metadata.owner_references:
                    for owner in pod.metadata.owner_references:
                        if owner.kind == "ReplicaSet":
                            for depl in deployment_list:
                                if depl.spec.selector and depl.spec.selector.match_labels:
                                    if labels_match(depl.spec.selector.match_labels, pod.metadata.labels or {}):
                                        edges.append({
                                            "source": f"deployment/{namespace}/{depl.metadata.name}",
                                            "target": pod_id,
                                            "relation": "manages"
                                        })
                                        matched_to_deploy = True
                                        break
                
                if not matched_to_deploy:
                    for depl in deployment_list:
                        if depl.spec.selector and depl.spec.selector.match_labels:
                            if labels_match(depl.spec.selector.match_labels, pod.metadata.labels or {}):
                                edges.append({
                                    "source": f"deployment/{namespace}/{depl.metadata.name}",
                                    "target": pod_id,
                                    "relation": "manages"
                                })
                                break

                # StatefulSet ──► Pod edge connections
                for sts in statefulset_list:
                    if sts.spec.selector and sts.spec.selector.match_labels:
                        if labels_match(sts.spec.selector.match_labels, pod.metadata.labels or {}):
                            edges.append({
                                "source": f"statefulset/{namespace}/{sts.metadata.name}",
                                "target": pod_id,
                                "relation": "manages"
                            })
                            break

            return {"nodes": nodes, "edges": edges}

        except Exception as e:
            return {"nodes": [], "edges": [], "error": str(e)}
