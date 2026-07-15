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
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [generatedCommand, setGeneratedCommand] = useState('');
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    setAiLoading(true);
    setGeneratedCommand('');

    try {
      const provider = localStorage.getItem('mockModeForced') === 'true' ? 'mock' : (localStorage.getItem('aiProvider') || 'gemini');
      const key = provider === 'gemini' ? (localStorage.getItem('geminiKey') || '') : (localStorage.getItem('openaiKey') || '');
      const model = localStorage.getItem('aiModel') || (provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini');
      const temp = localStorage.getItem('aiTemperature') || '0.2';

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (provider) headers['X-AI-Provider'] = provider;
      if (key) headers['X-AI-Key'] = key;
      if (model) headers['X-AI-Model'] = model;
      if (temp) headers['X-AI-Temperature'] = temp;

      const res = await fetch(`${apiUrl}/api/pods/generate-command`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: aiPrompt })
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedCommand(data.command);
      } else {
        console.error('Failed to generate command');
      }
    } catch (err) {
      console.error('AI generate command error:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleRunCommand = () => {
    if (!generatedCommand) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(generatedCommand + '\r');
      setGeneratedCommand('');
      setAiPrompt('');
      if (xtermRef.current) {
        xtermRef.current.focus();
      }
    }
  };

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
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      theme: {
        background: '#121124',
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
      term.writeln('\x1b[1;36m◆ Welcome to Podex Terminal ◆\x1b[0m');
      term.writeln(`\x1b[1;34mConnected to container: \x1b[1;37m${selectedContainer}\x1b[0m`);
      term.writeln('\x1b[1;30mLoading shell session...\x1b[0m\r\n');
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
      } catch {
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
      <div className="flex justify-between items-center bg-white dark:bg-[#111820] p-3 rounded-lg border border-slate-200/60 dark:border-[#1b2332]">
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
            <span className="flex items-center text-red-500 space-x-1">
              <span>Connection Failed</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-[#121124] rounded-lg border border-slate-200 dark:border-[#1b2332] p-3 overflow-hidden relative">
        <div ref={terminalRef} className="w-full h-full min-h-[380px] overflow-hidden" />
      </div>

      {/* AI Assistant Input */}
      <div className="bg-white dark:bg-[#111820] p-3 rounded-lg border border-slate-200/60 dark:border-[#1b2332] flex flex-col space-y-2">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-500">
          <img src="/mascot.png" alt="Poddy" className="w-5 h-5 object-contain" />
          <span>Poddy Command Generator</span>
        </div>
        <form onSubmit={handleAiSubmit} className="flex space-x-2">
          <input
            type="text"
            placeholder="Ask Poddy to generate a command (e.g., 'find python files', 'check disk space', 'show env')"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            disabled={aiLoading}
            className="flex-1 bg-slate-50 dark:bg-[#161822] text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2 text-sm border border-slate-200/60 dark:border-[#1b2332] focus:outline-none focus:ring-1 focus:ring-cyan-500 font-medium"
          />
          <button
            type="submit"
            disabled={aiLoading || !aiPrompt.trim()}
            className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-lg px-4 py-2 text-xs font-bold transition flex items-center space-x-1"
          >
            {aiLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <span>Generate</span>
            )}
          </button>
        </form>
        {generatedCommand && (
          <div className="flex items-center space-x-2 bg-slate-50 dark:bg-[#161822] p-2.5 rounded-lg border border-slate-200/40 dark:border-[#1b2332]">
            <span className="text-[10px] font-extrabold uppercase text-cyan-500 shrink-0">Generated:</span>
            <input
              type="text"
              value={generatedCommand}
              onChange={(e) => setGeneratedCommand(e.target.value)}
              className="flex-1 bg-transparent border-none text-xs font-mono text-slate-800 dark:text-slate-200 outline-none focus:ring-0 py-0"
            />
            <button
              onClick={handleRunCommand}
              className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold px-3 py-1 rounded text-xs transition shrink-0"
            >
              Run in Terminal
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
