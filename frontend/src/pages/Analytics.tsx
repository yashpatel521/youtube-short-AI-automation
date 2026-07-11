import React, { useState } from "react";
import PageShell from "../components/PageShell";

interface CompetitorVideo {
  id: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string;
  description: string;
  tags: string[];
}

interface AnalyticsProps {
  backendUrl: string;
  youtubeAuthenticated: boolean;
  onNavigate: (tab: 'dashboard' | 'generator' | 'library' | 'analytics' | 'ideas' | 'quality' | 'settings') => void;
}

export default function Analytics({
  backendUrl,
  youtubeAuthenticated,
  onNavigate,
}: AnalyticsProps) {
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [competitors, setCompetitors] = useState<CompetitorVideo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${backendUrl}/api/competitors?keyword=${encodeURIComponent(keyword)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setCompetitors(data.results || []);
        if (!data.results || data.results.length === 0) {
          setError(
            "No Shorts videos found for this topic. Try another keyword.",
          );
        }
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to search competitors.");
      }
    } catch (err: any) {
      setError(err.message || "Error connecting to competitor API.");
    } finally {
      setLoading(false);
    }
  };

  const calculateEngagement = (
    likes: number,
    comments: number,
    views: number,
  ) => {
    if (!views) return "0.0%";
    const rate = ((likes + comments) / views) * 100;
    return `${rate.toFixed(1)}%`;
  };

  // Compile a list of unique tags from all competitors to highlight popular keywords
  const getPopularKeywords = () => {
    const counts: { [key: string]: number } = {};
    competitors.forEach((video) => {
      if (video.tags) {
        video.tags.forEach((tag) => {
          const lower = tag.toLowerCase();
          counts[lower] = (counts[lower] || 0) + 1;
        });
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map((entry) => entry[0]);
  };

  const popularKeywords = getPopularKeywords();

  return (
    <PageShell title="Competitors">

      {!youtubeAuthenticated && (
        <div className="p-3 px-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-sm leading-relaxed mb-1">
          <strong>Public Search Mode Active:</strong> Link your YouTube channel
          in settings to unlock channel performance metrics and direct
          publishing.
        </div>
      )}

      <>
        {/* Search bar */}
        <form
          onSubmit={handleSearch}
          className="glass-panel p-6 flex gap-4 items-center"
        >
          <div className="flex-1 relative">
            <input
              type="text"
              className="form-input"
              placeholder="Enter a keyword or niche topic (e.g. 'coding hacks', 'motivational speech', 'cooking fast')"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !keyword.trim()}
          >
            {loading ? "Searching YouTube..." : "Search Competitors"}
          </button>
        </form>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="glow-active text-lg text-violet-400 font-semibold">
              Querying YouTube Shorts database and analyzing engagement
              metrics...
            </div>
          </div>
        ) : (
          competitors.length > 0 && (
            <>
              {/* Popular Keywords Bar */}
              {popularKeywords.length > 0 && (
                <div className="glass-panel p-5 flex flex-col gap-3">
                  <h3 className="text-base font-bold">
                    Trending Search Keywords (High Search Volume)
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    {popularKeywords.map((tag, idx) => (
                      <span
                        key={idx}
                        className="bg-violet-500/10 text-violet-300 border border-violet-500/30 px-3 py-1.5 rounded-full text-xs font-semibold capitalize"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Competitors List */}
              <div className="glass-panel p-6 flex flex-col gap-5">
                <h3 className="text-lg font-bold">
                  Top Performing Shorts for "{keyword}"
                </h3>

                <div className="flex flex-col gap-5">
                  {competitors.map((video, idx) => (
                    <div
                      key={video.id}
                      className="p-5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-3"
                    >
                      <div className="flex justify-between items-start flex-wrap gap-2.5">
                        <div className="flex-1">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-extrabold mr-2 ${idx === 0 ? "bg-amber-500/20 text-amber-300" : "bg-white/10 text-gray-400"}`}
                          >
                            RANK #{idx + 1}
                          </span>
                          <h4 className="text-base font-bold inline">
                            {video.title}
                          </h4>
                        </div>
                        <div className="flex gap-5">
                          <div className="text-right">
                            <div className="text-xs text-gray-500">VIEWS</div>
                            <div className="font-extrabold">
                              {video.views.toLocaleString()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-500">
                              ENGAGEMENT
                            </div>
                            <div className="font-extrabold text-violet-400">
                              {calculateEngagement(
                                video.likes,
                                video.comments,
                                video.views,
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {video.description && (
                        <p className="text-xs text-gray-400 leading-relaxed">
                          {video.description.substring(0, 150)}...
                        </p>
                      )}

                      {video.tags && video.tags.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mt-1">
                          {video.tags.slice(0, 5).map((t, index) => (
                            <span key={index} className="text-xs text-gray-500">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Suggestions Callout */}
              <div className="glass-panel p-6 bg-gradient-to-br from-violet-500/10 to-pink-500/5 border border-violet-500/20 flex justify-between items-center flex-wrap gap-5">
                <div>
                  <h3 className="text-lg font-bold mb-1.5">
                    Ready to generate next viral Short?
                  </h3>
                  <p className="text-sm text-gray-400 max-w-xl">
                    We can export this competitor metadata (views, tags,
                    structures) and pass it directly to Gemini to write an
                    optimized script with high-performing hooks.
                  </p>
                </div>
                <button
                  onClick={() => {
                    // Store competitor context in sessionStorage to retrieve on the Generator page
                    sessionStorage.setItem(
                      "competitor_context",
                      JSON.stringify({
                        topic: keyword,
                        competitors: competitors.slice(0, 5).map((v) => ({
                          title: v.title,
                          views: v.views,
                          description: v.description,
                          tags: v.tags,
                        })),
                      }),
                    );
                    // Navigate
                    onNavigate('generator');
                  }}
                  className="btn-primary self-center"
                >
                  Send to Video Studio
                </button>
              </div>
            </>
          )
        )}
      </>
    </PageShell>
  );
}
