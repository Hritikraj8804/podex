import React from 'react';
import { Cpu, Sliders, Terminal, Sun } from 'lucide-react';

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
  accentColor: 'cyan' | 'indigo' | 'violet' | 'emerald' | 'amber';
  setAccentColor: (color: 'cyan' | 'indigo' | 'violet' | 'emerald' | 'amber') => void;
  customNamespaces: string;
  setCustomNamespaces: (ns: string) => void;
  refreshInterval: number;
  setRefreshInterval: (interval: number) => void;
  getAccentColor: (type: 'bg' | 'text' | 'border' | 'bgMuted') => string;
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
  accentColor,
  setAccentColor,
  customNamespaces,
  setCustomNamespaces,
  refreshInterval,
  setRefreshInterval,
  getAccentColor,
}) => {
  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="space-y-2">
        <h3 className="text-xl font-black text-slate-805 dark:text-slate-200 m-0">Project Settings & Overrides</h3>
        <p className="text-xs text-slate-500 dark:text-slate-450 font-bold">
          Customize namespaces filters, log displays, cluster targets, and configure custom Gemini/OpenAI parameters directly in the browser.
        </p>
      </div>

      {/* Cluster Connection Settings */}
      <div className="bg-white dark:bg-[#0c0e15] border border-slate-200 dark:border-[#1e202d] rounded-3xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100 dark:border-[#1e202a]">
          <Cpu className={`w-5 h-5 ${getAccentColor('text')}`} />
          <h4 className="text-sm font-extrabold text-slate-850 dark:text-slate-100 m-0">Kubernetes Cluster Context Switcher</h4>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col space-y-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Select Active Context:</label>
            {contexts.length === 0 ? (
              <div className="text-xs text-slate-400 dark:text-slate-555 italic p-3.5 bg-slate-50 dark:bg-[#111319] rounded-xl border border-slate-200/50 dark:border-slate-800/40 font-semibold">
                No external kubeconfig contexts found. Using default/in-cluster client.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {contexts.map(ctx => {
                  const isCtxActive = ctx === activeContext;
                  return (
                    <button
                      key={ctx}
                      onClick={() => handleSwitchContext(ctx)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-bold text-left transition cursor-pointer ${
                        isCtxActive
                          ? `${getAccentColor('border')} ${getAccentColor('bgMuted')} ${getAccentColor('text')}`
                          : 'border-slate-200 dark:border-[#1e202a] bg-slate-50 hover:bg-slate-100 dark:bg-[#111319] dark:hover:bg-[#151821] text-slate-700 dark:text-slate-350'
                      }`}
                    >
                      <span className="truncate mr-2">{ctx}</span>
                      {isCtxActive && (
                        <span className={`w-2 h-2 rounded-full ${getAccentColor('bg')}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Service Provider Settings */}
      <div className="bg-white dark:bg-[#0c0e15] border border-slate-200 dark:border-[#1e202d] rounded-3xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100 dark:border-[#1e202a]">
          <Sliders className={`w-5 h-5 ${getAccentColor('text')}`} />
          <h4 className="text-sm font-extrabold text-slate-850 dark:text-slate-100 m-0">AI Engine Parameters</h4>
        </div>

        <div className="space-y-4">
          {/* Select Provider */}
          <div className="flex flex-col space-y-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Target AI Engine:</label>
            <div className="flex space-x-4">
              {[
                { id: 'gemini', label: 'Google Gemini (default)' },
                { id: 'openai', label: 'OpenAI GPT' }
              ].map(prov => (
                <label key={prov.id} className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none">
                  <input
                    type="radio"
                    name="aiProvider"
                    checked={aiProvider === prov.id}
                    onChange={() => setAiProvider(prov.id as any)}
                    className="w-4 h-4 text-cyan-500 border-slate-300 dark:border-slate-800 focus:ring-0 cursor-pointer"
                  />
                  <span>{prov.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Force Mock Mode */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-[#111319] rounded-2xl border border-slate-205 dark:border-slate-800/80">
            <div className="space-y-0.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-305">Force Offline Sandbox Mode</label>
              <span className="text-[10px] text-slate-405 dark:text-slate-500 block">Uses local mock answers. Saves credits & works without Internet.</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={mockModeForced}
                onChange={(e) => setMockModeForced(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-250 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-cyan-500"></div>
            </label>
          </div>

          {/* Keys overrides */}
          {!mockModeForced && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {aiProvider === 'gemini' ? (
                <>
                  {/* Gemini Key Config */}
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Gemini API Key Override:</label>
                      <span className={`text-[10px] ${getAccentColor('text')} font-semibold italic`}>Local Browser Storage</span>
                    </div>
                    <input
                      type="password"
                      placeholder="Enter GEMINI_API_KEY..."
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      className="bg-slate-50 dark:bg-[#111319] border border-slate-205 dark:border-[#1e202a] text-xs font-bold rounded-xl px-4 py-2.5 w-full outline-none text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  {/* Gemini Model */}
                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Gemini Model Type:</label>
                    <select
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      className="bg-slate-50 dark:bg-[#111319] border border-slate-205 dark:border-[#1e202a] text-xs font-bold rounded-xl px-4 py-2.5 w-full outline-none text-slate-850 dark:text-slate-200"
                    >
                      <option value="gemini-2.5-flash">gemini-2.5-flash (Fast & cost-efficient)</option>
                      <option value="gemini-2.5-pro">gemini-2.5-pro (High intelligence, complex diagnostics)</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  {/* OpenAI Key Config */}
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400">OpenAI API Key Override:</label>
                      <span className={`text-[10px] ${getAccentColor('text')} font-semibold italic`}>Local Browser Storage</span>
                    </div>
                    <input
                      type="password"
                      placeholder="Enter OPENAI_API_KEY..."
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      className="bg-slate-50 dark:bg-[#111319] border border-slate-205 dark:border-[#1e202a] text-xs font-bold rounded-xl px-4 py-2.5 w-full outline-none text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  {/* OpenAI Model */}
                  <div className="flex flex-col space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">OpenAI Model Type:</label>
                    <select
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      className="bg-slate-50 dark:bg-[#111319] border border-slate-205 dark:border-[#1e202a] text-xs font-bold rounded-xl px-4 py-2.5 w-full outline-none text-slate-850 dark:text-slate-200"
                    >
                      <option value="gpt-4o-mini">gpt-4o-mini (Default high performance)</option>
                      <option value="gpt-4o">gpt-4o (Strict reasoning & analysis)</option>
                    </select>
                  </div>
                </>
              )}

              {/* Temperature slider */}
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                    <span>LLM Temperature:</span>
                    <span className={`font-mono ${getAccentColor('text')}`}>{aiTemperature}</span>
                  </label>
                  <span className="text-[10px] text-slate-450 dark:text-slate-500">Lower = focused & predictable, Higher = creative analogies</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.1"
                  value={aiTemperature}
                  onChange={(e) => setAiTemperature(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>
            </div>
          )}

          {/* Connection indicator */}
          <div className="bg-slate-50 dark:bg-[#11131c]/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 font-semibold space-y-1.5">
            <span className={`font-extrabold ${getAccentColor('text')} block`}>💡 API Override Information:</span>
            <p className="m-0">
              If overrides are left blank, Podex will automatically look for environmental variables (<code className="font-mono text-cyan-600 dark:text-cyan-400">GEMINI_API_KEY</code> / <code className="font-mono text-cyan-600 dark:text-cyan-400">OPENAI_API_KEY</code>) set in your docker-compose parameters or host settings. If none are present, the workspace runs in Sandbox Fallback Mode automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Log Display Preferences */}
      <div className="bg-white dark:bg-[#0c0e15] border border-slate-200 dark:border-[#1e202d] rounded-3xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100 dark:border-[#1e202a]">
          <Terminal className={`w-5 h-5 ${getAccentColor('text')}`} />
          <h4 className="text-sm font-extrabold text-slate-850 dark:text-slate-100 m-0">Terminal Logs Preferences</h4>
        </div>

        <div className="space-y-4 text-xs font-bold">
          {/* Line Wrapping */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-[#111319] rounded-2xl border border-slate-100 dark:border-slate-800/80">
            <div className="space-y-0.5">
              <span className="text-slate-750 dark:text-slate-300 block">Log Line Wrap</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-normal">Wraps text inside the log screen instead of scrolling horizontally.</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={logsLineWrap}
                onChange={(e) => setLogsLineWrap(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-250 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-cyan-500"></div>
            </label>
          </div>

          {/* Show Timestamps */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-[#111319] rounded-2xl border border-slate-100 dark:border-slate-800/80">
            <div className="space-y-0.5">
              <span className="text-slate-750 dark:text-slate-300 block">Show Container Timestamps</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-normal">Toggles Kubernetes log timestamps (`kubectl logs --timestamps`).</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={logsShowTimestamps}
                onChange={(e) => setLogsShowTimestamps(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-250 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-cyan-500"></div>
            </label>
          </div>

          {/* Logs Tail Limit */}
          <div className="flex flex-col space-y-2">
            <label className="text-xs text-slate-500 dark:text-slate-400">Log Tail Depth:</label>
            <select
              value={logsTailLimit}
              onChange={(e) => setLogsTailLimit(Number(e.target.value))}
              className="bg-slate-50 dark:bg-[#111319] border border-slate-205 dark:border-[#1e202a] text-xs font-bold rounded-xl px-4 py-2.5 w-full outline-none text-slate-805 dark:text-slate-200"
            >
              <option value={50}>50 lines</option>
              <option value={100}>100 lines (recommended)</option>
              <option value={200}>200 lines</option>
              <option value={500}>500 lines</option>
              <option value={1000}>1000 lines (requires more network memory)</option>
            </select>
          </div>
        </div>
      </div>

      {/* UI Customization Preferences */}
      <div className="bg-white dark:bg-[#0c0e15] border border-slate-200 dark:border-[#1e202d] rounded-3xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100 dark:border-[#1e202a]">
          <Sun className={`w-5 h-5 ${getAccentColor('text')}`} />
          <h4 className="text-sm font-extrabold text-slate-850 dark:text-slate-100 m-0">Theme Accent Configurations</h4>
        </div>

        <div className="space-y-4">
          {/* Select Theme Accent */}
          <div className="flex flex-col space-y-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Select Accent Color Highlight:</label>
            <div className="flex space-x-3.5 pt-1">
              {([
                { id: 'cyan', color: 'bg-cyan-500' },
                { id: 'indigo', color: 'bg-indigo-600' },
                { id: 'violet', color: 'bg-violet-600' },
                { id: 'emerald', color: 'bg-emerald-600' },
                { id: 'amber', color: 'bg-amber-600' }
              ] as const).map(item => {
                const isSelected = accentColor === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setAccentColor(item.id)}
                    className={`w-7 h-7 rounded-full ${item.color} flex items-center justify-center cursor-pointer transition active:scale-90 border-2 ${
                      isSelected ? 'border-slate-800 dark:border-white scale-110 shadow-lg' : 'border-transparent opacity-80 hover:opacity-100'
                    }`}
                    title={`Use ${item.id} accent color`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Kubernetes settings */}
      <div className="bg-white dark:bg-[#0c0e15] border border-slate-200 dark:border-[#1e202d] rounded-3xl p-6 space-y-6 shadow-sm">
        <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100 dark:border-[#1e202a]">
          <Cpu className={`w-5 h-5 ${getAccentColor('text')}`} />
          <h4 className="text-sm font-extrabold text-slate-850 dark:text-slate-100 m-0">Cluster Workspace Configurations</h4>
        </div>

        <div className="space-y-4 text-xs">
          {/* System Namespaces */}
          <div className="flex flex-col space-y-2">
            <label className="font-bold text-slate-500 dark:text-slate-400">Hide Namespaces (comma-separated):</label>
            <input
              type="text"
              placeholder="e.g. kube-system, kube-public, local-path-storage"
              value={customNamespaces}
              onChange={(e) => setCustomNamespaces(e.target.value)}
              className="bg-slate-50 dark:bg-[#111319] border border-slate-205 dark:border-[#1e202a] text-xs font-bold rounded-xl px-4 py-2.5 w-full outline-none text-slate-800 dark:text-slate-200"
            />
            <span className="text-[10px] text-slate-405 dark:text-slate-500 font-medium">Namespaces added here will be hidden by default in the explorer layout to keep noise low.</span>
          </div>

          {/* Refresh Rate */}
          <div className="flex flex-col space-y-2">
            <label className="font-bold text-slate-500 dark:text-slate-400 flex items-center space-x-1">
              <span>Auto-refresh Poll Rate:</span>
              <span className={`font-mono ${getAccentColor('text')}`}>{refreshInterval} seconds</span>
            </label>
            <input
              type="range"
              min="2"
              max="30"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <span className="text-[10px] text-slate-405 dark:text-slate-500 font-medium">Sets the duration between background updates of nodes, pods, and statistics.</span>
          </div>
        </div>
      </div>

    </div>
  );
};
