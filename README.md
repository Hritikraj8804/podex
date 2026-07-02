# Podex

> Learn Kubernetes by understanding your own cluster.

Podex is an open-source, AI-powered Kubernetes workspace designed specifically for beginners, students, and developers learning Kubernetes for the first time. The goal is not to replace administrator dashboards like Lens or Rancher, but to act as a **local mentor** that explains concepts, aggregates context, and troubleshoots failures in plain English.

## 🌟 Key Features

* **Visual Dashboard**: Live statistics showing cluster health and resource counts (nodes, pods, deployments, services).
* **Resource Explorer**: Filter and inspect active resources. System-managed namespaces (`kube-system`, etc.) are hidden by default to remove noise, but can be toggled on.
* **Explain Before Execute**: Destructive operations (restart deployment, scale deployment, delete pod) require explicit confirmation and provide a detailed explanation of what Kubernetes will do.
* **Clean YAML Inspector**: Stems out bloated system keys (like `managedFields`, `uid`, `resourceVersion`) to show clean, readable configurations.
* **AI investigation**: One-click AI troubleshooting. The backend automatically aggregates pod specs, container logs, and namespace events to diagnose issues, explain why they occurred, suggest fixes, and provide educational lessons.
* **Sandbox Mock Fallback**: Runs in "Sandbox Mode" out-of-the-box if no API keys are provided.

## 🛠️ Architecture

Podex is designed to run entirely on your local machine with zero cloud infrastructure dependencies.

```
Browser (React + TS + TailwindCSS v4)
   │
   ▼
REST API (FastAPI)
   │
   ├─► Kubernetes Client (Official Python SDK) ──► Kind / Minikube Cluster
   │
   └─► AI Services (Gemini / OpenAI) 
```

* **Local Kind Connector**: The backend automatically detects if it is running inside Docker Compose and patches in-memory cluster API endpoints pointing to `localhost` to map to the host's `host.docker.internal` gateway, bypassing self-signed SSL certificate blocks.

## 🚀 Quick Start

### 1. Prerequisites
Ensure you have the following installed on your host:
* [Docker Desktop](https://www.docker.com/products/docker-desktop/)
* [Kind](https://kind.sigs.k8s.k8s.io/) (or Minikube)
* [kubectl](https://kubernetes.io/docs/tasks/tools/)

### 2. Launch Podex
Clone this repository and run:
```bash
docker compose up --build
```
Once the containers start up, open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

## 🧪 Testing Failures with the Demo Manifest

To test the AI investigator, we have included a demo manifest containing both healthy and failing workloads:

1. Deploy the examples to your local cluster:
   ```bash
   kubectl apply -f examples/demo-pod-failure.yaml
   ```
2. Open the Podex Explorer.
3. You will see:
   * `healthy-demo-pod`: Running successfully (Green).
   * `failing-demo-pod`: Degraded with `ImagePullBackOff` (Red).
   * `crashing-deployment`: Crashing with `CrashLoopBackOff` (Red).
4. Click on `failing-demo-pod`, go to the **Investigate** tab, and click **Investigate with AI Mentor** to see the structured analysis!

## 🔑 AI Provider Configuration

By default, Podex runs in a mock sandbox mode. To enable real AI diagnostics, pass your API keys inside `docker-compose.yml` or set them in your shell environment:

* **Gemini** (Default): Set `GEMINI_API_KEY` and ensure `AI_PROVIDER=gemini`.
* **OpenAI**: Set `OPENAI_API_KEY` and set `AI_PROVIDER=openai`.

## 📄 License
This project is licensed under the [MIT License](LICENSE).
