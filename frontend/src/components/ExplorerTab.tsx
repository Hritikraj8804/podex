import React from 'react';
import { Search, Loader2, Terminal } from 'lucide-react';

interface ExplorerTabProps {
  explorerSubTab: 'pods' | 'deployments' | 'services';
  setExplorerSubTab: (tab: 'pods' | 'deployments' | 'services') => void;
  filteredPods: any[];
  filteredDeployments: any[];
  filteredServices: any[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  resourcesLoading: boolean;
  selectedResource: { type: 'pod' | 'deployment' | 'service', name: string, namespace: string } | null;
  setSelectedResource: (resource: { type: 'pod' | 'deployment' | 'service', name: string, namespace: string } | null) => void;
  setDetailTab: (tab: 'overview' | 'yaml' | 'logs' | 'investigate' | 'terminal') => void;
  getStatusColor: (status: string) => string;
}

export const ExplorerTab: React.FC<ExplorerTabProps> = ({
  explorerSubTab,
  setExplorerSubTab,
  filteredPods,
  filteredDeployments,
  filteredServices,
  searchTerm,
  setSearchTerm,
  resourcesLoading,
  selectedResource,
  setSelectedResource,
  setDetailTab,
  getStatusColor,
}) => {
  return (
    <div className="bg-white dark:bg-[#090b0f] border border-slate-200 dark:border-[#1e202a] rounded-3xl overflow-hidden shadow-sm animate-in fade-in duration-200">

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
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-455 font-bold">{svc.type}</td>
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
  );
};
