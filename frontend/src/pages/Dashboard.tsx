import React from 'react';
import PageShell from '../components/PageShell';

interface ShortVideo {
  id: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string;
  duration: number;
  category_name?: string;
  upload_status?: string;
  rejection_reason?: string;
  region_restricted?: boolean;
  licensed_content?: boolean;
}

interface DashboardProps {
  channelData: any;
  loading: boolean;
  onRefresh: () => void;
  onNavigate: (tab: 'dashboard' | 'generator' | 'settings') => void;
  youtubeAuthenticated: boolean;
  onLoadDemo: (data: any) => void;
  backendUrl: string;
  onStartPosting: (idea: any) => void;
}

/* ── Animated Counter Hook ── */
function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = React.useState(0);
  React.useEffect(() => {
    if (!target) { setValue(0); return; }
    let start = 0;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      start = Math.floor(eased * target);
      setValue(start);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return value;
}

/* ── SVG Icons ── */
const Icons = {
  subscribers: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  views: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  uploads: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  trophy: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 22V10" /><path d="M14 22V10" /><path d="M8 6a6 6 0 1 0 12 0H4" />
    </svg>
  ),
  sparkle: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
    </svg>
  ),
  create: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  library: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  compete: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  arrow: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  play: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  link: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  refresh: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
};

/* ── Helper: Decorative Wave SVG ── */
function TrendWave({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 80 24" fill="none" className="w-16 h-5 opacity-40" preserveAspectRatio="none">
      <path d={`M0 18 Q10 6 20 14 T40 10 T60 16 T80 8`} stroke={color} strokeWidth="2" fill="none" />
    </svg>
  );
}

export default function Dashboard({ channelData, loading, onRefresh, onNavigate, youtubeAuthenticated, onLoadDemo, backendUrl, onStartPosting }: DashboardProps) {
  const [history, setHistory] = React.useState<any[]>([]);
  const [currentPage, setCurrentPage] = React.useState(1);

  React.useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${backendUrl}/api/video/history`);
        if (res.ok) {
          const data = await res.json();
          setHistory(data.history || []);
        }
      } catch (err) {
        console.error('Error fetching history:', err);
      }
    };
    fetchHistory();
  }, [backendUrl, channelData]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [history.length]);

  const itemsPerPage = 5;
  const totalPages = Math.ceil(history.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedHistory = history.slice(startIndex, startIndex + itemsPerPage);
  
  const calculateEngagement = (likes: number, comments: number, views: number) => {
    if (!views) return 0;
    return ((likes + comments) / views) * 100;
  };

  const getEngagementBadge = (rate: number) => {
    if (rate >= 5) return { cls: 'badge-green', label: `${rate.toFixed(1)}% 🔥` };
    if (rate >= 2) return { cls: 'badge-amber', label: `${rate.toFixed(1)}%` };
    return { cls: 'badge-red', label: `${rate.toFixed(1)}%` };
  };

  const getCopyrightStatusBadge = (video: ShortVideo) => {
    if (video.upload_status === 'failed' || video.upload_status === 'rejected') {
      return (
        <span className="badge badge-red uppercase tracking-wider font-extrabold text-[9px] flex items-center gap-1">
          ❌ Rejected ({video.rejection_reason || 'Unknown'})
        </span>
      );
    }
    if (video.rejection_reason === 'copyright') {
      return (
        <span className="badge badge-red uppercase tracking-wider font-extrabold text-[9px] flex items-center gap-1 animate-pulse">
          ⚠️ Copyright Claim
        </span>
      );
    }
    if (video.region_restricted) {
      return (
        <span className="badge badge-amber uppercase tracking-wider font-extrabold text-[9px] flex items-center gap-1">
          ⚠️ Region Block
        </span>
      );
    }
    if (video.licensed_content) {
      return (
        <span className="badge badge-violet uppercase tracking-wider font-extrabold text-[9px] flex items-center gap-1">
          ℹ️ Partner Claim
        </span>
      );
    }
    return (
      <span className="badge badge-green uppercase tracking-wider font-extrabold text-[9px] flex items-center gap-1">
        ✅ Clear
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  // Find best performing video by views
  const getBestPerformingVideo = (shorts: ShortVideo[]) => {
    if (!shorts || shorts.length === 0) return null;
    return [...shorts].sort((a, b) => b.views - a.views)[0];
  };

  const [suggestions, setSuggestions] = React.useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = React.useState(false);

  const fetchSuggestions = async () => {
    setSuggestionsLoading(true);
    try {
      const storedSecrets = localStorage.getItem('settings_keys');
      let geminiKey = '';
      if (storedSecrets) {
        try {
          const parsed = JSON.parse(storedSecrets);
          geminiKey = parsed.gemini_api_key || '';
        } catch {}
      }

      const res = await fetch(`${backendUrl}/api/video/script/suggest-ideas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          gemini_key: geminiKey,
          previous_shorts: channelData?.recent_shorts || [],
          competitor_shorts: []
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      } else {
        console.error('Failed to generate suggestions');
      }
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleUseSuggestion = (prompt: string) => {
    sessionStorage.setItem('generator_prompt', prompt);
    onNavigate('generator');
  };

  const bestVideo = channelData?.recent_shorts ? getBestPerformingVideo(channelData.recent_shorts) : null;

  // Animated counters
  const subCount = useCountUp(channelData?.subscribers || 0);
  const viewCount = useCountUp(channelData?.views || 0);
  const videoCount = useCountUp(channelData?.video_count || 0);

  return (
    <PageShell
      title="Dashboard"
      headerActions={
        youtubeAuthenticated ? (
          <button onClick={onRefresh} className="btn-secondary text-xs py-2 px-3" disabled={loading}>
            <span className={loading ? 'animate-spin' : ''}>{Icons.refresh}</span>
            Refresh
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-6">

      {/* ━━━ Connection Banner (Unauthenticated) ━━━ */}
      {!youtubeAuthenticated && !channelData ? (
        <div className="glass-panel p-0 overflow-hidden border-dashed border-white/20">
          {/* Mesh gradient background */}
          <div className="mesh-gradient p-10 flex flex-col items-center text-center gap-5 relative">
            {/* Floating decorative dots */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-8 left-[15%] w-1 h-1 rounded-full bg-violet-400/30 animate-float" style={{ animationDelay: '0s' }} />
              <div className="absolute top-16 right-[20%] w-1.5 h-1.5 rounded-full bg-pink-400/20 animate-float" style={{ animationDelay: '0.5s' }} />
              <div className="absolute bottom-12 left-[30%] w-1 h-1 rounded-full bg-cyan-400/25 animate-float" style={{ animationDelay: '1s' }} />
              <div className="absolute bottom-8 right-[35%] w-1.5 h-1.5 rounded-full bg-violet-400/20 animate-float" style={{ animationDelay: '1.5s' }} />
              <div className="absolute top-24 left-[60%] w-1 h-1 rounded-full bg-pink-400/30 animate-float" style={{ animationDelay: '0.8s' }} />
            </div>

            {/* Icon with orbit pulse */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center animate-orbit animate-float">
              {Icons.link}
            </div>

            <div>
              <h2 className="text-2xl font-extrabold mb-2">
                <span className="shimmer-text">Link YouTube to Unlock Auto-Learning</span>
              </h2>
              <p className="text-gray-400 max-w-[520px] mx-auto text-[0.95rem] leading-relaxed">
                Connect your YouTube account so the system can automatically analyze your historical Shorts, inspect engagement metrics, and learn what drives views on your channel.
              </p>
            </div>

            <div className="flex gap-3 mt-1">
              <button onClick={() => onNavigate('settings')} className="btn-primary py-3 px-6">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                Connect YouTube Account
              </button>
              <button 
                onClick={() => {
                  const mockChannelData = {
                    title: "CodeCrafters Shorts (Demo)",
                    custom_url: "@codecrafters",
                    thumbnail: "https://images.pexels.com/photos/577585/pexels-photo-577585.jpeg?auto=compress&cs=tinysrgb&w=150",
                    subscribers: 24500,
                    views: 1845200,
                    video_count: 42,
                    recent_shorts: [
                      {
                        id: "mock1",
                        title: "3 Secrets Google Engineers Hide From You 🤫",
                        publishedAt: "2026-06-25T10:00:00Z",
                        views: 185200,
                        likes: 12400,
                        comments: 420,
                        duration: 24,
                        category_name: "Science & Technology"
                      },
                      {
                        id: "mock2",
                        title: "Why Senior Devs NEVER Use Else Statements",
                        publishedAt: "2026-06-20T10:00:00Z",
                        views: 94100,
                        likes: 6800,
                        comments: 210,
                        duration: 28,
                        category_name: "Education"
                      },
                      {
                        id: "mock3",
                        title: "Stop Using Python Lists! Use This Instead",
                        publishedAt: "2026-06-15T10:00:00Z",
                        views: 312000,
                        likes: 22400,
                        comments: 890,
                        duration: 21,
                        category_name: "Science & Technology"
                      },
                      {
                        id: "mock4",
                        title: "How I Code 10x Faster (Not ChatGPT)",
                        publishedAt: "2026-06-10T10:00:00Z",
                        views: 45100,
                        likes: 3100,
                        comments: 115,
                        duration: 26,
                        category_name: "Entertainment"
                      }
                    ]
                  };
                  onLoadDemo(mockChannelData);
                }} 
                className="btn-secondary py-3 px-6"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
                Preview with Demo Data
              </button>
            </div>
          </div>
        </div>
      ) : loading && !channelData ? (
        <div className="flex flex-col items-center justify-center py-20 gap-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center animate-orbit animate-float">
            {Icons.refresh}
          </div>
          <div className="shimmer-text text-lg font-semibold">
            Fetching Channel Analytics from YouTube API...
          </div>
          {/* Skeleton cards */}
          <div className="grid grid-cols-3 gap-4 w-full max-w-2xl mt-2">
            {[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
          </div>
        </div>
      ) : (
        <>
          {/* ━━━ Channel Hero Banner ━━━ */}
          {channelData && (
            <div className="glass-panel p-0 overflow-hidden">
              <div className="mesh-gradient p-7 flex items-center justify-between flex-wrap gap-5 relative">
                {/* Subtle shimmer overlay */}
                <div className="absolute inset-0 shimmer-bg pointer-events-none" />

                <div className="flex items-center gap-5 relative z-10">
                  {/* Animated avatar ring */}
                  <div className="relative">
                    <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-violet-500 via-pink-500 to-violet-500 animate-gradient opacity-70 blur-[1px]" />
                    <img 
                      src={channelData.thumbnail} 
                      alt={channelData.title}
                      className="w-[72px] h-[72px] rounded-full border-2 border-[#111114] relative z-10 object-cover"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-extrabold">{channelData.title}</h2>
                      {/* Verified badge */}
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#8b5cf6" className="shrink-0">
                        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <p className="text-violet-400 font-semibold text-sm mt-0.5">
                      {channelData.custom_url || `@channel_${channelData.channel_id?.substring(0,6)}`}
                    </p>
                    {/* Inline quick stats */}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1">📺 {channelData.video_count} videos</span>
                      <span className="w-1 h-1 rounded-full bg-gray-600" />
                      <span className="flex items-center gap-1">🔔 {formatNumber(channelData.subscribers)} subs</span>
                      <span className="w-1 h-1 rounded-full bg-gray-600" />
                      <span className="flex items-center gap-1">👁 {formatNumber(channelData.views)} views</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3 relative z-10">
                  <button onClick={() => onNavigate('generator')} className="btn-primary">
                    {Icons.create}
                    Create a Short
                  </button>
                  <button 
                    onClick={fetchSuggestions} 
                    className="btn-secondary font-bold text-violet-400 border-violet-500/30 hover:border-violet-500/50 hover:bg-violet-500/5"
                    disabled={suggestionsLoading}
                  >
                    {suggestionsLoading ? (
                      <span className="animate-spin">{Icons.refresh}</span>
                    ) : (
                      Icons.sparkle
                    )}
                    Suggest Next Short
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ━━━ AI Viral Idea Suggestion (Inline results drawer) ━━━ */}
          {channelData && (suggestionsLoading || suggestions.length > 0) && (
            <div className="glass-panel p-6 bg-gradient-to-br from-violet-500/5 to-pink-500/5 border-violet-500/20 relative animate-slide-up">
              {/* Close button to reset suggestions */}
              <button 
                onClick={() => { setSuggestions([]); }}
                className="absolute top-4 right-4 text-gray-500 hover:text-gray-300 hover:bg-white/5 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              >
                ✕
              </button>
              
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center text-violet-400 shrink-0 animate-sparkle">
                  {Icons.sparkle}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold mb-0.5">
                    Gemini AI Suggestions
                  </h3>
                  <p className="text-gray-400 text-xs">
                    Tailored concept ideas generated based on your channel's recent stats and historical performance.
                  </p>
                </div>
              </div>

              {suggestionsLoading && suggestions.length === 0 ? (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="rounded-xl border border-white/5 p-5 space-y-3">
                      <div className="skeleton h-5 w-20 rounded" />
                      <div className="skeleton h-4 w-full rounded" />
                      <div className="skeleton h-4 w-3/4 rounded" />
                      <div className="skeleton h-16 w-full rounded-lg" />
                      <div className="skeleton h-9 w-full rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 animate-slide-up">
                  {suggestions.map((idea: any, idx: number) => (
                    <div 
                      key={idx} 
                      className="glass-panel p-5 bg-white/[0.01] flex flex-col justify-between gap-4 hover:border-violet-500/30 transition-all duration-300 animate-slide-in"
                      style={{ animationDelay: `${idx * 100}ms` }}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-[0.65rem] font-extrabold text-white">
                            {idx + 1}
                          </span>
                          <span className="badge badge-violet uppercase tracking-widest">Idea</span>
                        </div>
                        <h4 className="text-[0.95rem] font-extrabold mb-2">{idea.title}</h4>
                        <p className="text-xs text-gray-400 mb-2.5 leading-relaxed">
                          <strong className="text-gray-300">Premise:</strong> {idea.concept}
                        </p>
                        <p className="text-xs text-gray-500 italic mb-3">
                          <strong>Hook (0–2s):</strong> "{idea.hook}"
                        </p>
                        <div className="p-3 bg-black/20 rounded-lg text-[0.78rem] text-emerald-300/80 border-l-2 border-emerald-500/40 leading-relaxed">
                          <strong className="text-emerald-400">AI Rationale:</strong> {idea.rationale}
                        </div>
                      </div>
                      <button 
                        onClick={() => onStartPosting(idea)} 
                        className="btn-primary w-full p-2.5 justify-center bg-gradient-to-r from-violet-600 to-pink-600 hover:shadow-violet-500/25"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        Start Posting
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


          {/* ━━━ Rich Metric Cards & Top Performing Spotlight Card ━━━ */}
          {channelData && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              {/* Subscribers */}
              <div className="stat-card p-6 flex flex-col justify-between min-h-[170px]">
                <div>
                  <div className="stat-watermark text-violet-500">{Icons.subscribers}</div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-violet-500" />
                    <span className="text-[0.8rem] text-gray-400 font-semibold uppercase tracking-wider">Subscribers</span>
                  </div>
                  <h3 className="text-3xl font-extrabold text-violet-400 animate-count">
                    {subCount.toLocaleString()}
                  </h3>
                </div>
                <div className="stat-trend text-gray-500 mt-4">
                  <TrendWave color="#8b5cf6" />
                  <span className="text-violet-400/60 text-[0.7rem]">Lifetime</span>
                </div>
              </div>

              {/* Views */}
              <div className="stat-card p-6 flex flex-col justify-between min-h-[170px]">
                <div>
                  <div className="stat-watermark text-cyan-500">{Icons.views}</div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-500" />
                    <span className="text-[0.8rem] text-gray-400 font-semibold uppercase tracking-wider">Total Views</span>
                  </div>
                  <h3 className="text-3xl font-extrabold text-white animate-count">
                    {viewCount.toLocaleString()}
                  </h3>
                </div>
                <div className="stat-trend text-gray-500 mt-4">
                  <TrendWave color="#06b6d4" />
                  <span className="text-cyan-400/60 text-[0.7rem]">All time</span>
                </div>
              </div>

              {/* Uploads */}
              <div className="stat-card p-6 flex flex-col justify-between min-h-[170px]">
                <div>
                  <div className="stat-watermark text-pink-500">{Icons.uploads}</div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-pink-500" />
                    <span className="text-[0.8rem] text-gray-400 font-semibold uppercase tracking-wider">Total Uploads</span>
                  </div>
                  <h3 className="text-3xl font-extrabold text-pink-400 animate-count">
                    {videoCount.toLocaleString()}
                  </h3>
                </div>
                <div className="stat-trend text-gray-500 mt-4">
                  <TrendWave color="#ec4899" />
                  <span className="text-pink-400/60 text-[0.7rem]">Videos</span>
                </div>
              </div>

              {/* Top Performing Short spotlight card */}
              {bestVideo && (
                <div className="spotlight-card p-6 flex flex-col justify-between min-h-[170px]">
                  <div>
                    <div className="stat-watermark text-amber-500 opacity-[0.03]">{Icons.trophy}</div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-[0.8rem] text-gray-400 font-semibold uppercase tracking-wider font-bold">Top Short</span>
                    </div>
                    <h4 className="text-sm font-extrabold text-white line-clamp-2 leading-snug" title={bestVideo.title}>
                      {bestVideo.title}
                    </h4>
                  </div>
                  <div className="mt-4 border-t border-white/5 pt-3 flex justify-between items-center">
                    <div>
                      <span className="text-[0.65rem] text-gray-500 block uppercase font-bold">Views</span>
                      <span className="text-sm font-extrabold text-white">{bestVideo.views.toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[0.65rem] text-gray-500 block uppercase font-bold">Engagement</span>
                      <span className="text-sm font-extrabold text-amber-400">
                        {calculateEngagement(bestVideo.likes, bestVideo.comments, bestVideo.views).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ━━━ Recent Shorts — Card Rows ━━━ */}
          {channelData?.recent_shorts && (
            <div className="glass-panel p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold flex items-center gap-2">
                  <span className="w-1.5 h-5 rounded-full bg-violet-500 inline-block" />
                  Recent Shorts Analytics
                </h3>
                <span className="text-xs text-gray-500 font-semibold">{channelData.recent_shorts.length} shorts</span>
              </div>
              
              {channelData.recent_shorts.length === 0 ? (
                <p className="text-gray-400 text-[0.95rem]">No vertical shorts found in your recent uploads.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left min-w-[800px]">
                    <thead>
                      <tr className="border-b border-white/5 text-[0.75rem] text-gray-500 font-bold uppercase tracking-wider">
                        <th className="pb-3 pt-2 font-semibold">Title</th>
                        <th className="pb-3 pt-2 font-semibold">Category</th>
                        <th className="pb-3 pt-2 font-semibold">Status / Claims</th>
                        <th className="pb-3 pt-2 font-semibold">Date</th>
                        <th className="pb-3 pt-2 font-semibold text-right">Views</th>
                        <th className="pb-3 pt-2 font-semibold text-right">Likes</th>
                        <th className="pb-3 pt-2 font-semibold text-right">Comments</th>
                        <th className="pb-3 pt-2 font-semibold text-right">Engagement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {channelData.recent_shorts.map((video: ShortVideo, idx: number) => {
                        const engRate = calculateEngagement(video.likes, video.comments, video.views);
                        const badge = getEngagementBadge(engRate);
                        return (
                          <tr 
                            key={video.id} 
                            className="hover:bg-white/[0.015] transition-colors group"
                          >
                            <td className="py-3.5 font-semibold text-[0.9rem] text-white max-w-[280px] truncate group-hover:text-violet-400 transition-colors">{video.title}</td>
                            <td className="py-3.5 text-xs text-gray-400 font-medium">{video.category_name || 'Entertainment'}</td>
                            <td className="py-3.5 font-medium">{getCopyrightStatusBadge(video)}</td>
                            <td className="py-3.5 text-gray-500 text-xs">{formatDate(video.publishedAt)}</td>
                            <td className="py-3.5 font-bold text-[0.9rem] text-right">{video.views.toLocaleString()}</td>
                            <td className="py-3.5 text-gray-400 text-sm text-right">{video.likes.toLocaleString()}</td>
                            <td className="py-3.5 text-gray-400 text-sm text-right">{video.comments.toLocaleString()}</td>
                            <td className="py-3.5 text-right">
                              <span className={`badge ${badge.cls}`}>{badge.label}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ━━━ Compilation History — Proper Table ━━━ */}
          {history.length > 0 && (
            <div className="glass-panel p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold flex items-center gap-2">
                  <span className="w-1.5 h-5 rounded-full bg-pink-500 inline-block" />
                  Compilation History
                </h3>
                <span className="text-xs text-gray-500 font-semibold">{history.length} videos</span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left min-w-[800px]">
                  <thead>
                    <tr className="border-b border-white/5 text-[0.75rem] text-gray-500 font-bold uppercase tracking-wider">
                      <th className="pb-3 pt-2 font-semibold">Title</th>
                      <th className="pb-3 pt-2 font-semibold">Date Compiled</th>
                      <th className="pb-3 pt-2 font-semibold">Filename</th>
                      <th className="pb-3 pt-2 font-semibold">YouTube Status</th>
                      <th className="pb-3 pt-2 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {paginatedHistory.map((item: any, idx: number) => (
                      <tr 
                        key={idx} 
                        className="hover:bg-white/[0.015] transition-colors group"
                      >
                        <td className="py-3.5 font-semibold text-[0.9rem] text-white max-w-[280px] truncate group-hover:text-pink-400 transition-colors">{item.title}</td>
                        <td className="py-3.5 text-gray-500 text-xs">{formatDate(item.created_at)}</td>
                        <td className="py-3.5 text-gray-500 font-mono text-[0.7rem] max-w-[180px] truncate">{item.filename}</td>
                        <td className="py-3.5">
                          {item.posted ? (
                            <a 
                              href={`https://youtube.com/watch?v=${item.youtube_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="badge badge-green hover:opacity-80 transition-opacity no-underline"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                              Posted · {item.youtube_id}
                            </a>
                          ) : (
                            <span className="badge badge-amber">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                              Ready to Post
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            onClick={() => {
                              sessionStorage.setItem('active_video_history', JSON.stringify({
                                filename: item.filename,
                                title: item.title
                              }));
                              onNavigate('generator');
                            }}
                            className="btn-ghost text-violet-400 hover:text-violet-300 text-xs font-bold p-0 inline-flex items-center gap-1"
                          >
                            Studio {Icons.arrow}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls footer */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-2 flex-wrap gap-3">
                  <span className="text-xs text-gray-500 font-medium">
                    Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, history.length)} of {history.length} compilations
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-30 disabled:pointer-events-none"
                    >
                      Previous
                    </button>

                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: totalPages }).map((_, i) => {
                        const pageNum = i + 1;
                        const isActive = pageNum === currentPage;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                              isActive
                                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/10'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-30 disabled:pointer-events-none"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
    </PageShell>
  );
}
