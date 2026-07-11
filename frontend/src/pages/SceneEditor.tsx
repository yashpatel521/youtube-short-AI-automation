import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageShell from '../components/PageShell';

interface SceneEditorProps {
  backendUrl: string;
  stories: any[];
  setStories: React.Dispatch<React.SetStateAction<any[]>>;
}

export default function SceneEditor({ backendUrl, stories, setStories }: SceneEditorProps) {
  const { storyId, chapterIdx, sceneIdx } = useParams<{ storyId: string; chapterIdx: string; sceneIdx: string }>();
  const navigate = useNavigate();
  
  const currentChIdx = Number(chapterIdx);
  const currentScIdx = Number(sceneIdx);

  const [generatingNarration, setGeneratingNarration] = useState(false);
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [generatingAllImages, setGeneratingAllImages] = useState(false);
  const [loadingBeats, setLoadingBeats] = useState<{ [key: number]: boolean }>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const story = stories.find(s => s.id === storyId);
  const chapter = story?.chapters[currentChIdx];
  const scene = chapter?.scenes[currentScIdx];

  const [localTitle, setLocalTitle] = useState('');
  const [localNarration, setLocalNarration] = useState('');
  const [localImagePrompt, setLocalImagePrompt] = useState('');

  // Sync local state when the active scene changes
  useEffect(() => {
    if (scene) {
      setLocalTitle(scene.title || '');
      setLocalNarration(scene.narration || '');
      setLocalImagePrompt(scene.image_prompts ? scene.image_prompts.join('\n') : (scene.image_prompt || ''));
    }
  }, [storyId, chapterIdx, sceneIdx, scene]);

  const hasChanges = 
    localTitle !== (scene?.title || '') ||
    localNarration !== (scene?.narration || '') ||
    localImagePrompt !== (scene?.image_prompts ? scene.image_prompts.join('\n') : (scene?.image_prompt || ''));

  const handleSaveChanges = () => {
    if (!story || !chapter || !scene) return;

    const updatedScenes = chapter.scenes.map((s: any, idx: number) => {
      if (idx === currentScIdx) {
        return {
          ...s,
          title: localTitle,
          narration: localNarration,
          image_prompt: localImagePrompt,
          image_prompts: localImagePrompt.split('\n').filter((p: string) => p.trim().length > 0)
        };
      }
      return s;
    });

    const updatedChapters = story.chapters.map((c: any, idx: number) => {
      return idx === currentChIdx ? { ...c, scenes: updatedScenes } : c;
    });

    setStories(prev => prev.map(s => s.id === story.id ? { ...s, chapters: updatedChapters } : s));
    setToast({ message: 'Changes saved successfully!', type: 'success' });
  };



  const handleAIGenerateNarration = async () => {
    if (!story || !scene || !localTitle) return;
    setGeneratingNarration(true);
    setToast(null);

    try {
      const res = await fetch(`${backendUrl}/api/stories/scene/generate-narration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story_id: story.id,
          chapter_idx: currentChIdx,
          scene_title: localTitle
        })
      });

      if (res.ok) {
        const data = await res.json();
        setLocalNarration(data.narration);
        setToast({ message: 'AI generated scene narration successfully!', type: 'success' });
      } else {
        const data = await res.json();
        setToast({ message: data.detail || 'Failed to generate narration.', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Error communicating with server.', type: 'error' });
    } finally {
      setGeneratingNarration(false);
    }
  };

  const handleAIGeneratePrompts = async () => {
    if (!story || !scene || !localNarration) {
      alert("Please write the scene narration first!");
      return;
    }
    setGeneratingPrompts(true);
    setToast(null);

    try {
      const res = await fetch(`${backendUrl}/api/stories/scene/generate-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narration: localNarration,
          style: story.style || 'kids_cartoon'
        })
      });

      if (res.ok) {
        const data = await res.json();
        const textVal = data.image_prompts ? data.image_prompts.join('\n') : '';
        setLocalImagePrompt(textVal);
        setToast({ message: 'AI generated image prompts successfully!', type: 'success' });
      } else {
        const data = await res.json();
        setToast({ message: data.detail || 'Failed to generate prompts.', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Error communicating with server.', type: 'error' });
    } finally {
      setGeneratingPrompts(false);
    }
  };

  const handleGenerateImage = async (beatIdx: number, promptText: string) => {
    if (!story || !chapter || !scene) return;
    setLoadingBeats(prev => ({ ...prev, [beatIdx]: true }));
    setToast(null);

    try {
      const res = await fetch(`${backendUrl}/api/stories/scene/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story_id: story.id,
          chapter_idx: currentChIdx,
          scene_idx: currentScIdx,
          beat_idx: beatIdx,
          prompt: promptText,
          style: story.style || 'kids_cartoon'
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        const updatedScenes = chapter.scenes.map((s: any, idx: number) => {
          if (idx === currentScIdx) {
            return {
              ...s,
              image_url: data.image_url,
              image_urls: data.image_urls
            };
          }
          return s;
        });

        const updatedChapters = story.chapters.map((c: any, idx: number) => {
          return idx === currentChIdx ? { ...c, scenes: updatedScenes } : c;
        });

        setStories(prev => prev.map(s => s.id === story.id ? { ...s, chapters: updatedChapters } : s));
        setToast({ message: `Image for Beat #${beatIdx + 1} generated successfully!`, type: 'success' });
      } else {
        const data = await res.json();
        setToast({ message: data.detail || 'Failed to generate image.', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Error communicating with server.', type: 'error' });
    } finally {
      setLoadingBeats(prev => ({ ...prev, [beatIdx]: false }));
    }
  };

  const handleDeleteImage = async (beatIdx: number) => {
    if (!story || !chapter || !scene) return;
    if (!confirm('Are you sure you want to delete this generated image?')) return;
    setLoadingBeats(prev => ({ ...prev, [beatIdx]: true }));
    setToast(null);

    try {
      const res = await fetch(`${backendUrl}/api/stories/scene/delete-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story_id: story.id,
          chapter_idx: currentChIdx,
          scene_idx: currentScIdx,
          beat_idx: beatIdx
        })
      });

      if (res.ok) {
        const data = await res.json();
        
        const updatedScenes = chapter.scenes.map((s: any, idx: number) => {
          if (idx === currentScIdx) {
            return {
              ...s,
              image_url: data.image_url,
              image_urls: data.image_urls
            };
          }
          return s;
        });

        const updatedChapters = story.chapters.map((c: any, idx: number) => {
          return idx === currentChIdx ? { ...c, scenes: updatedScenes } : c;
        });

        setStories(prev => prev.map(s => s.id === story.id ? { ...s, chapters: updatedChapters } : s));
        setToast({ message: `Image for Beat #${beatIdx + 1} deleted successfully.`, type: 'success' });
      } else {
        const data = await res.json();
        setToast({ message: data.detail || 'Failed to delete image.', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Error communicating with server.', type: 'error' });
    } finally {
      setLoadingBeats(prev => ({ ...prev, [beatIdx]: false }));
    }
  };

  const handleGenerateAllImages = async () => {
    if (!story || !chapter || !scene) return;
    const prompts = localImagePrompt.split('\n').filter((p: string) => p.trim().length > 0);
    if (prompts.length === 0) {
      alert("Please write or AI generate illustration prompts first!");
      return;
    }

    setGeneratingAllImages(true);
    setToast(null);

    try {
      for (let i = 0; i < prompts.length; i++) {
        const promptText = prompts[i];
        setLoadingBeats(prev => ({ ...prev, [i]: true }));
        
        const res = await fetch(`${backendUrl}/api/stories/scene/generate-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            story_id: story.id,
            chapter_idx: currentChIdx,
            scene_idx: currentScIdx,
            beat_idx: i,
            prompt: promptText,
            style: story.style || 'kids_cartoon'
          })
        });

        if (res.ok) {
          const data = await res.json();
          setStories(prev => {
            const prevStory = prev.find(s => s.id === story.id);
            const prevChapter = prevStory?.chapters[currentChIdx];
            const updatedScenes = prevChapter.scenes.map((s: any, idx: number) => {
              if (idx === currentScIdx) {
                return {
                  ...s,
                  image_url: data.image_url,
                  image_urls: data.image_urls
                };
              }
              return s;
            });
            const updatedChapters = prevStory.chapters.map((c: any, idx: number) => {
              return idx === currentChIdx ? { ...c, scenes: updatedScenes } : c;
            });
            return prev.map(s => s.id === story.id ? { ...s, chapters: updatedChapters } : s);
          });
        } else {
          const data = await res.json();
          setToast({ message: `Beat #${i + 1} failed: ${data.detail || 'Drawing error.'}`, type: 'error' });
          setLoadingBeats(prev => ({ ...prev, [i]: false }));
          return;
        }
        
        setLoadingBeats(prev => ({ ...prev, [i]: false }));
      }
      setToast({ message: 'All scene images generated successfully!', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Error generating scene images.', type: 'error' });
    } finally {
      setGeneratingAllImages(false);
    }
  };

  if (!story || !chapter || !scene) {
    return (
      <div className="animate-slide-up flex flex-col gap-6 p-6">
        <h2 className="text-xl font-bold">Scene not found</h2>
        <button onClick={() => navigate(story && chapter ? `/story/${story.id}/${currentChIdx}` : '/story_studio')} className="btn-secondary py-2 px-4 max-w-[200px]">
          Back
        </button>
      </div>
    );
  }

  const handleAddNewScene = () => {
    const prevScene = chapter.scenes && chapter.scenes.length > 0 ? chapter.scenes[chapter.scenes.length - 1] : null;
    const newScene = { 
      title: `Scene ${chapter.scenes.length + 1}`, 
      narration: prevScene ? prevScene.narration : '', 
      image_prompt: prevScene ? prevScene.image_prompt : '',
      image_prompts: prevScene ? [...(prevScene.image_prompts || [])] : []
    };
    const updatedScenes = [...chapter.scenes, newScene];
    
    const updatedChapters = story.chapters.map((c: any, idx: number) => {
      return idx === currentChIdx ? { ...c, scenes: updatedScenes } : c;
    });

    setStories(prev => prev.map(s => s.id === story.id ? { ...s, chapters: updatedChapters } : s));
    
    // Redirect to the newly created scene editor
    navigate(`/story/${story.id}/${currentChIdx}/${updatedScenes.length - 1}`);
  };

  const handleRemoveScene = () => {
    if (chapter.scenes.length <= 1) {
      alert('A chapter video must have at least one scene slide.');
      return;
    }
    if (!confirm('Are you sure you want to remove this scene?')) return;
    
    const updatedScenes = chapter.scenes.filter((_: any, idx: number) => idx !== currentScIdx);
    const updatedChapters = story.chapters.map((c: any, idx: number) => {
      return idx === currentChIdx ? { ...c, scenes: updatedScenes } : c;
    });

    setStories(prev => prev.map(s => s.id === story.id ? { ...s, chapters: updatedChapters } : s));
    
    // Navigate to previous scene or storyboard page
    const nextIdx = Math.max(0, currentScIdx - 1);
    navigate(`/story/${story.id}/${currentChIdx}/${nextIdx}`);
  };

  return (
    <PageShell
      title={`Scene #${currentScIdx + 1}`}
      breadcrumbs={[
        { label: 'Story Studio', path: '/story_studio' },
        { label: story.title, path: `/story/${story.id}` },
        { label: chapter.title, path: `/story/${story.id}/${currentChIdx}` },
        { label: `Scene #${currentScIdx + 1}` }
      ]}
      headerActions={
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleSaveChanges}
              className="text-xs font-bold py-1.5 px-3 bg-violet-600 hover:bg-violet-500 text-white rounded-lg cursor-pointer flex items-center gap-1.5 shadow-md shadow-violet-500/20 border-0"
            >
              💾 Save Changes
            </button>
          )}

          <button
            onClick={handleRemoveScene}
            disabled={chapter.scenes.length <= 1}
            className="text-xs font-bold py-1.5 px-3 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-300 rounded-lg disabled:opacity-30 cursor-pointer"
          >
            🗑️ Remove
          </button>
          
          <button
            onClick={handleAddNewScene}
            className="btn-secondary text-xs font-bold py-1.5 px-3"
          >
            ➕ Add Scene
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">

      <div className="glass-panel p-6 flex flex-col gap-6 border border-white/5 bg-white/[0.01] mt-2">
        <div className="flex flex-col gap-2 border-b border-white/5 pb-4">
          <label className="text-xs font-extrabold uppercase text-gray-400 tracking-wide">Scene Title</label>
          <input
            type="text"
            className="form-input text-sm py-2 px-3 bg-black/35 text-white"
            placeholder="Enter scene title (e.g. 'Rusty and the Owl')"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
          />
        </div>



        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold uppercase text-gray-400 tracking-wide">Narration Text (Spoken Story segment)</label>
              <button
                type="button"
                onClick={handleAIGenerateNarration}
                disabled={generatingNarration}
                className="text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 bg-transparent border-0 cursor-pointer"
              >
                {generatingNarration ? '⚡ Writing...' : '✨ AI Generate Narration'}
              </button>
            </div>
            <textarea
              className="form-input text-sm min-h-[220px] resize-y py-3 px-4 bg-black/35 text-gray-100"
              placeholder="Type or edit the story details for this scene slide..."
              value={localNarration}
              onChange={(e) => setLocalNarration(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold uppercase text-gray-400 tracking-wide">
                Illustration Image Prompts (One prompt per line)
              </label>
              <button
                type="button"
                onClick={handleAIGeneratePrompts}
                disabled={generatingPrompts || !localNarration}
                className="text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 bg-transparent border-0 cursor-pointer disabled:opacity-40"
              >
                {generatingPrompts ? '⚡ Generating...' : localImagePrompt ? '🔄 Regenerate Prompts' : '✨ AI Generate Prompts'}
              </button>
            </div>
            <textarea
              className="form-input text-sm min-h-[220px] resize-y py-3 px-4 bg-black/35 text-gray-100"
              placeholder="Type each image prompt on a new line (e.g.&#10;A cute little red fox in the forest&#10;The fox finds a silver key on the grass&#10;The fox holds the key proudly)"
              value={localImagePrompt}
              onChange={(e) => setLocalImagePrompt(e.target.value)}
            />
          </div>
        </div>

        {/* Storyboard Visual Beats Board */}
        <div className="flex flex-col gap-4 border-t border-white/5 pt-6 mt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              🎨 Storyboard Visual Beats
            </h3>
            
            <button
              type="button"
              onClick={handleGenerateAllImages}
              disabled={generatingAllImages || localImagePrompt.split('\n').filter((p: string) => p.trim().length > 0).length === 0}
              className="text-[10px] font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1.5 bg-transparent border-0 cursor-pointer disabled:opacity-40"
            >
              {generatingAllImages ? '⚡ Drawing All...' : '🎨 Generate All Images'}
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {(localImagePrompt.split('\n').filter((p: string) => p.trim().length > 0).length > 0 
              ? localImagePrompt.split('\n').filter((p: string) => p.trim().length > 0) 
              : ["a beautiful fantasy scene illustration"]
            ).map((promptText: string, pIdx: number) => {
              const hasImage = scene.image_urls && scene.image_urls[pIdx];
              const imgFilename = hasImage ? scene.image_urls[pIdx] : null;
              
              return (
                <div 
                  key={pIdx} 
                  className="flex flex-col gap-3 p-4 rounded-xl border border-white/5 bg-black/20 hover:border-violet-500/10 transition-all duration-300"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-violet-400 bg-violet-950/20 border border-violet-500/10 px-2 py-0.5 rounded-full">
                      BEAT #{pIdx + 1}
                    </span>
                    {hasImage ? (
                      <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 block" />
                        Generated
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold text-amber-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 block" />
                        Pending compile
                      </span>
                    )}
                  </div>
                  
                  {hasImage && imgFilename ? (
                    <div className="aspect-video w-full rounded-lg overflow-hidden border border-white/5 relative bg-black group">
                      <img 
                        src={imgFilename.startsWith('story_') ? `${backendUrl}/api/stories/scene/image/${imgFilename}` : `${backendUrl}/api/video/preview/${imgFilename}`} 
                        alt={`Beat #${pIdx + 1}`} 
                        className="w-full h-full object-cover" 
                      />
                      <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleGenerateImage(pIdx, promptText)}
                          disabled={loadingBeats[pIdx]}
                          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded text-[10px] font-bold border-0 cursor-pointer flex items-center gap-1"
                        >
                          {loadingBeats[pIdx] ? 'Drawing...' : '🔄 Redraw'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteImage(pIdx)}
                          disabled={loadingBeats[pIdx]}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-bold border-0 cursor-pointer flex items-center gap-1"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video w-full rounded-lg border border-dashed border-white/10 flex flex-col items-center justify-center bg-white/[0.01] gap-2 p-4">
                      <span className="text-xl">🎨</span>
                      <button
                        type="button"
                        onClick={() => handleGenerateImage(pIdx, promptText)}
                        disabled={loadingBeats[pIdx] || !promptText.trim()}
                        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-[10px] font-bold border-0 cursor-pointer disabled:opacity-40"
                      >
                        {loadingBeats[pIdx] ? 'Drawing...' : '🎨 Generate Image'}
                      </button>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-1 mt-1">
                    <span className="text-[10px] font-extrabold uppercase text-gray-500 tracking-wide">Prompt Used</span>
                    <p className="text-xs text-gray-300 font-medium italic line-clamp-3 leading-relaxed">
                      "{promptText}"
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scene Navigation Steppers */}
        <div className="flex justify-between items-center border-t border-white/5 pt-5 mt-4">
          <button
            onClick={() => navigate(`/story/${story.id}/${currentChIdx}/${currentScIdx - 1}`)}
            disabled={currentScIdx === 0}
            className="btn-secondary text-xs py-2 px-4 border border-white/10 hover:bg-white/5 font-bold disabled:opacity-30 disabled:pointer-events-none"
          >
            ← Previous Scene
          </button>

          <span className="text-xs text-gray-400 font-bold">
            Scene {currentScIdx + 1} of {chapter.scenes.length}
          </span>

          <button
            onClick={() => navigate(`/story/${story.id}/${currentChIdx}/${currentScIdx + 1}`)}
            disabled={currentScIdx === chapter.scenes.length - 1}
            className="btn-secondary text-xs py-2 px-4 border border-white/10 hover:bg-white/5 font-bold disabled:opacity-30 disabled:pointer-events-none"
          >
            Next Scene →
          </button>
        </div>
      </div>

      {/* Toast Alert */}
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
