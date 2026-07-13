import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Cpu,
  Layers,
  RefreshCw,
  Trash2,
  Info,
  Sliders,
  Settings,
  Loader2,
  BookOpen,
  AlertCircle,
  Sun,
  Moon,
  CheckCircle2,
  Menu,
  PanelLeftClose,
  Network,
  Gamepad2
} from 'lucide-react';
import { DashboardTab } from './components/DashboardTab';
import { ExplorerTab } from './components/ExplorerTab';
import { TopologyDiagramTab } from './components/TopologyDiagramTab';
import { LearnTab } from './components/LearnTab';
import { SettingsTab } from './components/SettingsTab';
import { ResourceDrawer } from './components/ResourceDrawer';
import { ArenaTab } from './components/ArenaTab';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Type definitions
interface ClusterStats {
  status: string;
  node_count: number;
  pod_count: number;
  deployment_count: number;
  service_count: number;
}

interface PodResource {
  name: string;
  namespace: string;
  status: string;
  restarts: number;
  age: string;
}

interface DeploymentResource {
  name: string;
  namespace: string;
  status: string;
  replicas_desired: number;
  replicas_ready: number;
  replicas_available: number;
  age: string;
}

interface ServiceResource {
  name: string;
  namespace: string;
  type: string;
  cluster_ip: string;
  external_ip: string;
  ports: string;
  age: string;
}

interface EventData {
  type: string;
  reason: string;
  message: string;
  count: number;
  last_timestamp: string;
}

interface InvestigationResult {
  status: 'healthy' | 'degraded' | 'critical';
  root_cause: string;
  explanation: string;
  evidence: string[];
  suggested_fix: string;
  confidence: number;
  k8s_lesson: {
    concept: string;
    analogy: string;
  };
}

interface ConceptExplanation {
  concept: string;
  explanation: string;
  real_world_analogy: string;
  why_it_exists: string;
  common_gotchas: string[];
}

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

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'explorer' | 'learn' | 'settings' | 'diagram' | 'arena'>('dashboard');

  // Arena States
  const [arenaNodes, setArenaNodes] = useState<ArenaNode[]>([]);
  const [arenaConnections, setArenaConnections] = useState<ArenaConnection[]>([]);
  const [arenaSelectedNodeId, setArenaSelectedNodeId] = useState<string | null>(null);

  // Topology States
  const [topologyData, setTopologyData] = useState<{ nodes: any[], edges: any[] }>({ nodes: [], edges: [] });
  const [topologyLoading, setTopologyLoading] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [topologyFilter] = useState<string>('all');
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [customNodePositions, setCustomNodePositions] = useState<{ [id: string]: { x: number, y: number } }>({});
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const nodeDragStart = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 });
  const nodeDragDistance = useRef(0);

  // settings configuration states
  const [aiProvider, setAiProviderState] = useState<'gemini' | 'openai'>(() => {
    return (localStorage.getItem('aiProvider') as 'gemini' | 'openai') || 'gemini';
  });
  const [geminiKey, setGeminiKeyState] = useState<string>(() => {
    return localStorage.getItem('geminiKey') || '';
  });
  const [openaiKey, setOpenaiKeyState] = useState<string>(() => {
    return localStorage.getItem('openaiKey') || '';
  });
  const [customNamespaces, setCustomNamespacesState] = useState<string>(() => {
    return localStorage.getItem('customNamespaces') || 'kube-system, kube-public, kube-node-lease, local-path-storage';
  });
  const [refreshInterval, setRefreshIntervalState] = useState<number>(() => {
    return Number(localStorage.getItem('refreshInterval')) || 8;
  });

  const setAiProvider = (val: 'gemini' | 'openai') => {
    setAiProviderState(val);
    localStorage.setItem('aiProvider', val);
    // Reset default model on provider switch
    setAiModel(val === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini');
  };
  const setGeminiKey = (val: string) => {
    setGeminiKeyState(val);
    localStorage.setItem('geminiKey', val);
  };
  const setOpenaiKey = (val: string) => {
    setOpenaiKeyState(val);
    localStorage.setItem('openaiKey', val);
  };
  const setCustomNamespaces = (val: string) => {
    setCustomNamespacesState(val);
    localStorage.setItem('customNamespaces', val);
  };
  const setRefreshInterval = (val: number) => {
    setRefreshIntervalState(val);
    localStorage.setItem('refreshInterval', String(val));
  };

  // Context states
  const [contexts, setContexts] = useState<string[]>([]);
  const [activeContext, setActiveContextState] = useState<string>('');

  // AI advanced parameter states
  const [aiModel, setAiModelState] = useState<string>(() => {
    return localStorage.getItem('aiModel') || 'gemini-2.5-flash';
  });
  const [aiTemperature, setAiTemperatureState] = useState<number>(() => {
    const val = localStorage.getItem('aiTemperature');
    return val !== null ? Number(val) : 0.2;
  });
  const [mockModeForced, setMockModeForcedState] = useState<boolean>(() => {
    return localStorage.getItem('mockModeForced') === 'true';
  });

  // Logs preference states
  const [logsLineWrap, setLogsLineWrapState] = useState<boolean>(() => {
    return (localStorage.getItem('logsLineWrap') !== 'false');
  });
  const [logsShowTimestamps, setLogsShowTimestampsState] = useState<boolean>(() => {
    return (localStorage.getItem('logsShowTimestamps') === 'true');
  });
  const [logsTailLimit, setLogsTailLimitState] = useState<number>(() => {
    return Number(localStorage.getItem('logsTailLimit')) || 100;
  });

  const setAiModel = (val: string) => {
    setAiModelState(val);
    localStorage.setItem('aiModel', val);
  };
  const setAiTemperature = (val: number) => {
    setAiTemperatureState(val);
    localStorage.setItem('aiTemperature', String(val));
  };
  const setMockModeForced = (val: boolean) => {
    setMockModeForcedState(val);
    localStorage.setItem('mockModeForced', String(val));
  };
  const setLogsLineWrap = (val: boolean) => {
    setLogsLineWrapState(val);
    localStorage.setItem('logsLineWrap', String(val));
  };
  const setLogsShowTimestamps = (val: boolean) => {
    setLogsShowTimestampsState(val);
    localStorage.setItem('logsShowTimestamps', String(val));
  };
  const setLogsTailLimit = (val: number) => {
    setLogsTailLimitState(val);
    localStorage.setItem('logsTailLimit', String(val));
  };
  const getAccentColor = (type: 'text' | 'bg' | 'bgMuted' | 'border' | 'hoverText' | 'focusRing' | 'glow') => {
    switch (type) {
      case 'text': return 'text-cyan-600 dark:text-cyan-400';
      case 'bg': return 'bg-cyan-500';
      case 'bgMuted': return 'bg-cyan-500/10 dark:bg-cyan-500/5';
      case 'border': return 'border-cyan-500';
      case 'hoverText': return 'hover:text-cyan-600 dark:hover:text-cyan-400';
      case 'glow': return 'shadow-cyan-500/10';
      default: return 'focus:ring-cyan-500';
    }
  };
  const [explorerSubTab, setExplorerSubTab] = useState<'pods' | 'deployments' | 'services'>('pods');
  const [namespaceFilter, setNamespaceFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showSystemResources, setShowSystemResources] = useState<boolean>(false);

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });

  // Code View Adjustments
  const [codeFontSize, setCodeFontSize] = useState<number>(12);
  const [logsFilter, setLogsFilter] = useState<string>('');
  const [autoScrollLogs, setAutoScrollLogs] = useState<boolean>(true);

  // Drawer Resizing & Layout States
  const [detailsWidth, setDetailsWidth] = useState<number>(520);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [isDrawerMaximized, setIsDrawerMaximized] = useState<boolean>(false);

  // Sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  // Data states
  const [stats, setStats] = useState<ClusterStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [pods, setPods] = useState<PodResource[]>([]);
  const [deployments, setDeployments] = useState<DeploymentResource[]>([]);
  const [services, setServices] = useState<ServiceResource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);

  // Detail panel states
  const [selectedResource, setSelectedResource] = useState<{
    type: 'pod' | 'deployment' | 'service';
    name: string;
    namespace: string;
  } | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'logs' | 'events' | 'yaml' | 'investigate' | 'terminal'>('overview');
  const [resourceDetails, setResourceDetails] = useState<any>(null);
  const [resourceDetailsLoading, setResourceDetailsLoading] = useState(false);
  const [logsText, setLogsText] = useState<string>('');
  const [eventsList, setEventsList] = useState<EventData[]>([]);
  const [yamlText, setYamlText] = useState<string>('');



  // AI Investigation states
  const [aiInvestigating, setAiInvestigating] = useState(false);
  const [investigationStep, setInvestigationStep] = useState('');
  const [aiInvestigation, setAiInvestigation] = useState<InvestigationResult | null>(null);
  const [investigationSubTab, setInvestigationSubTab] = useState<'diagnosis' | 'fix' | 'lesson'>('diagnosis');

  // AI Learning states
  const [learnQuery, setLearnQuery] = useState('');
  const [aiLearning, setAiLearning] = useState<ConceptExplanation | null>(null);
  const [aiLearningLoading, setAiLearningLoading] = useState(false);
  const [learnSubTab, setLearnSubTab] = useState<'concept' | 'why' | 'gotchas'>('concept');

  // Operation states
  const [confirmationModal, setConfirmationModal] = useState<{
    type: 'delete' | 'restart' | 'scale';
    name: string;
    namespace: string;
    scaleValue?: number;
  } | null>(null);
  const [operationInProgress, setOperationInProgress] = useState(false);

  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const logsEndRef = useRef<HTMLPreElement>(null);

  // Handle Theme classes
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Handle details panel mouse resize drag
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 340 && newWidth <= window.innerWidth * 0.85) {
        setDetailsWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      setIsResizing(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Auto-scroll logs logic
  useEffect(() => {
    if (autoScrollLogs && logsEndRef.current && detailTab === 'logs') {
      logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight;
    }
  }, [logsText, autoScrollLogs, detailTab]);

  // Kubeconfig contexts loader and switcher
  const fetchContexts = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/kube/contexts`);
      if (res.ok) {
        const data = await res.json();
        setContexts(data.contexts || []);
        setActiveContextState(data.active_context || '');
      }
    } catch (e) {
      console.error("Failed to load kube contexts:", e);
    }
  }, []);

  const handleSwitchContext = async (contextName: string) => {
    try {
      const res = await fetch(`${API_URL}/api/kube/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: contextName })
      });
      if (res.ok) {
        setActiveContextState(contextName);
        setToast({ message: `Successfully switched to Kubernetes context: ${contextName}`, type: 'success' });
        // Trigger refresh
        fetchStats(true);
        fetchResources(true);
        fetchTopology(true);
      } else {
        const err = await res.json();
        setToast({ message: `Context switch failed: ${err.detail || 'Unknown error'}`, type: 'error' });
      }
    } catch (e) {
      console.error(e);
      setToast({ message: "Network error switching cluster context.", type: 'error' });
    }
  };

  useEffect(() => {
    fetchContexts();
  }, [fetchContexts]);

  // Load Cluster Statistics
  const fetchStats = useCallback(async (isSilent = false) => {
    if (!isSilent) setStatsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/stats`);
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (e) {
      console.error("Failed fetching stats", e);
    } finally {
      if (!isSilent) setStatsLoading(false);
    }
  }, []);

  // Load Resources List
  const fetchResources = useCallback(async (isSilent = false) => {
    if (!isSilent) setResourcesLoading(true);
    try {
      const url = namespaceFilter
        ? `${API_URL}/api/resources?namespace=${encodeURIComponent(namespaceFilter)}`
        : `${API_URL}/api/resources`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPods(data.pods || []);
        setDeployments(data.deployments || []);
        setServices(data.services || []);
      }
    } catch (e) {
      console.error("Failed fetching resources", e);
    } finally {
      if (!isSilent) setResourcesLoading(false);
    }
  }, [namespaceFilter]);

  const fetchTopology = useCallback(async (isSilent = false) => {
    if (!isSilent) setTopologyLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/kube/topology?namespace=${namespaceFilter || 'default'}`);
      if (res.ok) {
        const data = await res.json();
        setTopologyData(data);
      }
    } catch (e) {
      console.error("Failed loading topology", e);
    } finally {
      if (!isSilent) setTopologyLoading(false);
    }
  }, [namespaceFilter]);

  // Initial loading and WebSocket-based background push updates
  useEffect(() => {
    fetchStats();
    fetchResources();
    fetchTopology();

    // Setup WebSocket connection for real-time push updates
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Clean and build websocket URL
    const baseUrl = API_URL.startsWith('http') 
      ? API_URL.replace(/^http/, 'ws') 
      : `${wsProto}//${window.location.host}`;
    const wsUrl = `${baseUrl}/api/ws/updates?namespace=${namespaceFilter || 'default'}`;
    
    let ws: WebSocket;
    let reconnectTimeout: any;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.error) {
            console.error("WS updates error:", data.error);
            return;
          }
          if (data.stats) setStats(data.stats);
          if (data.resources) {
            setPods(data.resources.pods);
            setDeployments(data.resources.deployments);
            setServices(data.resources.services);
          }
          if (data.topology) setTopologyData(data.topology);
        } catch (err) {
          console.error("Error parsing WS updates data:", err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimeout);
    };
  }, [fetchStats, fetchResources, fetchTopology, namespaceFilter]);

  const getFilteredTopology = useCallback(() => {
    // Filter out ingress nodes
    const baseNodes = topologyData.nodes.filter(n => n.type !== 'ingress');
    const baseEdges = topologyData.edges.filter(edge => {
      const srcNode = topologyData.nodes.find(n => n.id === edge.source);
      const tgtNode = topologyData.nodes.find(n => n.id === edge.target);
      return srcNode?.type !== 'ingress' && tgtNode?.type !== 'ingress';
    });

    if (!topologyFilter || topologyFilter === 'all') {
      return { nodes: baseNodes, edges: baseEdges };
    }

    const keptNodeIds = new Set<string>([topologyFilter]);
    
    // Pass 1: Direct connections
    baseEdges.forEach(edge => {
      if (edge.source === topologyFilter) {
        keptNodeIds.add(edge.target);
      }
      if (edge.target === topologyFilter) {
        keptNodeIds.add(edge.source);
      }
    });

    // Pass 2: Manage transitions (e.g. Service -> Pod -> Deployment)
    baseEdges.forEach(edge => {
      if (keptNodeIds.has(edge.target) && edge.relation === 'manages') {
        keptNodeIds.add(edge.source);
      }
      if (keptNodeIds.has(edge.source) && edge.relation === 'manages') {
        keptNodeIds.add(edge.target);
      }
    });

    const filteredNodes = baseNodes.filter(node => keptNodeIds.has(node.id));
    const filteredEdges = baseEdges.filter(edge => 
      keptNodeIds.has(edge.source) && keptNodeIds.has(edge.target)
    );

    return { nodes: filteredNodes, edges: filteredEdges };
  }, [topologyData, topologyFilter]);

  const isNodeConnected = useCallback((nodeId: string) => {
    if (!hoveredNodeId) return true;
    if (nodeId === hoveredNodeId) return true;
    const { edges } = getFilteredTopology();
    return edges.some(edge => 
      (edge.source === hoveredNodeId && edge.target === nodeId) ||
      (edge.target === hoveredNodeId && edge.source === nodeId)
    );
  }, [hoveredNodeId, getFilteredTopology]);



  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string, initialX: number, initialY: number) => {
    e.stopPropagation();
    setDraggedNodeId(nodeId);
    nodeDragDistance.current = 0;
    nodeDragStart.current = {
      x: e.clientX,
      y: e.clientY,
      nodeX: customNodePositions[nodeId]?.x ?? initialX,
      nodeY: customNodePositions[nodeId]?.y ?? initialY,
      lastX: e.clientX,
      lastY: e.clientY
    } as any;
  }, [customNodePositions]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.interactive-card') || target.closest('button') || target.closest('select')) {
      return;
    }
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX - panOffset.x,
      y: e.clientY - panOffset.y
    };
  }, [panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggedNodeId) {
      const dx = (e.clientX - nodeDragStart.current.x) / zoomScale;
      const dy = (e.clientY - nodeDragStart.current.y) / zoomScale;
      const lastX = (nodeDragStart.current as any).lastX ?? e.clientX;
      const lastY = (nodeDragStart.current as any).lastY ?? e.clientY;
      nodeDragDistance.current += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY);
      (nodeDragStart.current as any).lastX = e.clientX;
      (nodeDragStart.current as any).lastY = e.clientY;
      
      setCustomNodePositions(prev => ({
        ...prev,
        [draggedNodeId]: {
          x: nodeDragStart.current.nodeX + dx,
          y: nodeDragStart.current.nodeY + dy
        }
      }));
    } else if (isDragging) {
      setPanOffset({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    }
  }, [isDragging, draggedNodeId, zoomScale]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedNodeId(null);
  }, []);

  // Fetch drawer details depending on active sub-tab
  const fetchResourceDetails = useCallback(async () => {
    if (!selectedResource) return;
    setResourceDetailsLoading(true);
    const { type, name, namespace } = selectedResource;

    setAiInvestigation(null);
    setAiInvestigating(false);
    setInvestigationSubTab('diagnosis');

    const baseUrl = `${API_URL}/api/${type}/${namespace}/${name}`;

    try {
      const [specRes, eventsRes, yamlRes, logsRes] = await Promise.all([
        fetch(`${baseUrl}/details`),
        fetch(`${baseUrl}/events`),
        fetch(`${baseUrl}/yaml`),
        fetch(`${baseUrl}/logs?tail=${logsTailLimit}&timestamps=${logsShowTimestamps}`),
      ]);

      if (specRes.ok) setResourceDetails(await specRes.json());
      if (eventsRes.ok) setEventsList(await eventsRes.json());
      if (yamlRes.ok) { const yData = await yamlRes.json(); setYamlText(yData.yaml || ''); }
      if (logsRes.ok) { const lData = await logsRes.json(); setLogsText(lData.logs || ''); }
      else setLogsText(`Failed loading logs for ${type}.`);
    } catch (e) {
      console.error(e);
    } finally {
      setResourceDetailsLoading(false);
    }
  }, [selectedResource, logsTailLimit, logsShowTimestamps]);

  useEffect(() => {
    fetchResourceDetails();
  }, [selectedResource, fetchResourceDetails]);



  // AI Diagnostic triggers
  const runInvestigation = async () => {
    if (!selectedResource) return;
    setAiInvestigating(true);
    setAiInvestigation(null);
    setInvestigationSubTab('diagnosis');

    const steps = [
      'Scanning container status codes...',
      'Retrieving Pod manifest attributes...',
      'Analyzing recent Kubernetes events stream...',
      'Parsing container crash logs...',
      'Consulting DevOps AI knowledge base...'
    ];

    let currentStep = 0;
    setInvestigationStep(steps[0]);
    const stepInterval = setInterval(() => {
      currentStep++;
      if (currentStep < steps.length) {
        setInvestigationStep(steps[currentStep]);
      }
    }, 1200);

    try {
      const { type, name, namespace } = selectedResource;
      const provider = mockModeForced ? 'mock' : aiProvider;
      const key = provider === 'gemini' ? geminiKey : openaiKey;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (provider) headers['X-AI-Provider'] = provider;
      if (key) headers['X-AI-Key'] = key;
      if (aiModel) headers['X-AI-Model'] = aiModel;
      if (aiTemperature !== undefined) headers['X-AI-Temperature'] = String(aiTemperature);

      const res = await fetch(`${API_URL}/api/investigate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ type, name, namespace })
      });
      clearInterval(stepInterval);
      if (res.ok) {
        setAiInvestigation(await res.json());
      } else {
        const err = await res.json();
        setToast({ message: `Diagnostic failed: ${err.detail || 'Unknown server error'}`, type: 'error' });
      }
    } catch (e) {
      console.error(e);
      setToast({ message: 'Network failure reaching AI diagnostic server.', type: 'error' });
    } finally {
      clearInterval(stepInterval);
      setAiInvestigating(false);
    }
  };

  // Kubernetes operations executors
  const executeOperation = async () => {
    if (!confirmationModal) return;
    setOperationInProgress(true);
    const { type, name, namespace, scaleValue } = confirmationModal;

    try {
      const endpoint = type === 'scale'
        ? `${API_URL}/api/operations/scale`
        : type === 'restart'
          ? `${API_URL}/api/operations/restart`
          : `${API_URL}/api/operations/delete`;

      const body: any = {
        namespace,
        name
      };
      if (type === 'scale' && scaleValue !== undefined) {
        body.replicas = scaleValue;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const data = await res.json();
        setToast({ message: data.message || "Operation completed successfully!", type: "success" });
        setConfirmationModal(null);
        fetchResources();
        fetchStats();
        if (type === 'delete' && selectedResource?.name === name) {
          setSelectedResource(null);
        }
      } else {
        const err = await res.json();
        setToast({ message: `Operation failed: ${err.detail || 'Unknown error'}`, type: 'error' });
      }
    } catch (e) {
      console.error(e);
      setToast({ message: "Network error executing operation.", type: 'error' });
    } finally {
      setOperationInProgress(false);
    }
  };

  // AI Concept explanation trigger
  const handleLearnQuery = async (queryStr: string) => {
    const q = queryStr || learnQuery;
    if (!q.trim()) return;
    setAiLearningLoading(true);
    setAiLearning(null);
    setLearnSubTab('concept');
    try {
      const provider = mockModeForced ? 'mock' : aiProvider;
      const key = provider === 'gemini' ? geminiKey : openaiKey;
      const headers: Record<string, string> = {};
      if (provider) headers['X-AI-Provider'] = provider;
      if (key) headers['X-AI-Key'] = key;
      if (aiModel) headers['X-AI-Model'] = aiModel;
      if (aiTemperature !== undefined) headers['X-AI-Temperature'] = String(aiTemperature);

      const res = await fetch(`${API_URL}/api/learn?concept=${encodeURIComponent(q)}`, {
        headers
      });
      if (res.ok) {
        setAiLearning(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiLearningLoading(false);
    }
  };

  // Status badges helper
  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('run') || s === 'ready' || s === 'completed' || s.includes('active')) {
      return 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40';
    }
    if (s.includes('backoff') || s.includes('fail') || s.includes('error') || s.includes('unhealthy')) {
      return 'bg-red-50/80 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/40';
    }
    if (s.includes('pend') || s.includes('progress') || s.includes('terminat') || s.includes('creat')) {
      return 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40';
    }
    return 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800';
  };

  // System namespaces that should be hidden from beginners by default
  const isSystemNamespace = (ns: string) => {
    const list = customNamespaces.split(',').map(s => s.trim().toLowerCase());
    return list.includes(ns.toLowerCase());
  };

  // Filter resources by search and namespace
  const filteredPods = pods.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSystem = showSystemResources || !isSystemNamespace(p.namespace);
    return matchesSearch && matchesSystem;
  });

  const filteredDeployments = deployments.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSystem = showSystemResources || !isSystemNamespace(d.namespace);
    return matchesSearch && matchesSystem;
  });

  const filteredServices = services.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSystem = showSystemResources || !isSystemNamespace(s.namespace);
    return matchesSearch && matchesSystem;
  });

  // Client-side resource relations mapper (traced dynamically in explorer)
  const getRelatedResources = () => {
    if (!selectedResource || !resourceDetails) return [];
    const related: { type: 'pod' | 'deployment' | 'service'; name: string; namespace: string; description: string }[] = [];
    const ns = selectedResource.namespace;

    if (selectedResource.type === 'pod') {
      const podLabels = resourceDetails.metadata?.labels || {};
      const podName = selectedResource.name;

      const parentDeploy = deployments.find(d => d.namespace === ns && podName.startsWith(d.name));
      if (parentDeploy) {
        related.push({
          type: 'deployment',
          name: parentDeploy.name,
          namespace: parentDeploy.namespace,
          description: 'Parent Controller'
        });
      }

      services.forEach(s => {
        if (s.namespace === ns) {
          const appLabel = podLabels['app'] || podLabels['run'] || podLabels['app.kubernetes.io/name'];
          if (appLabel && s.name.includes(appLabel)) {
            related.push({
              type: 'service',
              name: s.name,
              namespace: s.namespace,
              description: 'Routing Service'
            });
          }
        }
      });
    } else if (selectedResource.type === 'deployment') {
      pods.forEach(p => {
        if (p.namespace === ns && p.name.startsWith(selectedResource.name)) {
          related.push({
            type: 'pod',
            name: p.name,
            namespace: p.namespace,
            description: 'Managed Pod replica'
          });
        }
      });
    }
    return related;
  };

  const relatedList = getRelatedResources();





  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0b0e14] text-slate-800 dark:text-slate-100 overflow-hidden transition-colors duration-150">

      {/* Sidebar NAVIGATION */}
      <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} bg-slate-100 dark:bg-[#0d1018] border-r border-slate-200 dark:border-[#1e2235] flex flex-col justify-between select-none transition-all duration-200`}>
        {sidebarCollapsed ? (
          /* SLIM SIDEBAR (Discord style icon strip) */
          <div className="flex flex-col justify-between h-full py-6 items-center">
            <div className="flex flex-col items-center space-y-6 w-full">
              {/* Logo Brand Icon */}
              <div
                onClick={() => {
                  setActiveTab('dashboard');
                  setSelectedResource(null);
                }}
                className="w-10 h-10 rounded-lg bg-cyan-600 flex items-center justify-center font-bold text-lg text-white cursor-pointer hover:bg-cyan-500 transition"
                title="Podex - Go to Dashboard"
              >
                P
              </div>

              {/* Nav List Icons */}
              <nav className="flex flex-col items-center space-y-4 w-full px-2">
                {[
                  { id: 'dashboard', label: 'Overview Dashboard', icon: Cpu },
                  { id: 'explorer', label: 'Cluster Explorer', icon: Layers },
                  { id: 'diagram', label: 'Cluster Topology', icon: Network },
                  { id: 'arena', label: 'Arena Playground', icon: Gamepad2 },
                  { id: 'learn', label: 'AI Concepts Tutor', icon: BookOpen }
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id as any);
                        setSelectedResource(null);
                      }}
                      title={tab.label}
                      className={`w-12 h-12 flex items-center justify-center rounded-xl transition cursor-pointer relative group ${isActive
                          ? `${getAccentColor('bgMuted')} ${getAccentColor('text')} border-l-4 ${getAccentColor('border')}`
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-[#24233f] hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? getAccentColor('text') : 'text-slate-400'}`} />
                      
                      {/* Tooltip */}
                      <div className="absolute left-16 bg-slate-900 text-white text-[10px] font-bold px-2 py-1.5 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition whitespace-nowrap shadow-md z-30">
                        {tab.label}
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Footer Utilities */}
            <div className="flex flex-col items-center space-y-4 w-full">
              {/* Settings button */}
              <button
                onClick={() => {
                  setActiveTab('settings');
                  setSelectedResource(null);
                }}
                className={`w-12 h-12 flex items-center justify-center rounded-xl transition cursor-pointer relative group ${activeTab === 'settings'
                    ? `${getAccentColor('bgMuted')} ${getAccentColor('text')} border-l-4 ${getAccentColor('border')}`
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-[#24233f] hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                title="Settings"
              >
                <Settings className={`w-5 h-5 ${activeTab === 'settings' ? getAccentColor('text') : 'text-slate-400'}`} />
                <div className="absolute left-16 bg-slate-900 text-white text-[10px] font-bold px-2 py-1.5 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition whitespace-nowrap shadow-md z-30">
                  Settings
                </div>
              </button>

              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg bg-slate-200 dark:bg-[#2a294a] hover:bg-slate-300 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                title="Toggle Light/Dark Theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Expand Button */}
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-[#2a294a] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                title="Expand Sidebar"
              >
                <Menu className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* FULL SIDEBAR */
          <div className="flex flex-col justify-between h-full">
            <div>
              {/* Logo Brand */}
              <div className="p-6 flex items-center justify-between border-b border-slate-200 dark:border-[#2d2c50]">
                <div
                  onClick={() => {
                    setActiveTab('dashboard');
                    setSelectedResource(null);
                  }}
                  className="flex items-center space-x-3 cursor-pointer hover:opacity-90 active:scale-95 transition"
                  title="Go to Dashboard"
                >
                   <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center font-bold text-lg text-white">
                    P
                  </div>
                  <div>
                    <h1 className="text-sm font-extrabold text-slate-800 dark:text-cyan-400 m-0 tracking-wide">PODEX</h1>
                    <span className="text-[10px] text-slate-500 dark:text-slate-500 font-bold tracking-wider block">K8S FOR BEGINNERS</span>
                  </div>
                </div>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#2a294a] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                  title="Hide Sidebar"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              </div>

              {/* Nav List */}
              <nav className="p-4 space-y-1.5">
                {[
                  { id: 'dashboard', label: 'Overview Dashboard', icon: Cpu },
                  { id: 'explorer', label: 'Cluster Explorer', icon: Layers },
                  { id: 'diagram', label: 'Cluster Topology', icon: Network },
                  { id: 'arena', label: 'Arena Playground', icon: Gamepad2 },
                  { id: 'learn', label: 'AI Concepts Tutor', icon: BookOpen }
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id as any);
                        setSelectedResource(null);
                      }}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left text-xs font-bold transition cursor-pointer ${isActive
                        ? `${getAccentColor('bgMuted')} ${getAccentColor('text')} border-l-4 ${getAccentColor('border')}`
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-[#24233f] hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? getAccentColor('text') : 'text-slate-400'}`} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar Footer */}
            <div className="p-6 border-t border-slate-200 dark:border-[#2d2c50] space-y-3">
              {/* Settings button */}
              <button
                onClick={() => {
                  setActiveTab('settings');
                  setSelectedResource(null);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-left text-xs font-bold transition cursor-pointer ${activeTab === 'settings'
                    ? `${getAccentColor('bgMuted')} ${getAccentColor('text')} border-l-4 ${getAccentColor('border')}`
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-[#24233f] hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
              >
                <Settings className={`w-4 h-4 ${activeTab === 'settings' ? getAccentColor('text') : 'text-slate-400'}`} />
                <span>Settings</span>
              </button>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50 dark:border-[#2d2c50]/50">
                <span className="text-slate-500 font-bold">Theme Mode</span>
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-1.5 rounded-lg bg-slate-200 dark:bg-[#2a294a] hover:bg-slate-300 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                  title="Toggle Light/Dark Theme"
                >
                  {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="bg-slate-200/50 dark:bg-[#151824] p-3.5 rounded-lg border border-slate-300/40 dark:border-[#1e2235]">
                <span className="text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-widest block font-bold mb-1">
                  Active Connection
                </span>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block truncate">
                  {stats?.status === 'healthy' ? 'kind-podex' : 'Connecting...'}
                </span>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main Workspace Frame */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-[#0b0e14]">

        {/* Top Header Workspace */}
        <header className="h-16 border-b border-slate-200 dark:border-[#1e2235] flex items-center justify-between px-8 bg-white dark:bg-[#10131c]">
          <div className="flex items-center space-x-4">
            {/* Sidebar toggle button (only shown when collapsed to expand it) */}
            {sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#24233f] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                title="Show Sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 capitalize m-0 tracking-wide">
              {activeTab} Space
            </h2>

            {/* Namespace Filter for Explorer */}
            {activeTab === 'explorer' && (
              <div className="flex items-center bg-slate-100 dark:bg-[#1e1d38] border border-slate-200 dark:border-[#2d2c50] rounded-xl px-3 py-1">
                <Sliders className="w-3.5 h-3.5 text-slate-400 mr-2" />
                <span className="text-[11px] text-slate-500 dark:text-slate-500 mr-2 font-bold">Namespace:</span>
                <input
                  type="text"
                  placeholder="all / default / etc."
                  value={namespaceFilter}
                  onChange={(e) => setNamespaceFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-700 dark:text-slate-200 border-none outline-none focus:ring-0 p-0 w-24 font-bold"
                />
              </div>
            )}

            {/* Show System Resources Toggle */}
            {(activeTab === 'explorer' || activeTab === 'dashboard') && (
              <label className="flex items-center space-x-2 bg-slate-100 dark:bg-[#1e1d38] border border-slate-200 dark:border-[#2d2c50] rounded-xl px-3 py-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showSystemResources}
                  onChange={(e) => setShowSystemResources(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-cyan-500 bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-[#2d2c50] focus:ring-0 cursor-pointer"
                />
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Show System</span>
              </label>
            )}
          </div>

          <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400 font-bold">
            <span>Kind Cluster Dev</span>
              <span className={`w-2 h-2 rounded-full ${stats?.status === 'healthy' ? 'bg-cyan-500' : 'bg-amber-400'}`} />
          </div>
        </header>

        {/* Dynamic Views Content */}
        <div className="flex-1 overflow-y-auto p-8">

          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <DashboardTab
              stats={stats}
              statsLoading={statsLoading}
              filteredPods={filteredPods}
              showSystemResources={showSystemResources}
              filteredDeployments={filteredDeployments}
              filteredServices={filteredServices}
              setLearnQuery={setLearnQuery}
              setActiveTab={setActiveTab}
              handleLearnQuery={handleLearnQuery}
              setSelectedResource={setSelectedResource}
              setDetailTab={setDetailTab}
            />
          )}

          {/* TAB 2: EXPLORER */}
          {activeTab === 'explorer' && (
            <ExplorerTab
              explorerSubTab={explorerSubTab}
              setExplorerSubTab={setExplorerSubTab}
              filteredPods={filteredPods}
              filteredDeployments={filteredDeployments}
              filteredServices={filteredServices}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              resourcesLoading={resourcesLoading}
              selectedResource={selectedResource}
              setSelectedResource={setSelectedResource}
              setDetailTab={setDetailTab}
              getStatusColor={getStatusColor}
              apiUrl={API_URL}
              onRefresh={fetchResources}
              setToast={setToast}
            />
          )}

          {/* TAB 3: LEARN TEACHER */}
          {activeTab === 'learn' && (
            <LearnTab
              learnQuery={learnQuery}
              setLearnQuery={setLearnQuery}
              handleLearnQuery={handleLearnQuery}
              aiLearningLoading={aiLearningLoading}
              aiLearning={aiLearning}
              learnSubTab={learnSubTab}
              setLearnSubTab={setLearnSubTab}
            />
          )}

          {/* TAB: TOPOLOGY DIAGRAM */}
          {activeTab === 'diagram' && (
            <TopologyDiagramTab
              filteredTopology={getFilteredTopology()}
              topologyLoading={topologyLoading}
              topologyData={topologyData}
              namespaceFilter={namespaceFilter}
              zoomScale={zoomScale}
              setZoomScale={setZoomScale}
              panOffset={panOffset}
              setPanOffset={setPanOffset}
              handleMouseDown={handleMouseDown}
              handleMouseMove={handleMouseMove}
              handleMouseUp={handleMouseUp}
              handleNodeMouseDown={handleNodeMouseDown}
              customNodePositions={customNodePositions}
              isNodeConnected={isNodeConnected}
              setHoveredNodeId={setHoveredNodeId}
              hoveredNodeId={hoveredNodeId}
              nodeDragDistance={nodeDragDistance}
              setSelectedResource={setSelectedResource}
              setDetailTab={setDetailTab}
              getAccentColor={getAccentColor}
            />
          )}

          {/* TAB: ARENA PLAYGROUND */}
          {activeTab === 'arena' && (
            <ArenaTab
              apiUrl={API_URL}
              nodes={arenaNodes}
              setNodes={setArenaNodes}
              connections={arenaConnections}
              setConnections={setArenaConnections}
              selectedNodeId={arenaSelectedNodeId}
              setSelectedNodeId={setArenaSelectedNodeId}
              setToast={setToast}
            />
          )}
          {/* TAB 4: SETTINGS */}
          {activeTab === 'settings' && (
            <SettingsTab
              contexts={contexts}
              activeContext={activeContext}
              handleSwitchContext={handleSwitchContext}
              aiProvider={aiProvider}
              setAiProvider={setAiProvider}
              mockModeForced={mockModeForced}
              setMockModeForced={setMockModeForced}
              geminiKey={geminiKey}
              setGeminiKey={setGeminiKey}
              aiModel={aiModel}
              setAiModel={setAiModel}
              openaiKey={openaiKey}
              setOpenaiKey={setOpenaiKey}
              aiTemperature={aiTemperature}
              setAiTemperature={setAiTemperature}
              logsLineWrap={logsLineWrap}
              setLogsLineWrap={setLogsLineWrap}
              logsShowTimestamps={logsShowTimestamps}
              setLogsShowTimestamps={setLogsShowTimestamps}
              logsTailLimit={logsTailLimit}
              setLogsTailLimit={setLogsTailLimit}
              customNamespaces={customNamespaces}
              setCustomNamespaces={setCustomNamespaces}
              refreshInterval={refreshInterval}
              setRefreshInterval={setRefreshInterval}
            />
          )}
        </div>
      </main>

      {/* RESOURCE DETAILS Slide-Over Panel */}
      <ResourceDrawer
        selectedResource={selectedResource}
        setSelectedResource={setSelectedResource}
        isDrawerMaximized={isDrawerMaximized}
        setIsDrawerMaximized={setIsDrawerMaximized}
        detailsWidth={detailsWidth}
        handleResizeMouseDown={handleResizeMouseDown}
        setConfirmationModal={setConfirmationModal}
        detailTab={detailTab}
        setDetailTab={setDetailTab}
        resourceDetailsLoading={resourceDetailsLoading}
        resourceDetails={resourceDetails}
        apiUrl={API_URL}
        relatedList={relatedList}
        logsFilter={logsFilter}
        setLogsFilter={setLogsFilter}
        autoScrollLogs={autoScrollLogs}
        setAutoScrollLogs={setAutoScrollLogs}
        codeFontSize={codeFontSize}
        setCodeFontSize={setCodeFontSize}
        logsLineWrap={logsLineWrap}
        logsText={logsText}
        logsEndRef={logsEndRef}
        eventsList={eventsList}
        yamlText={yamlText}
        aiInvestigating={aiInvestigating}
        aiInvestigation={aiInvestigation}
        investigationStep={investigationStep}
        runInvestigation={runInvestigation}
        investigationSubTab={investigationSubTab}
        setInvestigationSubTab={setInvestigationSubTab}
        setToast={setToast}
      />

      {/* CONFIRMATION / EDUCATION MODAL FRAME */}
      {confirmationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 select-none p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#151824] border border-slate-200 dark:border-[#1e2235] rounded-2xl p-6 space-y-6 shadow-lg">

            {/* Modal Header */}
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${confirmationModal.type === 'delete'
                ? 'bg-red-50 dark:bg-red-950/50 text-red-500'
                : confirmationModal.type === 'restart'
                  ? 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-500'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-500'
                }`}>
                {confirmationModal.type === 'delete' ? (
                  <Trash2 className="w-5 h-5" />
                ) : confirmationModal.type === 'restart' ? (
                  <RefreshCw className="w-5 h-5" />
                ) : (
                  <Sliders className="w-5 h-5" />
                )}
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-100 capitalize m-0">
                  {confirmationModal.type} {selectedResource?.type}
                </h4>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-0.5 block">Action Confirmation</span>
              </div>
            </div>

            {/* Educational content - What Kubernetes does behind the scenes */}
            <div className="bg-slate-50 dark:bg-[#1e1d38] border border-slate-200 dark:border-slate-800 p-4.5 rounded-2xl text-xs leading-relaxed space-y-2">
              <span className="font-bold text-[10px] text-cyan-600 dark:text-cyan-400 uppercase tracking-widest block">
                Behind The Scenes (Kubernetes Lifecycle)
              </span>
              {confirmationModal.type === 'delete' && (
                <p className="text-slate-500 dark:text-slate-300 m-0 font-bold">
                  When you delete a Pod, Kubernetes sends a <code className="font-mono text-amber-500 bg-slate-100 dark:bg-slate-800 px-1 rounded">SIGTERM</code> signal to let containers shut down gracefully (defaulting to 30 seconds). Then it runs <code className="font-mono text-red-500 bg-slate-100 dark:bg-slate-800 px-1 rounded">SIGKILL</code> to remove it. Since Pods are usually managed by Deployments, **a new Pod instance will be spun up automatically** to replace it.
                </p>
              )}
              {confirmationModal.type === 'restart' && (
                <p className="text-slate-500 dark:text-slate-300 m-0 font-bold">
                  Restarting a Deployment triggers a Rolling Update. Kubernetes spins up a new pod replica first, waits for it to become ready, and then kills the old replica. This guarantees zero downtime for your web applications.
                </p>
              )}
              {confirmationModal.type === 'scale' && (
                <p className="text-slate-500 dark:text-slate-300 m-0 font-bold">
                  Scaling tells the Controller Manager to adjust the number of active Pod replicas. Scaling up starts new pods matching your specs; scaling down gracefully terminates excess replicas using a descending rank list.
                </p>
              )}
            </div>

            {/* Inputs if Scale */}
            {confirmationModal.type === 'scale' && (
              <div className="space-y-2 text-xs">
                <label className="font-bold text-slate-500 dark:text-slate-400 block">Target Replica Count:</label>
                <div className="flex items-center space-x-3 bg-slate-50 dark:bg-[#1e1d38] border border-slate-200 dark:border-[#2d2c50] rounded-xl p-2 max-w-[140px] select-none">
                  <button
                    onClick={() => setConfirmationModal({
                      ...confirmationModal,
                      scaleValue: Math.max(0, (confirmationModal.scaleValue ?? 1) - 1)
                    })}
                    className="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-sm flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100 flex-grow text-center">
                    {confirmationModal.scaleValue ?? 1}
                  </span>
                  <button
                    onClick={() => setConfirmationModal({
                      ...confirmationModal,
                      scaleValue: Math.min(20, (confirmationModal.scaleValue ?? 1) + 1)
                    })}
                    className="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-black text-sm flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Target warning */}
            <p className="text-xs text-slate-500 font-bold leading-relaxed">
              Target resource: <span className="font-bold text-slate-700 dark:text-slate-300 font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{confirmationModal.namespace}/{confirmationModal.name}</span>. Are you sure you want to execute this change?
            </p>

            {/* Modal Actions */}
            <div className="flex justify-end items-center space-x-3 border-t border-slate-200 dark:border-[#2d2c50] pt-4">
              <button
                onClick={() => setConfirmationModal(null)}
                disabled={operationInProgress}
                className="px-4.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2d2c50] hover:bg-slate-100 dark:hover:bg-[#24233f] text-slate-600 dark:text-slate-300 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeOperation}
                disabled={operationInProgress}
                className={`px-4.5 py-2.5 rounded-xl text-white text-xs font-bold hover:shadow-md transition disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer ${confirmationModal.type === 'delete'
                  ? 'bg-red-500 hover:bg-red-600 hover:shadow-red-500/10'
                  : confirmationModal.type === 'restart'
                    ? 'bg-cyan-500 hover:bg-cyan-600 hover:shadow-cyan-500/10'
                    : 'bg-amber-500 hover:bg-amber-600 hover:shadow-amber-500/10'
                  }`}
              >
                {operationInProgress && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Execute Action</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-3 px-4.5 py-3 rounded-2xl border shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300 backdrop-blur-md bg-white/90 dark:bg-[#1a1932]/90 border-slate-200 dark:border-[#2d2c50]">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          ) : toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-cyan-500 shrink-0" />
          )}
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{toast.message}</span>
        </div>
      )}

    </div>
  );
}
