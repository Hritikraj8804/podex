from typing import Dict, Any, List, Optional
# pyrefly: ignore [missing-import]
from kubernetes.client.exceptions import ApiException
from backend.services.k8s_service import K8sService
from backend.ai import get_ai_provider, build_investigation_prompt, InvestigationResult

class InvestigationService:
    def __init__(self):
        self.k8s_service = K8sService()
        self.ai_provider = get_ai_provider()

    async def investigate_resource(self, resource_type: str, name: str, namespace: str) -> InvestigationResult:
        """
        Gathers complete Kubernetes context for the resource under investigation,
        compiles it into a structured prompt, and queries the AI provider.
        """
        resource_type = resource_type.lower()
        
        # 1. Fetch main resource status summary and yaml specs
        status_summary = {}
        logs = None
        related_resources = {}

        try:
            if resource_type == "pod":
                details = self.k8s_service.get_pod_details(namespace, name)
                status_summary = {
                    "phase": details.get("status", {}).get("phase"),
                    "container_statuses": [
                        {
                            "name": cs.get("name"),
                            "ready": cs.get("ready"),
                            "restart_count": cs.get("restart_count"),
                            "state": cs.get("state"),
                            "last_state": cs.get("last_state")
                        }
                        for cs in details.get("status", {}).get("container_statuses", [])
                    ],
                    "conditions": [
                        {"type": c.get("type"), "status": c.get("status"), "reason": c.get("reason")}
                        for c in details.get("status", {}).get("conditions", [])
                    ]
                }
                # Fetch pod logs (tail 50 lines)
                logs = self.k8s_service.get_pod_logs(namespace, name, tail_lines=50)
                
                # Find related services matching pod labels
                pod_labels = details.get("metadata", {}).get("labels", {})
                if pod_labels:
                    matching_svcs = []
                    all_svcs = self.k8s_service.list_services(namespace)
                    # We can fetch detailed specs to check selectors
                    for svc_summary in all_svcs:
                        svc_details = self.k8s_service.get_service_details(namespace, svc_summary["name"])
                        selector = svc_details.get("spec", {}).get("selector", {})
                        if selector and all(pod_labels.get(k) == v for k, v in selector.items()):
                            matching_svcs.append({
                                "name": svc_details.get("metadata", {}).get("name"),
                                "status": f"Port: {svc_details.get('spec', {}).get('ports')}"
                            })
                    if matching_svcs:
                        related_resources["Service"] = matching_svcs

            elif resource_type == "deployment":
                details = self.k8s_service.get_deployment_details(namespace, name)
                status_summary = {
                    "replicas_desired": details.get("spec", {}).get("replicas"),
                    "replicas_ready": details.get("status", {}).get("ready_replicas", 0),
                    "replicas_updated": details.get("status", {}).get("updated_replicas", 0),
                    "replicas_available": details.get("status", {}).get("available_replicas", 0),
                    "conditions": [
                        {"type": c.get("type"), "status": c.get("status"), "reason": c.get("reason")}
                        for c in details.get("status", {}).get("conditions", [])
                    ]
                }
                # Fetch deployment logs (first pod logs as representation)
                logs = self.k8s_service.get_deployment_logs(namespace, name, tail_lines=50)

                # Find related pods matching deployment labels
                match_labels = details.get("spec", {}).get("selector", {}).get("match_labels", {})
                if match_labels:
                    matching_pods = []
                    # Fetch pods matching selector labels
                    label_selector = ",".join(f"{k}={v}" for k, v in match_labels.items())
                    raw_pods = self.k8s_service.core_api.list_namespaced_pod(namespace, label_selector=label_selector)
                    for pod in raw_pods.items:
                        matching_pods.append({
                            "name": pod.metadata.name,
                            "status": pod.status.phase
                        })
                    related_resources["Pod"] = matching_pods

            elif resource_type == "service":
                details = self.k8s_service.get_service_details(namespace, name)
                status_summary = {
                    "type": details.get("spec", {}).get("type"),
                    "cluster_ip": details.get("spec", {}).get("cluster_ip"),
                    "ports": details.get("spec", {}).get("ports"),
                }
                # Fetch service logs (representative pod logs)
                logs = self.k8s_service.get_service_logs(namespace, name, tail_lines=50)

                # Find related pods targeting service selector
                selector = details.get("spec", {}).get("selector", {})
                if selector:
                    matching_pods = []
                    label_selector = ",".join(f"{k}={v}" for k, v in selector.items())
                    raw_pods = self.k8s_service.core_api.list_namespaced_pod(namespace, label_selector=label_selector)
                    for pod in raw_pods.items:
                        matching_pods.append({
                            "name": pod.metadata.name,
                            "status": pod.status.phase
                        })
                    related_resources["Pod"] = matching_pods
            else:
                return InvestigationResult(
                    root_cause=f"Unsupported resource type: {resource_type}",
                    evidence=[],
                    explanation="Podex currently supports Pods, Deployments, and Services for investigation.",
                    suggested_fix="Select a Pod, Deployment, or Service from the Explorer and click 'Investigate'.",
                    learning="Kubernetes resources map to different APIs. The core ones (Pods, Deployments, and Services) compose standard workloads.",
                    confidence="High"
                )

        except ApiException as e:
            return InvestigationResult(
                root_cause=f"Kubernetes API Error: {e.reason}",
                evidence=[f"HTTP Status: {e.status}", f"Body: {e.body}"],
                explanation="Podex was unable to retrieve the resource configuration from the cluster.",
                suggested_fix="Ensure the resource has not been deleted and that Podex has the correct permissions.",
                learning="FastAPI uses the official Kubernetes Python SDK to authenticate and send requests to the cluster api-server.",
                confidence="High"
            )
        except Exception as e:
            return InvestigationResult(
                root_cause=f"Unexpected System Error: {str(e)}",
                evidence=[],
                explanation="An unexpected error occurred while gathering Kubernetes resource context.",
                suggested_fix="Check the backend service logs in your docker-compose console.",
                learning="Podex backend fetches state data asynchronously and aggregates it for AI analysis.",
                confidence="Low"
            )

        # 2. Fetch events
        events = self.k8s_service.get_resource_events(namespace, name, resource_type)

        # 3. Build context prompt
        prompt = build_investigation_prompt(
            resource_type=resource_type,
            name=name,
            namespace=namespace,
            status_summary=status_summary,
            events=events,
            logs=logs,
            related_resources=related_resources
        )

        # 4. Invoke LLM client
        return await self.ai_provider.investigate(prompt)
