import React from 'react';
import { Cpu, Layers, Activity, Terminal, Loader2, ArrowRight } from 'lucide-react';

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
  setDetailTab: (tab: 'overview' | 'yaml' | 'logs' | 'investigate' | 'terminal') => void;
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
    <div className="max-w-5xl mx-auto space-y-8">

      {/* CNCF Style Top Hero Split Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Welcome Content (2/3 width) */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-white dark:bg-[#0c0e15] border border-slate-200 dark:border-slate-800 p-8 shadow-sm flex flex-col justify-between min-h-[220px]">
          <div className="absolute right-0 top-0 w-64 h-64 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-3xl" />
          <div className="relative z-10 space-y-3">
            <span className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 tracking-widest uppercase">Kubernetes Interactive Workspace</span>
            <h3 className="text-xl font-black text-slate-800 dark:text-white leading-tight">Inspect container states & diagnose errors reactively.</h3>
            <p className="text-slate-500 dark:text-slate-405 text-xs leading-relaxed font-semibold max-w-lg">
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
  );
};
