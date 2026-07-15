# Trigger reload - Re-initialized local Kind kubeconfig settings
import os
import urllib3
from typing import Optional
from kubernetes import client, config
from backend.config.settings import settings

# Disable warnings about unverified HTTPS requests since we will bypass SSL for host.docker.internal
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

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
        
    print(f"Kubernetes client configurations applied. Server API host: {c.host}")

def _patch_kubeconfig(config_path: str) -> str:
    """Patch kubeconfig to add current-context if missing, and return path to patched file."""
    import yaml as yamllib
    if not config_path or not os.path.exists(config_path):
        return config_path
    with open(config_path, "r") as f:
        kc = yamllib.safe_load(f)
    if not kc:
        return config_path
    if not kc.get("current-context") and kc.get("contexts"):
        names = [c["name"] for c in kc["contexts"]]
        preferred = next((n for n in ["kind-podex", "kind-kind-podex"] if n in names), names[0])
        kc["current-context"] = preferred
        import tempfile
        tmp = os.path.join(tempfile.gettempdir(), "podex-kubeconfig-client")
        with open(tmp, "w") as f:
            yamllib.dump(kc, f, default_flow_style=False)
        return tmp
    return config_path

def init_k8s_client() -> bool:
    """
    Initializes the Kubernetes Python client configuration.
    Patches kubeconfig if current-context is missing.
    """
    try:
        kc_path = _patch_kubeconfig(settings.kubeconfig)
        config.load_kube_config(config_file=kc_path)
        apply_client_configurations()
        return True
    except Exception as e:
        print(f"Failed to load kube config: {e}. Trying in-cluster config...")
        try:
            config.load_in_cluster_config()
            print("Kubernetes client initialized with in-cluster config.")
            return True
        except Exception as incluster_err:
            print(f"Failed to load in-cluster configuration: {incluster_err}")
            return False

def list_contexts() -> dict:
    try:
        contexts, active_context = config.list_kube_config_contexts(config_file=settings.kubeconfig)
        return {
            "contexts": [c["name"] for c in contexts],
            "active_context": active_context.get("name") if active_context else None
        }
    except Exception as e:
        print(f"Error listing kube contexts: {e}")
        return {"contexts": [], "active_context": None}

def switch_context(context_name: str) -> bool:
    try:
        config.load_kube_config(config_file=settings.kubeconfig, context=context_name)
        apply_client_configurations()
        return True
    except Exception as e:
        print(f"Error switching kube context to {context_name}: {e}")
        return False

# Setup APIs getters helper
def get_core_api() -> client.CoreV1Api:
    return client.CoreV1Api()

def get_apps_api() -> client.AppsV1Api:
    return client.AppsV1Api()
