import React from 'react';
import { Network, Loader2, Minimize2, Maximize2, Sliders, Cpu } from 'lucide-react';

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
  isNodeConnected: (nodeId: string) => boolean;
  setHoveredNodeId: (id: string | null) => void;
  hoveredNodeId: string | null;
  nodeDragDistance: React.RefObject<number>;
  setSelectedResource: (resource: { type: 'pod' | 'deployment' | 'service', name: string, namespace: string } | null) => void;
  setDetailTab: (tab: 'overview' | 'yaml' | 'logs' | 'investigate' | 'terminal') => void;
  getAccentColor: (type: 'bg' | 'text' | 'border' | 'bgMuted') => string;
}

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
  isNodeConnected,
  setHoveredNodeId,
  hoveredNodeId,
  nodeDragDistance,
  setSelectedResource,
  setDetailTab,
  getAccentColor,
}) => {
  // Group resources
  const services = filteredTopology.nodes.filter(n => n.type === 'service');
  const deployments = filteredTopology.nodes.filter(n => n.type === 'deployment');
  const pods = filteredTopology.nodes.filter(n => n.type === 'pod');
  const otherNodes = filteredTopology.nodes.filter(n => n.type !== 'service' && n.type !== 'deployment' && n.type !== 'pod');

  // Compute explicit positions
  const cardWidth = 240;
  const cardHeight = 70;
  const serviceX = 80;
  const deploymentX = 420;
  const podX = 760;

  const nodePositions: { [id: string]: { x: number, y: number } } = {};
  
  services.forEach((node, idx) => {
    nodePositions[node.id] = customNodePositions[node.id] || { x: serviceX, y: idx * 110 + 100 };
  });
  deployments.forEach((node, idx) => {
    nodePositions[node.id] = customNodePositions[node.id] || { x: deploymentX, y: idx * 110 + 100 };
  });
  pods.forEach((node, idx) => {
    nodePositions[node.id] = customNodePositions[node.id] || { x: podX, y: idx * 110 + 100 };
  });
  otherNodes.forEach((node, idx) => {
    nodePositions[node.id] = customNodePositions[node.id] || { x: serviceX, y: (services.length + idx) * 110 + 100 };
  });

  // Compute dynamic canvas height to fit all elements
  const maxRows = Math.max(3, services.length, deployments.length, pods.length, otherNodes.length);
  const canvasHeight = maxRows * 110 + 200;

  // Health border resolver
  const getHealthBorder = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'healthy' || s === 'running') return 'border-l-[4px] border-l-emerald-500';
    if (s === 'degraded' || s === 'pending') return 'border-l-[4px] border-l-amber-500 animate-pulse';
    return 'border-l-[4px] border-l-red-500';
  };
  
  const getHealthBg = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'healthy' || s === 'running') return 'bg-emerald-500/10 dark:bg-emerald-950/20';
    if (s === 'degraded' || s === 'pending') return 'bg-amber-500/10 dark:bg-amber-950/20';
    return 'bg-red-500/10 dark:bg-red-950/20';
  };

  const getHealthText = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'healthy' || s === 'running') return 'text-emerald-600 dark:text-emerald-400';
    if (s === 'degraded' || s === 'pending') return 'text-amber-600 dark:text-amber-400';
    return 'text-red-500 dark:text-red-400';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Network className={`w-5 h-5 ${getAccentColor('text')}`} />
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 m-0">Live Cluster Topology</h3>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-[10px] font-extrabold text-slate-500 dark:text-slate-400 bg-white dark:bg-[#1a1932] border border-slate-200 dark:border-[#1e202c] px-3.5 py-2 rounded-xl shadow-sm select-none">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2.5 rounded bg-emerald-500" />
            <span>Healthy</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded bg-amber-500" />
            <span>Degraded</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded bg-red-500" />
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
        <div className="bg-white dark:bg-[#1a1932] border border-slate-200 dark:border-[#2d2c50] p-12 rounded-3xl text-center space-y-4 shadow-sm">
          <Network className="w-10 h-10 text-slate-400 mx-auto" />
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 m-0">No Active Resources Found</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed font-semibold">
            Ensure workloads are deployed in the <code className="font-mono text-cyan-600 dark:text-cyan-400">{namespaceFilter || 'default'}</code> namespace to visualize connection maps.
          </p>
        </div>
      ) : (() => {
        return (
          <div 
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-[#2d2c50] bg-slate-50 dark:bg-[#121124] h-[620px] select-none cursor-grab active:cursor-grabbing"
          >
            
            {/* Floating Zoom & Pan Reset Toolbar overlay */}
            <div className="absolute bottom-4 left-4 flex items-center space-x-1.5 bg-white/95 dark:bg-[#1a1932]/95 border border-slate-200 dark:border-[#1e202c] p-1.5 rounded-xl shadow-lg z-25 backdrop-blur-md">
              <button
                onClick={() => setZoomScale(Math.max(0.6, zoomScale - 0.1))}
                disabled={zoomScale <= 0.6}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 disabled:opacity-30 cursor-pointer"
                title="Zoom Out"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setZoomScale(1.0);
                  setPanOffset({ x: 0, y: 0 });
                }}
                className="text-[10px] px-2 py-0.5 font-extrabold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded cursor-pointer"
                title="Reset View"
              >
                {Math.round(zoomScale * 100)}% (Reset)
              </button>
              <button
                onClick={() => setZoomScale(Math.min(1.4, zoomScale + 0.1))}
                disabled={zoomScale >= 1.4}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 disabled:opacity-30 cursor-pointer"
                title="Zoom In"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Scale and Pan Viewport Wrapper with project-themed dot grid background */}
            <div 
              id="topology-container"
              style={{ 
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`, 
                transformOrigin: 'top left',
                width: '1100px', 
                height: `${canvasHeight}px` 
              }}
              className="absolute inset-0 p-8 arena-grid [background-size:24px_24px] transition-transform duration-75 ease-out"
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

                {/* Draw connector paths dynamically from node positions */}
                {filteredTopology.edges.map((edge) => {
                  const srcPos = nodePositions[edge.source];
                  const tgtPos = nodePositions[edge.target];
                  if (!srcPos || !tgtPos) return null;

                  const startX = srcPos.x + cardWidth;
                  const startY = srcPos.y + cardHeight / 2;
                  const endX = tgtPos.x - 8;
                  const endY = tgtPos.y + cardHeight / 2;

                  const dx = Math.max(40, Math.abs(endX - startX) * 0.45);
                  const d = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;
                  const isActive = !hoveredNodeId || edge.source === hoveredNodeId || edge.target === hoveredNodeId;

                  return (
                    <path
                      key={`${edge.source}-->${edge.target}`}
                      d={d}
                      fill="none"
                      stroke={isActive ? "currentColor" : "currentColor"}
                      strokeWidth={isActive ? 2.2 : 1.0}
                      className={`transition-all duration-300 ${
                        isActive 
                          ? 'text-cyan-500/80 dark:text-cyan-400/80 stroke-cyan-500 dark:stroke-cyan-400 opacity-90' 
                          : 'text-slate-200 dark:text-slate-800 opacity-15'
                      }`}
                      markerEnd={isActive ? "url(#arrow-active)" : "url(#arrow)"}
                    />
                  );
                })}
              </svg>

              {/* Absolute-positioned Interactive Cards */}
              {filteredTopology.nodes.map((node) => {
                const pos = nodePositions[node.id];
                if (!pos) return null;

                const htmlId = node.id.replace(/\//g, '-');
                const isConnected = isNodeConnected(node.id);

                return (
                  <div
                    key={node.id}
                    id={htmlId}
                    style={{
                      position: 'absolute',
                      left: `${pos.x}px`,
                      top: `${pos.y}px`,
                      width: `${cardWidth}px`,
                      height: `${cardHeight}px`
                    }}
                    onMouseDown={(e) => {
                      const initialX = node.type === 'service' ? serviceX : node.type === 'deployment' ? deploymentX : node.type === 'pod' ? podX : serviceX;
                      const initialY = (node.type === 'service' ? services : node.type === 'deployment' ? deployments : node.type === 'pod' ? pods : otherNodes).indexOf(node) * 110 + 100;
                      handleNodeMouseDown(e, node.id, initialX, initialY);
                    }}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onClick={() => {
                      if (nodeDragDistance.current && nodeDragDistance.current > 5) return;
                      setSelectedResource({ type: node.type as any, name: node.name, namespace: node.namespace });
                      setDetailTab('overview');
                    }}
                    className={`interactive-card p-3 bg-white dark:bg-[#0c0e14] border border-slate-200 dark:border-[#1a1c26] rounded-xl flex items-center justify-between cursor-pointer shadow-sm relative z-10 transition-all duration-200 ${
                      getHealthBorder(node.status)
                    } ${
                      !isConnected ? 'opacity-30 scale-95 hover:opacity-100 hover:scale-100' : 'hover:scale-[1.03] hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${getHealthBg(node.status)}`}>
                        {node.type === 'service' ? (
                          <Network className={`w-3.5 h-3.5 ${getHealthText(node.status)}`} />
                        ) : node.type === 'deployment' ? (
                          <Sliders className={`w-3.5 h-3.5 ${getHealthText(node.status)}`} />
                        ) : (
                          <Cpu className={`w-3.5 h-3.5 ${getHealthText(node.status)}`} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-[11px] text-slate-800 dark:text-slate-200 truncate leading-snug">
                          {node.name}
                        </div>
                        <div className="text-[9px] text-slate-400 dark:text-slate-500 font-medium truncate uppercase tracking-wider">
                          {node.type === 'service' ? `Service (${node.details?.type || 'ClusterIP'})` : node.type}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end space-y-0.5 pr-1">
                      <span className={`text-[9px] font-black uppercase tracking-wider ${getHealthText(node.status)}`}>
                        {node.status}
                      </span>
                      {node.type === 'deployment' && node.details?.replicas && (
                        <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 font-bold">
                          {node.details.replicas}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

            </div>
          </div>
        );
      })()}

    </div>
  );
};
