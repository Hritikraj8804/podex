import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useReactFlow,
  Panel,
  MarkerType,
} from 'reactflow';
import type { Connection, Edge, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Layers, Trash2, Play, Loader2, AlertCircle, FileText, Lock,
  Globe, Database, Lightbulb, ChevronLeft, ChevronRight, Cpu, Network,
  Box, Settings2, Trash, Rocket,
} from 'lucide-react';
import K8sNode from './nodes/K8sNode';

export interface ArenaNode {
  id: string;
  type: 'pod' | 'deployment' | 'service' | 'configmap' | 'secret' | 'ingress' | 'statefulset';
  name: string;
  x: number;
  y: number;
  status: 'draft' | 'deploying' | 'healthy' | 'failed' | 'deleted';
  statusMessage?: string;
  deployedAt?: number;
  config: {
    image: string;
    replicas: number;
    port: number;
    targetPort: number;
    serviceType: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
    selector: string;
    configKey: string;
    configValue: string;
    secretKey: string;
    secretValue: string;
    ingressHost: string;
    ingressPath: string;
    ingressService: string;
    serviceName: string;
  };
}

export interface ArenaConnection {
  id: string;
  fromId: string;
  toId: string;
}

interface ArenaTabProps {
  apiUrl: string;
  nodes: ArenaNode[];
  setNodes: React.Dispatch<React.SetStateAction<ArenaNode[]>>;
  connections: ArenaConnection[];
  setConnections: React.Dispatch<React.SetStateAction<ArenaConnection[]>>;
  selectedNodeId: string | null;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setToast?: (toast: { message: string; type: 'success' | 'error' | 'info'; link?: string } | null) => void;
  liveResources?: {
    pods?: any[];
    deployments?: any[];
    services?: any[];
    configmaps?: any[];
    secrets?: any[];
    statefulsets?: any[];
  };
  liveSyncEnabled?: boolean;
}

const nodeTypes = { k8sNode: K8sNode };

const TOOLBOX_ITEMS: { type: ArenaNode['type']; icon: React.ElementType; label: string; color: string }[] = [
  { type: 'pod',        icon: Cpu,        label: 'Pod',        color: '#3b82f6' },
  { type: 'deployment', icon: Layers,     label: 'Deployment', color: '#10b981' },
  { type: 'statefulset',icon: Database,   label: 'StatefulSet',color: '#8b5cf6' },
  { type: 'service',    icon: Network,    label: 'Service',    color: '#06b6d4' },
  { type: 'ingress',    icon: Globe,      label: 'Ingress',    color: '#f59e0b' },
  { type: 'configmap',  icon: FileText,   label: 'ConfigMap',  color: '#64748b' },
  { type: 'secret',     icon: Lock,       label: 'Secret',     color: '#f43f5e' },
];

const TEMPLATES: { id: 'web' | 'db' | 'full'; icon: React.ElementType; label: string; desc: string; color: string }[] = [
  { id: 'web',   icon: Rocket,    label: 'Scalable Web App',   desc: 'Service + Deployment', color: '#06b6d4' },
  { id: 'db',    icon: Database,  label: 'Database Stack',     desc: 'StatefulSet + Secret + ConfigMap', color: '#8b5cf6' },
  { id: 'full',  icon: Globe,     label: 'Full HTTP Ingress',  desc: 'Ingress + Service + Deploy + ConfigMap', color: '#f59e0b' },
];

const base64Encode = (str: string): string => {
  try {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    ));
  } catch {
    return btoa(str);
  }
};

// Podex-styled page served by any nginx workload created in the Arena.
// Uses nginx SSI so pod name, IP, client details are REAL data, not hardcoded.
const PODEX_NGINX_INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Podex Arena - Live Workload</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0b0c10; --panel: #0d1117; --panel2: #111820; --panel3: #1b2332;
    --border: #1b2332; --text: #c5c6c7; --muted: #7f848e; --bright: #f0f6f6;
    --accent: #06b6d4; --blue: #3b82f6; --green: #10b981; --amber: #f59e0b;
    --mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
    --sans: "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  html, body { height: 100%; }
  body {
    background:
      radial-gradient(900px 480px at 15% -10%, rgba(6,182,212,.14), transparent 60%),
      radial-gradient(700px 420px at 100% 0%, rgba(59,130,246,.10), transparent 60%),
      radial-gradient(600px 400px at 50% 110%, rgba(139,92,246,.06), transparent 60%),
      var(--bg);
    color: var(--text); min-height: 100vh;
    font-family: var(--sans); display: flex; flex-direction: column;
    -webkit-font-smoothing: antialiased;
  }
  /* ---- Top navigation ---- */
  nav {
    display: flex; align-items: center; gap: 28px; padding: 16px 40px;
    border-bottom: 1px solid var(--border); background: rgba(13,17,23,.7);
    backdrop-filter: blur(10px); position: sticky; top: 0; z-index: 10;
    flex-wrap: wrap;
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand .mark {
    width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, #06b6d4, #3b82f6); color: #04283a; font-weight: 800; font-size: 17px;
    box-shadow: 0 4px 16px rgba(6,182,212,.4);
  }
  .brand .t { font-size: 17px; font-weight: 800; color: var(--bright); letter-spacing: -0.02em; }
  .brand .t span { color: var(--accent); }
  .nav-links { display: flex; gap: 22px; }
  .nav-links a { color: var(--muted); text-decoration: none; font-size: 13px; font-weight: 600; transition: color .15s; }
  .nav-links a:hover { color: var(--accent); }
  .nav-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
  .status-pill {
    display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px;
    font-size: 11px; font-weight: 700; background: rgba(16,185,129,.1); color: var(--green); border: 1px solid rgba(16,185,129,.4);
  }
  .status-pill .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); box-shadow: 0 0 10px rgba(16,185,129,.9); animation: pulse 1.8s infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
  .btn {
    display: inline-flex; align-items: center; gap: 7px; padding: 8px 16px; border-radius: 9px;
    font-size: 12.5px; font-weight: 700; text-decoration: none; transition: all .15s; cursor: pointer;
  }
  .btn.ghost { border: 1px solid var(--border); color: var(--text); background: var(--panel2); }
  .btn.ghost:hover { border-color: var(--accent); color: var(--accent); }
  .btn.primary { background: var(--accent); color: #04283a; border: 1px solid var(--accent); }
  .btn.primary:hover { background: #22d3ee; }

  /* ---- Hero ---- */
  main { flex: 1; width: 100%; max-width: 1080px; margin: 0 auto; padding: 56px 40px 40px; }
  .hero { text-align: center; max-width: 720px; margin: 0 auto 44px; }
  .eyebrow {
    display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px;
    font-size: 11px; font-weight: 700; color: var(--accent); background: rgba(6,182,212,.08);
    border: 1px solid rgba(6,182,212,.3); text-transform: uppercase; letter-spacing: .08em;
  }
  .hero h1 { font-size: 40px; font-weight: 800; color: var(--bright); letter-spacing: -0.03em; line-height: 1.1; margin-top: 18px; }
  .hero h1 span { color: var(--accent); }
  .hero p { color: var(--muted); font-size: 15px; margin-top: 14px; line-height: 1.6; }
  .hero p code { color: var(--accent); font-family: var(--mono); font-size: 13px; }

  /* ---- Live status bar ---- */
  .livebar {
    display: flex; align-items: center; gap: 14px; padding: 14px 20px; border-radius: 14px;
    background: rgba(16,185,129,.06); border: 1px solid rgba(16,185,129,.3); margin-bottom: 28px;
    flex-wrap: wrap;
  }
  .livebar .lbl { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; color: var(--green); }
  .livebar .sep { width: 1px; height: 18px; background: var(--border); }
  .livebar .item { font-family: var(--mono); font-size: 12px; color: var(--text); }
  .livebar .item b { color: var(--bright); }

  /* ---- Cards grid ---- */
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
  .tile {
    background: var(--panel); border: 1px solid var(--border); border-radius: 14px;
    padding: 18px 20px; transition: border-color .15s, transform .15s;
  }
  .tile:hover { border-color: #2d3142; transform: translateY(-2px); }
  .tile .k { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: .1em; font-weight: 700; display: flex; align-items: center; gap: 8px; }
  .tile .k .ic {
    width: 24px; height: 24px; border-radius: 7px; display: inline-flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 800; background: var(--panel2); border: 1px solid var(--border); color: var(--accent);
  }
  .tile .v { font-family: var(--mono); color: var(--bright); font-size: 16px; font-weight: 700; margin-top: 10px; word-break: break-all; }
  .tile .v.acc { color: var(--accent); }
  .tile .sub { font-size: 11px; color: var(--muted); margin-top: 4px; }

  /* ---- Tech badges ---- */
  .tech { margin-top: 32px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .tech .tag {
    font-family: var(--mono); font-size: 11px; padding: 5px 12px; border-radius: 8px;
    background: var(--panel2); border: 1px solid var(--border); color: var(--muted);
  }
  .tech .tag b { color: var(--text); }
  .tech .tag .dotc { color: var(--green); }

  /* ---- Footer ---- */
  footer {
    padding: 20px 40px; border-top: 1px solid var(--border);
    display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
    background: rgba(13,17,23,.6);
  }
  footer .made { color: var(--muted); font-size: 12px; }
  footer .made code { color: var(--text); font-family: var(--mono); }
  footer .links { margin-left: auto; display: flex; gap: 18px; }
  footer .links a { color: var(--accent); text-decoration: none; font-size: 12.5px; font-weight: 600; }
  footer .links a:hover { text-decoration: underline; }

  @media (max-width: 640px) {
    nav { padding: 14px 20px; }
    .nav-links { display: none; }
    main { padding: 36px 20px 28px; }
    .hero h1 { font-size: 30px; }
    footer { padding: 18px 20px; }
  }
</style>
</head>
<body>
  <nav>
    <div class="brand">
      <div class="mark">P</div>
      <div class="t">Podex <span>Arena</span></div>
    </div>
    <div class="nav-links">
      <a href="/">Podex App</a>
      <a href="https://github.com/Hritikraj8804/podex" target="_blank" rel="noopener">GitHub</a>
      <a href="https://podex.in" target="_blank" rel="noopener">podex.in</a>
    </div>
    <div class="nav-right">
      <span class="status-pill"><span class="dot"></span> Live - Running</span>
    </div>
  </nav>

  <main>
    <div class="hero">
      <span class="eyebrow">Kubernetes - Live Pod</span>
      <h1>This pod is <span>serving your traffic</span>.</h1>
      <p>
        A real workload created in the <code>Podex Arena</code> playground.
        Everything below is live data served by this pod - nothing is hardcoded.
      </p>
    </div>

    <div class="livebar">
      <span class="lbl">Live telemetry</span>
      <span class="sep"></span>
      <span class="item">Request: <b><!--# echo var="request_method" --> <!--# echo var="request_uri" --></b></span>
      <span class="sep"></span>
      <span class="item">Proto: <b><!--# echo var="server_protocol" --></b></span>
      <span class="sep"></span>
      <span class="item">Time: <b><!--# echo var="time_local" --></b></span>
    </div>

    <div class="grid">
      <div class="tile"><div class="k"><span class="ic">P</span> Pod name</div><div class="v acc"><!--# echo var="hostname" --></div><div class="sub">container hostname</div></div>
      <div class="tile"><div class="k"><span class="ic">#</span> Pod IP</div><div class="v"><!--# echo var="server_addr" --></div><div class="sub">cluster pod address</div></div>
      <div class="tile"><div class="k"><span class="ic">C</span> Client IP</div><div class="v"><!--# echo var="remote_addr" --></div><div class="sub">who hit this page</div></div>
      <div class="tile"><div class="k"><span class="ic">@</span> Server port</div><div class="v">80</div><div class="sub">nginx listener</div></div>
      <div class="tile"><div class="k"><span class="ic">H</span> Host</div><div class="v"><!--# echo var="http_host" --></div><div class="sub">request host header</div></div>
      <div class="tile"><div class="k"><span class="ic">B</span> User agent</div><div class="v"><!--# echo var="http_user_agent" --></div><div class="sub">your browser</div></div>
    </div>

    <div class="tech">
      <span class="tag">kind <b>pod</b></span>
      <span class="tag">created in <b>Podex Arena</b></span>
      <span class="tag">image <b>nginx:alpine</b></span>
      <span class="tag">ssi <b>on</b> - live data</span>
      <span class="tag">status <b><span class="dotc">running</span></b></span>
    </div>
  </main>

  <footer>
    <span class="made">Deployed from the <code>Podex Arena</code> playground</span>
    <span class="links">
      <a href="/">Open Podex</a>
      <a href="https://github.com/Hritikraj8804/podex" target="_blank" rel="noopener">GitHub</a>
      <a href="https://podex.in" target="_blank" rel="noopener">podex.in</a>
    </span>
  </footer>
</body>
</html>`;

const PODEX_NGINX_CONF = `server {
    listen 80;
    server_name localhost;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files $uri $uri/ /index.html;
        ssi on;
    }
}`;

const indentBlock = (str: string, spaces: number): string =>
  str.split('\n').map(l => ' '.repeat(spaces) + l).join('\n');

const isNginxImage = (image: string): boolean => /nginx/i.test(image || '');

// Builds the ConfigMap doc + volume injection for nginx workloads so the
// served page is the Podex-consistent page above (with real pod data).
const nginxPageConfigMapYaml = (name: string): string => {
  const cmName = `${name}-podex-page`;
  return `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${cmName}
data:
  index.html: |-
${indentBlock(PODEX_NGINX_INDEX_HTML, 4)}
  default.conf: |-
${indentBlock(PODEX_NGINX_CONF, 4)}`;
};

const nginxVolumeMounts = (depth: 'workload' | 'pod'): string => {
  const base = depth === 'pod' ? 4 : 8;
  return `${' '.repeat(base)}volumeMounts:
${' '.repeat(base)}- name: podex-page
${' '.repeat(base + 2)}mountPath: /usr/share/nginx/html/index.html
${' '.repeat(base + 2)}subPath: index.html
${' '.repeat(base)}- name: podex-page
${' '.repeat(base + 2)}mountPath: /etc/nginx/conf.d/default.conf
${' '.repeat(base + 2)}subPath: default.conf`;
};

const nginxVolumes = (cmName: string, depth: 'workload' | 'pod'): string => {
  const base = depth === 'pod' ? 2 : 6;
  return `${' '.repeat(base)}volumes:
${' '.repeat(base)}- name: podex-page
${' '.repeat(base + 2)}configMap:
${' '.repeat(base + 4)}name: ${cmName}`;
};

const defaultConfig = (type: ArenaNode['type']): ArenaNode['config'] => ({
  image: type === 'service' || type === 'configmap' || type === 'secret' || type === 'ingress'
    ? '' : type === 'statefulset' ? 'postgres:15-alpine' : 'nginx:alpine',
  replicas: 1,
  port: type === 'statefulset' ? 5432 : 80,
  targetPort: type === 'statefulset' ? 5432 : 80,
  serviceType: 'ClusterIP',
  selector: '',
  configKey: 'APP_COLOR',
  configValue: 'cyan',
  secretKey: 'DB_PASSWORD',
  secretValue: 'super-secure-pw',
  ingressHost: 'app.local',
  ingressPath: '/',
  ingressService: '',
  serviceName: type === 'statefulset' ? 'db-service' : '',
});

const generateYaml = (node: ArenaNode, connections: ArenaConnection[], allNodes: ArenaNode[]): string => {
  const { type, name, config } = node;
  const configMapConns = connections.filter(c => c.fromId === node.id && allNodes.find(n => n.id === c.toId)?.type === 'configmap');
  const secretConns = connections.filter(c => c.fromId === node.id && allNodes.find(n => n.id === c.toId)?.type === 'secret');

  let envYaml = '';
  if (configMapConns.length > 0 || secretConns.length > 0) {
    envYaml = '\n        envFrom:';
    configMapConns.forEach(c => {
      const cm = allNodes.find(n => n.id === c.toId);
      if (cm) envYaml += `\n        - configMapRef:\n            name: ${cm.name}`;
    });
    secretConns.forEach(c => {
      const sec = allNodes.find(n => n.id === c.toId);
      if (sec) envYaml += `\n        - secretRef:\n            name: ${sec.name}`;
    });
  }

  // For nginx workloads, mount the Podex-consistent page (with real pod data).
  const useNginxPage = (type === 'pod' || type === 'deployment' || type === 'statefulset') && isNginxImage(config.image);
  const cmName = `${name}-podex-page`;
  const nginxMounts = useNginxPage ? nginxVolumeMounts(type === 'pod' ? 'pod' : 'workload') : '';
  const nginxVols = useNginxPage ? nginxVolumes(cmName, type === 'pod' ? 'pod' : 'workload') : '';

  if (type === 'pod') {
    const workload = `apiVersion: v1\nkind: Pod\nmetadata:\n  name: ${name}\n  labels:\n    app: ${name}\nspec:\n  containers:\n  - name: container\n    image: ${config.image}\n    ports:\n    - containerPort: ${config.port}${envYaml}${nginxMounts ? '\n' + nginxMounts : ''}${nginxVols ? '\n' + nginxVols : ''}`;
    return useNginxPage ? `${nginxPageConfigMapYaml(name)}\n---\n${workload}` : workload;
  } else if (type === 'deployment') {
    const workload = `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${name}\n  labels:\n    app: ${name}\nspec:\n  replicas: ${config.replicas}\n  selector:\n    matchLabels:\n      app: ${name}\n  template:\n    metadata:\n      labels:\n        app: ${name}\n    spec:\n      containers:\n      - name: container\n        image: ${config.image}\n        ports:\n        - containerPort: ${config.port}${envYaml}${nginxMounts ? '\n' + nginxMounts : ''}${nginxVols ? '\n' + nginxVols : ''}`;
    return useNginxPage ? `${nginxPageConfigMapYaml(name)}\n---\n${workload}` : workload;
  } else if (type === 'statefulset') {
    const workload = `apiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: ${name}\nspec:\n  serviceName: ${config.serviceName || 'db-service'}\n  replicas: ${config.replicas}\n  selector:\n    matchLabels:\n      app: ${name}\n  template:\n    metadata:\n      labels:\n        app: ${name}\n    spec:\n      containers:\n      - name: container\n        image: ${config.image}\n        ports:\n        - containerPort: ${config.port}${envYaml}${nginxMounts ? '\n' + nginxMounts : ''}${nginxVols ? '\n' + nginxVols : ''}`;
    return useNginxPage ? `${nginxPageConfigMapYaml(name)}\n---\n${workload}` : workload;
  } else if (type === 'service') {
    return `apiVersion: v1\nkind: Service\nmetadata:\n  name: ${name}\nspec:\n  type: ${config.serviceType}\n  ports:\n  - port: ${config.port}\n    targetPort: ${config.targetPort}\n  selector:\n    app: ${config.selector || 'my-app'}`;
  } else if (type === 'configmap') {
    return `apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: ${name}\ndata:\n  ${config.configKey || 'KEY'}: "${config.configValue || 'VALUE'}"`;
  } else if (type === 'secret') {
    return `apiVersion: v1\nkind: Secret\nmetadata:\n  name: ${name}\ntype: Opaque\ndata:\n  ${config.secretKey || 'PASSWORD'}: "${base64Encode(config.secretValue || 'admin')}"`;
  } else {
    return `apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: ${name}\n  annotations:\n    nginx.ingress.kubernetes.io/rewrite-target: /\nspec:\n  rules:\n  - host: ${config.ingressHost || 'myapp.local'}\n    http:\n      paths:\n      - path: ${config.ingressPath || '/'}\n        pathType: Prefix\n        backend:\n          service:\n            name: ${config.ingressService || 'my-service'}\n            port:\n              number: 80`;
  }
};

const parseYamlToConfig = (yaml: string, node: ArenaNode): Partial<ArenaNode> | null => {
  try {
    // Multi-doc YAML (ConfigMap + workload) — parse the LAST document (the workload).
    const docs = yaml.split(/\n---\s*\n/);
    const doc = docs[docs.length - 1] || yaml;
    const nameMatch = doc.match(/name:\s+([\w-]+)/);
    const imageMatch = doc.match(/image:\s+([\w.\-:/]+)/);
    const replicasMatch = doc.match(/replicas:\s+(\d+)/);
    const portMatch = doc.match(/containerPort:\s+(\d+)/) || doc.match(/-\s+port:\s+(\d+)/);
    const targetPortMatch = doc.match(/targetPort:\s+(\d+)/);
    const typeMatch = doc.match(/type:\s+(ClusterIP|NodePort|LoadBalancer)/);
    const selectorMatch = doc.match(/selector:\s*\n\s+app:\s+([\w-]+)/) || doc.match(/app:\s+([\w-]+)/);
    const ingressHostMatch = doc.match(/host:\s+([\w.-]+)/);
    const ingressPathMatch = doc.match(/path:\s+([\w.\-/]+)/);
    const ingressServiceMatch = doc.match(/name:\s+([\w-]+)/);

    const parsedConfig = { ...node.config };
    let parsedName = node.name;

    if (nameMatch) parsedName = nameMatch[1];
    if (imageMatch) parsedConfig.image = imageMatch[1];
    if (replicasMatch) parsedConfig.replicas = parseInt(replicasMatch[1]);
    if (portMatch) parsedConfig.port = parseInt(portMatch[1]);
    if (targetPortMatch) parsedConfig.targetPort = parseInt(targetPortMatch[1]);
    if (typeMatch) parsedConfig.serviceType = typeMatch[1] as any;
    if (ingressHostMatch) parsedConfig.ingressHost = ingressHostMatch[1];
    if (ingressPathMatch) parsedConfig.ingressPath = ingressPathMatch[1];
    if (ingressServiceMatch && node.type === 'ingress') parsedConfig.ingressService = ingressServiceMatch[1];
    if (selectorMatch && node.type === 'service') parsedConfig.selector = selectorMatch[1];

    return { name: parsedName, config: parsedConfig };
  } catch {
    return null;
  }
};

const validateConnection = (sourceType: string, targetType: string): { valid: boolean; message?: string } => {
  if (sourceType === 'configmap' || sourceType === 'secret') {
    return { valid: false, message: 'ConfigMaps and Secrets cannot initiate connections.' };
  }
  if (sourceType === 'ingress' && targetType !== 'service') {
    return { valid: false, message: 'Ingress can only route to Services.' };
  }
  if (sourceType === 'service' && !['pod', 'deployment', 'statefulset'].includes(targetType)) {
    return { valid: false, message: 'Services must route to Pods, Deployments, or StatefulSets.' };
  }
  if (['pod', 'deployment', 'statefulset'].includes(sourceType) && !['configmap', 'secret'].includes(targetType)) {
    return { valid: false, message: 'Workloads can only connect to ConfigMaps or Secrets.' };
  }
  return { valid: true };
};

const InnerArena: React.FC<ArenaTabProps> = ({
  apiUrl, nodes, setNodes, connections, setConnections, selectedNodeId, setSelectedNodeId, setToast,
  liveResources, liveSyncEnabled,
}) => {
  const [configTab, setConfigTab] = useState<'form' | 'yaml'>('form');
  const [yamlEditMode, setYamlEditMode] = useState(false);
  const [yamlText, setYamlText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const onboardingSeen = React.useRef(false);
  const [templateConfirm, setTemplateConfirm] = useState<'web' | 'db' | 'full' | null>(null);
  const [showDeleteStackConfirm, setShowDeleteStackConfirm] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [configuratorCollapsed, setConfiguratorCollapsed] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [stackDeploying, setStackDeploying] = useState(false);

  const { screenToFlowPosition, fitView } = useReactFlow();

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  // React Flow nodes/edges
  const rfNodes: Node[] = useMemo(() => nodes.map(n => ({
    id: n.id,
    type: 'k8sNode',
    position: { x: n.x, y: n.y },
    data: {
      nodeType: n.type,
      label: n.name,
      status: n.status,
      statusMessage: n.statusMessage,
    },
    selected: n.id === selectedNodeId,
  })), [nodes, selectedNodeId]);

  const rfEdges: Edge[] = useMemo(() => connections.map(c => ({
    id: c.id,
    source: c.fromId,
    target: c.toId,
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#3b82f6', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 16, height: 16 },
  })), [connections]);

  const [rfNodesState, setRfNodes, onNodesChange] = useNodesState(rfNodes);
  const [rfEdgesState, setRfEdges, onEdgesChange] = useEdgesState(rfEdges);

  // Sync RF positions back to ArenaNode positions
  useEffect(() => {
    setRfNodes(rfNodes);
  }, [rfNodes, setRfNodes]);

  useEffect(() => {
    setRfEdges(rfEdges);
  }, [rfEdges, setRfEdges]);

  // Keep deployed nodes in sync with live cluster state — e.g. if a pod is
  // deleted from the Explorer, its Arena node stops showing as healthy.
  useEffect(() => {
    if (!liveResources || !liveSyncEnabled) return;
    const now = Date.now();
    const lookup: Record<string, any[]> = {
      pod: liveResources.pods || [],
      deployment: liveResources.deployments || [],
      service: liveResources.services || [],
      configmap: liveResources.configmaps || [],
      secret: liveResources.secrets || [],
      statefulset: liveResources.statefulsets || [],
    };
    setNodes(prev => {
      let changed = false;
      const next = prev.map((n): ArenaNode => {
        if (n.type === 'ingress' || n.status === 'draft') return n;
        const list = lookup[n.type];
        if (!list) return n;
        const live = list.find(r => r && r.name === n.name && (!r.namespace || r.namespace === 'default'));

        if (!live) {
          // Grace period right after apply so a slow apiserver doesn't flash "deleted"
          if (n.status === 'deploying' && n.deployedAt && now - n.deployedAt < 8000) return n;
          if (n.status === 'failed' || n.status === 'deleted') return n;
          changed = true;
          return { ...n, status: 'deleted', statusMessage: 'Not in cluster (deleted?)' };
        }

        let status: ArenaNode['status'];
        let statusMessage: string;
        const s = String(live.status || '').toLowerCase();
        if (n.type === 'deployment' || n.type === 'statefulset') {
          const want = Number(live.replicas_desired ?? 0);
          const ready = Number(live.replicas_ready ?? 0);
          if (ready > 0) { status = 'healthy'; statusMessage = `${ready}/${want || ready} ready`; }
          else if (n.status === 'deploying') { status = 'deploying'; statusMessage = `Waiting for pods (0/${want || 1})`; }
          else { status = 'failed'; statusMessage = `0/${want || 1} ready`; }
        } else if (/backoff|crash|fail|error|evict|terminat|unknown|errimagepull/.test(s)) {
          status = 'failed';
          statusMessage = live.status || 'Failed';
        } else if (s === 'running' || s === 'succeeded' || n.type === 'service' || n.type === 'configmap' || n.type === 'secret') {
          status = 'healthy';
          statusMessage = live.status || 'Applied';
        } else {
          status = 'deploying';
          statusMessage = live.status || 'Pending';
        }

        if (status === n.status && statusMessage === (n.statusMessage ?? '')) return n;
        changed = true;
        return { ...n, status, statusMessage };
      });
      return changed ? next : prev;
    });
  }, [liveResources, liveSyncEnabled, setNodes]);

  const onNodeDragStop = useCallback((_: any, node: Node) => {
    setNodes(prev => prev.map(n =>
      n.id === node.id ? { ...n, x: node.position.x, y: node.position.y } : n
    ));
  }, [setNodes]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id);
    setConfiguratorCollapsed(false);
    setYamlEditMode(false);
  }, [setSelectedNodeId]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setConfiguratorCollapsed(true);
  }, [setSelectedNodeId]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    if (!sourceNode || !targetNode) return;

    const result = validateConnection(sourceNode.type, targetNode.type);
    if (!result.valid) {
      setConnectionError(result.message || 'Incompatible connection!');
      setTimeout(() => setConnectionError(null), 4000);
      return;
    }

    if (connections.some(c => c.fromId === connection.source && c.toId === connection.target)) {
      return; // Already connected
    }

    const newConn: ArenaConnection = {
      id: `conn-${Date.now()}`,
      fromId: connection.source,
      toId: connection.target,
    };
    setConnections(prev => [...prev, newConn]);

    // Auto-set selector/ingressService
    setNodes(prev => prev.map(n => {
      if (n.id === connection.source && n.type === 'service') {
        return { ...n, config: { ...n.config, selector: targetNode.name } };
      }
      if (n.id === connection.source && n.type === 'ingress') {
        return { ...n, config: { ...n.config, ingressService: targetNode.name } };
      }
      return n;
    }));
  }, [nodes, connections, setConnections, setNodes]);

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    setConnections(prev => prev.filter(c => c.id !== edge.id));
  }, [setConnections]);

  // Drag-drop from toolbox
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const nodeType = event.dataTransfer.getData('application/reactflow') as ArenaNode['type'];
    if (!nodeType) return;

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const id = `${nodeType}-${Date.now().toString().slice(-6)}`;
    const newNode: ArenaNode = {
      id,
      type: nodeType,
      name: `arena-${nodeType}-${nodes.length + 1}`,
      x: position.x,
      y: position.y,
      status: 'draft',
      config: defaultConfig(nodeType),
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(id);
    setYamlEditMode(false);
  }, [nodes.length, screenToFlowPosition, setNodes, setSelectedNodeId]);

  useEffect(() => {
    if (selectedNode && !yamlEditMode) {
      setYamlText(generateYaml(selectedNode, connections, nodes));
      setValidationError(null);
    }
  }, [selectedNodeId, selectedNode?.config, selectedNode?.name, yamlEditMode, connections, nodes]);

  const handleAddNode = (type: ArenaNode['type']) => {
    const id = `${type}-${Date.now().toString().slice(-6)}`;
    const newNode: ArenaNode = {
      id,
      type,
      name: `arena-${type}-${nodes.length + 1}`,
      x: 250 + (nodes.length * 30) % 200,
      y: 200 + (nodes.length * 30) % 200,
      status: 'draft',
      config: defaultConfig(type),
    };
    setNodes([...nodes, newNode]);
    setSelectedNodeId(id);
    setYamlEditMode(false);
  };

  const handleRemoveNode = (id: string) => {
    setNodes(nodes.filter(n => n.id !== id));
    setConnections(connections.filter(c => c.fromId !== id && c.toId !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const handleUpdateForm = (field: string, value: any) => {
    if (!selectedNodeId) return;
    setNodes(nodes.map(n => {
      if (n.id === selectedNodeId) {
        if (field === 'name') return { ...n, name: value };
        return { ...n, config: { ...n.config, [field]: value } };
      }
      return n;
    }));
  };

  const handleYamlTextChange = (text: string) => {
    setYamlText(text);
    if (!selectedNode) return;
    const parsed = parseYamlToConfig(text, selectedNode);
    if (parsed) {
      setValidationError(null);
      setNodes(nodes.map(n => n.id === selectedNodeId ? { ...n, ...parsed } : n));
    } else {
      setValidationError('Failed to parse YAML. Check key formats.');
    }
  };

  const handleDeployNode = async (node: ArenaNode) => {
    setNodes(nodes.map(n => n.id === node.id ? { ...n, status: 'deploying', statusMessage: undefined, deployedAt: Date.now() } : n));
    try {
      const res = await fetch(`${apiUrl}/api/kube/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml: generateYaml(node, connections, nodes) }),
      });
      if (res.ok) {
        setNodes(nodes.map(n => n.id === node.id ? { ...n, status: 'healthy', statusMessage: 'Applied' } : n));
      } else {
        const err = await res.json();
        setToast?.({ message: `Deploy failed: ${err.detail || 'Unknown error'}`, type: 'error' });
        setNodes(nodes.map(n => n.id === node.id ? { ...n, status: 'draft', statusMessage: undefined } : n));
      }
    } catch (e: any) {
      setToast?.({ message: `Deploy error: ${e.message}`, type: 'error' });
      setNodes(nodes.map(n => n.id === node.id ? { ...n, status: 'draft', statusMessage: undefined } : n));
    }
  };

  const handleDeleteNodeFromCluster = async (node: ArenaNode) => {
    try {
      const res = await fetch(`${apiUrl}/api/kube/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: node.type, name: node.name, namespace: 'default' }),
      });
      if (res.ok) {
        setNodes(nodes.map(n => n.id === node.id ? { ...n, status: 'draft', statusMessage: 'Deleted' } : n));
        setToast?.({ message: `Deleted ${node.name}`, type: 'success' });
      } else {
        const err = await res.json();
        setToast?.({ message: `Failed: ${err.detail}`, type: 'error' });
      }
    } catch (e: any) {
      setToast?.({ message: `Error: ${e.message}`, type: 'error' });
    }
  };

  const handleDeployStack = async () => {
    if (nodes.length === 0) return;
    setStackDeploying(true);
    setNodes(nodes.map(n => ({ ...n, status: 'deploying', statusMessage: undefined, deployedAt: Date.now() })));
    try {
      const combinedYaml = nodes.map(node => generateYaml(node, connections, nodes)).join('\n---\n');
      const res = await fetch(`${apiUrl}/api/kube/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml: combinedYaml }),
      });
      if (res.ok) {
        setNodes(nodes.map(n => ({ ...n, status: 'healthy', statusMessage: 'Applied' })));
      } else {
        const err = await res.json();
        setToast?.({ message: `Deploy failed: ${err.detail || 'Unknown error'}`, type: 'error' });
        setNodes(nodes.map(n => ({ ...n, status: 'draft', statusMessage: undefined })));
      }
    } catch (e: any) {
      setToast?.({ message: `Deploy error: ${e.message}`, type: 'error' });
      setNodes(nodes.map(n => ({ ...n, status: 'draft', statusMessage: undefined })));
    } finally {
      setStackDeploying(false);
    }
  };

  const executeDeleteStack = async () => {
    try {
      await Promise.all(nodes.map(async (node) => {
        await fetch(`${apiUrl}/api/kube/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: node.type, name: node.name, namespace: 'default' }),
        }).catch(console.error);
      }));
      setNodes(nodes.map(n => ({ ...n, status: 'draft', statusMessage: 'Deleted' })));
      setToast?.({ message: 'Stack deleted from cluster', type: 'success' });
    } catch (e) {
      console.error(e);
    }
  };

  const executeLoadTemplate = (templateName: 'web' | 'db' | 'full') => {
    const ts = Date.now().toString().slice(-4);
    const emptyCfg = defaultConfig('pod');
    Object.keys(emptyCfg).forEach(k => { (emptyCfg as any)[k] = ''; });

    const configs: Record<string, ArenaNode[]> = {
      web: [
        { id: `svc-${ts}`, type: 'service', name: 'web-service', x: 100, y: 200, status: 'draft',
          config: { ...emptyCfg, port: 80, targetPort: 80, serviceType: 'NodePort', selector: 'web-app' } },
        { id: `deploy-${ts}`, type: 'deployment', name: 'web-app', x: 240, y: 200, status: 'draft',
          config: { ...emptyCfg, image: 'nginx:alpine', replicas: 3, port: 80, targetPort: 80 } },
      ],
      db: [
        { id: `svc-${ts}`, type: 'service', name: 'postgres-svc', x: 80, y: 220, status: 'draft',
          config: { ...emptyCfg, port: 5432, targetPort: 5432, serviceType: 'ClusterIP', selector: 'postgres-db' } },
        { id: `ss-${ts}`, type: 'statefulset', name: 'postgres-db', x: 220, y: 220, status: 'draft',
          config: { ...emptyCfg, image: 'postgres:15-alpine', replicas: 1, port: 5432, targetPort: 5432, serviceName: 'postgres-svc' } },
        { id: `sec-${ts}`, type: 'secret', name: 'db-credentials', x: 360, y: 140, status: 'draft',
          config: { ...emptyCfg, secretKey: 'POSTGRES_PASSWORD', secretValue: 'postgres123' } },
        { id: `cm-${ts}`, type: 'configmap', name: 'db-configs', x: 360, y: 300, status: 'draft',
          config: { ...emptyCfg, configKey: 'POSTGRES_DB', configValue: 'appdb' } },
      ],
      full: [
        { id: `ing-${ts}`, type: 'ingress', name: 'frontend-ingress', x: 60, y: 220, status: 'draft',
          config: { ...emptyCfg, ingressHost: 'frontend.local', ingressPath: '/', ingressService: 'frontend-svc' } },
        { id: `svc-${ts}`, type: 'service', name: 'frontend-svc', x: 200, y: 220, status: 'draft',
          config: { ...emptyCfg, port: 80, targetPort: 80, serviceType: 'ClusterIP', selector: 'frontend-deployment' } },
        { id: `dep-${ts}`, type: 'deployment', name: 'frontend-deployment', x: 340, y: 220, status: 'draft',
          config: { ...emptyCfg, image: 'nginx:alpine', replicas: 2, port: 80, targetPort: 80 } },
        { id: `cm-${ts}`, type: 'configmap', name: 'frontend-configs', x: 480, y: 220, status: 'draft',
          config: { ...emptyCfg, configKey: 'APP_TITLE', configValue: 'Podex Visual Tutor' } },
      ],
    };

    const connMap: Record<string, ArenaConnection[]> = {
      web: [{ id: 'c-w1', fromId: `svc-${ts}`, toId: `deploy-${ts}` }],
      db: [
        { id: 'c-d1', fromId: `svc-${ts}`, toId: `ss-${ts}` },
        { id: 'c-d2', fromId: `ss-${ts}`, toId: `sec-${ts}` },
        { id: 'c-d3', fromId: `ss-${ts}`, toId: `cm-${ts}` },
      ],
      full: [
        { id: 'c-f1', fromId: `ing-${ts}`, toId: `svc-${ts}` },
        { id: 'c-f2', fromId: `svc-${ts}`, toId: `dep-${ts}` },
        { id: 'c-f3', fromId: `dep-${ts}`, toId: `cm-${ts}` },
      ],
    };

    setNodes(configs[templateName]);
    setConnections(connMap[templateName]);
    setSelectedNodeId(null);
    setTimeout(() => fitView({ duration: 300 }), 50);
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full relative">
      {/* Left Sidebar - Toolbox */}
      {!sidebarCollapsed ? (
        <div className="w-60 bg-white dark:bg-[#0d1117] border-r border-slate-200 dark:border-[#1b2332] flex flex-col shrink-0 select-none transition-all duration-200">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-[#1b2332]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-800 dark:text-white tracking-wide">Toolbox</h2>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Drag to canvas</p>
              </div>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1b2332] hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Resource types */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {TOOLBOX_ITEMS.map(item => {
              const Icon = item.icon;
              return (
                <div
                  key={item.type}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', item.type);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={() => handleAddNode(item.type)}
                  className="flex items-center gap-3 p-2.5 rounded-lg cursor-grab active:cursor-grabbing
                    bg-white dark:bg-[#111820] border border-slate-100 dark:border-[#1b2332]
                    hover:border-slate-200 dark:hover:border-[#2a3548]
                    hover:shadow-sm transition-all duration-150 group"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${item.color}12` }}
                  >
                    <Icon style={{ width: 16, height: 16, color: item.color }} strokeWidth={2} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">{item.label}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">Click or drag</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Templates */}
          <div className="border-t border-slate-200 dark:border-[#1b2332] p-3 space-y-1">
            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 px-1">
              Templates
            </div>
            {TEMPLATES.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTemplateConfirm(t.id)}
                  className="w-full text-left p-2.5 rounded-lg bg-slate-50 dark:bg-[#151a24] border border-dashed border-slate-200 dark:border-[#2a3548] hover:border-solid hover:border-cyan-300 dark:hover:border-cyan-600/40 transition-all duration-150 cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${t.color}14` }}
                    >
                      <Icon style={{ width: 15, height: 15, color: t.color }} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{t.label}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">{t.desc}</div>
                    </div>
                    <span
                      className="shrink-0 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ color: t.color, backgroundColor: `${t.color}12` }}
                    >
                      Stack
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Snapping rules */}
          <div className="border-t border-slate-200 dark:border-[#1b2332] p-3">
            <div className="p-2.5 bg-slate-50 dark:bg-[#0b0e14] rounded-lg text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
              <span className="font-semibold text-slate-600 dark:text-slate-300">Connections:</span>{' '}
              Ingress {'\u2192'} Service {'\u2192'} Workloads {'\u2192'} ConfigMap/Secret
            </div>
          </div>
        </div>
      ) : (
        <div
          onClick={() => setSidebarCollapsed(false)}
          className="w-8 bg-white dark:bg-[#0d1117] border-r border-slate-200 dark:border-[#1b2332] flex flex-col items-center pt-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#111820] transition-all shrink-0 select-none"
        >
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <div className="mt-6 [writing-mode:vertical-lr] text-[9px] font-semibold uppercase tracking-widest text-slate-400">
            Toolbox
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 relative" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={rfNodesState}
          edges={rfEdgesState}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[24, 24]}
          defaultEdgeOptions={{
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#3b82f6', strokeWidth: 2 },
          }}
          className="bg-slate-50 dark:bg-[#080b10]"
          proOptions={{ hideAttribution: true }}
          minZoom={0.2}
          maxZoom={3}
          connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 2 }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="#cbd5e1"
            style={{ opacity: 0.5 }}
          />
          <Controls
            className="!bg-white dark:!bg-[#111820] !border-slate-200 dark:!border-[#1b2332] !shadow-lg !rounded-lg"
            showInteractive={false}
          />
          <MiniMap
            className="!bg-white dark:!bg-[#111820] !border-slate-200 dark:!border-[#1b2332] !shadow-lg !rounded-lg"
            nodeColor={(node) => {
              const type = node.data?.nodeType;
              const colors: Record<string, string> = {
                pod: '#3b82f6', deployment: '#10b981', statefulset: '#8b5cf6',
                service: '#06b6d4', ingress: '#f59e0b', configmap: '#64748b', secret: '#f43f5e',
              };
              return colors[type as string] || '#64748b';
            }}
            maskColor="rgba(0,0,0,0.1)"
            pannable
            zoomable
          />

          {/* Onboarding overlay - first visit only */}
          {nodes.length === 0 && !onboardingSeen.current && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/10 dark:bg-black/30">
              <div className="bg-white dark:bg-[#0f1219] border border-slate-200 dark:border-[#1b2332] p-8 rounded-xl shadow-2xl max-w-lg text-center space-y-5 mx-6">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto">
                  <Box className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white">Build Your K8s Stack</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                    Drag components from the toolbox or click to add them. Connect resources to model real Kubernetes architectures.
                  </p>
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => { executeLoadTemplate('web'); onboardingSeen.current = true; }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition"
                  >
                    Start with Template
                  </button>
                  <button
                    onClick={() => { onboardingSeen.current = true; }}
                    className="px-4 py-2 bg-slate-100 dark:bg-[#1b2332] hover:bg-slate-200 dark:hover:bg-[#242d3d] text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-lg transition"
                  >
                    Start Empty
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Canvas toolbar */}
          <Panel position="top-left" className="!m-0">
            <div className="h-11 bg-white dark:bg-[#0d1117] border-b border-r border-slate-200 dark:border-[#1b2332] px-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Canvas</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1b2332] text-[10px] font-bold text-slate-500 dark:text-slate-400">
                  {nodes.length} nodes
                </span>
                {connections.length > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/10 text-[10px] font-bold text-blue-500">
                    {connections.length} links
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowClearConfirm(true)}
                  disabled={nodes.length === 0}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-30 transition cursor-pointer text-[11px] font-medium border border-transparent hover:border-red-200 dark:hover:border-red-900/40"
                  title="Remove all nodes from canvas"
                >
                  <Trash className="w-3 h-3" />
                  Clear
                </button>
                <div className="w-px h-5 bg-slate-200 dark:bg-[#1b2332]" />
                <button
                  onClick={handleDeployStack}
                  disabled={nodes.length === 0 || stackDeploying}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[11px] font-semibold rounded-md transition cursor-pointer"
                >
                  {stackDeploying ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Deploying...</>
                  ) : (
                    <><Play className="w-3 h-3" /> Deploy All</>
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteStackConfirm(true)}
                  disabled={nodes.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[11px] font-semibold rounded-md disabled:opacity-30 transition cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Delete Stack
                </button>
              </div>
            </div>
          </Panel>

          {/* Connection error toast */}
          {connectionError && (
            <Panel position="top-center" className="!m-0 pointer-events-none">
              <div className="bg-red-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                {connectionError}
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* Right Panel - Configurator */}
      {!configuratorCollapsed ? (
        selectedNode ? (
          <div className="w-80 bg-white dark:bg-[#0d1117] border-l border-slate-200 dark:border-[#1b2332] flex flex-col shrink-0 transition-all duration-200">
            {/* Configurator header */}
            <div className="p-3 border-b border-slate-200 dark:border-[#1b2332] flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Settings2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">Configure</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-white truncate capitalize">{selectedNode.type}</div>
                </div>
              </div>
              <button
                onClick={() => setConfiguratorCollapsed(true)}
                className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1b2332] cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Form/YAML tabs */}
            <div className="px-3 pt-3 flex bg-slate-100/50 dark:bg-[#080b10] mx-3 rounded-lg p-0.5 mb-3">
              <button
                onClick={() => { setConfigTab('form'); setYamlEditMode(false); }}
                className={`flex-1 py-1.5 text-[10px] font-semibold rounded-md transition cursor-pointer ${
                  configTab === 'form'
                    ? 'bg-white dark:bg-[#111820] text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Form
              </button>
              <button
                onClick={() => { setConfigTab('yaml'); setYamlEditMode(true); }}
                className={`flex-1 py-1.5 text-[10px] font-semibold rounded-md transition cursor-pointer ${
                  configTab === 'yaml'
                    ? 'bg-white dark:bg-[#111820] text-slate-800 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                YAML
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2.5">
              {configTab === 'form' ? (
                <>
                  {/* Name */}
                  <div>
                    <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Name</label>
                    <input
                      value={selectedNode.name}
                      onChange={(e) => handleUpdateForm('name', e.target.value)}
                      className="mt-1 w-full bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Type-specific fields */}
                  {['pod', 'deployment', 'statefulset'].includes(selectedNode.type) && (
                    <>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Image</label>
                        <input
                          value={selectedNode.config.image}
                          onChange={(e) => handleUpdateForm('image', e.target.value)}
                          className="mt-1 w-full bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-lg px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="nginx:alpine"
                        />
                      </div>
                      <div className={`grid ${['deployment', 'statefulset'].includes(selectedNode.type) ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Port</label>
                          <input
                            type="number"
                            value={selectedNode.config.port}
                            onChange={(e) => handleUpdateForm('port', parseInt(e.target.value) || 80)}
                            className="mt-1 w-full bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        {['deployment', 'statefulset'].includes(selectedNode.type) && (
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Replicas</label>
                            <input
                              type="number"
                              value={selectedNode.config.replicas}
                              onChange={(e) => handleUpdateForm('replicas', parseInt(e.target.value) || 1)}
                              className="mt-1 w-full bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {selectedNode.type === 'service' && (
                    <>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</label>
                        <select
                          value={selectedNode.config.serviceType}
                          onChange={(e) => handleUpdateForm('serviceType', e.target.value)}
                          className="mt-1 w-full bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option>ClusterIP</option>
                          <option>NodePort</option>
                          <option>LoadBalancer</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Port</label>
                          <input type="number" value={selectedNode.config.port}
                            onChange={(e) => handleUpdateForm('port', parseInt(e.target.value) || 80)}
                            className="mt-1 w-full bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Target</label>
                          <input type="number" value={selectedNode.config.targetPort}
                            onChange={(e) => handleUpdateForm('targetPort', parseInt(e.target.value) || 80)}
                            className="mt-1 w-full bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </div>
                      </div>
                    </>
                  )}

                  {selectedNode.type === 'ingress' && (
                    <>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Host</label>
                        <input value={selectedNode.config.ingressHost}
                          onChange={(e) => handleUpdateForm('ingressHost', e.target.value)}
                          className="mt-1 w-full bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-lg px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Path</label>
                        <input value={selectedNode.config.ingressPath}
                          onChange={(e) => handleUpdateForm('ingressPath', e.target.value)}
                          className="mt-1 w-full bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-lg px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                    </>
                  )}

                  {selectedNode.type === 'configmap' && (
                    <>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Key</label>
                        <input value={selectedNode.config.configKey}
                          onChange={(e) => handleUpdateForm('configKey', e.target.value)}
                          className="mt-1 w-full bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-lg px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Value</label>
                        <input value={selectedNode.config.configValue}
                          onChange={(e) => handleUpdateForm('configValue', e.target.value)}
                          className="mt-1 w-full bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-lg px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                    </>
                  )}

                  {selectedNode.type === 'secret' && (
                    <>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Key</label>
                        <input value={selectedNode.config.secretKey}
                          onChange={(e) => handleUpdateForm('secretKey', e.target.value)}
                          className="mt-1 w-full bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-lg px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Value</label>
                        <input value={selectedNode.config.secretValue}
                          onChange={(e) => handleUpdateForm('secretValue', e.target.value)}
                          type="password"
                          className="mt-1 w-full bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-lg px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                    </>
                  )}

                  {selectedNode.type === 'statefulset' && (
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Headless Service</label>
                      <input value={selectedNode.config.serviceName}
                        onChange={(e) => handleUpdateForm('serviceName', e.target.value)}
                        className="mt-1 w-full bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-lg px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    </div>
                  )}
                </>
              ) : (
                /* YAML Editor */
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">YAML Definition</span>
                    <button
                      onClick={() => {
                        try {
                          const formatted = yamlText.split('\n').map(l => l.trimEnd()).join('\n');
                          setYamlText(formatted);
                        } catch {}
                      }}
                      className="text-[10px] font-medium text-blue-500 hover:text-blue-400 px-2 py-1 rounded hover:bg-blue-500/10 transition cursor-pointer"
                    >
                      Format
                    </button>
                  </div>
                  <div className="relative border border-slate-200 dark:border-[#1b2332] rounded-lg overflow-hidden">
                    <div className="flex">
                      <div className="select-none text-right px-2 py-3 text-[11px] leading-relaxed font-mono text-slate-400 dark:text-slate-600 bg-slate-100/50 dark:bg-[#06090e] border-r border-slate-200 dark:border-[#1b2332] min-w-[36px]">
                        {yamlText.split('\n').map((_, i) => (
                          <div key={i}>{i + 1}</div>
                        ))}
                      </div>
                      <textarea
                        value={yamlText}
                        onChange={(e) => handleYamlTextChange(e.target.value)}
                        className="flex-1 bg-slate-50 dark:bg-[#080b10] p-3 text-[11px] font-mono text-slate-800 dark:text-slate-200 focus:outline-none resize-none leading-relaxed whitespace-pre border-none"
                        spellCheck={false}
                        style={{ minHeight: '320px' }}
                      />
                    </div>
                  </div>
                  {validationError && (
                    <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-[11px] font-medium">
                      {validationError}
                    </div>
                  )}
                  <div className="text-[9px] text-slate-400 dark:text-slate-500 italic">
                    Edit YAML directly for full control. Changes are reflected in the form.
                  </div>
                </div>
              )}
            </div>

            {/* Deploy buttons */}
            <div className="p-3 border-t border-slate-200 dark:border-[#1b2332] space-y-1.5">
              <button
                onClick={() => handleDeployNode(selectedNode)}
                disabled={selectedNode.status === 'deploying'}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-lg text-xs transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {selectedNode.status === 'deploying' ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Applying...</>
                ) : (
                  <><Play className="w-3.5 h-3.5" /> Deploy to Cluster</>
                )}
              </button>
              {(selectedNode.status === 'healthy' || selectedNode.status === 'failed') && (
                <button
                  onClick={() => handleDeleteNodeFromCluster(selectedNode)}
                  className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 font-semibold py-2 rounded-lg text-xs transition flex items-center justify-center gap-2 cursor-pointer border border-red-500/20"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete from Cluster
                </button>
              )}
              <button
                onClick={() => handleRemoveNode(selectedNode.id)}
                className="w-full bg-slate-100 dark:bg-[#111820] hover:bg-slate-200 dark:hover:bg-[#1b2332] text-slate-500 font-semibold py-2 rounded-lg text-xs transition cursor-pointer border border-slate-200 dark:border-[#1b2332]"
              >
                Remove from Canvas
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setConfiguratorCollapsed(false)}
            className="w-8 bg-white dark:bg-[#0d1117] border-l border-slate-200 dark:border-[#1b2332] flex flex-col items-center pt-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#111820] transition-all shrink-0 select-none"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
            <div className="mt-6 [writing-mode:vertical-lr] text-[9px] font-semibold uppercase tracking-widest text-slate-400">
              Config
            </div>
          </div>
        )
      ) : (
        <div
          onClick={() => setConfiguratorCollapsed(false)}
          className="w-8 bg-white dark:bg-[#0d1117] border-l border-slate-200 dark:border-[#1b2332] flex flex-col items-center pt-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#111820] transition-all shrink-0 select-none"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
          <div className="mt-6 [writing-mode:vertical-lr] text-[9px] font-semibold uppercase tracking-widest text-slate-400">
            Config
          </div>
        </div>
      )}

      {/* Modals */}
      {showClearConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0f1219] border border-slate-200 dark:border-[#1b2332] p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Clear Canvas?</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Remove all nodes and connections. Cluster resources are unaffected.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-2 bg-slate-100 dark:bg-[#1b2332] hover:bg-slate-200 dark:hover:bg-[#242d3d] text-slate-700 dark:text-slate-300 font-semibold rounded-lg text-xs transition cursor-pointer">
                Cancel
              </button>
              <button onClick={() => { setNodes([]); setConnections([]); setSelectedNodeId(null); setShowClearConfirm(false); }}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg text-xs transition cursor-pointer">
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {templateConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0f1219] border border-slate-200 dark:border-[#1b2332] p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <Lightbulb className="w-5 h-5 text-blue-500" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Load Template?</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              This will replace the current canvas. Proceed?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setTemplateConfirm(null)} className="flex-1 py-2 bg-slate-100 dark:bg-[#1b2332] hover:bg-slate-200 dark:hover:bg-[#242d3d] text-slate-700 dark:text-slate-300 font-semibold rounded-lg text-xs transition cursor-pointer">
                Cancel
              </button>
              <button onClick={() => { executeLoadTemplate(templateConfirm); setTemplateConfirm(null); }}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs transition cursor-pointer">
                Load Template
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteStackConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0f1219] border border-slate-200 dark:border-[#1b2332] p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Delete Stack from Cluster?</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              This will permanently delete all resources from the live Kubernetes cluster.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteStackConfirm(false)} className="flex-1 py-2 bg-slate-100 dark:bg-[#1b2332] hover:bg-slate-200 dark:hover:bg-[#242d3d] text-slate-700 dark:text-slate-300 font-semibold rounded-lg text-xs transition cursor-pointer">
                Cancel
              </button>
              <button onClick={() => { executeDeleteStack(); setShowDeleteStackConfirm(false); }}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg text-xs transition cursor-pointer">
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const ArenaTab: React.FC<ArenaTabProps> = (props) => (
  <ReactFlowProvider>
    <InnerArena {...props} />
  </ReactFlowProvider>
);
