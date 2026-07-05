import { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';

interface Segment {
  video_description: string;
  animation_details: string;
  narration: string;
  tone: string;
  emoji: string;
}

interface ScriptPackage {
  analysis_reasoning: string;
  title: string;
  description: string;
  tags: string[];
  segments: Segment[];
}

interface GeneratorProps {
  backendUrl: string;
  channelData: any;
  settings: {
    gemini_api_key_configured: boolean;
    pexels_api_key_configured: boolean;
  };
}

export default function Generator({ backendUrl, channelData, settings: _settings }: GeneratorProps) {
  // Creator states
  const [topic, setTopic] = useState('');
  const [learningContext, setLearningContext] = useState<any>(null);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [scriptData, setScriptData] = useState<ScriptPackage | null>(null);

  // Visual/Audio configuration states
  const [voice, setVoice] = useState('en-US-EmmaMultilingualNeural');
  const [highlightColor, setHighlightColor] = useState('#FFD700');
  const [pexelsQuery, setPexelsQuery] = useState('');
  const [enableSubscribe, _setEnableSubscribe] = useState(true);

  // Compile job states
  const [compiling, setCompiling] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPrivacy, setUploadPrivacy] = useState('private');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Read competitor context from sessionStorage if redirected from research
  useEffect(() => {
    const rawContext = sessionStorage.getItem('competitor_context');
    if (rawContext) {
      try {
        const parsed = JSON.parse(rawContext);
        setLearningContext(parsed);
        setTopic(parsed.topic);
        // Clear it so it doesn't persist forever
        sessionStorage.removeItem('competitor_context');
      } catch (err) {
        console.error('Error loading competitor context:', err);
      }
    }
  }, []);

  // Read generator prompt from sessionStorage if redirected from dashboard suggestions
  useEffect(() => {
    const rawPrompt = sessionStorage.getItem('generator_prompt');
    if (rawPrompt) {
      setTopic(rawPrompt);
      sessionStorage.removeItem('generator_prompt');
    }
  }, []);

  // Read active video history if redirected from dashboard history panel or sidebar
  useEffect(() => {
    const handleLoadVideo = () => {
      const rawHistory = sessionStorage.getItem('active_video_history');
      if (rawHistory) {
        try {
          const parsed = JSON.parse(rawHistory);
          setJobStatus({
            status: 'completed',
            video_filename: parsed.filename,
            logs: ['Loaded previously compiled video from studio history.']
          });
          setUploadTitle(parsed.title);
          setUploadDesc(`If you want to know how to generate this video, comment "facts"`);
          // Clear
          sessionStorage.removeItem('active_video_history');
        } catch (err) {
          console.error('Error loading history context:', err);
        }
      }
    };

    handleLoadVideo();
    window.addEventListener('load_active_video', handleLoadVideo);
    return () => {
      window.removeEventListener('load_active_video', handleLoadVideo);
    };
  }, []);

  // Scroll to bottom of compilation logs automatically
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [jobStatus?.logs]);

  // Poll compilation job status
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
              // Prepopulate upload fields
              if (data.status === 'completed' && scriptData) {
                setUploadTitle(scriptData.title);
                setUploadDesc(`${scriptData.description}\n\nIf you want to know how to generate this video, comment "facts"`);
              }
            }
          }
        } catch (err) {
          console.error('Error polling job status:', err);
        }
      }, 1000);
    }
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [compiling, jobId, backendUrl, scriptData]);

  const generateScript = async () => {
    if (!topic.trim()) return;
    setGeneratingScript(true);
    setScriptData(null);
    setJobStatus(null);
    setUploadSuccess(null);
    setUploadError(null);

    const storedSecrets = localStorage.getItem('settings_keys');
    let geminiKey = '';
    if (storedSecrets) {
      try {
        const parsed = JSON.parse(storedSecrets);
        geminiKey = parsed.gemini_api_key || '';
      } catch {}
    }

    try {
      const res = await fetch(`${backendUrl}/api/script/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic,
          gemini_key: geminiKey,
          previous_shorts: channelData?.recent_shorts || [],
          competitor_shorts: learningContext?.competitors || []
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setScriptData(data);
      } else {
        const errData = await res.json();
        alert(`Error writing script: ${errData.detail || 'Service error'}`);
      }
    } catch (err: any) {
      alert(`Connection failed: ${err.message}`);
    } finally {
      setGeneratingScript(false);
    }
  };

  const handleEditSegment = (index: number, newText: string) => {
    if (!scriptData) return;
    const updated = [...scriptData.segments];
    updated[index].narration = newText;
    setScriptData({ ...scriptData, segments: updated });
  };

  const handleCompile = async () => {
    if (!scriptData) return;
    setCompiling(true);
    setJobStatus(null);

    const storedSecrets = localStorage.getItem('settings_keys');
    let pexelsKey = '';
    if (storedSecrets) {
      try {
        const parsed = JSON.parse(storedSecrets);
        pexelsKey = parsed.pexels_api_key || '';
      } catch {}
    }

    try {
      const scriptText = scriptData.segments.map((seg) => seg.narration).join(' ');

      const res = await fetch(`${backendUrl}/api/video/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pexels_key: pexelsKey || undefined,
          voice: voice,
          highlight_color: highlightColor,
          enable_subscribe: enableSubscribe,
          pexels_query: pexelsQuery || topic || 'abstract loop',
          script_text: scriptText,
          title: scriptData.title
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setJobId(data.job_id);
        setJobStatus({ status: 'queued', logs: ['Initiating compilation queue...'] });
      } else {
        const errData = await res.json();
        let errorMsg = 'Unknown error';
        if (errData && errData.detail) {
          if (typeof errData.detail === 'string') {
            errorMsg = errData.detail;
          } else if (Array.isArray(errData.detail)) {
            errorMsg = errData.detail.map((err: any) => `${err.loc.join('.')}: ${err.msg}`).join('\n');
          } else if (typeof errData.detail === 'object') {
            errorMsg = JSON.stringify(errData.detail);
          }
        }
        alert(`Failed to start compiler:\n${errorMsg}`);
        setCompiling(false);
      }
    } catch (err: any) {
      alert(`Connection error: ${err.message}`);
      setCompiling(false);
    }
  };

  const handleUpload = async () => {
    if (!jobStatus || jobStatus.status !== 'completed' || !uploadTitle.trim()) return;
    setIsUploading(true);
    setUploadSuccess(null);
    setUploadError(null);

    try {
      const res = await fetch(`${backendUrl}/api/youtube/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_filename: jobStatus.video_filename,
          title: uploadTitle,
          description: uploadDesc,
          privacy_status: uploadPrivacy
        })
      });

      if (res.ok) {
        const data = await res.json();
        setUploadSuccess(data.video_id);
      } else {
        const data = await res.json();
        setUploadError(data.detail || 'Upload failed.');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Connection lost.');
    } finally {
      setIsUploading(false);
    }
  };

  // Helper word boundaries counter
  const getWordCount = () => {
    if (!scriptData) return 0;
    return scriptData.segments.reduce((acc, seg) => {
      return acc + (seg.narration || '').trim().split(/\s+/).filter(Boolean).length;
    }, 0);
  };

  const wordCount = getWordCount();
  const wordCountStatus = wordCount >= 50 && wordCount <= 70 ? 'success' : 'warning';

  return (
    <div className="animate-slide-up grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8 items-start">
      
      {/* Left Workspace Panel */}
      <div className="flex flex-col gap-6">
        <Header
          title="Creator Studio"
          description="Create optimized Short video packages. Synthesize AI voices and overlays."
          channelData={channelData}
        />

        {/* AI Prompt Input Card */}
        <div className="glass-panel p-6 flex flex-col gap-4">
          <h2 className="text-lg font-bold">AI Creative Prompter</h2>
          
          {learningContext && (
            <div className="p-2.5 bg-violet-500/10 border border-violet-500/30 rounded-lg text-xs text-[#c084fc] flex items-center gap-1.5">
              <span className="font-bold">Learning Mode Active:</span> Co-referencing trending competitor Shorts metrics.
            </div>
          )}

          <div className="flex gap-3">
            <input
              type="text"
              className="form-input"
              placeholder="What topic should this Short cover? (e.g. '3 Dark Truths About Money', 'Why Time Flies')"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={generatingScript || compiling}
            />
            <button
              onClick={generateScript}
              className="btn-primary"
              disabled={generatingScript || compiling || !topic.trim()}
            >
              {generatingScript ? 'Writing Script...' : 'Generate Script'}
            </button>
          </div>
        </div>

        {/* Script Editor Panel */}
        {scriptData && (
          <div className="glass-panel p-8 flex flex-col gap-5">
            <div className="flex justify-between items-center flex-wrap">
              <div>
                <h3 className="text-xl font-bold">Voice Script Editor</h3>
                <p className="text-gray-400 text-xs mt-1">
                  Edit the paragraph blocks below. Keep words within constraints to align audio exactly with the 20-30s layout.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500">TOTAL WORDS: </span>
                <span className={`font-extrabold text-base ${wordCountStatus === 'success' ? 'text-emerald-400' : 'text-amber-500'}`}>
                  {wordCount} / 70
                </span>
                <span className="text-xs block text-gray-500">
                  (Target: 50-70 words)
                </span>
              </div>
            </div>

            {/* Script Segments List */}
            <div className="flex flex-col gap-5">
              {scriptData.segments.map((seg, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-white/[0.01] border border-white/5 flex flex-col gap-4"
                >
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <span className="text-xs font-bold text-violet-400">
                      SEGMENT #{idx + 1}
                    </span>
                    <div className="flex gap-2.5 flex-wrap">
                      {seg.emoji && (
                        <span className="bg-white/10 px-2 py-0.5 rounded text-[10px]">
                          Emoji: {seg.emoji}
                        </span>
                      )}
                      <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] text-gray-400">
                        Tone: {seg.tone}
                      </span>
                    </div>
                  </div>

                  {/* Visual Description & Animation Details row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-black/40 p-3 rounded-xl border border-white/5 text-[11px] leading-normal text-gray-400">
                    <div>
                      <strong className="text-violet-400 block mb-0.5">🎬 Video Description:</strong>
                      {seg.video_description}
                    </div>
                    <div>
                      <strong className="text-pink-400 block mb-0.5">✨ Animation Details (Frame by Frame):</strong>
                      {seg.animation_details}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-gray-500 font-semibold uppercase">Voice Narration</label>
                    <textarea
                      className="form-textarea resize-y w-full bg-[#0c0c16]/50"
                      rows={2}
                      value={seg.narration}
                      onChange={(e) => handleEditSegment(idx, e.target.value)}
                      disabled={compiling}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* SEO Suggestions box */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <h4 className="text-sm font-bold mb-1.5">AI SEO Reasoning</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                {scriptData.analysis_reasoning}
              </p>
            </div>

            {/* Config & Compile trigger */}
            <div className="border-t border-white/5 pt-5 flex justify-between items-center flex-wrap gap-4">
              <div className="flex gap-3 flex-wrap">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Highlight Color</label>
                  <select
                    className="form-select py-2 px-3 w-[130px]"
                    value={highlightColor}
                    onChange={(e) => setHighlightColor(e.target.value)}
                  >
                    <option value="#FFD700">💛 Yellow</option>
                    <option value="#34d399">💚 Green</option>
                    <option value="#22d3ee">💙 Cyan</option>
                    <option value="#f97316">🧡 Orange</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Voice Actor</label>
                  <select
                    className="form-select py-2 px-3 w-[200px]"
                    value={voice}
                    onChange={(e) => setVoice(e.target.value)}
                  >
                    <option value="en-US-EmmaMultilingualNeural">Emma (US Female)</option>
                    <option value="en-US-BrianNeural">Brian (US Male)</option>
                    <option value="en-GB-SoniaNeural">Sonia (UK Female)</option>
                    <option value="en-GB-RyanNeural">Ryan (UK Male)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Visual Search Keyword</label>
                  <input
                    type="text"
                    className="form-input py-2 px-3 text-xs w-[180px]"
                    placeholder="e.g. 'coding', 'neon'"
                    value={pexelsQuery}
                    onChange={(e) => setPexelsQuery(e.target.value)}
                  />
                </div>
              </div>

              <button onClick={handleCompile} className="btn-primary" disabled={compiling || wordCount < 10}>
                {compiling ? 'Compiling Video Assets...' : 'Compile Video Shorts'}
              </button>
            </div>
          </div>
        )}

        {/* Real-time Compiler Log Viewer */}
        {jobStatus && (
          <div className="glass-panel p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold">Compilation Progress Logs</h3>
              <span className={`text-xs font-bold ${jobStatus.status === 'completed' ? 'text-emerald-400' : jobStatus.status === 'failed' ? 'text-red-500' : 'text-violet-500'}`}>
                Status: {jobStatus.status.toUpperCase()}
              </span>
            </div>

            {/* Progress Percentage Bar */}
            {jobStatus.status !== 'completed' && jobStatus.status !== 'failed' && (
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-white/5 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-violet-500 to-pink-500 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${jobStatus.progress || 0}%` }}
                  />
                </div>
                <span className="text-xs text-violet-400 font-extrabold min-w-[32px] text-right">
                  {jobStatus.progress || 0}%
                </span>
              </div>
            )}

            <div className="h-[160px] bg-[#050508] rounded-xl p-4 font-mono text-xs overflow-y-auto border border-white/5 flex flex-col gap-1.5 text-emerald-400">
              {jobStatus.logs.map((log: string, i: number) => (
                <div key={i} className="break-all">
                  <span className="text-gray-500">&gt;</span> {log}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>

            {/* Error banner */}
            {jobStatus.status === 'failed' && (
              <div className="p-3 px-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                <strong>Compilation Error:</strong> {jobStatus.error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Side: Preview & YouTube Upload Controls */}
      <div className="flex flex-col gap-6">
        <h2 className="text-lg font-bold">Shorts Preview</h2>
        
        {/* Mock Mobile frame */}
        <div className="w-full aspect-[9/16] bg-[#12121c] rounded-[24px] border-8 border-[#2e2e3e] shadow-2xl shadow-black/60 relative overflow-hidden flex items-center justify-center">
          {jobStatus?.status === 'completed' ? (
            <video
              src={`${backendUrl}/api/video/preview/${jobStatus.video_filename}`}
              controls
              className="w-full h-full object-cover"
            />
          ) : compiling ? (
            <div className="text-center p-5">
              <div className="glow-active text-[3rem] mb-2.5">🎬</div>
              <div className="text-sm text-gray-400">Rendering Video...</div>
              <div className="text-xs text-gray-500 mt-1">Compiling FFmpeg streams</div>
            </div>
          ) : (
            <div className="text-center p-5 text-gray-500">
              <div className="text-[3rem] mb-2.5">📱</div>
              <div className="text-[0.85rem] font-semibold text-gray-400">No Video Compiled Yet</div>
              <p className="text-xs mt-1.5 max-w-[200px] mx-auto text-gray-500 leading-normal">
                Generate a script and click Compile to see the animated output here.
              </p>
            </div>
          )}
        </div>

        {/* YouTube Upload Card */}
        {jobStatus?.status === 'completed' && (
          <div className="glass-panel animate-slide-up p-5 flex flex-col gap-3">
            <h3 className="text-base font-bold">Direct Post to YouTube</h3>
            
            {uploadSuccess ? (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex flex-col gap-2">
                <div><strong>Short published successfully!</strong></div>
                <a
                  href={`https://youtube.com/watch?v=${uploadSuccess}`} 
                  target="_blank"
                  rel="noreferrer"
                  className="text-violet-400 font-semibold underline hover:text-violet-300"
                >
                  View Video on YouTube
                </a>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">Short Title</label>
                  <input
                    type="text"
                    className="form-input py-2 px-3 text-xs"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">Description</label>
                  <textarea
                    className="form-textarea py-2 px-3 text-xs"
                    rows={3}
                    value={uploadDesc}
                    onChange={(e) => setUploadDesc(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">Privacy Status</label>
                  <select
                    className="form-select py-2 px-3 text-xs"
                    value={uploadPrivacy}
                    onChange={(e) => setUploadPrivacy(e.target.value)}
                  >
                    <option value="private">🔒 Private</option>
                    <option value="unlisted">🔗 Unlisted</option>
                    <option value="public">🌐 Public</option>
                  </select>
                </div>

                {uploadError && (
                  <div className="text-xs text-red-400">
                    <strong>Upload failed:</strong> {uploadError}
                  </div>
                )}

                <button
                  onClick={handleUpload}
                  className="btn-primary mt-1.5 w-full justify-center"
                  disabled={isUploading || !uploadTitle}
                >
                  {isUploading ? 'Publishing Short...' : 'Publish to YouTube'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
