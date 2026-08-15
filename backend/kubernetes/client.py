# Trigger reload - Re-initialized local Kind kubeconfig settings
import os
import logging
import tempfile
import atexit
import urllib3
from typing import Optional, Set
from kubernetes import client, config
from backend.config.settings import settings

# Disable warnings about unverified HTTPS requests since we will bypass SSL for host.docker.internal
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger("podex.k8s.client")

# Track temp files for cleanup
_temp_files: Set[str] = set()

def _cleanup_temp_files() -> None:
    for path in list(_temp_files):
        try:
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass

atexit.register(_cleanup_temp_files)

def _restricted_temp_file(prefix: str) -> str:
    """Create a temp file with restricted permissions (0o600) and track it."""
    old_umask = os.umask(0o177)  # 0o600 permissions
    try:
        fd, path = tempfile.mkstemp(prefix=prefix, suffix=".yaml")
        os.close(fd)
        os.chmod(path, 0o600)
        _temp_files.add(path)
        return path
    finally:
        os.umask(old_umask)


def apply_client_configurations():
    # Access active configuration
    try:
        c = client.Configuration.get_default_copy()
    except AttributeError:
        c = client.Configuration._default
        
    # If running inside Docker and target is localhost/127.0.0.1, redirect to host.docker.internal
    is_docker = os.path.exists("/.dockerenv")
    if is_docker:
        if "127.0.0.1" in c.host:
            c.host = c.host.replace("127.0.0.1", "host.docker.internal")
        elif "localhost" in c.host:
            c.host = c.host.replace("localhost", "host.docker.internal")
        
    # Disable SSL verification for local self-signed Kind/Minikube certs
    if is_docker or settings.environment == "development":
        c.verify_ssl = False
        client.Configuration.set_default(c)
        
    logger.info(f"Kubernetes client configurations applied. Server API host: {c.host}")

DEFAULT_KUBECONFIG = os.path.expanduser("~/.kube/config")

def _patch_kubeconfig(config_path: Optional[str]) -> str:
    """Patch kubeconfig to add current-context if missing, return path to patched file.
    Uses a restricted temp file and tracks it for cleanup.
    If no patching is needed, returns the original path."""
    import yaml as yamllib
    path = config_path or DEFAULT_KUBECONFIG
    if not path or not os.path.exists(path):
        return config_path
    with open(path, "r") as f:
        kc = yamllib.safe_load(f)
    if not kc:
        return config_path
    if not kc.get("current-context") and kc.get("contexts"):
        names = [c["name"] for c in kc["contexts"]]
        preferred = next((n for n in ["kind-podex", "kind-kind-podex"] if n in names), names[0])
        kc["current-context"] = preferred
        tmp = _restricted_temp_file("podex-kubeconfig-client-")
        with open(tmp, "w") as f:
            yamllib.dump(kc, f, default_flow_style=False)
        logger.debug(f"Patched kubeconfig written to {tmp}")
        return tmp
    return path

active_context_name: Optional[str] = None

def get_active_context_name() -> Optional[str]:
    global active_context_name
    return active_context_name

def init_k8s_client() -> bool:
    """
    Initializes the Kubernetes Python client configuration.
    Patches kubeconfig if current-context is missing.
    """
    global active_context_name
    try:
        kc_path = _patch_kubeconfig(settings.kubeconfig)
        config.load_kube_config(config_file=kc_path)
        apply_client_configurations()
        
        # Track the loaded active context
        import yaml as yamllib
        if kc_path and os.path.exists(kc_path):
            with open(kc_path, "r") as f:
                kc = yamllib.safe_load(f)
            if kc:
                active_context_name = kc.get("current-context")
        return True
    except Exception as e:
        logger.warning(f"Failed to load kube config: {e}. Trying in-cluster config...")
        try:
            config.load_in_cluster_config()
            logger.info("Kubernetes client initialized with in-cluster config.")
            active_context_name = "in-cluster"
            return True
        except Exception as incluster_err:
            logger.error(f"Failed to load in-cluster configuration: {incluster_err}")
            return False

def list_contexts() -> dict:
    try:
        kc_path = _patch_kubeconfig(settings.kubeconfig)
        contexts, active_context = config.list_kube_config_contexts(config_file=kc_path)
        return {
            "contexts": [c["name"] for c in contexts],
            "active_context": active_context.get("name") if active_context else None
        }
    except Exception as e:
        logger.error(f"Error listing kube contexts: {e}")
        return {"contexts": [], "active_context": None}

def switch_context(context_name: str) -> bool:
    global active_context_name
    try:
        config.load_kube_config(config_file=settings.kubeconfig, context=context_name)
        apply_client_configurations()
        active_context_name = context_name
        return True
    except Exception as e:
        logger.error(f"Error switching kube context to {context_name}: {e}")
        return False

# Setup APIs getters helper
def get_core_api() -> client.CoreV1Api:
    return client.CoreV1Api()

def get_apps_api() -> client.AppsV1Api:
    return client.AppsV1Api()