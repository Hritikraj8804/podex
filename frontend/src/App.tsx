import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Terminal,
  Cpu,
  Layers,
  AlertTriangle,
  RefreshCw,
  Trash2,
  ChevronRight,
  Search,
  HelpCircle,
  Info,
  X,
  Sliders,
  Loader2,
  BookOpen,
  ArrowRight,
  AlertCircle
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
  pod_ip: string;
  node: string;
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

interface InvestigationResponse {
  root_cause: string;
  evidence: string[];
  explanation: string;
  suggested_fix: string;
  learning: string;
  confidence: string;
}

interface LearnResponse {
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

  // AI states
  const [aiInvestigation, setAiInvestigation] = useState<InvestigationResponse | null>(null);
  const [aiInvestigating, setAiInvestigating] = useState(false);
  const [investigationStep, setInvestigationStep] = useState<string>('');
  const [aiLearning, setAiLearning] = useState<LearnResponse | null>(null);
  const [aiLearningLoading, setAiLearningLoading] = useState(false);
  const [learnQuery, setLearnQuery] = useState<string>('');

  // Confirmation Modals states
  const [confirmationModal, setConfirmationModal] = useState<{
    type: 'restart' | 'scale' | 'delete';
    name: string;
    namespace: string;
    scaleValue?: number;
  } | null>(null);
  const [operationInProgress, setOperationInProgress] = useState(false);

  // Fetch cluster stats
  const fetchStats = async (isSilent = false) => {
    try {
      if (!isSilent) setStatsLoading(true);
      const res = await fetch(`${API_URL}/api/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Error fetching stats:", e);
    } finally {
      if (!isSilent) setStatsLoading(false);
    }
  };

  // Fetch resources lists
  const fetchResources = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setResourcesLoading(true);
      const nsQuery = namespaceFilter ? `?namespace=${namespaceFilter}` : '';
      
      const [podsRes, deployRes, svcRes] = await Promise.all([
        fetch(`${API_URL}/api/pods${nsQuery}`),
        fetch(`${API_URL}/api/deployments${nsQuery}`),
        fetch(`${API_URL}/api/services${nsQuery}`)
      ]);

      if (podsRes.ok) setPods(await podsRes.json());
      if (deployRes.ok) setDeployments(await deployRes.json());
      if (svcRes.ok) setServices(await svcRes.json());
    } catch (e) {
      console.error("Error fetching resources:", e);
    } finally {
      if (!isSilent) setResourcesLoading(false);
    }
  }, [namespaceFilter]);

  // Initial load
  useEffect(() => {
    fetchStats(false);
    fetchResources(false);
    const interval = setInterval(() => {
      fetchStats(true);
      fetchResources(true);
    }, 15000); // refresh lists silently every 15s
    return () => clearInterval(interval);
  }, [fetchResources]);

  // Fetch details when resource selected or detailTab changes
  useEffect(() => {
    if (!selectedResource) return;

    const fetchDetailsData = async () => {
      setResourceDetailsLoading(true);
      const { type, name, namespace } = selectedResource;
      
      try {
        if (detailTab === 'overview') {
          const res = await fetch(`${API_URL}/api/${type}/${namespace}/${name}/details`);
          if (res.ok) setResourceDetails(await res.json());
        } else if (detailTab === 'logs') {
          const res = await fetch(`${API_URL}/api/${type}/${namespace}/${name}/logs`);
          if (res.ok) {
            const data = await res.json();
            setLogsText(data.logs);
          }
        } else if (detailTab === 'events') {
          const res = await fetch(`${API_URL}/api/${type}/${namespace}/${name}/events`);
          if (res.ok) setEventsList(await res.json());
        } else if (detailTab === 'yaml') {
          const res = await fetch(`${API_URL}/api/${type}/${namespace}/${name}/yaml`);
          if (res.ok) {
            const data = await res.json();
            setYamlText(data.yaml);
          }
        }
      } catch (e) {
        console.error("Error fetching resource details:", e);
      } finally {
        setResourceDetailsLoading(false);
      }
    };

    fetchDetailsData();
  }, [selectedResource, detailTab]);

  // Trigger AI investigation
  const runInvestigation = async () => {
    if (!selectedResource) return;
    setAiInvestigating(true);
    setAiInvestigation(null);

    const steps = [
      '🔍 Inspecting resource specifications...',
      '📋 Reading active container logs...',
      '🔔 Auditing cluster namespace events...',
      '🧠 Formulating diagnosis context...',
      '⚡ Querying AI tutor model...'
    ];

    // Simulate steps in UI for beginner experience
    for (let i = 0; i < steps.length - 1; i++) {
      setInvestigationStep(steps[i]);
      await new Promise(r => setTimeout(r, 700));
    }
    setInvestigationStep(steps[steps.length - 1]);

    try {
      const res = await fetch(`${API_URL}/api/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedResource.type,
          name: selectedResource.name,
          namespace: selectedResource.namespace
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiInvestigation(data);
      } else {
        throw new Error("Failed to investigate");
      }
    } catch (e) {
      console.error(e);
      setAiInvestigation({
        root_cause: "Investigation API failed",
        evidence: ["Failed to connect to AI server."],
        explanation: "The backend server was unable to contact the Gemini provider.",
        suggested_fix: "Check your internet connectivity or key config in backend console.",
        learning: "AI investigations require external API configurations.",
        confidence: "Low"
      });
    } finally {
      setAiInvestigating(false);
    }
  };

  // Scale, restart or delete actions
  const handleOperation = async () => {
    if (!confirmationModal) return;
    setOperationInProgress(true);
    const { type, name, namespace, scaleValue } = confirmationModal;

    try {
      let endpoint = '';
      let body: any = { name, namespace };
      
      if (type === 'scale') {
        endpoint = '/api/operations/scale';
        body.replicas = scaleValue;
      } else if (type === 'restart') {
        endpoint = '/api/operations/restart';
      } else if (type === 'delete') {
        endpoint = '/api/operations/delete';
      }

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        // Success
        setConfirmationModal(null);
        fetchResources();
        fetchStats();
        // If we deleted pod, close sidebar
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

  // Resource styling helper
  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('run') || s === 'ready' || s === 'completed' || s.includes('active')) return 'bg-emerald-950 text-emerald-400 border border-emerald-800';
    if (s.includes('backoff') || s.includes('fail') || s.includes('error') || s.includes('unhealthy')) return 'bg-red-950 text-red-400 border border-red-800';
    if (s.includes('pend') || s.includes('progress') || s.includes('terminat') || s.includes('creat')) return 'bg-amber-950 text-amber-400 border border-amber-800';
    return 'bg-slate-900 text-slate-400 border border-slate-700';
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

  return (
    <div className="flex h-screen bg-[#07080b] text-slate-100 overflow-hidden">
      
      {/* Sidebar NAVIGATION */}
      <aside className="w-64 bg-[#0d0e12] border-r border-[#1e202a] flex flex-col justify-between select-none">
        <div>
          {/* Logo Brand */}
          <div className="p-6 flex items-center space-x-3 border-b border-[#1e202a]">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-cyan-500/20">
              P
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent m-0">
                Podex
              </h1>
              <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                K8s AI Mentor
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => { setActiveTab('dashboard'); setSelectedResource(null); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition duration-200 text-sm font-medium ${
                activeTab === 'dashboard'
                  ? 'bg-gradient-to-r from-cyan-950/40 to-indigo-950/20 border border-cyan-800/40 text-cyan-400'
                  : 'text-slate-400 hover:bg-[#15171f] hover:text-slate-200'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => { setActiveTab('explorer'); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition duration-200 text-sm font-medium ${
                activeTab === 'explorer'
                  ? 'bg-gradient-to-r from-cyan-950/40 to-indigo-950/20 border border-cyan-800/40 text-cyan-400'
                  : 'text-slate-400 hover:bg-[#15171f] hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Explorer</span>
            </button>

            <button
              onClick={() => { setActiveTab('learn'); setSelectedResource(null); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition duration-200 text-sm font-medium ${
                activeTab === 'learn'
                  ? 'bg-gradient-to-r from-cyan-950/40 to-indigo-950/20 border border-cyan-800/40 text-cyan-400'
                  : 'text-slate-400 hover:bg-[#15171f] hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>AI Learning</span>
            </button>
          </nav>
        </div>

        {/* Cluster Status Footer Widget */}
        <div className="p-4 border-t border-[#1e202a]">
          <div className="bg-[#111319] rounded-2xl p-4 border border-[#1e202a]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Local Kind Cluster</span>
              <span className={`w-2.5 h-2.5 rounded-full ${stats?.status === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            </div>
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Status:</span>
              <span className="font-semibold text-slate-200 uppercase">{stats?.status || 'Offline'}</span>
            </div>
            <div className="text-xs text-slate-400 flex items-center justify-between mt-1">
              <span>API nodes:</span>
              <span className="font-semibold text-slate-200">{stats?.node_count ?? 0} active</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#07080b]">
        
        {/* Top Header Workspace */}
        <header className="h-16 border-b border-[#1e202a] flex items-center justify-between px-8 bg-[#090b0e]">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-bold text-slate-200 capitalize m-0">
              {activeTab} Space
            </h2>
            
            {/* Namespace Filter for Explorer */}
            {activeTab === 'explorer' && (
              <div className="flex items-center bg-[#111319] border border-[#1e202a] rounded-xl px-3 py-1">
                <Sliders className="w-3.5 h-3.5 text-slate-400 mr-2" />
                <span className="text-[11px] text-slate-500 mr-2 font-medium">Namespace:</span>
                <input
                  type="text"
                  placeholder="all / default / etc."
                  value={namespaceFilter}
                  onChange={(e) => setNamespaceFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 border-none outline-none focus:ring-0 p-0 w-24 font-semibold"
                />
              </div>
            )}

            {/* Show System Resources Toggle */}
            {(activeTab === 'explorer' || activeTab === 'dashboard') && (
              <label className="flex items-center space-x-2 bg-[#111319] border border-[#1e202a] rounded-xl px-3 py-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showSystemResources}
                  onChange={(e) => setShowSystemResources(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-cyan-500 bg-slate-900 border-[#1e202a]"
                />
                <span className="text-[11px] font-semibold text-slate-400">Show System Resources</span>
              </label>
            )}
          </div>

          <div className="flex items-center space-x-3 text-xs text-slate-400">
            <span>Kind Dev Mode</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          </div>
        </header>

        {/* Dynamic Views Content */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="max-w-5xl mx-auto space-y-8">
              
              {/* Welcome Banner */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-950/80 via-cyan-950/20 to-slate-950 border border-indigo-900/40 p-8">
                <div className="absolute right-0 top-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl" />
                <div className="relative z-10 space-y-2">
                  <span className="text-xs font-semibold text-cyan-400 tracking-widest uppercase">Beginner Workspace</span>
                  <h3 className="text-3xl font-extrabold text-white">Understand Kubernetes. Step by Step.</h3>
                  <p className="text-slate-400 max-w-xl text-sm leading-relaxed">
                    Welcome to Podex. We read your local Kind cluster's pods, deployments, and logs to explain errors in plain English. No complicated commands required.
                  </p>
                  <div className="pt-4 flex items-center space-x-3">
                    <button
                      onClick={() => setActiveTab('explorer')}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-medium text-xs hover:shadow-lg hover:shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] transition duration-200 flex items-center"
                    >
                      <span>Explore Active Cluster</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-1.5" />
                    </button>
                    <button
                      onClick={() => setActiveTab('learn')}
                      className="px-5 py-2.5 rounded-xl bg-[#111319] hover:bg-[#151821] text-slate-300 border border-[#1e202a] font-medium text-xs transition duration-200 flex items-center"
                    >
                      <span>Ask AI Tutor</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats Counters Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                
                {/* Stat item */}
                <div className="bg-[#0c0e13] border border-[#1e202a] rounded-2xl p-6 hover:border-cyan-800/40 transition duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Nodes</span>
                    <Cpu className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-4xl font-extrabold text-white">
                      {statsLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-500" /> : stats?.node_count ?? 0}
                    </span>
                    <span className="text-xs text-slate-500">running</span>
                  </div>
                </div>

                <div className="bg-[#0c0e13] border border-[#1e202a] rounded-2xl p-6 hover:border-violet-850/40 transition duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pods</span>
                    <Layers className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-4xl font-extrabold text-white">
                      {statsLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-500" /> : (showSystemResources ? (stats?.pod_count ?? 0) : filteredPods.length)}
                    </span>
                    <span className="text-xs text-slate-500">instances</span>
                  </div>
                </div>

                <div className="bg-[#0c0e13] border border-[#1e202a] rounded-2xl p-6 hover:border-indigo-800/40 transition duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Deployments</span>
                    <Activity className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-4xl font-extrabold text-white">
                      {statsLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-500" /> : (showSystemResources ? (stats?.deployment_count ?? 0) : filteredDeployments.length)}
                    </span>
                    <span className="text-xs text-slate-500">specifications</span>
                  </div>
                </div>

                <div className="bg-[#0c0e13] border border-[#1e202a] rounded-2xl p-6 hover:border-emerald-800/40 transition duration-200">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Services</span>
                    <Terminal className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-4xl font-extrabold text-white">
                      {statsLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-500" /> : (showSystemResources ? (stats?.service_count ?? 0) : filteredServices.length)}
                    </span>
                    <span className="text-xs text-slate-500">routing entries</span>
                  </div>
                </div>
              </div>

              {/* Educational Getting Started Card */}
              <div className="bg-[#0a0c10] border border-[#1e202a] rounded-3xl p-8 space-y-6">
                <h4 className="text-lg font-bold text-slate-200 flex items-center space-x-2">
                  <HelpCircle className="w-5 h-5 text-cyan-400" />
                  <span>Kubernetes Crash Course</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  <div className="bg-[#0e1017] border border-[#1e202a] p-5 rounded-2xl space-y-3">
                    <span className="w-8 h-8 rounded-full bg-cyan-950/60 border border-cyan-800 text-cyan-400 flex items-center justify-center font-bold text-sm">
                      1
                    </span>
                    <h5 className="font-bold text-sm text-slate-200">What is a Pod?</h5>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      A Pod is the smallest runnable container instance. It runs your application logic. If a Pod turns red, it usually means the application code inside crashed or could not boot.
                    </p>
                    <button
                      onClick={() => { setActiveTab('learn'); handleLearnQuery('What is a Pod?'); }}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center"
                    >
                      <span>Learn Analogy</span>
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </button>
                  </div>

                  <div className="bg-[#0e1017] border border-[#1e202a] p-5 rounded-2xl space-y-3">
                    <span className="w-8 h-8 rounded-full bg-indigo-950/60 border border-indigo-800 text-indigo-400 flex items-center justify-center font-bold text-sm">
                      2
                    </span>
                    <h5 className="font-bold text-sm text-slate-200">What is a Deployment?</h5>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      A Deployment supervises Pods. It makes sure you have the exact number of Pods you wanted. If you ask for 3 replicas, it automatically replaces any Pod that crashes.
                    </p>
                    <button
                      onClick={() => { setActiveTab('learn'); handleLearnQuery('What is a Deployment?'); }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center"
                    >
                      <span>Learn Analogy</span>
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </button>
                  </div>

                  <div className="bg-[#0e1017] border border-[#1e202a] p-5 rounded-2xl space-y-3">
                    <span className="w-8 h-8 rounded-full bg-emerald-950/60 border border-emerald-800 text-emerald-400 flex items-center justify-center font-bold text-sm">
                      3
                    </span>
                    <h5 className="font-bold text-sm text-slate-200">What is a Service?</h5>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      A Service is like a phone operator. Since Pods get restarted and change IP addresses constantly, a Service provides a single, unchanging IP address to routing calls to them.
                    </p>
                    <button
                      onClick={() => { setActiveTab('learn'); handleLearnQuery('What is a Service?'); }}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center"
                    >
                      <span>Learn Analogy</span>
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </button>
                  </div>

                </div>
              </div>

            </div>
          )}

          {/* TAB 2: EXPLORER */}
          {activeTab === 'explorer' && (
            <div className="max-w-6xl mx-auto space-y-6">
              
              {/* Explorer Tabs & Filters */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                
                {/* Resource SubTabs */}
                <div className="flex space-x-1 bg-[#10121a] p-1 border border-[#1e202a] rounded-xl select-none">
                  <button
                    onClick={() => { setExplorerSubTab('pods'); setSelectedResource(null); }}
                    className={`px-4 py-2 rounded-lg font-semibold text-xs transition duration-200 ${
                      explorerSubTab === 'pods'
                        ? 'bg-[#1e2030] text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Pods
                  </button>
                  <button
                    onClick={() => { setExplorerSubTab('deployments'); setSelectedResource(null); }}
                    className={`px-4 py-2 rounded-lg font-semibold text-xs transition duration-200 ${
                      explorerSubTab === 'deployments'
                        ? 'bg-[#1e2030] text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Deployments
                  </button>
                  <button
                    onClick={() => { setExplorerSubTab('services'); setSelectedResource(null); }}
                    className={`px-4 py-2 rounded-lg font-semibold text-xs transition duration-200 ${
                      explorerSubTab === 'services'
                        ? 'bg-[#1e2030] text-slate-100'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Services
                  </button>
                </div>

                {/* Search Resource Bar */}
                <div className="flex items-center bg-[#10121a] border border-[#1e202a] rounded-xl px-3 py-2 w-full md:w-64">
                  <Search className="w-4 h-4 text-slate-400 mr-2" />
                  <input
                    type="text"
                    placeholder="Search by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-transparent text-xs text-slate-200 border-none outline-none focus:ring-0 p-0 w-full"
                  />
                </div>
              </div>

              {/* Resource Table Render */}
              <div className="bg-[#0b0c10] border border-[#1e202a] rounded-2xl overflow-hidden">
                {resourcesLoading ? (
                  <div className="p-12 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                    <span className="text-xs text-slate-400">Loading resources from cluster...</span>
                  </div>
                ) : (
                  <div>
                    {/* PODS List */}
                    {explorerSubTab === 'pods' && (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#1e202a] text-slate-500 text-[10px] uppercase font-bold tracking-wider bg-[#0d0f14]">
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Namespace</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-center">Restarts</th>
                            <th className="px-6 py-4">Pod IP</th>
                            <th className="px-6 py-4">Node</th>
                            <th className="px-6 py-4">Age</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#13151c] text-xs">
                          {filteredPods.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-medium">
                                No Pods found in namespace.
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
                                className={`hover:bg-[#10121c]/60 cursor-pointer transition ${
                                  selectedResource?.name === pod.name ? 'bg-[#10121c]' : ''
                                }`}
                              >
                                <td className="px-6 py-4 font-semibold text-slate-200">{pod.name}</td>
                                <td className="px-6 py-4 text-slate-400">{pod.namespace}</td>
                                <td className="px-6 py-4">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(pod.status)}`}>
                                    {pod.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center text-slate-400 font-semibold">{pod.restarts}</td>
                                <td className="px-6 py-4 text-slate-400">{pod.pod_ip}</td>
                                <td className="px-6 py-4 text-slate-400">{pod.node}</td>
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
                          <tr className="border-b border-[#1e202a] text-slate-500 text-[10px] uppercase font-bold tracking-wider bg-[#0d0f14]">
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Namespace</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-center">Desired</th>
                            <th className="px-6 py-4 text-center">Ready</th>
                            <th className="px-6 py-4 text-center">Available</th>
                            <th className="px-6 py-4">Age</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#13151c] text-xs">
                          {filteredDeployments.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-medium">
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
                                className={`hover:bg-[#10121c]/60 cursor-pointer transition ${
                                  selectedResource?.name === deploy.name ? 'bg-[#10121c]' : ''
                                }`}
                              >
                                <td className="px-6 py-4 font-semibold text-slate-200">{deploy.name}</td>
                                <td className="px-6 py-4 text-slate-400">{deploy.namespace}</td>
                                <td className="px-6 py-4">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(deploy.status)}`}>
                                    {deploy.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center text-slate-400 font-semibold">{deploy.replicas_desired}</td>
                                <td className="px-6 py-4 text-center text-slate-400 font-semibold">{deploy.replicas_ready}</td>
                                <td className="px-6 py-4 text-center text-slate-400 font-semibold">{deploy.replicas_available}</td>
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
                          <tr className="border-b border-[#1e202a] text-slate-500 text-[10px] uppercase font-bold tracking-wider bg-[#0d0f14]">
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Namespace</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4">Cluster IP</th>
                            <th className="px-6 py-4">External IP</th>
                            <th className="px-6 py-4">Ports</th>
                            <th className="px-6 py-4">Age</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#13151c] text-xs">
                          {filteredServices.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-medium">
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
                                className={`hover:bg-[#10121c]/60 cursor-pointer transition ${
                                  selectedResource?.name === svc.name ? 'bg-[#10121c]' : ''
                                }`}
                              >
                                <td className="px-6 py-4 font-semibold text-slate-200">{svc.name}</td>
                                <td className="px-6 py-4 text-slate-400">{svc.namespace}</td>
                                <td className="px-6 py-4 text-slate-400 font-medium">{svc.type}</td>
                                <td className="px-6 py-4 text-slate-400 font-mono">{svc.cluster_ip}</td>
                                <td className="px-6 py-4 text-slate-400">{svc.external_ip}</td>
                                <td className="px-6 py-4 text-slate-400 font-mono">{svc.ports}</td>
                                <td className="px-6 py-4 text-slate-500">{svc.age}</td>
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
            <div className="max-w-4xl mx-auto space-y-8">
              
              <div className="text-center space-y-3">
                <h3 className="text-2xl font-bold text-slate-200 m-0">Ask Podex AI Anything</h3>
                <p className="text-xs text-slate-400 max-w-lg mx-auto">
                  Type a Kubernetes concept, resource name, or error code. Your AI mentor will explain it using real-world analogies.
                </p>
              </div>

              {/* Chat Input query */}
              <div className="flex bg-[#10121a] border border-[#1e202a] rounded-2xl p-2 max-w-2xl mx-auto">
                <input
                  type="text"
                  placeholder="Explain: Port Forwarding / CrashLoopBackOff / ConfigMap..."
                  value={learnQuery}
                  onChange={(e) => setLearnQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLearnQuery(''); }}
                  className="bg-transparent text-sm text-slate-200 border-none outline-none focus:ring-0 p-3 flex-grow"
                />
                <button
                  onClick={() => handleLearnQuery('')}
                  disabled={aiLearningLoading}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:shadow-lg hover:shadow-cyan-500/10 font-bold text-xs text-white transition disabled:opacity-50 flex items-center space-x-2"
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
                    className="px-3.5 py-1.5 rounded-full bg-[#111319] hover:bg-[#161a24] border border-[#1e202a] text-xs text-slate-400 hover:text-slate-200 transition"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* AI Explanation Card Render */}
              {aiLearningLoading && (
                <div className="bg-[#0b0c10] border border-[#1e202a] rounded-3xl p-12 flex flex-col items-center justify-center space-y-4 max-w-2xl mx-auto">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                  <span className="text-xs text-slate-400 font-medium">Tutor is compiling explanation...</span>
                </div>
              )}

              {aiLearning && (
                <div className="bg-[#0c0e15] border border-[#1e202d] rounded-3xl p-8 space-y-6 max-w-2xl mx-auto">
                  
                  {/* Topic Title */}
                  <div className="flex items-center space-x-3 border-b border-[#1e202a] pb-4">
                    <div className="w-10 h-10 rounded-xl bg-cyan-950/50 border border-cyan-800 text-cyan-400 flex items-center justify-center font-bold">
                      ?
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-100 m-0">{aiLearning.concept}</h4>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">AI-Powered Explanation</span>
                    </div>
                  </div>

                  {/* Body Sections */}
                  <div className="space-y-6 text-sm leading-relaxed">
                    
                    {/* Explanation */}
                    <div className="space-y-1.5">
                      <h5 className="font-bold text-xs text-slate-400 uppercase tracking-wider">What it is</h5>
                      <p className="text-slate-300">{aiLearning.explanation}</p>
                    </div>

                    {/* Analogy */}
                    <div className="bg-[#0f121d] border border-indigo-900/30 rounded-2xl p-5 space-y-2">
                      <h5 className="font-bold text-xs text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
                        <Info className="w-3.5 h-3.5" />
                        <span>Analogy for Beginners</span>
                      </h5>
                      <p className="text-slate-300 italic">
                        "{aiLearning.real_world_analogy}"
                      </p>
                    </div>

                    {/* Why it exists */}
                    <div className="space-y-1.5">
                      <h5 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Why it exists in K8s</h5>
                      <p className="text-slate-300">{aiLearning.why_it_exists}</p>
                    </div>

                    {/* Gotchas */}
                    {aiLearning.common_gotchas && aiLearning.common_gotchas.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="font-bold text-xs text-amber-500 uppercase tracking-wider">Common Gotchas</h5>
                        <ul className="space-y-1.5 list-disc pl-5 text-slate-300">
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
        <aside className="w-[500px] border-l border-[#1e202a] bg-[#090a0e] flex flex-col z-20 shadow-2xl">
          
          {/* Header */}
          <div className="p-6 border-b border-[#1e202a] flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                {selectedResource.type} Details
              </span>
              <h3 className="text-base font-bold text-slate-200 truncate m-0">
                {selectedResource.name}
              </h3>
              <span className="text-xs text-slate-400 truncate block mt-0.5">
                Namespace: {selectedResource.namespace}
              </span>
            </div>
            <button
              onClick={() => setSelectedResource(null)}
              className="p-1.5 rounded-lg hover:bg-[#1a1c25] text-slate-500 hover:text-slate-300 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Operations Confirmation triggers */}
          <div className="px-6 py-4 bg-[#0d0f15] border-b border-[#1e202a] flex items-center justify-start space-x-2">
            
            {/* Delete Pod */}
            {selectedResource.type === 'pod' && (
              <button
                onClick={() => setConfirmationModal({
                  type: 'delete',
                  name: selectedResource.name,
                  namespace: selectedResource.namespace
                })}
                className="px-3.5 py-2 rounded-xl bg-red-950/30 hover:bg-red-950/60 border border-red-900/50 hover:border-red-800 text-red-400 font-bold text-[11px] transition flex items-center space-x-1.5"
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
                  className="px-3.5 py-2 rounded-xl bg-cyan-950/30 hover:bg-cyan-950/60 border border-cyan-900/50 hover:border-cyan-800 text-cyan-400 font-bold text-[11px] transition flex items-center space-x-1.5"
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
                  className="px-3.5 py-2 rounded-xl bg-amber-950/30 hover:bg-amber-950/60 border border-amber-900/50 hover:border-amber-800 text-amber-400 font-bold text-[11px] transition flex items-center space-x-1.5"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Scale Replicas</span>
                </button>
              </>
            )}
          </div>

          {/* Sub-tab Select for Resource details */}
          <div className="flex border-b border-[#1e202a] text-xs select-none">
            {(['overview', 'logs', 'events', 'yaml', 'investigate'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setDetailTab(tab)}
                className={`flex-1 py-3 font-semibold text-center border-b-2 capitalize transition duration-150 ${
                  detailTab === tab
                    ? 'border-cyan-500 text-cyan-400 bg-cyan-950/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Details Content Render */}
          <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-[#090b0f]">
            {resourceDetailsLoading ? (
              <div className="flex flex-col items-center justify-center h-48 space-y-4">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                <span className="text-xs text-slate-400">Loading details...</span>
              </div>
            ) : (
              <div>
                
                {/* TAB: OVERVIEW */}
                {detailTab === 'overview' && resourceDetails && (
                  <div className="space-y-4 text-xs">
                    
                    {/* Status overview list info */}
                    <div className="bg-[#10121a] p-4 rounded-xl border border-[#1e202a] space-y-3">
                      <h4 className="font-bold text-slate-300">Specifications</h4>
                      <div className="grid grid-cols-3 gap-2">
                        <span className="text-slate-500">Resource:</span>
                        <span className="col-span-2 text-slate-300 font-semibold">{selectedResource.type}</span>
                        
                        <span className="text-slate-500">Kind:</span>
                        <span className="col-span-2 text-slate-300 font-mono">{resourceDetails.kind}</span>

                        <span className="text-slate-500">API Version:</span>
                        <span className="col-span-2 text-slate-300 font-mono">{resourceDetails.api_version}</span>
                        
                        <span className="text-slate-500">Created:</span>
                        <span className="col-span-2 text-slate-300">{resourceDetails.metadata?.creation_timestamp}</span>
                      </div>
                    </div>

                    {/* Metadata labels */}
                    {resourceDetails.metadata?.labels && (
                      <div className="bg-[#10121a] p-4 rounded-xl border border-[#1e202a] space-y-2">
                        <h4 className="font-bold text-slate-300">Labels</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(resourceDetails.metadata.labels).map(([k, v]) => (
                            <span key={k} className="px-2.5 py-0.5 rounded-md bg-[#161a25] border border-cyan-950 text-cyan-400 font-mono text-[10px]">
                              {k}={String(v)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Container details if Pod */}
                    {selectedResource.type === 'pod' && resourceDetails.spec?.containers && (
                      <div className="bg-[#10121a] p-4 rounded-xl border border-[#1e202a] space-y-3">
                        <h4 className="font-bold text-slate-300">Containers</h4>
                        {resourceDetails.spec.containers.map((container: any) => (
                          <div key={container.name} className="border-t border-[#1e202a] pt-2 mt-2 first:border-none first:pt-0 first:mt-0 space-y-1">
                            <div className="flex justify-between font-semibold text-slate-200">
                              <span>{container.name}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-1.5 text-slate-400">
                              <span>Image:</span>
                              <span className="col-span-2 text-slate-300 font-mono break-all">{container.image}</span>

                              <span>Pull Policy:</span>
                              <span className="col-span-2 text-slate-300">{container.image_pull_policy}</span>
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
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-medium">Last 100 log entries</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(logsText);
                          alert("Logs copied to clipboard!");
                        }}
                        className="text-[10px] text-cyan-400 font-bold hover:text-cyan-300"
                      >
                        Copy Logs
                      </button>
                    </div>
                    <pre className="w-full bg-[#050608] border border-[#161822] rounded-xl p-4 text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap font-mono h-96">
                      {logsText || "No logs generated by container or unavailable."}
                    </pre>
                  </div>
                )}

                {/* TAB: EVENTS */}
                {detailTab === 'events' && (
                  <div className="space-y-3 text-xs">
                    {eventsList.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 font-medium">
                        No events recorded for this resource.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {eventsList.map((ev, idx) => (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-xl border flex items-start space-x-3 ${
                              ev.type === 'Warning'
                                ? 'bg-amber-950/20 border-amber-900/40 text-amber-300'
                                : 'bg-[#10121a] border-[#1e202a] text-slate-300'
                            }`}
                          >
                            {ev.type === 'Warning' ? (
                              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            ) : (
                              <Info className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                            )}
                            <div className="space-y-0.5">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-[11px]">{ev.reason}</span>
                                <span className="text-[10px] text-slate-500">count: {ev.count}</span>
                              </div>
                              <p className="text-xs text-slate-400 leading-normal">{ev.message}</p>
                              <span className="text-[9px] text-slate-500 block">{ev.last_timestamp} ago</span>
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
                      <span className="text-slate-400 font-medium">Kubernetes YAML Manifest</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(yamlText);
                          alert("YAML copied to clipboard!");
                        }}
                        className="text-[10px] text-cyan-400 font-bold hover:text-cyan-300"
                      >
                        Copy YAML
                      </button>
                    </div>
                    <pre className="w-full bg-[#050608] border border-[#161822] rounded-xl p-4 text-[10px] text-slate-300 overflow-auto whitespace-pre font-mono h-96">
                      {yamlText || "Fetching YAML spec..."}
                    </pre>
                  </div>
                )}

                {/* TAB: INVESTIGATE */}
                {detailTab === 'investigate' && (
                  <div className="space-y-6">
                    
                    {/* Explain workflow trigger */}
                    {!aiInvestigating && !aiInvestigation && (
                      <div className="bg-[#10121a] border border-[#1e202a] p-6 rounded-2xl text-center space-y-4">
                        <HelpCircle className="w-8 h-8 text-cyan-400 mx-auto" />
                        <h4 className="font-bold text-sm text-slate-200">Run AI Diagnosis</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Click below to have Podex analyze logs, recent events, and configuration parameters of this resource.
                        </p>
                        <button
                          onClick={runInvestigation}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 font-bold text-xs text-white hover:shadow-lg hover:shadow-cyan-500/10 transition"
                        >
                          Investigate with AI Mentor
                        </button>
                      </div>
                    )}

                    {/* Investigation Loading states */}
                    {aiInvestigating && (
                      <div className="bg-[#10121a] border border-[#1e202a] p-8 rounded-2xl text-center space-y-4 flex flex-col items-center">
                        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                        <h4 className="font-bold text-sm text-slate-200">Analyzing Cluster State</h4>
                        <p className="text-xs text-slate-400 font-medium animate-pulse">
                          {investigationStep}
                        </p>
                      </div>
                    )}

                    {/* Diagnosis Report Result */}
                    {aiInvestigation && (
                      <div className="space-y-6 text-xs text-slate-300 leading-relaxed">
                        
                        {/* Root cause Banner */}
                        <div className="bg-red-950/20 border border-red-900/40 rounded-2xl p-5 space-y-2">
                          <h5 className="font-bold text-[11px] text-red-400 uppercase tracking-widest flex items-center space-x-1.5">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                            <span>Root Cause</span>
                          </h5>
                          <p className="text-slate-100 font-semibold text-sm">
                            {aiInvestigation.root_cause}
                          </p>
                        </div>

                        {/* Evidence block */}
                        {aiInvestigation.evidence && aiInvestigation.evidence.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="font-bold text-[11px] text-slate-400 uppercase tracking-wider">Supporting Evidence</h5>
                            <div className="bg-[#0b0c10] border border-[#1b1c24] rounded-xl p-4 font-mono text-[10px] space-y-1.5">
                              {aiInvestigation.evidence.map((line, idx) => (
                                <div key={idx} className="flex items-start text-red-300/80">
                                  <span className="text-red-500 mr-2 font-bold select-none">&gt;</span>
                                  <span>{line}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Description explanation */}
                        <div className="space-y-1.5">
                          <h5 className="font-bold text-[11px] text-slate-400 uppercase tracking-wider">Explanation</h5>
                          <p className="text-slate-300">{aiInvestigation.explanation}</p>
                        </div>

                        {/* Suggested Fix */}
                        <div className="space-y-2">
                          <h5 className="font-bold text-[11px] text-cyan-400 uppercase tracking-wider">Suggested Fix</h5>
                          <div className="bg-[#050608] border border-[#161822] rounded-xl p-4 whitespace-pre-wrap font-mono text-[10px] text-emerald-400 leading-relaxed">
                            {aiInvestigation.suggested_fix}
                          </div>
                        </div>

                        {/* Concept learning */}
                        <div className="bg-[#0f121d] border border-indigo-900/30 rounded-2xl p-5 space-y-2">
                          <h5 className="font-bold text-[11px] text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Tutor Lesson</span>
                          </h5>
                          <p className="text-slate-300 italic">
                            {aiInvestigation.learning}
                          </p>
                          <div className="flex items-center justify-between pt-2 border-t border-indigo-950/60 mt-2">
                            <span className="text-[10px] text-slate-500">Confidence Analysis</span>
                            <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 font-bold text-[9px]">
                              {aiInvestigation.confidence}
                            </span>
                          </div>
                        </div>

                        {/* Re-investigate Button */}
                        <button
                          onClick={runInvestigation}
                          className="w-full py-2 px-4 rounded-xl bg-[#111319] hover:bg-[#161a24] text-slate-400 hover:text-slate-200 border border-[#1e202a] text-xs font-semibold transition"
                        >
                          Run Diagnosis Again
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

      {/* CONFIRMATION OPERATIONAL ACTION MODAL */}
      {confirmationModal && (
        <div className="fixed inset-0 bg-[#000000]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a0c10] border border-[#1e202e] rounded-3xl p-6 space-y-6 shadow-2xl">
            
            {/* Header info */}
            <div className="flex items-start space-x-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-950/60 border border-amber-800 text-amber-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-100 m-0">Confirm Destructive Action</h4>
                <p className="text-xs text-slate-400 leading-normal">
                  You are requested to execute <strong>{confirmationModal.type}</strong> on the resource <strong>{confirmationModal.name}</strong>.
                </p>
              </div>
            </div>

            {/* Explanation section for beginners before executing action */}
            <div className="bg-[#0f1118] border border-[#1e202a] p-4 rounded-2xl text-xs space-y-2 text-slate-300 leading-relaxed">
              <span className="font-bold text-[10px] text-cyan-400 uppercase tracking-wider block">Explain before Execute</span>
              {confirmationModal.type === 'delete' && (
                <p>
                  Deleting a Pod tells Kubernetes to terminate the container. If this Pod is managed by a Deployment, the Deployment will detect the missing Pod and immediately launch a brand new instance in its place (self-healing).
                </p>
              )}
              {confirmationModal.type === 'restart' && (
                <p>
                  Restarting a Deployment does a "rolling restart". It launches a new Pod first, checks if it is healthy, and only then deletes the old Pod. This ensures your app stays online during the process with zero downtime.
                </p>
              )}
              {confirmationModal.type === 'scale' && (
                <p>
                  Scaling changes the number of replicas (identical workers). Kubernetes will automatically spin up additional container instances or tear down extra ones to match your new setting.
                </p>
              )}
            </div>

            {/* Scale Value adjust parameter if scaling */}
            {confirmationModal.type === 'scale' && (
              <div className="space-y-2 text-xs">
                <label className="font-bold text-slate-400">Desired Replicas Count:</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={confirmationModal.scaleValue ?? 1}
                    onChange={(e) => setConfirmationModal({
                      ...confirmationModal,
                      scaleValue: parseInt(e.target.value) || 0
                    })}
                    className="w-20 bg-[#11131a] border border-[#1e202a] rounded-xl px-3 py-2 text-sm text-slate-200 font-bold font-mono focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-500">(Limits: 0 to 10 for local Kind)</span>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center space-x-3.5">
              <button
                onClick={() => setConfirmationModal(null)}
                disabled={operationInProgress}
                className="flex-1 py-2.5 rounded-xl bg-[#111319] border border-[#1e202a] text-slate-400 hover:text-slate-200 text-xs font-semibold transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleOperation}
                disabled={operationInProgress}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs text-white transition disabled:opacity-50 flex items-center justify-center space-x-2 ${
                  confirmationModal.type === 'delete'
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-cyan-500 hover:bg-cyan-400'
                }`}
              >
                {operationInProgress ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Execute Action</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
