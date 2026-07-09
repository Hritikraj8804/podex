import asyncio
import threading
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from kubernetes import client
from kubernetes.stream import stream

router = APIRouter()

class PodTerminalSession:
    def __init__(self, ws: WebSocket, namespace: str, pod: str, container: str):
        self.ws = ws
        self.namespace = namespace
        self.pod = pod
        self.container = container
        self.resp = None
        self.loop = asyncio.get_running_loop()
        self.should_stop = False

    def start(self):
        self.thread = threading.Thread(target=self.run_socket_bridge)
        self.thread.daemon = True
        self.thread.start()

    def run_socket_bridge(self):
        try:
            api = client.CoreV1Api()
            # Default shell
            exec_command = ["/bin/sh"]
            self.resp = stream(
                api.connect_get_namespaced_pod_exec,
                name=self.pod,
                namespace=self.namespace,
                container=self.container,
                command=exec_command,
                stderr=True,
                stdin=True,
                stdout=True,
                tty=True,
                _preload_content=False
            )
            
            while not self.should_stop and self.resp.is_open():
                output = self.resp.read_stdout(timeout=0.05)
                if output:
                    asyncio.run_coroutine_threadsafe(
                        self.ws.send_text(output),
                        self.loop
                    )
                
                err = self.resp.read_stderr(timeout=0.05)
                if err:
                    asyncio.run_coroutine_threadsafe(
                        self.ws.send_text(err),
                        self.loop
                    )
        except Exception as e:
            print(f"Terminal session error: {e}")
            asyncio.run_coroutine_threadsafe(
                self.ws.send_text(f"\r\n[Podex terminal error: {e}]\r\n"),
                self.loop
            )
        finally:
            self.close()

    def write(self, data: str):
        if self.resp and self.resp.is_open():
            try:
                self.resp.write_stdin(data)
            except Exception as e:
                print(f"Error writing to stdin: {e}")

    def close(self):
        self.should_stop = True
        if self.resp:
            try:
                self.resp.close()
            except Exception:
                pass

@router.websocket("/ws/exec/{namespace}/{pod}/{container}")
async def ws_exec(websocket: WebSocket, namespace: str, pod: str, container: str):
    await websocket.accept()
    
    session = PodTerminalSession(websocket, namespace, pod, container)
    session.start()
    
    try:
        while True:
            data = await websocket.receive_text()
            session.write(data)
    except WebSocketDisconnect:
        pass
    finally:
        session.close()
