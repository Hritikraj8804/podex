import React from 'react';
import { 
  X, Trash2, RefreshCw, Sliders, Search, Loader2, Info, 
  AlertCircle, CheckCircle2, AlertTriangle, 
  AlertOctagon, Link2, Minimize2, Maximize2 
} from 'lucide-react';
import { PodTerminal } from './PodTerminal';

interface FormattedTextProps {
  text: string;
  onShowToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const renderInline = (text: string) => {
  const boldParts = text.split(/(\*\*[^*]+\*\*)/);
  return boldParts.map((bp, bi) => {
    if (bp.startsWith('**') && bp.endsWith('**')) {
      return <strong key={bi} className="font-black text-slate-800 dark:text-slate-100">{bp.slice(2, -2)}</strong>;
    }
    const codeParts = bp.split(/(`[^`]+`)/);
    return codeParts.map((cp, ci) => {
      if (cp.startsWith('`') && cp.endsWith('`')) {
        return (
          <code key={ci} className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-cyan-600 dark:text-cyan-400 font-mono text-[10px] font-bold">
            {cp.slice(1, -1)}
          </code>
        );
      }
      return cp;
    });
  });
};

export const FormattedText: React.FC<FormattedTextProps> = ({ text, onShowToast }) => {
  if (!text) return null;

  const lines = text.split('\n');
  const blocks: { type: string; content: string; items?: string[] }[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trimStart().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: 'code', content: codeLines.join('\n') });
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line.trim())) {
      blocks.push({ type: 'hr', content: '' });
      i++;
      continue;
    }

    // Bullet list
    if (/^[\s]*[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\s]*[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[\s]*[-*]\s/, ''));
        i++;
      }
      blocks.push({ type: 'bullet', content: '', items });
      continue;
    }

    // Numbered list
    if (/^\s*\d+[.)]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s/, ''));
        i++;
      }
      blocks.push({ type: 'ordered', content: '', items });
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph (may contain embedded numbered steps like "text 2. text")
    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^[\s]*[-*]\s/.test(lines[i]) && !/^\s*\d+[.)]\s/.test(lines[i]) && !lines[i].trimStart().startsWith('```') && !/^---+\s*$/.test(lines[i].trim())) {
      paraLines.push(lines[i]);
      i++;
    }
    const joined = paraLines.join(' ');
    // Check for embedded numbered steps: "text 2. " or "text 2) "
    const stepMatch = joined.match(/\s+\d+[.)]\s/);
    if (stepMatch && joined.indexOf(stepMatch[0]) > 0) {
      const items = joined.split(/\s+(?=\d+[.)]\s)/).filter(Boolean).map(item => item.replace(/^\d+[.)]\s*/, ''));
      blocks.push({ type: 'ordered', content: '', items });
    } else {
      blocks.push({ type: 'para', content: joined });
    }
  }

  return (
    <div className="space-y-3">
      {blocks.map((b, idx) => {
        if (b.type === 'code') {
          return (
            <div key={idx} className="relative group">
              <pre className="w-full bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-[10px] overflow-auto whitespace-pre leading-relaxed border border-slate-900">
                {b.content}
              </pre>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(b.content);
                  if (onShowToast) onShowToast("Copied!", "success");
                }}
                className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition text-[9px] bg-slate-800/80 hover:bg-slate-700 text-cyan-400 font-bold px-2 py-1 rounded border border-slate-700/50 cursor-pointer"
              >
                Copy
              </button>
            </div>
          );
        }

        if (b.type === 'hr') {
          return <hr key={idx} className="border-slate-200 dark:border-slate-700" />;
        }

        if (b.type === 'bullet') {
          return (
            <ul key={idx} className="space-y-1.5 list-none m-0 p-0">
              {b.items!.map((item, ii) => (
                <li key={ii} className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0 mt-1.5" />
                  <span className="text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (b.type === 'ordered') {
          return (
            <ol key={idx} className="space-y-2 list-none m-0 p-0">
              {b.items!.map((item, ii) => (
                <li key={ii} className="flex items-start space-x-2">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/10 dark:bg-cyan-500/5 text-cyan-600 dark:text-cyan-400 text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">
                    {ii + 1}
                  </span>
                  <span className="text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">{renderInline(item)}</span>
                </li>
              ))}
            </ol>
          );
        }

        if (b.type === 'para') {
          return <p key={idx} className="m-0 leading-relaxed font-semibold text-slate-600 dark:text-slate-300">{renderInline(b.content)}</p>;
        }

        return null;
      })}
    </div>
  );
};

interface ResourceDrawerProps {
  selectedResource: { type: 'pod' | 'deployment' | 'service' | 'node' | 'configmap' | 'secret' | 'statefulset' | 'daemonset', name: string, namespace: string } | null;
  setSelectedResource: (resource: { type: 'pod' | 'deployment' | 'service', name: string, namespace: string } | null) => void;
  isDrawerMaximized: boolean;
  setIsDrawerMaximized: (max: boolean) => void;
  detailsWidth: number;
  setConfirmationModal: (modal: any) => void;
  detailTab: 'overview' | 'yaml' | 'logs' | 'investigate' | 'terminal' | 'events';
  setDetailTab: (tab: 'overview' | 'yaml' | 'logs' | 'investigate' | 'terminal' | 'events') => void;
  resourceDetailsLoading: boolean;
  resourceDetails: any;
  relatedList: any[];
  logsFilter: string;
  setLogsFilter: (filter: string) => void;
  autoScrollLogs: boolean;
  setAutoScrollLogs: (scroll: boolean) => void;
  codeFontSize: number;
  setCodeFontSize: (size: number) => void;
  logsLineWrap: boolean;
  logsText: string;
  logsEndRef: React.RefObject<HTMLPreElement | null>;
  eventsList: any[];
  yamlText: string;
  aiInvestigating: boolean;
  aiInvestigation: any;
  investigationStep: string;
  runInvestigation: () => void;
  investigationSubTab: 'diagnosis' | 'fix' | 'lesson';
  setInvestigationSubTab: (tab: 'diagnosis' | 'fix' | 'lesson') => void;
  setToast: (toast: { message: string; type: 'success' | 'error' | 'info'; link?: string } | null) => void;
  apiUrl: string;
  
  // Custom children/addons container for the real Terminal tab
  renderRealTerminal?: () => React.ReactNode;
}

export const ResourceDrawer: React.FC<ResourceDrawerProps> = ({
  selectedResource,
  setSelectedResource,
  isDrawerMaximized,
  setIsDrawerMaximized,
  detailsWidth,
  setConfirmationModal,
  detailTab,
  setDetailTab,
  resourceDetailsLoading,
  resourceDetails,
  apiUrl,
  relatedList,
  logsFilter,
  setLogsFilter,
  autoScrollLogs,
  setAutoScrollLogs,
  codeFontSize,
  setCodeFontSize,
  logsLineWrap,
  logsText,
  logsEndRef,
  eventsList,
  yamlText,
  aiInvestigating,
  aiInvestigation,
  investigationStep,
  runInvestigation,
  investigationSubTab,
  setInvestigationSubTab,
  setToast,
  renderRealTerminal,
}) => {
  if (!selectedResource) return null;

  return (
    <aside
      style={{ width: isDrawerMaximized ? 'calc(100vw - 5rem)' : `${detailsWidth}px` }}
      className="border-l border-slate-200 dark:border-[#1b2332] bg-white dark:bg-[#121124] flex flex-col z-20 shadow-2xl transition-all duration-75 shrink-0"
    >

      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-[#1b2332] flex items-center justify-between">
        <div className="min-w-0">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">
            {selectedResource.type} Details
          </span>
          <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200 truncate m-0">
            {selectedResource.name}
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate block mt-0.5 font-bold">
            Namespace: {selectedResource.namespace}
          </span>
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={() => setIsDrawerMaximized(!isDrawerMaximized)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#2a294a] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
            title={isDrawerMaximized ? "Restore Width" : "Maximize Panel"}
          >
            {isDrawerMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setSelectedResource(null)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#2a294a] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Quick Operations Confirmation triggers */}
      <div className="px-6 py-4 bg-slate-50 dark:bg-[#0d0f15] border-b border-slate-200 dark:border-[#1b2332] flex items-center justify-start space-x-2">

        {/* Delete Pod */}
        {selectedResource.type === 'pod' && (
          <button
            onClick={() => setConfirmationModal({
              type: 'delete',
              name: selectedResource.name,
              namespace: selectedResource.namespace
            })}
            className="px-3.5 py-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/60 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 font-bold text-[11px] transition flex items-center space-x-1.5 cursor-pointer"
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
              className="px-3.5 py-2 rounded-lg bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/30 dark:hover:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-900/50 text-cyan-600 dark:text-cyan-400 font-bold text-[11px] transition flex items-center space-x-1.5 cursor-pointer"
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
              className="px-3.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/60 border border-amber-200 dark:border-amber-900/50 text-amber-600 dark:text-amber-400 font-bold text-[11px] transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Scale Replicas</span>
            </button>
          </>
        )}
      </div>

      {/* Sub-tab Select for Resource details */}
      <div className="flex border-b border-slate-200 dark:border-[#1b2332] text-xs select-none">
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
              ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/5'
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
            <span className="text-xs text-slate-400 font-bold">Loading details...</span>
          </div>
        ) : (
          <div>

            {/* TAB: OVERVIEW */}
            {detailTab === 'overview' && resourceDetails && (
              <div className="space-y-5 text-xs">

                {/* Status overview list info */}
                <div className="bg-white dark:bg-[#111820] p-4 rounded-lg border border-slate-200 dark:border-[#1b2332] space-y-3 shadow-sm">
                  <h4 className="font-bold text-slate-800 dark:text-slate-300">Specifications</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-slate-500 font-bold">Resource:</span>
                    <span className="col-span-2 text-slate-700 dark:text-slate-300 font-bold">{selectedResource.type}</span>

                    <span className="text-slate-500 font-bold">Kind:</span>
                    <span className="col-span-2 text-slate-700 dark:text-slate-300 font-mono font-bold">{resourceDetails.kind}</span>

                    <span className="text-slate-500 font-bold">API Version:</span>
                    <span className="col-span-2 text-slate-700 dark:text-slate-300 font-mono font-bold">{resourceDetails.api_version}</span>

                    <span className="text-slate-500 font-bold">Created:</span>
                    <span className="col-span-2 text-slate-700 dark:text-slate-300 font-bold">{resourceDetails.metadata?.creation_timestamp}</span>
                  </div>
                </div>

                {/* Metadata labels */}
                {resourceDetails.metadata?.labels && (
                  <div className="bg-white dark:bg-[#111820] p-4 rounded-lg border border-slate-200 dark:border-[#1b2332] space-y-2 shadow-sm">
                    <h4 className="font-bold text-slate-800 dark:text-slate-300">Labels</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(resourceDetails.metadata.labels).map(([k, v]) => (
                        <span key={k} className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-[#161a25] border border-slate-200 dark:border-[#1b2332] text-cyan-600 dark:text-cyan-400 font-mono text-[10px]">
                          {k}={String(v)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Visual K8s Conditions Timeline (CNCF Observability) */}
                {resourceDetails.status?.conditions && (
                  <div className="bg-white dark:bg-[#111820] p-4 rounded-lg border border-slate-200 dark:border-[#1b2332] space-y-3 shadow-sm">
                    <h4 className="font-bold text-slate-800 dark:text-slate-300">Conditions</h4>
                    <div className="grid grid-cols-1 gap-2">
                      {resourceDetails.status.conditions.map((cond: any) => {
                        const isTrue = cond.status === 'True';
                        const isFalse = cond.status === 'False';
                        const condBg = isTrue
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50'
                          : isFalse
                            ? 'bg-red-50/70 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/50 animate-pulse'
                            : 'bg-slate-100/70 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800';

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
                  <div className="bg-white dark:bg-[#111820] p-4 rounded-lg border border-slate-200 dark:border-[#1b2332] space-y-3 shadow-sm">
                    <h4 className="font-bold text-slate-800 dark:text-slate-300 flex items-center space-x-1.5">
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
                          <div className="w-8 h-8 rounded bg-cyan-100 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-500 flex items-center justify-center font-bold text-[10px] uppercase">
                            {rel.type[0]}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-[11px] text-slate-700 dark:text-slate-200 block truncate group-hover:text-cyan-500 transition">{rel.name}</span>
                            <span className="text-[9px] text-slate-500 block uppercase tracking-wider mt-0.5 font-bold">{rel.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Container details if Pod */}
                {selectedResource.type === 'pod' && resourceDetails.spec?.containers && (
                  <div className="bg-white dark:bg-[#111820] p-4 rounded-lg border border-slate-200 dark:border-[#1b2332] space-y-3 shadow-sm">
                    <h4 className="font-bold text-slate-800 dark:text-slate-400">Containers</h4>
                    {resourceDetails.spec.containers.map((container: any) => (
                      <div key={container.name} className="border-t border-slate-200 dark:border-[#1b2332] pt-3 mt-3 first:border-none first:pt-0 first:mt-0 space-y-1.5">
                        <div className="flex justify-between font-bold text-slate-700 dark:text-slate-200">
                          <span>{container.name}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-slate-500">
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
                  <div className="flex items-center bg-white dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-xl px-2.5 py-1.5 flex-grow max-w-xs shadow-sm">
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
                  <div className="flex items-center space-x-3 text-slate-500 dark:text-slate-400 shrink-0 font-bold select-none">
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoScrollLogs}
                        onChange={(e) => setAutoScrollLogs(e.target.checked)}
                        className="w-3.5 h-3.5 rounded text-cyan-500 bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-[#1b2332] focus:ring-0 cursor-pointer"
                      />
                      <span className="text-[10px]">Auto-Scroll</span>
                    </label>

                    <div className="flex items-center space-x-1 border border-slate-200 dark:border-[#1b2332] rounded-lg p-0.5 bg-slate-100 dark:bg-[#111820]">
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
                          : 'bg-white dark:bg-[#111820] border-slate-200 dark:border-[#1b2332] text-slate-700 dark:text-slate-300'
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
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal font-bold">{ev.message}</p>
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
                    <span className="text-slate-500 dark:text-slate-400">Kubernetes YAML</span>
                    <div className="flex items-center space-x-1 border border-slate-200 dark:border-[#1b2332] rounded-lg p-0.5 bg-slate-100 dark:bg-[#111820]">
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
                  <div className="bg-white dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-xl overflow-hidden shadow-sm">
                    <div className="h-1 bg-gradient-to-r from-cyan-500 to-indigo-500" />
                    <div className="p-6 text-center space-y-4">
                      <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-[#1b2332] border border-slate-200 dark:border-[#2d3142] flex items-center justify-center mx-auto shadow-sm">
                        <img src="/mascot.png" alt="Poddy" className="w-14 h-14 object-contain" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-black text-sm text-slate-800 dark:text-slate-200 m-0">Ask Poddy</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                          Analyze logs, events, and configuration
                        </p>
                      </div>
                      <button
                        onClick={runInvestigation}
                        className="w-full py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 font-black text-xs text-white transition cursor-pointer shadow-sm"
                      >
                        Investigate Resource
                      </button>
                    </div>
                  </div>
                )}

                {/* Investigation Loading states */}
                {aiInvestigating && (
                  <div className="bg-white dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] p-8 rounded-lg text-center space-y-5 flex flex-col items-center shadow-sm">
                    <div className="relative w-12 h-12">
                      <div className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-700" />
                      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-500 animate-spin" />
                      <img src="/mascot.png" alt="Poddy" className="w-6 h-6 object-contain absolute inset-0 m-auto" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 m-0">Poddy is investigating</h4>
                      <div className="flex items-center justify-center space-x-2 text-[10px] text-slate-400 font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                        <span className="animate-pulse">{investigationStep}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Investigation Result display */}
                {aiInvestigation && !aiInvestigating && (
                  <div className="space-y-5 text-xs animate-in fade-in slide-in-from-bottom-2 duration-300">

                    {/* Status Callout Card */}
                    <div className="relative overflow-hidden rounded-xl border shadow-md">
                      <div className={`absolute inset-0 ${aiInvestigation.status === 'healthy' ? 'bg-emerald-500/5 dark:bg-emerald-950/20' : aiInvestigation.status === 'degraded' ? 'bg-amber-500/5 dark:bg-amber-950/20' : 'bg-red-500/5 dark:bg-red-950/20'}`} />
                      <div className={`relative p-4 border-l-4 flex items-start space-x-3 ${aiInvestigation.status === 'healthy' ? 'border-emerald-500' : aiInvestigation.status === 'degraded' ? 'border-amber-500' : 'border-red-500'}`}>
                        {aiInvestigation.status === 'healthy' ? (
                          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/5 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          </div>
                        ) : aiInvestigation.status === 'degraded' ? (
                          <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/5 flex items-center justify-center shrink-0">
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-red-500/10 dark:bg-red-500/5 flex items-center justify-center shrink-0">
                            <AlertOctagon className="w-5 h-5 text-red-500 animate-pulse" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className={`text-[10px] font-black uppercase tracking-widest ${aiInvestigation.status === 'healthy' ? 'text-emerald-600 dark:text-emerald-400' : aiInvestigation.status === 'degraded' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                              {aiInvestigation.status}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{aiInvestigation.confidence}% confidence</span>
                          </div>
                          <p className="text-xs mt-1 font-bold text-slate-700 dark:text-slate-200 leading-relaxed">{aiInvestigation.root_cause}</p>
                        </div>
                      </div>
                    </div>

                    {/* Sub-tabs Navigation inside Investigate Panel */}
                    <div className="flex bg-slate-100 dark:bg-[#111820] rounded-xl p-0.5 border border-slate-200/60 dark:border-[#1b2332] select-none">
                      {([
                        { id: 'diagnosis', label: 'Diagnosis', icon: Info },
                        { id: 'fix', label: 'Action Plan', icon: Sliders },
                        { id: 'lesson', label: 'Concept Lesson', icon: RefreshCw }
                      ] as const).map(tab => {
                        const TabIcon = tab.icon;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setInvestigationSubTab(tab.id)}
                            className={`flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition duration-150 cursor-pointer ${investigationSubTab === tab.id
                              ? 'bg-white dark:bg-[#1f2330] text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200 dark:border-[#2d3142]/45'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                              }`}
                          >
                            <TabIcon className="w-3 h-3" />
                            <span>{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* TAB CONTENT: DIAGNOSIS */}
                    {investigationSubTab === 'diagnosis' && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        {/* Confidence bar */}
                        <div className="bg-white dark:bg-[#111820] p-4 rounded-lg border border-slate-200 dark:border-[#1b2332] shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Analysis Summary</span>
                            <div className="flex items-center space-x-1.5">
                              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-[9px] font-bold text-slate-400">Poddy AI</span>
                            </div>
                          </div>
                          <FormattedText text={aiInvestigation.explanation} onShowToast={(msg, type) => setToast({ message: msg, type })} />
                        </div>

                        {/* Evidence list */}
                        {aiInvestigation.evidence && aiInvestigation.evidence.length > 0 && (
                          <div className="bg-white dark:bg-[#111820] p-4 rounded-lg border border-slate-200 dark:border-[#1b2332] shadow-sm">
                            <h5 className="font-bold text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                              Evidence Gathered <span className="text-slate-300 dark:text-slate-600">({aiInvestigation.evidence.length})</span>
                            </h5>
                            <div className="space-y-2">
                              {aiInvestigation.evidence.map((ev: string, idx: number) => (
                                <div key={idx} className="flex items-start space-x-2.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/60">
                                  <span className="w-5 h-5 rounded-full bg-cyan-500/10 dark:bg-cyan-500/5 text-cyan-600 dark:text-cyan-400 text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                    {idx + 1}
                                  </span>
                                  <span className="text-slate-600 dark:text-slate-300 font-semibold text-[11px]">{ev}</span>
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
                        <div className="p-5 rounded-lg border border-cyan-200 dark:border-cyan-900/35 shadow-sm" style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.04) 0%, rgba(59,130,246,0.04) 100%)' }}>
                          <div className="flex items-center space-x-2 mb-4">
                            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                              <Sliders className="w-3.5 h-3.5 text-cyan-500" />
                            </div>
                            <span className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Action Plan</span>
                          </div>
                          <FormattedText text={aiInvestigation.suggested_fix} onShowToast={(msg, type) => setToast({ message: msg, type })} />
                        </div>
                      </div>
                    )}

                    {/* TAB CONTENT: CONCEPT LESSON */}
                    {investigationSubTab === 'lesson' && aiInvestigation.k8s_lesson && (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-[#111820] rounded-lg border border-slate-200 dark:border-[#1b2332] overflow-hidden shadow-sm">
                          <div className="border-b border-slate-100 dark:border-slate-800 px-5 py-3 flex items-center space-x-2.5">
                            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                              <Info className="w-3.5 h-3.5 text-indigo-500" />
                            </div>
                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Core Concept</span>
                          </div>
                          <div className="p-5 space-y-4">
                            <p className="text-sm font-black text-slate-800 dark:text-slate-100 m-0 leading-relaxed">
                              {aiInvestigation.k8s_lesson.concept}
                            </p>
                            <div className="bg-gradient-to-r from-indigo-500/5 to-purple-500/5 dark:from-indigo-500/10 dark:to-purple-500/10 rounded-lg border border-indigo-200/50 dark:border-indigo-800/30 p-4">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-wider">Analogy</span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-400 leading-relaxed italic font-bold text-[11px] m-0">
                                "{aiInvestigation.k8s_lesson.analogy}"
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Re-run button */}
                    <button
                      onClick={runInvestigation}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold text-xs transition duration-150 cursor-pointer shadow-sm flex items-center justify-center space-x-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Refresh Analysis</span>
                    </button>
                  </div>
                )}
              </div>
            )}            {/* TAB: TERMINAL */}
            {detailTab === 'terminal' && selectedResource && (
              renderRealTerminal ? renderRealTerminal() : (() => {
                const containerNames = resourceDetails?.spec?.containers?.map((c: any) => c.name) || [];
                return (
                  <PodTerminal
                    namespace={selectedResource.namespace}
                    podName={selectedResource.name}
                    containers={containerNames}
                    apiUrl={apiUrl}
                  />
                );
              })()
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
