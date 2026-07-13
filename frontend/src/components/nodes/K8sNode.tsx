import React from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { Cpu, Layers, Database, Network, Globe, FileText, Lock } from 'lucide-react';

const NODE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pod:        { icon: Cpu,        color: '#3b82f6', label: 'Pod' },
  deployment: { icon: Layers,     color: '#10b981', label: 'Deployment' },
  statefulset:{ icon: Database,   color: '#8b5cf6', label: 'StatefulSet' },
  service:    { icon: Network,    color: '#06b6d4', label: 'Service' },
  ingress:    { icon: Globe,      color: '#f59e0b', label: 'Ingress' },
  configmap:  { icon: FileText,   color: '#64748b', label: 'ConfigMap' },
  secret:     { icon: Lock,       color: '#f43f5e', label: 'Secret' },
};

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  draft:     { color: '#64748b', label: 'Draft' },
  deploying: { color: '#f59e0b', label: 'Deploying' },
  healthy:   { color: '#10b981', label: 'Healthy' },
  failed:    { color: '#ef4444', label: 'Failed' },
};

const K8sNode: React.FC<NodeProps> = ({ data, selected }) => {
  const config = NODE_CONFIG[data.nodeType as string] || NODE_CONFIG.pod;
  const status = STATUS_MAP[data.status as string] || STATUS_MAP.draft;
  const Icon = config.icon;
  const hasOutput = !['configmap', 'secret'].includes(data.nodeType as string);

  return (
    <div
      className={`
        group relative flex flex-col items-center
        bg-white dark:bg-[#0f1219]
        border-[1.5px] rounded-xl
        transition-all duration-150 select-none
        ${selected
          ? 'border-cyan-400 dark:border-cyan-400 shadow-[0_0_0_3px_rgba(6,182,212,0.15)]'
          : 'border-slate-200 dark:border-[#1e2536] hover:border-slate-300 dark:hover:border-[#2a3348]'
        }
        hover:shadow-lg dark:hover:shadow-black/30
      `}
      style={{ width: 200 }}
    >
      {/* Input Handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !-left-1.5 !bg-[#1e2536] dark:!bg-[#2a3348] !border-2 !border-slate-400 dark:!border-slate-500 hover:!bg-cyan-500 hover:!border-cyan-400 transition-colors"
        style={{ borderRadius: '50%' }}
      />

      {/* Top accent stripe */}
      <div
        className="w-full h-[3px] rounded-t-xl"
        style={{ background: config.color }}
      />

      {/* Content */}
      <div className="w-full px-4 py-3 flex items-center gap-3">
        {/* Hexagonal icon container */}
        <div
          className="relative flex items-center justify-center shrink-0"
          style={{ width: 36, height: 36 }}
        >
          <div
            className="absolute inset-0 opacity-15"
            style={{
              background: config.color,
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            }}
          />
          <div
            className="absolute inset-[2px] opacity-25"
            style={{
              background: config.color,
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
            }}
          />
          <Icon
            className="relative z-10"
            style={{ width: 18, height: 18, color: config.color }}
            strokeWidth={2}
          />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-none mb-1">
            {config.label}
          </div>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
            {(data.label as string) || `my-${config.label.toLowerCase()}`}
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="w-full px-4 pb-3 flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: status.color,
            boxShadow: `0 0 6px ${status.color}40`,
          }}
        />
        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
          {status.label}
        </span>
      </div>

      {/* Output Handle (right) */}
      {hasOutput && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !-right-1.5 !bg-[#1e2536] dark:!bg-[#2a3348] !border-2 !border-slate-400 dark:!border-slate-500 hover:!bg-cyan-500 hover:!border-cyan-400 transition-colors"
          style={{ borderRadius: '50%' }}
        />
      )}
    </div>
  );
};

export default K8sNode;
