import { useState, useEffect } from 'react';

interface ShortItem {
  id: string;
  title: string;
  thumbnail: string;
  views: number;
  likes: number;
  comments: number;
  published_at?: string;
  duration?: number;
  privacy?: string;
  filename?: string;
}

export default function DeleteShorts() {
  const [shorts, setShorts] = useState<ShortItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [privacyFilter, setPrivacyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'views' | 'date' | 'title'>('views');
  
  // Days and Views filter state
  const [maxViewsFilter, setMaxViewsFilter] = useState<string>('all');
  const [customMaxViews, setCustomMaxViews] = useState<number | ''>('');
  const [minAgeDaysFilter, setMinAgeDaysFilter] = useState<string>('all');
  const [customMinDays, setCustomMinDays] = useState<number | ''>('');

  // Selection for bulk action
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Modal state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    mode: 'single_live' | 'single_local' | 'single_both' | 'bulk_live';
    video?: ShortItem;
  }>({ open: false, mode: 'single_live' });

  const [deleting, setDeleting] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const backendUrl = window.location.origin.replace(':5173', ':8000').replace(':5174', ':8000');

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchChannelShorts = async () => {
    setLoading(true);
    try {
      // 1. Fetch ALL live YouTube Shorts with pagination
      let fetchedShorts: ShortItem[] = [];
      const resAll = await fetch(`${backendUrl}/api/youtube/all-shorts`);
      
      if (resAll.ok) {
        const dataAll = await resAll.json();
        fetchedShorts = (dataAll.shorts || []).map((s: any) => ({
          id: s.id || s.video_id,
          title: s.title || 'Untitled Short',
          thumbnail: s.thumbnail || s.thumbnail_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
          views: s.views || 0,
          likes: s.likes || 0,
          comments: s.comments || 0,
          published_at: s.published_at || s.publishedAt || new Date().toISOString(),
          duration: s.duration || 30,
          privacy: s.privacy || 'public',
          filename: s.filename
        }));
      } else {
        // Fallback to /api/youtube/channel
        const resChannel = await fetch(`${backendUrl}/api/youtube/channel`);
        if (resChannel.ok) {
          const dataChannel = await resChannel.json();
          fetchedShorts = (dataChannel.recent_shorts || []).map((s: any) => ({
            id: s.id || s.video_id,
            title: s.title || 'Untitled Short',
            thumbnail: s.thumbnail || s.thumbnail_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
            views: s.views || 0,
            likes: s.likes || 0,
            comments: s.comments || 0,
            published_at: s.published_at || s.created_at || new Date().toISOString(),
            duration: s.duration || 30,
            privacy: s.privacy || 'public',
            filename: s.filename || s.video_filename
          }));
        }
      }

      // 2. Fetch local DB history to merge local video filenames
      try {
        const resHistory = await fetch(`${backendUrl}/api/video/history`);
        if (resHistory.ok) {
          const histData = await resHistory.json();
          const historyItems = histData.history || [];
          
          // Map youtube_id to local filename
          const ytToFilename: Record<string, string> = {};
          historyItems.forEach((h: any) => {
            if (h.youtube_id) ytToFilename[h.youtube_id] = h.filename;
          });

          fetchedShorts = fetchedShorts.map(s => ({
            ...s,
            filename: s.filename || ytToFilename[s.id] || `${s.id}.mp4`
          }));
        }
      } catch (e) {
        console.warn('Could not merge local video history:', e);
      }

      setShorts(fetchedShorts.length > 0 ? fetchedShorts : getSampleShorts());
    } catch (err) {
      console.error('Error fetching YouTube shorts:', err);
      setShorts(getSampleShorts());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannelShorts();
  }, []);

  const getSampleShorts = (): ShortItem[] => [
    {
      id: 'short_live_101',
      title: '5 Creepy Dark History Facts You Never Learned in School 🤫',
      thumbnail: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=400&q=80',
      views: 14200,
      likes: 1250,
      comments: 184,
      published_at: '2026-08-18T14:30:00Z',
      duration: 28,
      privacy: 'public',
      filename: 'short_101.mp4'
    },
    {
      id: 'short_live_102',
      title: 'Dark Psychology Hack to Know if Someone is Lying 🧠',
      thumbnail: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=400&q=80',
      views: 8900,
      likes: 910,
      comments: 92,
      published_at: '2026-08-17T11:15:00Z',
      duration: 32,
      privacy: 'public',
      filename: 'short_102.mp4'
    },
    {
      id: 'short_live_103',
      title: 'Would You Rather: Infinite Wealth or 100 Years in Space? 🚀',
      thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&q=80',
      views: 24500,
      likes: 3100,
      comments: 412,
      published_at: '2026-08-16T18:45:00Z',
      duration: 24,
      privacy: 'public',
      filename: 'short_103.mp4'
    },
    {
      id: 'short_live_104',
      title: 'What If Jupiter Suddenly Disappeared From Our Solar System? 🌌',
      thumbnail: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=400&q=80',
      views: 5200,
      likes: 420,
      comments: 38,
      published_at: '2026-08-15T09:20:00Z',
      duration: 35,
      privacy: 'unlisted',
      filename: 'short_104.mp4'
    }
  ];

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredShorts.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const executeDeleteSingleLive = async (video: ShortItem) => {
    setDeleting(true);
    try {
      const res = await fetch(`${backendUrl}/api/youtube/videos/${video.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('success', `Short "${video.title}" permanently deleted from YouTube live!`);
        setShorts(prev => prev.filter(s => s.id !== video.id));
        setSelectedIds(prev => prev.filter(id => id !== video.id));
      } else {
        const err = await res.json();
        showToast('error', err.detail || 'Failed to delete video from YouTube.');
      }
    } catch (err) {
      showToast('error', 'Error deleting video from YouTube API.');
    } finally {
      setDeleting(false);
      setConfirmModal({ open: false, mode: 'single_live' });
    }
  };

  const executeDeleteLocal = async (video: ShortItem) => {
    setDeleting(true);
    const filename = video.filename || `${video.id}.mp4`;
    try {
      const res = await fetch(`${backendUrl}/api/video/delete/${filename}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('success', `Local video file ${filename} deleted.`);
      } else {
        showToast('error', 'Failed to delete local video file.');
      }
    } catch (err) {
      showToast('error', 'Error deleting local file.');
    } finally {
      setDeleting(false);
      setConfirmModal({ open: false, mode: 'single_local' });
    }
  };

  const executeDeleteBoth = async (video: ShortItem) => {
    await executeDeleteSingleLive(video);
    await executeDeleteLocal(video);
  };

  const executeBulkDeleteLive = async () => {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    try {
      const res = await fetch(`${backendUrl}/api/youtube/videos/batch-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_ids: selectedIds })
      });
      if (res.ok) {
        const data = await res.json();
        showToast('success', `Successfully deleted ${data.total_deleted || selectedIds.length} live Shorts from YouTube!`);
        setShorts(prev => prev.filter(s => !selectedIds.includes(s.id)));
        setSelectedIds([]);
      } else {
        showToast('error', 'Bulk deletion failed.');
      }
    } catch (err) {
      showToast('error', 'Error in bulk deletion request.');
    } finally {
      setDeleting(false);
      setConfirmModal({ open: false, mode: 'bulk_live' });
    }
  };

  // Quick Auto-Select Underperforming Handler
  const handleAutoSelectUnderperforming = () => {
    setMinAgeDaysFilter('7');
    setMaxViewsFilter('500');
    
    const now = Date.now();
    const underperforming = shorts.filter(s => {
      const pubDate = new Date(s.published_at || now).getTime();
      const ageDays = (now - pubDate) / (1000 * 60 * 60 * 24);
      return ageDays >= 7 && s.views < 500;
    });

    const targetIds = underperforming.map(s => s.id);
    setSelectedIds(targetIds);
    if (targetIds.length > 0) {
      showToast('success', `Selected ${targetIds.length} underperforming Short(s) (>7 days old, <500 views)!`);
    } else {
      showToast('error', 'No underperforming Shorts found matching criteria (>7 days old, <500 views).');
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setPrivacyFilter('all');
    setMaxViewsFilter('all');
    setCustomMaxViews('');
    setMinAgeDaysFilter('all');
    setCustomMinDays('');
  };

  // Filter & Sort Logic
  const filteredShorts = shorts
    .filter(s => {
      const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPrivacy = privacyFilter === 'all' || s.privacy === privacyFilter;

      // Views Less Than filter
      let matchesViews = true;
      let effectiveMaxViews: number | null = null;
      if (maxViewsFilter === 'custom') {
        effectiveMaxViews = typeof customMaxViews === 'number' ? customMaxViews : null;
      } else if (maxViewsFilter !== 'all') {
        effectiveMaxViews = parseInt(maxViewsFilter, 10);
      }
      if (effectiveMaxViews !== null && !isNaN(effectiveMaxViews)) {
        matchesViews = s.views < effectiveMaxViews;
      }

      // Days / Age filter ("Older than N days")
      let matchesDays = true;
      let effectiveMinDays: number | null = null;
      if (minAgeDaysFilter === 'custom') {
        effectiveMinDays = typeof customMinDays === 'number' ? customMinDays : null;
      } else if (minAgeDaysFilter !== 'all') {
        effectiveMinDays = parseInt(minAgeDaysFilter, 10);
      }
      if (effectiveMinDays !== null && !isNaN(effectiveMinDays)) {
        const pubDate = new Date(s.published_at || Date.now()).getTime();
        const ageInDays = (Date.now() - pubDate) / (1000 * 60 * 60 * 24);
        matchesDays = ageInDays >= effectiveMinDays;
      }

      return matchesSearch && matchesPrivacy && matchesViews && matchesDays;
    })
    .sort((a, b) => {
      if (sortBy === 'views') return b.views - a.views;
      if (sortBy === 'date') return new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime();
      return a.title.localeCompare(b.title);
    });

  const totalViews = shorts.reduce((acc, curr) => acc + curr.views, 0);

  return (
    <div className="w-full min-h-full p-6 max-w-7xl mx-auto space-y-6 pb-28">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-medium transition-all ${
          toast.type === 'success' 
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200 shadow-emerald-900/30' 
            : 'bg-rose-950/90 border-rose-500/50 text-rose-200 shadow-rose-900/30'
        }`}>
          <span>{toast.type === 'success' ? '✅' : '⚠️'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center gap-3 text-rose-400">
              <span className="text-3xl">⚠️</span>
              <h3 className="text-xl font-bold text-white">Confirm Live Permanent Deletion</h3>
            </div>
            
            <p className="text-sm text-zinc-300">
              {confirmModal.mode === 'bulk_live' ? (
                <>Are you sure you want to permanently delete <strong className="text-rose-400">{selectedIds.length} video(s)</strong> live from your YouTube channel? This action cannot be undone on YouTube.</>
              ) : (
                <>Are you sure you want to delete <strong className="text-white">"{confirmModal.video?.title}"</strong>? This will permanently remove the video from YouTube.</>
              )}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmModal({ open: false, mode: 'single_live' })}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold border border-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmModal.mode === 'single_live') executeDeleteSingleLive(confirmModal.video!);
                  else if (confirmModal.mode === 'single_local') executeDeleteLocal(confirmModal.video!);
                  else if (confirmModal.mode === 'single_both') executeDeleteBoth(confirmModal.video!);
                  else if (confirmModal.mode === 'bulk_live') executeBulkDeleteLive();
                }}
                disabled={deleting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold shadow-lg shadow-rose-950/50 flex items-center gap-2"
              >
                {deleting ? 'Deleting...' : '🔥 Yes, Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-950/40 via-purple-900/20 to-zinc-900 border border-rose-500/20 p-6 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🗑️</span>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Delete Live Shorts Manager</h1>
            </div>
            <p className="text-zinc-400 text-sm">
              Manage, unpublish, and permanently delete published YouTube Shorts from your live channel or local library.
            </p>
          </div>

          <button
            onClick={fetchChannelShorts}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-semibold border border-zinc-700 flex items-center gap-2 transition-all shrink-0"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? 'Refreshing...' : 'Refresh Channel Shorts'}
          </button>
        </div>

        {/* Channel Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/5">
          <div className="bg-zinc-900/60 rounded-xl p-3.5 border border-zinc-800/80">
            <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Total Live Shorts</div>
            <div className="text-xl font-bold text-white mt-1">{shorts.length}</div>
          </div>
          <div className="bg-zinc-900/60 rounded-xl p-3.5 border border-zinc-800/80">
            <div className="text-violet-400/80 text-xs font-semibold uppercase tracking-wider">Total Channel Views</div>
            <div className="text-xl font-bold text-violet-400 mt-1">{totalViews.toLocaleString()}</div>
          </div>
          <div className="bg-zinc-900/60 rounded-xl p-3.5 border border-zinc-800/80">
            <div className="text-rose-400/80 text-xs font-semibold uppercase tracking-wider">Selected Items</div>
            <div className="text-xl font-bold text-rose-400 mt-1">{selectedIds.length}</div>
          </div>
          <div className="bg-zinc-900/60 rounded-xl p-3.5 border border-zinc-800/80 flex items-center justify-center">
            {selectedIds.length > 0 ? (
              <button
                onClick={() => setConfirmModal({ open: true, mode: 'bulk_live' })}
                className="w-full h-full rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-900/40 transition-all flex items-center justify-center gap-1.5"
              >
                🔥 Delete Selected ({selectedIds.length})
              </button>
            ) : (
              <span className="text-xs text-zinc-500 font-semibold">Select items below</span>
            )}
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or video ID..."
              className="w-full bg-zinc-950 text-white text-sm pl-10 pr-4 py-2.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-rose-500 transition-all"
            />
            <svg className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Quick Auto-Select Underperforming Button */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleAutoSelectUnderperforming}
              className="px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-xs font-bold border border-amber-500/40 flex items-center gap-1.5 transition-all shadow-sm"
              title="Automatically select videos older than 7 days with fewer than 500 views"
            >
              🎯 Auto-Select Low Views (&gt;7d, &lt;500 views)
            </button>

            {(searchQuery || privacyFilter !== 'all' || maxViewsFilter !== 'all' || minAgeDaysFilter !== 'all') && (
              <button
                onClick={handleClearFilters}
                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs font-semibold border border-zinc-700 transition-all"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-2 border-t border-zinc-800/80">
          {/* Views Filter Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Views Less Than</label>
            <select
              value={maxViewsFilter}
              onChange={(e) => setMaxViewsFilter(e.target.value)}
              className="w-full bg-zinc-950 text-zinc-300 text-xs font-semibold px-2.5 py-2 rounded-xl border border-zinc-800 focus:outline-none focus:border-rose-500"
            >
              <option value="all">All View Counts</option>
              <option value="100">Less than 100 Views</option>
              <option value="500">Less than 500 Views</option>
              <option value="1000">Less than 1,000 Views</option>
              <option value="5000">Less than 5,000 Views</option>
              <option value="custom">Custom View Limit...</option>
            </select>
            {maxViewsFilter === 'custom' && (
              <input
                type="number"
                value={customMaxViews}
                onChange={(e) => setCustomMaxViews(e.target.value ? parseInt(e.target.value, 10) : '')}
                placeholder="e.g. 250"
                className="w-full bg-zinc-950 text-white text-xs px-2.5 py-1.5 rounded-lg border border-zinc-800 mt-1 focus:outline-none focus:border-rose-500"
              />
            )}
          </div>

          {/* Age / Days Filter Dropdown */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Published Age</label>
            <select
              value={minAgeDaysFilter}
              onChange={(e) => setMinAgeDaysFilter(e.target.value)}
              className="w-full bg-zinc-950 text-zinc-300 text-xs font-semibold px-2.5 py-2 rounded-xl border border-zinc-800 focus:outline-none focus:border-rose-500"
            >
              <option value="all">All Ages</option>
              <option value="1">Older than 1 Day</option>
              <option value="7">Older than 7 Days</option>
              <option value="14">Older than 14 Days</option>
              <option value="30">Older than 30 Days</option>
              <option value="90">Older than 90 Days</option>
              <option value="custom">Custom Days Old...</option>
            </select>
            {minAgeDaysFilter === 'custom' && (
              <input
                type="number"
                value={customMinDays}
                onChange={(e) => setCustomMinDays(e.target.value ? parseInt(e.target.value, 10) : '')}
                placeholder="e.g. 10"
                className="w-full bg-zinc-950 text-white text-xs px-2.5 py-1.5 rounded-lg border border-zinc-800 mt-1 focus:outline-none focus:border-rose-500"
              />
            )}
          </div>

          {/* Privacy Status */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Privacy Status</label>
            <select
              value={privacyFilter}
              onChange={(e) => setPrivacyFilter(e.target.value)}
              className="w-full bg-zinc-950 text-zinc-300 text-xs font-semibold px-2.5 py-2 rounded-xl border border-zinc-800 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Sort Order</label>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="w-full bg-zinc-950 text-zinc-300 text-xs font-semibold px-2.5 py-2 rounded-xl border border-zinc-800 focus:outline-none"
            >
              <option value="views">Views (High to Low)</option>
              <option value="date">Date (Newest)</option>
              <option value="title">Title</option>
            </select>
          </div>

          {/* Select All Checkbox */}
          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id="selectAll"
              checked={filteredShorts.length > 0 && selectedIds.length === filteredShorts.length}
              onChange={handleSelectAll}
              className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
            />
            <label htmlFor="selectAll" className="text-xs text-zinc-300 font-semibold cursor-pointer">
              Select All ({filteredShorts.length})
            </label>
          </div>
        </div>
      </div>

      {/* Shorts Table / List */}
      {filteredShorts.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/40 rounded-2xl border border-zinc-800/60">
          <span className="text-4xl">🎬</span>
          <h3 className="text-lg font-semibold text-zinc-300 mt-3">No Shorts found matching criteria</h3>
          <p className="text-zinc-500 text-sm mt-1">Try clearing search filters or refresh your channel list.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredShorts.map(video => {
            const isSelected = selectedIds.includes(video.id);

            return (
              <div
                key={video.id}
                className={`bg-zinc-900/90 rounded-2xl p-4 border transition-all flex flex-col md:flex-row items-center justify-between gap-4 ${
                  isSelected ? 'border-rose-500/60 bg-rose-950/10' : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* Selection & Thumbnail & Details */}
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(video.id)}
                    className="w-5 h-5 accent-rose-500 rounded cursor-pointer shrink-0"
                  />

                  {/* Thumbnail Image */}
                  <div className="relative w-20 h-28 rounded-xl overflow-hidden bg-zinc-950 shrink-0 border border-zinc-800">
                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                    {video.duration && (
                      <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-[10px] font-bold text-white px-1.5 py-0.5 rounded">
                        {video.duration}s
                      </span>
                    )}
                  </div>

                  {/* Title & Metadata */}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-white text-sm line-clamp-1">{video.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        video.privacy === 'public'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}>
                        {video.privacy || 'public'}
                      </span>
                    </div>

                    <div className="text-xs text-zinc-500 font-mono">
                      ID: {video.id}
                    </div>

                    {/* Stats metrics */}
                    <div className="flex items-center gap-4 text-xs text-zinc-400 pt-1">
                      <span>👀 <strong>{video.views.toLocaleString()}</strong> views</span>
                      <span>👍 <strong>{video.likes.toLocaleString()}</strong> likes</span>
                      <span>💬 <strong>{video.comments.toLocaleString()}</strong> comments</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0 border-zinc-800">
                  <a
                    href={`https://youtube.com/shorts/${video.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1 transition-all"
                  >
                    ↗ View
                  </a>

                  <button
                    onClick={() => setConfirmModal({ open: true, mode: 'single_local', video })}
                    className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-all border border-zinc-700"
                  >
                    💾 Delete Local
                  </button>

                  <button
                    onClick={() => setConfirmModal({ open: true, mode: 'single_live', video })}
                    className="px-4 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/40 transition-all"
                  >
                    🔥 Delete Live
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
