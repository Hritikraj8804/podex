import React, { useState, useRef, useEffect } from 'react';
import {
  Cpu,
  Layers,
  Network,
  Trash2,
  Play,
  CheckCircle2,
  XCircle,
  Code,
  Sparkles,
  Loader2,
  AlertCircle,
  HelpCircle,
  FileText,
  Lock,
  Globe,
  Database,
  Lightbulb,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export interface ArenaNode {
  id: string;
  type: 'pod' | 'deployment' | 'service' | 'configmap' | 'secret' | 'ingress' | 'statefulset';
  name: string;
  x: number;
  y: number;
  status: 'draft' | 'deploying' | 'healthy' | 'failed';
  statusMessage?: string;
  config: {
    image: string;
    replicas: number;
    port: number;
    targetPort: number;
    serviceType: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
    selector: string;
    // ConfigMap / Secret
    configKey: string;
    configValue: string;
    secretKey: string;
    secretValue: string;
    // Ingress
    ingressHost: string;
    ingressPath: string;
    ingressService: string;
    // StatefulSet
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
  setToast?: (toast: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
}

export const ArenaTab: React.FC<ArenaTabProps> = ({
  apiUrl,
  nodes,
  setNodes,
  connections,
  setConnections,
  selectedNodeId,
  setSelectedNodeId,
  setToast
}) => {
  const [configTab, setConfigTab] = useState<'form' | 'yaml'>('form');
  const [yamlEditMode, setYamlEditMode] = useState(false);
  const [yamlText, setYamlText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  // Template loader and stack delete custom confirm states
  const [templateConfirm, setTemplateConfirm] = useState<'web' | 'db' | 'full' | null>(null);
  const [showDeleteStackConfirm, setShowDeleteStackConfirm] = useState(false);

  // Collapsible panels states
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [configuratorCollapsed, setConfiguratorCollapsed] = useState(false);

  // Clear confirm and connection errors
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Stack deployment state
  const [stackDeploying, setStackDeploying] = useState(false);

  // Dragging states
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  useEffect(() => {
    if (selectedNode && !yamlEditMode) {
      setYamlText(generateYaml(selectedNode));
      setValidationError(null);
    }
  }, [selectedNodeId, selectedNode?.config, selectedNode?.name, yamlEditMode, connections]);

  const nodeWidth = 180;
  const nodeHeight = 84;

  const base64Encode = (str: string): string => {
    try {
      return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
        return String.fromCharCode(parseInt(p1, 16));
      }));
    } catch (e) {
      return btoa(str);
    }
  };

  const generateYaml = (node: ArenaNode): string => {
    const { type, name, config } = node;

    // Check connections for env variables/secret/configmap injection
    const configMapConns = connections.filter(c => c.fromId === node.id && nodes.find(n => n.id === c.toId)?.type === 'configmap');
    const secretConns = connections.filter(c => c.fromId === node.id && nodes.find(n => n.id === c.toId)?.type === 'secret');

    const hasEnv = configMapConns.length > 0 || secretConns.length > 0;
    
    let envYaml = '';
    if (hasEnv) {
      envYaml = '\n      envFrom:';
      configMapConns.forEach(c => {
        const cm = nodes.find(n => n.id === c.toId);
        if (cm) {
          envYaml += `\n      - configMapRef:\n          name: ${cm.name}`;
        }
      });
      secretConns.forEach(c => {
        const sec = nodes.find(n => n.id === c.toId);
        if (sec) {
          envYaml += `\n      - secretRef:\n          name: ${sec.name}`;
        }
      });
    }

    if (type === 'pod') {
      return `apiVersion: v1
kind: Pod
metadata:
  name: ${name}
  labels:
    app: ${name}
spec:
  containers:
  - name: container
    image: ${config.image}
    ports:
    - containerPort: ${config.port}${envYaml}`;
    } else if (type === 'deployment') {
      return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  labels:
    app: ${name}
spec:
  replicas: ${config.replicas}
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
      - name: container
        image: ${config.image}
        ports:
        - containerPort: ${config.port}${envYaml}`;
    } else if (type === 'statefulset') {
      return `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: ${name}
spec:
  serviceName: ${config.serviceName || 'db-service'}
  replicas: ${config.replicas}
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
      - name: container
        image: ${config.image}
        ports:
        - containerPort: ${config.port}${envYaml}`;
    } else if (type === 'service') {
      return `apiVersion: v1
kind: Service
metadata:
  name: ${name}
spec:
  type: ${config.serviceType}
  ports:
  - port: ${config.port}
    targetPort: ${config.targetPort}
  selector:
    app: ${config.selector || 'my-app'}`;
    } else if (type === 'configmap') {
      return `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${name}
data:
  ${config.configKey || 'KEY'}: "${config.configValue || 'VALUE'}"`;
    } else if (type === 'secret') {
      return `apiVersion: v1
kind: Secret
metadata:
  name: ${name}
type: Opaque
data:
  ${config.secretKey || 'PASSWORD'}: "${base64Encode(config.secretValue || 'admin')}"`;
    } else { // ingress
      return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${name}
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - host: ${config.ingressHost || 'myapp.local'}
    http:
      paths:
      - path: ${config.ingressPath || '/'}
        pathType: Prefix
        backend:
          service:
            name: ${config.ingressService || 'my-service'}
            port:
              number: 80`;
    }
  };

  const parseYamlToConfig = (yaml: string, node: ArenaNode): Partial<ArenaNode> | null => {
    try {
      const nameMatch = yaml.match(/name:\s+([\w\-]+)/);
      const imageMatch = yaml.match(/image:\s+([\w\.\-\:\/]+)/);
      const replicasMatch = yaml.match(/replicas:\s+(\d+)/);
      const portMatch = yaml.match(/containerPort:\s+(\d+)/) || yaml.match(/-\s+port:\s+(\d+)/);
      const targetPortMatch = yaml.match(/targetPort:\s+(\d+)/);
      const typeMatch = yaml.match(/type:\s+(ClusterIP|NodePort|LoadBalancer)/);
      const selectorMatch = yaml.match(/selector:\s*\n\s+app:\s+([\w\-]+)/) || yaml.match(/app:\s+([\w\-]+)/);
      
      const ingressHostMatch = yaml.match(/host:\s+([\w\.\-]+)/);
      const ingressPathMatch = yaml.match(/path:\s+([\w\.\-\/]+)/);
      const ingressServiceMatch = yaml.match(/name:\s+([\w\-]+)/);

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

      return {
        name: parsedName,
        config: parsedConfig
      };
    } catch (e) {
      return null;
    }
  };

  const handleAddNode = (type: 'pod' | 'deployment' | 'service' | 'configmap' | 'secret' | 'ingress' | 'statefulset') => {
    const id = `${type}-${Date.now().toString().slice(-6)}`;
    const defaultName = `arena-${type}-${nodes.length + 1}`;
    
    const canvas = canvasRef.current;
    const x = canvas ? canvas.clientWidth / 2 - nodeWidth / 2 + (nodes.length * 15) % 100 : 150;
    const y = canvas ? canvas.clientHeight / 2 - nodeHeight / 2 + (nodes.length * 15) % 100 : 150;

    const newNode: ArenaNode = {
      id,
      type,
      name: defaultName,
      x,
      y,
      status: 'draft',
      config: {
        image: type === 'service' || type === 'configmap' || type === 'secret' || type === 'ingress' ? '' : type === 'statefulset' ? 'postgres:15-alpine' : 'nginx:alpine',
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
        serviceName: type === 'statefulset' ? 'db-service' : ''
      }
    };

    setNodes([...nodes, newNode]);
    setSelectedNodeId(id);
    setYamlEditMode(false);
  };

  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    if (connectingFromId) return;
    setDraggingNodeId(id);
    const node = nodes.find(n => n.id === id);
    if (node) {
      dragStartOffset.current = {
        x: e.clientX - node.x,
        y: e.clientY - node.y
      };
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let x = e.clientX - dragStartOffset.current.x;
      let y = e.clientY - dragStartOffset.current.y;

      x = Math.max(10, Math.min(x, canvas.clientWidth - nodeWidth - 10));
      y = Math.max(10, Math.min(y, canvas.clientHeight - nodeHeight - 10));

      setNodes(nodes.map(n => n.id === draggingNodeId ? { ...n, x, y } : n));
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingNodeId(null);
  };

  const handleConnectPortClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const clickedNode = nodes.find(n => n.id === nodeId);
    if (!clickedNode) return;

    if (!connectingFromId) {
      if (clickedNode.type === 'configmap' || clickedNode.type === 'secret') {
        setConnectionError("K8s Rule: Cannot initiate connection from ConfigMap or Secret!");
        setTimeout(() => setConnectionError(null), 3000);
        return;
      }
      setConnectingFromId(nodeId);
    } else {
      if (connectingFromId === nodeId) {
        setConnectingFromId(null);
        return;
      }

      const sourceNode = nodes.find(n => n.id === connectingFromId);
      if (!sourceNode) return;

      let isValid = false;
      let ruleMessage = '';

      if (sourceNode.type === 'ingress') {
        isValid = clickedNode.type === 'service';
        ruleMessage = "Ingress rule: Ingress objects can only route to Services!";
      } else if (sourceNode.type === 'service') {
        isValid = clickedNode.type === 'pod' || clickedNode.type === 'deployment' || clickedNode.type === 'statefulset';
        ruleMessage = "Service rule: Services must route traffic to target Pods, Deployments, or StatefulSets!";
      } else if (sourceNode.type === 'pod' || sourceNode.type === 'deployment' || sourceNode.type === 'statefulset') {
        isValid = clickedNode.type === 'configmap' || clickedNode.type === 'secret';
        ruleMessage = "Workload rule: Workloads must connect to ConfigMaps or Secrets to reference environments!";
      }

      if (!isValid) {
        setConnectionError(ruleMessage || "K8s Rule: Incompatible connection snapping!");
        setConnectingFromId(null);
        setTimeout(() => setConnectionError(null), 4000);
        return;
      }

      const connId = `conn-${Date.now()}`;
      setConnections([...connections, { id: connId, fromId: connectingFromId, toId: nodeId }]);

      setNodes(nodes.map(n => {
        if (n.id === connectingFromId && n.type === 'service') {
          return { ...n, config: { ...n.config, selector: clickedNode.name } };
        }
        if (n.id === connectingFromId && n.type === 'ingress') {
          return { ...n, config: { ...n.config, ingressService: clickedNode.name } };
        }
        return n;
      }));

      setConnectingFromId(null);
      setConnectionError(null);
    }
  };

  const handleRemoveNode = (id: string) => {
    setNodes(nodes.filter(n => n.id !== id));
    setConnections(connections.filter(c => c.fromId !== id && c.toId !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const handleRemoveConnection = (connId: string) => {
    setConnections(connections.filter(c => c.id !== connId));
  };

  const handleUpdateForm = (field: string, value: any) => {
    if (!selectedNodeId) return;
    setNodes(nodes.map(n => {
      if (n.id === selectedNodeId) {
        if (field === 'name') {
          return { ...n, name: value };
        } else {
          return {
            ...n,
            config: {
              ...n.config,
              [field]: value
            }
          };
        }
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
      setValidationError("Failed to parse YAML fields. Ensure key formats are valid.");
    }
  };

  const executeLoadTemplate = (templateName: 'web' | 'db' | 'full') => {
    const ts = Date.now().toString().slice(-4);
    if (templateName === 'web') {
      const deployId = `deploy-${ts}`;
      const svcId = `svc-${ts}`;
      setNodes([
        {
          id: svcId,
          type: 'service',
          name: 'web-service',
          x: 100,
          y: 200,
          status: 'draft',
          config: {
            image: '', replicas: 1, port: 80, targetPort: 80, serviceType: 'NodePort', selector: 'web-app',
            configKey: '', configValue: '', secretKey: '', secretValue: '', ingressHost: '', ingressPath: '', ingressService: '', serviceName: ''
          }
        },
        {
          id: deployId,
          type: 'deployment',
          name: 'web-app',
          x: 360,
          y: 200,
          status: 'draft',
          config: {
            image: 'nginx:alpine', replicas: 3, port: 80, targetPort: 80, serviceType: 'ClusterIP', selector: '',
            configKey: '', configValue: '', secretKey: '', secretValue: '', ingressHost: '', ingressPath: '', ingressService: '', serviceName: ''
          }
        }
      ]);
      setConnections([{ id: `conn-web`, fromId: svcId, toId: deployId }]);
    } else if (templateName === 'db') {
      const ssId = `ss-${ts}`;
      const svcId = `svc-${ts}`;
      const secId = `sec-${ts}`;
      const cmId = `cm-${ts}`;
      setNodes([
        {
          id: svcId,
          type: 'service',
          name: 'postgres-svc',
          x: 80,
          y: 220,
          status: 'draft',
          config: {
            image: '', replicas: 1, port: 5432, targetPort: 5432, serviceType: 'ClusterIP', selector: 'postgres-db',
            configKey: '', configValue: '', secretKey: '', secretValue: '', ingressHost: '', ingressPath: '', ingressService: '', serviceName: ''
          }
        },
        {
          id: ssId,
          type: 'statefulset',
          name: 'postgres-db',
          x: 340,
          y: 220,
          status: 'draft',
          config: {
            image: 'postgres:15-alpine', replicas: 1, port: 5432, targetPort: 5432, serviceType: 'ClusterIP', selector: '',
            configKey: '', configValue: '', secretKey: '', secretValue: '', ingressHost: '', ingressPath: '', ingressService: '', serviceName: 'postgres-svc'
          }
        },
        {
          id: secId,
          type: 'secret',
          name: 'db-credentials',
          x: 580,
          y: 120,
          status: 'draft',
          config: {
            image: '', replicas: 1, port: 80, targetPort: 80, serviceType: 'ClusterIP', selector: '',
            configKey: '', configValue: '', secretKey: 'POSTGRES_PASSWORD', secretValue: 'postgres123', ingressHost: '', ingressPath: '', ingressService: '', serviceName: ''
          }
        },
        {
          id: cmId,
          type: 'configmap',
          name: 'db-configs',
          x: 580,
          y: 320,
          status: 'draft',
          config: {
            image: '', replicas: 1, port: 80, targetPort: 80, serviceType: 'ClusterIP', selector: '',
            configKey: 'POSTGRES_DB', configValue: 'appdb', secretKey: '', secretValue: '', ingressHost: '', ingressPath: '', ingressService: '', serviceName: ''
          }
        }
      ]);
      setConnections([
        { id: `conn-db-1`, fromId: svcId, toId: ssId },
        { id: `conn-db-2`, fromId: ssId, toId: secId },
        { id: `conn-db-3`, fromId: ssId, toId: cmId }
      ]);
    } else if (templateName === 'full') {
      const ingId = `ing-${ts}`;
      const svcId = `svc-${ts}`;
      const depId = `dep-${ts}`;
      const cmId = `cm-${ts}`;
      setNodes([
        {
          id: ingId,
          type: 'ingress',
          name: 'frontend-ingress',
          x: 50,
          y: 220,
          status: 'draft',
          config: {
            image: '', replicas: 1, port: 80, targetPort: 80, serviceType: 'ClusterIP', selector: '',
            configKey: '', configValue: '', secretKey: '', secretValue: '',
            ingressHost: 'frontend.local',
            ingressPath: '/',
            ingressService: 'frontend-svc',
            serviceName: ''
          }
        },
        {
          id: svcId,
          type: 'service',
          name: 'frontend-svc',
          x: 290,
          y: 220,
          status: 'draft',
          config: {
            image: '', replicas: 1, port: 80, targetPort: 80, serviceType: 'ClusterIP', selector: 'frontend-deployment',
            configKey: '', configValue: '', secretKey: '', secretValue: '', ingressHost: '', ingressPath: '', ingressService: '', serviceName: ''
          }
        },
        {
          id: depId,
          type: 'deployment',
          name: 'frontend-deployment',
          x: 530,
          y: 220,
          status: 'draft',
          config: {
            image: 'nginx:alpine', replicas: 2, port: 80, targetPort: 80, serviceType: 'ClusterIP', selector: '',
            configKey: '', configValue: '', secretKey: '', secretValue: '', ingressHost: '', ingressPath: '', ingressService: '', serviceName: ''
          }
        },
        {
          id: cmId,
          type: 'configmap',
          name: 'frontend-configs',
          x: 770,
          y: 220,
          status: 'draft',
          config: {
            image: '', replicas: 1, port: 80, targetPort: 80, serviceType: 'ClusterIP', selector: '',
            configKey: 'APP_TITLE', configValue: 'Podex Visual Tutor', secretKey: '', secretValue: '', ingressHost: '', ingressPath: '', ingressService: '', serviceName: ''
          }
        }
      ]);
      setConnections([
        { id: `conn-f-1`, fromId: ingId, toId: svcId },
        { id: `conn-f-2`, fromId: svcId, toId: depId },
        { id: `conn-f-3`, fromId: depId, toId: cmId }
      ]);
    }
    setSelectedNodeId(null);
  };

  const handleLoadTemplate = (templateName: 'web' | 'db' | 'full') => {
    setTemplateConfirm(templateName);
  };

  const handleDeployNode = async (node: ArenaNode) => {
    setNodes(nodes.map(n => n.id === node.id ? { ...n, status: 'deploying', statusMessage: undefined } : n));

    try {
      const res = await fetch(`${apiUrl}/api/kube/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml: generateYaml(node) })
      });

      if (res.ok) {
        setNodes(nodes.map(n => n.id === node.id ? { ...n, status: 'healthy', statusMessage: 'Applied successfully' } : n));
      } else {
        const err = await res.json();
        setNodes(nodes.map(n => n.id === node.id ? { ...n, status: 'failed', statusMessage: err.detail || 'Deploy failed' } : n));
      }
    } catch (e: any) {
      setNodes(nodes.map(n => n.id === node.id ? { ...n, status: 'failed', statusMessage: e.message || 'Network error' } : n));
    }
  };

  const handleDeleteNodeFromCluster = async (node: ArenaNode) => {
    try {
      const res = await fetch(`${apiUrl}/api/kube/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: node.type,
          name: node.name,
          namespace: 'default'
        })
      });

      if (res.ok) {
        setNodes(nodes.map(n => n.id === node.id ? { ...n, status: 'draft', statusMessage: 'Deleted from cluster' } : n));
        setToast?.({ message: `Successfully deleted ${node.name} from cluster.`, type: 'success' });
      } else {
        const err = await res.json();
        setToast?.({ message: `Failed to delete resource: ${err.detail}`, type: 'error' });
      }
    } catch (e: any) {
      setToast?.({ message: `Network error: ${e.message}`, type: 'error' });
    }
  };

  const handleDeployStack = async () => {
    if (nodes.length === 0) return;
    setStackDeploying(true);
    setNodes(nodes.map(n => ({ ...n, status: 'deploying', statusMessage: undefined })));

    try {
      const combinedYaml = nodes.map(node => generateYaml(node)).join('\n---\n');

      const res = await fetch(`${apiUrl}/api/kube/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml: combinedYaml })
      });

      if (res.ok) {
        setNodes(nodes.map(n => ({ ...n, status: 'healthy', statusMessage: 'Applied successfully' })));
      } else {
        const err = await res.json();
        setNodes(nodes.map(n => ({ ...n, status: 'failed', statusMessage: err.detail || 'Deploy failed' })));
      }
    } catch (e: any) {
      setNodes(nodes.map(n => ({ ...n, status: 'failed', statusMessage: e.message || 'Network error' })));
    } finally {
      setStackDeploying(false);
    }
  };

  const executeDeleteStack = async () => {
    try {
      const deletePromises = nodes.map(async (node) => {
        try {
          await fetch(`${apiUrl}/api/kube/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind: node.type,
              name: node.name,
              namespace: 'default'
            })
          });
        } catch (e) {
          console.error(e);
        }
      });

      await Promise.all(deletePromises);
      setNodes(nodes.map(n => ({ ...n, status: 'draft', statusMessage: 'Deleted from cluster' })));
      setToast?.({ message: "Successfully deleted stack from cluster.", type: 'success' });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteStack = () => {
    if (nodes.length === 0) return;
    setShowDeleteStackConfirm(true);
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full relative">
      {/* 1. Sidebar - Toolbox & Templates */}
      {!sidebarCollapsed ? (
        <div className="w-64 bg-white dark:bg-[#0c0d12] border-r border-slate-200 dark:border-[#1e202a] p-4 flex flex-col justify-between shrink-0 select-none overflow-y-auto relative transition-all duration-300">
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:bg-slate-105 dark:hover:bg-[#1a1c27] hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
            title="Collapse Sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-cyan-500 animate-pulse" />
                <span>Kubernetes Arena</span>
              </h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                Visual Workspace Playground
              </p>
            </div>

            <div className="space-y-2.5">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                Click to Add Resource
              </span>

              {/* Pod */}
              <div
                onClick={() => handleAddNode('pod')}
                className="flex items-center space-x-2.5 p-2 bg-slate-50 hover:bg-cyan-500/5 dark:bg-[#161822] dark:hover:bg-[#1e2230] border border-slate-200/60 dark:border-[#1e202a] hover:border-cyan-500/30 dark:hover:border-cyan-500/30 rounded-xl cursor-pointer transition active:scale-98 group"
              >
                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-500 flex items-center justify-center font-bold shrink-0">
                  <Cpu className="w-4 h-4 group-hover:scale-110 transition" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-205">Pod</h4>
                </div>
              </div>

              {/* Deployment */}
              <div
                onClick={() => handleAddNode('deployment')}
                className="flex items-center space-x-2.5 p-2 bg-slate-50 hover:bg-indigo-500/5 dark:bg-[#161822] dark:hover:bg-[#1e2230] border border-slate-200/60 dark:border-[#1e202a] hover:border-indigo-500/30 dark:hover:border-indigo-500/30 rounded-xl cursor-pointer transition active:scale-98 group"
              >
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold shrink-0">
                  <Layers className="w-4 h-4 group-hover:scale-110 transition" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-205">Deployment</h4>
                </div>
              </div>

              {/* StatefulSet */}
              <div
                onClick={() => handleAddNode('statefulset')}
                className="flex items-center space-x-2.5 p-2 bg-slate-50 hover:bg-violet-500/5 dark:bg-[#161822] dark:hover:bg-[#1e2230] border border-slate-200/60 dark:border-[#1e202a] hover:border-violet-500/30 dark:hover:border-violet-500/30 rounded-xl cursor-pointer transition active:scale-98 group"
              >
                <div className="w-7 h-7 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center font-bold shrink-0">
                  <Database className="w-4 h-4 group-hover:scale-110 transition" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-205">StatefulSet</h4>
                </div>
              </div>

              {/* Service */}
              <div
                onClick={() => handleAddNode('service')}
                className="flex items-center space-x-2.5 p-2 bg-slate-50 hover:bg-blue-500/5 dark:bg-[#161822] dark:hover:bg-[#1e2230] border border-slate-200/60 dark:border-[#1e202a] hover:border-blue-500/30 dark:hover:border-blue-500/30 rounded-xl cursor-pointer transition active:scale-98 group"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold shrink-0">
                  <Network className="w-4 h-4 group-hover:scale-110 transition" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-205">Service</h4>
                </div>
              </div>

              {/* Ingress */}
              <div
                onClick={() => handleAddNode('ingress')}
                className="flex items-center space-x-2.5 p-2 bg-slate-50 hover:bg-emerald-500/5 dark:bg-[#161822] dark:hover:bg-[#1e2230] border border-slate-200/60 dark:border-[#1e202a] hover:border-emerald-500/30 dark:hover:border-emerald-500/30 rounded-xl cursor-pointer transition active:scale-98 group"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold shrink-0">
                  <Globe className="w-4 h-4 group-hover:scale-110 transition" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-205">Ingress</h4>
                </div>
              </div>

              {/* ConfigMap */}
              <div
                onClick={() => handleAddNode('configmap')}
                className="flex items-center space-x-2.5 p-2 bg-slate-50 hover:bg-amber-500/5 dark:bg-[#161822] dark:hover:bg-[#1e2230] border border-slate-200/60 dark:border-[#1e202a] hover:border-amber-500/30 dark:hover:border-amber-500/30 rounded-xl cursor-pointer transition active:scale-98 group"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold shrink-0">
                  <FileText className="w-4 h-4 group-hover:scale-110 transition" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-250">ConfigMap</h4>
                </div>
              </div>

              {/* Secret */}
              <div
                onClick={() => handleAddNode('secret')}
                className="flex items-center space-x-2.5 p-2 bg-slate-50 hover:bg-rose-500/5 dark:bg-[#161822] dark:hover:bg-[#1e2230] border border-slate-200/60 dark:border-[#1e202a] hover:border-rose-500/30 dark:hover:border-rose-500/30 rounded-xl cursor-pointer transition active:scale-98 group"
              >
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold shrink-0">
                  <Lock className="w-4 h-4 group-hover:scale-110 transition" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-205">Secret</h4>
                </div>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-200/65 dark:border-slate-800/65 pt-4">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                Study Templates
              </span>
              <div className="space-y-1.5">
                <button
                  onClick={() => handleLoadTemplate('web')}
                  className="w-full flex items-center space-x-2 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-[#161822] dark:hover:bg-[#1e2230] rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-[#1e202a] cursor-pointer"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">Scalable Web App</span>
                </button>

                <button
                  onClick={() => handleLoadTemplate('db')}
                  className="w-full flex items-center space-x-2 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-[#161822] dark:hover:bg-[#1e2230] rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-[#1e202a] cursor-pointer"
                >
                  <Database className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                  <span className="truncate">Database & Secret Stack</span>
                </button>

                <button
                  onClick={() => handleLoadTemplate('full')}
                  className="w-full flex items-center space-x-2 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-[#161822] dark:hover:bg-[#1e2230] rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-[#1e202a] cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="truncate">Full HTTP Ingress Stack</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="p-3 bg-slate-50 dark:bg-[#14151f] rounded-xl border border-slate-200/40 dark:border-slate-800/40 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 flex items-start space-x-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-cyan-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">Snapping Rules:</span>
                Ingress → Service → Workloads (Pod/Deploy/StatefulSet) → ConfigMap/Secret. Click snap circles on node borders to link.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div 
          onClick={() => setSidebarCollapsed(false)}
          className="w-8 bg-white dark:bg-[#0c0d12] border-r border-slate-200 dark:border-[#1e202a] flex flex-col items-center pt-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#11131c] transition-all shrink-0 select-none"
          title="Expand Sidebar"
        >
          <ChevronRight className="w-4 h-4 text-slate-400 hover:text-cyan-500" />
          <div className="mt-8 [writing-mode:vertical-lr] text-[9px] font-bold uppercase tracking-widest text-slate-400">
            Toolbox & Templates
          </div>
        </div>
      )}

      {/* 2. Main Checkboard Canvas Area */}
      <div className="flex-1 flex flex-col relative bg-slate-50 dark:bg-[#07080b] h-full overflow-hidden">
        {/* Top Canvas Toolbar */}
        <div className="h-14 border-b border-slate-200 dark:border-[#1e202a] bg-white dark:bg-[#0c0d12] px-6 flex justify-between items-center select-none shrink-0 z-30 shadow-xs">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-widest">
              Playground Workspace
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#161822] text-xs font-black text-slate-700 dark:text-slate-350 border border-slate-200/40 dark:border-slate-800/40">
              {nodes.length} Components
            </span>
            {connections.length > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-black border border-cyan-500/20">
                {connections.length} Links
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2.5">
            {nodes.length > 0 && (
              <>
                <button
                  onClick={handleDeployStack}
                  disabled={stackDeploying}
                  className="flex items-center space-x-1.5 bg-cyan-500 hover:bg-cyan-600 text-white font-extrabold px-3.5 py-2 rounded-xl text-[11px] transition shadow-md shadow-cyan-500/10 cursor-pointer disabled:opacity-50"
                >
                  {stackDeploying ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>Deploy Active Stack</span>
                </button>

                <button
                  onClick={handleDeleteStack}
                  className="flex items-center space-x-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-650 dark:text-red-400 font-extrabold px-3.5 py-2 rounded-xl text-[11px] transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Stack</span>
                </button>

                <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-800 mx-1" />

                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold px-3.5 py-2 rounded-xl text-[11px] transition cursor-pointer"
                  title="Clear Arena"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Arena</span>
                </button>
              </>
            )}
          </div>
        </div>

        {connectionError && (
          <div className="absolute top-18 left-4 z-40 bg-red-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg border border-red-600 flex items-center space-x-2 animate-in fade-in slide-in-from-top-4 duration-200">
            <AlertCircle className="w-4 h-4 animate-bounce" />
            <span>{connectionError}</span>
          </div>
        )}

        {connectingFromId && (
          <div className="absolute top-18 left-4 z-40 bg-cyan-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg border border-cyan-600 flex items-center space-x-2 animate-pulse">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>Select a destination snapping dot to complete the connection!</span>
          </div>
        )}

        <div
          ref={canvasRef}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          className="flex-1 h-full relative overflow-hidden bg-slate-50 dark:bg-[#090a0e] arena-grid"
          style={{ backgroundSize: '24px 24px' }}
        >
          {/* Onboarding Guidance Overlay for New Users */}
          {nodes.length === 0 && !onboardingDismissed && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6 z-20">
              <div className="bg-white dark:bg-[#0c0d12] border border-slate-205 dark:border-[#1e202a] p-8 rounded-2xl shadow-2xl max-w-lg w-full pointer-events-auto text-center space-y-6 transform translate-y-0 scale-100 transition animate-in zoom-in-95 duration-300">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center mx-auto border border-cyan-500/20">
                  <Sparkles className="w-7 h-7 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-white">Welcome to Kubernetes Visual Arena!</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed font-semibold">
                    An interactive visual environment designed to help you construct, inspect, link, and orchestrate real Kubernetes microservices stacks.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
                  <div className="p-3 bg-slate-55/50 dark:bg-[#13151e]/50 border border-slate-200/30 dark:border-slate-800/30 rounded-2xl flex items-start space-x-2.5">
                    <div className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-500 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</div>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-350 leading-snug">Click items in the left **Toolbox** to add nodes onto the checkered canvas.</span>
                  </div>

                  <div className="p-3 bg-slate-55/50 dark:bg-[#13151e]/50 border border-slate-200/30 dark:border-slate-800/30 rounded-2xl flex items-start space-x-2.5">
                    <div className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</div>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-350 leading-snug">Drag and drop nodes to organize layout. Click snap port borders to draw links.</span>
                  </div>

                  <div className="p-3 bg-slate-55/50 dark:bg-[#13151e]/50 border border-slate-200/30 dark:border-slate-800/30 rounded-2xl flex items-start space-x-2.5">
                    <div className="w-5 h-5 rounded-full bg-violet-500/10 text-violet-500 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">3</div>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-350 leading-snug">Configure settings in the Form, or unlock YAML to edit text files directly.</span>
                  </div>

                  <div className="p-3 bg-slate-55/50 dark:bg-[#13151e]/50 border border-slate-200/30 dark:border-slate-800/30 rounded-2xl flex items-start space-x-2.5">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">4</div>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-350 leading-snug">Deploy to cluster, view feedback indicators, and inspect live resources in Explorer.</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-2">
                  <button
                    onClick={() => handleLoadTemplate('web')}
                    className="w-full sm:w-auto bg-cyan-500 hover:bg-cyan-600 text-white font-extrabold px-5 py-2 rounded-xl text-xs transition cursor-pointer shadow-lg shadow-cyan-500/10"
                  >
                    Quickstart: Load Web App Stack
                  </button>
                  <button
                    onClick={() => setOnboardingDismissed(true)}
                    className="w-full sm:w-auto bg-slate-100 hover:bg-slate-205 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold px-5 py-2 rounded-xl text-xs transition cursor-pointer"
                  >
                    Start with Empty Arena
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Connections SVGs */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#06b6d4" />
              </marker>
            </defs>

            {connections.map(conn => {
              const fromNode = nodes.find(n => n.id === conn.fromId);
              const toNode = nodes.find(n => n.id === conn.toId);
              if (!fromNode || !toNode) return null;

              const startX = fromNode.x + nodeWidth;
              const startY = fromNode.y + nodeHeight / 2;
              const endX = toNode.x;
              const endY = toNode.y + nodeHeight / 2;

              const controlPointX1 = startX + (endX - startX) / 2;
              const controlPointY1 = startY;
              const controlPointX2 = startX + (endX - startX) / 2;
              const controlPointY2 = endY;

              return (
                <g key={conn.id} className="pointer-events-auto">
                  <path
                    d={`M ${startX} ${startY} C ${controlPointX1} ${controlPointY1}, ${controlPointX2} ${controlPointY2}, ${endX} ${endY}`}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2.5"
                    strokeDasharray="4 4"
                    className="animate-[dash_20s_linear_infinite]"
                    markerEnd="url(#arrow)"
                  />
                  <path
                    d={`M ${startX} ${startY} C ${controlPointX1} ${controlPointY1}, ${controlPointX2} ${controlPointY2}, ${endX} ${endY}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="10"
                    className="cursor-pointer"
                    onClick={() => handleRemoveConnection(conn.id)}
                  />
                </g>
              );
            })}
          </svg>

          {/* Render Cards */}
          {nodes.map(node => {
            const isSelected = selectedNodeId === node.id;
            
            const Icon = 
              node.type === 'pod' ? Cpu : 
              node.type === 'deployment' ? Layers : 
              node.type === 'statefulset' ? Database :
              node.type === 'service' ? Network : 
              node.type === 'ingress' ? Globe :
              node.type === 'configmap' ? FileText : Lock;

            const accentClass =
              node.type === 'pod' ? 'border-cyan-500/60 shadow-cyan-500/5' : 
              node.type === 'deployment' ? 'border-indigo-500/60 shadow-indigo-500/5' : 
              node.type === 'statefulset' ? 'border-violet-500/60 shadow-violet-500/5' :
              node.type === 'service' ? 'border-blue-500/60 shadow-blue-500/5' :
              node.type === 'ingress' ? 'border-emerald-500/60 shadow-emerald-500/5' :
              node.type === 'configmap' ? 'border-amber-500/60 shadow-amber-500/5' :
              'border-rose-500/60 shadow-rose-500/5';

            const iconColorClass = 
              node.type === 'pod' ? 'text-cyan-400' : 
              node.type === 'deployment' ? 'text-indigo-400' : 
              node.type === 'statefulset' ? 'text-violet-400' :
              node.type === 'service' ? 'text-blue-400' :
              node.type === 'ingress' ? 'text-emerald-400' :
              node.type === 'configmap' ? 'text-amber-400' :
              'text-rose-400';

            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(node.id);
                  setYamlEditMode(false);
                }}
                className={`absolute select-none cursor-grab active:cursor-grabbing p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/85 bg-white dark:bg-[#11131c] flex flex-col justify-between shadow-xl transition-all z-10 ${accentClass} ${
                  isSelected ? 'ring-2 ring-cyan-500 border-cyan-400 dark:border-cyan-500 scale-[1.02]' : 'hover:scale-[1.01]'
                }`}
                style={{
                  width: `${nodeWidth}px`,
                  height: `${nodeHeight}px`,
                  left: `${node.x}px`,
                  top: `${node.y}px`
                }}
              >
                {/* Snap Connection circles */}
                <div
                  onClick={(e) => handleConnectPortClick(e, node.id)}
                  className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border border-slate-350 dark:border-[#2d3142] bg-white dark:bg-[#1f2231] hover:bg-cyan-500 dark:hover:bg-cyan-500 transition-all cursor-pointer z-20 flex items-center justify-center hover:scale-120 shadow-sm"
                  title="Link Input Target"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 hover:bg-white shrink-0" />
                </div>

                {node.type !== 'configmap' && node.type !== 'secret' && (
                  <div
                    onClick={(e) => handleConnectPortClick(e, node.id)}
                    className={`absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border transition-all cursor-pointer z-20 flex items-center justify-center hover:scale-120 shadow-sm ${
                      connectingFromId === node.id
                        ? 'bg-cyan-500 border-cyan-400 text-white animate-ping'
                        : 'border-slate-350 dark:border-[#2d3142] bg-white dark:bg-[#1f2231] hover:bg-cyan-500'
                    }`}
                    title="Drag Link Source"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 hover:bg-white shrink-0" />
                  </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 overflow-hidden">
                    <Icon className={`w-4 h-4 shrink-0 ${iconColorClass}`} />
                    <span className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[100px]">
                      {node.name}
                    </span>
                  </div>
                  <div className="shrink-0">
                    {node.status === 'draft' && <span className="w-1.5 h-1.5 rounded-full bg-slate-400 block" title="Draft" />}
                    {node.status === 'deploying' && <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />}
                    {node.status === 'healthy' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block animate-pulse" title="Applied" />}
                    {node.status === 'failed' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 block" title="Failed" />}
                  </div>
                </div>

                {/* Body */}
                <div className="text-[10px] text-slate-505 dark:text-slate-400 truncate leading-normal">
                  {node.type === 'service' ? (
                    <span>Type: {node.config.serviceType}</span>
                  ) : node.type === 'ingress' ? (
                    <span>Host: {node.config.ingressHost}</span>
                  ) : node.type === 'configmap' ? (
                    <span>Key: {node.config.configKey}</span>
                  ) : node.type === 'secret' ? (
                    <span>Key: {node.config.secretKey}</span>
                  ) : (
                    <span>Image: {node.config.image || 'N/A'}</span>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-200/10 mt-1">
                  <div className="flex space-x-2">
                    {node.status === 'draft' || node.status === 'failed' ? (
                      <button
                        title="Deploy Component"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeployNode(node);
                        }}
                        className="text-emerald-500 hover:text-emerald-400 cursor-pointer"
                      >
                        <Play className="w-3 h-3" />
                      </button>
                    ) : (
                      <button
                        title="Delete from Cluster"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNodeFromCluster(node);
                        }}
                        className="text-red-500 hover:text-red-450 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      title="Remove Component Card"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveNode(node.id);
                      }}
                      className="text-slate-400 hover:text-slate-650 dark:text-slate-500 dark:hover:text-slate-300 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Right configurator drawer */}
      {selectedNode && (
        !configuratorCollapsed ? (
          <div className="w-96 bg-white dark:bg-[#0c0d12] border-l border-slate-200 dark:border-[#1e202a] flex flex-col justify-between shrink-0 h-full relative transition-all duration-300">
            <button
              onClick={() => setConfiguratorCollapsed(true)}
              className="absolute left-3 top-5 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-555 hover:text-slate-700 cursor-pointer z-10"
              title="Collapse Configurator"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="p-4 border-b border-slate-200 dark:border-[#1e202a] flex justify-between items-center bg-slate-50 dark:bg-[#0f1017] pl-10">
              <div>
                <div className="flex items-center space-x-2 text-xs font-bold text-slate-500">
                  <span className="capitalize">{selectedNode.type} Configurator</span>
                </div>
                <h3 className="text-sm font-extrabold text-slate-800 dark:text-white mt-1">
                  {selectedNode.name}
                </h3>
              </div>
              <div className="flex bg-slate-200 dark:bg-slate-800 rounded-lg p-0.5 text-xs shrink-0">
                <button
                  onClick={() => { setConfigTab('form'); setYamlEditMode(false); }}
                  className={`px-2.5 py-1 rounded-md font-bold transition ${
                    configTab === 'form' ? 'bg-white dark:bg-[#12141c] text-cyan-500 shadow-sm' : 'text-slate-555 hover:text-slate-700'
                  }`}
                >
                  Form
                </button>
                <button
                  onClick={() => setConfigTab('yaml')}
                  className={`px-2.5 py-1 rounded-md font-bold transition ${
                    configTab === 'yaml' ? 'bg-white dark:bg-[#12141c] text-cyan-500 shadow-sm' : 'text-slate-555 hover:text-slate-705'
                  }`}
                >
                  YAML
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-semibold text-xs">
              {configTab === 'form' ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                      Resource Name
                    </label>
                    <input
                      type="text"
                      value={selectedNode.name}
                      onChange={(e) => handleUpdateForm('name', e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, ''))}
                      className="w-full bg-slate-50 dark:bg-[#141620] text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200/60 dark:border-[#1e202a] px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                  </div>

                  {(selectedNode.type === 'pod' || selectedNode.type === 'deployment' || selectedNode.type === 'statefulset') && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                          Container Image
                        </label>
                        <input
                          type="text"
                          value={selectedNode.config.image}
                          onChange={(e) => handleUpdateForm('image', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-[#141620] text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200/60 dark:border-[#1e202a] px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                          Container Port
                        </label>
                        <input
                          type="number"
                          value={selectedNode.config.port}
                          onChange={(e) => handleUpdateForm('port', parseInt(e.target.value) || 80)}
                          className="w-full bg-slate-50 dark:bg-[#141620] text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200/60 dark:border-[#1e202a] px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                    </>
                  )}

                  {(selectedNode.type === 'deployment' || selectedNode.type === 'statefulset') && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                        Replicas Size
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={selectedNode.config.replicas}
                        onChange={(e) => handleUpdateForm('replicas', parseInt(e.target.value) || 1)}
                        className="w-full bg-slate-50 dark:bg-[#141620] text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200/60 dark:border-[#1e202a] px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                  )}

                  {selectedNode.type === 'statefulset' && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                        Headless Service Binding
                      </label>
                      <input
                        type="text"
                        value={selectedNode.config.serviceName}
                        onChange={(e) => handleUpdateForm('serviceName', e.target.value)}
                        className="w-full bg-slate-50 dark:bg-[#141620] text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200/60 dark:border-[#1e202a] px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                  )}

                  {selectedNode.type === 'service' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                          Service Type
                        </label>
                        <select
                          value={selectedNode.config.serviceType}
                          onChange={(e) => handleUpdateForm('serviceType', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-[#141620] text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200/60 dark:border-[#1e202a] px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500 font-bold"
                        >
                          <option value="ClusterIP">ClusterIP (Internal)</option>
                          <option value="NodePort">NodePort (External Node)</option>
                          <option value="LoadBalancer">LoadBalancer (Cloud LB)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                          Port (Routing Service Port)
                        </label>
                        <input
                          type="number"
                          value={selectedNode.config.port}
                          onChange={(e) => handleUpdateForm('port', parseInt(e.target.value) || 80)}
                          className="w-full bg-slate-50 dark:bg-[#141620] text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200/60 dark:border-[#1e202a] px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                          Target Container Port
                        </label>
                        <input
                          type="number"
                          value={selectedNode.config.targetPort}
                          onChange={(e) => handleUpdateForm('targetPort', parseInt(e.target.value) || 80)}
                          className="w-full bg-slate-50 dark:bg-[#141620] text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200/60 dark:border-[#1e202a] px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                          App Selector Label Match
                        </label>
                        <input
                          type="text"
                          value={selectedNode.config.selector}
                          onChange={(e) => handleUpdateForm('selector', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-[#141620] text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200/60 dark:border-[#1e202a] px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                    </>
                  )}

                  {selectedNode.type === 'ingress' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                          Ingress Domain Hostname
                        </label>
                        <input
                          type="text"
                          value={selectedNode.config.ingressHost}
                          onChange={(e) => handleUpdateForm('ingressHost', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-[#141620] text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200/60 dark:border-[#1e202a] px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                          URL Path Route
                        </label>
                        <input
                          type="text"
                          value={selectedNode.config.ingressPath}
                          onChange={(e) => handleUpdateForm('ingressPath', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-[#141620] text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200/60 dark:border-[#1e202a] px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                          Target Backend Service
                        </label>
                        <input
                          type="text"
                          value={selectedNode.config.ingressService}
                          onChange={(e) => handleUpdateForm('ingressService', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-[#141620] text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200/60 dark:border-[#1e202a] px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                    </>
                  )}

                  {selectedNode.type === 'configmap' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                          Config Key
                        </label>
                        <input
                          type="text"
                          value={selectedNode.config.configKey}
                          onChange={(e) => handleUpdateForm('configKey', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-[#141620] text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200/60 dark:border-[#1e202a] px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                          Config Value
                        </label>
                        <input
                          type="text"
                          value={selectedNode.config.configValue}
                          onChange={(e) => handleUpdateForm('configValue', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-[#141620] text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200/60 dark:border-[#1e202a] px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>
                    </>
                  )}

                  {selectedNode.type === 'secret' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                          Secret Key
                        </label>
                        <input
                          type="text"
                          value={selectedNode.config.secretKey}
                          onChange={(e) => handleUpdateForm('secretKey', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-[#141620] text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200/60 dark:border-[#1e202a] px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                          Secret Value (Decoded)
                        </label>
                        <input
                          type="text"
                          value={selectedNode.config.secretValue}
                          onChange={(e) => handleUpdateForm('secretValue', e.target.value)}
                          className="w-full bg-slate-50 dark:bg-[#141620] text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200/60 dark:border-[#1e202a] px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
                        />
                      </div>
                    </>
                  )}

                  {selectedNode.statusMessage && (
                    <div className={`p-3 rounded-xl border flex items-start space-x-2 text-[11px] leading-relaxed font-semibold ${
                      selectedNode.status === 'healthy' 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                        : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                    }`}>
                      {selectedNode.status === 'healthy' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                      <span>{selectedNode.statusMessage}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 flex flex-col h-full">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                      Manifest Code (YAML)
                    </span>
                    <button
                      onClick={() => setYamlEditMode(!yamlEditMode)}
                      className="text-xs text-cyan-500 hover:text-cyan-600 font-bold"
                    >
                      {yamlEditMode ? 'Lock Visual Form' : 'Unlock & Edit YAML'}
                    </button>
                  </div>

                  <textarea
                    value={yamlText}
                    onChange={(e) => handleYamlTextChange(e.target.value)}
                    disabled={!yamlEditMode}
                    className="w-full flex-1 min-h-[300px] bg-slate-50 dark:bg-[#141620] text-slate-800 dark:text-slate-200 p-3 rounded-xl font-mono text-[11px] border border-slate-200/80 dark:border-[#1e202a] outline-none focus:ring-1 focus:ring-cyan-500 leading-normal"
                  />

                  {validationError && (
                    <div className="p-3 bg-red-550/10 border border-red-500/30 rounded-xl text-red-650 dark:text-red-400 text-xs font-semibold leading-relaxed">
                      {validationError}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-[#1e202a] bg-slate-50 dark:bg-[#0f1017] space-y-2">
              <button
                onClick={() => handleDeployNode(selectedNode)}
                disabled={selectedNode.status === 'deploying'}
                className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-cyan-500/10"
              >
                {selectedNode.status === 'deploying' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Applying YAML...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Deploy to Cluster</span>
                  </>
                )}
              </button>

              {(selectedNode.status === 'healthy' || selectedNode.status === 'failed') && (
                <button
                  onClick={() => handleDeleteNodeFromCluster(selectedNode)}
                  className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center space-x-2 cursor-pointer border border-red-500/30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete from Cluster</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div 
            onClick={() => setConfiguratorCollapsed(false)}
            className="w-8 bg-white dark:bg-[#0c0d12] border-l border-slate-200 dark:border-[#1e202a] flex flex-col items-center pt-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#11131c] transition-all shrink-0 select-none"
            title="Expand Configurator"
          >
            <ChevronLeft className="w-4 h-4 text-slate-400 hover:text-cyan-500" />
            <div className="mt-8 [writing-mode:vertical-lr] text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Configurator
            </div>
          </div>
        )
      )}

      {!selectedNode && (
        <div className="w-96 bg-white dark:bg-[#0c0d12] border-l border-slate-200 dark:border-[#1e202a] flex flex-col justify-center items-center p-6 text-center text-slate-500 dark:text-slate-400 select-none shrink-0 h-full">
          <div className="w-12 h-12 rounded-xl bg-slate-105 dark:bg-[#1a1c27] flex items-center justify-center text-slate-400 mb-3 border border-slate-200/40 dark:border-slate-800/40">
            <Code className="w-6 h-6" />
          </div>
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">No Resource Selected</h4>
          <p className="text-[11px] mt-1 text-slate-405 leading-normal max-w-[200px]">
            Click on any Component Card on the canvas board to configure its parameters.
          </p>
        </div>
      )}

      {showClearConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-905/65 dark:bg-[#000]/65 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c0d12] border border-slate-205 dark:border-[#1e202a] p-6 rounded-2xl shadow-xl max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center space-x-3 text-red-500">
              <AlertCircle className="w-6 h-6 animate-bounce" />
              <h3 className="text-sm font-bold text-slate-850 dark:text-white">Clear Arena Workspace?</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
              Are you sure you want to clear all nodes and connections from the Arena? This will reset the workspace canvas, but will not delete any active resources from the Kubernetes cluster.
            </p>
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-205 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-2 rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setNodes([]);
                  setConnections([]);
                  setSelectedNodeId(null);
                  setShowClearConfirm(false);
                }}
                className="flex-1 bg-red-500 hover:bg-red-650 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer animate-all"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom modal confirm overlay for Load study templates */}
      {templateConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-905/65 dark:bg-[#000]/65 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c0d12] border border-slate-205 dark:border-[#1e202a] p-6 rounded-2xl shadow-xl max-w-sm w-full mx-4 space-y-4 font-semibold text-xs">
            <div className="flex items-center space-x-3 text-cyan-500">
              <Sparkles className="w-6 h-6 animate-pulse shrink-0" />
              <h3 className="text-sm font-black text-slate-850 dark:text-white">Load Study Template?</h3>
            </div>
            <p className="text-xs text-slate-555 dark:text-slate-400 leading-relaxed">
              Loading this template will clear your current canvas and reset all connections. Active cluster resources will not be affected. Do you want to proceed?
            </p>
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setTemplateConfirm(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-250 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  executeLoadTemplate(templateConfirm);
                  setTemplateConfirm(null);
                }}
                className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Yes, Load
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom modal confirm overlay for Delete stack */}
      {showDeleteStackConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-905/65 dark:bg-[#000]/65 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#0c0d12] border border-slate-205 dark:border-[#1e202a] p-6 rounded-2xl shadow-xl max-w-sm w-full mx-4 space-y-4 font-semibold text-xs">
            <div className="flex items-center space-x-3 text-red-500">
              <AlertCircle className="w-6 h-6 animate-bounce shrink-0" />
              <h3 className="text-sm font-black text-slate-850 dark:text-white">Delete Active Stack?</h3>
            </div>
            <p className="text-xs text-slate-555 dark:text-slate-400 leading-relaxed">
              Are you sure you want to delete all resources in this active stack from your live Kubernetes cluster? This action is permanent and cannot be undone.
            </p>
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setShowDeleteStackConfirm(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-250 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  executeDeleteStack();
                  setShowDeleteStackConfirm(false);
                }}
                className="flex-1 bg-red-500 hover:bg-red-650 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Yes, Delete Stack
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
