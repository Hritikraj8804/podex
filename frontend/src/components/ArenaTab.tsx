import React, { useState, useRef, useEffect } from 'react';
import {
  Cpu,
  Layers,
  Network,
  Trash2,
  Play,
  CheckCircle2,
  XCircle,
  Plus,
  Code,
  Sparkles,
  Loader2,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

interface ArenaNode {
  id: string;
  type: 'pod' | 'deployment' | 'service';
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
  };
}

interface ArenaConnection {
  id: string;
  fromId: string; // Always Service
  toId: string;   // Always Pod or Deployment
}

interface ArenaTabProps {
  apiUrl: string;
}

export const ArenaTab: React.FC<ArenaTabProps> = ({ apiUrl }) => {
  const [nodes, setNodes] = useState<ArenaNode[]>([]);
  const [connections, setConnections] = useState<ArenaConnection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [configTab, setConfigTab] = useState<'form' | 'yaml'>('form');
  const [yamlEditMode, setYamlEditMode] = useState(false);
  const [yamlText, setYamlText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Connection state
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Dragging states
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragStartOffset = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Auto-generate yaml text when form details change
  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  useEffect(() => {
    if (selectedNode && !yamlEditMode) {
      setYamlText(generateYaml(selectedNode));
      setValidationError(null);
    }
  }, [selectedNodeId, selectedNode?.config, selectedNode?.name, yamlEditMode]);

  // SVG dimensions
  const nodeWidth = 180;
  const nodeHeight = 84;

  const generateYaml = (node: ArenaNode): string => {
    const { type, name, config } = node;
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
    - containerPort: ${config.port}`;
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
        - containerPort: ${config.port}`;
    } else {
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

      const parsedConfig = { ...node.config };
      let parsedName = node.name;

      if (nameMatch) parsedName = nameMatch[1];
      if (imageMatch) parsedConfig.image = imageMatch[1];
      if (replicasMatch) parsedConfig.replicas = parseInt(replicasMatch[1]);
      if (portMatch) parsedConfig.port = parseInt(portMatch[1]);
      if (targetPortMatch) parsedConfig.targetPort = parseInt(targetPortMatch[1]);
      if (typeMatch) parsedConfig.serviceType = typeMatch[1] as any;
      
      // Selectors are parsed from service selectors
      if (selectorMatch && node.type === 'service') {
        parsedConfig.selector = selectorMatch[1];
      }

      return {
        name: parsedName,
        config: parsedConfig
      };
    } catch (e) {
      return null;
    }
  };

  const handleAddNode = (type: 'pod' | 'deployment' | 'service') => {
    const id = `${type}-${Date.now().toString().slice(-6)}`;
    const defaultName = `arena-${type}-${nodes.length + 1}`;
    
    // Position in the center of viewport
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
        image: type === 'service' ? '' : 'nginx:alpine',
        replicas: 1,
        port: 80,
        targetPort: 80,
        serviceType: 'ClusterIP',
        selector: ''
      }
    };

    setNodes([...nodes, newNode]);
    setSelectedNodeId(id);
    setYamlEditMode(false);
  };

  // Node Dragging Handlers
  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    if (connectingFromId) return; // Don't drag while connecting
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

      // Keep inside bounds
      x = Math.max(10, Math.min(x, canvas.clientWidth - nodeWidth - 10));
      y = Math.max(10, Math.min(y, canvas.clientHeight - nodeHeight - 10));

      setNodes(nodes.map(n => n.id === draggingNodeId ? { ...n, x, y } : n));
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingNodeId(null);
  };

  // Connection Handler (Scratch Validation)
  const handleConnectPortClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const clickedNode = nodes.find(n => n.id === nodeId);
    if (!clickedNode) return;

    if (!connectingFromId) {
      // First click: Must start from a Service!
      if (clickedNode.type !== 'service') {
        setConnectionError("K8s Rule: Connections must start from a Service!");
        setTimeout(() => setConnectionError(null), 3000);
        return;
      }
      setConnectingFromId(nodeId);
    } else {
      // Second click: Target validation
      if (connectingFromId === nodeId) {
        // Canceled connection
        setConnectingFromId(null);
        return;
      }

      // Scratch validation: Service can only connect to Pod or Deployment
      if (clickedNode.type !== 'pod' && clickedNode.type !== 'deployment') {
        setConnectionError("K8s Rule: A Service can only route to Pods or Deployments!");
        setConnectingFromId(null);
        setTimeout(() => setConnectionError(null), 3000);
        return;
      }

      // Valid connection
      const connId = `conn-${Date.now()}`;
      setConnections([...connections, { id: connId, fromId: connectingFromId, toId: nodeId }]);

      // Automatically sync target label selector on the Service YAML!
      setNodes(nodes.map(n => {
        if (n.id === connectingFromId) {
          return {
            ...n,
            config: {
              ...n.config,
              selector: clickedNode.name
            }
          };
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

  // YAML Direct Edit Handler
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

  // Deploy / Apply to Cluster
  const handleDeployNode = async (node: ArenaNode) => {
    // 1. Set status to deploying
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
          namespace: 'default' // Default active namespace
        })
      });

      if (res.ok) {
        setNodes(nodes.map(n => n.id === node.id ? { ...n, status: 'draft', statusMessage: 'Deleted from cluster' } : n));
      } else {
        const err = await res.json();
        alert(`Failed to delete resource: ${err.detail}`);
      }
    } catch (e: any) {
      alert(`Network error: ${e.message}`);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full">
      {/* Sidebar - Toolbox */}
      <div className="w-64 bg-white dark:bg-[#0c0d12] border-r border-slate-200 dark:border-[#1e202a] p-4 flex flex-col justify-between shrink-0 select-none">
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

          <div className="space-y-3">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
              Drag / Click to Add
            </span>

            {/* Toolbox Cards */}
            <div
              onClick={() => handleAddNode('pod')}
              className="flex items-center space-x-3 p-3 bg-slate-50 hover:bg-cyan-500/5 dark:bg-[#161822] dark:hover:bg-[#1e2230] border border-slate-200/60 dark:border-[#1e202a] hover:border-cyan-500/30 dark:hover:border-cyan-500/30 rounded-xl cursor-pointer transition active:scale-98 group"
            >
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-500 flex items-center justify-center font-bold">
                <Cpu className="w-5 h-5 group-hover:scale-110 transition" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Pod</h4>
                <p className="text-[10px] text-slate-450 dark:text-slate-550 leading-tight">Smallest basic K8s unit</p>
              </div>
            </div>

            <div
              onClick={() => handleAddNode('deployment')}
              className="flex items-center space-x-3 p-3 bg-slate-50 hover:bg-indigo-500/5 dark:bg-[#161822] dark:hover:bg-[#1e2230] border border-slate-200/60 dark:border-[#1e202a] hover:border-indigo-500/30 dark:hover:border-indigo-500/30 rounded-xl cursor-pointer transition active:scale-98 group"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold">
                <Layers className="w-5 h-5 group-hover:scale-110 transition" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Deployment</h4>
                <p className="text-[10px] text-slate-450 dark:text-slate-550 leading-tight">Manages replica sets</p>
              </div>
            </div>

            <div
              onClick={() => handleAddNode('service')}
              className="flex items-center space-x-3 p-3 bg-slate-50 hover:bg-blue-500/5 dark:bg-[#161822] dark:hover:bg-[#1e2230] border border-slate-200/60 dark:border-[#1e202a] hover:border-blue-500/30 dark:hover:border-blue-500/30 rounded-xl cursor-pointer transition active:scale-98 group"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
                <Network className="w-5 h-5 group-hover:scale-110 transition" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Service</h4>
                <p className="text-[10px] text-slate-450 dark:text-slate-550 leading-tight">Stable network load balancer</p>
              </div>
            </div>
          </div>
        </div>

        {/* Info panel */}
        <div className="p-3 bg-slate-50 dark:bg-[#14151f] rounded-xl border border-slate-200/40 dark:border-slate-800/40 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 flex items-start space-x-2">
          <HelpCircle className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">K8s Connections:</span>
            To route traffic, click the connector port <span className="w-2.5 h-2.5 rounded-full border border-cyan-500 bg-cyan-500/10 inline-block align-middle mx-0.5"/> on a Service, then click a target Pod or Deployment.
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col relative bg-slate-50 dark:bg-[#07080b] h-full overflow-hidden">
        {/* Connection errors / Alert Banner */}
        {connectionError && (
          <div className="absolute top-4 left-4 z-40 bg-red-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg border border-red-600 flex items-center space-x-2 animate-in fade-in slide-in-from-top-4 duration-200">
            <AlertCircle className="w-4 h-4" />
            <span>{connectionError}</span>
          </div>
        )}

        {connectingFromId && (
          <div className="absolute top-4 left-4 z-40 bg-cyan-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg border border-cyan-600 flex items-center space-x-2 animate-pulse">
            <Sparkles className="w-4 h-4 animate-spin" />
            <span>Click on a target Pod or Deployment to route the Service!</span>
          </div>
        )}

        {/* Blueprint checkboard canvas */}
        <div
          ref={canvasRef}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          className="flex-1 h-full relative overflow-hidden bg-slate-50 dark:bg-[#090a0e] arena-grid"
          style={{
            backgroundSize: '24px 24px'
          }}
        >
          {/* SVG Arrow Overlay */}
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

              // Compute ports coordinates
              const startX = fromNode.x + nodeWidth;
              const startY = fromNode.y + nodeHeight / 2;
              const endX = toNode.x;
              const endY = toNode.y + nodeHeight / 2;

              // Beautiful bezier curve
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
                  {/* Invisible fat line for easier click removal */}
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

          {/* Render Nodes */}
          {nodes.map(node => {
            const isSelected = selectedNodeId === node.id;
            const Icon = node.type === 'pod' ? Cpu : node.type === 'deployment' ? Layers : Network;
            const accentClass =
              node.type === 'pod'
                ? 'border-cyan-500/60 shadow-cyan-500/5'
                : node.type === 'deployment'
                ? 'border-indigo-500/60 shadow-indigo-500/5'
                : 'border-blue-500/60 shadow-blue-500/5';

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
                {/* Node Top Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 overflow-hidden">
                    <Icon className={`w-4 h-4 shrink-0 ${
                      node.type === 'pod' ? 'text-cyan-400' : node.type === 'deployment' ? 'text-indigo-400' : 'text-blue-400'
                    }`} />
                    <span className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[100px]">
                      {node.name}
                    </span>
                  </div>

                  {/* Deploy status */}
                  <div className="shrink-0">
                    {node.status === 'draft' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500 block" title="Draft (Not Applied)" />
                    )}
                    {node.status === 'deploying' && (
                      <Loader2 className="w-3 h-3 text-cyan-400 animate-spin" />
                    )}
                    {node.status === 'healthy' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block animate-pulse" title="Healthy Cluster Pod" />
                    )}
                    {node.status === 'failed' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 block" title="Apply Failed" />
                    )}
                  </div>
                </div>

                {/* Subtitle config info */}
                <div className="text-[10px] text-slate-400 truncate leading-normal">
                  {node.type === 'service' ? (
                    <span>Type: {node.config.serviceType}</span>
                  ) : (
                    <span>Image: {node.config.image || 'N/A'}</span>
                  )}
                </div>

                {/* Node Footer Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-200/10 mt-1">
                  <div className="flex space-x-1.5">
                    {node.status === 'draft' || node.status === 'failed' ? (
                      <button
                        title="Deploy to Cluster"
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
                        className="text-red-500 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      title="Remove Card"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveNode(node.id);
                      }}
                      className="text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Connection Point Port (Scratch connection ports) */}
                  <button
                    onClick={(e) => handleConnectPortClick(e, node.id)}
                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center cursor-pointer transition ${
                      connectingFromId === node.id
                        ? 'bg-cyan-500 border-cyan-400 text-white animate-ping'
                        : 'border-slate-500/40 bg-slate-800 text-slate-400 hover:bg-cyan-500 hover:border-cyan-400 hover:text-white'
                    }`}
                    title={node.type === 'service' ? "Start Route Connector" : "Target Route Connector"}
                  >
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Configurator Side Drawer (Right Panel) */}
      {selectedNode ? (
        <div className="w-96 bg-white dark:bg-[#0c0d12] border-l border-slate-200 dark:border-[#1e202a] flex flex-col justify-between shrink-0 h-full">
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-200 dark:border-[#1e202a] flex justify-between items-center bg-slate-50 dark:bg-[#0f1017]">
            <div>
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-500">
                <span className="capitalize">{selectedNode.type} Configurator</span>
              </div>
              <h3 className="text-sm font-extrabold text-slate-800 dark:text-white mt-1">
                {selectedNode.name}
              </h3>
            </div>
            {/* View Switch tabs */}
            <div className="flex bg-slate-200 dark:bg-slate-800 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => {
                  setConfigTab('form');
                  setYamlEditMode(false);
                }}
                className={`px-2.5 py-1 rounded-md font-bold transition ${
                  configTab === 'form' ? 'bg-white dark:bg-[#12141c] text-cyan-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Form
              </button>
              <button
                onClick={() => setConfigTab('yaml')}
                className={`px-2.5 py-1 rounded-md font-bold transition ${
                  configTab === 'yaml' ? 'bg-white dark:bg-[#12141c] text-cyan-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                YAML
              </button>
            </div>
          </div>

          {/* Drawer Body - Tabs Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {configTab === 'form' ? (
              // Visual Form Configs
              <div className="space-y-4">
                {/* Resource Name */}
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

                {/* Spec Configs based on Type */}
                {selectedNode.type !== 'service' && (
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
                        Port Config
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

                {selectedNode.type === 'deployment' && (
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

                {selectedNode.type === 'service' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                        Service Type
                      </label>
                      <select
                        value={selectedNode.config.serviceType}
                        onChange={(e) => handleUpdateForm('serviceType', e.target.value)}
                        className="w-full bg-slate-50 dark:bg-[#141620] text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200/60 dark:border-[#1e202a] px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      >
                        <option value="ClusterIP">ClusterIP (Internal)</option>
                        <option value="NodePort">NodePort (External Node)</option>
                        <option value="LoadBalancer">LoadBalancer (Cloud LB)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                        Port (Service Router)
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
                        Target App Selector
                      </label>
                      <input
                        type="text"
                        value={selectedNode.config.selector}
                        onChange={(e) => handleUpdateForm('selector', e.target.value)}
                        placeholder="e.g. app-name"
                        className="w-full bg-slate-50 dark:bg-[#141620] text-slate-800 dark:text-slate-200 rounded-lg border border-slate-200/60 dark:border-[#1e202a] px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                    </div>
                  </>
                )}

                {/* Deploy Errors */}
                {selectedNode.statusMessage && (
                  <div className={`p-3 rounded-xl border flex items-start space-x-2 text-[11px] leading-relaxed font-semibold ${
                    selectedNode.status === 'healthy' 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-red-500/10 border-red-500/30 text-red-650 dark:text-red-400'
                  }`}>
                    {selectedNode.status === 'healthy' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                    <span>{selectedNode.statusMessage}</span>
                  </div>
                )}
              </div>
            ) : (
              // YAML Editor View
              <div className="space-y-3 flex flex-col h-full">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">
                    Deployment Manifest (YAML)
                  </span>
                  <button
                    onClick={() => setYamlEditMode(!yamlEditMode)}
                    className="text-xs text-cyan-505 hover:text-cyan-600 font-bold"
                  >
                    {yamlEditMode ? 'Lock Visual Form' : 'Unlock & Edit YAML'}
                  </button>
                </div>

                <textarea
                  value={yamlText}
                  onChange={(e) => handleYamlTextChange(e.target.value)}
                  disabled={!yamlEditMode}
                  className="w-full flex-1 min-h-[300px] bg-slate-900 text-slate-200 p-3 rounded-xl font-mono text-[11px] border border-slate-850 outline-none focus:ring-1 focus:ring-cyan-500 leading-normal"
                />

                {validationError && (
                  <div className="p-3 bg-red-550/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-xs font-semibold leading-relaxed">
                    {validationError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Drawer Footer Actions */}
          <div className="p-4 border-t border-slate-200 dark:border-[#1e202a] bg-slate-50 dark:bg-[#0f1017] space-y-2">
            <button
              onClick={() => handleDeployNode(selectedNode)}
              disabled={selectedNode.status === 'deploying'}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-cyan-500/10 animate-all duration-200"
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
        // Placeholder Empty State
        <div className="w-96 bg-white dark:bg-[#0c0d12] border-l border-slate-200 dark:border-[#1e202a] flex flex-col justify-center items-center p-6 text-center text-slate-500 dark:text-slate-400 select-none">
          <div className="w-12 h-12 rounded-xl bg-slate-105 dark:bg-[#1a1c27] flex items-center justify-center text-slate-400 mb-3 border border-slate-200/40 dark:border-slate-800/40">
            <Code className="w-6 h-6" />
          </div>
          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">No Resource Selected</h4>
          <p className="text-[11px] mt-1 text-slate-400 leading-normal max-w-[200px]">
            Click on any Pod, Deployment, or Service on the canvas board to configure it.
          </p>
        </div>
      )}
    </div>
  );
};
