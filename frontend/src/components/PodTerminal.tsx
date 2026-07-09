import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { Loader2 } from 'lucide-react';
import 'xterm/css/xterm.css';

interface PodTerminalProps {
  namespace: string;
  podName: string;
  containers: string[];
  apiUrl: string;
}

export const PodTerminal: React.FC<PodTerminalProps> = ({
  namespace,
  podName,
  containers,
  apiUrl,
}) => {
  const [selectedContainer, setSelectedContainer] = useState<string>(containers[0] || '');
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('connecting');
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!selectedContainer || !terminalRef.current) return;

    setStatus('connecting');

    // Build WebSocket URL
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const baseUrl = apiUrl.startsWith('http') 
      ? apiUrl.replace(/^http/, 'ws') 
      : `${wsProto}//${window.location.host}`;
    const wsUrl = `${baseUrl}/api/ws/exec/${namespace}/${podName}/${selectedContainer}`;

    // Initialize Terminal
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#090b10',
        foreground: '#f8f8f2',
        cursor: '#00f0ff',
        selectionBackground: 'rgba(255, 255, 255, 0.15)',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#bbbbbb',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // Open connection
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    ws.onopen = () => {
      setStatus('connected');
      term.open(terminalRef.current!);
      fitAddon.fit();
      term.focus();
      term.writeln('\x1b[1;36mConnected to container shell session via Podex TTY.\x1b[0m');
      term.writeln('\x1b[1;30mLoading prompt...\x1b[0m\r\n');
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onerror = (err) => {
      console.error('WebSocket Terminal Error:', err);
      setStatus('error');
    };

    ws.onclose = () => {
      setStatus('disconnected');
      term.writeln('\r\n\x1b[1;31mTerminal session disconnected.\x1b[0m');
    };

    // Terminal keystroke handler
    const dataDisposer = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Resize handler
    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch (e) {
        // Suppress initial fit errors if container not rendered
      }
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      dataDisposer.dispose();
      ws.close();
      term.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, [namespace, podName, selectedContainer, apiUrl]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200 h-full flex flex-col min-h-[440px]">
      <div className="flex justify-between items-center bg-white dark:bg-[#10121a] p-3 rounded-xl border border-slate-200/60 dark:border-[#1e202a]">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-500">
          <span>Active Container:</span>
          {containers.length <= 1 ? (
            <span className="text-slate-800 dark:text-slate-200">{selectedContainer || 'N/A'}</span>
          ) : (
            <select
              value={selectedContainer}
              onChange={(e) => setSelectedContainer(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-none rounded-lg px-2.5 py-1 text-xs outline-none cursor-pointer font-bold"
            >
              {containers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center space-x-2 text-[10px] font-extrabold uppercase tracking-wider">
          {status === 'connecting' && (
            <span className="flex items-center text-amber-500 space-x-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Connecting...</span>
            </span>
          )}
          {status === 'connected' && (
            <span className="flex items-center text-emerald-500 space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Session Connected</span>
            </span>
          )}
          {status === 'disconnected' && (
            <span className="flex items-center text-red-500 space-x-1">
              <span>Disconnected</span>
            </span>
          )}
          {status === 'error' && (
            <span className="flex items-center text-red-505 space-x-1">
              <span>Connection Failed</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-[#090b10] rounded-xl border border-slate-200 dark:border-[#1e202a] p-3 overflow-hidden relative">
        <div ref={terminalRef} className="w-full h-full min-h-[380px] overflow-hidden" />
      </div>
    </div>
  );
};
