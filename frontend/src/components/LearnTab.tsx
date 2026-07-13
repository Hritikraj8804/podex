import React from 'react';
import { Loader2, Info, AlertCircle } from 'lucide-react';

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
  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-200">

      <div className="text-center space-y-3">
        <h3 className="text-2xl font-black text-slate-800 dark:text-slate-200 m-0">Ask Podex AI Anything</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto font-bold">
          Type a Kubernetes concept, resource name, or error code. Podex will explain it using real-world analogies.
        </p>
      </div>

      {/* Chat Input query */}
      <div className="flex bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#1b2332] rounded-lg p-1.5 max-w-2xl mx-auto shadow-sm">
        <input
          type="text"
          placeholder="Explain: Port Forwarding / CrashLoopBackOff / ConfigMap..."
          value={learnQuery}
          onChange={(e) => setLearnQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleLearnQuery(''); }}
          className="bg-transparent text-sm text-slate-800 dark:text-slate-200 border-none outline-none focus:ring-0 p-3 flex-grow font-medium"
        />
        <button
          onClick={() => handleLearnQuery('')}
          disabled={aiLearningLoading}
          className="px-6 py-2.5 rounded-md bg-blue-600 hover:bg-blue-500 font-semibold text-xs text-white transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
        >
          {aiLearningLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>Explain</span>}
        </button>
      </div>

      {/* Quick suggestion tags */}
      <div className="flex flex-wrap justify-center gap-2 max-w-xl mx-auto">
        {['What is a Pod?', 'What is a Service?', 'What is Liveness Probe?', 'How does Ingress work?', 'What is CrashLoopBackOff?'].map(tag => (
          <button
            key={tag}
            onClick={() => { setLearnQuery(tag); handleLearnQuery(tag); }}
            className="px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-50 dark:bg-[#0d1117] dark:hover:bg-[#111820] border border-slate-200 dark:border-[#1b2332] text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition font-medium shadow-sm cursor-pointer"
          >
            {tag}
          </button>
        ))}
      </div>

      {/* AI Explanation Card Render */}
      {aiLearningLoading && (
        <div className="bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-[#1b2332] rounded-xl p-12 flex flex-col items-center justify-center space-y-4 max-w-2xl mx-auto shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Loading explanation...</span>
        </div>
      )}

      {aiLearning && !aiLearningLoading && (
        <div className="bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-[#1b2332] rounded-xl p-6 space-y-5 max-w-2xl mx-auto shadow-sm">

          {/* Topic Title */}
          <div className="flex items-center space-x-3 border-b border-slate-200 dark:border-[#1b2332] pb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
              ?
            </div>
            <div>
              <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-100 m-0">{aiLearning.concept}</h4>
              <span className="text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-wider block font-medium mt-0.5">AI Explanation</span>
            </div>
          </div>

          {/* Sub-tabs Selection */}
          <div className="flex bg-slate-200/50 dark:bg-[#111820] rounded-lg p-0.5 border border-slate-200 dark:border-[#1b2332] select-none">
            {([
              { id: 'concept', label: 'Concept Overview' },
              { id: 'why', label: 'Why it Exists' },
              { id: 'gotchas', label: 'Common Gotchas' }
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setLearnSubTab(tab.id)}
                className={`flex-1 py-1.5 rounded-md font-semibold text-[10px] uppercase tracking-wider transition duration-150 cursor-pointer ${learnSubTab === tab.id
                  ? 'bg-white dark:bg-[#1f2330] text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-[#2d3142]/45'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Body Sections */}
          <div className="space-y-6 text-xs leading-relaxed">

            {/* SUBTAB: CONCEPT OVERVIEW */}
            {learnSubTab === 'concept' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <h5 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider">What it is</h5>
                  <p className="text-slate-700 dark:text-slate-300 font-medium text-xs leading-relaxed">{aiLearning.explanation}</p>
                </div>

                {aiLearning.real_world_analogy && aiLearning.real_world_analogy !== 'N/A' && (
                  <div className="bg-indigo-50/50 dark:bg-[#0f121d] border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-4 space-y-2">
                    <h5 className="font-semibold text-[10px] text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <Info className="w-3.5 h-3.5" />
                      <span>Analogy for Beginners</span>
                    </h5>
                    <p className="text-slate-700 dark:text-slate-300 italic font-medium leading-relaxed">
                      "{aiLearning.real_world_analogy}"
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB: WHY IT EXISTS */}
            {learnSubTab === 'why' && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <h5 className="font-semibold text-[10px] text-slate-500 uppercase tracking-wider">Why it exists in K8s</h5>
                <p className="text-slate-700 dark:text-slate-300 font-medium text-xs leading-relaxed">{aiLearning.why_it_exists}</p>
              </div>
            )}

            {/* SUBTAB: GOTCHAS */}
            {learnSubTab === 'gotchas' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {aiLearning.common_gotchas && aiLearning.common_gotchas.length > 0 && aiLearning.common_gotchas[0] !== 'N/A' ? (
                  <div className="space-y-2">
                    <h5 className="font-bold text-[10px] text-amber-600 dark:text-amber-500 uppercase tracking-wider mb-2">Gotchas & Pitfalls to Avoid</h5>
                    <div className="space-y-2.5">
                      {aiLearning.common_gotchas.map((gotcha: string, idx: number) => (
                        <div key={idx} className="flex items-start space-x-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-slate-700 dark:text-slate-300">
                          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <span className="text-xs font-medium leading-relaxed">{gotcha}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-500 font-medium">
                    No common gotchas identified.
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
};
