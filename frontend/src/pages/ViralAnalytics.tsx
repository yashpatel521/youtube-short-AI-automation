import { useState } from 'react';
import PageShell from '../components/PageShell';

interface AnalyticsSuggestion {
  title: string;
  concept: string;
  hook: string;
  pexels_query: string;
  rationale: string;
  predicted_virality_score: number;
}

interface AnalyticsReport {
  top_performing_topics: string[];
  success_factors: string[];
  optimum_duration_range: string;
  growth_tips: string[];
  suggestions: AnalyticsSuggestion[];
}

interface ViralAnalyticsProps {
  backendUrl: string;
  channelData: any;
  onNavigate: (tab: any) => void;
  youtubeAuthenticated?: boolean;
}

export default function ViralAnalytics({ backendUrl, channelData, onNavigate }: ViralAnalyticsProps) {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const getPayload = () => {
    const storedSecrets = localStorage.getItem('settings_keys');
    let geminiKey = '';
    if (storedSecrets) {
      try {
        const parsed = JSON.parse(storedSecrets);
        geminiKey = parsed.gemini_api_key || '';
      } catch {}
    }

    return {
      gemini_key: geminiKey,
      previous_shorts: channelData?.recent_shorts || []
    };
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setReport(null);

    const payload = getPayload();

    try {
      const res = await fetch(`${backendUrl}/api/video/analyze-shorts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setReport(data);
      } else {
        const errData = await res.json();
        setError(errData.detail || 'Failed to analyze channel statistics.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend API.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoPost = async (idea: AnalyticsSuggestion) => {
    setToast({ message: `Queuing auto-generation & upload for: "${idea.title}"...`, type: 'success' });
    try {
      const res = await fetch(`${backendUrl}/api/video/viral-ideas/auto-generate-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt_query: idea.pexels_query,
          idea_title: idea.title
        })
      });

      if (res.ok) {
        setToast({
          message: `Successfully queued: "${idea.title}". Check progress in the Active Queue tab!`,
          type: 'success'
        });
        setTimeout(() => setToast(null), 6000);
      } else {
        const data = await res.json();
        setToast({ message: data.detail || 'Failed to queue automatic publishing.', type: 'error' });
        setTimeout(() => setToast(null), 6000);
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Connection to backend failed.', type: 'error' });
      setTimeout(() => setToast(null), 6000);
    }
  };

  const handleManualEdit = (prompt: string) => {
    sessionStorage.setItem('generator_prompt', prompt);
    onNavigate('generator');
  };

  const getScoreColorClass = (score: number) => {
    if (score >= 90) return 'text-rose-400 bg-rose-500/10 border-rose-500/25';
    if (score >= 75) return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
    return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
  };

  const recentShorts = channelData?.recent_shorts || [];

  return (
    <PageShell title="AI Viral Analytics Lab">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        
        {/* Connection Notice / Setup banner if no channelData */}
        {!channelData && (
          <div className="glass-panel p-8 text-center flex flex-col items-center gap-4 border-dashed border-white/10 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-2xl">
              📊
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">No Channel Data Available</h3>
              <p className="text-sm text-zinc-400 max-w-md mx-auto">
                Please connect your YouTube channel in Settings or go to the Dashboard to activate Demo Data so the AI can analyze your previous uploads.
              </p>
            </div>
            <button onClick={() => onNavigate('dashboard')} className="btn-primary py-2 px-5 text-xs font-bold">
              Go to Dashboard
            </button>
          </div>
        )}

        {channelData && (
          <>
            {/* Header Analysis Controller */}
            <div className="glass-panel p-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-col gap-1.5 text-center md:text-left">
                <h2 className="text-xl font-extrabold text-white flex items-center gap-2 justify-center md:justify-start">
                  <span>📊 Predict Viral Performance</span>
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold">
                    PREDICTIVE MODEL ACTIVE
                  </span>
                </h2>
                <p className="text-sm text-zinc-400">
                  Currently analyzing <strong>{recentShorts.length}</strong> recent uploads from <strong>{channelData.title}</strong>.
                </p>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="btn-primary py-3 px-6 font-bold shadow-lg shadow-violet-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shrink-0"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Analyzing Metrics...
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    Run Virality Analysis
                  </>
                )}
              </button>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                <strong>Analysis Failed:</strong> {error}
              </div>
            )}

            {/* Display Report once loaded */}
            {report ? (
              <div className="flex flex-col gap-6 animate-slide-up">
                
                {/* Insights Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Topics Card */}
                  <div className="glass-panel p-6 border-violet-500/10 bg-gradient-to-br from-violet-500/[0.02] to-transparent">
                    <h3 className="text-sm font-extrabold text-violet-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span>🏷️ Top Performing Topics</span>
                    </h3>
                    <ul className="flex flex-col gap-2.5">
                      {report.top_performing_topics.map((topic, i) => (
                        <li key={i} className="text-sm text-zinc-200 flex items-start gap-2 leading-relaxed">
                          <span className="text-violet-400 mt-1 font-bold">#</span>
                          {topic}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Success Factors */}
                  <div className="glass-panel p-6 border-cyan-500/10 bg-gradient-to-br from-cyan-500/[0.02] to-transparent">
                    <h3 className="text-sm font-extrabold text-cyan-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span>🔥 Success Denominators</span>
                    </h3>
                    <ul className="flex flex-col gap-2.5">
                      {report.success_factors.map((factor, i) => (
                        <li key={i} className="text-xs text-zinc-300 flex items-start gap-2 leading-relaxed">
                          <span className="text-cyan-400 mt-0.5 font-bold">✓</span>
                          {factor}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Growth Tips */}
                  <div className="glass-panel p-6 border-pink-500/10 bg-gradient-to-br from-pink-500/[0.02] to-transparent flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-extrabold text-pink-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span>💡 Channel Retention Tips</span>
                      </h3>
                      <ul className="flex flex-col gap-2">
                        {report.growth_tips.map((tip, i) => (
                          <li key={i} className="text-xs text-zinc-300 flex items-start gap-2 leading-relaxed">
                            <span className="text-pink-400 mt-0.5">•</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
                      <span className="text-zinc-500 font-bold uppercase">Optimal Duration:</span>
                      <span className="text-pink-400 font-extrabold font-mono bg-pink-500/5 px-2.5 py-1 rounded-full border border-pink-500/10">
                        ⏱️ {report.optimum_duration_range}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Viral Suggestions Section */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                    <span className="w-1.5 h-5 rounded-full bg-violet-500 inline-block" />
                    Tailored Predictive Shorts suggestions
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {report.suggestions.map((suggestion, index) => {
                      const badgeClass = getScoreColorClass(suggestion.predicted_virality_score);
                      return (
                        <div 
                          key={index} 
                          className="glass-panel p-5 bg-[#111114]/65 hover:border-violet-500/30 transition-all duration-300 flex flex-col justify-between gap-5 relative group"
                        >
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-extrabold bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2.5 py-0.5 rounded uppercase font-mono">
                                Viral Predict #{index + 1}
                              </span>
                              
                              {/* Predicted Virality Score Gauge */}
                              <div className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${badgeClass}`} title="Virality Index Score">
                                {suggestion.predicted_virality_score}% Virality
                              </div>
                            </div>

                            <h4 className="text-[0.95rem] font-black text-gray-100 group-hover:text-violet-400 transition-colors leading-snug">
                              {suggestion.title}
                            </h4>
                            
                            <div className="flex flex-col gap-2 text-xs">
                              <p className="text-zinc-400 leading-relaxed">
                                <strong className="text-zinc-300">Hook (0-2s):</strong> "{suggestion.hook}"
                              </p>
                              <p className="text-zinc-500 leading-relaxed">
                                <strong className="text-zinc-300">Concept:</strong> {suggestion.concept}
                              </p>
                            </div>

                            <div className="p-3 bg-black/35 rounded-xl text-[11px] text-emerald-300/90 border-l-2 border-emerald-500 leading-relaxed font-medium">
                              <strong>Why it will go viral:</strong> {suggestion.rationale}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleManualEdit(suggestion.pexels_query)}
                              className="btn-secondary flex-1 py-2 text-[10px] font-extrabold justify-center border border-white/5 hover:border-violet-500/30"
                            >
                              Manual Edit
                            </button>
                            <button
                              onClick={() => handleAutoPost(suggestion)}
                              className="btn-primary flex-1 py-2 text-[10px] font-extrabold justify-center bg-gradient-to-r from-violet-600 to-pink-600 hover:shadow-violet-500/15"
                            >
                              ⚡ Auto Post
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-panel p-20 flex flex-col items-center text-center gap-4 border-dashed border-white/10 select-none">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-3xl">
                  📉
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Analytics Dashboard Empty</h3>
                  <p className="text-sm text-zinc-400 max-w-sm mx-auto">
                    Click "Run Virality Analysis" to parse your upload history and generate custom predictive Shorts suggestions.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Toast notifications */}
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
            <div className={`glass-panel p-4 pr-12 rounded-2xl border flex items-center gap-3 shadow-2xl max-w-sm ${toast.type === 'error' ? 'border-red-500/25 bg-red-950/20 text-red-300' : 'border-violet-500/25 bg-violet-950/20 text-violet-300'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${toast.type === 'error' ? 'bg-red-500/10' : 'bg-violet-500/10'}`}>
                {toast.type === 'error' ? '⚠️' : '⚡'}
              </div>
              <div className="text-xs font-semibold leading-relaxed">{toast.message}</div>
              <button 
                onClick={() => setToast(null)}
                className="absolute top-3 right-3 text-gray-400 hover:text-white cursor-pointer bg-transparent border-0 text-[10px]"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
