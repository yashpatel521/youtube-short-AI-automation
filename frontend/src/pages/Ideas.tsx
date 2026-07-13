import { useState, useEffect } from 'react';
import PageShell from '../components/PageShell';

interface ViralIdea {
  id?: number;
  title: string;
  concept: string;
  hook: string;
  rationale: string;
  prompt_query: string;
}

interface IdeasProps {
  backendUrl: string;
  channelData: any;
  onNavigate: (tab: 'dashboard' | 'generator' | 'library' | 'ideas' | 'settings') => void;
}

export default function Ideas({ backendUrl, channelData, onNavigate }: IdeasProps) {
  const [ideas, setIdeas] = useState<ViralIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleAutoGenerateAndPost = async (idea: ViralIdea) => {
    setToast({ message: `Queuing auto-generation for: "${idea.title}"...`, type: 'success' });
    try {
      const res = await fetch(`${backendUrl}/api/video/viral-ideas/auto-generate-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt_query: idea.prompt_query,
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


  const getPayload = () => {
    // Gather gemini key
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
      previous_shorts: channelData?.recent_shorts || [],
      competitor_shorts: []
    };
  };

  const fetchIdeas = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    const payload = getPayload();
    const endpoint = isRefresh 
      ? `${backendUrl}/api/video/viral-ideas/refresh` 
      : `${backendUrl}/api/video/viral-ideas`;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setIdeas(data.ideas || []);
      } else {
        const errData = await res.json();
        setError(errData.detail || 'Failed to fetch viral ideas.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend api.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchIdeas(false);
  }, [backendUrl, channelData]);

  const handleGenerateShort = (prompt: string) => {
    sessionStorage.setItem('generator_prompt', prompt);
    onNavigate('generator');
  };

  return (
    <PageShell
      title="Viral Ideas"
      headerActions={
        <button onClick={() => fetchIdeas(true)} className="btn-primary text-xs py-2 px-4" disabled={loading || refreshing}>
          {refreshing ? 'Regenerating...' : 'Load New'}
        </button>
      }
    >

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          <strong>API Error:</strong> {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-28 gap-4">
          <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Gemini is synthesizing search metadata and channel analytics...</p>
        </div>
      ) : ideas.length === 0 ? (
        <div className="glass-panel p-16 flex flex-col items-center text-center gap-5 border-dashed border-white/10">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .6 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
              <path d="M9 18h6" />
              <path d="M10 22h4" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-1">No Viral Ideas Loaded</h3>
            <p className="text-gray-400 text-sm max-w-sm">Use the refresh button at the top to query Gemini and generate a cached list of 10 ideas.</p>
          </div>
          <button onClick={() => fetchIdeas(true)} className="btn-primary">
            Generate 10 Viral Ideas
          </button>
        </div>
      ) : (
        <div className="glass-panel p-6 flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left min-w-[900px]">
              <thead>
                <tr className="border-b border-white/5 text-gray-400 font-semibold text-xs uppercase tracking-wider">
                  <th className="p-4 w-[60px] text-center">#</th>
                  <th className="p-4 w-[280px]">Short Title & Concept</th>
                  <th className="p-4 w-[240px]">Scroll-Stopping Hook (0-2s)</th>
                  <th className="p-4">AI Virality Rationale</th>
                  <th className="p-4 text-center w-[160px]">Action</th>
                </tr>
              </thead>
              <tbody>
                {ideas.map((idea, index) => (
                  <tr key={index} className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.01] transition-all">
                    <td className="p-4 text-center font-bold text-violet-400 text-sm">
                      {index + 1}
                    </td>
                    <td className="p-4 vertical-align-top">
                      <div className="font-extrabold text-sm text-gray-200 mb-1 leading-snug">
                        {idea.title}
                      </div>
                      <div className="text-xs text-gray-400 leading-relaxed font-medium">
                        {idea.concept}
                      </div>
                    </td>
                    <td className="p-4 text-xs text-violet-300 italic leading-relaxed">
                      "{idea.hook}"
                    </td>
                    <td className="p-4">
                      <div className="p-3 bg-black/20 rounded-xl text-xs text-emerald-300 border-l-2 border-emerald-500 leading-relaxed">
                        {idea.rationale}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col gap-2 items-center justify-center">
                        <button
                          onClick={() => handleGenerateShort(idea.prompt_query)}
                          className="btn-primary w-full py-1.5 px-3 text-[10px] inline-flex items-center justify-center gap-1 shadow-sm font-bold"
                          title={`Write script for: ${idea.prompt_query}`}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                          Manual Edit
                        </button>
                        
                        <button
                          onClick={() => handleAutoGenerateAndPost(idea)}
                          className="btn-secondary w-full py-1.5 px-3 text-[10px] inline-flex items-center justify-center gap-1 border border-white/10 hover:border-violet-500/30 font-bold"
                          title="Generate and post to YouTube in one click"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                          ⚡ Auto Post
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast notification overlay */}
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
    </PageShell>
  );
}
