import React, { useState } from 'react';
import { Cpu, Sliders, Terminal, Check, Palette, RefreshCw, Globe, Trash2, RotateCcw, AlertTriangle, X } from 'lucide-react';

const ACCENT_OPTIONS = [
  { id: 'cyan',    label: 'Cyan',     hex: '#06b6d4', light: 'bg-cyan-500', dark: 'bg-cyan-600' },
  { id: 'blue',    label: 'Blue',     hex: '#3b82f6', light: 'bg-blue-500', dark: 'bg-blue-600' },
  { id: 'indigo',  label: 'Indigo',   hex: '#6366f1', light: 'bg-indigo-500', dark: 'bg-indigo-600' },
  { id: 'violet',  label: 'Violet',   hex: '#8b5cf6', light: 'bg-violet-500', dark: 'bg-violet-600' },
  { id: 'emerald', label: 'Emerald',  hex: '#10b981', light: 'bg-emerald-500', dark: 'bg-emerald-600' },
  { id: 'amber',   label: 'Amber',    hex: '#f59e0b', light: 'bg-amber-500', dark: 'bg-amber-600' },
  { id: 'rose',    label: 'Rose',     hex: '#f43f5e', light: 'bg-rose-500', dark: 'bg-rose-600' },
  { id: 'peach',   label: 'Peach',    hex: '#f2856d', light: 'bg-orange-500', dark: 'bg-orange-600' },
];

interface SettingsTabProps {
  contexts: string[];
  activeContext: string;
  handleSwitchContext: (ctx: string) => void;
  aiProvider: 'gemini' | 'openai';
  setAiProvider: (provider: 'gemini' | 'openai') => void;
  mockModeForced: boolean;
  setMockModeForced: (forced: boolean) => void;
  geminiKey: string;
  setGeminiKey: (key: string) => void;
  openaiKey: string;
  setOpenaiKey: (key: string) => void;
  aiModel: string;
  setAiModel: (model: string) => void;
  aiTemperature: number;
  setAiTemperature: (temp: number) => void;
  logsLineWrap: boolean;
  setLogsLineWrap: (wrap: boolean) => void;
  logsShowTimestamps: boolean;
  setLogsShowTimestamps: (show: boolean) => void;
  logsTailLimit: number;
  setLogsTailLimit: (limit: number) => void;
  customNamespaces: string;
  setCustomNamespaces: (ns: string) => void;
  refreshInterval: number;
  setRefreshInterval: (interval: number) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  getAccentHex: () => string;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  contexts,
  activeContext,
  handleSwitchContext,
  aiProvider,
  setAiProvider,
  mockModeForced,
  setMockModeForced,
  geminiKey,
  setGeminiKey,
  openaiKey,
  setOpenaiKey,
  aiModel,
  setAiModel,
  aiTemperature,
  setAiTemperature,
  logsLineWrap,
  setLogsLineWrap,
  logsShowTimestamps,
  setLogsShowTimestamps,
  logsTailLimit,
  setLogsTailLimit,
  customNamespaces,
  setCustomNamespaces,
  refreshInterval,
  setRefreshInterval,
  accentColor,
  setAccentColor,
  getAccentHex,
}) => {
  const accentHex = getAccentHex();
  const [clearConfirm, setClearConfirm] = useState<'cache' | 'reset' | null>(null);

  const handleClearCache = () => {
    sessionStorage.clear();
    setClearConfirm(null);
    window.location.reload();
  };

  const handleResetAll = () => {
    localStorage.clear();
    sessionStorage.clear();
    setClearConfirm(null);
    window.location.reload();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="space-y-2">
        <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 m-0">Settings</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
          Customize your workspace — theme, AI providers, cluster context, and log preferences.
        </p>
      </div>

      {/* Theme Configuration */}
      <div className="bg-white dark:bg-[#151824] border border-slate-200 dark:border-[#1e2235] rounded-xl overflow-hidden shadow-sm">
        <div className="border-b border-slate-200 dark:border-[#1e2235] px-6 py-4 flex items-center space-x-3">
          <Palette className="w-5 h-5" style={{ color: accentHex }} />
          <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 m-0">Theme Configuration</h4>
        </div>
        <div className="p-6 space-y-6">
          {/* Accent Color Swatches */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Accent Color</label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              {ACCENT_OPTIONS.map(c => {
                const isActive = accentColor === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setAccentColor(c.id)}
                    className={`relative flex flex-col items-center space-y-1.5 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                      isActive
                        ? 'border-slate-800 dark:border-white shadow-md'
                        : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                    title={c.label}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
                      style={{ backgroundColor: c.hex }}
                    >
                      {isActive && <Check className="w-4 h-4 text-white" />}
                    </div>
                    <span className={`text-[9px] font-bold ${isActive ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Preview */}
          <div className="bg-slate-50 dark:bg-[#111820] rounded-xl p-5 space-y-4 border border-slate-200 dark:border-[#1b2332]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Preview</span>
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="px-4 py-2 rounded-lg text-white text-xs font-bold transition hover:opacity-90 shadow-sm"
                style={{ backgroundColor: accentHex }}
              >
                Button
              </button>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked className="sr-only peer" readOnly />
                <div
                  className="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all"
                  style={{ backgroundColor: accentHex }}
                />
              </label>
              <span className="text-xs font-bold px-3 py-1.5 rounded-md border" style={{ borderColor: accentHex, color: accentHex }}>
                Badge
              </span>
              <div className="flex items-center space-x-1.5 text-xs font-bold" style={{ color: accentHex }}>
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accentHex }} />
                Online
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              Changes apply instantly across the app — sidebar icons, buttons, toggles, borders, and active states.
            </p>
          </div>
        </div>
      </div>

      {/* Cluster Context Switcher */}
      <div className="bg-white dark:bg-[#151824] border border-slate-200 dark:border-[#1e2235] rounded-xl overflow-hidden shadow-sm">
        <div className="border-b border-slate-200 dark:border-[#1e2235] px-6 py-4 flex items-center space-x-3">
          <Globe className="w-5 h-5" style={{ color: accentHex }} />
          <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 m-0">Kubernetes Context</h4>
        </div>
        <div className="p-6 space-y-4">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Select Active Cluster Context</label>
          {contexts.length === 0 ? (
            <div className="text-xs text-slate-400 dark:text-slate-500 italic p-4 bg-slate-50 dark:bg-[#111820] rounded-lg border border-slate-200/50 dark:border-[#1b2332] font-medium">
              No external kubeconfig contexts found. Using default/in-cluster client.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {contexts.map(ctx => {
                const isActive = ctx === activeContext;
                return (
                  <button
                    key={ctx}
                    onClick={() => handleSwitchContext(ctx)}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border text-xs font-bold text-left transition cursor-pointer ${
                      isActive
                        ? 'text-white shadow-sm'
                        : 'border-slate-200 dark:border-[#1b2332] bg-slate-50 hover:bg-slate-100 dark:bg-[#111820] dark:hover:bg-[#151824] text-slate-700 dark:text-slate-300'
                    }`}
                    style={isActive ? { backgroundColor: accentHex, borderColor: accentHex } : {}}
                  >
                    <span className="truncate mr-2 font-mono">{ctx}</span>
                    {isActive && <Check className="w-3.5 h-3.5 shrink-0" />}
                    {!isActive && (
                      <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-medium">
            <RefreshCw className="w-3 h-3" />
            <span>Click a context to switch. Resources will auto-refresh.</span>
          </div>
        </div>
      </div>

      {/* AI Engine Parameters */}
      <div className="bg-white dark:bg-[#151824] border border-slate-200 dark:border-[#1e2235] rounded-xl overflow-hidden shadow-sm">
        <div className="border-b border-slate-200 dark:border-[#1e2235] px-6 py-4 flex items-center space-x-3">
          <Sliders className="w-5 h-5" style={{ color: accentHex }} />
          <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 m-0">AI Engine</h4>
        </div>
        <div className="p-6 space-y-5">
          {/* Provider */}
          <div className="flex flex-col space-y-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Target AI Engine</label>
            <div className="flex space-x-4">
              {[
                { id: 'gemini', label: 'Google Gemini' },
                { id: 'openai', label: 'OpenAI GPT' }
              ].map(prov => (
                <label key={prov.id} className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-400 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="aiProvider"
                    checked={aiProvider === prov.id}
                    onChange={() => setAiProvider(prov.id as any)}
                    className="w-4 h-4 border-slate-300 dark:border-slate-800 focus:ring-0 cursor-pointer"
                    style={{ accentColor: accentHex }}
                  />
                  <span>{prov.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Mock Mode Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-[#111820] rounded-lg border border-slate-200 dark:border-[#1b2332]">
            <div className="space-y-0.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Offline Sandbox Mode</label>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Uses local mock answers — no API key needed.</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={mockModeForced}
                onChange={(e) => setMockModeForced(e.target.checked)}
                className="sr-only peer"
              />
              <div
                className="w-9 h-5 bg-slate-200 dark:bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all"
                style={{ backgroundColor: mockModeForced ? accentHex : undefined }}
              />
            </label>
          </div>

          {!mockModeForced && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {aiProvider === 'gemini' ? (
                <>
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Gemini API Key</label>
                      <span className="text-[10px] font-semibold italic" style={{ color: accentHex }}>Local Browser Storage</span>
                    </div>
                    <input
                      type="password"
                      placeholder="Enter GEMINI_API_KEY..."
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      className="bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] text-xs font-medium rounded-lg px-4 py-2.5 w-full outline-none text-slate-800 dark:text-slate-200 focus:ring-1"
                      style={{ outlineColor: accentHex }}
                    />
                  </div>
                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Model</label>
                    <select
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      className="bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] text-xs font-medium rounded-lg px-4 py-2.5 w-full outline-none text-slate-800 dark:text-slate-200"
                    >
                      <option value="gemini-2.5-flash">gemini-2.5-flash (Fast)</option>
                      <option value="gemini-2.5-pro">gemini-2.5-pro (High intelligence)</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400">OpenAI API Key</label>
                      <span className="text-[10px] font-semibold italic" style={{ color: accentHex }}>Local Browser Storage</span>
                    </div>
                    <input
                      type="password"
                      placeholder="Enter OPENAI_API_KEY..."
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      className="bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] text-xs font-medium rounded-lg px-4 py-2.5 w-full outline-none text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Model</label>
                    <select
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      className="bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] text-xs font-medium rounded-lg px-4 py-2.5 w-full outline-none text-slate-800 dark:text-slate-200"
                    >
                      <option value="gpt-4o-mini">gpt-4o-mini (Default)</option>
                      <option value="gpt-4o">gpt-4o (Strict reasoning)</option>
                    </select>
                  </div>
                </>
              )}

              {/* Temperature */}
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Temperature</label>
                  <span className="font-mono text-xs font-bold" style={{ color: accentHex }}>{aiTemperature}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.1"
                  value={aiTemperature}
                  onChange={(e) => setAiTemperature(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor: accentHex }}
                />
                <span className="text-[10px] text-slate-400 dark:text-slate-500">Lower = predictable, Higher = creative</span>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="bg-slate-50 dark:bg-[#111820]/60 p-4 rounded-lg border border-slate-100 dark:border-[#1b2332] text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 font-medium space-y-1.5">
            <span className="font-extrabold block" style={{ color: accentHex }}>API Override Info</span>
            <p className="m-0">
              Keys left blank fall back to <code className="font-mono" style={{ color: accentHex }}>GEMINI_API_KEY</code> / <code className="font-mono" style={{ color: accentHex }}>OPENAI_API_KEY</code> environment variables. If none are set, Poddy runs in Sandbox Mode.
            </p>
          </div>
        </div>
      </div>

      {/* Terminal Logs Preferences */}
      <div className="bg-white dark:bg-[#151824] border border-slate-200 dark:border-[#1e2235] rounded-xl overflow-hidden shadow-sm">
        <div className="border-b border-slate-200 dark:border-[#1e2235] px-6 py-4 flex items-center space-x-3">
          <Terminal className="w-5 h-5" style={{ color: accentHex }} />
          <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 m-0">Terminal & Logs</h4>
        </div>
        <div className="p-6 space-y-4 text-xs font-bold">
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-[#111820] rounded-lg border border-slate-100 dark:border-slate-800/80">
            <div className="space-y-0.5">
              <span className="text-slate-700 dark:text-slate-300 block">Log Line Wrap</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-normal">Wrap long lines instead of horizontal scroll.</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={logsLineWrap} onChange={(e) => setLogsLineWrap(e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all" style={{ backgroundColor: logsLineWrap ? accentHex : undefined }} />
            </label>
          </div>
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-[#111820] rounded-lg border border-slate-100 dark:border-slate-800/80">
            <div className="space-y-0.5">
              <span className="text-slate-700 dark:text-slate-300 block">Container Timestamps</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-normal">Prefix log lines with timestamps.</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={logsShowTimestamps} onChange={(e) => setLogsShowTimestamps(e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-slate-200 dark:bg-slate-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all" style={{ backgroundColor: logsShowTimestamps ? accentHex : undefined }} />
            </label>
          </div>
          <div className="flex flex-col space-y-2">
            <label className="text-xs text-slate-500 dark:text-slate-400">Log Tail Limit</label>
            <select
              value={logsTailLimit}
              onChange={(e) => setLogsTailLimit(Number(e.target.value))}
              className="bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] text-xs font-medium rounded-lg px-4 py-2.5 w-full outline-none text-slate-800 dark:text-slate-200"
            >
              <option value={50}>50 lines</option>
              <option value={100}>100 lines</option>
              <option value={200}>200 lines</option>
              <option value={500}>500 lines</option>
              <option value={1000}>1000 lines</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cluster Workspace Config */}
      <div className="bg-white dark:bg-[#151824] border border-slate-200 dark:border-[#1e2235] rounded-xl overflow-hidden shadow-sm">
        <div className="border-b border-slate-200 dark:border-[#1e2235] px-6 py-4 flex items-center space-x-3">
          <Cpu className="w-5 h-5" style={{ color: accentHex }} />
          <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 m-0">Workspace</h4>
        </div>
        <div className="p-6 space-y-4 text-xs">
          <div className="flex flex-col space-y-2">
            <label className="font-bold text-slate-500 dark:text-slate-400">Hide Namespaces</label>
            <input
              type="text"
              placeholder="kube-system, kube-public, local-path-storage"
              value={customNamespaces}
              onChange={(e) => setCustomNamespaces(e.target.value)}
              className="bg-slate-50 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] text-xs font-medium rounded-lg px-4 py-2.5 w-full outline-none text-slate-800 dark:text-slate-200"
            />
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Comma-separated namespaces hidden in Explorer.</span>
          </div>
          <div className="flex flex-col space-y-2">
            <label className="font-bold text-slate-500 dark:text-slate-400 flex items-center space-x-1">
              <span>Auto-Refresh Interval</span>
              <span className="font-mono text-xs font-bold" style={{ color: accentHex }}>{refreshInterval}s</span>
            </label>
            <input
              type="range"
              min="2"
              max="30"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
              style={{ accentColor: accentHex }}
            />
          </div>
        </div>
      </div>

      {/* Clear Cache / Reset */}
      <div className="bg-white dark:bg-[#151824] border border-slate-200 dark:border-[#1e2235] rounded-xl overflow-hidden shadow-sm">
        <div className="border-b border-slate-200 dark:border-[#1e2235] px-6 py-4 flex items-center space-x-3">
          <RotateCcw className="w-5 h-5" style={{ color: accentHex }} />
          <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 m-0">Cache & Reset</h4>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setClearConfirm('cache')}
              className="flex items-center space-x-3 p-4 rounded-xl border border-slate-200 dark:border-[#1b2332] bg-slate-50 hover:bg-slate-100 dark:bg-[#111820] dark:hover:bg-[#151824] transition cursor-pointer text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Trash2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Clear Arena Cache</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Resets canvas state, keeps settings</span>
              </div>
            </button>
            <button
              onClick={() => setClearConfirm('reset')}
              className="flex items-center space-x-3 p-4 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 hover:bg-red-100 dark:bg-red-950/10 dark:hover:bg-red-950/20 transition cursor-pointer text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                <RotateCcw className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-red-700 dark:text-red-400 block">Reset All Settings</span>
                <span className="text-[10px] text-red-500 dark:text-red-400/70 block">Restores defaults, reloads app</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {clearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4" onClick={() => setClearConfirm(null)}>
          <div className="w-full max-w-sm bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#1b2332] rounded-xl shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${clearConfirm === 'reset' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                <AlertTriangle className={`w-5 h-5 ${clearConfirm === 'reset' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 m-0">
                  {clearConfirm === 'reset' ? 'Reset All Settings?' : 'Clear Arena Cache?'}
                </h4>
                <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                  {clearConfirm === 'reset'
                    ? 'All preferences, keys, and canvas state will be lost.'
                    : 'Arena canvas state will be cleared. Settings are kept.'}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
              {clearConfirm === 'reset'
                ? 'This will clear localStorage and sessionStorage, then reload the page. API keys and theme preferences will need to be re-configured.'
                : 'Only sessionStorage (Arena nodes, connections) will be cleared. Your settings, API keys, and theme remain intact.'}
            </p>
            <div className="flex items-center space-x-2.5 pt-1">
              <button
                onClick={() => setClearConfirm(null)}
                className="flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg border border-slate-200 dark:border-[#1b2332] hover:bg-slate-50 dark:hover:bg-[#1b2332] text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
              <button
                onClick={clearConfirm === 'reset' ? handleResetAll : handleClearCache}
                className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg text-white font-bold text-xs transition cursor-pointer ${clearConfirm === 'reset' ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{clearConfirm === 'reset' ? 'Reset Everything' : 'Clear Cache'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
