import React from 'react';
import { Loader2, Info, AlertCircle, Sparkles, Send } from 'lucide-react';

interface LearnTabProps {
  learnQuery: string;
  setLearnQuery: (query: string) => void;
  handleLearnQuery: (query: string) => void;
  aiLearningLoading: boolean;
  aiLearning: any;
  learnSubTab: 'concept' | 'why' | 'gotchas';
  setLearnSubTab: (tab: 'concept' | 'why' | 'gotchas') => void;
}

export const LearnTab: React.FC<LearnTabProps> = ({
  learnQuery,
  setLearnQuery,
  handleLearnQuery,
  aiLearningLoading,
  aiLearning,
  learnSubTab,
  setLearnSubTab,
}) => {
  const hasMessages = aiLearning && !aiLearningLoading;

  return (
    <div className="max-w-3xl mx-auto h-full flex flex-col animate-fade-in">

      {/* Header / Empty State */}
      {!hasMessages && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 space-y-5">
          <img src="/mascot.png" alt="Poddy" className="w-48 h-48 object-contain" />
          <div className="text-center space-y-1.5">
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 m-0">Poddy</h2>
            <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400">Your Kubernetes Learning Companion</p>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-md font-semibold leading-relaxed">
            Ask me anything about Kubernetes — pods, services, networking, debugging, and more.
          </p>

          {/* Quick suggestion chips */}
          <div className="flex flex-wrap justify-center gap-2 max-w-lg">
            {['What is a Pod?', 'What is a Service?', 'What is Liveness Probe?', 'How does Ingress work?', 'What is CrashLoopBackOff?'].map(tag => (
              <button
                key={tag}
                onClick={() => { setLearnQuery(tag); handleLearnQuery(tag); }}
                className="px-4 py-2 rounded-full bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#1b2332] text-xs text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-500/40 transition font-bold shadow-sm cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat Messages Area */}
      {hasMessages && (
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
          {/* User Message */}
          <div className="flex justify-end">
            <div className="bg-cyan-500/10 dark:bg-cyan-500/5 text-slate-800 dark:text-slate-200 text-sm font-semibold px-4 py-3 rounded-2xl rounded-br-sm max-w-[75%] leading-relaxed">
              {learnQuery}
            </div>
          </div>

          {/* Poddy Message */}
          <div className="flex items-start space-x-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-[#1b2332] border border-slate-200 dark:border-[#2d3142] flex items-center justify-center shrink-0 overflow-hidden mt-0.5 shadow-sm">
              <img src="/mascot.png" alt="Poddy" className="w-11 h-11 object-contain" />
            </div>
            <div className="flex-1 min-w-0 space-y-4 bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#1b2332] rounded-2xl rounded-tl-sm p-5 shadow-sm">
              {/* Concept Title */}
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-cyan-500" />
                <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 m-0">{aiLearning.concept}</h4>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider ml-auto">Poddy</span>
              </div>

              {/* Sub-tabs */}
              <div className="flex bg-slate-200/50 dark:bg-[#111820] rounded-lg p-0.5 border border-slate-200 dark:border-[#1b2332] select-none">
                {([
                  { id: 'concept', label: 'Concept' },
                  { id: 'why', label: 'Why it Exists' },
                  { id: 'gotchas', label: 'Gotchas' }
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setLearnSubTab(tab.id)}
                    className={`flex-1 py-1.5 rounded-md font-bold text-[10px] uppercase tracking-wider transition duration-150 cursor-pointer ${learnSubTab === tab.id
                      ? 'bg-white dark:bg-[#1f2330] text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200 dark:border-[#2d3142]/45'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Body */}
              <div className="text-xs leading-relaxed space-y-4">
                {learnSubTab === 'concept' && (
                  <div className="space-y-3">
                    <p className="text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">{aiLearning.explanation}</p>
                    {aiLearning.real_world_analogy && aiLearning.real_world_analogy !== 'N/A' && (
                      <div className="bg-indigo-50/50 dark:bg-[#0f121d] border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-4 space-y-2">
                        <h5 className="font-bold text-[10px] text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
                          <Info className="w-3.5 h-3.5" />
                          <span>Analogy</span>
                        </h5>
                        <p className="text-slate-700 dark:text-slate-300 italic font-semibold leading-relaxed">
                          "{aiLearning.real_world_analogy}"
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {learnSubTab === 'why' && (
                  <div className="space-y-2">
                    <h5 className="font-bold text-[10px] text-slate-500 uppercase tracking-wider">Why it exists in K8s</h5>
                    <p className="text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">{aiLearning.why_it_exists}</p>
                  </div>
                )}
                {learnSubTab === 'gotchas' && (
                  <div className="space-y-3">
                    {aiLearning.common_gotchas && aiLearning.common_gotchas.length > 0 && aiLearning.common_gotchas[0] !== 'N/A' ? (
                      <>
                        <h5 className="font-bold text-[10px] text-amber-600 dark:text-amber-500 uppercase tracking-wider">Gotchas to Avoid</h5>
                        <div className="space-y-2">
                          {aiLearning.common_gotchas.map((gotcha: string, idx: number) => (
                            <div key={idx} className="flex items-start space-x-2.5 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-slate-700 dark:text-slate-300">
                              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                              <span className="text-xs font-semibold leading-relaxed">{gotcha}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4 text-slate-500 font-semibold">No common gotchas identified.</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {aiLearningLoading && (
        <div className="flex-1 flex items-start justify-center pt-8">
          <div className="flex items-center space-x-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] shadow-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="border-t border-slate-200 dark:border-[#1b2332] bg-white dark:bg-[#0d1117] p-4">
        <div className="max-w-2xl mx-auto flex items-center bg-slate-100 dark:bg-[#111820] border border-slate-200 dark:border-[#1b2332] rounded-xl px-4 py-2 shadow-sm focus-within:ring-1 focus-within:ring-cyan-500 transition">
          <input
            type="text"
            placeholder="Ask Poddy about Kubernetes..."
            value={learnQuery}
            onChange={(e) => setLearnQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleLearnQuery(''); }}
            className="bg-transparent text-sm text-slate-800 dark:text-slate-200 border-none outline-none focus:outline-none focus:ring-0 flex-grow font-medium"
          />
          <button
            onClick={() => handleLearnQuery('')}
            disabled={aiLearningLoading || !learnQuery.trim()}
            className="w-9 h-9 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white flex items-center justify-center transition cursor-pointer disabled:cursor-not-allowed shrink-0"
          >
            {aiLearningLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
