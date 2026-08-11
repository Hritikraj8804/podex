#!/usr/bin/env python3
"""Patch a kubeconfig so kubectl inside the Podex Shell container can reach
the host's local Kubernetes cluster (kind/minikube) via host.docker.internal."""
import sys


def main(path: str) -> None:
    import os

    if not os.path.exists(path):
        print(f"[podex-shell] kubeconfig not found at {path}")
        return

    try:
        import yaml
    except ImportError:
        print("[podex-shell] PyYAML missing; skipping kubeconfig patch")
        return

    with open(path) as f:
        kc = yaml.safe_load(f) or {}

    if not kc.get("current-context") and kc.get("contexts"):
        names = [c["name"] for c in kc["contexts"]]
        preferred = next((n for n in ["kind-podex", "kind-kind-podex"] if n in names), names[0])
        kc["current-context"] = preferred

    for cluster in kc.get("clusters") or []:
        cls = cluster.get("cluster") or {}
        server = cls.get("server", "")
        if "127.0.0.1" in server:
            cls["server"] = server.replace("127.0.0.1", "host.docker.internal")
        elif "localhost" in server:
            cls["server"] = server.replace("localhost", "host.docker.internal")
        cls["insecure-skip-tls-verify"] = True

    with open(path, "w") as f:
        yaml.safe_dump(kc, f)
    print("[podex-shell] kubeconfig patched (host.docker.internal + insecure-skip-tls-verify)")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/root/.kube/config")