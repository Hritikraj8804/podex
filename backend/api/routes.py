import yaml
import subprocess
import re
import time
import os
import signal
import tempfile
import logging
import atexit
from fastapi import APIRouter, HTTPException, Query, Header, Request, WebSocket, WebSocketDisconnect
from typing import Optional, List, Dict, Any, Set
from pydantic import BaseModel, field_validator

from backend.services.k8s_service import K8sService
from backend.services.investigation_service import InvestigationService
from backend.ai import get_ai_provider, build_concept_prompt, InvestigationResult, ConceptExplanation
from backend.kubernetes.client import list_contexts, switch_context, get_active_context_name
from backend.utils import clean_kubernetes_dict

from backend.api.updates import router as updates_router
from backend.api.terminal import router as terminal_router

try:
    from shell.session import run_shell_ws
except ImportError:
    run_shell_ws = None

logger = logging.getLogger("podex.api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

router = APIRouter()
router.include_router(updates_router)
router.include_router(terminal_router)
k8s_service = K8sService()
investigation_service = InvestigationService()

# ── Security helpers ──────────────────────────────────────────────────────────

# Allowlist of Kubernetes resource kinds supported by operations
ALLOWED_K8S_KINDS: Set[str] = {
    "pod", "deployment", "service", "configmap", "secret",
    "statefulset", "daemonset", "ingress",
}

# Regex for valid Kubernetes resource names (RFC 1123 subdomain)
K8S_NAME_RE = re.compile(r"^[a-z0-9]([a-z0-9\-.]*[a-z0-9])?$")

# Track temp files that must be cleaned up at exit
_temp_files: Set[str] = set()

def _cleanup_temp_files() -> None:
    """Remove all tracked temporary files on shutdown."""
    for path in list(_temp_files):
        try:
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass

atexit.register(_cleanup_temp_files)


def _safe_error(log_msg: str, status_code: int = 500, exc: Optional[Exception] = None) -> HTTPException:
    """
    Log the detailed error server-side and raise a sanitized HTTPException.
    In development mode, include the exception detail for debugging.
    """
    if exc:
        logger.error(f"{log_msg}: {exc}", exc_info=True)
    else:
        logger.error(log_msg)

    from backend.config.settings import settings
    if settings.environment == "development" and exc:
        return HTTPException(status_code=status_code, detail=f"{log_msg}: {str(exc)}")
    return HTTPException(status_code=status_code, detail="An internal error occurred. Check server logs for details.")


def _validate_k8s_kind(kind: str, param_name: str = "kind") -> str:
    """Validate that a Kubernetes resource kind is in the allowlist."""
    k = kind.lower().strip()
    if k not in ALLOWED_K8S_KINDS:
        logger.warning(f"Invalid resource kind rejected: {kind}")
        raise HTTPException(status_code=400, detail=f"Invalid resource kind: {kind}. Allowed: {', '.join(sorted(ALLOWED_K8S_KINDS))}")
    return k


def _validate_k8s_name(name: str, param_name: str = "name") -> str:
    """Validate a Kubernetes resource name conforms to RFC 1123."""
    if not name or not K8S_NAME_RE.match(name):
        logger.warning(f"Invalid resource name rejected: {name}")
        raise HTTPException(status_code=400, detail=f"Invalid resource name: '{name}'. Must be a valid RFC 1123 subdomain.")
    return name


def _validate_namespace(ns: str) -> str:
    """Validate a Kubernetes namespace name."""
    return _validate_k8s_name(ns, "namespace")


def _restricted_temp_file(prefix: str, mode: str = "w") -> str:
    """Create a temp file with restricted permissions (0o600) and track it for cleanup."""
    # Use umask to restrict permissions: 0o600 (owner read/write only)
    old_umask = os.umask(0o177)  # 0o600 permissions
    try:
        fd, path = tempfile.mkstemp(prefix=prefix, suffix=".yaml")
        os.close(fd)
        os.chmod(path, 0o600)
        _temp_files.add(path)
        return path
    finally:
        os.umask(old_umask)


# ── Request schemas ───────────────────────────────────────────────────────────

class InvestigateRequest(BaseModel):
    type: str  # 'pod', 'deployment', or 'service'
    name: str
    namespace: str

class ScaleRequest(BaseModel):
    namespace: str
    name: str
    replicas: int

    @field_validator("namespace")
    @classmethod
    def validate_ns(cls, v: str) -> str:
        return _validate_namespace(v)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return _validate_k8s_name(v)

    @field_validator("replicas")
    @classmethod
    def validate_replicas(cls, v: int) -> int:
        if v < 0 or v > 1000:
            raise ValueError("Replicas must be between 0 and 1000")
        return v

class RestartRequest(BaseModel):
    namespace: str
    name: str

    @field_validator("namespace")
    @classmethod
    def validate_ns(cls, v: str) -> str:
        return _validate_namespace(v)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return _validate_k8s_name(v)

class DeleteRequest(BaseModel):
    namespace: str
    name: str

    @field_validator("namespace")
    @classmethod
    def validate_ns(cls, v: str) -> str:
        return _validate_namespace(v)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return _validate_k8s_name(v)

class SwitchContextRequest(BaseModel):
    context: str

class ExecRequest(BaseModel):
    container: str
    command: str

    @field_validator("container")
    @classmethod
    def validate_container(cls, v: str) -> str:
        if not v or len(v) > 253 or not K8S_NAME_RE.match(v):
            raise ValueError("Invalid container name")
        return v

    @field_validator("command")
    @classmethod
    def validate_command(cls, v: str) -> str:
        # Limit command length to prevent abuse. Commands run inside the
        # user's own container, so shell metacharacters are allowed.
        if not v or len(v) > 2000:
            raise ValueError("Command too long")
        return v

class ExplainCommandRequest(BaseModel):
    command: str
    output: str

class ApplyYamlRequest(BaseModel):
    yaml: str

class DeleteResourceRequest(BaseModel):
    kind: str
    name: str
    namespace: str

    @field_validator("kind")
    @classmethod
    def validate_kind(cls, v: str) -> str:
        return _validate_k8s_kind(v)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return _validate_k8s_name(v)

    @field_validator("namespace")
    @classmethod
    def validate_ns(cls, v: str) -> str:
        return _validate_namespace(v)

class PortForwardRequest(BaseModel):
    kind: str
    name: str
    namespace: str
    port: int = 0
    target_port: int = 0

    @field_validator("kind")
    @classmethod
    def validate_kind(cls, v: str) -> str:
        return _validate_k8s_kind(v)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return _validate_k8s_name(v)

    @field_validator("namespace")
    @classmethod
    def validate_ns(cls, v: str) -> str:
        return _validate_namespace(v)

    @field_validator("port")
    @classmethod
    def validate_port_range(cls, v: int) -> int:
        if v < 0 or v > 65535:
            raise ValueError("Port must be between 0 and 65535")
        return v

    @field_validator("target_port")
    @classmethod
    def validate_target_port_range(cls, v: int) -> int:
        if v < 0 or v > 65535:
            raise ValueError("Target port must be between 0 and 65535")
        return v

# In-memory port-forward registry
port_forward_processes: Dict[int, subprocess.Popen] = {}
port_forward_ports: Dict[int, int] = {}

class ExplainCommandResponse(BaseModel):
    explanation: str

class GenerateCommandRequest(BaseModel):
    prompt: str

class GenerateCommandResponse(BaseModel):
    command: str

# ── Endpoints ─────────────────────────────────────────────────────────────────

# 1. Dashboard Stats
@router.get("/stats")
def get_stats(include_system: bool = False):
    return k8s_service.get_cluster_stats(include_system=include_system)

# 2. Explorer Lists
@router.get("/pods")
def get_pods(namespace: Optional[str] = Query(None), include_system: bool = False):
    return k8s_service.list_pods(namespace, include_system=include_system)

@router.get("/deployments")
def get_deployments(namespace: Optional[str] = Query(None), include_system: bool = False):
    return k8s_service.list_deployments(namespace, include_system=include_system)

@router.get("/services")
def get_services(namespace: Optional[str] = Query(None), include_system: bool = False):
    return k8s_service.list_services(namespace, include_system=include_system)

@router.get("/endpoints")
def get_endpoints(namespace: Optional[str] = Query(None), include_system: bool = False):
    return k8s_service.list_service_endpoints(namespace, include_system=include_system)

@router.get("/resources")
def get_resources(namespace: Optional[str] = Query(None), include_system: bool = False):
    try:
        return {
            "pods": k8s_service.list_pods(namespace, include_system=include_system),
            "deployments": k8s_service.list_deployments(namespace, include_system=include_system),
            "services": k8s_service.list_services(namespace, include_system=include_system),
            "nodes": k8s_service.list_nodes(),
            "configmaps": k8s_service.list_configmaps(namespace, include_system=include_system),
            "secrets": k8s_service.list_secrets(namespace, include_system=include_system),
            "statefulsets": k8s_service.list_statefulsets(namespace, include_system=include_system),
            "daemonsets": k8s_service.list_daemonsets(namespace, include_system=include_system),
            "events": k8s_service.list_events(namespace, include_system=include_system),
        }
    except Exception as e:
        raise _safe_error("Failed to fetch resources", exc=e)

@router.get("/nodes")
def get_nodes():
    return k8s_service.list_nodes()

@router.get("/configmaps")
def get_configmaps(namespace: Optional[str] = Query(None), include_system: bool = False):
    return k8s_service.list_configmaps(namespace, include_system=include_system)

@router.get("/secrets")
def get_secrets(namespace: Optional[str] = Query(None), include_system: bool = False):
    return k8s_service.list_secrets(namespace, include_system=include_system)

@router.get("/statefulsets")
def get_statefulsets(namespace: Optional[str] = Query(None), include_system: bool = False):
    return k8s_service.list_statefulsets(namespace, include_system=include_system)

@router.get("/daemonsets")
def get_daemonsets(namespace: Optional[str] = Query(None), include_system: bool = False):
    return k8s_service.list_daemonsets(namespace, include_system=include_system)

@router.get("/events-all")
def get_events_all(namespace: Optional[str] = Query(None), include_system: bool = False):
    return k8s_service.list_events(namespace, include_system=include_system)

# 3. Node-specific routes (cluster-scoped, no namespace)
@router.get("/node/{name}/details")
def get_node_details(name: str):
    try:
        return k8s_service.get_node_details(name)
    except Exception as e:
        raise _safe_error(f"Failed to get node details for {name}", exc=e)

@router.get("/node/{name}/yaml")
def get_node_yaml(name: str):
    try:
        data = k8s_service.get_node_details(name)
        cleaned_data = clean_kubernetes_dict(data)
        yaml_str = yaml.dump(cleaned_data, default_flow_style=False)
        return {"yaml": yaml_str}
    except Exception as e:
        raise _safe_error(f"Failed to get node YAML for {name}", exc=e)

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
    except HTTPException:
        raise
    except Exception as e:
        raise _safe_error(f"Failed to get {resource_type} details for {namespace}/{name}", exc=e)

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

        cleaned_data = clean_kubernetes_dict(data)
        yaml_str = yaml.dump(cleaned_data, default_flow_style=False)
        return {"yaml": yaml_str}
    except HTTPException:
        raise
    except Exception as e:
        raise _safe_error(f"Failed to get {resource_type} YAML for {namespace}/{name}", exc=e)

@router.get("/{resource_type}/{namespace}/{name}/logs")
def get_logs(resource_type: str, namespace: str, name: str, tail: int = 100, timestamps: bool = False):
    rt = resource_type.lower()
    # Clamp tail to safe range
    tail = max(10, min(tail, 5000))
    try:
        if rt == "pod":
            return {"logs": k8s_service.get_pod_logs(namespace, name, tail_lines=tail, timestamps=timestamps)}
        elif rt == "deployment":
            return {"logs": k8s_service.get_deployment_logs(namespace, name, tail_lines=tail, timestamps=timestamps)}
        elif rt == "service":
            return {"logs": k8s_service.get_service_logs(namespace, name, tail_lines=tail, timestamps=timestamps)}
        else:
            raise HTTPException(status_code=400, detail=f"Invalid resource type: {resource_type}")
    except HTTPException:
        raise
    except Exception as e:
        raise _safe_error(f"Failed to get logs for {resource_type} {namespace}/{name}", exc=e)

@router.get("/{resource_type}/{namespace}/{name}/events")
def get_events(resource_type: str, namespace: str, name: str):
    return k8s_service.get_resource_events(namespace, name, resource_type)

# 5. Investigate Endpoint
@router.post("/investigate", response_model=InvestigationResult)
async def investigate(
    req: InvestigateRequest,
    x_ai_provider: Optional[str] = Header(None),
    x_ai_key: Optional[str] = Header(None),
    x_ai_model: Optional[str] = Header(None),
    x_ai_temperature: Optional[float] = Header(None)
):
    result = await investigation_service.investigate_resource(
        resource_type=req.type,
        name=req.name,
        namespace=req.namespace,
        provider_override=x_ai_provider,
        api_key_override=x_ai_key,
        model_override=x_ai_model,
        temperature_override=x_ai_temperature
    )
    from backend.utils.text import normalize_action_plan
    result.suggested_fix = normalize_action_plan(result.suggested_fix)
    return result

# 6. Concept Learning Endpoint
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

# 7. Operations (Restart, Scale, Delete)
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

# 8. Kubeconfig Context Switchers
@router.get("/kube/contexts")
def get_kube_contexts():
    return list_contexts()

@router.post("/kube/switch")
def post_switch_context(req: SwitchContextRequest):
    success = switch_context(req.context)
    if not success:
        raise HTTPException(status_code=500, detail=f"Failed to switch to context: {req.context}")
    return {"success": True, "message": f"Successfully switched to context: {req.context}"}

# 9. Interactive Container Exec
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

# 10. Live Cluster Topology Map
@router.get("/kube/topology")
def get_kube_topology(namespace: str = Query("default"), include_system: bool = False):
    result = k8s_service.get_topology(namespace, include_system=include_system)
    if "error" in result:
        raise _safe_error(f"Topology error for namespace {namespace}: {result['error']}")
    return result

# ── Kubeconfig patching helpers ───────────────────────────────────────────────

_patched_kubeconfig_path: Optional[str] = None

def _patched_kubectl_env() -> dict:
    """Return env with patched kubeconfig for Docker/Local context consistency.
    Uses a restricted-permission temp file and tracks it for cleanup."""
    global _patched_kubeconfig_path
    env = os.environ.copy()

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
                            for k in ("certificate-authority", "certificate-authority-data", "certificate-authority-file"):
                                c["cluster"].pop(k, None)

                # Write to a restricted temp file
                tmp = _restricted_temp_file("podex-kubectl-")
                with open(tmp, "w") as f:
                    yaml.safe_dump(kc, f, default_flow_style=False)
                env["KUBECONFIG"] = tmp
                _patched_kubeconfig_path = tmp
        except Exception as e:
            logger.error(f"Error patching kubectl env: {e}")

    return env

# ── Arena / kubectl operations ───────────────────────────────────────────────

@router.post("/kube/apply")
def apply_yaml(req: ApplyYamlRequest):
    try:
        if len(req.yaml) > 500_000:  # 500KB limit
            raise _safe_error("YAML payload too large", status_code=413)
        env = _patched_kubectl_env()
        proc = subprocess.Popen(
            ["kubectl", "apply", "-f", "-"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            env=env
        )
        stdout, stderr = proc.communicate(input=req.yaml, timeout=60)
        if proc.returncode != 0:
            logger.warning(f"kubectl apply failed (exit {proc.returncode}): {stderr[:500]}")
            raise HTTPException(status_code=500, detail="Failed to apply YAML. Check server logs.")
        return {"success": True, "message": stdout}
    except subprocess.TimeoutExpired:
        proc.kill()
        raise _safe_error("kubectl apply timed out", status_code=504)
    except HTTPException:
        raise
    except Exception as e:
        raise _safe_error("kubectl apply failed", exc=e)

@router.post("/kube/delete")
def delete_resource(req: DeleteResourceRequest):
    # kind, name, namespace are validated via Pydantic field_validators
    kind_lower = req.kind
    try:
        env = _patched_kubectl_env()
        proc = subprocess.Popen(
            ["kubectl", "delete", kind_lower, req.name, "-n", req.namespace],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            env=env
        )
        stdout, stderr = proc.communicate(timeout=60)
        if proc.returncode != 0:
            logger.warning(f"kubectl delete failed (exit {proc.returncode}): {stderr[:500]}")
            raise HTTPException(status_code=500, detail="Failed to delete resource. Check server logs.")
        return {"success": True, "message": stdout}
    except subprocess.TimeoutExpired:
        proc.kill()
        raise _safe_error("kubectl delete timed out", status_code=504)
    except HTTPException:
        raise
    except Exception as e:
        raise _safe_error("kubectl delete failed", exc=e)

# ── Port Forwarding ──────────────────────────────────────────────────────────

@router.post("/kube/port-forward")
def start_port_forward(req: PortForwardRequest):
    # kind, name, namespace validated via Pydantic field_validators
    kind = req.kind
    try:
        local_port = req.port
        target_port = req.target_port
        if local_port > 0 and target_port > 0:
            port_arg = f"{local_port}:{target_port}"
        elif local_port > 0:
            port_arg = str(local_port)
        else:
            port_arg = ""

        is_docker = os.path.exists("/.dockerenv")
        # Bind to 127.0.0.1 by default; use 0.0.0.0 only inside Docker
        bind_address = "0.0.0.0" if is_docker else "127.0.0.1"

        env = _patched_kubectl_env()
        proc = subprocess.Popen(
            ["kubectl", "port-forward", "--address", bind_address, f"{kind}/{req.name}", port_arg, "-n", req.namespace],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            env=env
        )
        time.sleep(1.5)

        # Verify the process is still running and did not crash
        exit_code = proc.poll()
        if exit_code is not None:
            stderr_data = proc.stderr.read() if proc.stderr else "Unknown error"
            raise _safe_error(f"Port-forward failed to start (exit {exit_code})")

        if local_port > 0:
            allocated_port = local_port
        else:
            stderr_line = proc.stderr.readline() if proc.stderr else ""
            match = re.search(r'(?:127\.0\.0\.1|0\.0\.0\.0):(\d+)', stderr_line)
            allocated_port = int(match.group(1)) if match else 0

        pid = proc.pid
        port_forward_processes[pid] = proc
        port_forward_ports[pid] = allocated_port
        return {
            "pid": pid,
            "port": allocated_port,
            "target_port": target_port or allocated_port,
            "is_docker": is_docker,
            "message": f"Forwarding to {req.name} on port {allocated_port}"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise _safe_error("Port-forward failed", exc=e)

@router.delete("/kube/port-forward/{pid}")
def stop_port_forward(pid: int):
    try:
        proc = port_forward_processes.pop(pid, None)
        port_forward_ports.pop(pid, None)
        if proc:
            if os.name == 'nt':
                proc.terminate()
            else:
                os.kill(pid, signal.SIGTERM)
            return {"success": True, "message": f"Port forward {pid} stopped."}
        return {"success": False, "message": "Process not found."}
    except Exception as e:
        raise _safe_error(f"Failed to stop port-forward {pid}", exc=e)

# ── Docker port proxy (restricted to active port-forwards) ────────────────────

@router.api_route("/proxy/{port}/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy_to_port(port: int, path: str, request: Request):
    # Only allow proxying to ports that are currently being forwarded
    active_ports = {
        local_port
        for pid, local_port in port_forward_ports.items()
        if port_forward_processes.get(pid) is not None
        and port_forward_processes[pid].poll() is None
    }
    if not active_ports:
        raise HTTPException(status_code=404, detail="No active port-forwards. Start one first.")
    if port not in active_ports:
        raise HTTPException(status_code=404, detail=f"Port {port} is not being forwarded.")

    # Sanitize the path: prevent path traversal
    # Remove any ".." components
    sanitized_path = path.lstrip("/")
    if ".." in sanitized_path or sanitized_path.startswith("~"):
        raise HTTPException(status_code=400, detail="Invalid path.")

    import httpx
    from fastapi.responses import StreamingResponse
    target = f"http://127.0.0.1:{port}/{sanitized_path}"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            headers = {
                k: v for k, v in request.headers.items()
                if k.lower() not in ("host", "connection", "content-length", "accept-encoding")
            }
            body = await request.body() if request.method not in ("GET", "HEAD") else None
            req = client.build_request(request.method, target, headers=headers, content=body, params=request.query_params)
            resp = await client.send(req, stream=True)
            return StreamingResponse(
                resp.aiter_bytes(),
                status_code=resp.status_code,
                headers={
                    k: v for k, v in resp.headers.items()
                    if k.lower() not in ("content-length", "content-encoding", "transfer-encoding", "connection", "keep-alive")
                },
            )
    except Exception as e:
        raise _safe_error(f"Proxy to port {port} failed", status_code=502, exc=e)

# ── Shell fallback ────────────────────────────────────────────────────────────

@router.websocket("/ws/shell")
async def ws_shell_fallback(websocket: WebSocket):
    # Validate origin to prevent cross-site WebSocket hijacking (CSWSH)
    from backend.utils.ws_security import is_origin_allowed
    if not is_origin_allowed(websocket):
        await websocket.close(code=1008, reason="Origin not allowed")
        return
    if run_shell_ws is None:
        await websocket.accept()
        await websocket.send_text("\r\n[Podex shell unavailable: shell module not found]\r\n")
        await websocket.close()
        return
    await run_shell_ws(websocket)