import yaml
import subprocess
import re
import time
import os
import signal
import tempfile
from fastapi import APIRouter, HTTPException, Query, Header
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from backend.services.k8s_service import K8sService
from backend.services.investigation_service import InvestigationService
from backend.ai import get_ai_provider, build_concept_prompt, InvestigationResult, ConceptExplanation
from backend.kubernetes.client import list_contexts, switch_context, get_active_context_name
from backend.utils import clean_kubernetes_dict

from backend.api.updates import router as updates_router
from backend.api.terminal import router as terminal_router

router = APIRouter()
router.include_router(updates_router)
router.include_router(terminal_router)
k8s_service = K8sService()
investigation_service = InvestigationService()

# Request schemas
class InvestigateRequest(BaseModel):
    type: str  # 'pod', 'deployment', or 'service'
    name: str
    namespace: str

class ScaleRequest(BaseModel):
    namespace: str
    name: str
    replicas: int

class RestartRequest(BaseModel):
    namespace: str
    name: str

class DeleteRequest(BaseModel):
    namespace: str
    name: str

class SwitchContextRequest(BaseModel):
    context: str

class ExecRequest(BaseModel):
    container: str
    command: str

class ExplainCommandRequest(BaseModel):
    command: str
    output: str

class ApplyYamlRequest(BaseModel):
    yaml: str

class DeleteResourceRequest(BaseModel):
    kind: str
    name: str
    namespace: str

class PortForwardRequest(BaseModel):
    kind: str
    name: str
    namespace: str
    port: int = 0
    target_port: int = 0

# In-memory port-forward registry
port_forward_processes: Dict[int, subprocess.Popen] = {}

class ExplainCommandResponse(BaseModel):
    explanation: str

class GenerateCommandRequest(BaseModel):
    prompt: str

class GenerateCommandResponse(BaseModel):
    command: str

# 1. Dashboard Stats
@router.get("/stats")
def get_stats():
    return k8s_service.get_cluster_stats()

# 2. Explorer Lists
@router.get("/pods")
def get_pods(namespace: Optional[str] = Query(None)):
    return k8s_service.list_pods(namespace)

@router.get("/deployments")
def get_deployments(namespace: Optional[str] = Query(None)):
    return k8s_service.list_deployments(namespace)

@router.get("/services")
def get_services(namespace: Optional[str] = Query(None)):
    return k8s_service.list_services(namespace)

@router.get("/resources")
def get_resources(namespace: Optional[str] = Query(None)):
    try:
        return {
            "pods": k8s_service.list_pods(namespace),
            "deployments": k8s_service.list_deployments(namespace),
            "services": k8s_service.list_services(namespace),
            "nodes": k8s_service.list_nodes(),
            "configmaps": k8s_service.list_configmaps(namespace),
            "secrets": k8s_service.list_secrets(namespace),
            "statefulsets": k8s_service.list_statefulsets(namespace),
            "daemonsets": k8s_service.list_daemonsets(namespace),
            "events": k8s_service.list_events(namespace),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/nodes")
def get_nodes():
    return k8s_service.list_nodes()

@router.get("/configmaps")
def get_configmaps(namespace: Optional[str] = Query(None)):
    return k8s_service.list_configmaps(namespace)

@router.get("/secrets")
def get_secrets(namespace: Optional[str] = Query(None)):
    return k8s_service.list_secrets(namespace)

@router.get("/statefulsets")
def get_statefulsets(namespace: Optional[str] = Query(None)):
    return k8s_service.list_statefulsets(namespace)

@router.get("/daemonsets")
def get_daemonsets(namespace: Optional[str] = Query(None)):
    return k8s_service.list_daemonsets(namespace)

@router.get("/events-all")
def get_events_all(namespace: Optional[str] = Query(None)):
    return k8s_service.list_events(namespace)

# 3. Node-specific routes (cluster-scoped, no namespace)
@router.get("/node/{name}/details")
def get_node_details(name: str):
    try:
        return k8s_service.get_node_details(name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/node/{name}/yaml")
def get_node_yaml(name: str):
    try:
        data = k8s_service.get_node_details(name)
        cleaned_data = clean_kubernetes_dict(data)
        yaml_str = yaml.dump(cleaned_data, default_flow_style=False)
        return {"yaml": yaml_str}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 4. Resource Tabs
@router.get("/{resource_type}/{namespace}/{name}/details")
def get_details(resource_type: str, namespace: str, name: str):
    rt = resource_type.lower()
    try:
        if rt == "pod":
            return k8s_service.get_pod_details(namespace, name)
        elif rt == "deployment":
            return k8s_service.get_deployment_details(namespace, name)
        elif rt == "service":
            return k8s_service.get_service_details(namespace, name)
        elif rt == "node":
            return k8s_service.get_node_details(name)
        elif rt == "configmap":
            return k8s_service.get_configmap_details(namespace, name)
        elif rt == "secret":
            return k8s_service.get_secret_details(namespace, name)
        elif rt == "statefulset":
            return k8s_service.get_statefulset_details(namespace, name)
        elif rt == "daemonset":
            return k8s_service.get_daemonset_details(namespace, name)
        else:
            raise HTTPException(status_code=400, detail=f"Invalid resource type: {resource_type}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{resource_type}/{namespace}/{name}/yaml")
def get_yaml(resource_type: str, namespace: str, name: str):
    rt = resource_type.lower()
    try:
        if rt == "pod":
            data = k8s_service.get_pod_details(namespace, name)
        elif rt == "deployment":
            data = k8s_service.get_deployment_details(namespace, name)
        elif rt == "service":
            data = k8s_service.get_service_details(namespace, name)
        elif rt == "node":
            data = k8s_service.get_node_details(name)
        elif rt == "configmap":
            data = k8s_service.get_configmap_details(namespace, name)
        elif rt == "secret":
            data = k8s_service.get_secret_details(namespace, name)
        elif rt == "statefulset":
            data = k8s_service.get_statefulset_details(namespace, name)
        elif rt == "daemonset":
            data = k8s_service.get_daemonset_details(namespace, name)
        else:
            raise HTTPException(status_code=400, detail=f"Invalid resource type: {resource_type}")

        # Clean Kubernetes dict to remove system fields and null values
        cleaned_data = clean_kubernetes_dict(data)
        yaml_str = yaml.dump(cleaned_data, default_flow_style=False)
        return {"yaml": yaml_str}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{resource_type}/{namespace}/{name}/logs")
def get_logs(resource_type: str, namespace: str, name: str, tail: int = 100, timestamps: bool = False):
    rt = resource_type.lower()
    try:
        if rt == "pod":
            return {"logs": k8s_service.get_pod_logs(namespace, name, tail_lines=tail, timestamps=timestamps)}
        elif rt == "deployment":
            return {"logs": k8s_service.get_deployment_logs(namespace, name, tail_lines=tail, timestamps=timestamps)}
        elif rt == "service":
            return {"logs": k8s_service.get_service_logs(namespace, name, tail_lines=tail, timestamps=timestamps)}
        else:
            raise HTTPException(status_code=400, detail=f"Invalid resource type: {resource_type}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{resource_type}/{namespace}/{name}/events")
def get_events(resource_type: str, namespace: str, name: str):
    return k8s_service.get_resource_events(namespace, name, resource_type)

# 4. Investigate Endpoint
@router.post("/investigate", response_model=InvestigationResult)
async def investigate(
    req: InvestigateRequest,
    x_ai_provider: Optional[str] = Header(None),
    x_ai_key: Optional[str] = Header(None),
    x_ai_model: Optional[str] = Header(None),
    x_ai_temperature: Optional[float] = Header(None)
):
    return await investigation_service.investigate_resource(
        resource_type=req.type,
        name=req.name,
        namespace=req.namespace,
        provider_override=x_ai_provider,
        api_key_override=x_ai_key,
        model_override=x_ai_model,
        temperature_override=x_ai_temperature
    )

# 5. Concept Learning Endpoint
@router.get("/learn", response_model=ConceptExplanation)
async def learn_concept(
    concept: str = Query(..., description="The Kubernetes resource or topic to explain"),
    x_ai_provider: Optional[str] = Header(None),
    x_ai_key: Optional[str] = Header(None),
    x_ai_model: Optional[str] = Header(None),
    x_ai_temperature: Optional[float] = Header(None)
):
    ai_provider = get_ai_provider(
        provider_override=x_ai_provider,
        api_key_override=x_ai_key,
        model_override=x_ai_model,
        temperature_override=x_ai_temperature
    )
    return await ai_provider.explain_concept(concept)

# 6. Operations (Restart, Scale, Delete)
@router.post("/operations/scale")
def scale_resource(req: ScaleRequest):
    result = k8s_service.scale_deployment(req.namespace, req.name, req.replicas)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("message"))
    return result

@router.post("/operations/restart")
def restart_resource(req: RestartRequest):
    result = k8s_service.restart_deployment(req.namespace, req.name)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("message"))
    return result

@router.post("/operations/delete")
def delete_resource(req: DeleteRequest):
    result = k8s_service.delete_pod(req.namespace, req.name)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("message"))
    return result

# 7. Kubeconfig Context Switchers
@router.get("/kube/contexts")
def get_kube_contexts():
    return list_contexts()

@router.post("/kube/switch")
def post_switch_context(req: SwitchContextRequest):
    success = switch_context(req.context)
    if not success:
        raise HTTPException(status_code=500, detail=f"Failed to switch to context: {req.context}")
    return {"success": True, "message": f"Successfully switched to context: {req.context}"}

# 8. Interactive Container Exec
@router.post("/pods/{namespace}/{name}/exec")
def execute_command(namespace: str, name: str, req: ExecRequest):
    result = k8s_service.execute_pod_command(
        namespace=namespace,
        name=name,
        container=req.container,
        command=req.command
    )
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error"))
    return result

@router.post("/pods/explain-command", response_model=ExplainCommandResponse)
async def post_explain_command(
    req: ExplainCommandRequest,
    x_ai_provider: Optional[str] = Header(None),
    x_ai_key: Optional[str] = Header(None),
    x_ai_model: Optional[str] = Header(None),
    x_ai_temperature: Optional[float] = Header(None)
):
    ai_provider = get_ai_provider(
        provider_override=x_ai_provider,
        api_key_override=x_ai_key,
        model_override=x_ai_model,
        temperature_override=x_ai_temperature
    )
    explanation = await ai_provider.explain_command(req.command, req.output)
    return {"explanation": explanation}

@router.post("/pods/generate-command", response_model=GenerateCommandResponse)
async def post_generate_command(
    req: GenerateCommandRequest,
    x_ai_provider: Optional[str] = Header(None),
    x_ai_key: Optional[str] = Header(None),
    x_ai_model: Optional[str] = Header(None),
    x_ai_temperature: Optional[float] = Header(None)
):
    ai_provider = get_ai_provider(
        provider_override=x_ai_provider,
        api_key_override=x_ai_key,
        model_override=x_ai_model,
        temperature_override=x_ai_temperature
    )
    command = await ai_provider.generate_command(req.prompt)
    return {"command": command}

# 9. Live Cluster Topology Map
@router.get("/kube/topology")
def get_kube_topology(namespace: str = Query("default")):
    result = k8s_service.get_topology(namespace)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

def _patched_kubectl_env() -> dict:
    """Return env with patched kubeconfig for Docker/Local context consistency."""
    env = os.environ.copy()
    
    # Resolve kubeconfig path: settings first, then env, then default path
    from backend.config.settings import settings
    kc_path = settings.kubeconfig or env.get("KUBECONFIG", "")
    if not kc_path:
        kc_path = os.path.expanduser("~/.kube/config")
        
    if kc_path and os.path.exists(kc_path):
        try:
            with open(kc_path, "r") as f:
                kc = yaml.safe_load(f)
            if kc:
                # Synchronize context selected in UI
                active_ctx = get_active_context_name()
                if active_ctx:
                    kc["current-context"] = active_ctx
                elif not kc.get("current-context") and kc.get("contexts"):
                    names = [c["name"] for c in kc["contexts"]]
                    preferred = next((n for n in ["kind-podex", "kind-kind-podex"] if n in names), names[0])
                    kc["current-context"] = preferred

                # If running inside Docker, patch loopback hosts to host.docker.internal
                is_docker = os.path.exists("/.dockerenv")
                if is_docker and "clusters" in kc:
                    for c in kc["clusters"]:
                        if "cluster" in c and "server" in c["cluster"]:
                            s = c["cluster"]["server"]
                            s = s.replace("127.0.0.1", "host.docker.internal").replace("localhost", "host.docker.internal")
                            c["cluster"]["server"] = s
                            c["cluster"]["insecure-skip-tls-verify"] = True
                            c["cluster"].pop("certificate-authority-data", None)

                # Write to temp file and set env var
                tmp = os.path.join(tempfile.gettempdir(), "podex-patched-kubectl-kubeconfig")
                with open(tmp, "w") as f:
                    yaml.safe_dump(kc, f, default_flow_style=False)
                env["KUBECONFIG"] = tmp
        except Exception as e:
            print(f"Error patching kubectl env: {e}")
            
    return env

# 10. Visual Arena Deployments
@router.post("/kube/apply")
def apply_yaml(req: ApplyYamlRequest):
    try:
        env = _patched_kubectl_env()
        proc = subprocess.Popen(
            ["kubectl", "apply", "-f", "-"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        stdout, stderr = proc.communicate(input=req.yaml)
        if proc.returncode != 0:
            raise HTTPException(status_code=500, detail=stderr)
        return {"success": True, "message": stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/kube/delete")
def delete_resource(req: DeleteResourceRequest):
    try:
        env = _patched_kubectl_env()
        kind_lower = req.kind.lower()
        proc = subprocess.Popen(
            ["kubectl", "delete", kind_lower, req.name, "-n", req.namespace],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        stdout, stderr = proc.communicate()
        if proc.returncode != 0:
            raise HTTPException(status_code=500, detail=stderr)
        return {"success": True, "message": stdout}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 11. Port Forwarding

@router.post("/kube/port-forward")
def start_port_forward(req: PortForwardRequest):
    try:
        kind = req.kind.lower()
        local_port = req.port
        target_port = req.target_port
        if local_port > 0 and target_port > 0:
            port_arg = f"{local_port}:{target_port}"
        elif local_port > 0:
            port_arg = str(local_port)
        else:
            port_arg = ""
            
        env = _patched_kubectl_env()
        proc = subprocess.Popen(
            ["kubectl", "port-forward", "--address", "0.0.0.0", f"{kind}/{req.name}", port_arg, "-n", req.namespace],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env
        )
        time.sleep(1.5)
        
        # Verify the process is still running and did not crash
        exit_code = proc.poll()
        if exit_code is not None:
            stderr_data = proc.stderr.read() if proc.stderr else "Unknown error"
            raise Exception(f"Failed to start port-forward (exit code {exit_code}): {stderr_data.strip()}")
            
        if local_port > 0:
            allocated_port = local_port
        else:
            stderr_line = proc.stderr.readline() if proc.stderr else ""
            match = re.search(r'(?:127\.0\.0\.1|0\.0\.0\.0):(\d+)', stderr_line)
            allocated_port = int(match.group(1)) if match else 0
            
        pid = proc.pid
        port_forward_processes[pid] = proc
        return {"pid": pid, "port": allocated_port, "target_port": target_port or allocated_port, "is_docker": os.path.exists("/.dockerenv"), "message": f"Forwarding to {req.name} on port {allocated_port}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/kube/port-forward/{pid}")
def stop_port_forward(pid: int):
    try:
        proc = port_forward_processes.pop(pid, None)
        if proc:
            if os.name == 'nt':
                proc.terminate()
            else:
                os.kill(pid, signal.SIGTERM)
            return {"success": True, "message": f"Port forward {pid} stopped."}
        return {"success": False, "message": "Process not found."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
