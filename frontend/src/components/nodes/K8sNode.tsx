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
        border border-slate-200 dark:border-[#1e2536]
        rounded-lg
        transition-all duration-150 select-none
        ${selected
          ? 'border-cyan-400 dark:border-cyan-400 shadow-[0_0_0_2px_rgba(6,182,212,0.15)]'
          : 'hover:border-slate-300 dark:hover:border-[#2a3348]'
        }
        hover:shadow-md dark:hover:shadow-black/20
      `}
      style={{ width: 100 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !-left-1 !bg-[#1e2536] dark:!bg-[#2a3348] !border-[1.5px] !border-slate-400 dark:!border-slate-500 hover:!bg-cyan-500 hover:!border-cyan-400 transition-colors"
        style={{ borderRadius: '50%' }}
      />

      <div className="w-full h-[2px] rounded-t-lg" style={{ background: config.color }} />

      <div className="w-full px-2 py-1.5 flex items-center gap-1.5">
        <div className="relative flex items-center justify-center shrink-0" style={{ width: 18, height: 18 }}>
          <div className="absolute inset-0 opacity-15" style={{ background: config.color, clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
          <div className="absolute inset-[1.5px] opacity-25" style={{ background: config.color, clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
          <Icon className="relative z-10" style={{ width: 9, height: 9, color: config.color }} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
            {(data.label as string) || `my-${config.label.toLowerCase()}`}
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full shrink-0" style={{ background: status.color, boxShadow: `0 0 3px ${status.color}40` }} />
            <span className="text-[7px] font-medium text-slate-400 dark:text-slate-500 uppercase">{config.label}</span>
          </div>
        </div>
      </div>

      {hasOutput && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-2 !h-2 !-right-1 !bg-[#1e2536] dark:!bg-[#2a3348] !border-[1.5px] !border-slate-400 dark:!border-slate-500 hover:!bg-cyan-500 hover:!border-cyan-400 transition-colors"
          style={{ borderRadius: '50%' }}
        />
      )}
    </div>
  );
};

export default K8sNode;
