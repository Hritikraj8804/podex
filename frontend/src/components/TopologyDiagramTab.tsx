import React, { useMemo, useState } from 'react';
import {
  Network, Loader2, Minimize2, Maximize2, Sliders, Cpu,
  Activity, GitBranch, Search, Focus,
} from 'lucide-react';

interface TopologyDiagramTabProps {
  filteredTopology: { nodes: any[], edges: any[] };
  topologyLoading: boolean;
  topologyData: { nodes: any[], edges: any[] };
  namespaceFilter: string;
  zoomScale: number;
  setZoomScale: (zoom: number) => void;
  panOffset: { x: number, y: number };
  setPanOffset: (pan: { x: number, y: number }) => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  handleNodeMouseDown: (e: React.MouseEvent, nodeId: string, initialX: number, initialY: number) => void;
  customNodePositions: { [id: string]: { x: number, y: number } };
  setCustomNodePositions?: (pos: { [id: string]: { x: number, y: number } } | ((prev: { [id: string]: { x: number, y: number } }) => any)) => void;
  isNodeConnected: (nodeId: string) => boolean;
  setHoveredNodeId: (id: string | null) => void;
  hoveredNodeId: string | null;
  nodeDragDistance: React.RefObject<number>;
  setSelectedResource: (resource: { type: 'pod' | 'deployment' | 'service', name: string, namespace: string } | null) => void;
  setDetailTab: (tab: 'overview' | 'yaml' | 'logs' | 'investigate' | 'terminal') => void;
  getAccentColor?: (type: 'bg' | 'text' | 'border' | 'bgMuted') => string;
}

const CARD_W = 230;
const CARD_H = 64;
const COL_GAP = 100;

const HEALTH_CONFIG: Record<string, { border: string; bg: string; text: string; dot: string; label: string }> = {
  healthy:  { border: 'border-l-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-500', dot: 'bg-emerald-500', label: 'Healthy' },
  running:  { border: 'border-l-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-500', dot: 'bg-emerald-500', label: 'Running' },
  degraded: { border: 'border-l-amber-500',   bg: 'bg-amber-500/10',   text: 'text-amber-500',   dot: 'bg-amber-500',   label: 'Degraded' },
  pending:  { border: 'border-l-amber-500',   bg: 'bg-amber-500/10',   text: 'text-amber-500',   dot: 'bg-amber-500',   label: 'Pending' },
  critical: { border: 'border-l-red-500',     bg: 'bg-red-500/10',     text: 'text-red-500',     dot: 'bg-red-500',     label: 'Critical' },
  failed:   { border: 'border-l-red-500',     bg: 'bg-red-500/10',     text: 'text-red-500',     dot: 'bg-red-500',     label: 'Failed' },
  crash:    { border: 'border-l-red-500',     bg: 'bg-red-500/10',     text: 'text-red-500',     dot: 'bg-red-500',     label: 'CrashLoop' },
};

const resolveHealth = (status: string) => {
  const s = status.toLowerCase();
  return HEALTH_CONFIG[s] || HEALTH_CONFIG.failed;
};

const SvgDefs = () => (
  <defs>
    <marker id="arrow-topo" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" className="fill-slate-400 dark:fill-slate-600" />
    </marker>
    <marker id="arrow-topo-active" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" className="fill-blue-500" />
    </marker>
  </defs>
);

export const TopologyDiagramTab: React.FC<TopologyDiagramTabProps> = ({
  filteredTopology,
  topologyLoading,
  topologyData,
  namespaceFilter,
  zoomScale,
  setZoomScale,
  panOffset,
  setPanOffset,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleNodeMouseDown,
  customNodePositions,
  setCustomNodePositions,
  isNodeConnected,
  setHoveredNodeId,
  hoveredNodeId,
  nodeDragDistance,
  setSelectedResource,
  setDetailTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const services = useMemo(() => filteredTopology.nodes.filter(n => n.type === 'service'), [filteredTopology]);
  const deployments = useMemo(() => filteredTopology.nodes.filter(n => n.type === 'deployment'), [filteredTopology]);
  const pods = useMemo(() => filteredTopology.nodes.filter(n => n.type === 'pod'), [filteredTopology]);
  const others = useMemo(() => filteredTopology.nodes.filter(n => !['service', 'deployment', 'pod'].includes(n.type)), [filteredTopology]);

  const healthCounts = useMemo(() => {
    const counts = { healthy: 0, degraded: 0, failed: 0 };
    filteredTopology.nodes.forEach(n => {
      const s = n.status?.toLowerCase();
      if (s === 'healthy' || s === 'running') counts.healthy++;
      else if (s === 'degraded' || s === 'pending') counts.degraded++;
      else counts.failed++;
    });
    return counts;
  }, [filteredTopology]);

  const nodePositions = useMemo(() => {
    const pos: { [id: string]: { x: number; y: number } } = {};
    const cols = [
      { items: services, x: 60 },
      { items: deployments, x: 60 + CARD_W + COL_GAP },
      { items: pods, x: 60 + (CARD_W + COL_GAP) * 2 },
    ];
    cols.forEach(({ items, x }) => {
      items.forEach((node, idx) => {
        pos[node.id] = customNodePositions[node.id] || { x, y: idx * (CARD_H + 16) + 80 };
      });
    });
    let offset = Math.max(services.length, deployments.length, pods.length);
    others.forEach((node, idx) => {
      pos[node.id] = customNodePositions[node.id] || { x: 60, y: (offset + idx) * (CARD_H + 16) + 80 };
    });
    return pos;
  }, [services, deployments, pods, others, customNodePositions]);

  const canvasHeight = useMemo(() => {
    const maxRows = Math.max(services.length, deployments.length, pods.length, others.length + others.length, 3);
    return maxRows * (CARD_H + 16) + 160;
  }, [services, deployments, pods, others]);

  const resourceIcon = (type: string, cls = 'w-3.5 h-3.5') => {
    const cn = `${cls} text-slate-400 dark:text-slate-500`;
    switch (type) {
      case 'service':    return <Network className={cn} />;
      case 'deployment': return <Sliders className={cn} />;
      case 'pod':        return <Cpu className={cn} />;
      default:           return <GitBranch className={cn} />;
    }
  };

  const cleanEdges = useMemo(() => {
    const allNodes = filteredTopology.nodes;
    const allEdges = filteredTopology.edges;

    const ingressEdges = allEdges.filter(e => {
      const src = allNodes.find(n => n.id === e.source);
      return src?.type === 'ingress';
    });

    const deployEdges = allEdges.filter(e => {
      const src = allNodes.find(n => n.id === e.source);
      return src?.type === 'deployment';
    });

    const servicePodEdges = allEdges.filter(e => {
      const src = allNodes.find(n => n.id === e.source);
      const tgt = allNodes.find(n => n.id === e.target);
      return src?.type === 'service' && tgt?.type === 'pod';
    });

    const serviceDeployEdges: { source: string; target: string; relation: string }[] = [];
    for (const sp of servicePodEdges) {
      const podId = sp.target;
      const matchingDeploy = deployEdges.find(de => de.target === podId);
      if (matchingDeploy) {
        const key = `${sp.source}->${matchingDeploy.source}`;
        if (!serviceDeployEdges.some(e => `${e.source}->${e.target}` === key)) {
          serviceDeployEdges.push({
            source: sp.source,
            target: matchingDeploy.source,
            relation: 'routes_to',
          });
        }
      }
    }

    return [...ingressEdges, ...serviceDeployEdges, ...deployEdges];
  }, [filteredTopology]);

  const filteredNodes = useMemo(() => {
    if (!searchQuery) return filteredTopology.nodes;
    const q = searchQuery.toLowerCase();
    return filteredTopology.nodes.filter(n => n.name?.toLowerCase().includes(q) || n.type?.toLowerCase().includes(q));
  }, [filteredTopology, searchQuery]);

  const visibleEdges = useMemo(() => {
    const visibleIds = new Set(filteredNodes.map(n => n.id));
    return cleanEdges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));
  }, [cleanEdges, filteredNodes]);

  const handleResetView = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    if (setCustomNodePositions) {
      setCustomNodePositions({});
    }
  };

  const totalNodes = filteredTopology.nodes.length;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Activity className="w-[18px] h-[18px] text-blue-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-white leading-none">Cluster Topology</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{namespaceFilter || 'default'}</span>
              <span className="text-slate-300 dark:text-slate-600 text-[8px]">&middot;</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                <span className="font-semibold text-slate-600 dark:text-slate-400">{totalNodes}</span> resources
              </span>
              <span className="text-slate-300 dark:text-slate-600 text-[8px]">&middot;</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-cyan-500 font-medium">{services.length} svc</span>
                <span className="text-[9px] text-emerald-500 font-medium">{deployments.length} dep</span>
                <span className="text-[9px] text-blue-500 font-medium">{pods.length} pods</span>
              </div>
            </div>
          </div>
        </div>

        {/* Health Summary Badges */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-semibold text-emerald-500">{healthCounts.healthy}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className="text-[10px] font-semibold text-amber-500">{healthCounts.degraded}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-[10px] font-semibold text-red-500">{healthCounts.failed}</span>
          </div>
        </div>
      </div>

      {/* ---- Canvas ---- */}
      {topologyLoading && topologyData.nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#1b2332] rounded-xl">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Mapping cluster topology...</span>
        </div>
      ) : topologyData.nodes.length === 0 ? (
        <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#1b2332] rounded-xl py-16 text-center space-y-4">
          <Network className="w-10 h-10 text-slate-500 mx-auto" />
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Resources Found</h4>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
              Deploy resources to <code className="font-mono text-blue-500 bg-blue-500/10 px-1 py-0.5 rounded text-[10px]">{namespaceFilter || 'default'}</code> or switch namespaces to visualize the topology.
            </p>
          </div>
        </div>
      ) : (
        <div
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-[#1b2332] bg-slate-50 dark:bg-[#080b12] h-[72vh] min-h-[480px] select-none cursor-grab active:cursor-grabbing"
        >
          {/* Tech-grid background - covers entire canvas */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-15"
            style={{
              backgroundImage: `
                linear-gradient(rgba(59,130,246,0.5) 1px, transparent 1px),
                linear-gradient(90deg, rgba(59,130,246,0.5) 1px, transparent 1px)
              `,
              backgroundSize: '32px 32px',
            }}
          />

          {/* ---- Toolbar overlay ---- */}
          <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
            {/* Search + reset view */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/90 dark:bg-[#0d1117]/90 border border-slate-200 dark:border-[#1b2332] backdrop-blur-sm">
                <Search className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-transparent border-none outline-none text-[10px] text-slate-700 dark:text-slate-300 w-20 placeholder:text-slate-400 dark:placeholder:text-slate-600 font-medium"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-slate-300 cursor-pointer text-[10px] font-bold px-1">&times;</button>
                )}
              </div>
              <div className="w-px h-5 bg-slate-200 dark:bg-[#1b2332]" />
              <button
                onClick={handleResetView}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/90 dark:bg-[#0d1117]/90 border border-slate-200 dark:border-[#1b2332] hover:bg-slate-100 dark:hover:bg-[#111820] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition cursor-pointer pointer-events-auto text-[10px] font-medium"
                title="Reset view &amp; node positions"
              >
                <Focus className="w-3 h-3" />
                Reset View
              </button>
            </div>
          </div>

          {/* ---- Viewport wrapper ---- */}
          <div
            id="topology-container"
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
              transformOrigin: 'top left',
              width: `${60 * 3 + CARD_W * 3 + COL_GAP * 2}px`,
              height: `${canvasHeight}px`,
            }}
            className="absolute inset-0 p-6 transition-transform duration-75 ease-out"
          >
            {/* ---- SVG connector lines ---- */}
            <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible z-0">
              <SvgDefs />
              {visibleEdges.map(edge => {
                const srcPos = nodePositions[edge.source];
                const tgtPos = nodePositions[edge.target];
                if (!srcPos || !tgtPos) return null;

                const sx = srcPos.x + CARD_W;
                const sy = srcPos.y + CARD_H / 2;
                const ex = tgtPos.x;
                const ey = tgtPos.y + CARD_H / 2;

                const dx = Math.max(30, Math.abs(ex - sx) * 0.4);
                const d = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${ex - dx} ${ey}, ${ex} ${ey}`;
                const active = !hoveredNodeId || edge.source === hoveredNodeId || edge.target === hoveredNodeId;

                return (
                  <g key={edge.id || `${edge.source}--${edge.target}`}>
                    <path d={d} fill="none" stroke={active ? '#3b82f6' : '#cbd5e1'} strokeWidth={active ? 4 : 1.5}
                      className={`transition-all duration-300 ${active ? 'opacity-20' : 'opacity-10'}`} />
                    <path d={d} fill="none" stroke={active ? '#3b82f6' : '#94a3b8'} strokeWidth={active ? 1.5 : 0.8}
                      className={`transition-all duration-300 ${active ? 'opacity-80' : 'opacity-40 dark:opacity-20'}`}
                      markerEnd={active ? 'url(#arrow-topo-active)' : 'url(#arrow-topo)'} />
                    {active && (
                      <path d={d} fill="none" stroke="rgba(96,165,250,0.5)" strokeWidth={1.5} strokeDasharray="4 8"
                        className="topo-flow-line" />
                    )}
                  </g>
                );
              })}
            </svg>

            {/* ---- Filtered nodes / cards ---- */}
            {filteredNodes.map(node => {
              const pos = nodePositions[node.id];
              if (!pos) return null;

              const health = resolveHealth(node.status);
              const connected = isNodeConnected(node.id);
              const resourceId = node.id.replace(/[/\s]/g, '-');
              const hasReplicas = node.type === 'deployment' && node.details?.replicas;

              return (
                <div
                  key={node.id}
                  id={resourceId}
                  style={{
                    position: 'absolute',
                    left: pos.x,
                    top: pos.y,
                    width: CARD_W,
                    height: CARD_H,
                  }}
                  onMouseDown={e => {
                    const col = node.type === 'service' ? services : node.type === 'deployment' ? deployments : node.type === 'pod' ? pods : others;
                    const idx = col.indexOf(node);
                    const initX = node.type === 'service' ? 60 : node.type === 'deployment' ? 60 + CARD_W + COL_GAP : node.type === 'pod' ? 60 + (CARD_W + COL_GAP) * 2 : 60;
                    const initY = idx * (CARD_H + 16) + 80;
                    handleNodeMouseDown(e, node.id, initX, initY);
                  }}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onClick={() => {
                    if (nodeDragDistance.current && nodeDragDistance.current > 5) return;
                    setSelectedResource({ type: node.type, name: node.name, namespace: node.namespace });
                    setDetailTab('overview');
                  }}
                  className={`p-2.5 bg-white dark:bg-[#0c101a] border border-slate-200 dark:border-[#1b2332] rounded-lg flex items-center gap-2 cursor-pointer relative z-10
                    transition-all duration-200 shadow-sm
                    hover:border-blue-400 dark:hover:border-blue-500/30 hover:shadow-md hover:shadow-blue-500/10 dark:hover:shadow-blue-500/5 hover:bg-slate-50 dark:hover:bg-[#0f1520]
                    ${health.border} border-l-[3px]
                    ${connected ? 'opacity-100' : 'opacity-35 hover:opacity-80'}
                  `}
                >
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${health.bg}`}>
                    {resourceIcon(node.type, 'w-3.5 h-3.5')}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate leading-snug">{node.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`w-1 h-1 rounded-full shrink-0 ${health.dot}`} />
                      <span className={`text-[9px] font-medium ${health.text} capitalize`}>{health.label}</span>
                      {hasReplicas && (
                        <>
                          <span className="text-slate-300 dark:text-slate-600 text-[8px]">&middot;</span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">{node.details.replicas}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <span className="text-[8px] font-medium text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-[#151e2c] px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                    {node.type === 'service' ? 'SVC' : node.type === 'deployment' ? 'DEP' : node.type === 'pod' ? 'POD' : 'NODE'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* ---- Zoom controls ---- */}
          <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1 bg-white/90 dark:bg-[#0d1117]/90 border border-slate-200 dark:border-[#1b2332] rounded-lg px-1.5 py-1 shadow-lg backdrop-blur-sm">
            <button onClick={() => setZoomScale(Math.max(0.5, +(zoomScale - 0.1).toFixed(1)))}
              disabled={zoomScale <= 0.5}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-[#1b2332] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 transition cursor-pointer">
              <Minimize2 className="w-3 h-3" />
            </button>
            <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 min-w-[32px] text-center select-none">{Math.round(zoomScale * 100)}%</span>
            <button onClick={() => setZoomScale(Math.min(1.5, +(zoomScale + 0.1).toFixed(1)))}
              disabled={zoomScale >= 1.5}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-[#1b2332] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-30 transition cursor-pointer">
              <Maximize2 className="w-3 h-3" />
            </button>
            <div className="w-px h-4 bg-slate-200 dark:bg-[#1b2332] mx-1" />
          </div>
        </div>
      )}
      <style>{`
        @keyframes topoFlow {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -24; }
        }
        .topo-flow-line {
          animation: topoFlow 0.8s linear infinite;
        }
      `}</style>
    </div>
  );
};
