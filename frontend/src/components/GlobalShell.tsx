import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import {
  X,
  ExternalLink,
  Eraser,
  RefreshCw,
  Loader2,
  TerminalSquare,
  Type,
  Plus,
  ChevronDown,
  Copy,
  Check,
} from 'lucide-react';
import 'xterm/css/xterm.css';
import { copyToClipboard } from '../utils/clipboard';

const SHELL_URL = import.meta.env.VITE_SHELL_URL || 'http://localhost:3458';
const HEADER_HEIGHT = 64;
const BOTTOM_GAP = 16;
const MIN_HEIGHT = 100;
const DEFAULT_HEIGHT = 300;

const FONT_PRESETS: Record<'S' | 'M' | 'L', number> = { S: 11, M: 13, L: 16 };
const FONT_ORDER: Array<'S' | 'M' | 'L'> = ['S', 'M', 'L'];

type SessionStatus = 'connecting' | 'connected' | 'error' | 'offline';

interface ShellTab {
  id: number;
  title: string;
}

interface Session {
  term: Terminal;
  fitAddon: FitAddon;
  ws: WebSocket | null;
  state: SessionStatus;
  cleanup: () => void;
}

interface GlobalShellProps {
  open: boolean;
  setOpen: (v: boolean) => void;
  apiUrl: string;
  fullscreen?: boolean;
}

export const GlobalShell: React.FC<GlobalShellProps> = ({ open, setOpen, apiUrl, fullscreen = false }) => {
  const shellRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const sessionsRef = useRef<Record<number, Session>>({});
  const hostsRef = useRef<Record<number, HTMLDivElement | null>>({});
  const activeIdRef = useRef<number | null>(null);
  const idCounter = useRef(1);
  const fontPresetRef = useRef<'S' | 'M' | 'L'>('M');
  const openRef = useRef(open);

  const [tabs, setTabs] = useState<ShellTab[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [fontPreset, setFontPreset] = useState<'S' | 'M' | 'L'>(() => {
    const saved = localStorage.getItem('shellFontPreset') as 'S' | 'M' | 'L';
    return saved && FONT_ORDER.includes(saved) ? saved : 'M';
  });
  const [height, setHeight] = useState<number>(() => {
    const saved = Number(localStorage.getItem('shellHeight'));
    const max = typeof window !== 'undefined' ? window.innerHeight - HEADER_HEIGHT - BOTTOM_GAP : 360;
    return Number.isFinite(saved) && saved >= MIN_HEIGHT && saved <= max ? saved : DEFAULT_HEIGHT;
  });
  const [status, setStatus] = useState<SessionStatus>('offline');
  const [resizing, setResizing] = useState(false);
  const [resetTick, setResetTick] = useState(0);
  const [copiedTick, setCopiedTick] = useState(0); // flash "Copied" indicator
  const copyTimerRef = useRef<number | null>(null);

  const maxHeight = () => Math.max(MIN_HEIGHT, window.innerHeight - HEADER_HEIGHT - BOTTOM_GAP);

  activeIdRef.current = activeId;
  openRef.current = open;

  useEffect(() => {
    localStorage.setItem('shellHeight', String(height));
  }, [height]);

  const persistHeight = useCallback((h: number) => {
    const clamped = Math.min(Math.max(h, MIN_HEIGHT), maxHeight());
    setHeight(clamped);
  }, []);

  const setSessionStatus = useCallback((id: number, st: SessionStatus) => {
    const s = sessionsRef.current[id];
    if (s) s.state = st;
    if (activeIdRef.current === id) setStatus(st);
  }, []);

  const buildWsUrl = useCallback((base: string, path: string) => {
    if (base.startsWith('http')) return base.replace(/^http/, 'ws') + path;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}${path}`;
  }, []);

  const sendResize = useCallback((term: Terminal, fit: FitAddon, ws: WebSocket) => {
    try {
      const dims = fit.proposeDimensions() || { cols: 80, rows: 24 };
      const cols = Math.max(2, Math.round(dims.cols || 80));
      const rows = Math.max(2, Math.round(dims.rows || 24));
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(`__RESIZE__:${cols}:${rows}`);
      }
      term.resize(cols, rows);
    } catch {
      // ignore
    }
  }, []);

  const fitSession = useCallback((id: number) => {
    const s = sessionsRef.current[id];
    const host = hostsRef.current[id];
    if (!s || !host) return;
    // Don't fit when the host has no real size yet (e.g. panel still opening)
    if (host.offsetHeight < 30 || host.offsetWidth < 30) return;
    try {
      s.fitAddon.fit();
      if (s.ws && s.ws.readyState === WebSocket.OPEN) {
        sendResize(s.term, s.fitAddon, s.ws);
      }
      s.term.scrollToBottom();
    } catch {
      // container not rendered yet
    }
  }, [sendResize]);

  // Flash the "Copied" indicator for ~1.2s
  const flashCopied = useCallback(() => {
    setCopiedTick((t) => t + 1);
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopiedTick((t) => t + 1), 1200);
  }, []);

  // Copy the active terminal's current selection to the clipboard
  const copyActiveSelection = useCallback(async () => {
    const s = activeId != null ? sessionsRef.current[activeId] : null;
    if (!s) return;
    const sel = s.term.getSelection();
    if (!sel) return;
    const ok = await copyToClipboard(sel);
    if (ok) flashCopied();
  }, [activeId, flashCopied]);

  // Create a brand-new terminal session for a tab (full reset semantics)
  const createSession = useCallback((id: number, host: HTMLDivElement, initialFont: 'S' | 'M' | 'L') => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: FONT_PRESETS[initialFont],
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      scrollback: 5000,
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

    // ── Clipboard shortcuts: Ctrl+Shift+C copy, Ctrl+Shift+V paste ──────────
    // xterm v5 does not handle these natively (Ctrl+Shift+C is the DevTools
    // shortcut in Chrome), so we intercept them here.
    term.attachCustomKeyEventHandler((event) => {
      if (!(event.ctrlKey && event.shiftKey)) return true;
      if (event.code === 'KeyC' || event.code === 'KeyC'.toLowerCase()) {
        const sel = term.getSelection();
        if (sel) {
          copyToClipboard(sel).then((ok) => { if (ok) flashCopied(); });
        }
        return false; // prevent xterm + browser default (DevTools)
      }
      if (event.code === 'KeyV' || event.code === 'KeyV'.toLowerCase()) {
        // Let the browser's native paste handler run: xterm captures the
        // paste event from its internal textarea and forwards it via onData.
        return false;
      }
      return true;
    });

    const session: Session = { term, fitAddon, ws: null, state: 'connecting', cleanup: () => {} };
    sessionsRef.current[id] = session;
    setSessionStatus(id, 'connecting');

    // Open the terminal into its host BEFORE connecting the socket, so any
    // data that arrives immediately (the banner) is not dropped.
    term.open(host);
    // The panel may still be opening (height transition 0 -> height), so fit
    // later once the host actually has size (see fitSession guard + timeout).
    requestAnimationFrame(() => {
      try {
        if (host.offsetHeight >= 30) fitAddon.fit();
      } catch { /* ignore */ }
    });

    const primaryUrl = buildWsUrl(SHELL_URL, '/ws/shell');
    const fallbackUrl = buildWsUrl(apiUrl || window.location.origin, '/api/ws/shell');

    let disposed = false;

    // Silent probe: just connects/disconnects, never touches the terminal.
    const probeSocket = (url: string, timeoutMs: number): Promise<WebSocket> =>
      new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        const timer = setTimeout(() => {
          try { ws.close(); } catch { /* noop */ }
          reject(new Error('timeout'));
        }, timeoutMs);
        ws.onopen = () => {
          clearTimeout(timer);
          resolve(ws);
        };
        ws.onerror = () => {
          clearTimeout(timer);
          reject(new Error('error'));
        };
      });

    (async () => {
      let ws: WebSocket | null = null;
      for (const [url, timeout] of [[primaryUrl, 1200], [fallbackUrl, 4000]] as const) {
        if (disposed) return;
        try {
          ws = await probeSocket(url, timeout);
          break;
        } catch {
          ws = null;
        }
      }

      if (disposed) {
        if (ws) ws.close();
        return;
      }

      if (!ws) {
        setSessionStatus(id, 'offline');
        term.writeln('\r\n\x1b[1;31mShell service unavailable. Start the backend (port 3457) or the Podex Shell microservice, then reopen.\x1b[0m');
        return;
      }

      session.ws = ws;
      // Attach handlers ONLY to the winning socket.
      ws.onmessage = (event) => {
        if (disposed) return;
        if (typeof event.data === 'string') {
          term.write(event.data);
        } else {
          event.data.arrayBuffer().then((buf: ArrayBuffer) => {
            term.write(new Uint8Array(buf));
          });
        }
        term.scrollToBottom();
      };
      ws.onerror = () => {
        if (disposed) return;
        setSessionStatus(id, 'error');
      };
      ws.onclose = () => {
        if (disposed) return;
        setSessionStatus(id, 'offline');
        term.writeln('\r\n\x1b[1;31mShell connection closed.\x1b[0m');
      };

      setSessionStatus(id, 'connected');
      // Delay the first fit until the panel has finished opening so the
      // terminal gets a real height (not 0 during the height transition).
      setTimeout(() => {
        if (!disposed) fitSession(id);
      }, 200);
      term.focus();

      const dataDisposer = term.onData((data) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      const handleResize = () => {
        if (!disposed) fitSession(id);
      };
      window.addEventListener('resize', handleResize);

      let observer: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined' && host) {
        observer = new ResizeObserver(() => {
          if (!disposed && openRef.current) fitSession(id);
        });
        observer.observe(host);
      }

      session.cleanup = () => {
        disposed = true;
        dataDisposer.dispose();
        window.removeEventListener('resize', handleResize);
        if (observer) observer.disconnect();
        if (ws) ws.close();
        term.dispose();
        if (sessionsRef.current[id] === session) {
          delete sessionsRef.current[id];
        }
      };
    })();
  }, [apiUrl, buildWsUrl, fitSession, setSessionStatus, flashCopied]);

  const destroySession = useCallback((id: number) => {
    const s = sessionsRef.current[id];
    if (s) {
      s.cleanup();
      delete sessionsRef.current[id];
    }
  }, []);

  // Reset: kill the active terminal and start a brand-new session
  const resetActive = useCallback(() => {
    if (activeId == null) return;
    destroySession(activeId);
    setResetTick((t) => t + 1);
  }, [activeId, destroySession]);

  // Add a new terminal tab
  const addTab = useCallback(() => {
    const id = idCounter.current++;
    setTabs((prev) => [...prev, { id, title: `Shell ${prev.length + 1}` }]);
    setActiveId(id);
    setOpen(true);
  }, [setOpen]);

  const closeTab = useCallback((id: number) => {
    destroySession(id);
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (next.length === 0) {
        setActiveId(null);
        setStatus('offline');
        setOpen(false);
      } else {
        setActiveId((cur) => (cur === id ? next[0].id : cur));
      }
      return next;
    });
  }, [destroySession, setOpen]);

  // First-time open (or re-open after all tabs closed): create a tab
  useEffect(() => {
    if (open && tabs.length === 0) {
      addTab();
    }
  }, [open, tabs.length, addTab]);

  // Ensure the active tab has a live session (create or reset it)
  useEffect(() => {
    if (!open || activeId == null) return;
    if (!sessionsRef.current[activeId]) {
      const host = hostsRef.current[activeId];
      if (host) {
        createSession(activeId, host, fontPresetRef.current);
      }
    }
  }, [open, activeId, resetTick, createSession]);

  // When switching to a tab that has a session, show its status + refit.
  // Fit again after the panel's height transition finishes so the terminal
  // gets its full row count (not a tiny 1-row fit during the animation).
  useEffect(() => {
    const s = activeId != null ? sessionsRef.current[activeId] : null;
    setStatus(s ? s.state : 'offline');
    if (s && open) {
      requestAnimationFrame(() => fitSession(activeId!));
      const t1 = setTimeout(() => fitSession(activeId!), 200);
      const t2 = setTimeout(() => fitSession(activeId!), 500);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, open, fitSession]);

  // Cleanup all sessions on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      Object.values(sessionsRef.current).forEach((s) => s.cleanup());
      sessionsRef.current = {};
    };
  }, []);

  const applyFontPreset = useCallback((preset: 'S' | 'M' | 'L') => {
    setFontPreset(preset);
    fontPresetRef.current = preset;
    localStorage.setItem('shellFontPreset', preset);
    const s = activeId != null ? sessionsRef.current[activeId] : null;
    if (s) {
      s.term.options.fontSize = FONT_PRESETS[preset];
      try {
        fitSession(activeId!);
      } catch { /* ignore */ }
    }
  }, [activeId, fitSession]);

  const cycleFontPreset = useCallback(() => {
    const idx = FONT_ORDER.indexOf(fontPreset);
    applyFontPreset(FONT_ORDER[(idx + 1) % FONT_ORDER.length]);
  }, [fontPreset, applyFontPreset]);

  const clearActive = useCallback(() => {
    const s = activeId != null ? sessionsRef.current[activeId] : null;
    if (s) {
      s.term.clear();
      s.term.write('\x1b[2J\x1b[H');
      if (s.ws && s.ws.readyState === WebSocket.OPEN) {
        s.ws.send('clear\r');
      }
    }
  }, [activeId]);

  const openNewTab = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}?shell=1`;
    window.open(url, '_blank');
  }, []);

  // Vertical drag-resize on the top handle (like GCloud Shell).
  // Dragging all the way to the minimum height collapses/hides the shell.
  const handleDragStart = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = shellRef.current?.offsetHeight ?? height;
    dragRef.current = { startY, startH };
    setResizing(true);
  };

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const { startY, startH } = dragRef.current;
      persistHeight(startH + (startY - e.clientY));
    };
    const onUp = (e: PointerEvent) => {
      const { startY, startH } = dragRef.current || { startY: 0, startH: 0 };
      dragRef.current = null;
      setResizing(false);
      const finalHeight = startH + (startY - e.clientY);
      if (finalHeight <= MIN_HEIGHT + 12) {
        setOpen(false);
        setHeight(DEFAULT_HEIGHT);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [resizing, persistHeight, setOpen]);

  const renderTitleBar = (closable: boolean) => (
    <div className="flex items-center justify-between px-3 py-1.5 bg-white dark:bg-[#10131c] border-b border-slate-200 dark:border-[#1e2235] shrink-0 select-none">
      {/* Tab bar */}
      <div className="flex items-center gap-1 min-w-0 flex-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveId(tab.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0 ${
              tab.id === activeId
                ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30'
                : 'bg-slate-100 dark:bg-[#161822] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-transparent'
            }`}
            title={tab.title}
          >
            <TerminalSquare className="w-3.5 h-3.5" />
            <span className="max-w-[120px] truncate">{tab.title}</span>
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              className="ml-0.5 p-0.5 rounded hover:bg-slate-300/50 dark:hover:bg-slate-700/50 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Close terminal"
            >
              <X className="w-3 h-3" />
            </span>
          </button>
        ))}
        <button
          onClick={addTab}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0 bg-slate-100 dark:bg-[#161822] text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-300"
          title="New terminal"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Status + controls */}
      <div className="flex items-center space-x-1 shrink-0 pl-2">
        {status === 'connecting' && (
          <span className="flex items-center text-amber-500 space-x-1 mr-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="text-[10px] font-bold">Connecting...</span>
          </span>
        )}
        {status === 'connected' && (
          <span className="flex items-center text-emerald-500 space-x-1 mr-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold">Connected</span>
          </span>
        )}
        {(status === 'offline' || status === 'error') && (
          <span className="flex items-center text-red-500 space-x-1 mr-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-[10px] font-bold">{status === 'error' ? 'Failed' : 'Offline'}</span>
          </span>
        )}

        {/* Transient "Copied" flash (shows for ~1.2s after copy) */}
        {copiedTick % 2 === 1 && (
          <span className="flex items-center text-emerald-500 space-x-1 mr-1 animate-fade-in">
            <Check className="w-3 h-3" />
            <span className="text-[10px] font-bold">Copied</span>
          </span>
        )}

        <span className="hidden md:flex items-center mr-1 text-[9px] font-black text-slate-400 uppercase tracking-wider">
          Font
        </span>
        <button
          onClick={cycleFontPreset}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-200/70 dark:bg-[#24233f] text-slate-600 dark:text-slate-300 text-[10px] font-black transition cursor-pointer hover:bg-slate-300 dark:hover:bg-[#2a294a]"
          title={`Font size: ${fontPreset} (click to change)`}
        >
          <Type className="w-3.5 h-3.5" />
          {fontPreset}
        </button>
        <button
          onClick={resetActive}
          className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#24233f] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
          title="Reset terminal (start a fresh session)"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        {!fullscreen && (
          <button
            onClick={openNewTab}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#24233f] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
            title="Open shell in a new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={clearActive}
          className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#24233f] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
          title="Clear terminal"
        >
          <Eraser className="w-4 h-4" />
        </button>
        <button
          onClick={copyActiveSelection}
          className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#24233f] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer relative"
          title="Copy selection (Ctrl+Shift+C)"
        >
          <Copy className="w-4 h-4" />
        </button>
        {closable ? (
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#24233f] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
            title="Minimize (hide shell, keep sessions)"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => window.close()}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#24233f] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
            title="Close window"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  const renderTerminalArea = () => (
    <div className="flex-1 min-h-0 relative bg-[#121124]">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          ref={(el) => { hostsRef.current[tab.id] = el; }}
          className="absolute inset-0"
          style={{ visibility: tab.id === activeId ? 'visible' : 'hidden' }}
        />
      ))}
    </div>
  );

  if (fullscreen) {
    return (
      <div ref={shellRef} className="fixed inset-0 z-50 bg-slate-100 dark:bg-[#0d1117] flex flex-col">
        {renderTitleBar(false)}
        <style>{`.podex-shell-viewport .xterm-viewport { padding-bottom: 12px; }`}</style>
        <div className="flex-1 min-h-0 relative bg-[#121124] p-3 flex flex-col">
          {renderTerminalArea()}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={shellRef}
      className="absolute bottom-0 left-0 right-0 z-40 bg-slate-100 dark:bg-[#0d1117] overflow-hidden flex flex-col shadow-[0_-8px_30px_rgba(0,0,0,0.18)]"
      style={{ height: open ? height : 0, transition: resizing ? 'none' : 'height 120ms ease-out' }}
    >
      {tabs.length > 0 && (
        <>
          <div
            onPointerDown={handleDragStart}
            className={`h-1.5 cursor-ns-resize shrink-0 group ${resizing ? 'bg-cyan-500' : 'bg-transparent hover:bg-cyan-500/60'} transition-colors`}
            title="Drag to resize (drag to the very bottom to hide)"
          />
          {renderTitleBar(true)}
          <style>{`.podex-shell-viewport .xterm-viewport { padding-bottom: 12px; }`}</style>
          <div className="flex-1 min-h-0 relative bg-[#121124] p-2 pb-3 flex flex-col">
            {renderTerminalArea()}
          </div>
        </>
      )}
    </div>
  );
};
