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
  Settings,
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
  Link2,
  Menu,
  PanelLeftClose,
  Network
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

function FormattedText({ text, isCode = false, onShowToast }: { text: string; isCode?: boolean; onShowToast?: (msg: string, type: 'success' | 'error' | 'info') => void }) {
  if (!text) return null;

  // Preprocess text to handle formatting errors like missing newlines between numbered items.
  // 1. Convert merged list patterns like "Error!2. Examine" to "Error!\n2. Examine"
  let processed = text.replace(/([.!?]['"]?)\s*(\d+)\.\s*/g, '$1\n$2. ');

  // 2. Convert standalone numbers followed by a newline and text: "1\nInspect" to "1. Inspect"
  processed = processed.replace(/^(\d+)\s*\n\s*([a-zA-Z])/gm, '$1. $2');

  const rawLines = processed.split('\n');
  const lines: string[] = [];

  for (let line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if the line has multiple inline numbers like "2. Some text 3. Other text" and split them
    const inlineMatches = trimmed.split(/\s+(?=\d+\.\s+)/);
    if (inlineMatches.length > 1) {
      lines.push(...inlineMatches);
    } else {
      lines.push(trimmed);
    }
  }

  const regex = /(\*\*.*?\*\*|`.*?`)/g;

  const parseInlineMarkdown = (str: string) => {
    const parts = str.split(regex);
    return parts.map((part, pIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={pIdx} className="font-bold text-slate-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        const codeText = part.slice(1, -1);
        const isCmd = codeText.startsWith('kubectl ') || codeText.startsWith('docker ') || codeText.startsWith('minikube ') || codeText.startsWith('kind ');
        if (isCmd) {
          return (
            <span key={pIdx} className="inline-flex items-center space-x-1.5 bg-slate-950 dark:bg-slate-900 text-emerald-400 dark:text-emerald-400 font-mono px-2 py-0.5 rounded border border-slate-205 dark:border-slate-800 mx-1 text-[11px] shadow-sm select-all">
              <span>{codeText}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(codeText);
                  if (onShowToast) {
                    onShowToast("Copied command!", "success");
                  } else {
                    alert("Copied command!");
                  }
                }}
                className="text-[9px] text-cyan-500 hover:text-cyan-400 font-bold ml-1 cursor-pointer select-none hover:underline"
                title="Copy Command"
              >
                Copy
              </button>
            </span>
          );
        }
        return (
          <code key={pIdx} className="font-mono bg-slate-100 dark:bg-slate-800/80 text-cyan-600 dark:text-cyan-400 px-1 py-0.5 rounded text-[11px] font-semibold border border-slate-200/50 dark:border-slate-800">
            {codeText}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-3">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-1" />;

        // Detect comments
        const isComment = trimmed.startsWith('//') || trimmed.startsWith('#');
        let displayLine = trimmed;
        if (isComment) {
          displayLine = trimmed.replace(/^(\/\/|#)\s*/, '');
        }

        // Detect commands/code
        const isCommandLine = !isComment && (
          trimmed.startsWith('kubectl ') ||
          trimmed.startsWith('docker ') ||
          trimmed.startsWith('npm ') ||
          trimmed.startsWith('cd ') ||
          trimmed.startsWith('git ') ||
          trimmed.startsWith('python ') ||
          trimmed.startsWith('uvicorn ') ||
          trimmed.startsWith('curl ') ||
          trimmed.startsWith('export ') ||
          trimmed.startsWith('minikube ') ||
          trimmed.startsWith('kind ') ||
          isCode
        );

        if (isComment) {
          return (
            <p key={idx} className="text-slate-400 dark:text-slate-500 italic text-[11px] font-mono pl-1">
              // {parseInlineMarkdown(displayLine)}
            </p>
          );
        }

        if (isCommandLine) {
          return (
            <div key={idx} className="bg-slate-950 dark:bg-[#040507] text-emerald-400 dark:text-emerald-500 font-mono px-4 py-3 rounded-xl border border-slate-205 dark:border-slate-850 text-[11px] overflow-x-auto flex items-center justify-between group shadow-inner my-2">
              <div className="flex items-center space-x-2 min-w-0">
                <span className="text-slate-650 dark:text-slate-500 select-none font-bold">$</span>
                <span className="select-all truncate">{displayLine}</span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(displayLine);
                  if (onShowToast) {
                    onShowToast("Copied command!", "success");
                  } else {
                    alert("Copied command!");
                  }
                }}
                className="opacity-0 group-hover:opacity-100 text-[10px] text-cyan-500 hover:text-cyan-400 font-bold transition ml-2 shrink-0 cursor-pointer"
                title="Copy Command"
              >
                Copy
              </button>
            </div>
          );
        }

        // Bullet lists
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const listContent = trimmed.slice(2);
          return (
            <div key={idx} className="flex items-start space-x-2 pl-1.5 my-1.5">
              <span className="text-cyan-500 mt-1.5 shrink-0 text-xs font-bold">•</span>
              <span className="text-slate-650 dark:text-slate-300 font-medium text-xs leading-relaxed">{parseInlineMarkdown(listContent)}</span>
            </div>
          );
        }

        // Numbered lists (e.g. 1. , 2. )
        const numberedListMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numberedListMatch) {
          const num = numberedListMatch[1];
          const listContent = numberedListMatch[2];
          return (
            <div key={idx} className="flex items-start space-x-3 pl-1 my-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 font-extrabold text-[10px] shrink-0 mt-0.5 border border-cyan-200/40 dark:border-cyan-800/30">
                {num}
              </span>
              <span className="text-slate-650 dark:text-slate-300 font-medium text-xs leading-relaxed mt-0.5">{parseInlineMarkdown(listContent)}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="text-slate-655 dark:text-slate-300 leading-relaxed font-medium text-xs">
            {parseInlineMarkdown(displayLine)}
          </p>
        );
      })}
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'explorer' | 'learn' | 'settings' | 'diagram'>('dashboard');

  // Topology States
  const [topologyData, setTopologyData] = useState<{ nodes: any[], edges: any[] }>({ nodes: [], edges: [] });
  const [topologyLoading, setTopologyLoading] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [svgPaths, setSvgPaths] = useState<{ id: string, d: string, active: boolean, type: string }[]>([]);

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

  // Theme Accent presets
  const [accentColor, setAccentColorState] = useState<'cyan' | 'indigo' | 'violet' | 'emerald' | 'amber'>(() => {
    return (localStorage.getItem('accentColor') as any) || 'cyan';
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
  const setAccentColor = (val: 'cyan' | 'indigo' | 'violet' | 'emerald' | 'amber') => {
    setAccentColorState(val);
    localStorage.setItem('accentColor', val);
  };

  const getAccentColor = (type: 'text' | 'bg' | 'bgMuted' | 'border' | 'hoverText' | 'focusRing' | 'glow') => {
    switch (accentColor) {
      case 'indigo':
        if (type === 'text') return 'text-indigo-650 dark:text-indigo-400';
        if (type === 'bg') return 'bg-indigo-600';
        if (type === 'bgMuted') return 'bg-indigo-500/10 dark:bg-indigo-500/5';
        if (type === 'border') return 'border-indigo-500';
        if (type === 'hoverText') return 'hover:text-indigo-650 dark:hover:text-indigo-400';
        if (type === 'glow') return 'shadow-indigo-500/10';
        return 'focus:ring-indigo-500';
      case 'violet':
        if (type === 'text') return 'text-violet-650 dark:text-violet-400';
        if (type === 'bg') return 'bg-violet-600';
        if (type === 'bgMuted') return 'bg-violet-500/10 dark:bg-violet-500/5';
        if (type === 'border') return 'border-violet-500';
        if (type === 'hoverText') return 'hover:text-violet-655 dark:hover:text-violet-400';
        if (type === 'glow') return 'shadow-violet-500/10';
        return 'focus:ring-violet-500';
      case 'emerald':
        if (type === 'text') return 'text-emerald-650 dark:text-emerald-400';
        if (type === 'bg') return 'bg-emerald-600';
        if (type === 'bgMuted') return 'bg-emerald-500/10 dark:bg-emerald-500/5';
        if (type === 'border') return 'border-emerald-500';
        if (type === 'hoverText') return 'hover:text-emerald-650 dark:hover:text-emerald-400';
        if (type === 'glow') return 'shadow-emerald-500/10';
        return 'focus:ring-emerald-500';
      case 'amber':
        if (type === 'text') return 'text-amber-650 dark:text-amber-400';
        if (type === 'bg') return 'bg-amber-600';
        if (type === 'bgMuted') return 'bg-amber-500/10 dark:bg-amber-500/5';
        if (type === 'border') return 'border-amber-500';
        if (type === 'hoverText') return 'hover:text-amber-650 dark:hover:text-amber-400';
        if (type === 'glow') return 'shadow-amber-500/10';
        return 'focus:ring-amber-500';
      default: // cyan
        if (type === 'text') return 'text-cyan-650 dark:text-cyan-400';
        if (type === 'bg') return 'bg-cyan-500';
        if (type === 'bgMuted') return 'bg-cyan-500/10 dark:bg-cyan-500/5';
        if (type === 'border') return 'border-cyan-500';
        if (type === 'hoverText') return 'hover:text-cyan-650 dark:hover:text-cyan-400';
        if (type === 'glow') return 'shadow-cyan-500/10';
        return 'focus:ring-cyan-500';
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

  // Terminal States
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalBuffer, setTerminalBuffer] = useState<{ type: 'input' | 'output' | 'error', text: string, cmd?: string }[]>([
    { type: 'output', text: 'Podex Web Shell Console initialized.\nType your commands and press Enter (e.g. ls, pwd, env, cat /etc/nginx/nginx.conf)\n' }
  ]);
  const [terminalHistory, setTerminalHistory] = useState<string[]>([]);
  const [terminalHistoryIndex, setTerminalHistoryIndex] = useState(-1);
  const [terminalExecuting, setTerminalExecuting] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

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

  // Initial loading and background poll
  useEffect(() => {
    fetchStats();
    fetchResources();
    fetchTopology();

    const interval = setInterval(() => {
      fetchStats(true);
      fetchResources(true);
      fetchTopology(true);
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [fetchStats, fetchResources, fetchTopology, refreshInterval]);

  const isNodeConnected = useCallback((nodeId: string) => {
    if (!hoveredNodeId) return true;
    if (nodeId === hoveredNodeId) return true;
    return topologyData.edges.some(edge => 
      (edge.source === hoveredNodeId && edge.target === nodeId) ||
      (edge.target === hoveredNodeId && edge.source === nodeId)
    );
  }, [hoveredNodeId, topologyData.edges]);

  const calculatePaths = useCallback(() => {
    if (activeTab !== 'diagram' || !topologyData.edges.length) return;
    const container = document.getElementById('topology-container');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const paths = topologyData.edges.map((edge) => {
      const srcId = edge.source.replace(/\//g, '-');
      const tgtId = edge.target.replace(/\//g, '-');
      const srcEl = document.getElementById(srcId);
      const tgtEl = document.getElementById(tgtId);

      if (srcEl && tgtEl) {
        const srcRect = srcEl.getBoundingClientRect();
        const tgtRect = tgtEl.getBoundingClientRect();

        const startX = srcRect.right - containerRect.left;
        const startY = srcRect.top + srcRect.height / 2 - containerRect.top;
        const endX = tgtRect.left - containerRect.left;
        const endY = tgtRect.top + tgtRect.height / 2 - containerRect.top;

        const dx = Math.abs(endX - startX) * 0.45;
        const controlX1 = startX + dx;
        const controlY1 = startY;
        const controlX2 = endX - dx;
        const controlY2 = endY;

        const d = `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;
        const isActive = !hoveredNodeId || edge.source === hoveredNodeId || edge.target === hoveredNodeId;

        return {
          id: `${edge.source}-->${edge.target}`,
          d,
          active: isActive,
          type: edge.relation
        };
      }
      return null;
    }).filter(Boolean) as any[];

    setSvgPaths(paths);
  }, [activeTab, topologyData.edges, hoveredNodeId]);

  useEffect(() => {
    const timeout = setTimeout(calculatePaths, 150);
    window.addEventListener('resize', calculatePaths);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', calculatePaths);
    };
  }, [calculatePaths, activeTab, topologyData, hoveredNodeId]);

  // Fetch drawer details depending on active sub-tab
  const fetchResourceDetails = useCallback(async () => {
    if (!selectedResource) return;
    setResourceDetailsLoading(true);
    const { type, name, namespace } = selectedResource;

    try {
      // 1. Fetch metadata overview JSON
      const specRes = await fetch(`${API_URL}/api/${type}/${namespace}/${name}/details`);
      if (specRes.ok) {
        setResourceDetails(await specRes.json());
      }

      // 2. Fetch Events
      const eventsRes = await fetch(`${API_URL}/api/${type}/${namespace}/${name}/events`);
      if (eventsRes.ok) {
        setEventsList(await eventsRes.json());
      }

      // 3. Fetch YAML Config
      const yamlRes = await fetch(`${API_URL}/api/${type}/${namespace}/${name}/yaml`);
      if (yamlRes.ok) {
        const yData = await yamlRes.json();
        setYamlText(yData.yaml || '');
      }

      // 4. Fetch Logs (backend supports pods, deployments, and services)
      const logsRes = await fetch(`${API_URL}/api/${type}/${namespace}/${name}/logs?tail=${logsTailLimit}&timestamps=${logsShowTimestamps}`);
      if (logsRes.ok) {
        const lData = await logsRes.json();
        setLogsText(lData.logs || '');
      } else {
        setLogsText(`Failed loading logs for ${type}.`);
      }

      // Reset AI states when switching resources
      setAiInvestigation(null);
      setAiInvestigating(false);
      setInvestigationSubTab('diagnosis');
    } catch (e) {
      console.error(e);
    } finally {
      setResourceDetailsLoading(false);
    }
  }, [selectedResource, logsTailLimit, logsShowTimestamps]);

  useEffect(() => {
    fetchResourceDetails();
  }, [selectedResource, fetchResourceDetails]);

  // Terminal Handlers
  const handleRunTerminalCommand = async () => {
    const cmd = terminalInput.trim();
    if (!cmd || !selectedResource) return;

    // Append user input
    setTerminalBuffer(prev => [...prev, { type: 'input', text: cmd }]);
    setTerminalInput('');
    setTerminalExecuting(true);

    // Save to history
    const updatedHistory = [...terminalHistory, cmd];
    setTerminalHistory(updatedHistory);
    setTerminalHistoryIndex(updatedHistory.length);

    try {
      const activeContainer = resourceDetails?.spec?.containers?.[0]?.name || 'web-server';
      const response = await fetch(`${API_URL}/api/pods/${selectedResource.namespace}/${selectedResource.name}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          container: activeContainer,
          command: cmd
        })
      });

      const data = await response.json();
      if (response.ok) {
        setTerminalBuffer(prev => [...prev, { type: 'output', text: data.output || '(No output returned)\n' }]);
      } else {
        setTerminalBuffer(prev => [...prev, { type: 'error', text: data.detail || 'Execution failed.' }]);
      }
    } catch (err: any) {
      setTerminalBuffer(prev => [...prev, { type: 'error', text: err.message || 'Network error executing command.' }]);
    } finally {
      setTerminalExecuting(false);
    }
  };

  const handleExplainCommand = async (cmd: string) => {
    setTerminalBuffer(prev => [...prev, { type: 'output', text: `💡 Podex AI Tutor is analyzing command: "${cmd}"...\n` }]);
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      const activeProvider = mockModeForced ? 'mock' : aiProvider;
      if (activeProvider) headers['X-AI-Provider'] = activeProvider;
      if (geminiKey && aiProvider === 'gemini') headers['X-AI-Key'] = geminiKey;
      if (openaiKey && aiProvider === 'openai') headers['X-AI-Key'] = openaiKey;
      if (aiModel) headers['X-AI-Model'] = aiModel;
      if (aiTemperature) headers['X-AI-Temperature'] = String(aiTemperature);

      const response = await fetch(`${API_URL}/api/pods/explain-command`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          command: cmd,
          output: 'Command explanation request'
        })
      });

      const data = await response.json();
      if (response.ok) {
        setTerminalBuffer(prev => [
          ...prev.filter(x => !x.text.includes("is analyzing command")),
          { type: 'output', text: `💡 Podex AI Tutor explanation of "${cmd}":\n${data.explanation}\n` }
        ]);
      } else {
        setToast({ message: data.detail || "Failed to explain command.", type: "error" });
      }
    } catch (err: any) {
      setToast({ message: err.message || "Failed to connect to AI server.", type: "error" });
    }
  };

  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (terminalHistory.length === 0) return;
      const newIndex = Math.max(0, terminalHistoryIndex - 1);
      setTerminalHistoryIndex(newIndex);
      setTerminalInput(terminalHistory[newIndex]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = terminalHistoryIndex + 1;
      if (newIndex >= terminalHistory.length) {
        setTerminalHistoryIndex(terminalHistory.length);
        setTerminalInput('');
      } else {
        setTerminalHistoryIndex(newIndex);
        setTerminalInput(terminalHistory[newIndex]);
      }
    }
  };

  useEffect(() => {
    if (terminalEndRef.current && detailTab === 'terminal') {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalBuffer, detailTab]);

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
      <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} bg-slate-100 dark:bg-[#0d0e12] border-r border-slate-200 dark:border-[#1e202a] flex flex-col justify-between select-none transition-all duration-300`}>
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
                className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-md shadow-cyan-500/10 cursor-pointer hover:opacity-90 active:scale-95 transition"
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
                          : 'text-slate-650 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-[#12141a] hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? getAccentColor('text') : 'text-slate-405'}`} />
                      
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
                    : 'text-slate-655 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-[#12141a] hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                title="Settings"
              >
                <Settings className={`w-5 h-5 ${activeTab === 'settings' ? getAccentColor('text') : 'text-slate-405'}`} />
                <div className="absolute left-16 bg-slate-900 text-white text-[10px] font-bold px-2 py-1.5 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition whitespace-nowrap shadow-md z-30">
                  Settings
                </div>
              </button>

              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg bg-slate-205 dark:bg-[#1a1c25] hover:bg-slate-300 dark:hover:bg-slate-800 text-slate-605 dark:text-slate-300 transition cursor-pointer"
                title="Toggle Light/Dark Theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Expand Button */}
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-[#1a1c25] text-slate-500 dark:text-slate-405 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
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
              <div className="p-6 flex items-center justify-between border-b border-slate-200 dark:border-[#1e202a]">
                <div
                  onClick={() => {
                    setActiveTab('dashboard');
                    setSelectedResource(null);
                  }}
                  className="flex items-center space-x-3 cursor-pointer hover:opacity-90 active:scale-95 transition"
                  title="Go to Dashboard"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-md shadow-cyan-500/10">
                    P
                  </div>
                  <div>
                    <h1 className="text-sm font-extrabold text-slate-800 dark:text-white m-0 tracking-wide">PODEX</h1>
                    <span className="text-[10px] text-slate-500 dark:text-slate-500 font-bold tracking-wider block">K8S FOR BEGINNERS</span>
                  </div>
                </div>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#1a1c25] text-slate-500 dark:text-slate-405 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
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
                        : 'text-slate-655 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-[#12141a] hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? getAccentColor('text') : 'text-slate-405'}`} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar Footer */}
            <div className="p-6 border-t border-slate-200 dark:border-[#1e202a] space-y-3">
              {/* Settings button */}
              <button
                onClick={() => {
                  setActiveTab('settings');
                  setSelectedResource(null);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-left text-xs font-bold transition cursor-pointer ${activeTab === 'settings'
                    ? `${getAccentColor('bgMuted')} ${getAccentColor('text')} border-l-4 ${getAccentColor('border')}`
                    : 'text-slate-655 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-[#12141a] hover:text-slate-800 dark:hover:text-slate-205'
                  }`}
              >
                <Settings className={`w-4 h-4 ${activeTab === 'settings' ? getAccentColor('text') : 'text-slate-405'}`} />
                <span>Settings</span>
              </button>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/50 dark:border-[#1e202a]/50">
                <span className="text-slate-500 font-bold">Theme Mode</span>
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="p-1.5 rounded-lg bg-slate-205 dark:bg-[#1a1c25] hover:bg-slate-300 dark:hover:bg-slate-800 text-slate-605 dark:text-slate-300 transition cursor-pointer"
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
          </div>
        )}
      </aside>

      {/* Main Workspace Frame */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-[#07080b]">

        {/* Top Header Workspace */}
        <header className="h-16 border-b border-slate-200 dark:border-[#1e202a] flex items-center justify-between px-8 bg-white dark:bg-[#090b0e]">
          <div className="flex items-center space-x-4">
            {/* Sidebar toggle button (only shown when collapsed to expand it) */}
            {sidebarCollapsed && (
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#12141a] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
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
                    <span className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 tracking-widest uppercase">Kubernetes Interactive Workspace</span>
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
                      className={`px-4 py-2 rounded-lg font-bold text-xs transition cursor-pointer ${explorerSubTab === sub.id
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
                            <th className="px-6 py-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-[#13151c] text-xs">
                          {filteredPods.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-bold bg-slate-50/20 dark:bg-transparent">
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
                                className={`hover:bg-slate-50/80 dark:hover:bg-[#10121c]/60 cursor-pointer transition duration-150 ${selectedResource?.name === pod.name ? 'bg-slate-100/70 dark:bg-[#10121c]' : ''
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
                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">{pod.age}</td>
                                <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => {
                                      setSelectedResource({ type: 'pod', name: pod.name, namespace: pod.namespace });
                                      setDetailTab('terminal');
                                    }}
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#181a24] dark:hover:bg-[#1f2231] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-[#242838] transition cursor-pointer"
                                    title="Open interactive terminal"
                                  >
                                    <Terminal className="w-3.5 h-3.5" />
                                  </button>
                                </td>
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
                                className={`hover:bg-slate-50/80 dark:hover:bg-[#10121c]/60 cursor-pointer transition duration-150 ${selectedResource?.name === deploy.name ? 'bg-slate-100/70 dark:bg-[#10121c]' : ''
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
                                className={`hover:bg-slate-50/80 dark:hover:bg-[#10121c]/60 cursor-pointer transition duration-150 ${selectedResource?.name === svc.name ? 'bg-slate-100/70 dark:bg-[#10121c]' : ''
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
                  Type a Kubernetes concept, resource name, or error code. Podex will explain it using real-world analogies.
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
              )}              {aiLearning && (
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

                  {/* Sub-tabs Selection */}
                  <div className="flex bg-slate-200/50 dark:bg-[#12141a] rounded-xl p-0.5 border border-slate-250/60 dark:border-[#1e202a] select-none">
                    {([
                      { id: 'concept', label: 'Concept Overview' },
                      { id: 'why', label: 'Why it Exists' },
                      { id: 'gotchas', label: 'Common Gotchas' }
                    ] as const).map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setLearnSubTab(tab.id)}
                        className={`flex-1 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition duration-150 cursor-pointer ${learnSubTab === tab.id
                          ? 'bg-white dark:bg-[#1f2330] text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200 dark:border-[#2d3142]/45'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Body Sections */}
                  <div className="space-y-6 text-xs leading-relaxed">

                    {/* SUBTAB: CONCEPT OVERVIEW */}
                    {learnSubTab === 'concept' && (
                      <div className="space-y-5 animate-in fade-in duration-200">
                        <div className="space-y-1.5">
                          <h5 className="font-bold text-[10px] text-slate-405 uppercase tracking-wider">What it is</h5>
                          <p className="text-slate-700 dark:text-slate-300 font-medium text-xs leading-relaxed">{aiLearning.explanation}</p>
                        </div>

                        {aiLearning.real_world_analogy && aiLearning.real_world_analogy !== 'N/A' && (
                          <div className="bg-indigo-50/50 dark:bg-[#0f121d] border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-5 space-y-2">
                            <h5 className="font-bold text-[10px] text-indigo-650 dark:text-indigo-405 uppercase tracking-wider flex items-center space-x-1.5">
                              <Info className="w-3.5 h-3.5" />
                              <span>Analogy for Beginners</span>
                            </h5>
                            <p className="text-slate-700 dark:text-slate-300 italic font-medium leading-relaxed">
                              "{aiLearning.real_world_analogy}"
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SUBTAB: WHY IT EXISTS */}
                    {learnSubTab === 'why' && (
                      <div className="space-y-2 animate-in fade-in duration-200">
                        <h5 className="font-bold text-[10px] text-slate-405 uppercase tracking-wider">Why it exists in K8s</h5>
                        <p className="text-slate-700 dark:text-slate-300 font-medium text-xs leading-relaxed">{aiLearning.why_it_exists}</p>
                      </div>
                    )}

                    {/* SUBTAB: GOTCHAS */}
                    {learnSubTab === 'gotchas' && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        {aiLearning.common_gotchas && aiLearning.common_gotchas.length > 0 && aiLearning.common_gotchas[0] !== 'N/A' ? (
                          <div className="space-y-2">
                            <h5 className="font-bold text-[10px] text-amber-600 dark:text-amber-550 uppercase tracking-wider mb-2">Gotchas & Pitfalls to Avoid</h5>
                            <div className="space-y-2.5">
                              {aiLearning.common_gotchas.map((gotcha, idx) => (
                                <div key={idx} className="flex items-start space-x-3 p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/10 text-slate-700 dark:text-slate-300">
                                  <AlertCircle className="w-4 h-4 text-amber-550 shrink-0 mt-0.5" />
                                  <span className="text-xs font-medium leading-relaxed">{gotcha}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6 text-slate-500 font-medium">
                            No common gotchas identified.
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: TOPOLOGY DIAGRAM */}
          {activeTab === 'diagram' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <Network className={`w-5 h-5 ${getAccentColor('text')}`} />
                    <h3 className="text-lg font-black text-slate-805 dark:text-slate-200 m-0">Live Cluster Topology</h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-450 font-bold m-0">
                    A live dependency map. Hover over elements to trace target routes, click elements to view specifications and configurations.
                  </p>
                </div>

                {/* Legend controls */}
                <div className="flex items-center space-x-3 text-[10px] font-extrabold text-slate-500 bg-white dark:bg-[#0c0e15] border border-slate-200 dark:border-[#1e202c] px-3.5 py-2 rounded-xl shadow-sm self-start md:self-auto shrink-0 select-none">
                  <div className="flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Healthy</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>Degraded</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                    <span>Critical</span>
                  </div>
                </div>
              </div>

              {/* Diagram Canvas Container */}
              {topologyLoading && topologyData.nodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
                  <span className="text-xs text-slate-500 font-bold">Mapping cluster topology...</span>
                </div>
              ) : topologyData.nodes.length === 0 ? (
                <div className="bg-white dark:bg-[#0c0e15] border border-slate-200 dark:border-[#1e202d] p-12 rounded-3xl text-center space-y-4 shadow-sm">
                  <Network className="w-10 h-10 text-slate-400 mx-auto" />
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-250 m-0">No Active Resources Found</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed font-semibold">
                    Ensure workloads are deployed in the <code className="font-mono text-cyan-600 dark:text-cyan-400">{namespaceFilter || 'default'}</code> namespace to visualize connection maps.
                  </p>
                </div>
              ) : (
                <div 
                  id="topology-container"
                  className="relative bg-slate-50/50 dark:bg-[#090b10] border border-slate-205 dark:border-[#13151f] rounded-3xl p-8 min-h-[520px] overflow-hidden"
                >
                  
                  {/* SVG Bezier Lines Connectors Canvas */}
                  <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible z-0">
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
                        <path d="M 0 0 L 10 5 L 0 10 z" className="fill-slate-300 dark:fill-slate-700" />
                      </marker>
                      <marker
                        id="arrow-active"
                        viewBox="0 0 10 10"
                        refX="6"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                      >
                        <path d="M 0 0 L 10 5 L 0 10 z" className="fill-cyan-500" />
                      </marker>
                    </defs>

                    {/* Draw connector paths */}
                    {svgPaths.map((path) => (
                      <path
                        key={path.id}
                        d={path.d}
                        fill="none"
                        stroke={path.active ? "currentColor" : "currentColor"}
                        strokeWidth={path.active ? 2.5 : 1.2}
                        className={`transition-all duration-300 ${
                          path.active 
                            ? 'text-cyan-500/80 dark:text-cyan-400/80 stroke-cyan-500 dark:stroke-cyan-400 opacity-90' 
                            : 'text-slate-250 dark:text-slate-800 opacity-20'
                        }`}
                        markerEnd={path.active ? "url(#arrow-active)" : "url(#arrow)"}
                      />
                    ))}
                  </svg>

                  {/* Layered Columns Lanes grid */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-4 relative z-10 h-full min-h-[460px]">
                    
                    {/* Lane 1: Ingress Gateways */}
                    <div className="flex flex-col space-y-4">
                      <div className="text-[10px] uppercase font-black tracking-wider text-slate-400 dark:text-slate-500 pb-2 border-b border-slate-200/50 dark:border-slate-800/40 select-none">
                        🌐 Ingress Gateways
                      </div>
                      <div className="flex-1 flex flex-col justify-center space-y-4 min-h-[80px]">
                        {topologyData.nodes.filter(n => n.type === 'ingress').map(node => {
                          const htmlId = node.id.replace(/\//g, '-');
                          const isConnected = isNodeConnected(node.id);
                          return (
                            <div
                              key={node.id}
                              id={htmlId}
                              onMouseEnter={() => setHoveredNodeId(node.id)}
                              onMouseLeave={() => setHoveredNodeId(null)}
                              onClick={() => {
                                setSelectedResource({ type: node.type as any, name: node.name, namespace: node.namespace });
                                setDetailTab('overview');
                              }}
                              className={`p-3.5 bg-white dark:bg-[#0e1017] border border-slate-200 dark:border-[#1e202d] rounded-2xl flex items-center space-x-3 cursor-pointer shadow-sm relative z-10 select-none transition-all duration-305 ${
                                !isConnected ? 'opacity-30 scale-95 hover:opacity-100 hover:scale-100' : 'hover:scale-[1.03] hover:shadow-md'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 flex items-center justify-center shrink-0">
                                <Link2 className="w-4 h-4 text-cyan-500" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-extrabold text-[11px] text-slate-800 dark:text-slate-205 truncate">{node.name}</div>
                                <span className="text-[9px] text-slate-400 uppercase font-black">Ingress</span>
                              </div>
                            </div>
                          );
                        })}
                        {topologyData.nodes.filter(n => n.type === 'ingress').length === 0 && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-550 italic text-center py-4 select-none">
                            No ingress gateways mapped
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Lane 2: Exposing Services */}
                    <div className="flex flex-col space-y-4 border-l border-slate-205/20 dark:border-slate-800/10 md:pl-2">
                      <div className="text-[10px] uppercase font-black tracking-wider text-slate-400 dark:text-slate-500 pb-2 border-b border-slate-200/50 dark:border-slate-800/40 select-none">
                        🔌 Exposing Services
                      </div>
                      <div className="flex-1 flex flex-col justify-center space-y-4 min-h-[80px]">
                        {topologyData.nodes.filter(n => n.type === 'service').map(node => {
                          const htmlId = node.id.replace(/\//g, '-');
                          const isConnected = isNodeConnected(node.id);
                          return (
                            <div
                              key={node.id}
                              id={htmlId}
                              onMouseEnter={() => setHoveredNodeId(node.id)}
                              onMouseLeave={() => setHoveredNodeId(null)}
                              onClick={() => {
                                setSelectedResource({ type: node.type as any, name: node.name, namespace: node.namespace });
                                setDetailTab('overview');
                              }}
                              className={`p-3.5 bg-white dark:bg-[#0e1017] border border-slate-200 dark:border-[#1e202d] rounded-2xl flex items-center space-x-3 cursor-pointer shadow-sm relative z-10 select-none transition-all duration-305 ${
                                !isConnected ? 'opacity-30 scale-95 hover:opacity-100 hover:scale-100' : 'hover:scale-[1.03] hover:shadow-md'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center shrink-0">
                                <Network className="w-4 h-4 text-indigo-500" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-extrabold text-[11px] text-slate-800 dark:text-slate-205 truncate">{node.name}</div>
                                <span className="text-[9px] text-slate-400 uppercase font-black">Service ({node.details?.type || 'ClusterIP'})</span>
                              </div>
                            </div>
                          );
                        })}
                        {topologyData.nodes.filter(n => n.type === 'service').length === 0 && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-550 italic text-center py-4 select-none">
                            No active services exposing ports
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Lane 3: Deployments */}
                    <div className="flex flex-col space-y-4 border-l border-slate-205/20 dark:border-slate-800/10 md:pl-2">
                      <div className="text-[10px] uppercase font-black tracking-wider text-slate-400 dark:text-slate-500 pb-2 border-b border-slate-200/50 dark:border-slate-800/40 select-none">
                        ⚙️ Management Layer
                      </div>
                      <div className="flex-1 flex flex-col justify-center space-y-4 min-h-[80px]">
                        {topologyData.nodes.filter(n => n.type === 'deployment').map(node => {
                          const htmlId = node.id.replace(/\//g, '-');
                          const isConnected = isNodeConnected(node.id);
                          return (
                            <div
                              key={node.id}
                              id={htmlId}
                              onMouseEnter={() => setHoveredNodeId(node.id)}
                              onMouseLeave={() => setHoveredNodeId(null)}
                              onClick={() => {
                                setSelectedResource({ type: node.type as any, name: node.name, namespace: node.namespace });
                                setDetailTab('overview');
                              }}
                              className={`p-3.5 bg-white dark:bg-[#0e1017] border border-slate-200 dark:border-[#1e202d] rounded-2xl flex items-center space-x-3 cursor-pointer shadow-sm relative z-10 select-none transition-all duration-305 ${
                                !isConnected ? 'opacity-30 scale-95 hover:opacity-100 hover:scale-100' : 'hover:scale-[1.03] hover:shadow-md'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
                                <Sliders className="w-4 h-4 text-amber-500" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-extrabold text-[11px] text-slate-800 dark:text-slate-205 truncate flex items-center justify-between">
                                  <span className="truncate mr-1.5">{node.name}</span>
                                  <span className="text-[9px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md self-center shrink-0 select-none">
                                    {node.details?.replicas}
                                  </span>
                                </div>
                                <span className="text-[9px] text-slate-405 uppercase font-black flex items-center space-x-1.5 pt-0.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    node.status === 'healthy' 
                                      ? 'bg-emerald-500' 
                                      : node.status === 'degraded' 
                                        ? 'bg-amber-500 animate-pulse' 
                                        : 'bg-red-500 animate-ping'
                                  }`} />
                                  <span>Deployment</span>
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        {topologyData.nodes.filter(n => n.type === 'deployment').length === 0 && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-550 italic text-center py-4 select-none">
                            No active deployment supervisors
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Lane 4: Pods */}
                    <div className="flex flex-col space-y-4 border-l border-slate-205/20 dark:border-slate-800/10 md:pl-2">
                      <div className="text-[10px] uppercase font-black tracking-wider text-slate-400 dark:text-slate-500 pb-2 border-b border-slate-200/50 dark:border-slate-800/40 select-none">
                        🚀 Execution Layer
                      </div>
                      <div className="flex-1 flex flex-col justify-center space-y-4 min-h-[80px]">
                        {topologyData.nodes.filter(n => n.type === 'pod').map(node => {
                          const htmlId = node.id.replace(/\//g, '-');
                          const isConnected = isNodeConnected(node.id);
                          return (
                            <div
                              key={node.id}
                              id={htmlId}
                              onMouseEnter={() => setHoveredNodeId(node.id)}
                              onMouseLeave={() => setHoveredNodeId(null)}
                              onClick={() => {
                                setSelectedResource({ type: node.type as any, name: node.name, namespace: node.namespace });
                                setDetailTab('overview');
                              }}
                              className={`p-3.5 bg-white dark:bg-[#0e1017] border border-slate-200 dark:border-[#1e202d] rounded-2xl flex items-center space-x-3 cursor-pointer shadow-sm relative z-10 select-none transition-all duration-305 ${
                                !isConnected ? 'opacity-30 scale-95 hover:opacity-100 hover:scale-100' : 'hover:scale-[1.03] hover:shadow-md'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
                                <Cpu className="w-4 h-4 text-emerald-500" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-extrabold text-[11px] text-slate-800 dark:text-slate-205 truncate">{node.name}</div>
                                <span className="text-[9px] text-slate-405 uppercase font-black flex items-center space-x-1.5 pt-0.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    node.status === 'healthy' 
                                      ? 'bg-emerald-500 shadow shadow-emerald-500/50' 
                                      : node.status === 'degraded' 
                                        ? 'bg-amber-500 animate-pulse' 
                                        : 'bg-red-500 animate-ping'
                                  }`} />
                                  <span>Pod ({node.status})</span>
                                </span>
                              </div>
                            </div>
                          );
                        })}
                        {topologyData.nodes.filter(n => n.type === 'pod').length === 0 && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-550 italic text-center py-4 select-none">
                            No running compute workloads
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 4: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-200">
              
              {/* Header */}
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-805 dark:text-slate-200 m-0">Project Settings & Overrides</h3>
                <p className="text-xs text-slate-500 dark:text-slate-450 font-bold">
                  Customize namespaces filters, log displays, cluster targets, and configure custom Gemini/OpenAI parameters directly in the browser.
                </p>
              </div>

              {/* Cluster Connection Settings */}
              <div className="bg-white dark:bg-[#0c0e15] border border-slate-200 dark:border-[#1e202d] rounded-3xl p-6 space-y-6 shadow-sm">
                <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100 dark:border-[#1e202a]">
                  <Cpu className={`w-5 h-5 ${getAccentColor('text')}`} />
                  <h4 className="text-sm font-extrabold text-slate-850 dark:text-slate-100 m-0">Kubernetes Cluster Context Switcher</h4>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Select Active Context:</label>
                    {contexts.length === 0 ? (
                      <div className="text-xs text-slate-400 dark:text-slate-550 italic p-3.5 bg-slate-50 dark:bg-[#111319] rounded-xl border border-slate-200/50 dark:border-slate-800/40 font-semibold">
                        No external kubeconfig contexts found. Using default/in-cluster client.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {contexts.map(ctx => {
                          const isCtxActive = ctx === activeContext;
                          return (
                            <button
                              key={ctx}
                              onClick={() => handleSwitchContext(ctx)}
                              className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                                isCtxActive
                                  ? `${getAccentColor('border')} ${getAccentColor('bgMuted')} ${getAccentColor('text')}`
                                  : 'border-slate-200 dark:border-[#1e202a] bg-slate-50 hover:bg-slate-100 dark:bg-[#111319] dark:hover:bg-[#151821] text-slate-700 dark:text-slate-350'
                              }`}
                            >
                              <span className="truncate mr-2">{ctx}</span>
                              {isCtxActive && (
                                <span className={`w-2 h-2 rounded-full ${getAccentColor('bg')}`} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Service Provider Settings */}
              <div className="bg-white dark:bg-[#0c0e15] border border-slate-200 dark:border-[#1e202d] rounded-3xl p-6 space-y-6 shadow-sm">
                <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100 dark:border-[#1e202a]">
                  <Sliders className={`w-5 h-5 ${getAccentColor('text')}`} />
                  <h4 className="text-sm font-extrabold text-slate-850 dark:text-slate-100 m-0">AI Engine Parameters</h4>
                </div>

                <div className="space-y-4">
                  {/* Select Provider */}
                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Target AI Engine:</label>
                    <div className="flex space-x-4">
                      {[
                        { id: 'gemini', label: 'Google Gemini (default)' },
                        { id: 'openai', label: 'OpenAI GPT' }
                      ].map(prov => (
                        <label key={prov.id} className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none">
                          <input
                            type="radio"
                            name="aiProvider"
                            checked={aiProvider === prov.id}
                            onChange={() => setAiProvider(prov.id as any)}
                            className="w-4 h-4 text-cyan-500 border-slate-300 dark:border-slate-800 focus:ring-0 cursor-pointer"
                          />
                          <span>{prov.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Force Mock Mode */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-[#111319] rounded-2xl border border-slate-205 dark:border-slate-800/80">
                    <div className="space-y-0.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-305">Force Offline Sandbox Mode</label>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Uses local mock answers. Saves credits & works without Internet.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mockModeForced}
                        onChange={(e) => setMockModeForced(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-250 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-cyan-500"></div>
                    </label>
                  </div>

                  {/* Keys overrides */}
                  {!mockModeForced && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      {aiProvider === 'gemini' ? (
                        <>
                          {/* Gemini Key Config */}
                          <div className="flex flex-col space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Gemini API Key Override:</label>
                              <span className={`text-[10px] ${getAccentColor('text')} font-semibold italic`}>Local Browser Storage</span>
                            </div>
                            <input
                              type="password"
                              placeholder="Enter GEMINI_API_KEY..."
                              value={geminiKey}
                              onChange={(e) => setGeminiKey(e.target.value)}
                              className="bg-slate-50 dark:bg-[#111319] border border-slate-205 dark:border-[#1e202a] text-xs font-bold rounded-xl px-4 py-2.5 w-full outline-none text-slate-800 dark:text-slate-200"
                            />
                          </div>

                          {/* Gemini Model */}
                          <div className="flex flex-col space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Gemini Model Type:</label>
                            <select
                              value={aiModel}
                              onChange={(e) => setAiModel(e.target.value)}
                              className="bg-slate-50 dark:bg-[#111319] border border-slate-205 dark:border-[#1e202a] text-xs font-bold rounded-xl px-4 py-2.5 w-full outline-none text-slate-850 dark:text-slate-200"
                            >
                              <option value="gemini-2.5-flash">gemini-2.5-flash (Fast & cost-efficient)</option>
                              <option value="gemini-2.5-pro">gemini-2.5-pro (High intelligence, complex diagnostics)</option>
                            </select>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* OpenAI Key Config */}
                          <div className="flex flex-col space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">OpenAI API Key Override:</label>
                              <span className={`text-[10px] ${getAccentColor('text')} font-semibold italic`}>Local Browser Storage</span>
                            </div>
                            <input
                              type="password"
                              placeholder="Enter OPENAI_API_KEY..."
                              value={openaiKey}
                              onChange={(e) => setOpenaiKey(e.target.value)}
                              className="bg-slate-50 dark:bg-[#111319] border border-slate-205 dark:border-[#1e202a] text-xs font-bold rounded-xl px-4 py-2.5 w-full outline-none text-slate-800 dark:text-slate-200"
                            />
                          </div>

                          {/* OpenAI Model */}
                          <div className="flex flex-col space-y-2">
                            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">OpenAI Model Type:</label>
                            <select
                              value={aiModel}
                              onChange={(e) => setAiModel(e.target.value)}
                              className="bg-slate-50 dark:bg-[#111319] border border-slate-205 dark:border-[#1e202a] text-xs font-bold rounded-xl px-4 py-2.5 w-full outline-none text-slate-850 dark:text-slate-200"
                            >
                              <option value="gpt-4o-mini">gpt-4o-mini (Default high performance)</option>
                              <option value="gpt-4o">gpt-4o (Strict reasoning & analysis)</option>
                            </select>
                          </div>
                        </>
                      )}

                      {/* Temperature slider */}
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                            <span>LLM Temperature:</span>
                            <span className={`font-mono ${getAccentColor('text')}`}>{aiTemperature}</span>
                          </label>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">Lower = focused & predictable, Higher = creative analogies</span>
                        </div>
                        <input
                          type="range"
                          min="0.0"
                          max="1.0"
                          step="0.1"
                          value={aiTemperature}
                          onChange={(e) => setAiTemperature(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Connection indicator */}
                  <div className="bg-slate-50 dark:bg-[#11131c]/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 font-semibold space-y-1.5">
                    <span className={`font-extrabold ${getAccentColor('text')} block`}>💡 API Override Information:</span>
                    <p className="m-0">
                      If overrides are left blank, Podex will automatically look for environmental variables (<code className="font-mono text-cyan-600 dark:text-cyan-400">GEMINI_API_KEY</code> / <code className="font-mono text-cyan-600 dark:text-cyan-400">OPENAI_API_KEY</code>) set in your docker-compose parameters or host settings. If none are present, the workspace runs in Sandbox Fallback Mode automatically.
                    </p>
                  </div>

                </div>
              </div>

              {/* Log Display Preferences */}
              <div className="bg-white dark:bg-[#0c0e15] border border-slate-200 dark:border-[#1e202d] rounded-3xl p-6 space-y-6 shadow-sm">
                <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100 dark:border-[#1e202a]">
                  <Terminal className={`w-5 h-5 ${getAccentColor('text')}`} />
                  <h4 className="text-sm font-extrabold text-slate-850 dark:text-slate-100 m-0">Terminal Logs Preferences</h4>
                </div>

                <div className="space-y-4 text-xs font-bold">
                  {/* Line Wrapping */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-[#111319] rounded-2xl border border-slate-100 dark:border-slate-800/80">
                    <div className="space-y-0.5">
                      <span className="text-slate-750 dark:text-slate-300 block">Log Line Wrap</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-normal">Wraps text inside the log screen instead of scrolling horizontally.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={logsLineWrap}
                        onChange={(e) => setLogsLineWrap(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-250 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-cyan-500"></div>
                    </label>
                  </div>

                  {/* Show Timestamps */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-[#111319] rounded-2xl border border-slate-100 dark:border-slate-800/80">
                    <div className="space-y-0.5">
                      <span className="text-slate-750 dark:text-slate-300 block">Show Container Timestamps</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-normal">Toggles Kubernetes log timestamps (`kubectl logs --timestamps`).</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={logsShowTimestamps}
                        onChange={(e) => setLogsShowTimestamps(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-250 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-cyan-500"></div>
                    </label>
                  </div>

                  {/* Logs Tail Limit */}
                  <div className="flex flex-col space-y-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400">Log Tail Depth:</label>
                    <select
                      value={logsTailLimit}
                      onChange={(e) => setLogsTailLimit(Number(e.target.value))}
                      className="bg-slate-50 dark:bg-[#111319] border border-slate-205 dark:border-[#1e202a] text-xs font-bold rounded-xl px-4 py-2.5 w-full outline-none text-slate-805 dark:text-slate-200"
                    >
                      <option value={50}>50 lines</option>
                      <option value={100}>100 lines (recommended)</option>
                      <option value={200}>200 lines</option>
                      <option value={500}>500 lines</option>
                      <option value={1000}>1000 lines (requires more network memory)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* UI Customization Preferences */}
              <div className="bg-white dark:bg-[#0c0e15] border border-slate-200 dark:border-[#1e202d] rounded-3xl p-6 space-y-6 shadow-sm">
                <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100 dark:border-[#1e202a]">
                  <Sun className={`w-5 h-5 ${getAccentColor('text')}`} />
                  <h4 className="text-sm font-extrabold text-slate-850 dark:text-slate-100 m-0">Theme Accent Configurations</h4>
                </div>

                <div className="space-y-4">
                  {/* Select Theme Accent */}
                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Select Accent Color Highlight:</label>
                    <div className="flex space-x-3.5 pt-1">
                      {([
                        { id: 'cyan', color: 'bg-cyan-500' },
                        { id: 'indigo', color: 'bg-indigo-600' },
                        { id: 'violet', color: 'bg-violet-600' },
                        { id: 'emerald', color: 'bg-emerald-600' },
                        { id: 'amber', color: 'bg-amber-600' }
                      ] as const).map(item => {
                        const isSelected = accentColor === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setAccentColor(item.id)}
                            className={`w-7 h-7 rounded-full ${item.color} flex items-center justify-center cursor-pointer transition active:scale-90 border-2 ${
                              isSelected ? 'border-slate-800 dark:border-white scale-110 shadow-lg' : 'border-transparent opacity-80 hover:opacity-100'
                            }`}
                            title={`Use ${item.id} accent color`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Kubernetes settings */}
              <div className="bg-white dark:bg-[#0c0e15] border border-slate-200 dark:border-[#1e202d] rounded-3xl p-6 space-y-6 shadow-sm">
                <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100 dark:border-[#1e202a]">
                  <Cpu className={`w-5 h-5 ${getAccentColor('text')}`} />
                  <h4 className="text-sm font-extrabold text-slate-850 dark:text-slate-100 m-0">Cluster Workspace Configurations</h4>
                </div>

                <div className="space-y-4 text-xs">
                  {/* System Namespaces */}
                  <div className="flex flex-col space-y-2">
                    <label className="font-bold text-slate-500 dark:text-slate-400">Hide Namespaces (comma-separated):</label>
                    <input
                      type="text"
                      placeholder="e.g. kube-system, kube-public, local-path-storage"
                      value={customNamespaces}
                      onChange={(e) => setCustomNamespaces(e.target.value)}
                      className="bg-slate-50 dark:bg-[#111319] border border-slate-205 dark:border-[#1e202a] text-xs font-bold rounded-xl px-4 py-2.5 w-full outline-none text-slate-800 dark:text-slate-200"
                    />
                    <span className="text-[10px] text-slate-405 dark:text-slate-500 font-medium">Namespaces added here will be hidden by default in the explorer layout to keep noise low.</span>
                  </div>

                  {/* Refresh Rate */}
                  <div className="flex flex-col space-y-2">
                    <label className="font-bold text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                      <span>Auto-refresh Poll Rate:</span>
                      <span className={`font-mono ${getAccentColor('text')}`}>{refreshInterval} seconds</span>
                    </label>
                    <input
                      type="range"
                      min="2"
                      max="30"
                      value={refreshInterval}
                      onChange={(e) => setRefreshInterval(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                    <span className="text-[10px] text-slate-405 dark:text-slate-500 font-medium">Sets the duration between background updates of nodes, pods, and statistics.</span>
                  </div>
                </div>
              </div>

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
            {([
              'overview',
              'logs',
              'events',
              'yaml',
              'investigate',
              ...(selectedResource?.type === 'pod' ? ['terminal'] : [])
            ] as any[]).map(tab => (
              <button
                key={tab}
                onClick={() => setDetailTab(tab as any)}
                className={`flex-1 py-3 font-bold text-center border-b-2 capitalize transition duration-150 cursor-pointer ${detailTab === tab
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
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50'
                              : isFalse
                                ? 'bg-red-50/70 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50 animate-pulse'
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
                            setToast({ message: "Logs copied to clipboard!", type: "success" });
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
                      className={`w-full bg-slate-950 text-emerald-400 border border-slate-900 dark:border-[#161822] rounded-xl p-4 font-mono h-[420px] transition-all scroll-smooth overflow-y-auto ${
                        logsLineWrap ? 'whitespace-pre-wrap break-all' : 'overflow-x-auto whitespace-pre'
                      }`}
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
                            className={`p-3.5 rounded-xl border flex items-start space-x-3 shadow-sm ${ev.type === 'Warning'
                              ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-400 animate-pulse'
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
                              <p className="text-xs text-slate-600 dark:text-slate-400 leading-normal font-bold">{ev.message}</p>
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
                          setToast({ message: "YAML copied to clipboard!", type: "success" });
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
                          Investigate Resource Health
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
                    )}                    {/* Investigation Result display */}
                    {aiInvestigation && (
                      <div className="space-y-5 text-xs animate-in fade-in slide-in-from-bottom-2 duration-300">

                        {/* Status Callout Card */}
                        <div className={`p-4 rounded-2xl border flex items-start space-x-3 shadow-md transition duration-300 hover:scale-[1.01] ${aiInvestigation.status === 'healthy'
                          ? 'bg-emerald-500/10 dark:bg-emerald-950/20 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                          : aiInvestigation.status === 'degraded'
                            ? 'bg-amber-500/10 dark:bg-amber-950/20 border-amber-500/30 text-amber-800 dark:text-amber-300'
                            : 'bg-red-500/10 dark:bg-red-950/20 border-red-500/30 text-red-800 dark:text-red-300'
                          }`}>
                          {aiInvestigation.status === 'healthy' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                          ) : aiInvestigation.status === 'degraded' ? (
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                          ) : (
                            <AlertOctagon className="w-5 h-5 text-red-500 shrink-0 mt-0.5 animate-pulse" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-sm uppercase tracking-wide">Diagnosis: {aiInvestigation.status}</span>
                            </div>
                            <p className="text-xs mt-1.5 font-bold leading-normal">{aiInvestigation.root_cause}</p>
                          </div>
                        </div>

                        {/* Sub-tabs Navigation inside Investigate Panel */}
                        <div className="flex bg-slate-200/50 dark:bg-[#12141a] rounded-xl p-0.5 border border-slate-250/60 dark:border-[#1e202a] select-none">
                          {([
                            { id: 'diagnosis', label: 'Diagnosis' },
                            { id: 'fix', label: 'Action Plan' },
                            { id: 'lesson', label: 'Concept Lesson' }
                          ] as const).map(tab => (
                            <button
                              key={tab.id}
                              onClick={() => setInvestigationSubTab(tab.id)}
                              className={`flex-1 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition duration-150 cursor-pointer ${investigationSubTab === tab.id
                                ? 'bg-white dark:bg-[#1f2330] text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200 dark:border-[#2d3142]/45'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>

                        {/* TAB CONTENT: DIAGNOSIS */}
                        {investigationSubTab === 'diagnosis' && (
                          <div className="space-y-4 animate-in fade-in duration-200">
                            {/* Confidence Score Gauge */}
                            <div className="bg-white dark:bg-[#10121a] p-4 rounded-2xl border border-slate-200 dark:border-[#1e202a] space-y-2.5 shadow-sm">
                              <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest">
                                <span>AI Confidence</span>
                                <span className="text-cyan-605 dark:text-cyan-400 font-extrabold text-xs">{aiInvestigation.confidence}%</span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div
                                  style={{ width: `${aiInvestigation.confidence}%` }}
                                  className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-500"
                                />
                              </div>
                            </div>

                            {/* Analysis Summary */}
                            <div className="bg-white dark:bg-[#10121a] p-4 rounded-2xl border border-slate-200 dark:border-[#1e202a] space-y-2 shadow-sm">
                              <h5 className="font-bold text-[10px] text-slate-400 dark:text-slate-550 uppercase tracking-wider">Analysis Summary</h5>
                              <FormattedText text={aiInvestigation.explanation} onShowToast={(msg, type) => setToast({ message: msg, type })} />
                            </div>

                            {/* Evidence list */}
                            {aiInvestigation.evidence && aiInvestigation.evidence.length > 0 && (
                              <div className="bg-white dark:bg-[#10121a] p-4 rounded-2xl border border-slate-200 dark:border-[#1e202a] space-y-3 shadow-sm">
                                <h5 className="font-bold text-[10px] text-slate-400 dark:text-slate-550 uppercase tracking-wider">Evidence Gathered</h5>
                                <div className="space-y-2">
                                  {aiInvestigation.evidence.map((ev, idx) => (
                                    <div key={idx} className="flex items-start space-x-2 pl-1 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                                      <span className="text-cyan-500 mt-0.5 shrink-0">•</span>
                                      <span className="text-slate-650 dark:text-slate-350 font-semibold">{ev}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* TAB CONTENT: ACTION PLAN */}
                        {investigationSubTab === 'fix' && (
                          <div className="space-y-4 animate-in fade-in duration-200">
                            <div className="bg-cyan-50/45 dark:bg-[#0c161e] p-5 rounded-2xl border border-cyan-200 dark:border-cyan-900/35 space-y-3.5 shadow-sm">
                              <h5 className="font-bold text-[10px] text-cyan-600 dark:text-cyan-400 uppercase tracking-wider flex items-center space-x-1.5">
                                <Sliders className="w-3.5 h-3.5" />
                                <span>Suggested Fix Action</span>
                              </h5>
                              <FormattedText text={aiInvestigation.suggested_fix} onShowToast={(msg, type) => setToast({ message: msg, type })} />
                            </div>
                          </div>
                        )}

                        {/* TAB CONTENT: CONCEPT LESSON */}
                        {investigationSubTab === 'lesson' && (
                          <div className="space-y-4 animate-in fade-in duration-200">
                            <div className="bg-white dark:bg-[#10121a] p-5 rounded-2xl border border-slate-200 dark:border-[#1e202a] space-y-4 shadow-sm">
                              <div className="space-y-1">
                                <h5 className="font-bold text-[10px] text-slate-400 dark:text-slate-550 uppercase tracking-wider">Core Concept</h5>
                                <span className="font-extrabold text-slate-850 dark:text-slate-100 block text-xs">{aiInvestigation.k8s_lesson.concept}</span>
                              </div>

                              <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3.5 space-y-2">
                                <h5 className="font-bold text-[10px] text-indigo-650 dark:text-indigo-400 uppercase tracking-wider flex items-center space-x-1">
                                  <Info className="w-3.5 h-3.5" />
                                  <span>Analogy for Beginners</span>
                                </h5>
                                <p className="text-slate-650 dark:text-slate-405 leading-relaxed italic font-bold">
                                  "{aiInvestigation.k8s_lesson.analogy}"
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Re-run button */}
                        <button
                          onClick={runInvestigation}
                          className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-[#1e202a] hover:bg-slate-100 dark:hover:bg-[#13151f] text-slate-700 dark:text-slate-350 font-bold text-xs transition duration-150 cursor-pointer shadow-sm"
                        >
                          Refresh Diagnosis
                        </button>

                      </div>
                    )}
                  </div>
                )}

                {/* TAB: TERMINAL */}
                {detailTab === 'terminal' && selectedResource && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    
                    {/* Header Controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Terminal className={`w-4 h-4 ${getAccentColor('text')}`} />
                        <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200">Interactive Container Shell</span>
                      </div>
                      
                      {/* Clear console action */}
                      <button
                        onClick={() => {
                          setTerminalBuffer([
                            { type: 'output', text: 'Console buffer cleared.\n' }
                          ]);
                        }}
                        className="text-[10px] text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200 font-bold transition cursor-pointer"
                      >
                        Clear Console
                      </button>
                    </div>

                    {/* Console Screen Box */}
                    <div className="bg-slate-950 text-slate-200 border border-slate-900 dark:border-[#161822] rounded-xl p-4 font-mono h-[380px] overflow-y-auto flex flex-col space-y-2 leading-relaxed text-xs">
                      {terminalBuffer.map((line, idx) => {
                        if (line.type === 'input') {
                          return (
                            <div key={idx} className="space-y-1">
                              <div className="flex items-center justify-between text-cyan-400 font-semibold group">
                                <div className="flex items-start">
                                  <span className="text-emerald-500 shrink-0 mr-1.5">{`web-server@${selectedResource.name}:/$`}</span>
                                  <span className="break-all">{line.text}</span>
                                </div>
                                
                                {/* Explain with AI button */}
                                {line.text.trim() && (
                                  <button
                                    onClick={() => handleExplainCommand(line.text)}
                                    className="opacity-0 group-hover:opacity-100 transition text-[9px] bg-slate-800 hover:bg-slate-700 text-cyan-400 font-bold px-2 py-0.5 rounded border border-slate-700/50 hover:scale-95 active:scale-90 cursor-pointer shrink-0 ml-2"
                                    title="Ask Podex AI what this command does"
                                  >
                                    💡 Explain
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        } else if (line.type === 'error') {
                          return (
                            <div key={idx} className="text-red-400 whitespace-pre-wrap break-all border-l-2 border-red-500/35 pl-2.5 my-1">
                              {line.text}
                            </div>
                          );
                        } else {
                          // Standard output
                          const isAIExplanation = line.text.includes("💡 Podex AI Tutor");
                          return (
                            <div
                              key={idx}
                              className={`whitespace-pre-wrap break-all ${
                                isAIExplanation 
                                  ? 'bg-[#0f1b29] border border-cyan-800/40 rounded-xl p-3.5 text-cyan-300 dark:text-cyan-200 font-sans my-2.5 shadow-sm leading-relaxed border-l-4 border-l-cyan-500' 
                                  : 'text-slate-350'
                              }`}
                            >
                              {line.text}
                            </div>
                          );
                        }
                      })}
                      
                      {/* Executing loader */}
                      {terminalExecuting && (
                        <div className="flex items-center space-x-2 text-cyan-400 font-semibold py-1 animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span className="text-[10px]">Running command in container...</span>
                        </div>
                      )}
                      
                      <div ref={terminalEndRef} />
                    </div>

                    {/* Input Prompt Form */}
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleRunTerminalCommand();
                      }}
                      className="flex items-center space-x-2 border border-slate-205 dark:border-[#1e202a] bg-slate-50 dark:bg-[#111319] px-4 py-2.5 rounded-xl text-xs font-mono font-bold"
                    >
                      <span className="text-emerald-500 shrink-0 select-none">{`web-server@${selectedResource.name}:/$`}</span>
                      <input
                        type="text"
                        value={terminalInput}
                        onChange={(e) => setTerminalInput(e.target.value)}
                        onKeyDown={handleTerminalKeyDown}
                        placeholder="Type ls, env, df -h..."
                        disabled={terminalExecuting}
                        className="flex-1 bg-transparent text-slate-800 dark:text-slate-200 outline-none placeholder-slate-400 dark:placeholder-slate-650 font-mono font-medium disabled:opacity-50"
                      />
                    </form>

                    <div className="bg-slate-50 dark:bg-[#11131c]/60 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 text-[10px] leading-relaxed text-slate-500 dark:text-slate-405 font-bold space-y-1">
                      <span className={`font-extrabold ${getAccentColor('text')} block`}>💡 Shell Commands Tips:</span>
                      <p className="m-0 font-medium">
                        Press <kbd className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">↑</kbd> and <kbd className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">↓</kbd> to cycle command history. Hover over your typed commands inside the screen to trigger the <span className="text-cyan-500 font-extrabold">💡 Explain</span> helper button to get a learner explanation.
                      </p>
                    </div>

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
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${confirmationModal.type === 'delete'
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
                  Restarting a Deployment triggers a Rolling Update. Kubernetes spins up a new pod replica first, waits for it to become ready, and then kills the old replica. This guarantees zero downtime for your web applications.
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
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-3 px-4.5 py-3 rounded-2xl border shadow-2xl animate-in slide-in-from-bottom-5 fade-in duration-300 backdrop-blur-md bg-white/90 dark:bg-[#0c0e15]/90 border-slate-205 dark:border-[#1e202d]">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          ) : toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 animate-bounce" />
          ) : (
            <Info className="w-5 h-5 text-cyan-500 shrink-0" />
          )}
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-250">{toast.message}</span>
        </div>
      )}

    </div>
  );
}
