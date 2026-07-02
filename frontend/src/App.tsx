import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity,
  Terminal,
  Cpu,
  Layers,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Search,
  HelpCircle,
  Info,
  X,
  Sliders,
  Loader2,
  BookOpen,
  ArrowRight,
  AlertCircle,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertOctagon,
  Link2
} from 'lucide-react';

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

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'explorer' | 'learn'>('dashboard');
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
  const [detailTab, setDetailTab] = useState<'overview' | 'logs' | 'events' | 'yaml' | 'investigate'>('overview');
  const [resourceDetails, setResourceDetails] = useState<any>(null);
  const [resourceDetailsLoading, setResourceDetailsLoading] = useState(false);
  const [logsText, setLogsText] = useState<string>('');
  const [eventsList, setEventsList] = useState<EventData[]>([]);
  const [yamlText, setYamlText] = useState<string>('');

  // AI Investigation states
  const [aiInvestigating, setAiInvestigating] = useState(false);
  const [investigationStep, setInvestigationStep] = useState('');
  const [aiInvestigation, setAiInvestigation] = useState<InvestigationResult | null>(null);

  // AI Learning states
  const [learnQuery, setLearnQuery] = useState('');
  const [aiLearning, setAiLearning] = useState<ConceptExplanation | null>(null);
  const [aiLearningLoading, setAiLearningLoading] = useState(false);

  // Operation states
  const [confirmationModal, setConfirmationModal] = useState<{
    type: 'delete' | 'restart' | 'scale';
    name: string;
    namespace: string;
    scaleValue?: number;
  } | null>(null);
  const [operationInProgress, setOperationInProgress] = useState(false);

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

  // Initial loading and background poll
  useEffect(() => {
    fetchStats();
    fetchResources();

    const interval = setInterval(() => {
      fetchStats(true);
      fetchResources(true);
    }, 8000);

    return () => clearInterval(interval);
  }, [fetchStats, fetchResources]);

  // Fetch drawer details depending on active sub-tab
  const fetchResourceDetails = useCallback(async () => {
    if (!selectedResource) return;
    setResourceDetailsLoading(true);
    const { type, name, namespace } = selectedResource;
    
    try {
      // 1. Fetch metadata overview JSON
      const specRes = await fetch(`${API_URL}/api/resources/${type}/${namespace}/${name}`);
      if (specRes.ok) {
        setResourceDetails(await specRes.json());
      }

      // 2. Fetch Events
      const eventsRes = await fetch(`${API_URL}/api/resources/${type}/${namespace}/${name}/events`);
      if (eventsRes.ok) {
        setEventsList(await eventsRes.json());
      }

      // 3. Fetch YAML Config
      const yamlRes = await fetch(`${API_URL}/api/${type}/${namespace}/${name}/yaml`);
      if (yamlRes.ok) {
        const yData = await yamlRes.json();
        setYamlText(yData.yaml || '');
      }

      // 4. Fetch Logs if it's a pod
      if (type === 'pod') {
        const logsRes = await fetch(`${API_URL}/api/pods/${namespace}/${name}/logs`);
        if (logsRes.ok) {
          const lData = await logsRes.json();
          setLogsText(lData.logs || '');
        } else {
          setLogsText('Failed loading logs from container.');
        }
      } else {
        setLogsText('');
      }

      // Reset AI states when switching resources
      setAiInvestigation(null);
      setAiInvestigating(false);
    } catch (e) {
      console.error(e);
    } finally {
      setResourceDetailsLoading(false);
    }
  }, [selectedResource]);

  useEffect(() => {
    fetchResourceDetails();
  }, [selectedResource, fetchResourceDetails]);

  // AI Diagnostic triggers
  const runInvestigation = async () => {
    if (!selectedResource) return;
    setAiInvestigating(true);
    setAiInvestigation(null);
    
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
      const res = await fetch(`${API_URL}/api/investigate/${type}/${namespace}/${name}`);
      clearInterval(stepInterval);
      if (res.ok) {
        setAiInvestigation(await res.json());
      } else {
        const err = await res.json();
        alert(`Diagnostic failed: ${err.detail || 'Unknown server error'}`);
      }
    } catch (e) {
      console.error(e);
      alert('Network failure reaching AI diagnostic server.');
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
      const body: any = {
        type,
        resource_type: selectedResource?.type || 'pod',
        name,
        namespace
      };
      if (type === 'scale' && scaleValue !== undefined) {
        body.replicas = scaleValue;
      }

      const res = await fetch(`${API_URL}/api/operations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setConfirmationModal(null);
        fetchResources();
        fetchStats();
        if (type === 'delete' && selectedResource?.name === name) {
          setSelectedResource(null);
        }
      } else {
        const err = await res.json();
        alert(`Operation failed: ${err.detail || 'Unknown error'}`);
      }
    } catch (e) {
      console.error(e);
      alert("Network error executing operation.");
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
    try {
      const res = await fetch(`${API_URL}/api/learn?concept=${encodeURIComponent(q)}`);
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
      return 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-450 border border-emerald-250 dark:border-emerald-900/40';
    }
    if (s.includes('backoff') || s.includes('fail') || s.includes('error') || s.includes('unhealthy')) {
      return 'bg-red-50/80 dark:bg-red-950/40 text-red-700 dark:text-red-450 border border-red-250 dark:border-red-900/40';
    }
    if (s.includes('pend') || s.includes('progress') || s.includes('terminat') || s.includes('creat')) {
      return 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-450 border border-amber-250 dark:border-amber-900/40';
    }
    return 'bg-slate-50 dark:bg-slate-900 text-slate-650 dark:text-slate-400 border border-slate-200 dark:border-slate-800';
  };

  // System namespaces that should be hidden from beginners by default
  const SYSTEM_NAMESPACES = ['kube-system', 'kube-public', 'kube-node-lease', 'local-path-storage'];
  const isSystemNamespace = (ns: string) => SYSTEM_NAMESPACES.includes(ns.toLowerCase());

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

  // Metrics for Circular Health Donut
  const runningPodsCount = filteredPods.filter(p => {
    const s = p.status.toLowerCase();
    return s.includes('run') || s === 'completed' || s === 'ready';
  }).length;
  const totalPodsCount = filteredPods.length;
  const healthPercentage = totalPodsCount > 0 ? Math.round((runningPodsCount / totalPodsCount) * 100) : 100;
  
  // SVG properties for Donut Chart
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (healthPercentage / 100) * circumference;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#07080b] text-slate-800 dark:text-slate-100 overflow-hidden transition-colors duration-200">
      
      {/* Sidebar NAVIGATION */}
      <aside className="w-64 bg-slate-100 dark:bg-[#0d0e12] border-r border-slate-200 dark:border-[#1e202a] flex flex-col justify-between select-none">
        <div>
          {/* Logo Brand */}
          <div className="p-6 flex items-center space-x-3 border-b border-slate-200 dark:border-[#1e202a]">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-md shadow-cyan-500/10">
              P
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-slate-800 dark:text-white m-0 tracking-wide">PODEX</h1>
              <span className="text-[10px] text-slate-500 dark:text-slate-500 font-bold tracking-wider block">K8S AI MENTOR</span>
            </div>
          </div>

          {/* Nav List */}
          <nav className="p-4 space-y-1.5">
            {[
              { id: 'dashboard', label: 'Overview Dashboard', icon: Cpu },
              { id: 'explorer', label: 'Cluster Explorer', icon: Layers },
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
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left text-xs font-bold transition cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500/10 dark:bg-cyan-500/5 text-cyan-600 dark:text-cyan-400 border-l-4 border-cyan-500'
                      : 'text-slate-650 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-[#12141a] hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-500' : 'text-slate-405'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-[#1e202a] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-bold">Theme Mode</span>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 rounded-lg bg-slate-205 dark:bg-[#1a1c25] hover:bg-slate-300 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title="Toggle Light/Dark Theme"
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="bg-slate-200/50 dark:bg-[#111319] p-3.5 rounded-xl border border-slate-350/40 dark:border-slate-800/60">
            <span className="text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-widest block font-bold mb-1">
              Active Connection
            </span>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block truncate">
              {stats?.status === 'healthy' ? 'kind-podex' : 'Connecting...'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-[#07080b]">
        
        {/* Top Header Workspace */}
        <header className="h-16 border-b border-slate-200 dark:border-[#1e202a] flex items-center justify-between px-8 bg-white dark:bg-[#090b0e]">
          <div className="flex items-center space-x-4">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 capitalize m-0 tracking-wide">
              {activeTab} Space
            </h2>
            
            {/* Namespace Filter for Explorer */}
            {activeTab === 'explorer' && (
              <div className="flex items-center bg-slate-100 dark:bg-[#111319] border border-slate-200 dark:border-[#1e202a] rounded-xl px-3 py-1">
                <Sliders className="w-3.5 h-3.5 text-slate-405 mr-2" />
                <span className="text-[11px] text-slate-500 dark:text-slate-500 mr-2 font-bold">Namespace:</span>
                <input
                  type="text"
                  placeholder="all / default / etc."
                  value={namespaceFilter}
                  onChange={(e) => setNamespaceFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-750 dark:text-slate-200 border-none outline-none focus:ring-0 p-0 w-24 font-bold"
                />
              </div>
            )}

            {/* Show System Resources Toggle */}
            {(activeTab === 'explorer' || activeTab === 'dashboard') && (
              <label className="flex items-center space-x-2 bg-slate-100 dark:bg-[#111319] border border-slate-200 dark:border-[#1e202a] rounded-xl px-3 py-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showSystemResources}
                  onChange={(e) => setShowSystemResources(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-cyan-500 bg-slate-100 dark:bg-slate-900 border-slate-350 dark:border-[#1e202a] focus:ring-0 cursor-pointer"
                />
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Show System</span>
              </label>
            )}
          </div>

          <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400 font-bold">
            <span>Kind Cluster Dev</span>
            <span className={`w-2 h-2 rounded-full ${stats?.status === 'healthy' ? 'bg-cyan-400 animate-pulse shadow-md' : 'bg-amber-450'}`} />
          </div>
        </header>

        {/* Dynamic Views Content */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="max-w-5xl mx-auto space-y-8">
              
              {/* CNCF Style Top Hero Split Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Welcome Content (2/3 width) */}
                <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-white dark:bg-[#0c0e15] border border-slate-200 dark:border-slate-800 p-8 shadow-sm flex flex-col justify-between min-h-[220px]">
                  <div className="absolute right-0 top-0 w-64 h-64 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-3xl" />
                  <div className="relative z-10 space-y-3">
                    <span className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 tracking-widest uppercase">Kubernetes AI Mentor</span>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white leading-tight">Inspect container states & diagnose errors reactively.</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed font-semibold max-w-lg">
                      Podex fetches live logs, details, and events from your Kind cluster, highlighting degraded pods. Click on the live status grid below to troubleshoot.
                    </p>
                  </div>
                  
                  {/* Interactive Status Grid (CNCF K9s Cell Graphic) */}
                  <div className="relative z-10 pt-6 border-t border-slate-100 dark:border-slate-800/80 mt-6">
                    <div className="flex justify-between items-center mb-2.5">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Cluster Pod Map ({filteredPods.length} total)
                      </span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-semibold italic">Click cell to inspect</span>
                    </div>
                    {filteredPods.length === 0 ? (
                      <span className="text-xs text-slate-400 block italic font-medium">No user pods running in cluster.</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {filteredPods.map(p => {
                          const s = p.status.toLowerCase();
                          const isHealthy = s.includes('run') || s === 'completed' || s === 'ready';
                          const isPending = s.includes('pend') || s.includes('progress');
                          
                          const color = isHealthy 
                            ? 'bg-emerald-500 shadow-emerald-500/20' 
                            : isPending 
                              ? 'bg-amber-500 shadow-amber-500/20 animate-pulse' 
                              : 'bg-red-500 shadow-red-500/20 animate-pulse';
                              
                          return (
                            <div
                              key={p.name}
                              onClick={() => {
                                setSelectedResource({ type: 'pod', name: p.name, namespace: p.namespace });
                                setDetailTab('overview');
                                setActiveTab('explorer');
                              }}
                              title={`${p.name} (${p.status})`}
                              className={`w-4.5 h-4.5 rounded-lg cursor-pointer hover:scale-125 hover:rotate-6 transition duration-150 shadow-md ${color}`}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Circular Health Donut (1/3 width) */}
                <div className="bg-white dark:bg-[#0c0e15] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center space-y-4 shadow-sm min-h-[220px]">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Cluster Health</span>
                  
                  {/* SVG Donut Track */}
                  <div className="relative flex items-center justify-center">
                    <svg className="w-28 h-28 transform -rotate-90">
                      <circle
                        cx="56"
                        cy="56"
                        r={radius}
                        className="stroke-slate-100 dark:stroke-slate-800/60"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="56"
                        cy="56"
                        r={radius}
                        className="stroke-cyan-500 transition-all duration-500"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-slate-850 dark:text-white leading-none">
                        {healthPercentage}%
                      </span>
                      <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                        Healthy
                      </span>
                    </div>
                  </div>
                  
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold text-center">
                    {runningPodsCount} / {totalPodsCount} Pods Ready
                  </span>
                </div>
              </div>

              {/* Stats Counters Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                
                {/* Nodes Stat */}
                <div className="bg-white dark:bg-[#0c0e13] border border-slate-200 dark:border-[#1e202a] rounded-2xl p-6 hover:border-cyan-500/30 transition duration-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nodes</span>
                    <Cpu className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-black text-slate-800 dark:text-white">
                      {statsLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : stats?.node_count ?? 0}
                    </span>
                    <span className="text-xs text-slate-500">active</span>
                  </div>
                </div>

                {/* Pods Stat */}
                <div className="bg-white dark:bg-[#0c0e13] border border-slate-200 dark:border-[#1e202a] rounded-2xl p-6 hover:border-violet-500/30 transition duration-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pods</span>
                    <Layers className="w-5 h-5 text-violet-500 dark:text-violet-400" />
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-black text-slate-800 dark:text-white">
                      {statsLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : (showSystemResources ? (stats?.pod_count ?? 0) : filteredPods.length)}
                    </span>
                    <span className="text-xs text-slate-500">instances</span>
                  </div>
                </div>

                {/* Deployments Stat */}
                <div className="bg-white dark:bg-[#0c0e13] border border-slate-200 dark:border-[#1e202a] rounded-2xl p-6 hover:border-indigo-500/30 transition duration-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Deployments</span>
                    <Activity className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-black text-slate-800 dark:text-white">
                      {statsLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : (showSystemResources ? (stats?.deployment_count ?? 0) : filteredDeployments.length)}
                    </span>
                    <span className="text-xs text-slate-500">specs</span>
                  </div>
                </div>

                {/* Services Stat */}
                <div className="bg-white dark:bg-[#0c0e13] border border-slate-200 dark:border-[#1e202a] rounded-2xl p-6 hover:border-emerald-500/30 transition duration-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Services</span>
                    <Terminal className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-black text-slate-800 dark:text-white">
                      {statsLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : (showSystemResources ? (stats?.service_count ?? 0) : filteredServices.length)}
                    </span>
                    <span className="text-xs text-slate-500">endpoints</span>
                  </div>
                </div>
              </div>

              {/* Freshers Quick Help Cards */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kubernetes Concept Shortcuts</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { title: 'Pod Lifecycle', desc: 'Pods are ephemeral running containers. Learn about Pending, Running, and CrashLoopBackOff.', query: 'What is a Pod?' },
                    { title: 'Routing & Services', desc: 'Kubernetes Services proxy traffic to matching Pod labels. Learn ClusterIP vs NodePort.', query: 'What is a Service?' },
                    { title: 'Health Checking Probes', desc: 'How Kubernetes monitors container health using Liveness and Readiness probes.', query: 'What is Liveness Probe?' }
                  ].map((card, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setLearnQuery(card.query);
                        setActiveTab('learn');
                        handleLearnQuery(card.query);
                      }}
                      className="bg-white dark:bg-[#0c0e13] border border-slate-200 dark:border-[#1e202a] rounded-2xl p-5 hover:border-cyan-500 cursor-pointer transition group shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300"
                    >
                      <h5 className="font-bold text-slate-800 dark:text-slate-200 m-0 group-hover:text-cyan-500 transition">{card.title}</h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed font-semibold">{card.desc}</p>
                      <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold flex items-center mt-3">
                        <span>Explain concept</span>
                        <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition duration-150" />
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: EXPLORER */}
          {activeTab === 'explorer' && (
            <div className="bg-white dark:bg-[#090b0f] border border-slate-200 dark:border-[#1e202a] rounded-3xl overflow-hidden shadow-sm">
              
              {/* Explorer Table Header tabs */}
              <div className="border-b border-slate-200 dark:border-[#1e202a] bg-slate-50/50 dark:bg-[#0c0e13] p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                
                {/* Selector Buttons */}
                <div className="flex bg-slate-200/60 dark:bg-[#12141a] rounded-xl p-0.5 border border-slate-250 dark:border-[#1e202a] select-none shrink-0">
                  {([
                    { id: 'pods', label: 'Pods', count: filteredPods.length },
                    { id: 'deployments', label: 'Deployments', count: filteredDeployments.length },
                    { id: 'services', label: 'Services', count: filteredServices.length }
                  ] as const).map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => setExplorerSubTab(sub.id)}
                      className={`px-4 py-2 rounded-lg font-bold text-xs transition cursor-pointer ${
                        explorerSubTab === sub.id
                          ? 'bg-white dark:bg-[#1f2330] text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200 dark:border-[#2d3142]/45'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {sub.label} <span className="ml-1 text-[10px] opacity-70 font-bold">({sub.count})</span>
                    </button>
                  ))}
                </div>

                {/* Live Filter input search */}
                <div className="flex items-center bg-slate-100 dark:bg-[#111319] border border-slate-200 dark:border-[#1e202a] rounded-xl px-3 py-2 w-full max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    placeholder={`Search ${explorerSubTab}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-transparent text-xs text-slate-700 dark:text-slate-200 border-none outline-none focus:ring-0 p-0 w-full font-bold"
                  />
                </div>
              </div>

              {/* Data Lists Table */}
              <div className="overflow-x-auto">
                {resourcesLoading ? (
                  <div className="flex flex-col items-center justify-center py-24 space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                    <span className="text-xs text-slate-500 font-bold">Fetching Kubernetes resources...</span>
                  </div>
                ) : (
                  <div>
                    {/* PODS List */}
                    {explorerSubTab === 'pods' && (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-[#1e202a] text-slate-500 text-[10px] uppercase font-bold tracking-wider bg-slate-50 dark:bg-[#0d0f14]">
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Namespace</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-center">Restarts</th>
                            <th className="px-6 py-4">Age</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#13151c] text-xs">
                          {filteredPods.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-bold bg-slate-50/20 dark:bg-transparent">
                                No Pods found. Deploy some workloads to test Podex!
                              </td>
                            </tr>
                          ) : (
                            filteredPods.map(pod => (
                              <tr
                                key={pod.name}
                                onClick={() => {
                                  setSelectedResource({ type: 'pod', name: pod.name, namespace: pod.namespace });
                                  setDetailTab('overview');
                                }}
                                className={`hover:bg-slate-50/80 dark:hover:bg-[#10121c]/60 cursor-pointer transition duration-150 ${
                                  selectedResource?.name === pod.name ? 'bg-slate-100/70 dark:bg-[#10121c]' : ''
                                }`}
                              >
                                <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{pod.name}</td>
                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">{pod.namespace}</td>
                                <td className="px-6 py-4">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(pod.status)}`}>
                                    {pod.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400 font-mono font-bold">{pod.restarts}</td>
                                <td className="px-6 py-4 text-slate-500">{pod.age}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}

                    {/* DEPLOYMENTS List */}
                    {explorerSubTab === 'deployments' && (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-[#1e202a] text-slate-500 text-[10px] uppercase font-bold tracking-wider bg-slate-50 dark:bg-[#0d0f14]">
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Namespace</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-center">Desired</th>
                            <th className="px-6 py-4 text-center">Ready</th>
                            <th className="px-6 py-4 text-center">Available</th>
                            <th className="px-6 py-4">Age</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#13151c] text-xs">
                          {filteredDeployments.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-6 py-12 text-center text-slate-450 dark:text-slate-500 font-bold bg-slate-50/20 dark:bg-transparent">
                                No Deployments found.
                              </td>
                            </tr>
                          ) : (
                            filteredDeployments.map(deploy => (
                              <tr
                                key={deploy.name}
                                onClick={() => {
                                  setSelectedResource({ type: 'deployment', name: deploy.name, namespace: deploy.namespace });
                                  setDetailTab('overview');
                                }}
                                className={`hover:bg-slate-50/80 dark:hover:bg-[#10121c]/60 cursor-pointer transition duration-150 ${
                                  selectedResource?.name === deploy.name ? 'bg-slate-100/70 dark:bg-[#10121c]' : ''
                                }`}
                              >
                                <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{deploy.name}</td>
                                <td className="px-6 py-4 text-slate-500 dark:text-slate-405 font-bold">{deploy.namespace}</td>
                                <td className="px-6 py-4">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(deploy.status)}`}>
                                    {deploy.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-404 font-bold">{deploy.replicas_desired}</td>
                                <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-404 font-bold">{deploy.replicas_ready}</td>
                                <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-450 font-bold">{deploy.replicas_available}</td>
                                <td className="px-6 py-4 text-slate-500">{deploy.age}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}

                    {/* SERVICES List */}
                    {explorerSubTab === 'services' && (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-[#1e202a] text-slate-500 text-[10px] uppercase font-bold tracking-wider bg-slate-50 dark:bg-[#0d0f14]">
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Namespace</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4">Cluster IP</th>
                            <th className="px-6 py-4">External IP</th>
                            <th className="px-6 py-4">Ports</th>
                            <th className="px-6 py-4">Age</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#13151c] text-xs">
                          {filteredServices.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-6 py-12 text-center text-slate-450 dark:text-slate-500 font-bold bg-slate-50/20 dark:bg-transparent">
                                No Services found.
                              </td>
                            </tr>
                          ) : (
                            filteredServices.map(svc => (
                              <tr
                                key={svc.name}
                                onClick={() => {
                                  setSelectedResource({ type: 'service', name: svc.name, namespace: svc.namespace });
                                  setDetailTab('overview');
                                }}
                                className={`hover:bg-slate-50/80 dark:hover:bg-[#10121c]/60 cursor-pointer transition duration-150 ${
                                  selectedResource?.name === svc.name ? 'bg-slate-100/70 dark:bg-[#10121c]' : ''
                                }`}
                              >
                                <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{svc.name}</td>
                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">{svc.namespace}</td>
                                <td className="px-6 py-4 text-slate-600 dark:text-slate-450 font-bold">{svc.type}</td>
                                <td className="px-6 py-4 text-slate-650 dark:text-slate-450 font-mono">{svc.cluster_ip}</td>
                                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{svc.external_ip}</td>
                                <td className="px-6 py-4 text-slate-650 dark:text-slate-450 font-mono">{svc.ports}</td>
                                <td className="px-6 py-4 text-slate-505">{svc.age}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: LEARN TEACHER */}
          {activeTab === 'learn' && (
            <div className="max-w-3xl mx-auto space-y-8">
              
              <div className="text-center space-y-3">
                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-200 m-0">Ask Podex AI Anything</h3>
                <p className="text-xs text-slate-500 dark:text-slate-450 max-w-lg mx-auto font-bold">
                  Type a Kubernetes concept, resource name, or error code. Your AI mentor will explain it using real-world analogies.
                </p>
              </div>

              {/* Chat Input query */}
              <div className="flex bg-white dark:bg-[#10121a] border border-slate-200 dark:border-[#1e202a] rounded-2xl p-2 max-w-2xl mx-auto shadow-sm">
                <input
                  type="text"
                  placeholder="Explain: Port Forwarding / CrashLoopBackOff / ConfigMap..."
                  value={learnQuery}
                  onChange={(e) => setLearnQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLearnQuery(''); }}
                  className="bg-transparent text-sm text-slate-800 dark:text-slate-200 border-none outline-none focus:ring-0 p-3 flex-grow font-bold"
                />
                <button
                  onClick={() => handleLearnQuery('')}
                  disabled={aiLearningLoading}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:shadow-md hover:shadow-cyan-500/10 font-bold text-xs text-white transition disabled:opacity-50 flex items-center space-x-2 cursor-pointer"
                >
                  {aiLearningLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Explain</span>}
                </button>
              </div>

              {/* Quick suggestion tags */}
              <div className="flex flex-wrap justify-center gap-2 max-w-xl mx-auto">
                {['What is a Pod?', 'What is a Service?', 'What is Liveness Probe?', 'How does Ingress work?', 'What is CrashLoopBackOff?'].map(tag => (
                  <button
                    key={tag}
                    onClick={() => { setLearnQuery(tag); handleLearnQuery(tag); }}
                    className="px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-50 dark:bg-[#111319] dark:hover:bg-[#161a24] border border-slate-200 dark:border-[#1e202a] text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition font-bold shadow-sm cursor-pointer"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* AI Explanation Card Render */}
              {aiLearningLoading && (
                <div className="bg-white dark:bg-[#0b0c10] border border-slate-200 dark:border-[#1e202a] rounded-3xl p-12 flex flex-col items-center justify-center space-y-4 max-w-2xl mx-auto shadow-sm animate-pulse">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">Tutor is compiling explanation...</span>
                </div>
              )}

              {aiLearning && (
                <div className="bg-white dark:bg-[#0c0e15] border border-slate-200 dark:border-[#1e202d] rounded-3xl p-8 space-y-6 max-w-2xl mx-auto shadow-sm">
                  
                  {/* Topic Title */}
                  <div className="flex items-center space-x-3 border-b border-slate-200 dark:border-[#1e202a] pb-4">
                    <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400 flex items-center justify-center font-black">
                      ?
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-850 dark:text-slate-100 m-0">{aiLearning.concept}</h4>
                      <span className="text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-wider block font-bold mt-0.5">AI-Powered Explanation</span>
                    </div>
                  </div>

                  {/* Body Sections */}
                  <div className="space-y-6 text-xs leading-relaxed">
                    
                    {/* Explanation */}
                    <div className="space-y-1.5">
                      <h5 className="font-bold text-[10px] text-slate-405 uppercase tracking-wider">What it is</h5>
                      <p className="text-slate-700 dark:text-slate-300 font-bold">{aiLearning.explanation}</p>
                    </div>

                    {/* Analogy */}
                    <div className="bg-indigo-50/50 dark:bg-[#0f121d] border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-5 space-y-2">
                      <h5 className="font-bold text-[10px] text-indigo-650 dark:text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
                        <Info className="w-3.5 h-3.5" />
                        <span>Analogy for Beginners</span>
                      </h5>
                      <p className="text-slate-700 dark:text-slate-300 italic font-bold">
                        "{aiLearning.real_world_analogy}"
                      </p>
                    </div>

                    {/* Why it exists */}
                    <div className="space-y-1.5">
                      <h5 className="font-bold text-[10px] text-slate-405 uppercase tracking-wider">Why it exists in K8s</h5>
                      <p className="text-slate-700 dark:text-slate-300 font-bold">{aiLearning.why_it_exists}</p>
                    </div>

                    {/* Gotchas */}
                    {aiLearning.common_gotchas && aiLearning.common_gotchas.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="font-bold text-[10px] text-amber-600 dark:text-amber-550 uppercase tracking-wider">Common Gotchas</h5>
                        <ul className="space-y-1.5 list-disc pl-5 text-slate-700 dark:text-slate-300 font-bold">
                          {aiLearning.common_gotchas.map((gotcha, idx) => (
                            <li key={idx}>{gotcha}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* RESOURCE DETAILS Slide-Over Panel */}
      {selectedResource && (
        <aside 
          style={{ width: isDrawerMaximized ? '90vw' : `${detailsWidth}px` }}
          className="relative border-l border-slate-200 dark:border-[#1e202a] bg-white dark:bg-[#090a0e] flex flex-col z-20 shadow-2xl transition-all duration-75"
        >
          {/* Resize Handle Drag Border */}
          <div
            onMouseDown={handleResizeMouseDown}
            className="absolute top-0 left-0 w-1.5 h-full cursor-ew-resize hover:bg-cyan-500/50 active:bg-cyan-500 z-50 transition-colors"
          />

          {/* Header */}
          <div className="p-6 border-b border-slate-200 dark:border-[#1e202a] flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest block mb-1">
                {selectedResource.type} Details
              </span>
              <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200 truncate m-0">
                {selectedResource.name}
              </h3>
              <span className="text-xs text-slate-550 dark:text-slate-400 truncate block mt-0.5 font-bold">
                Namespace: {selectedResource.namespace}
              </span>
            </div>
            
            <div className="flex items-center space-x-1 shrink-0">
              <button
                onClick={() => setIsDrawerMaximized(!isDrawerMaximized)}
                className="p-1.5 rounded-lg hover:bg-slate-105 dark:hover:bg-[#1a1c25] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
                title={isDrawerMaximized ? "Restore Width" : "Maximize Panel"}
              >
                {isDrawerMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setSelectedResource(null)}
                className="p-1.5 rounded-lg hover:bg-slate-105 dark:hover:bg-[#1a1c25] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Operations Confirmation triggers */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-[#0d0f15] border-b border-slate-200 dark:border-[#1e202a] flex items-center justify-start space-x-2">
            
            {/* Delete Pod */}
            {selectedResource.type === 'pod' && (
              <button
                onClick={() => setConfirmationModal({
                  type: 'delete',
                  name: selectedResource.name,
                  namespace: selectedResource.namespace
                })}
                className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/60 border border-red-200 dark:border-red-900/50 hover:border-red-300 dark:hover:border-red-800 text-red-650 dark:text-red-400 font-bold text-[11px] transition flex items-center space-x-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Pod</span>
              </button>
            )}

            {/* Restart Deployment */}
            {selectedResource.type === 'deployment' && (
              <>
                <button
                  onClick={() => setConfirmationModal({
                    type: 'restart',
                    name: selectedResource.name,
                    namespace: selectedResource.namespace
                  })}
                  className="px-3.5 py-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/30 dark:hover:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-900/50 hover:border-cyan-300 dark:hover:border-cyan-800 text-cyan-655 dark:text-cyan-400 font-bold text-[11px] transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Restart Deployment</span>
                </button>

                {/* Scale Deployment */}
                <button
                  onClick={() => setConfirmationModal({
                    type: 'scale',
                    name: selectedResource.name,
                    namespace: selectedResource.namespace,
                    scaleValue: 1
                  })}
                  className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/60 border border-amber-200 dark:border-amber-900/50 hover:border-amber-300 dark:hover:border-amber-800 text-amber-655 dark:text-amber-400 font-bold text-[11px] transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Scale Replicas</span>
                </button>
              </>
            )}
          </div>

          {/* Sub-tab Select for Resource details */}
          <div className="flex border-b border-slate-200 dark:border-[#1e202a] text-xs select-none">
            {(['overview', 'logs', 'events', 'yaml', 'investigate'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setDetailTab(tab)}
                className={`flex-1 py-3 font-bold text-center border-b-2 capitalize transition duration-150 cursor-pointer ${
                  detailTab === tab
                    ? 'border-cyan-500 text-cyan-650 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/5'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Details Content Render */}
          <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-slate-50/50 dark:bg-[#090b0f]">
            {resourceDetailsLoading ? (
              <div className="flex flex-col items-center justify-center h-48 space-y-4">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
                <span className="text-xs text-slate-405 font-bold">Loading details...</span>
              </div>
            ) : (
              <div>
                
                {/* TAB: OVERVIEW */}
                {detailTab === 'overview' && resourceDetails && (
                  <div className="space-y-5 text-xs">
                    
                    {/* Status overview list info */}
                    <div className="bg-white dark:bg-[#10121a] p-4 rounded-xl border border-slate-200 dark:border-[#1e202a] space-y-3 shadow-sm">
                      <h4 className="font-bold text-slate-800 dark:text-slate-300">Specifications</h4>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-slate-500 font-bold">Resource:</span>
                        <span className="col-span-2 text-slate-700 dark:text-slate-350 font-bold">{selectedResource.type}</span>
                        
                        <span className="text-slate-500 font-bold">Kind:</span>
                        <span className="col-span-2 text-slate-700 dark:text-slate-350 font-mono font-bold">{resourceDetails.kind}</span>

                        <span className="text-slate-500 font-bold">API Version:</span>
                        <span className="col-span-2 text-slate-700 dark:text-slate-350 font-mono font-bold">{resourceDetails.api_version}</span>
                        
                        <span className="text-slate-500 font-bold">Created:</span>
                        <span className="col-span-2 text-slate-700 dark:text-slate-350 font-bold">{resourceDetails.metadata?.creation_timestamp}</span>
                      </div>
                    </div>

                    {/* Metadata labels */}
                    {resourceDetails.metadata?.labels && (
                      <div className="bg-white dark:bg-[#10121a] p-4 rounded-xl border border-slate-200 dark:border-[#1e202a] space-y-2 shadow-sm">
                        <h4 className="font-bold text-slate-800 dark:text-slate-300">Labels</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(resourceDetails.metadata.labels).map(([k, v]) => (
                            <span key={k} className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-[#161a25] border border-slate-200 dark:border-cyan-955 text-cyan-605 dark:text-cyan-400 font-mono text-[10px]">
                              {k}={String(v)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Visual K8s Conditions Timeline (CNCF Observability) */}
                    {resourceDetails.status?.conditions && (
                      <div className="bg-white dark:bg-[#10121a] p-4 rounded-xl border border-slate-200 dark:border-[#1e202a] space-y-3 shadow-sm">
                        <h4 className="font-bold text-slate-850 dark:text-slate-300">Conditions</h4>
                        <div className="grid grid-cols-1 gap-2">
                          {resourceDetails.status.conditions.map((cond: any) => {
                            const isTrue = cond.status === 'True';
                            const isFalse = cond.status === 'False';
                            const condBg = isTrue 
                              ? 'bg-emerald-50/70 dark:bg-emerald-955/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50' 
                              : isFalse 
                                ? 'bg-red-50/70 dark:bg-red-955/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50 animate-pulse' 
                                : 'bg-slate-100/70 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-250 dark:border-slate-800';
                            
                            return (
                              <div key={cond.type} className={`flex justify-between items-center p-3 rounded-xl ${condBg}`}>
                                <div className="min-w-0">
                                  <span className="font-bold text-[11px] block truncate">{cond.type}</span>
                                  <span className="text-[10px] opacity-75 block truncate mt-0.5 font-bold">{cond.message || cond.reason || 'No description available.'}</span>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider shrink-0 ml-3">{cond.status}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Clickable Related Resources Map (CNCF Connections) */}
                    {relatedList.length > 0 && (
                      <div className="bg-white dark:bg-[#10121a] p-4 rounded-xl border border-slate-200 dark:border-[#1e202a] space-y-3 shadow-sm">
                        <h4 className="font-bold text-slate-850 dark:text-slate-300 flex items-center space-x-1.5">
                          <Link2 className="w-4 h-4 text-cyan-500" />
                          <span>Connected Components</span>
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          {relatedList.map((rel, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                setSelectedResource({ type: rel.type, name: rel.name, namespace: rel.namespace });
                                setDetailTab('overview');
                              }}
                              className="flex items-center space-x-2.5 p-3 rounded-xl bg-slate-50 dark:bg-[#161822] border border-slate-200 dark:border-slate-800 hover:border-cyan-500 dark:hover:border-cyan-500 cursor-pointer transition select-none group"
                            >
                              <div className="w-8 h-8 rounded bg-cyan-100 dark:bg-cyan-955/40 text-cyan-600 dark:text-cyan-550 flex items-center justify-center font-bold text-[10px] uppercase">
                                {rel.type[0]}
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-[11px] text-slate-750 dark:text-slate-200 block truncate group-hover:text-cyan-500 transition">{rel.name}</span>
                                <span className="text-[9px] text-slate-500 block uppercase tracking-wider mt-0.5 font-bold">{rel.description}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Container details if Pod */}
                    {selectedResource.type === 'pod' && resourceDetails.spec?.containers && (
                      <div className="bg-white dark:bg-[#10121a] p-4 rounded-xl border border-slate-200 dark:border-[#1e202a] space-y-3 shadow-sm">
                        <h4 className="font-bold text-slate-805 dark:text-slate-300">Containers</h4>
                        {resourceDetails.spec.containers.map((container: any) => (
                          <div key={container.name} className="border-t border-slate-200 dark:border-[#1e202a] pt-3 mt-3 first:border-none first:pt-0 first:mt-0 space-y-1.5">
                            <div className="flex justify-between font-bold text-slate-700 dark:text-slate-200">
                              <span>{container.name}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 text-slate-550">
                              <span>Image:</span>
                              <span className="col-span-2 text-slate-700 dark:text-slate-300 font-mono break-all">{container.image}</span>

                              <span>Pull Policy:</span>
                              <span className="col-span-2 text-slate-700 dark:text-slate-300 font-bold">{container.image_pull_policy}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                )}

                {/* TAB: LOGS */}
                {detailTab === 'logs' && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                      {/* Search log filter */}
                      <div className="flex items-center bg-white dark:bg-[#10121a] border border-slate-200 dark:border-[#1e202a] rounded-xl px-2.5 py-1.5 flex-grow max-w-xs shadow-sm">
                        <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                        <input
                          type="text"
                          placeholder="Filter logs..."
                          value={logsFilter}
                          onChange={(e) => setLogsFilter(e.target.value)}
                          className="bg-transparent text-xs text-slate-700 dark:text-slate-200 border-none outline-none focus:ring-0 p-0 w-full font-bold"
                        />
                      </div>
                      
                      {/* Font size + Copy + AutoScroll */}
                      <div className="flex items-center space-x-3 text-slate-500 dark:text-slate-400 shrink-0 font-bold select-none font-semibold">
                        <label className="flex items-center space-x-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoScrollLogs}
                            onChange={(e) => setAutoScrollLogs(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-cyan-500 bg-slate-105 dark:bg-slate-900 border-slate-300 dark:border-[#1e202a] focus:ring-0 cursor-pointer"
                          />
                          <span className="text-[10px]">Auto-Scroll</span>
                        </label>
                        
                        <div className="flex items-center space-x-1 border border-slate-200 dark:border-[#1e202a] rounded-lg p-0.5 bg-slate-105 dark:bg-[#10121a]">
                          <button
                            onClick={() => setCodeFontSize(Math.max(10, codeFontSize - 1))}
                            className="px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-[10px] font-bold cursor-pointer"
                            title="Decrease text size"
                          >
                            A-
                          </button>
                          <span className="text-[10px] px-1 font-mono font-bold text-slate-500">{codeFontSize}px</span>
                          <button
                            onClick={() => setCodeFontSize(Math.min(18, codeFontSize + 1))}
                            className="px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-[10px] font-bold cursor-pointer"
                            title="Increase text size"
                          >
                            A+
                          </button>
                        </div>
                        
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(logsText);
                            alert("Logs copied to clipboard!");
                          }}
                          className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold hover:text-cyan-500 cursor-pointer"
                        >
                          Copy Logs
                        </button>
                      </div>
                    </div>
                    
                    <pre 
                      ref={logsEndRef}
                      style={{ fontSize: `${codeFontSize}px` }}
                      className="w-full bg-slate-950 text-emerald-450 border border-slate-900 dark:border-[#161822] rounded-xl p-4 overflow-x-auto whitespace-pre font-mono h-[420px] transition-all scroll-smooth"
                    >
                      {logsText 
                        ? logsText
                            .split('\n')
                            .filter(line => line.toLowerCase().includes(logsFilter.toLowerCase()))
                            .join('\n') || "No logs matching current filter."
                        : "No logs generated by container or unavailable."}
                    </pre>
                  </div>
                )}

                {/* TAB: EVENTS */}
                {detailTab === 'events' && (
                  <div className="space-y-3 text-xs">
                    {eventsList.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 font-bold">
                        No events recorded for this resource.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {eventsList.map((ev, idx) => (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-xl border flex items-start space-x-3 shadow-sm ${
                              ev.type === 'Warning'
                                ? 'bg-amber-50/70 dark:bg-amber-955/20 border-amber-250 dark:border-amber-900/40 text-amber-705 dark:text-amber-300 animate-pulse'
                                : 'bg-white dark:bg-[#10121a] border-slate-200 dark:border-[#1e202a] text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {ev.type === 'Warning' ? (
                              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 animate-bounce" />
                            ) : (
                              <Info className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                            )}
                            <div className="space-y-0.5">
                              <div className="flex items-center space-x-2">
                                <span className="font-extrabold text-[11px]">{ev.reason}</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-500 font-bold">count: {ev.count}</span>
                              </div>
                              <p className="text-xs text-slate-650 dark:text-slate-400 leading-normal font-bold">{ev.message}</p>
                              <span className="text-[9px] text-slate-500 block mt-1 font-bold">{ev.last_timestamp} ago</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB: YAML */}
                {detailTab === 'yaml' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center space-x-2 font-bold">
                        <span className="text-slate-550 dark:text-slate-400">Kubernetes YAML</span>
                        <div className="flex items-center space-x-1 border border-slate-200 dark:border-[#1e202a] rounded-lg p-0.5 bg-slate-105 dark:bg-[#10121a]">
                          <button
                            onClick={() => setCodeFontSize(Math.max(10, codeFontSize - 1))}
                            className="px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-[10px] font-bold cursor-pointer"
                            title="Decrease text size"
                          >
                            A-
                          </button>
                          <span className="text-[10px] px-1 font-mono font-bold text-slate-500">{codeFontSize}px</span>
                          <button
                            onClick={() => setCodeFontSize(Math.min(18, codeFontSize + 1))}
                            className="px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-[10px] font-bold cursor-pointer"
                            title="Increase text size"
                          >
                            A+
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(yamlText);
                          alert("YAML copied to clipboard!");
                        }}
                        className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold hover:text-cyan-500 cursor-pointer"
                      >
                        Copy YAML
                      </button>
                    </div>
                    <pre 
                      style={{ fontSize: `${codeFontSize}px` }}
                      className="w-full bg-slate-100 dark:bg-[#050608] text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-[#161822] rounded-xl p-4 overflow-auto whitespace-pre font-mono h-[420px] transition-all"
                    >
                      {yamlText || "Fetching YAML spec..."}
                    </pre>
                  </div>
                )}

                {/* TAB: INVESTIGATE */}
                {detailTab === 'investigate' && (
                  <div className="space-y-6">
                    
                    {/* Explain workflow trigger */}
                    {!aiInvestigating && !aiInvestigation && (
                      <div className="bg-white dark:bg-[#10121a] border border-slate-200 dark:border-[#1e202a] p-6 rounded-2xl text-center space-y-4 shadow-sm">
                        <HelpCircle className="w-8 h-8 text-cyan-500 dark:text-cyan-400 mx-auto" />
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-250 m-0">Run AI Diagnosis</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                          Click below to have Podex analyze logs, recent events, and configuration parameters of this resource.
                        </p>
                        <button
                          onClick={runInvestigation}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 font-bold text-xs text-white hover:shadow-md hover:shadow-cyan-500/10 transition cursor-pointer"
                        >
                          Investigate with AI Mentor
                        </button>
                      </div>
                    )}

                    {/* Investigation Loading states */}
                    {aiInvestigating && (
                      <div className="bg-white dark:bg-[#10121a] border border-slate-200 dark:border-[#1e202a] p-8 rounded-2xl text-center space-y-4 flex flex-col items-center shadow-sm">
                        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                        <h4 className="font-bold text-sm text-slate-808 dark:text-slate-200 m-0">Analyzing Cluster State</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold animate-pulse">
                          {investigationStep}
                        </p>
                      </div>
                    )}

                    {/* Investigation Result display */}
                    {aiInvestigation && (
                      <div className="space-y-5 text-xs">
                        
                        {/* Status Callout Card */}
                        <div className={`p-4 rounded-xl border flex items-start space-x-3 shadow-sm ${
                          aiInvestigation.status === 'healthy'
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                            : aiInvestigation.status === 'degraded'
                              ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-300'
                              : 'bg-red-50/70 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300'
                        }`}>
                          {aiInvestigation.status === 'healthy' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                          ) : aiInvestigation.status === 'degraded' ? (
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                          ) : (
                            <AlertOctagon className="w-5 h-5 text-red-500 shrink-0 mt-0.5 animate-pulse" />
                          )}
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-black text-sm uppercase tracking-wide">Diagnosis: {aiInvestigation.status}</span>
                              <span className="text-[10px] opacity-75 font-bold">Confidence: {aiInvestigation.confidence}%</span>
                            </div>
                            <p className="text-xs mt-1.5 font-bold">{aiInvestigation.root_cause}</p>
                          </div>
                        </div>

                        {/* Root Cause details */}
                        <div className="bg-white dark:bg-[#10121a] p-4 rounded-xl border border-slate-200 dark:border-[#1e202a] space-y-2 shadow-sm">
                          <h5 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Analysis Summary</h5>
                          <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-semibold">{aiInvestigation.explanation}</p>
                        </div>

                        {/* Evidence Items */}
                        {aiInvestigation.evidence && aiInvestigation.evidence.length > 0 && (
                          <div className="bg-white dark:bg-[#10121a] p-4 rounded-xl border border-slate-200 dark:border-[#1e202a] space-y-2 shadow-sm">
                            <h5 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Evidence Gathered</h5>
                            <ul className="space-y-1.5 list-disc pl-5 text-slate-700 dark:text-slate-350 font-semibold">
                              {aiInvestigation.evidence.map((ev, idx) => (
                                <li key={idx} className="leading-relaxed">{ev}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Suggested Fix */}
                        <div className="bg-cyan-50/45 dark:bg-[#0c161e] p-4 rounded-xl border border-cyan-200 dark:border-cyan-900/35 space-y-2 shadow-sm">
                          <h5 className="font-bold text-[10px] text-cyan-600 dark:text-cyan-400 uppercase tracking-wider flex items-center space-x-1.5">
                            <Sliders className="w-3.5 h-3.5" />
                            <span>Suggested Fix Action</span>
                          </h5>
                          <p className="text-slate-750 dark:text-slate-250 font-bold leading-normal">{aiInvestigation.suggested_fix}</p>
                        </div>

                        {/* Educational K8s Lesson */}
                        <div className="bg-white dark:bg-[#10121a] p-4 rounded-xl border border-slate-200 dark:border-[#1e202a] space-y-3 shadow-sm">
                          <h5 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">Concept Lesson</h5>
                          <div className="border-t border-slate-100 dark:border-slate-800 pt-2 space-y-2">
                            <span className="font-extrabold text-slate-800 dark:text-slate-200 block text-xs">{aiInvestigation.k8s_lesson.concept}</span>
                            <p className="text-slate-650 dark:text-slate-400 leading-normal italic font-bold">
                              "{aiInvestigation.k8s_lesson.analogy}"
                            </p>
                          </div>
                        </div>

                        {/* Re-run button */}
                        <button
                          onClick={runInvestigation}
                          className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-[#1e202a] hover:bg-slate-100 dark:hover:bg-[#13151f] text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
                        >
                          Refresh Diagnosis
                        </button>

                      </div>
                    )}

                  </div>
                )}

              </div>
            )}
          </div>

        </aside>
      )}

      {/* CONFIRMATION / EDUCATION MODAL FRAME */}
      {confirmationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm select-none p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#0c0e15] border border-slate-200 dark:border-[#1e202d] rounded-3xl p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                confirmationModal.type === 'delete' 
                  ? 'bg-red-50 dark:bg-red-950/50 text-red-550' 
                  : confirmationModal.type === 'restart'
                    ? 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-550'
                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-550'
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
                <h4 className="text-base font-extrabold text-slate-850 dark:text-slate-100 capitalize m-0">
                  {confirmationModal.type} {selectedResource?.type}
                </h4>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mt-0.5 block">Action Confirmation</span>
              </div>
            </div>

            {/* Educational content - What Kubernetes does behind the scenes */}
            <div className="bg-slate-50 dark:bg-[#11131c] border border-slate-200 dark:border-slate-800 p-4.5 rounded-2xl text-xs leading-relaxed space-y-2">
              <span className="font-bold text-[10px] text-cyan-600 dark:text-cyan-400 uppercase tracking-widest block">
                🧠 Behind The Scenes (Kubernetes Lifecycle)
              </span>
              {confirmationModal.type === 'delete' && (
                <p className="text-slate-650 dark:text-slate-350 m-0 font-bold">
                  When you delete a Pod, Kubernetes sends a <code className="font-mono text-amber-500 bg-slate-100 dark:bg-slate-850 px-1 rounded">SIGTERM</code> signal to let containers shut down gracefully (defaulting to 30 seconds). Then it runs <code className="font-mono text-red-500 bg-slate-100 dark:bg-slate-850 px-1 rounded">SIGKILL</code> to remove it. Since Pods are usually managed by Deployments, **a new Pod instance will be spun up automatically** to replace it.
                </p>
              )}
              {confirmationModal.type === 'restart' && (
                <p className="text-slate-650 dark:text-slate-350 m-0 font-bold">
                  Restarting a Deployment triggers a **Rolling Update**. Kubernetes spins up a new pod replica first, waits for it to become ready, and then kills the old replica. This guarantees **zero downtime** for your web applications.
                </p>
              )}
              {confirmationModal.type === 'scale' && (
                <p className="text-slate-650 dark:text-slate-350 m-0 font-bold">
                  Scaling tells the Controller Manager to adjust the number of active Pod replicas. Scaling up starts new pods matching your specs; scaling down gracefully terminates excess replicas using a descending rank list.
                </p>
              )}
            </div>

            {/* Inputs if Scale */}
            {confirmationModal.type === 'scale' && (
              <div className="space-y-2 text-xs">
                <label className="font-bold text-slate-500 dark:text-slate-450 block">Target Replica Count:</label>
                <div className="flex items-center space-x-3 bg-slate-50 dark:bg-[#10121a] border border-slate-200 dark:border-[#1e202a] rounded-xl p-2 max-w-[140px] select-none">
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
            <div className="flex justify-end items-center space-x-3 border-t border-slate-200 dark:border-[#1e202a] pt-4">
              <button
                onClick={() => setConfirmationModal(null)}
                disabled={operationInProgress}
                className="px-4.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#1e202a] hover:bg-slate-105 dark:hover:bg-[#13141b] text-slate-600 dark:text-slate-300 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeOperation}
                disabled={operationInProgress}
                className={`px-4.5 py-2.5 rounded-xl text-white text-xs font-bold hover:shadow-md transition disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer ${
                  confirmationModal.type === 'delete' 
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

    </div>
  );
}
