#!/usr/bin/env bash
set -e

KUBECONF="${KUBECONFIG:-/root/.kube/config}"
SRC="${KUBE_READONLY_SOURCE:-/root/.kube-host}"

echo "[podex-shell] entrypoint starting. KUBECONFIG=${KUBECONF}"

# Copy the (read-only) mounted kubeconfig to a writable location so the
# Docker-network patch script can update it in place.
if [ -f "$SRC/config" ]; then
    echo "[podex-shell] Found kubeconfig mount at ${SRC}, copying to ${KUBECONF}"
    mkdir -p "$(dirname "$KUBECONF")"
    cp "$SRC/config" "$KUBECONF"
    chmod 600 "$KUBECONF"
fi

if [ -f "$KUBECONF" ]; then
    echo "[podex-shell] Patching kubeconfig for Docker networking..."
    python3 /app/patch_kubeconfig.py "$KUBECONF" || echo "[podex-shell] kubeconfig patch failed (non-fatal)"
else
    echo "[podex-shell] WARNING: no kubeconfig found. kubectl commands will fail until a kubeconfig is mounted."
fi

cd /app
exec uvicorn main:app --host 0.0.0.0 --port 3458