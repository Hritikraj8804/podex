import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.services.k8s_service import K8sService
from backend.utils.ws_security import is_origin_allowed

logger = logging.getLogger("podex.updates")

router = APIRouter()
k8s_service = K8sService()

@router.websocket("/ws/updates")
async def ws_updates(websocket: WebSocket, namespace: str = "default", include_system: bool = False):
    # Validate origin to prevent cross-site WebSocket hijacking (CSWSH)
    if not is_origin_allowed(websocket):
        await websocket.close(code=1008, reason="Origin not allowed")
        return

    await websocket.accept()
    active_namespace = namespace

    # Listen for namespace switch messages from the client
    async def receive_messages():
        nonlocal active_namespace
        try:
            while True:
                data = await websocket.receive_text()
                try:
                    msg = json.loads(data)
                    if msg.get("action") == "set_namespace":
                        active_namespace = msg.get("namespace", "default")
                except Exception as e:
                    logger.warning(f"Error parsing WS message: {e}")
        except WebSocketDisconnect:
            pass

    # Spawn receiver loop in the background
    receive_task = asyncio.create_task(receive_messages())

    try:
        while True:
            try:
                stats = k8s_service.get_cluster_stats(include_system=include_system)
                pods = k8s_service.list_pods(active_namespace, include_system=include_system)
                deployments = k8s_service.list_deployments(active_namespace, include_system=include_system)
                services = k8s_service.list_services(active_namespace, include_system=include_system)
                configmaps = k8s_service.list_configmaps(active_namespace, include_system=include_system)
                secrets = k8s_service.list_secrets(active_namespace, include_system=include_system)
                statefulsets = k8s_service.list_statefulsets(active_namespace, include_system=include_system)
                daemonsets = k8s_service.list_daemonsets(active_namespace, include_system=include_system)
                events = k8s_service.list_events(active_namespace, include_system=include_system)
                topology = k8s_service.get_topology(active_namespace, include_system=include_system)

                payload = {
                    "stats": stats,
                    "resources": {
                        "pods": pods,
                        "deployments": deployments,
                        "services": services,
                        "nodes": k8s_service.list_nodes(),
                        "configmaps": configmaps,
                        "secrets": secrets,
                        "statefulsets": statefulsets,
                        "daemonsets": daemonsets,
                        "events": events,
                    },
                    "topology": topology
                }
                
                await websocket.send_json(payload)
            except Exception as err:
                logger.error(f"Error in updates fetch loop: {err}")
                try:
                    await websocket.send_json({"error": "Failed to fetch cluster data. Check server logs."})
                except Exception:
                    break

            # Poll/stream every 2 seconds
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass
    finally:
        receive_task.cancel()