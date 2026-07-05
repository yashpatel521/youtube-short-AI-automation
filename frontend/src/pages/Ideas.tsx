import { useState, useEffect } from 'react';
import Header from '../components/Header';

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
  onNavigate: (tab: 'dashboard' | 'generator' | 'library' | 'analytics' | 'ideas' | 'settings') => void;
}

export default function Ideas({ backendUrl, channelData, onNavigate }: IdeasProps) {
  const [ideas, setIdeas] = useState<ViralIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    // Gather competitor context
    let compShorts = [];
    const storedComp = sessionStorage.getItem('competitor_context');
    if (storedComp) {
      try {
        const parsed = JSON.parse(storedComp);
        compShorts = parsed.competitors || [];
      } catch {}
    }

    return {
      gemini_key: geminiKey,
      previous_shorts: channelData?.recent_shorts || [],
      competitor_shorts: compShorts
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
      ? `${backendUrl}/api/viral-ideas/refresh` 
      : `${backendUrl}/api/viral-ideas`;

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
    <div className="animate-slide-up flex flex-col gap-8">
      {/* Header component with unified stats & channel avatar */}
      <Header
        title="Viral Ideas Lab"
        description="Gemini-analyzed scroll-stopping Short concepts custom-fitted to rank for high search volume topics."
        channelData={channelData}
      >
        <button 
          onClick={() => fetchIdeas(true)}
          className="btn-primary py-2.5 px-5 text-sm"
          disabled={loading || refreshing}
        >
          {refreshing ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Regenerating List...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mr-1">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              Load New Content
            </>
          )}
        </button>
      </Header>

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
                      <button
                        onClick={() => handleGenerateShort(idea.prompt_query)}
                        className="btn-primary py-2 px-3.5 text-xs inline-flex items-center gap-1.5 shadow-sm"
                        title={`Write script for: ${idea.prompt_query}`}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        Generate Shorts
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
