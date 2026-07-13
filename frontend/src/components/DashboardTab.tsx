import React from 'react';
import {
  Layers, Activity, Loader2, ArrowRight,
  Server, AlertTriangle, CheckCircle2, Wifi,
  Zap, BarChart3, Network, Shield, Box, BookOpen
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
}) => {
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
                      onClick={() => {
                        setSelectedResource({ type: 'pod', name: p.name, namespace: p.namespace });
                        setDetailTab('overview');
                        setActiveTab('explorer');
                      }}
                      title={`${p.name} (${p.status})`}
                      className={`w-3.5 h-3.5 rounded-sm cursor-pointer hover:scale-125 transition-all duration-150 ${color}`}
                    />
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

    </div>
  );
};
