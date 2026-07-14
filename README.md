# Podex

> Learn Kubernetes by understanding your own cluster.

Podex is an open-source, AI-powered Kubernetes workspace designed for beginners, students, and developers learning Kubernetes. It acts as a **local mentor** that explains concepts, aggregates context, and troubleshoots failures in plain English — all through a visual, desktop-like interface.

## 🌟 Key Features

* **Visual Dashboard**: Live cluster overview with health metrics, pod status matrix (color-coded running/pending/failed cells), stat cards (pods, nodes, deployments, services), and a needs-attention panel.
* **Cluster Explorer**: Tabbed interface for 9 resource types — Pods, Deployments, Services, Nodes, ConfigMaps, Secrets, StatefulSets, DaemonSets, Events. Includes namespace filtering, search, bulk delete, and real-time updates via WebSocket.
* **Topology Diagram**: Dynamic column-based cluster map (Ingress → Service → Deployment → Pod) with pan/zoom, drag-repositioning, and search filtering.
* **Arena Playground**: Drag-and-drop React Flow canvas to visually model Kubernetes architectures. Auto-generates clean YAML from visual blocks. Canvas state persists across browser refreshes via sessionStorage.
* **Poddy AI Tutor**: ChatGPT-style chat interface to ask Kubernetes questions. Get structured explanations with concept overviews, real-world analogies, why-it-exists reasoning, and common gotchas.
* **AI Investigation**: One-click troubleshooting. Aggregates pod specs, logs, and events to diagnose issues, explain root causes, suggest fixes, and provide educational lessons.
* **Live Terminal & Logs**: WebSocket-backed interactive shell inside containers. SSE log streaming with configurable tail/timestamps. AI Command Generator turns natural language into kubectl commands.
* **Port Forwarding**: One-click port forward to Pods and Services directly from the Explorer table.
* **Explain Before Execute**: Destructive operations show educational modals explaining what Kubernetes will do behind the scenes (rolling updates, SIGTERM/SIGKILL, replica scaling).
* **Sandbox Mock Fallback**: Runs fully in sandbox mode out-of-the-box with no API keys required.

## 🛠️ Architecture

```
Browser (React 19 + Vite + TailwindCSS v4 + React Flow)
   │
   ▼
REST / SSE / WebSocket (FastAPI)
   │
   ├─► Kubernetes Client (Official Python SDK) ──► Kind / Minikube / any K8s cluster
   │
   ├─► kubectl port-forward subprocess ──► localhost:PORT
   │
   └─► AI Services (Gemini / OpenAI / Mock)
```

* **Local Cluster Connector**: Auto-detects Docker Compose and patches cluster endpoints from `localhost` to `host.docker.internal` for seamless container-to-host routing.
* **WebSocket Updates**: Real-time resource data pushed to the Explorer via `/api/ws/updates`.

## 🚀 Quick Start

### 1. Prerequisites
* [Docker Desktop](https://www.docker.com/products/docker-desktop/)
* [Kind](https://kind.sigs.k8s.io/) (or Minikube)
* [kubectl](https://kubernetes.io/docs/tasks/tools/)

### 2. Launch
```bash
git clone https://github.com/Hritikraj8804/podex.git
cd podex
docker compose up --build
```
Open 👉 **[http://localhost:3000](http://localhost:3000)**

| Service | Port |
|---------|------|
| Frontend (Vite) | `3000` |
| Backend (FastAPI) | `8000` |

## 🧪 Testing with Demo Manifest

```bash
kubectl apply -f examples/demo-pod-failure.yaml
```

Open the Explorer to see:
- `healthy-demo-pod` — Running (green)
- `failing-demo-pod` — `ImagePullBackOff` (red)
- `crashing-deployment` — `CrashLoopBackOff` (red)

Click any pod → **Investigate** tab → **Ask Poddy** for AI-powered diagnosis.

## 🤖 Poddy AI

Podex's AI companion is named **Poddy**. Appears throughout the app:

| Location | What it does |
|----------|-------------|
| **Poddy tab** (sidebar) | ChatGPT-style Q&A about Kubernetes concepts |
| **Investigate tab** | One-click pod diagnosis with root cause, evidence, fix |
| **Terminal** | AI Command Generator — natural language → kubectl commands |
| **Dashboard** | Quick diagnosis popup on pod cells |

### AI Providers
Set in `docker-compose.yml` or environment:
- **Gemini** (default): `GEMINI_API_KEY`
- **OpenAI**: `OPENAI_API_KEY` + `AI_PROVIDER=openai`

Without keys, Poddy runs in mock sandbox mode.

## 📁 Project Structure

```
podex/
├── backend/          # FastAPI Python backend
│   ├── ai/           # LLM providers & prompts
│   ├── api/          # REST routes, WebSocket terminal, updates
│   ├── kubernetes/   # K8s client config & patching
│   ├── services/     # K8s operations, investigation
│   └── main.py       # App entry point
├── frontend/         # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/   # Tab panels (Dashboard, Explorer, Arena, etc.)
│   │   ├── App.tsx       # Main layout, sidebar, drawer controller
│   │   └── main.tsx      # DOM mount
│   └── public/           # Logo, mascot, favicon assets
├── docker/           # Dockerfile.backend, Dockerfile.frontend, nginx.conf
├── docs/             # Architecture documentation
├── examples/         # Demo pod failure manifest
└── docker-compose.yml
```

## 📄 License
[MIT License](LICENSE)
