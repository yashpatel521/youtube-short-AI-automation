import { useState, useRef } from 'react';
import PageShell from '../components/PageShell';

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

interface FunnyStudioProps {
  backendUrl: string;
  channelData: any;
  onNavigate: (tab: any) => void;
}

const COMEDY_FORMATS = [
  {
    id: 'animal_funny_fails',
    title: '🐶 Animal Funny Fails',
    tagline: 'Hilarious pet fails, cats missing jumps & silly dog moments',
    badge: '10M+ Virality Trend',
    color: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30 text-yellow-400',
    defaultPrompt: 'Funniest animal fails of the week: Cats vs Physics',
  },
  {
    id: 'pov',
    title: '🎭 POV Relatable',
    tagline: 'Everyday awkward situations viewers tag friends on',
    badge: 'High Viral Retention',
    color: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400',
    defaultPrompt: 'POV: You try to go to sleep early on a Sunday night',
  },
  {
    id: 'expectation_vs_reality',
    title: '⚡ Expectation vs Reality',
    tagline: 'Dramatic contrast between perfection and chaos',
    badge: 'Meme Classic',
    color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-400',
    defaultPrompt: 'Working from home: What your boss thinks vs What you actually do',
  },
  {
    id: 'sarcastic',
    title: '😏 Sarcastic Advice',
    tagline: 'Witty, deadpan life rules delivered with dry humor',
    badge: 'High Comment Rate',
    color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400',
    defaultPrompt: '3 unwritten rules to survive adulthood without losing your mind',
  },
  {
    id: 'plot_twist',
    title: '🌀 Absurd Plot Twist',
    tagline: 'Serious 5-second setup with an insane punchline',
    badge: 'Watch-Time Booster',
    color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400',
    defaultPrompt: 'How to fix your sleep schedule in 3 easy steps... Step 1: Don\'t',
  },
  {
    id: 'meme',
    title: '🐱 Meme Reactions',
    tagline: 'Rapid commentary paired with funny stock reaction clips',
    badge: 'Gen-Z Viral Format',
    color: 'from-rose-500/20 to-red-500/20 border-rose-500/30 text-rose-400',
    defaultPrompt: 'When your code works on the first try and you don\'t know why',
  },
];

export default function FunnyStudio({ backendUrl, channelData: _channelData, onNavigate }: FunnyStudioProps) {
  const [selectedFormat, setSelectedFormat] = useState('pov');
  const [topic, setTopic] = useState('POV: You try to go to sleep early on a Sunday night');
  const [generatingScript, setGeneratingScript] = useState(false);
  const [scriptData, setScriptData] = useState<ScriptPackage | null>(null);

  // Compilation settings
  const voice = 'en-US-GuyNeural';
  const [highlightColor, setHighlightColor] = useState('#FFD700');
  const [compiling, setCompiling] = useState(false);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const getGeminiKey = () => {
    const storedSecrets = localStorage.getItem('settings_keys');
    if (storedSecrets) {
      try {
        const parsed = JSON.parse(storedSecrets);
        return parsed.gemini_api_key || '';
      } catch {}
    }
    return '';
  };

  const handleGenerateFunnyScript = async (customTopic?: string) => {
    const targetTopic = customTopic !== undefined ? customTopic : topic;
    setGeneratingScript(true);
    setScriptData(null);

    const geminiKey = getGeminiKey();

    try {
      const res = await fetch(`${backendUrl}/api/video/script/generate-funny`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: targetTopic || '',
          funny_format: selectedFormat,
          gemini_key: geminiKey,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setScriptData(data);
      } else {
        const err = await res.json();
        setToast({ message: err.detail || 'Failed to generate funny script.', type: 'error' });
        setTimeout(() => setToast(null), 5000);
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Connection error to backend server.', type: 'error' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setGeneratingScript(false);
    }
  };

  const handleCompileFunnyVideo = async () => {
    if (!scriptData) return;
    setCompiling(true);

    const scriptText = scriptData.segments.map((s) => s.narration).join(' ');
    const pexelsQuery = topic.split(' ').slice(0, 3).join(' ') + ' funny reaction';

    try {
      const res = await fetch(`${backendUrl}/api/video/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script_text: scriptText,
          title: scriptData.title,
          voice: voice,
          pexels_query: pexelsQuery,
          highlight_color: highlightColor,
          background_source: 'pexels',
          segments: scriptData.segments,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const createdJobId = data.job_id;
        setToast({ message: 'Funny Short generation started! Tracking progress below...', type: 'success' });
        setTimeout(() => setToast(null), 4000);

        // Poll job status
        const interval = setInterval(async () => {
          try {
            const statusRes = await fetch(`${backendUrl}/api/video/status/${createdJobId}`);
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              setJobStatus(statusData);
              if (logEndRef.current) {
                logEndRef.current.scrollIntoView({ behavior: 'smooth' });
              }
              if (statusData.status === 'completed' || statusData.status === 'failed') {
                clearInterval(interval);
                setCompiling(false);
              }
            }
          } catch (e) {
            console.error('Polling job status error:', e);
          }
        }, 1500);
      } else {
        const err = await res.json();
        setToast({ message: err.detail || 'Compilation trigger failed.', type: 'error' });
        setTimeout(() => setToast(null), 5000);
        setCompiling(false);
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Error triggering compiler.', type: 'error' });
      setTimeout(() => setToast(null), 5000);
      setCompiling(false);
    }
  };

  return (
    <PageShell title="Funny Studio 🎭">
      <div className="flex flex-col gap-6 w-full pb-12">
        {/* Toast Alert */}
        {toast && (
          <div className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-xl animate-fade-in ${
            toast.type === 'success' ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300' : 'bg-rose-500/20 border border-rose-500/30 text-rose-300'
          }`}>
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="text-xs opacity-70 hover:opacity-100 uppercase tracking-wider font-bold">Dismiss</button>
          </div>
        )}

        {/* ── 1. Select Comedy Format ── */}
        <div>
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">1. Select Comedy Style Format</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {COMEDY_FORMATS.map((fmt) => {
              const active = selectedFormat === fmt.id;
              return (
                <button
                  key={fmt.id}
                  onClick={() => {
                    setSelectedFormat(fmt.id);
                    setTopic(fmt.defaultPrompt);
                  }}
                  className={`p-4 rounded-xl text-left border transition-all duration-200 flex flex-col justify-between gap-3 ${
                    active ? `bg-gradient-to-br ${fmt.color} ring-2 ring-violet-500 shadow-lg scale-[1.02]` : 'glass-card border-white/5 hover:border-white/20 hover:bg-white/[0.02]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-black/40 text-zinc-300">{fmt.badge}</span>
                    </div>
                    <h3 className="font-extrabold text-white text-sm">{fmt.title}</h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-snug">{fmt.tagline}</p>
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
                    {active ? '✓ Selected' : 'Click to Select'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 2. 1-Click Gemini Auto Generator ── */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">2. Create Funny Short</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Gemini automatically brainstorms a viral comedy premise, jokes, and reaction B-rolls for your selected format</p>
            </div>
            <span className="text-xs text-amber-400 font-semibold bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              Gemini Auto-Brainstorm (0.85 Wit)
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleGenerateFunnyScript('')}
              disabled={generatingScript}
              className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white font-extrabold text-base rounded-xl shadow-xl shadow-amber-500/25 disabled:opacity-50 transition flex items-center justify-center gap-3"
            >
              {generatingScript ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  <span>Gemini is Brainstorming Jokes...</span>
                </>
              ) : (
                <>
                  <span className="text-xl">✨</span>
                  <span>Auto-Create Funny Short with Gemini (1-Click)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── 3. Generated Funny Script Review Studio ── */}
        {scriptData && (
          <div className="glass-panel p-6 rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#181510] to-[#121214] flex flex-col gap-6 animate-slide-up">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                  Comedy Script Generated
                </span>
                <h3 className="text-xl font-bold text-white mt-1">{scriptData.title}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">{scriptData.description}</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={highlightColor}
                  onChange={(e) => setHighlightColor(e.target.value)}
                  title="Subtitle Highlight Color"
                  className="w-8 h-8 rounded border-none bg-transparent cursor-pointer"
                />
                <button
                  onClick={handleCompileFunnyVideo}
                  disabled={compiling}
                  className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-extrabold rounded-xl shadow-lg shadow-purple-500/20 disabled:opacity-50 transition"
                >
                  {compiling ? 'Compiling Video...' : '🎬 Render & Compile Short'}
                </button>
              </div>
            </div>

            {/* Script Segments breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scriptData.segments.map((seg, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-black/40 border border-white/10 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-amber-400">Scene #{idx + 1}</span>
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded">
                      Tone: {seg.tone}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white leading-relaxed">"{seg.narration}"</p>
                  <div className="text-[11px] text-zinc-400 border-t border-white/5 pt-2 flex items-center justify-between">
                    <span>🎬 Visual: {seg.video_description}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Tags */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="font-bold text-zinc-400">Tags:</span>
              {scriptData.tags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-300">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── 4. Rendering Progress & Logs ── */}
        {jobStatus && (
          <div className="glass-panel p-6 rounded-2xl border border-violet-500/30 flex flex-col gap-4 bg-[#111114]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  {jobStatus.status !== 'completed' && jobStatus.status !== 'failed' && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  )}
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
                Render Job: {jobStatus.job_id} ({jobStatus.status})
              </h3>
              <span className="text-xs font-bold text-violet-400">{jobStatus.progress}% Complete</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-purple-600 h-full transition-all duration-300"
                style={{ width: `${jobStatus.progress}%` }}
              ></div>
            </div>

            {/* Terminal logs */}
            <div className="bg-black/80 rounded-xl p-4 font-mono text-xs text-zinc-300 max-h-48 overflow-y-auto flex flex-col gap-1 border border-white/5">
              {jobStatus.logs && typeof jobStatus.logs === 'string'
                ? jobStatus.logs.split('\n').map((line: string, idx: number) => (
                    <div key={idx} className="leading-snug">{line}</div>
                  ))
                : (jobStatus.logs || []).map((line: string, idx: number) => (
                    <div key={idx} className="leading-snug">{line}</div>
                  ))}
              <div ref={logEndRef} />
            </div>

            {/* Action upon completion */}
            {jobStatus.status === 'completed' && (
              <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl">
                <div className="text-sm font-bold text-emerald-300">
                  🎉 Funny Short successfully compiled into local library!
                </div>
                <button
                  onClick={() => onNavigate('library')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition"
                >
                  View in Video Gallery →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
