import React, { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, Terminal, Trash2, AlertCircle, ExternalLink, X } from 'lucide-react';

interface ExplorerTabProps {
  explorerSubTab: string;
  setExplorerSubTab: (tab: 'pods' | 'deployments' | 'services' | 'nodes' | 'configmaps' | 'secrets' | 'statefulsets' | 'daemonsets' | 'events') => void;
  filteredPods: any[];
  filteredDeployments: any[];
  filteredServices: any[];
  filteredNodes?: any[];
  filteredConfigmaps?: any[];
  filteredSecrets?: any[];
  filteredStatefulsets?: any[];
  filteredDaemonsets?: any[];
  filteredEventsAll?: any[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  resourcesLoading: boolean;
  selectedResource: any;
  setSelectedResource: (resource: any) => void;
  setDetailTab: (tab: 'overview' | 'yaml' | 'logs' | 'investigate' | 'terminal' | 'events') => void;
  getStatusColor: (status: string) => string;
  apiUrl: string;
  onRefresh?: (isSilent?: boolean) => void;
  setToast?: (toast: { message: string; type: 'success' | 'error' | 'info'; link?: string } | null) => void;
}

type TabDef = { id: string; label: string; icon: string };

const TABS: TabDef[] = [
  { id: 'pods', label: 'Pods', icon: '□' },
  { id: 'deployments', label: 'Deployments', icon: '◎' },
  { id: 'services', label: 'Services', icon: '◯' },
  { id: 'nodes', label: 'Nodes', icon: '⬡' },
  { id: 'configmaps', label: 'ConfigMaps', icon: '⚙' },
  { id: 'secrets', label: 'Secrets', icon: '🔑' },
  { id: 'statefulsets', label: 'StatefulSets', icon: '◈' },
  { id: 'daemonsets', label: 'DaemonSets', icon: '◇' },
  { id: 'events', label: 'Events', icon: '📋' },
];

const portForwardRegistry: Record<string, { pid: number; port: number; host: string; is_docker?: boolean }> = {};

export const ExplorerTab: React.FC<ExplorerTabProps> = ({
  explorerSubTab,
  setExplorerSubTab,
  filteredPods,
  filteredDeployments,
  filteredServices,
  filteredNodes = [],
  filteredConfigmaps = [],
  filteredSecrets = [],
  filteredStatefulsets = [],
  filteredDaemonsets = [],
  filteredEventsAll = [],
  searchTerm,
  setSearchTerm,
  resourcesLoading,
  selectedResource,
  setSelectedResource,
  setDetailTab,
  getStatusColor,
  apiUrl,
  onRefresh,
  setToast,
}) => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [portForwarding, setPortForwarding] = useState<Record<string, boolean>>({});
  const [portDialog, setPortDialog] = useState<{ kind: string; name: string; namespace: string } | null>(null);
  const [portLocal, setPortLocal] = useState('');

  useEffect(() => {
    setSelectedKeys([]);
  }, [explorerSubTab]);

  const handleBulkDelete = () => {
    if (selectedKeys.length === 0) return;
    setShowDeleteConfirm(true);
  };

  const executeBulkDelete = async () => {
    setShowDeleteConfirm(false);
    setBulkDeleting(true);
    try {
      const deletePromises = selectedKeys.map(async (key) => {
        const [ns, name] = key.split('/');
        const kind = explorerSubTab === 'pods' ? 'pod' : explorerSubTab === 'deployments' ? 'deployment' : 'service';
        return fetch(`${apiUrl}/api/kube/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, name, namespace: ns })
        });
      });
      const results = await Promise.all(deletePromises);
      const allOk = results.every(res => res.ok);
      if (allOk) {
        setToast?.({ message: `Deleted ${selectedKeys.length} resources.`, type: 'success' });
      } else {
        setToast?.({ message: "Failed to delete some resources.", type: 'error' });
      }
      setSelectedKeys([]);
      onRefresh?.(true);
    } catch (e: any) {
      setToast?.({ message: e.message || "Network error.", type: 'error' });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleRowClick = useCallback(async (type: string, name: string, namespace: string) => {
    if (selectedResource?.name === name && selectedResource?.type === type) {
      setSelectedResource(null);
      return;
    }
    // Only open ResourceDrawer for the three main types
    if (type === 'pod' || type === 'deployment' || type === 'service') {
      setSelectedResource({ type, name, namespace });
      setDetailTab('overview');
    }
  }, [selectedResource, setSelectedResource, setDetailTab]);

  const handlePortForward = useCallback(async (kind: string, name: string, namespace: string, port?: number, targetPort?: number) => {
    const key = `${namespace}/${name}`;
    if (portForwardRegistry[key]) {
      const { pid } = portForwardRegistry[key];
      try {
        await fetch(`${apiUrl}/api/kube/port-forward/${pid}`, { method: 'DELETE' });
      } catch { }
      delete portForwardRegistry[key];
      setPortForwarding(prev => ({ ...prev, [key]: false }));
      setToast?.({ message: `Port forward to ${name} stopped.`, type: 'info' });
      return;
    }
    setPortForwarding(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(`${apiUrl}/api/kube/port-forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, name, namespace, port: port || 0, target_port: targetPort || 0 }),
      });
      if (res.ok) {
        const data = await res.json();
        const host = window.location.hostname;
        portForwardRegistry[key] = { pid: data.pid, port: data.port, host, is_docker: data.is_docker };
        setPortForwarding(prev => ({ ...prev, [key]: false }));
        if (data.is_docker) {
          setToast?.({ message: `Port ${data.port} forwarded in container`, type: 'success' });
        } else if (host === 'localhost') {
          const url = `http://127.0.0.1:${data.port}`;
          if (data.target_port && data.target_port !== data.port) {
            setToast?.({ message: `${data.port}:${data.target_port} → ${url}`, type: 'success', link: url });
          } else {
            setToast?.({ message: `Port ${data.port} → ${url}`, type: 'success', link: url });
          }
        } else {
          setToast?.({ message: `Port ${data.port} forwarded`, type: 'success' });
        }
      } else {
        setPortForwarding(prev => ({ ...prev, [key]: false }));
        setToast?.({ message: `Port forward failed.`, type: 'error' });
      }
    } catch {
      setPortForwarding(prev => ({ ...prev, [key]: false }));
      setToast?.({ message: `Network error.`, type: 'error' });
    }
  }, [apiUrl, setToast]);

  const getTabCount = (id: string): number => {
    const map: Record<string, number> = {
      pods: filteredPods.length,
      deployments: filteredDeployments.length,
      services: filteredServices.length,
      nodes: filteredNodes.length,
      configmaps: filteredConfigmaps.length,
      secrets: filteredSecrets.length,
      statefulsets: filteredStatefulsets.length,
      daemonsets: filteredDaemonsets.length,
      events: filteredEventsAll.length,
    };
    return map[id] ?? 0;
  };

  const canDelete = explorerSubTab === 'pods' || explorerSubTab === 'deployments' || explorerSubTab === 'services';

  const renderTable = () => {
    if (resourcesLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-xs text-slate-500 font-semibold">Loading resources...</span>
        </div>
      );
    }

    if (explorerSubTab === 'pods') {
      const data = filteredPods;
      return (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-[#1b2332] text-slate-500 text-[10px] uppercase font-semibold tracking-wider bg-slate-50 dark:bg-[#0d1117]">
              {canDelete && <th className="px-6 py-4 w-12 text-center"><input type="checkbox" checked={data.length > 0 && selectedKeys.length === data.length} onChange={(e) => { if (e.target.checked) setSelectedKeys(data.map((p: any) => `${p.namespace}/${p.name}`)); else setSelectedKeys([]); }} className="w-3.5 h-3.5 rounded text-cyan-500 bg-slate-50 dark:bg-[#0d1117] border-slate-300 dark:border-slate-700 focus:ring-0 cursor-pointer" /></th>}
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Namespace</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-center">Restarts</th>
              <th className="px-6 py-4">Ports</th>
              <th className="px-6 py-4">Age</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1b2332] text-xs">
            {data.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-bold">No Pods found.</td></tr>
            ) : data.map((pod: any) => {
              const key = `${pod.namespace}/${pod.name}`;
              const isSelected = selectedKeys.includes(key);
              const pfActive = portForwardRegistry[key];
              return (
                <tr key={pod.name} onClick={() => handleRowClick('pod', pod.name, pod.namespace)}
                  className={`hover:bg-slate-50/80 dark:hover:bg-[#10121c]/60 cursor-pointer transition duration-150 ${selectedResource?.name === pod.name ? 'bg-slate-100/70 dark:bg-[#10121c]' : ''}`}>
                  {canDelete && <td className="px-6 py-4 w-12 text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={(e) => { if (e.target.checked) setSelectedKeys([...selectedKeys, key]); else setSelectedKeys(selectedKeys.filter((k: string) => k !== key)); }} className="w-3.5 h-3.5 rounded text-blue-500 bg-slate-50 dark:bg-[#111820] border-slate-300 dark:border-slate-600 focus:ring-0 cursor-pointer" /></td>}
                  <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{pod.name}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">{pod.namespace}</td>
                  <td className="px-6 py-4"><span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(pod.status)}`}>{pod.status}</span></td>
                  <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400 font-mono font-bold">{pod.restarts}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold text-[10px]">{pod.ports || '-'}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">{pod.age}</td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {pfActive ? (
                        <>
                          {!pfActive.is_docker && pfActive.host === 'localhost' ? (
                            <a href={`http://localhost:${pfActive.port}`} target="_blank" rel="noopener noreferrer"
                              className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition cursor-pointer"
                              title={`Open localhost:${pfActive.port}`}
                              onClick={(e) => e.stopPropagation()}>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span className="px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold">
                              :{pfActive.port}
                            </span>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); handlePortForward('pod', pod.name, pod.namespace); }}
                            className="p-1.5 rounded-md bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition cursor-pointer"
                            title="Stop port forward">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); setPortDialog({ kind: 'pod', name: pod.name, namespace: pod.namespace }); }}
                          className={`p-1.5 rounded-md border transition cursor-pointer ${portForwarding[key] ? 'bg-slate-100 dark:bg-[#111820] text-slate-400' : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#111820] dark:hover:bg-[#1b2332] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#1b2332]'}`}
                          title="Port forward">
                          {portForwarding[key] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <button onClick={() => { setSelectedResource({ type: 'pod', name: pod.name, namespace: pod.namespace }); setDetailTab('terminal'); }} className="p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-[#111820] dark:hover:bg-[#1b2332] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#1b2332] transition cursor-pointer" title="Terminal"><Terminal className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }

    if (explorerSubTab === 'deployments') {
      const data = filteredDeployments;
      return (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-[#1b2332] text-slate-500 text-[10px] uppercase font-semibold tracking-wider bg-slate-50 dark:bg-[#0d1117]">
              {canDelete && <th className="px-6 py-4 w-12 text-center"><input type="checkbox" checked={data.length > 0 && selectedKeys.length === data.length} onChange={(e) => { if (e.target.checked) setSelectedKeys(data.map((d: any) => `${d.namespace}/${d.name}`)); else setSelectedKeys([]); }} className="w-3.5 h-3.5 rounded text-cyan-500 bg-slate-50 dark:bg-[#0d1117] border-slate-300 dark:border-slate-700 focus:ring-0 cursor-pointer" /></th>}
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Namespace</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-center">Desired</th>
              <th className="px-6 py-4 text-center">Ready</th>
              <th className="px-6 py-4 text-center">Available</th>
              <th className="px-6 py-4">Age</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1b2332] text-xs">
            {data.length === 0 ? (
              <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-bold">No Deployments found.</td></tr>
            ) : data.map((dep: any) => {
              const key = `${dep.namespace}/${dep.name}`;
              const isSelected = selectedKeys.includes(key);
              return (
                <tr key={dep.name} onClick={() => handleRowClick('deployment', dep.name, dep.namespace)}
                  className={`hover:bg-slate-50/80 dark:hover:bg-[#10121c]/60 cursor-pointer transition duration-150 ${selectedResource?.name === dep.name ? 'bg-slate-100/70 dark:bg-[#10121c]' : ''}`}>
                  {canDelete && <td className="px-6 py-4 w-12 text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={(e) => { if (e.target.checked) setSelectedKeys([...selectedKeys, key]); else setSelectedKeys(selectedKeys.filter((k: string) => k !== key)); }} className="w-3.5 h-3.5 rounded text-blue-500 bg-slate-50 dark:bg-[#111820] border-slate-300 dark:border-slate-600 focus:ring-0 cursor-pointer" /></td>}
                  <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{dep.name}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">{dep.namespace}</td>
                  <td className="px-6 py-4"><span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(dep.status)}`}>{dep.status}</span></td>
                  <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400 font-bold">{dep.replicas_desired}</td>
                  <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400 font-bold">{dep.replicas_ready}</td>
                  <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400 font-bold">{dep.replicas_available}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">{dep.age}</td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={(e) => { e.stopPropagation(); setPortDialog({ kind: 'deployment', name: dep.name, namespace: dep.namespace }); }}
                        className="p-1.5 rounded-md border border-slate-200 dark:border-[#1b2332] bg-slate-100 hover:bg-slate-200 dark:bg-[#111820] dark:hover:bg-[#1b2332] text-slate-500 dark:text-slate-400 transition cursor-pointer"
                        title="Port forward">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }

    if (explorerSubTab === 'services') {
      const data = filteredServices;
      return (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-[#1b2332] text-slate-500 text-[10px] uppercase font-semibold tracking-wider bg-slate-50 dark:bg-[#0d1117]">
              {canDelete && <th className="px-6 py-4 w-12 text-center"><input type="checkbox" checked={data.length > 0 && selectedKeys.length === data.length} onChange={(e) => { if (e.target.checked) setSelectedKeys(data.map((s: any) => `${s.namespace}/${s.name}`)); else setSelectedKeys([]); }} className="w-3.5 h-3.5 rounded text-cyan-500 bg-slate-50 dark:bg-[#0d1117] border-slate-300 dark:border-slate-700 focus:ring-0 cursor-pointer" /></th>}
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Namespace</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Cluster IP</th>
              <th className="px-6 py-4">External IP</th>
              <th className="px-6 py-4">Ports</th>
              <th className="px-6 py-4">Age</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1b2332] text-xs">
            {data.length === 0 ? (
              <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-bold">No Services found.</td></tr>
            ) : data.map((svc: any) => {
              const key = `${svc.namespace}/${svc.name}`;
              const isSelected = selectedKeys.includes(key);
              const pfActive = portForwardRegistry[key];
              return (
                <tr key={svc.name} onClick={() => handleRowClick('service', svc.name, svc.namespace)}
                  className={`hover:bg-slate-50/80 dark:hover:bg-[#10121c]/60 cursor-pointer transition duration-150 ${selectedResource?.name === svc.name ? 'bg-slate-100/70 dark:bg-[#10121c]' : ''}`}>
                  {canDelete && <td className="px-6 py-4 w-12 text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={(e) => { if (e.target.checked) setSelectedKeys([...selectedKeys, key]); else setSelectedKeys(selectedKeys.filter((k: string) => k !== key)); }} className="w-3.5 h-3.5 rounded text-blue-500 bg-slate-50 dark:bg-[#111820] border-slate-300 dark:border-slate-600 focus:ring-0 cursor-pointer" /></td>}
                  <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{svc.name}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">{svc.namespace}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-bold">{svc.type}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono">{svc.cluster_ip}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{svc.external_ip}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono">{svc.ports}</td>
                  <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">{svc.age}</td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {pfActive ? (
                        <>
                          {!pfActive.is_docker && pfActive.host === 'localhost' ? (
                            <a href={`http://localhost:${pfActive.port}`} target="_blank" rel="noopener noreferrer"
                              className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition cursor-pointer"
                              title={`Open localhost:${pfActive.port}`}
                              onClick={(e) => e.stopPropagation()}>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span className="px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold">
                              :{pfActive.port}
                            </span>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); handlePortForward('service', svc.name, svc.namespace); }}
                            className="p-1.5 rounded-md bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition cursor-pointer"
                            title="Stop port forward">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button onClick={(e) => { e.stopPropagation(); setPortDialog({ kind: 'service', name: svc.name, namespace: svc.namespace }); }}
                          className={`p-1.5 rounded-md border transition cursor-pointer ${portForwarding[key] ? 'bg-slate-100 dark:bg-[#111820] text-slate-400' : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#111820] dark:hover:bg-[#1b2332] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#1b2332]'}`}
                          title="Port forward">
                          {portForwarding[key] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    }

    if (explorerSubTab === 'nodes') {
      const data = filteredNodes;
      return (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-[#1b2332] text-slate-500 text-[10px] uppercase font-semibold tracking-wider bg-slate-50 dark:bg-[#0d1117]">
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Internal IP</th>
              <th className="px-6 py-4">Kubelet</th>
              <th className="px-6 py-4">Age</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1b2332] text-xs">
            {data.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-bold">No Nodes found.</td></tr>
            ) : data.map((n: any) => (
              <tr key={n.name} onClick={() => handleRowClick('node', n.name, '')}
                className={`hover:bg-slate-50/80 dark:hover:bg-[#10121c]/60 cursor-pointer transition duration-150 ${selectedResource?.name === n.name ? 'bg-slate-100/70 dark:bg-[#10121c]' : ''}`}>
                <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{n.name}</td>
                <td className="px-6 py-4"><span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(n.status)}`}>{n.status}</span></td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-bold">{n.role}</td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono">{n.internal_ip}</td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{n.kubelet}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">{n.age}</td>
                <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (explorerSubTab === 'configmaps') {
      const data = filteredConfigmaps;
      return (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-[#1b2332] text-slate-500 text-[10px] uppercase font-semibold tracking-wider bg-slate-50 dark:bg-[#0d1117]">
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Namespace</th>
              <th className="px-6 py-4">Data Keys</th>
              <th className="px-6 py-4 text-center">Count</th>
              <th className="px-6 py-4">Age</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1b2332] text-xs">
            {data.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-bold">No ConfigMaps found.</td></tr>
            ) : data.map((cm: any) => (
              <tr key={cm.name} onClick={() => handleRowClick('configmap', cm.name, cm.namespace)}
                className={`hover:bg-slate-50/80 dark:hover:bg-[#10121c]/60 cursor-pointer transition duration-150 ${selectedResource?.name === cm.name ? 'bg-slate-100/70 dark:bg-[#10121c]' : ''}`}>
                <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{cm.name}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">{cm.namespace}</td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono text-[10px]">{cm.keys?.join(', ') || ''}</td>
                <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400 font-bold">{cm.data_count ?? 0}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">{cm.age}</td>
                <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (explorerSubTab === 'secrets') {
      const data = filteredSecrets;
      return (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-[#1b2332] text-slate-500 text-[10px] uppercase font-semibold tracking-wider bg-slate-50 dark:bg-[#0d1117]">
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Namespace</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4 text-center">Keys</th>
              <th className="px-6 py-4">Age</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1b2332] text-xs">
            {data.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-bold">No Secrets found.</td></tr>
            ) : data.map((s: any) => (
              <tr key={s.name} onClick={() => handleRowClick('secret', s.name, s.namespace)}
                className={`hover:bg-slate-50/80 dark:hover:bg-[#10121c]/60 cursor-pointer transition duration-150 ${selectedResource?.name === s.name ? 'bg-slate-100/70 dark:bg-[#10121c]' : ''}`}>
                <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{s.name}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">{s.namespace}</td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-bold">{s.type}</td>
                <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400 font-bold">{s.key_count ?? 0}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">{s.age}</td>
                <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (explorerSubTab === 'statefulsets') {
      const data = filteredStatefulsets;
      return (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-[#1b2332] text-slate-500 text-[10px] uppercase font-semibold tracking-wider bg-slate-50 dark:bg-[#0d1117]">
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Namespace</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-center">Desired</th>
              <th className="px-6 py-4 text-center">Ready</th>
              <th className="px-6 py-4">Service</th>
              <th className="px-6 py-4">Age</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1b2332] text-xs">
            {data.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-bold">No StatefulSets found.</td></tr>
            ) : data.map((s: any) => (
              <tr key={s.name} onClick={() => handleRowClick('statefulset', s.name, s.namespace)}
                className={`hover:bg-slate-50/80 dark:hover:bg-[#10121c]/60 cursor-pointer transition duration-150 ${selectedResource?.name === s.name ? 'bg-slate-100/70 dark:bg-[#10121c]' : ''}`}>
                <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{s.name}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">{s.namespace}</td>
                <td className="px-6 py-4"><span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(s.status)}`}>{s.status}</span></td>
                <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400 font-bold">{s.replicas_desired}</td>
                <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400 font-bold">{s.replicas_ready}</td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono">{s.service_name}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">{s.age}</td>
                <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={(e) => { e.stopPropagation(); setPortDialog({ kind: 'statefulset', name: s.name, namespace: s.namespace }); }}
                      className="p-1.5 rounded-md border border-slate-200 dark:border-[#1b2332] bg-slate-100 hover:bg-slate-200 dark:bg-[#111820] dark:hover:bg-[#1b2332] text-slate-500 dark:text-slate-400 transition cursor-pointer"
                      title="Port forward">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (explorerSubTab === 'daemonsets') {
      const data = filteredDaemonsets;
      return (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-[#1b2332] text-slate-500 text-[10px] uppercase font-semibold tracking-wider bg-slate-50 dark:bg-[#0d1117]">
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Namespace</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-center">Desired</th>
              <th className="px-6 py-4 text-center">Ready</th>
              <th className="px-6 py-4 text-center">Current</th>
              <th className="px-6 py-4">Age</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1b2332] text-xs">
            {data.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-bold">No DaemonSets found.</td></tr>
            ) : data.map((ds: any) => (
              <tr key={ds.name} onClick={() => handleRowClick('daemonset', ds.name, ds.namespace)}
                className={`hover:bg-slate-50/80 dark:hover:bg-[#10121c]/60 cursor-pointer transition duration-150 ${selectedResource?.name === ds.name ? 'bg-slate-100/70 dark:bg-[#10121c]' : ''}`}>
                <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200">{ds.name}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">{ds.namespace}</td>
                <td className="px-6 py-4"><span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(ds.status)}`}>{ds.status}</span></td>
                <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400 font-bold">{ds.desired}</td>
                <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400 font-bold">{ds.ready}</td>
                <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400 font-bold">{ds.current}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">{ds.age}</td>
                <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={(e) => { e.stopPropagation(); setPortDialog({ kind: 'daemonset', name: ds.name, namespace: ds.namespace }); }}
                      className="p-1.5 rounded-md border border-slate-200 dark:border-[#1b2332] bg-slate-100 hover:bg-slate-200 dark:bg-[#111820] dark:hover:bg-[#1b2332] text-slate-500 dark:text-slate-400 transition cursor-pointer"
                      title="Port forward">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (explorerSubTab === 'events') {
      const data = filteredEventsAll;
      return (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-[#1b2332] text-slate-500 text-[10px] uppercase font-semibold tracking-wider bg-slate-50 dark:bg-[#0d1117]">
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Reason</th>
              <th className="px-6 py-4">Message</th>
              <th className="px-6 py-4">Object</th>
              <th className="px-6 py-4">Namespace</th>
              <th className="px-6 py-4 text-center">Count</th>
              <th className="px-6 py-4">Age</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1b2332] text-xs">
            {data.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 font-bold">No Events found.</td></tr>
            ) : data.map((ev: any, i: number) => (
              <tr key={`${ev.namespace}/${ev.involved_name}/${i}`}
                className="hover:bg-slate-50/80 dark:hover:bg-[#10121c]/60 transition duration-150">
                <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ev.type === 'Warning' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}`}>{ev.type}</span></td>
                <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-300">{ev.reason}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 max-w-md truncate">{ev.message}</td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{ev.involved_kind}/{ev.involved_name}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">{ev.namespace}</td>
                <td className="px-6 py-4 text-center text-slate-600 dark:text-slate-400 font-bold">{ev.count}</td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-bold">{ev.age}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return null;
  };

  return (
    <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#1b2332] rounded-xl overflow-hidden shadow-sm animate-fade-in relative flex flex-col">

      {/* Explorer Table Header tabs */}
      <div className="border-b border-slate-200 dark:border-[#1b2332] bg-slate-50/50 dark:bg-[#111820] p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center space-x-3.5 w-full sm:w-auto overflow-x-auto min-w-0 select-none">
          <div className="flex bg-slate-200/60 dark:bg-[#111820] rounded-lg p-0.5 border border-slate-200 dark:border-[#1b2332] select-none shrink-0 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setExplorerSubTab(tab.id as any)}
                className={`px-3 py-2 rounded-lg font-semibold text-[11px] transition cursor-pointer whitespace-nowrap ${explorerSubTab === tab.id
                  ? 'bg-white dark:bg-[#1f2330] text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-[#2d3142]/45'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                {tab.label} <span className="ml-1 text-[10px] opacity-70 font-bold">({getTabCount(tab.id)})</span>
              </button>
            ))}
          </div>
          {canDelete && selectedKeys.length > 0 && (
            <button onClick={handleBulkDelete} disabled={bulkDeleting}
              className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer disabled:opacity-50 shrink-0">
              {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              <span>Delete ({selectedKeys.length})</span>
            </button>
          )}
        </div>

        <div className="flex items-center bg-slate-100 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-lg px-3 py-2 w-full max-w-xs">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input type="text" placeholder={`Search ${explorerSubTab}...`} value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent text-xs text-slate-700 dark:text-slate-200 border-none outline-none focus:ring-0 p-0 w-full font-bold" />
        </div>
      </div>

      {/* Data Lists Table */}
      <div className="overflow-x-auto flex-1">
        {renderTable()}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#1b2332] p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3 text-red-500">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Delete Selected Resources?</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              Delete {selectedKeys.length} selected {explorerSubTab}? This is permanent.
            </p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-[#1b2332] dark:hover:bg-[#242d3d] text-slate-700 dark:text-slate-300 font-semibold py-2 rounded-lg text-xs transition cursor-pointer">
                Cancel
              </button>
              <button onClick={executeBulkDelete}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 rounded-lg text-xs transition cursor-pointer">
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Port Forward Dialog */}
      {portDialog && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in"
          onClick={() => setPortDialog(null)}>
          <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#1b2332] p-5 rounded-xl shadow-2xl max-w-xs w-full mx-4 space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">Port Forward</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              {portDialog.kind}/{portDialog.name} · {portDialog.namespace}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Local Port</label>
                <input
                  type="number"
                  value={portLocal}
                  onChange={(e) => setPortLocal(e.target.value)}
                  placeholder="e.g. 8080"
                  autoFocus
                  className="w-full bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-bold"
                />
              </div>
              {(() => {
                const pod = filteredPods.find((p: any) => p.name === portDialog.name && p.namespace === portDialog.namespace);
                const svc = filteredServices.find((s: any) => s.name === portDialog.name && s.namespace === portDialog.namespace);
                let targetHint = '';
                if (pod?.ports) {
                  const m = pod.ports.match(/(\d+)/);
                  if (m) targetHint = m[1];
                } else if (svc?.ports) {
                  const m = svc.ports.match(/(\d+)/);
                  if (m) targetHint = m[1];
                }
                return targetHint ? (
                  <div className="text-[9px] text-slate-400 font-medium bg-slate-50 dark:bg-[#111820] rounded-lg px-3 py-1.5 border border-slate-200 dark:border-[#1b2332]">
                    Container port: <span className="text-cyan-600 dark:text-cyan-400 font-bold">{targetHint}</span>
                    {portLocal && ` · localhost:${portLocal} → :${targetHint}`}
                  </div>
                ) : (
                  portLocal && (
                    <div className="text-[9px] text-slate-400 font-medium bg-slate-50 dark:bg-[#111820] rounded-lg px-3 py-1.5 border border-slate-200 dark:border-[#1b2332]">
                      localhost:{portLocal} → :{portLocal}
                    </div>
                  )
                );
              })()}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setPortDialog(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-[#1b2332] dark:hover:bg-[#242d3d] text-slate-700 dark:text-slate-300 font-semibold py-2 rounded-lg text-xs transition cursor-pointer">
                Cancel
              </button>
              <button onClick={() => {
                const local = parseInt(portLocal);
                if (!local || local < 1) { setToast?.({ message: "Enter a valid local port", type: 'error' }); return; }
                const pod = filteredPods.find((p: any) => p.name === portDialog.name && p.namespace === portDialog.namespace);
                const svc = filteredServices.find((s: any) => s.name === portDialog.name && s.namespace === portDialog.namespace);
                let detectedTarget: number | undefined;
                const portsStr = pod?.ports || svc?.ports || '';
                const m = portsStr.match(/(\d+)/);
                if (m) detectedTarget = parseInt(m[1]);
                handlePortForward(portDialog.kind, portDialog.name, portDialog.namespace, local, detectedTarget);
                setPortDialog(null);
                setPortLocal('');
              }}
                className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-2 rounded-lg text-xs transition cursor-pointer">
                Forward
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
