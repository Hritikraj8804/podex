import React, { useState, useCallback } from 'react';
import {
  Layers, Activity, Loader2, ArrowRight,
  Server, AlertTriangle, CheckCircle2, Wifi,
  Zap, BarChart3, Network, Shield, Box, BookOpen,
  MessageSquareText, Sparkles, X, Bot, RefreshCw
} from 'lucide-react';

interface DashboardTabProps {
  stats: any;
  statsLoading: boolean;
  filteredPods: any[];
  showSystemResources: boolean;
  filteredDeployments: any[];
  filteredServices: any[];
  setLearnQuery: (query: string) => void;
  setActiveTab: (tab: 'dashboard' | 'explorer' | 'learn' | 'settings' | 'diagram') => void;
  handleLearnQuery: (query: string) => void;
  setSelectedResource: (resource: { type: 'pod' | 'deployment' | 'service', name: string, namespace: string } | null) => void;
  setDetailTab: (tab: 'overview' | 'logs' | 'investigate' | 'terminal') => void;
  apiUrl: string;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  stats,
  statsLoading,
  filteredPods,
  showSystemResources,
  filteredDeployments,
  filteredServices,
  setLearnQuery,
  setActiveTab,
  handleLearnQuery,
  setSelectedResource,
  setDetailTab,
  apiUrl,
}) => {
  const [chatPod, setChatPod] = useState<{ name: string; namespace: string; status: string } | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatResult, setChatResult] = useState<{
    status: string;
    root_cause: string;
    explanation: string;
    evidence: string[];
    suggested_fix: string;
    confidence: number;
  } | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  const handlePodChat = useCallback(async (name: string, namespace: string) => {
    setChatLoading(true);
    setChatResult(null);
    setChatError(null);
    try {
      const res = await fetch(`${apiUrl}/api/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ namespace, pod_name: name, container_name: '' }),
      });
      if (res.ok) {
        const data = await res.json();
        setChatResult({
          status: data.status,
          root_cause: data.root_cause,
          explanation: data.explanation,
          evidence: data.evidence || [],
          suggested_fix: data.suggested_fix,
          confidence: data.confidence,
        });
      } else {
        setChatError('Investigation failed. Is the AI provider configured?');
      }
    } catch {
      setChatError('Network error. Backend may not be running.');
    } finally {
      setChatLoading(false);
    }
  }, [apiUrl]);

  const openChat = useCallback((name: string, namespace: string, status: string) => {
    setChatPod({ name, namespace, status });
    setChatResult(null);
    setChatError(null);
  }, []);

  const runningPodsCount = filteredPods.filter(p => {
    const s = p.status.toLowerCase();
    return s.includes('run') || s === 'completed' || s === 'ready';
  }).length;
  const totalPodsCount = filteredPods.length;
  const healthPercentage = totalPodsCount > 0 ? Math.round((runningPodsCount / totalPodsCount) * 100) : 100;

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (healthPercentage / 100) * circumference;

  const unhealthyPods = filteredPods.filter(p => {
    const s = p.status.toLowerCase();
    return !s.includes('run') && s !== 'completed' && s !== 'ready';
  }).slice(0, 5);

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">

      {/* Top Row: Hero + Health Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Welcome Hero */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#1b2332] rounded-xl overflow-hidden shadow-sm">
          <div className="h-1 bg-gradient-to-r from-cyan-500 to-indigo-500" />
          <div className="p-7 flex flex-col justify-between min-h-[230px]">
            <div className="space-y-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 dark:bg-cyan-500/5 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-cyan-500" />
                </div>
                <span className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 tracking-widest uppercase">Cluster Overview</span>
              </div>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 leading-tight">
                {stats?.status === 'healthy'
                  ? 'All systems operational'
                  : 'Cluster needs attention'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold max-w-lg">
                {stats?.status === 'healthy'
                  ? `${filteredPods.length} pods across ${stats?.node_count || 0} nodes — all workloads running as expected.`
                  : `${unhealthyPods.length} pod${unhealthyPods.length !== 1 ? 's' : ''} in degraded state. Click cells below to inspect.`
                }
              </p>
            </div>

            <div className="flex items-center space-x-4 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800/60">
              <div className="flex items-center space-x-2 text-[11px] font-bold text-slate-500">
                <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                <span>Cluster Connected</span>
              </div>
              <div className="flex items-center space-x-2 text-[11px] font-bold text-slate-500">
                <Shield className="w-3.5 h-3.5 text-cyan-500" />
                <span>CNCF Compatible</span>
              </div>
            </div>
          </div>
        </div>

        {/* Health Donut */}
        <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#1b2332] rounded-xl p-6 flex flex-col items-center justify-center space-y-3 min-h-[230px] shadow-sm">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Pod Health</span>
          <div className="relative flex items-center justify-center">
            <svg className="w-28 h-28 transform -rotate-90 drop-shadow-sm">
              <circle cx="56" cy="56" r={radius} className="stroke-slate-100 dark:stroke-slate-800/60" strokeWidth="8" fill="transparent" />
              <circle
                cx="56" cy="56" r={radius}
                className="stroke-cyan-500 transition-all duration-700 ease-out"
                strokeWidth="8" fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ filter: 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.3))' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-none">{healthPercentage}%</span>
              <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Healthy</span>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>{runningPodsCount}/{totalPodsCount} ready</span>
          </div>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          { label: 'Nodes', value: stats?.node_count ?? 0, icon: Server, sub: 'active', color: 'text-cyan-500 bg-cyan-500/10' },
          { label: 'Pods', value: showSystemResources ? (stats?.pod_count ?? 0) : filteredPods.length, icon: Box, sub: 'running', color: 'text-emerald-500 bg-emerald-500/10' },
          { label: 'Deployments', value: showSystemResources ? (stats?.deployment_count ?? 0) : filteredDeployments.length, icon: Layers, sub: 'specs', color: 'text-indigo-500 bg-indigo-500/10' },
          { label: 'Services', value: showSystemResources ? (stats?.service_count ?? 0) : filteredServices.length, icon: Network, sub: 'endpoints', color: 'text-amber-500 bg-amber-500/10' },
        ] as const).map((item, idx) => (
          <div
            key={idx}
            className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#1b2332] rounded-xl p-5 hover:border-cyan-500/30 hover:shadow-sm transition-all duration-200 group"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{item.label}</span>
              <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
                <item.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-0.5">
              {statsLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              ) : (
                <span className="text-2xl font-black text-slate-800 dark:text-slate-100">{item.value}</span>
              )}
              <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{item.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Middle Row: Pod Map + Recent Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Pod Health Matrix */}
        <div className="lg:col-span-3 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#1b2332] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-cyan-500" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pod Status Matrix</span>
            </div>
            <span className="text-[9px] font-bold text-slate-400">{filteredPods.length} total</span>
          </div>
          {filteredPods.length === 0 ? (
            <div className="text-xs text-slate-400 font-semibold py-6 text-center">No user pods running in cluster.</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 mb-3">
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
                      onClick={() => openChat(p.name, p.namespace, p.status)}
                      title={`${p.name} (${p.status})`}
                      className={`w-3.5 h-3.5 rounded-sm cursor-pointer hover:scale-125 transition-all duration-150 ${color} relative group`}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-800 text-white text-[8px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition z-10 shadow-lg">
                        {p.name}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center space-x-4 text-[9px] font-bold text-slate-400">
                <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /><span>Running</span></span>
                <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /><span>Pending</span></span>
                <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500" /><span>Failed</span></span>
              </div>
            </>
          )}
        </div>

        {/* Issues / Attention Card */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#1b2332] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Needs Attention</span>
            </div>
          </div>
          {unhealthyPods.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-2 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">All pods healthy</span>
              <span className="text-[10px] text-slate-400 font-semibold">No issues detected in your cluster.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {unhealthyPods.map(p => {
                const s = p.status.toLowerCase();
                const isPending = s.includes('pend') || s.includes('progress');
                return (
                  <div
                    key={p.name}
                    onClick={() => {
                      setSelectedResource({ type: 'pod', name: p.name, namespace: p.namespace });
                      setDetailTab('investigate');
                      setActiveTab('explorer');
                    }}
                    className="flex items-center space-x-2.5 p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/30 hover:bg-amber-50 dark:hover:bg-amber-950/20 cursor-pointer transition group"
                  >
                    <div className={`w-2 h-2 rounded-full ${isPending ? 'bg-amber-500 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block truncate group-hover:text-cyan-500 transition">{p.name}</span>
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase block truncate">{p.status} · {p.namespace}</span>
                    </div>
                    <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-cyan-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Learning Cards */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-cyan-500" />
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Kubernetes Concept Shortcuts</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {([
            { title: 'Pod Lifecycle', desc: 'Pods are ephemeral running containers. Learn about Pending, Running, and CrashLoopBackOff states.', query: 'What is a Pod?', icon: Box },
            { title: 'Routing & Services', desc: 'Kubernetes Services proxy traffic to matching Pod labels. Understand ClusterIP vs NodePort vs LoadBalancer.', query: 'What is a Service?', icon: Network },
            { title: 'Health Probes', desc: 'Kubernetes monitors container health using Liveness, Readiness, and Startup probes for self-healing.', query: 'What is Liveness Probe?', icon: Activity }
          ] as const).map((card, idx) => (
            <div
              key={idx}
              onClick={() => {
                setLearnQuery(card.query);
                setActiveTab('learn');
                handleLearnQuery(card.query);
              }}
              className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#1b2332] rounded-xl p-5 hover:border-cyan-500/40 hover:shadow-sm cursor-pointer transition-all duration-200 group"
            >
              <div className="flex items-center space-x-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/10 dark:bg-cyan-500/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <card.icon className="w-3.5 h-3.5 text-cyan-500" />
                </div>
                <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-cyan-500 transition">{card.title}</h5>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">{card.desc}</p>
              <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold flex items-center mt-3 group-hover:translate-x-0.5 transition-transform">
                Learn more
                <ArrowRight className="w-3 h-3 ml-1" />
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pod Chat Popup */}
      {chatPod && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4" onClick={() => setChatPod(null)}>
          <div className="w-full max-w-lg bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#1b2332] rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-[#1b2332]">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 dark:bg-cyan-500/5 flex items-center justify-center">
                  <MessageSquareText className="w-4 h-4 text-cyan-500" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight">{chatPod.name}</h4>
                  <span className="text-[10px] text-slate-500 font-bold">{chatPod.namespace} · {chatPod.status}</span>
                </div>
              </div>
              <button onClick={() => setChatPod(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#24233f] text-slate-400 transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 max-h-[420px] overflow-y-auto space-y-4">
              {/* User message */}
              <div className="flex justify-end">
                <div className="bg-cyan-500/10 dark:bg-cyan-500/5 text-slate-800 dark:text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-2xl rounded-br-sm max-w-[80%]">
                  Analyze this pod for issues
                </div>
              </div>

              {/* AI response */}
              <div className="flex items-start space-x-3">
                <div className="w-7 h-7 rounded-lg bg-cyan-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  {chatLoading ? (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-xs text-slate-500 font-bold">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Analyzing pod state...</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-cyan-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                      </div>
                    </div>
                  ) : chatError ? (
                    <div className="bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/30 p-3 rounded-lg">
                      <p className="text-xs text-red-600 dark:text-red-400 font-bold">{chatError}</p>
                    </div>
                  ) : chatResult ? (
                    <div className="space-y-3">
                      {/* Status badge */}
                      <div className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-bold ${
                        chatResult.status === 'healthy'
                          ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                          : chatResult.status === 'degraded'
                            ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'
                            : 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                      }`}>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{chatResult.status}</span>
                      </div>

                      {/* Confidence */}
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                        <span>Confidence</span>
                        <span className="text-cyan-600 dark:text-cyan-400">{chatResult.confidence}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all" style={{ width: `${chatResult.confidence}%` }} />
                      </div>

                      {/* Root cause */}
                      <div className="bg-slate-50 dark:bg-[#111820] p-3 rounded-lg border border-slate-200 dark:border-[#1b2332]">
                        <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Root Cause</h5>
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">{chatResult.root_cause}</p>
                      </div>

                      {/* Explanation */}
                      {chatResult.explanation && (
                        <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-semibold">{chatResult.explanation}</div>
                      )}

                      {/* Evidence */}
                      {chatResult.evidence.length > 0 && (
                        <div className="space-y-1.5">
                          <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Evidence</h5>
                          {chatResult.evidence.map((ev, i) => (
                            <div key={i} className="flex items-start space-x-1.5 text-xs text-slate-600 dark:text-slate-400 font-semibold">
                              <span className="text-cyan-500 shrink-0 mt-0.5">•</span>
                              <span>{ev}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Suggested fix */}
                      {chatResult.suggested_fix && (
                        <div className="bg-cyan-50/50 dark:bg-[#0c161e] p-3 rounded-lg border border-cyan-200 dark:border-cyan-900/35">
                          <h5 className="text-[9px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-1">Suggested Fix</h5>
                          <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">{chatResult.suggested_fix}</p>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-[#1b2332] flex items-center space-x-2">
              {!chatResult && !chatLoading && !chatError && (
                <button
                  onClick={() => handlePodChat(chatPod.name, chatPod.namespace)}
                  className="flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask AI to Diagnose</span>
                </button>
              )}
              {chatResult && (
                <button
                  onClick={() => handlePodChat(chatPod.name, chatPod.namespace)}
                  disabled={chatLoading}
                  className="flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg border border-slate-200 dark:border-[#1b2332] hover:bg-slate-50 dark:hover:bg-[#1b2332] text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh Analysis</span>
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedResource({ type: 'pod', name: chatPod.name, namespace: chatPod.namespace });
                  setDetailTab('overview');
                  setActiveTab('explorer');
                }}
                className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-[#1b2332] hover:bg-slate-50 dark:hover:bg-[#1b2332] text-slate-500 dark:text-slate-400 font-bold text-xs transition cursor-pointer"
              >
                Full View
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
