import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.services.k8s_service import K8sService

router = APIRouter()
k8s_service = K8sService()

@router.websocket("/ws/updates")
async def ws_updates(websocket: WebSocket, namespace: str = "default"):
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
                    print(f"Error parsing WS message: {e}")
        except WebSocketDisconnect:
            pass

    # Spawn receiver loop in the background
    receive_task = asyncio.create_task(receive_messages())

    try:
        while True:
            try:
                stats = k8s_service.get_cluster_stats()
                pods = k8s_service.list_pods(active_namespace)
                deployments = k8s_service.list_deployments(active_namespace)
                services = k8s_service.list_services(active_namespace)
                topology = k8s_service.get_topology(active_namespace)
                
                payload = {
                    "stats": stats,
                    "resources": {
                        "pods": pods,
                        "deployments": deployments,
                        "services": services
                    },
                    "topology": topology
                }
                
                await websocket.send_json(payload)
            except Exception as err:
                print(f"Error in updates fetch loop: {err}")
                try:
                    await websocket.send_json({"error": str(err)})
                except Exception:
                    break

            # Poll/stream every 2 seconds
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass
    finally:
        receive_task.cancel()
