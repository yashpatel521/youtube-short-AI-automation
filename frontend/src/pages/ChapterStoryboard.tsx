import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageShell from '../components/PageShell';

interface ChapterStoryboardProps {
  backendUrl: string;
  stories: any[];
  setStories: React.Dispatch<React.SetStateAction<any[]>>;
}

export default function ChapterStoryboard({ backendUrl, stories, setStories }: ChapterStoryboardProps) {
  const { storyId, chapterIdx } = useParams<{ storyId: string; chapterIdx: string }>();
  const navigate = useNavigate();
  const currentIdx = Number(chapterIdx);

  const [voice, setVoice] = useState('en-US-EmmaMultilingualNeural');
  const [compiling, setCompiling] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);

  useEffect(() => {
    if (!activeJobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${backendUrl}/api/video/status/${activeJobId}`);
        if (res.ok) {
          const data = await res.json();
          setJobStatus(data);

          if (data.status === 'completed') {
            clearInterval(interval);
            setActiveJobId(null);
            
            const reloadRes = await fetch(`${backendUrl}/api/stories`);
            if (reloadRes.ok) {
              const reloadData = await reloadRes.json();
              setStories(reloadData.stories || []);
            }
            setToast({ message: 'Chapter video compiled and storyboard images updated successfully!', type: 'success' });
          } else if (data.status === 'failed') {
            clearInterval(interval);
            setActiveJobId(null);
            setToast({ message: `Compilation failed: ${data.error || 'Unknown error'}`, type: 'error' });
          }
        }
      } catch (err) {
        console.error('Error polling job status:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJobId]);

  const story = stories.find(s => s.id === storyId);
  const chapter = story?.chapters[currentIdx];

  if (!story || !chapter) {
    return (
      <div className="animate-slide-up flex flex-col gap-6 p-6">
        <h2 className="text-xl font-bold">Chapter not found</h2>
        <button onClick={() => navigate(story ? `/story/${story.id}` : '/story_studio')} className="btn-secondary py-2 px-4 max-w-[200px]">
          Back
        </button>
      </div>
    );
  }

  const handleAddNewScene = () => {
    const newScene = { 
      id: `sc_${Date.now()}`,
      title: `Scene ${(chapter.scenes || []).length + 1}`, 
      narration: '', 
      image_prompt: '',
      image_prompts: [],
      image_url: '',
      image_urls: []
    };
    const updatedScenes = [...(chapter.scenes || []), newScene];
    
    // Sync update back to story chapters
    const updatedChapters = story.chapters.map((c: any, idx: number) => {
      return idx === currentIdx ? { ...c, scenes: updatedScenes } : c;
    });

    setStories(prev => prev.map(s => s.id === story.id ? { ...s, chapters: updatedChapters } : s));
    
    // Navigate straight to editing the new scene
    navigate(`/story/${story.id}/${currentIdx}/${updatedScenes.length - 1}`);
  };

  const handleDeleteScene = (idxToRemove: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (chapter.scenes.length <= 1) {
      alert('A chapter video must have at least one scene slide.');
      return;
    }
    if (!confirm('Are you sure you want to delete this scene slide?')) return;
    
    const updatedScenes = chapter.scenes.filter((_: any, idx: number) => idx !== idxToRemove);
    const updatedChapters = story.chapters.map((c: any, idx: number) => {
      return idx === currentIdx ? { ...c, scenes: updatedScenes } : c;
    });

    setStories(prev => prev.map(s => s.id === story.id ? { ...s, chapters: updatedChapters } : s));
  };

  const handleCompileChapterVideo = async () => {
    setCompiling(true);
    setToast({ message: 'Sending storytelling scenes to video compile queue...', type: 'success' });

    try {
      const res = await fetch(`${backendUrl}/api/stories/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: chapter.title,
          style: story.style,
          voice,
          chapters: chapter.scenes,
          story_id: story.id,
          chapter_idx: currentIdx
        })
      });

      if (res.ok) {
        const data = await res.json();
        setActiveJobId(data.job_id);
        setToast({ 
          message: `Chapter video "${chapter.title}" compile initiated! Live progress logs will show below.`, 
          type: 'success' 
        });
      } else {
        const data = await res.json();
        setToast({ message: data.detail || 'Failed to compile chapter video.', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Error communicating with server.', type: 'error' });
    } finally {
      setCompiling(false);
    }
  };

  const handleAIGenerateScenes = async () => {
    const defaultPrompt = `Chapter about: ${chapter.title} in the story playlist "${story.title}"`;
    const userPrompt = prompt(
      "Enter a description or topic for this chapter video (or leave blank to auto-generate based on chapter name):",
      defaultPrompt
    );
    if (userPrompt === null) return; // user cancelled

    const topicQuery = userPrompt.trim() || defaultPrompt;
    setCompiling(true);
    setToast({ message: 'Generating scenes script with Gemini AI...', type: 'success' });

    // Compile narration progression of previous chapters for context continuity
    let prevContext = "";
    story.chapters.slice(0, currentIdx).forEach((ch: any, cIdx: number) => {
      prevContext += `Chapter ${cIdx + 1}: "${ch.title}"\n`;
      ch.scenes?.forEach((sc: any, sIdx: number) => {
        if (sc.narration) {
          prevContext += `  - Scene ${sIdx + 1}: ${sc.narration}\n`;
        }
      });
      prevContext += "\n";
    });

    try {
      const res = await fetch(`${backendUrl}/api/stories/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicQuery,
          style: story.style || 'kids_cartoon',
          duration: 240, // 4 minutes video (approx 24 scenes)
          story_title: story.title,
          previous_context: prevContext || undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        const newScenes = data.chapters.map((ch: any) => {
          const prompts = ch.image_prompts || [];
          return {
            title: ch.title || 'Scene Segment',
            narration: ch.narration,
            image_prompt: prompts.join('\n'),
            image_prompts: prompts
          };
        });

        const updatedChapters = story.chapters.map((c: any, idx: number) => {
          return idx === currentIdx ? { ...c, scenes: newScenes } : c;
        });

        setStories(prev => prev.map(s => s.id === story.id ? { ...s, chapters: updatedChapters } : s));
        setToast({ message: `Successfully generated ${newScenes.length} scenes for "${chapter.title}"!`, type: 'success' });
      } else {
        const data = await res.json();
        setToast({ message: data.detail || 'Failed to generate scenes with AI.', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Error communicating with server.', type: 'error' });
    } finally {
      setCompiling(false);
    }
  };

  const handleGenerateStoryboardImages = async (allBeats: boolean = false) => {
    setCompiling(true);
    setToast({ message: allBeats ? 'Generating all 3 illustration beats for each storyboard scene...' : 'Generating primary preview illustration images for all storyboard scenes...', type: 'success' });
    
    try {
      const res = await fetch(`${backendUrl}/api/stories/generate-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story_id: story.id,
          chapter_idx: currentIdx,
          style: story.style,
          scenes: chapter.scenes,
          all_beats: allBeats
        })
      });

      if (res.ok) {
        setToast({ message: 'Storyboard image generation task started! When complete, images will load on the cards below.', type: 'success' });
        
        // Poll for update: we reload the stories from database after 15 seconds to let the images populate!
        setTimeout(async () => {
          try {
            const reloadRes = await fetch(`${backendUrl}/api/stories`);
            if (reloadRes.ok) {
              const reloadData = await reloadRes.json();
              setStories(reloadData.stories || []);
              setToast({ message: 'Storyboard scenes images loaded successfully!', type: 'success' });
            }
          } catch (e) {
            console.error("Failed to reload stories:", e);
          }
        }, 15000);
      } else {
        const data = await res.json();
        setToast({ message: data.detail || 'Failed to start storyboard image generation.', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Error communicating with server.', type: 'error' });
    } finally {
      setCompiling(false);
    }
  };



  return (
    <PageShell
      title={chapter.title}
      breadcrumbs={[
        { label: 'Story Studio', path: '/story_studio' },
        { label: story.title, path: `/story/${story.id}` },
        { label: chapter.title }
      ]}
      headerActions={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] text-zinc-500 font-semibold whitespace-nowrap">Voice</label>
            <select
              className="form-input text-xs py-1 px-2.5 bg-black/40 border-white/10 w-auto"
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
            >
              <option value="en-US-EmmaMultilingualNeural">Emma (Premium Kids)</option>
              <option value="en-US-AndrewMultilingualNeural">Andrew (Premium Bold)</option>
              <option value="en-GB-SoniaNeural">Sonia (Premium British)</option>
            </select>
          </div>

          <button
            onClick={() => handleGenerateStoryboardImages(false)}
            disabled={compiling || chapter.scenes.length === 0}
            className="btn-secondary py-1 px-3 text-xs font-bold border border-white/10"
          >
            🎨 Gen Preview
          </button>

          <button
            onClick={() => handleGenerateStoryboardImages(true)}
            disabled={compiling || chapter.scenes.length === 0}
            className="btn-secondary py-1 px-3 text-xs font-bold border border-white/10"
          >
            🎨 Gen All 3 Images
          </button>

          <button
            onClick={handleCompileChapterVideo}
            disabled={compiling || chapter.scenes.length === 0}
            className="btn-primary py-1 px-3 text-xs font-bold"
          >
            ⚡ Compile
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">

      {/* Live Video Compilation Logger */}
      {jobStatus && (jobStatus.status === 'pending' || jobStatus.status === 'rendering') && (
        <div className="glass-panel p-5 border border-violet-500/20 bg-violet-950/5 rounded-2xl flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="animate-ping w-2.5 h-2.5 rounded-full bg-violet-500 block" />
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                Compiling Chapter Video ({jobStatus.progress}%)
              </h4>
            </div>
            <span className="text-[10px] text-gray-400 font-bold bg-white/5 px-2 py-0.5 rounded">
              Status: {jobStatus.status}
            </span>
          </div>

          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-violet-500 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_#8b5cf6]"
              style={{ width: `${jobStatus.progress}%` }}
            />
          </div>

          <div className="flex flex-col gap-1.5 mt-1">
            <span className="text-[10px] font-extrabold uppercase text-gray-500 tracking-wide">Live Compilation Terminal Logger</span>
            <pre className="text-[10px] font-mono text-green-400 bg-black/45 p-4 rounded-xl border border-white/5 overflow-y-auto max-h-[140px] whitespace-pre-wrap leading-relaxed">
              {jobStatus.logs || 'Initializing logger connection...'}
            </pre>
          </div>
        </div>
      )}

      {/* Playable Chapter Preview */}
      {chapter.compiled_video && (
        <div className="glass-panel p-5 border border-white/5 rounded-2xl flex flex-col gap-3">
          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
            🎬 Playable Chapter Preview
          </h4>
          <div className="aspect-video w-full max-w-2xl bg-black rounded-xl overflow-hidden border border-white/5 shadow-2xl relative">
            <video 
              src={`${backendUrl}/api/video/preview/${chapter.compiled_video}`} 
              controls 
              className="w-full h-full object-contain" 
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5 mt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Scene Slides (Chapter Timeline)</h3>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleAIGenerateScenes}
              disabled={compiling}
              className="btn-primary text-xs font-bold py-2 px-4 shadow-lg shadow-violet-500/25 cursor-pointer bg-violet-600 hover:bg-violet-500 border-0 flex items-center justify-center gap-1.5"
            >
              {compiling ? '✨ Generating...' : '✨ AI Generate Scenes'}
            </button>
            
            <button
              onClick={handleAddNewScene}
              className="btn-secondary text-xs font-bold py-2 px-4 border border-violet-500/20 bg-violet-500/5 text-violet-300 hover:bg-violet-500/10 cursor-pointer"
            >
              ➕ Add New Scene
            </button>
          </div>
        </div>

        {/* Scene Cards Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chapter.scenes?.map((scene: any, sIdx: number) => {
            const preview = scene.narration 
              ? (scene.narration.length > 90 ? `${scene.narration.substring(0, 90)}...` : scene.narration)
              : 'Add scene details and narration script text...';
            const sceneSeconds = Math.max(3, Math.ceil((scene.narration || '').split(/\s+/).filter(Boolean).length / 2.2));

            return (
              <div
                key={sIdx}
                onClick={() => navigate(`/story/${story.id}/${currentIdx}/${sIdx}`)}
                className="glass-panel p-5 flex flex-col justify-between border border-white/5 hover:border-violet-500/20 hover:bg-violet-950/[0.01] transition-all cursor-pointer min-h-[160px] group"
              >
                <div className="flex flex-col gap-2">
                  {scene.image_url && (
                    <div className="w-full h-32 rounded-xl overflow-hidden mb-2 border border-white/5 relative group-hover:border-violet-500/30 transition-all">
                      <img 
                        src={scene.image_url.startsWith('story_') ? `${backendUrl}/api/stories/scene/image/${scene.image_url}` : `${backendUrl}/api/video/preview/${scene.image_url}`} 
                        alt={scene.title || `Scene ${sIdx + 1}`} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-violet-400 font-extrabold uppercase tracking-wider block">
                      Scene #{sIdx + 1}
                    </span>
                    <span className="text-[9px] text-gray-400 font-bold bg-white/5 px-1.5 py-0.5 rounded">
                      ⏱️ {sceneSeconds}s
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-white group-hover:text-violet-300 transition-colors line-clamp-1">
                    {scene.title || `Scene ${sIdx + 1}`}
                  </h4>
                  <p className="text-[11px] text-gray-400 group-hover:text-gray-300 leading-relaxed line-clamp-2 mt-0.5">
                    {preview}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-3 text-[9px] text-gray-500">
                  <span className="truncate flex-1">Prompt: {scene.image_prompt || 'No image prompt yet'}</span>
                  {chapter.scenes.length > 1 && (
                    <button
                      onClick={(e) => handleDeleteScene(sIdx, e)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 p-1 cursor-pointer bg-transparent border-0 text-[10px] ml-2"
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Quick Add Scene Card */}
          <div
            onClick={handleAddNewScene}
            className="glass-panel p-5 flex flex-col items-center justify-center border-dashed border-white/10 hover:border-violet-500/35 hover:bg-violet-500/5 transition-all cursor-pointer min-h-[160px] text-gray-400 hover:text-violet-300"
          >
            <span className="text-xl mb-1">➕</span>
            <span className="text-xs font-bold">Add New Scene</span>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div className={`glass-panel p-4 pr-12 rounded-2xl border flex items-center gap-3 shadow-2xl max-w-sm ${toast.type === 'error' ? 'border-red-500/25 bg-red-950/20 text-red-300' : 'border-violet-500/25 bg-violet-950/20 text-violet-300'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-violet-500/10`}>
              ⚡
            </div>
            <div className="text-xs font-semibold leading-relaxed">{toast.message}</div>
            <button 
              onClick={() => setToast(null)}
              className="absolute top-3 right-3 text-gray-400 hover:text-white cursor-pointer bg-transparent border-0 text-[10px]"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      </div>
    </PageShell>
  );
}
