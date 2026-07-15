import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { X, GripHorizontal } from 'lucide-react';
import 'xterm/css/xterm.css';

const styles = `
.cloud-shell .xterm-viewport {
  padding-bottom: 24px !important;
}
`;

interface CloudShellProps {
  apiUrl: string;
  isOpen: boolean;
  onClose: () => void;
  sidebarCollapsed: boolean;
}

export const CloudShell: React.FC<CloudShellProps> = ({ apiUrl, isOpen, onClose, sidebarCollapsed }) => {
  const [height, setHeight] = useState(280);
  const [status, setStatus] = useState<'closed' | 'connecting' | 'connected' | 'error'>('closed');
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const dragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    dragStartY.current = e.clientY;
    dragStartHeight.current = height;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [height]);

  const headerHeight = 64;

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return;
    const delta = dragStartY.current - e.clientY;
    const maxH = window.innerHeight - headerHeight;
    const newHeight = Math.max(180, Math.min(maxH, dragStartHeight.current + delta));
    setHeight(newHeight);
    setTimeout(() => {
      try { fitAddonRef.current?.fit(); } catch { }
    }, 0);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => {
    if (!isOpen) {
      setStatus('closed');
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
      return;
    }

    if (!terminalRef.current) return;

    setStatus('connecting');

    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${window.location.host}/api/ws/shell`;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      theme: {
        background: '#0b0e14',
        foreground: '#e2e8f0',
        cursor: '#06b6d4',
        selectionBackground: 'rgba(79, 70, 229, 0.3)',
        black: '#0f172a',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#6366f1',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#f8fafc',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();
    term.focus();

    term.writeln('\x1b[1;36m◆ Podex Cloud Shell ◆\x1b[0m');
    term.writeln('\x1b[1;30mType kubectl commands or any shell command.\x1b[0m\r\n');

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      setStatus('connected');
      term.focus();
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(event.data));
      } else {
        term.write(event.data);
      }
    };

    ws.onerror = () => {
      setStatus('error');
    };

    ws.onclose = () => {
      setStatus('error');
    };

    const dataDisposer = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    const resizeHandler = () => {
      try { fitAddon.fit(); } catch { }
    };

    const resizeObserver = new ResizeObserver(() => resizeHandler());
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      dataDisposer.dispose();
      resizeObserver.disconnect();
      ws.close();
      term.dispose();
    };
  }, [isOpen, apiUrl]);

  return (
    <>
      <style>{styles}</style>
      <div
        className="fixed bottom-0 right-0 z-40 bg-[#0b0e14] border-t border-slate-700/50 shadow-2xl cloud-shell"
        style={{ height: isOpen ? height : 0, minHeight: isOpen ? 180 : 0, left: sidebarCollapsed ? '5rem' : '16rem' }}
      >
      {isOpen && (
        <>
          {/* Drag handle */}
          <div
            onMouseDown={handleMouseDown}
            className="absolute -top-1 left-0 right-0 h-2 cursor-row-resize z-50 hover:bg-cyan-500/30 active:bg-cyan-500/50 transition-colors"
          />

          {/* Title bar */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-[#0d1117] border-b border-slate-800/60 select-none">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Cloud Shell</span>
              <GripHorizontal className="w-3.5 h-3.5 text-slate-600" />
              {status === 'connecting' && <span className="text-amber-400 text-[10px]">Connecting...</span>}
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-red-400 transition cursor-pointer" title="Close shell">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Terminal */}
          <div className="w-full" style={{ height: height - 32 }}>
            <div ref={terminalRef} className="w-full h-full pt-2 px-2 pb-6" />
          </div>
        </>
      )}
    </div>
    </>
  );
};
