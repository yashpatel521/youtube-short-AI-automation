import { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';

interface HistoryItem {
  id: number;
  filename: string;
  title: string;
  created_at: string;
  posted: boolean;
  youtube_id: string | null;
}

interface QualityProps {
  backendUrl: string;
  channelData: any;
}

export default function Quality({ backendUrl, channelData }: QualityProps) {
  const [videos, setVideos] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<HistoryItem | null>(null);

  // Diagnostic compilation states
  const [compiling, setCompiling] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Script text and scoring states
  const [scriptInput, setScriptInput] = useState<string>("Did you know that a day on Venus is longer than a year on Venus? Venus takes two hundred and forty-three Earth days to rotate once on its axis, but only two hundred and twenty-five Earth days to complete an orbit around the Sun. This makes its day longer than its year!");
  const [backgroundSource, setBackgroundSource] = useState<string>("pexels");
  const [reviews, setReviews] = useState<any[]>([]);


  const fetchVideos = async (selectLatest = false) => {
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/video/history`);
      if (res.ok) {
        const data = await res.json();
        const history = data.history || [];
        setVideos(history);
        if (history.length > 0) {
          if (selectLatest || !selectedVideo) {
            setSelectedVideo(history[0]);
          } else {
            const updated = history.find((v: HistoryItem) => v.filename === selectedVideo.filename);
            setSelectedVideo(updated || history[0]);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/quality/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
      }
    } catch (err) {
      console.error('Error fetching quality reviews:', err);
    }
  };

  useEffect(() => {
    fetchVideos();
    fetchReviews();
  }, [backendUrl]);

  // Scroll to bottom of diagnostics log
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [jobStatus?.logs]);



  // Poll diagnostic compilation job status
  useEffect(() => {
    let pollInterval: any = null;
    if (compiling && jobId) {
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`${backendUrl}/api/video/status/${jobId}`);
          if (res.ok) {
            const data = await res.json();
            setJobStatus(data);
            if (data.status === 'completed' || data.status === 'failed') {
              setCompiling(false);
              clearInterval(pollInterval);
              if (data.status === 'completed') {
                await fetchVideos(true);
              }
            }
          }
        } catch (err) {
          console.error('Error polling compile job status:', err);
        }
      }, 1000);
    }
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [compiling, jobId, backendUrl]);

  const handleCompileCustomScript = async () => {
    if (!scriptInput.trim()) {
      alert("Please enter a script text to compile.");
      return;
    }
    setCompiling(true);
    setJobStatus(null);
    setJobId(null);

    const payload = {
      script_text: scriptInput,
      title: "Quality Lab Test",
      voice: "en-US-EmmaMultilingualNeural",
      pexels_query: "abstract loop", // Tries to query loops, falls back to gradient
      highlight_color: "#FFD700",
      enable_subscribe: true,
      background_source: backgroundSource
    };

    try {
      const res = await fetch(`${backendUrl}/api/video/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setJobId(data.job_id);
      } else {
        const errData = await res.json();
        alert(`Failed to initiate compile: ${errData.detail || 'Service error'}`);
        setCompiling(false);
      }
    } catch (err: any) {
      alert(`Compile failed: ${err.message}`);
      setCompiling(false);
    }
  };



  return (
    <div className="animate-slide-up flex flex-col gap-8">
      <Header
        title="Quality Lab"
        description="Inspect rendering outputs, visual quality, and score compiled Shorts animations."
        channelData={channelData}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8 items-start">
        
        {/* Left Side: Mobile 9:16 player frameset */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-full max-w-[340px] aspect-[9/16] bg-[#050508] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl relative flex items-center justify-center p-2">
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-32 h-4 bg-black rounded-full z-20 border border-white/5" />
            
            <div className="w-full h-full rounded-[24px] overflow-hidden relative bg-black flex items-center justify-center">
              {selectedVideo ? (
                <video
                  key={selectedVideo.filename}
                  src={`${backendUrl}/api/video/preview/${selectedVideo.filename}`}
                  className="w-full h-full object-cover"
                  controls
                  autoPlay
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-6 text-gray-500 gap-2">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  <span className="text-xs font-semibold uppercase">No Video Selected</span>
                </div>
              )}
            </div>
          </div>
          {selectedVideo && (
            <span className="text-xs text-gray-500 font-mono select-all bg-white/5 py-1.5 px-3 rounded-full border border-white/5">
              File: {selectedVideo.filename}
            </span>
          )}
        </div>

        {/* Right Side: Scripts, Scoring, Evaluations & History selection */}
        <div className="flex flex-col gap-6">
          
          {/* Custom Script Compile Laboratory */}
          <div className="glass-panel p-6 flex flex-col gap-4">
            <h3 className="text-base font-bold flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-pink-500 rounded-full animate-pulse" />
              Diagnostics & Custom Script Compiler
            </h3>
            <p className="text-gray-400 text-xs leading-relaxed m-0">
              Paste or write your custom test script below. Clicking compile will generate speech synthesis, overlays, progress markers, and compile a local Short video.
            </p>
            <div className="flex flex-col gap-3">
              <textarea
                value={scriptInput}
                onChange={(e) => setScriptInput(e.target.value)}
                className="w-full h-[85px] bg-[#0c0c16] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 resize-none font-sans leading-relaxed"
                placeholder="Write script content..."
              />
              <div className="flex justify-between items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-400 font-sans">Visual Model:</span>
                  <select
                    value={backgroundSource}
                    onChange={(e) => setBackgroundSource(e.target.value)}
                    className="bg-[#0c0c16] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-violet-500/50"
                  >
                    <option value="pexels">Pexels Stock Footage (Online)</option>
                    <option value="local_model">Local Procedural Model (Offline AI)</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-500 font-mono">{scriptInput.length} characters</span>
                  <button
                    onClick={handleCompileCustomScript}
                    className="btn-primary py-2 px-4 text-xs font-bold"
                    disabled={compiling}
                  >
                    {compiling ? 'Compiling Video...' : 'Compile Quality Test Video'}
                  </button>
                </div>
              </div>
            </div>

            {/* Live Progress Logs */}
            {jobStatus && (
              <div className="flex flex-col gap-2 mt-2 border-t border-white/5 pt-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-gray-400 font-mono">Job: {jobId?.substring(0, 8)}</span>
                  <span className={`font-extrabold uppercase ${jobStatus.status === 'completed' ? 'text-emerald-400' : jobStatus.status === 'failed' ? 'text-red-400' : 'text-violet-400'}`}>
                    {jobStatus.status} ({jobStatus.progress}%)
                  </span>
                </div>
                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-violet-500 to-pink-500 h-full transition-all duration-300" style={{ width: `${jobStatus.progress}%` }} />
                </div>
                <div className="p-3 bg-black/60 border border-white/5 rounded-xl text-[0.65rem] font-mono text-gray-300 h-[100px] overflow-y-auto flex flex-col gap-1.5 scrollbar-thin">
                  {jobStatus.logs && jobStatus.logs.map((log: string, idx: number) => (
                    <div key={idx} className="leading-relaxed">
                      <span className="text-violet-500">➜</span> {log}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>
            )}
          </div>

          {/* Selector directory */}
          <div className="glass-panel p-6 flex flex-col gap-4">
            <h3 className="text-base font-bold">Select Generated Video to Audit</h3>
            {loading && videos.length === 0 ? (
              <p className="text-gray-400 text-xs">Loading directory database history...</p>
            ) : videos.length === 0 ? (
              <p className="text-gray-500 text-xs">No local videos found. Input a script above to compile!</p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5 max-h-[220px] overflow-y-auto pr-1">
                {videos.map((video) => {
                  const hasReview = reviews.some(r => r.filename === video.filename);
                  return (
                    <div
                      key={video.id}
                      onClick={() => setSelectedVideo(video)}
                      className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex justify-between items-center gap-3 ${selectedVideo?.filename === video.filename ? 'bg-violet-600/10 border-violet-500/50 text-white shadow-md' : 'bg-white/[0.02] border-white/5 text-gray-300 hover:bg-white/[0.04] hover:border-white/10'}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs truncate" title={video.title}>{video.title}</div>
                        <div className="text-[0.65rem] text-gray-500 font-mono truncate mt-0.5">{video.filename}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {video.posted ? (
                          <span className="text-[0.55rem] font-extrabold uppercase tracking-wider text-emerald-400">Posted</span>
                        ) : (
                          <span className="text-[0.55rem] font-extrabold uppercase tracking-wider text-gray-500">Local</span>
                        )}
                        {hasReview && (
                          <span className="text-[0.55rem] font-semibold text-amber-400 flex items-center gap-0.5">★ Scored</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
