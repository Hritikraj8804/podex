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
  Box, Settings2, Trash,
} from 'lucide-react';
import K8sNode from './nodes/K8sNode';

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
  setToast?: (toast: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
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

const TEMPLATES = [
  { id: 'web' as const, label: 'Scalable Web App', desc: 'Service + Deployment' },
  { id: 'db' as const,  label: 'Database Stack',   desc: 'StatefulSet + Secret + ConfigMap' },
  { id: 'full' as const,label: 'Full HTTP Ingress', desc: 'Ingress + Service + Deploy + ConfigMap' },
];

const base64Encode = (str: string): string => {
  try {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    ));
  } catch (e) {
    return btoa(str);
  }
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
    envYaml = '\n      envFrom:';
    configMapConns.forEach(c => {
      const cm = allNodes.find(n => n.id === c.toId);
      if (cm) envYaml += `\n      - configMapRef:\n          name: ${cm.name}`;
    });
    secretConns.forEach(c => {
      const sec = allNodes.find(n => n.id === c.toId);
      if (sec) envYaml += `\n      - secretRef:\n          name: ${sec.name}`;
    });
  }

  if (type === 'pod') {
    return `apiVersion: v1\nkind: Pod\nmetadata:\n  name: ${name}\n  labels:\n    app: ${name}\nspec:\n  containers:\n  - name: container\n    image: ${config.image}\n    ports:\n    - containerPort: ${config.port}${envYaml}`;
  } else if (type === 'deployment') {
    return `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${name}\n  labels:\n    app: ${name}\nspec:\n  replicas: ${config.replicas}\n  selector:\n    matchLabels:\n      app: ${name}\n  template:\n    metadata:\n      labels:\n        app: ${name}\n    spec:\n      containers:\n      - name: container\n        image: ${config.image}\n        ports:\n        - containerPort: ${config.port}${envYaml}`;
  } else if (type === 'statefulset') {
    return `apiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: ${name}\nspec:\n  serviceName: ${config.serviceName || 'db-service'}\n  replicas: ${config.replicas}\n  selector:\n    matchLabels:\n      app: ${name}\n  template:\n    metadata:\n      labels:\n        app: ${name}\n    spec:\n      containers:\n      - name: container\n        image: ${config.image}\n        ports:\n        - containerPort: ${config.port}${envYaml}`;
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
}) => {
  const [configTab, setConfigTab] = useState<'form' | 'yaml'>('form');
  const [yamlEditMode, setYamlEditMode] = useState(false);
  const [yamlText, setYamlText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [templateConfirm, setTemplateConfirm] = useState<'web' | 'db' | 'full' | null>(null);
  const [showDeleteStackConfirm, setShowDeleteStackConfirm] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [configuratorCollapsed, setConfiguratorCollapsed] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [stackDeploying, setStackDeploying] = useState(false);

  const { screenToFlowPosition } = useReactFlow();

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

  const onNodeDragStop = useCallback((_: any, node: Node) => {
    setNodes(prev => prev.map(n =>
      n.id === node.id ? { ...n, x: node.position.x, y: node.position.y } : n
    ));
  }, [setNodes]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id);
    setYamlEditMode(false);
  }, [setSelectedNodeId]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
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
    setNodes(nodes.map(n => n.id === node.id ? { ...n, status: 'deploying', statusMessage: undefined } : n));
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
    setNodes(nodes.map(n => ({ ...n, status: 'deploying', statusMessage: undefined })));
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
        setNodes(nodes.map(n => ({ ...n, status: 'failed', statusMessage: err.detail || 'Failed' })));
      }
    } catch (e: any) {
      setNodes(nodes.map(n => ({ ...n, status: 'failed', statusMessage: e.message })));
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
        { id: `deploy-${ts}`, type: 'deployment', name: 'web-app', x: 380, y: 200, status: 'draft',
          config: { ...emptyCfg, image: 'nginx:alpine', replicas: 3, port: 80, targetPort: 80 } },
      ],
      db: [
        { id: `svc-${ts}`, type: 'service', name: 'postgres-svc', x: 80, y: 220, status: 'draft',
          config: { ...emptyCfg, port: 5432, targetPort: 5432, selector: 'postgres-db' } },
        { id: `ss-${ts}`, type: 'statefulset', name: 'postgres-db', x: 360, y: 220, status: 'draft',
          config: { ...emptyCfg, image: 'postgres:15-alpine', port: 5432, targetPort: 5432, serviceName: 'postgres-svc' } },
        { id: `sec-${ts}`, type: 'secret', name: 'db-credentials', x: 600, y: 120, status: 'draft',
          config: { ...emptyCfg, secretKey: 'POSTGRES_PASSWORD', secretValue: 'postgres123' } },
        { id: `cm-${ts}`, type: 'configmap', name: 'db-configs', x: 600, y: 320, status: 'draft',
          config: { ...emptyCfg, configKey: 'POSTGRES_DB', configValue: 'appdb' } },
      ],
      full: [
        { id: `ing-${ts}`, type: 'ingress', name: 'frontend-ingress', x: 50, y: 220, status: 'draft',
          config: { ...emptyCfg, ingressHost: 'frontend.local', ingressPath: '/', ingressService: 'frontend-svc' } },
        { id: `svc-${ts}`, type: 'service', name: 'frontend-svc', x: 310, y: 220, status: 'draft',
          config: { ...emptyCfg, port: 80, targetPort: 80, selector: 'frontend-deployment' } },
        { id: `dep-${ts}`, type: 'deployment', name: 'frontend-deployment', x: 570, y: 220, status: 'draft',
          config: { ...emptyCfg, image: 'nginx:alpine', replicas: 2, port: 80, targetPort: 80 } },
        { id: `cm-${ts}`, type: 'configmap', name: 'frontend-configs', x: 830, y: 220, status: 'draft',
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
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => setTemplateConfirm(t.id)}
                className="w-full text-left p-2.5 rounded-lg bg-white dark:bg-[#111820] border border-slate-100 dark:border-[#1b2332] hover:border-cyan-300 dark:hover:border-cyan-600/30 transition-all duration-150 cursor-pointer"
              >
                <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">{t.label}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{t.desc}</div>
              </button>
            ))}
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

          {/* Onboarding overlay */}
          {nodes.length === 0 && !onboardingDismissed && (
            <Panel position="top-center" className="pointer-events-auto mt-20">
              <div className="bg-white dark:bg-[#0f1219] border border-slate-200 dark:border-[#1b2332] p-8 rounded-xl shadow-2xl max-w-lg text-center space-y-5">
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
                    onClick={() => executeLoadTemplate('web')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition"
                  >
                    Start with Template
                  </button>
                  <button
                    onClick={() => setOnboardingDismissed(true)}
                    className="px-4 py-2 bg-slate-100 dark:bg-[#1b2332] hover:bg-slate-200 dark:hover:bg-[#242d3d] text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-lg transition"
                  >
                    Start Empty
                  </button>
                </div>
              </div>
            </Panel>
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
                  className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-30 transition cursor-pointer"
                  title="Clear canvas"
                >
                  <Trash className="w-3.5 h-3.5" />
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
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Port</label>
                          <input
                            type="number"
                            value={selectedNode.config.port}
                            onChange={(e) => handleUpdateForm('port', parseInt(e.target.value) || 80)}
                            className="mt-1 w-full bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Replicas</label>
                          <input
                            type="number"
                            value={selectedNode.config.replicas}
                            onChange={(e) => handleUpdateForm('replicas', parseInt(e.target.value) || 1)}
                            className="mt-1 w-full bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
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
                  <textarea
                    value={yamlText}
                    onChange={(e) => handleYamlTextChange(e.target.value)}
                    className="w-full h-80 bg-slate-50 dark:bg-[#080b10] border border-slate-200 dark:border-[#1b2332] rounded-lg p-3 text-[11px] font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none leading-relaxed"
                    spellCheck={false}
                  />
                  {validationError && (
                    <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-[11px] font-medium">
                      {validationError}
                    </div>
                  )}
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
