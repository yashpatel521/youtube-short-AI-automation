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
}

interface DashboardProps {
  channelData: any;
  loading: boolean;
  onRefresh: () => void;
  onNavigate: (tab: 'dashboard' | 'generator' | 'analytics' | 'settings') => void;
  youtubeAuthenticated: boolean;
  onLoadDemo: (data: any) => void;
  backendUrl: string;
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

export default function Dashboard({ channelData, loading, onRefresh, onNavigate, youtubeAuthenticated, onLoadDemo, backendUrl }: DashboardProps) {
  const [history, setHistory] = React.useState<any[]>([]);

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
  
  const calculateEngagement = (likes: number, comments: number, views: number) => {
    if (!views) return 0;
    return ((likes + comments) / views) * 100;
  };

  const getEngagementBadge = (rate: number) => {
    if (rate >= 5) return { cls: 'badge-green', label: `${rate.toFixed(1)}% 🔥` };
    if (rate >= 2) return { cls: 'badge-amber', label: `${rate.toFixed(1)}%` };
    return { cls: 'badge-red', label: `${rate.toFixed(1)}%` };
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

      // Gather competitor contexts if any stored
      let compShorts: any[] = [];
      const storedComp = sessionStorage.getItem('competitor_context');
      if (storedComp) {
        try {
          const parsed = JSON.parse(storedComp);
          compShorts = parsed.competitors || [];
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
          competitor_shorts: compShorts
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
                  <button onClick={() => onNavigate('analytics')} className="btn-secondary">
                    {Icons.compete}
                    Competitor Intel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ━━━ Quick Actions Bar ━━━ */}
          {channelData && (
            <div className="grid grid-cols-3 gap-4">
              <div className="quick-action" onClick={() => onNavigate('generator')}>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-600/10 flex items-center justify-center text-violet-400 shrink-0">
                  {Icons.create}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold">Create New Short</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Script → Video → Upload</p>
                </div>
                <span className="text-gray-600">{Icons.arrow}</span>
              </div>

              <div className="quick-action" onClick={() => onNavigate('library' as any)}>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 flex items-center justify-center text-cyan-400 shrink-0">
                  {Icons.library}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold">Browse Library</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Manage generated videos</p>
                </div>
                <span className="text-gray-600">{Icons.arrow}</span>
              </div>

              <div className="quick-action" onClick={() => onNavigate('analytics')}>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-pink-500/20 to-pink-600/10 flex items-center justify-center text-pink-400 shrink-0">
                  {Icons.compete}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold">Analyze Competitors</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Spy on rival channels</p>
                </div>
                <span className="text-gray-600">{Icons.arrow}</span>
              </div>
            </div>
          )}

          {/* ━━━ Rich Metric Cards ━━━ */}
          {channelData && (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
              {/* Subscribers */}
              <div className="stat-card p-6">
                <div className="stat-watermark text-violet-500">{Icons.subscribers}</div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                  <span className="text-[0.8rem] text-gray-400 font-semibold uppercase tracking-wider">Subscribers</span>
                </div>
                <h3 className="text-3xl font-extrabold text-violet-400 animate-count">
                  {subCount.toLocaleString()}
                </h3>
                <div className="stat-trend text-gray-500">
                  <TrendWave color="#8b5cf6" />
                  <span className="text-violet-400/60 text-[0.7rem]">Lifetime</span>
                </div>
              </div>

              {/* Views */}
              <div className="stat-card p-6">
                <div className="stat-watermark text-cyan-500">{Icons.views}</div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-cyan-500" />
                  <span className="text-[0.8rem] text-gray-400 font-semibold uppercase tracking-wider">Total Views</span>
                </div>
                <h3 className="text-3xl font-extrabold text-white animate-count">
                  {viewCount.toLocaleString()}
                </h3>
                <div className="stat-trend text-gray-500">
                  <TrendWave color="#06b6d4" />
                  <span className="text-cyan-400/60 text-[0.7rem]">All time</span>
                </div>
              </div>

              {/* Uploads */}
              <div className="stat-card p-6">
                <div className="stat-watermark text-pink-500">{Icons.uploads}</div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-pink-500" />
                  <span className="text-[0.8rem] text-gray-400 font-semibold uppercase tracking-wider">Total Uploads</span>
                </div>
                <h3 className="text-3xl font-extrabold text-pink-400 animate-count">
                  {videoCount.toLocaleString()}
                </h3>
                <div className="stat-trend text-gray-500">
                  <TrendWave color="#ec4899" />
                  <span className="text-pink-400/60 text-[0.7rem]">Videos</span>
                </div>
              </div>
            </div>
          )}

          {/* ━━━ AI Viral Idea Suggestion ━━━ */}
          {channelData && (
            <div className="glass-panel p-0 overflow-hidden relative" style={{ borderImage: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(236,72,153,0.2)) 1' }}>
              <div className="p-6 mesh-gradient relative">
                <div className="flex justify-between items-center flex-wrap gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 flex items-center justify-center text-violet-400 shrink-0 animate-sparkle">
                      {Icons.sparkle}
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold mb-1">
                        Suggest Next Viral Short
                      </h3>
                      <p className="text-gray-400 text-sm max-w-[620px] m-0 leading-relaxed">
                        Let Gemini analyze your channel stats, subscribers, and high-view competitor themes to design a scroll-stopping premise for your audience.
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={fetchSuggestions} 
                    className="btn-primary py-3 px-6 font-bold" 
                    disabled={suggestionsLoading}
                  >
                    {suggestionsLoading ? (
                      <>
                        <span className="animate-spin inline-block">{Icons.refresh}</span>
                        Generating...
                      </>
                    ) : (
                      <>
                        {Icons.sparkle}
                        Suggest Next Short
                      </>
                    )}
                  </button>
                </div>

                {/* Skeleton loading state */}
                {suggestionsLoading && suggestions.length === 0 && (
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 mt-6">
                    {[1,2,3].map(i => (
                      <div key={i} className="rounded-xl border border-white/5 p-5 space-y-3">
                        <div className="skeleton h-5 w-20 rounded" />
                        <div className="skeleton h-4 w-full rounded" />
                        <div className="skeleton h-4 w-3/4 rounded" />
                        <div className="skeleton h-16 w-full rounded-lg" />
                        <div className="skeleton h-9 w-full rounded-lg" />
                      </div>
                    ))}
                  </div>
                )}

                {suggestions.length > 0 && (
                  <div className="flex flex-col gap-4 mt-6">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">AI-Generated Ideas</h4>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
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
                            onClick={() => handleUseSuggestion(idea.prompt_query)} 
                            className="btn-primary w-full p-2.5 justify-center"
                          >
                            {Icons.play}
                            Write Script for This
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ━━━ Top Performing — Spotlight Card ━━━ */}
          {bestVideo && (
            <div className="spotlight-card p-6 flex justify-between items-center flex-wrap gap-5">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0 animate-float">
                  {Icons.trophy}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="badge badge-amber uppercase tracking-widest">
                      ★ Top Performing Short
                    </span>
                  </div>
                  <h4 className="text-base font-extrabold mb-1">
                    {bestVideo.title}
                  </h4>
                  <p className="text-gray-500 text-xs">
                    Published {formatDate(bestVideo.publishedAt)} · Duration: {bestVideo.duration}s
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="stat-card px-5 py-3 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <span className="text-[0.65rem] text-gray-500 font-bold uppercase tracking-wider block">Views</span>
                  <div className="text-xl font-extrabold text-white mt-1">{bestVideo.views.toLocaleString()}</div>
                </div>
                <div className="stat-card px-5 py-3 text-center" style={{ background: 'rgba(234,179,8,0.04)' }}>
                  <span className="text-[0.65rem] text-gray-500 font-bold uppercase tracking-wider block">Engagement</span>
                  <div className="text-xl font-extrabold text-amber-400 mt-1">
                    {calculateEngagement(bestVideo.likes, bestVideo.comments, bestVideo.views).toFixed(1)}%
                  </div>
                </div>
              </div>
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
                <div className="flex flex-col gap-2">
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_120px_110px_90px_80px_80px_90px] gap-3 px-4 py-2 text-[0.7rem] text-gray-500 font-bold uppercase tracking-wider">
                    <span>Title</span>
                    <span>Category</span>
                    <span>Date</span>
                    <span className="text-right">Views</span>
                    <span className="text-right">Likes</span>
                    <span className="text-right">Comments</span>
                    <span className="text-right">Engagement</span>
                  </div>
                  {channelData.recent_shorts.map((video: ShortVideo, idx: number) => {
                    const engRate = calculateEngagement(video.likes, video.comments, video.views);
                    const badge = getEngagementBadge(engRate);
                    return (
                      <div 
                        key={video.id} 
                        className="card-row grid grid-cols-[1fr_120px_110px_90px_80px_80px_90px] gap-3 items-center animate-slide-in"
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <span className="font-semibold text-[0.9rem] truncate">{video.title}</span>
                        <span className="text-xs text-gray-400 font-medium truncate">{video.category_name || 'Entertainment'}</span>
                        <span className="text-gray-500 text-xs">{formatDate(video.publishedAt)}</span>
                        <span className="font-bold text-[0.9rem] text-right">{video.views.toLocaleString()}</span>
                        <span className="text-gray-400 text-sm text-right">{video.likes.toLocaleString()}</span>
                        <span className="text-gray-400 text-sm text-right">{video.comments.toLocaleString()}</span>
                        <span className="flex justify-end">
                          <span className={`badge ${badge.cls}`}>{badge.label}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ━━━ Compilation History — Card Rows ━━━ */}
          {history.length > 0 && (
            <div className="glass-panel p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-extrabold flex items-center gap-2">
                  <span className="w-1.5 h-5 rounded-full bg-pink-500 inline-block" />
                  Compilation History
                </h3>
                <span className="text-xs text-gray-500 font-semibold">{history.length} videos</span>
              </div>
              
              <div className="flex flex-col gap-2">
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_130px_180px_150px_100px] gap-3 px-4 py-2 text-[0.7rem] text-gray-500 font-bold uppercase tracking-wider">
                  <span>Title</span>
                  <span>Date</span>
                  <span>Filename</span>
                  <span>Status</span>
                  <span className="text-right">Actions</span>
                </div>
                {history.map((item: any, idx: number) => (
                  <div 
                    key={idx} 
                    className="card-row grid grid-cols-[1fr_130px_180px_150px_100px] gap-3 items-center animate-slide-in"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <span className="font-semibold text-[0.9rem] truncate">{item.title}</span>
                    <span className="text-gray-500 text-xs">{formatDate(item.created_at)}</span>
                    <span className="text-gray-500 font-mono text-[0.7rem] truncate">{item.filename}</span>
                    <span>
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
                    </span>
                    <span className="text-right">
                      <button
                        onClick={() => {
                          sessionStorage.setItem('active_video_history', JSON.stringify({
                            filename: item.filename,
                            title: item.title
                          }));
                          onNavigate('generator');
                        }}
                        className="btn-ghost text-violet-400 hover:text-violet-300 text-xs font-bold"
                      >
                        Studio {Icons.arrow}
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
    </PageShell>
  );
}
