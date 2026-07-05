import React, { useState, useEffect } from 'react';
import Header from '../components/Header';

interface HistoryItem {
  id: number;
  filename: string;
  title: string;
  created_at: string;
  posted: boolean;
  youtube_id: string | null;
}

interface LibraryProps {
  backendUrl: string;
  youtubeAuthenticated: boolean;
  onNavigate: (tab: 'dashboard' | 'generator' | 'library' | 'analytics' | 'ideas' | 'settings') => void;
  channelData?: any;
}

export default function Library({ backendUrl, youtubeAuthenticated, onNavigate, channelData }: LibraryProps) {
  const [videos, setVideos] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePreview, setActivePreview] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
  // Upload Modal States
  const [uploadVideo, setUploadVideo] = useState<HistoryItem | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadPrivacy, setUploadPrivacy] = useState('private');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/video/history`);
      if (res.ok) {
        const data = await res.json();
        setVideos(data.history || []);
      }
    } catch (err) {
      console.error('Error loading library videos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [backendUrl]);

  const handleOpenUpload = (video: HistoryItem) => {
    setUploadVideo(video);
    setUploadTitle(video.title.replace('...', ''));
    setUploadDesc('If you want to know how to generate this video, comment "facts"');
    setUploadSuccess(null);
    setUploadError(null);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadVideo || !uploadTitle.trim()) return;
    setIsUploading(true);
    setUploadSuccess(null);
    setUploadError(null);

    try {
      const res = await fetch(`${backendUrl}/api/youtube/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_filename: uploadVideo.filename,
          title: uploadTitle,
          description: uploadDesc,
          privacy_status: uploadPrivacy
        })
      });

      if (res.ok) {
        const data = await res.json();
        setUploadSuccess(data.video_id);
        fetchVideos(); // Refresh statuses
      } else {
        const data = await res.json();
        setUploadError(data.detail || 'Upload failed.');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error connecting to upload API.');
    } finally {
      setIsUploading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
    }
  };

  const handleDeleteVideo = async (filename: string) => {
    const confirmed = window.confirm(`Are you sure you want to permanently delete "${filename}"? This will remove it from the database and delete the physical file.`);
    if (!confirmed) return;

    try {
      const res = await fetch(`${backendUrl}/api/video/delete/${filename}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchVideos(); // Reload
      } else {
        alert('Failed to delete video.');
      }
    } catch (err) {
      console.error('Error deleting video:', err);
      alert('Error connecting to backend.');
    }
  };

  return (
    <div className="animate-slide-up flex flex-col gap-8">
      {/* Page Header */}
      <Header
        title="Video Gallery"
        description="Browse your local vertical Short creations and publish them to YouTube."
        channelData={channelData}
      >
        {videos.length > 0 && (
          <div className="flex bg-white/5 border border-white/5 p-1 rounded-xl gap-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === 'grid' ? 'bg-violet-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              Grid
            </button>
            <button 
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${viewMode === 'table' ? 'bg-violet-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              Table
            </button>
          </div>
        )}
      </Header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Querying SQLite database records...</p>
        </div>
      ) : videos.length === 0 ? (
        <div className="glass-panel p-16 flex flex-col items-center text-center gap-5 border-dashed border-white/10">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold mb-1">Your Gallery is Empty</h3>
            <p className="text-gray-400 text-sm max-w-sm">You haven't compiled any video packages yet. Head over to the Creator Studio to compile your first short!</p>
          </div>
          <button onClick={() => onNavigate('generator')} className="btn-primary">
            Go to Creator Studio
          </button>
        </div>
      ) : viewMode === 'table' ? (
        <div className="glass-panel p-6 flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left min-w-[700px]">
              <thead>
                <tr className="border-b border-white/5 text-gray-400 font-semibold text-xs uppercase tracking-wider">
                  <th className="p-3">Video Title</th>
                  <th className="p-3">Date Created</th>
                  <th className="p-3">Filename</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((video) => (
                  <tr key={video.id} className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.01] transition-all">
                    <td className="p-3.5 font-bold text-sm text-gray-200 max-w-[240px] truncate">
                      {video.title}
                    </td>
                    <td className="p-3.5 text-gray-400 text-xs">
                      {formatDate(video.created_at)}
                    </td>
                    <td className="p-3.5 text-gray-500 font-mono text-xs">
                      {video.filename}
                    </td>
                    <td className="p-3.5">
                      {video.posted ? (
                        <span className="text-[0.65rem] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          Posted
                        </span>
                      ) : (
                        <span className="text-[0.65rem] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full">
                          Local
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right flex gap-2 justify-end items-center text-xs">
                      <button 
                        onClick={() => setActivePreview(video.filename)}
                        className="text-violet-400 hover:text-violet-300 font-bold cursor-pointer bg-transparent border-0"
                      >
                        Play
                      </button>
                      <span className="text-gray-700">|</span>
                      <a 
                        href={`${backendUrl}/api/video/preview/${video.filename}`}
                        download={video.filename}
                        target="_blank" 
                        rel="noreferrer"
                        className="text-gray-400 hover:text-white font-bold"
                      >
                        Download
                      </a>
                      <span className="text-gray-700">|</span>
                      {video.posted ? (
                        <a 
                          href={`https://youtube.com/watch?v=${video.youtube_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 font-bold"
                        >
                          View Live
                        </a>
                      ) : (
                        <button 
                          onClick={() => handleOpenUpload(video)} 
                          disabled={!youtubeAuthenticated}
                          className="text-violet-400 hover:text-violet-300 font-bold cursor-pointer bg-transparent border-0 disabled:opacity-50"
                        >
                          Publish
                        </button>
                      )}
                      <span className="text-gray-700">|</span>
                      <button
                        onClick={() => handleDeleteVideo(video.filename)}
                        className="text-red-400 hover:text-red-300 font-bold cursor-pointer bg-transparent border-0"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {videos.map((video) => (
            <div key={video.id} className="glass-panel p-4 flex flex-col gap-4 group hover:border-violet-500/25 transition-all">
              
              {/* Thumbnail Container */}
              <div 
                className="aspect-[9/16] bg-black/60 rounded-xl relative overflow-hidden flex items-center justify-center cursor-pointer group-hover:shadow-[0_0_15px_rgba(139,92,246,0.15)] transition-all"
                onClick={() => setActivePreview(video.filename)}
              >
                {/* Floating Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteVideo(video.filename);
                  }}
                  className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/60 hover:bg-red-600/90 flex items-center justify-center text-gray-400 hover:text-white border border-white/5 cursor-pointer z-20 transition-all opacity-0 group-hover:opacity-100"
                  title="Delete Video"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
                <div className="w-12 h-12 rounded-full bg-violet-600/90 flex items-center justify-center text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all z-10">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-3.5 z-1">
                  <span className="text-[0.65rem] text-gray-400 font-medium">
                    {formatDate(video.created_at)}
                  </span>
                </div>
              </div>

              {/* Video Title Details */}
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <h4 className="font-bold text-sm text-gray-200 truncate group-hover:text-violet-400 transition-colors" title={video.title}>
                  {video.title}
                </h4>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-[0.7rem] text-gray-500 font-mono truncate">
                    {video.filename}
                  </span>
                  {video.posted ? (
                    <span className="text-[0.65rem] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">
                      Posted
                    </span>
                  ) : (
                    <span className="text-[0.65rem] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full shrink-0">
                      Local
                    </span>
                  )}
                </div>
              </div>

              {/* Actions Grid */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                <a 
                  href={`${backendUrl}/api/video/preview/${video.filename}`}
                  download={video.filename}
                  target="_blank" 
                  rel="noreferrer"
                  className="btn-secondary py-2 text-xs text-center justify-center"
                >
                  Download
                </a>
                
                {video.posted ? (
                  <a 
                    href={`https://youtube.com/watch?v=${video.youtube_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary py-2 text-xs text-center justify-center bg-emerald-600 hover:bg-emerald-500"
                  >
                    View Live
                  </a>
                ) : (
                  <button 
                    onClick={() => handleOpenUpload(video)} 
                    disabled={!youtubeAuthenticated}
                    className="btn-primary py-2 text-xs justify-center"
                  >
                    Publish
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Preview Overlay Modal */}
      {activePreview && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setActivePreview(null)}>
          <div className="relative aspect-[9/16] h-[85vh] bg-black rounded-3xl border border-white/10 overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <video 
              src={`${backendUrl}/api/video/preview/${activePreview}`}
              className="w-full h-full object-cover"
              controls
              autoPlay
            />
            <button 
              onClick={() => setActivePreview(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white cursor-pointer border border-white/10 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* YouTube Publish Dialog Modal */}
      {uploadVideo && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel p-8 w-full max-w-lg flex flex-col gap-5 relative border border-white/10">
            <button 
              onClick={() => setUploadVideo(null)}
              className="absolute top-6 right-6 text-gray-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>

            <h3 className="text-xl font-bold">Publish compiled Short to YouTube</h3>
            <p className="text-gray-400 text-xs font-mono -mt-3">File: {uploadVideo.filename}</p>

            {uploadSuccess ? (
              <div className="flex flex-col gap-4 items-center text-center py-6">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-bold text-lg text-emerald-400">Published Successfully!</h4>
                  <p className="text-gray-400 text-sm mt-1">Your video is now live on YouTube Shorts.</p>
                </div>
                <div className="flex gap-3 mt-2 w-full">
                  <a 
                    href={`https://youtube.com/watch?v=${uploadSuccess}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn-primary flex-1 justify-center"
                  >
                    View on YouTube
                  </a>
                  <button 
                    onClick={() => {
                      setUploadVideo(null);
                      setUploadSuccess(null);
                    }} 
                    className="btn-secondary flex-1 justify-center"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleUploadSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1.5 font-bold">Video Title</label>
                  <input
                    type="text"
                    maxLength={100}
                    className="form-input text-sm w-full py-2.5 px-3.5"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1.5 font-bold">Description</label>
                  <textarea
                    rows={4}
                    className="form-input text-sm w-full py-2.5 px-3.5 resize-none"
                    value={uploadDesc}
                    onChange={(e) => setUploadDesc(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1.5 font-bold">Visibility Status</label>
                    <select
                      className="form-input text-sm w-full py-2.5 px-3"
                      value={uploadPrivacy}
                      onChange={(e) => setUploadPrivacy(e.target.value)}
                    >
                      <option value="private">Private</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="public">Public</option>
                    </select>
                  </div>
                </div>

                {uploadError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
                    {uploadError}
                  </div>
                )}

                <div className="flex gap-3 justify-end mt-4">
                  <button 
                    type="button" 
                    onClick={() => setUploadVideo(null)} 
                    className="btn-secondary py-2.5 px-5"
                    disabled={isUploading}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary py-2.5 px-6"
                    disabled={isUploading}
                  >
                    {isUploading ? 'Publishing video...' : 'Publish Short'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
