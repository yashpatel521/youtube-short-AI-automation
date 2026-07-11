import { useState, useEffect, useRef } from 'react';
import PageShell from '../components/PageShell';

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
}

export default function Quality({ backendUrl }: QualityProps) {
  const [videos, setVideos] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<HistoryItem | null>(null);

  // Diagnostic compilation states
  const [compiling, setCompiling] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Script text and scoring states
  const [promptTitle, setPromptTitle] = useState<string>("Secret of Black Holes");
  const [promptDescription, setPromptDescription] = useState<string>("A cosmic mystery explaining how supermassive black holes warp time and swallow stars, with dramatic particle visual flows.");
  const [ideaDescription, setIdeaDescription] = useState<string>("The video will explore the mind-bending gravity of black holes, focusing on how supermassive vortexes warp light and space to hook space enthusiasts.");
  const [visualPrompt, setVisualPrompt] = useState<string>("0-2s: Deep space background. A small black vortex center-frame. 2-5s: Vortex expands pulling in glowing star particles. 5-8s: Close-up on the event horizon with gravitational light lensing. 8-15s: Starry vortex zoom.");
  const [generatingScript, setGeneratingScript] = useState<boolean>(false);
  const [scriptInput, setScriptInput] = useState<string>("Think black holes are just giant vacuums? Think again. Their gravitational pull is so intense that not even light can escape, warping time and space around them.");
  const [backgroundSource, setBackgroundSource] = useState<string>("pexels");
  const [pexelsQuery, setPexelsQuery] = useState<string>("abstract loop");
  const [highlightColor, setHighlightColor] = useState<string>("#FFD700");
  const [enableSubscribe, setEnableSubscribe] = useState<boolean>(true);
  const [voice, setVoice] = useState<string>("en-US-EmmaMultilingualNeural");
  const [tone, setTone] = useState<string>("Energetic");
  const [activeTab, setActiveTab] = useState<"narration" | "visual" | "idea">("narration");
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

  const handleGenerateFromPrompt = async () => {
    if (!promptTitle.trim() || !promptDescription.trim()) {
      alert("Please fill out both Title and Description before generating.");
      return;
    }
    setGeneratingScript(true);
    try {
      const storedSecrets = localStorage.getItem('settings_keys');
      let geminiKey = '';
      if (storedSecrets) {
        try {
          const parsed = JSON.parse(storedSecrets);
          geminiKey = parsed.gemini_api_key || '';
        } catch {}
      }

      const res = await fetch(`${backendUrl}/api/script/generate-custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: promptTitle,
          description: promptDescription,
          gemini_key: geminiKey
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIdeaDescription(data.idea_description || "");
        setVisualPrompt(data.visual_prompt || "");
        setScriptInput(data.narration || "");
      } else {
        alert("Failed to generate custom script details.");
      }
    } catch (err: any) {
      alert(`AI generation failed: ${err.message}`);
    } finally {
      setGeneratingScript(false);
    }
  };

  const handleCompileCustomScript = async () => {
    if (!scriptInput.trim()) {
      alert("Please enter a script narration text to compile.");
      return;
    }
    setCompiling(true);
    setJobStatus(null);
    setJobId(null);

    const payload = {
      script_text: scriptInput,
      title: promptTitle || "Quality Lab Test",
      voice: voice,
      pexels_query: pexelsQuery,
      highlight_color: highlightColor,
      enable_subscribe: enableSubscribe,
      background_source: backgroundSource,
      visual_prompt: visualPrompt || undefined
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
    <PageShell title="Quality Lab">

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
          
          {/* AI Diagnostics Compiler Laboratory */}
          <div className="glass-panel p-6 flex flex-col gap-5">
            <div className="border-b border-white/5 pb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-pink-500 rounded-full animate-pulse" />
                Diagnostics Compiler
              </h3>
              <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                Design a custom video Short. Input a Title & Description, and click generate to synthesize visual cues and voice narration.
              </p>
            </div>

            {/* AI Prompt Input (Title & Description) */}
            <div className="flex flex-col gap-3.5 p-4 rounded-xl bg-violet-600/5 border border-violet-500/10">
              <span className="text-[10px] text-violet-400 font-extrabold uppercase tracking-wider block">AI Custom Video Prompt</span>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-500 font-semibold">Video Title Topic</label>
                  <input
                    type="text"
                    className="bg-[#0c0c16] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/50"
                    placeholder="e.g., Space black hole mystery"
                    value={promptTitle}
                    onChange={(e) => setPromptTitle(e.target.value)}
                    disabled={generatingScript || compiling}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-500 font-semibold">Video Brief Description</label>
                  <textarea
                    className="bg-[#0c0c16] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500/50 h-[50px] resize-none"
                    placeholder="e.g., A vertical Short about black holes eating stars..."
                    value={promptDescription}
                    onChange={(e) => setPromptDescription(e.target.value)}
                    disabled={generatingScript || compiling}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleGenerateFromPrompt}
                className="btn-primary py-2 px-4 text-xs font-bold bg-violet-600 hover:bg-violet-700 border-none rounded-lg mt-1 w-full"
                disabled={generatingScript || compiling || !promptTitle.trim() || !promptDescription.trim()}
              >
                {generatingScript ? 'Generating AI Details...' : 'AI Generate Details'}
              </button>
            </div>

            {/* Generated Text Outputs Tab Switcher */}
            <div className="flex flex-col gap-3">
              <div className="flex border-b border-white/5 gap-1.5 p-0.5 bg-black/20 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveTab("narration")}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition-all ${activeTab === 'narration' ? 'bg-violet-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                  1. Narration
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("visual")}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition-all ${activeTab === 'visual' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                  2. Visual Prompt
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("idea")}
                  className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition-all ${activeTab === 'idea' ? 'bg-teal-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                  3. Core Concept
                </button>
              </div>

              <div className="bg-[#08080f] border border-white/5 rounded-xl p-3.5 flex flex-col gap-2">
                {activeTab === 'narration' && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider">Editable Spoken Script Narration</span>
                    <textarea
                      className="w-full h-[85px] bg-[#0c0c16] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 resize-none font-sans leading-relaxed"
                      value={scriptInput}
                      onChange={(e) => setScriptInput(e.target.value)}
                      disabled={compiling}
                    />
                  </div>
                )}
                {activeTab === 'visual' && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider">Detailed Frame-by-Frame Video Visual Prompt</span>
                    <textarea
                      className="w-full h-[85px] bg-[#0c0c16] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 resize-none font-mono text-[10px] leading-normal"
                      value={visualPrompt}
                      onChange={(e) => setVisualPrompt(e.target.value)}
                      disabled={compiling}
                    />
                  </div>
                )}
                {activeTab === 'idea' && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-wider">AI Generated Video Concept Idea</span>
                    <textarea
                      className="w-full h-[85px] bg-[#0c0c16] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-violet-500/50 resize-none font-sans leading-relaxed"
                      value={ideaDescription}
                      onChange={(e) => setIdeaDescription(e.target.value)}
                      disabled={compiling}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Compilation Settings Grid */}
            <div className="flex flex-col gap-4 border-t border-white/5 pt-4">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Render Configurations</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-500 font-semibold">Visual Model</label>
                  <select
                    value={backgroundSource}
                    onChange={(e) => setBackgroundSource(e.target.value)}
                    className="bg-[#0c0c16] border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-violet-500/50"
                  >
                    <option value="pexels">Pexels Stock Footage (Online)</option>
                    <option value="local_model">Local Procedural Model (Offline AI)</option>
                    <option value="ai_video">AI Text-to-Video (Replicate Wan 2.1)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-500 font-semibold">Visual Search Keyword</label>
                  <input
                    type="text"
                    className="bg-[#0c0c16] border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-violet-500/50"
                    value={pexelsQuery}
                    onChange={(e) => setPexelsQuery(e.target.value)}
                    placeholder="e.g. abstract neon loop"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-500 font-semibold">Highlight Color</label>
                  <select
                    value={highlightColor}
                    onChange={(e) => setHighlightColor(e.target.value)}
                    className="bg-[#0c0c16] border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-violet-500/50"
                  >
                    <option value="#FFD700">💛 Yellow</option>
                    <option value="#34d399">💚 Green</option>
                    <option value="#22d3ee">💙 Cyan</option>
                    <option value="#f97316">🧡 Orange</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-500 font-semibold">Voice Actor</label>
                  <select
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                    className="bg-[#0c0c16] border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-violet-500/50"
                  >
                    <option value="en-US-EmmaMultilingualNeural">Emma (US Female)</option>
                    <option value="en-US-BrianNeural">Brian (US Male)</option>
                    <option value="en-GB-SoniaNeural">Sonia (UK Female)</option>
                    <option value="en-GB-RyanNeural">Ryan (UK Male)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-500 font-semibold">Voice Tone Mood</label>
                  <input
                    type="text"
                    className="bg-[#0c0c16] border border-white/10 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-violet-500/50"
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    placeholder="e.g. Energetic, Mysterious"
                  />
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <input
                    type="checkbox"
                    id="enableSubscribeCheck"
                    checked={enableSubscribe}
                    onChange={(e) => setEnableSubscribe(e.target.checked)}
                    className="rounded border-white/10 bg-[#0c0c16] text-violet-600 focus:ring-0 focus:ring-offset-0"
                  />
                  <label htmlFor="enableSubscribeCheck" className="text-xs text-gray-400 font-semibold select-none cursor-pointer">
                    Enable Subscribe Overlay
                  </label>
                </div>
              </div>
            </div>

            {/* Compile Button */}
            <div className="flex justify-between items-center border-t border-white/5 pt-4">
              <span className="text-[10px] text-gray-500 font-mono">{scriptInput.length} characters</span>
              <button
                onClick={handleCompileCustomScript}
                className="btn-primary py-2.5 px-6 text-xs font-bold bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 border-none"
                disabled={compiling}
              >
                {compiling ? 'Compiling Video...' : 'Compile Video Shorts'}
              </button>
            </div>
          </div>

          {/* Live Progress Logs */}
          {jobStatus && (
            <div className="glass-panel p-6 flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-gray-400 font-mono">Job ID: {jobId?.substring(0, 8)}</span>
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

          {/* Bottom Card: Select Generated Video to Audit (History list) */}
          <div className="glass-panel p-6 flex flex-col gap-4">
            <h3 className="text-base font-bold flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
              Audited Videos Directory
            </h3>
            <p className="text-gray-400 text-xs leading-relaxed m-0">
              Browse, select, and preview previously compiled videos from the database history.
            </p>
            {loading && videos.length === 0 ? (
              <p className="text-gray-400 text-xs">Loading history records...</p>
            ) : videos.length === 0 ? (
              <p className="text-gray-500 text-xs">No local videos found. Write a prompt on the left to compile!</p>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
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
    </PageShell>
  );
}
