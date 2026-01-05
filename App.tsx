import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameEngine } from './components/GameEngine';
import { GameStatus, EnemyTheme, PlayerMode } from './types';
import { initializeVisionModels } from './services/visionService';
import { Heart, Play, Loader2, Video, Pause, PlayCircle, User, Users, RotateCcw, Copy, Check, Download } from 'lucide-react';
import { MAX_LIVES } from './constants';

const GAME_OVER_CTAS = [
  "Think you can survive longer than me?",
  "Just dominated AR bugs! Your turn to shine!",
  "The swarm is evolving... can you keep up?",
  "Challenge accepted? Prove your AR skills!",
  "Beat my score or forever hold your peace!"
];

const GAME_URL = window.location.host; // Dynamically get the current URL

export default function App() {
  const [status, setStatus] = useState<GameStatus>(GameStatus.LANDING);
  const [theme, setTheme] = useState<EnemyTheme>('bugs');
  const [playerMode, setPlayerMode] = useState<PlayerMode>('1p');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState<number[]>([MAX_LIVES]);
  const [highScore, setHighScore] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [selectedScreenshotIdx, setSelectedScreenshotIdx] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [ctaText, setCtaText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('bug-swat-highscore');
    if (stored) setHighScore(parseInt(stored, 10));
  }, []);

  const handleStartRequest = async () => {
    setStatus(GameStatus.LOADING_MODELS);
    const modelsLoaded = await initializeVisionModels();
    if (modelsLoaded) {
      setStatus(GameStatus.CALIBRATING);
    } else {
      alert("Failed to load computer vision models. Please refresh and try again.");
      setStatus(GameStatus.LANDING);
    }
  };

  const handleCameraReady = useCallback(() => {
    setCameraReady(true);
  }, []);

  const startGame = useCallback(() => {
    setScore(0);
    setLives(playerMode === '2p' ? [MAX_LIVES, MAX_LIVES] : [MAX_LIVES]);
    setStatus(GameStatus.PLAYING);
    setScreenshots([]);
    setSelectedScreenshotIdx(0);
  }, [playerMode]);

  const handleBackToMenu = useCallback(() => {
    setStatus(GameStatus.LANDING);
  }, []);

  const togglePause = useCallback(() => {
    if (status === GameStatus.PLAYING) setStatus(GameStatus.PAUSED);
    if (status === GameStatus.PAUSED) setStatus(GameStatus.PLAYING);
  }, [status]);

  const handleGameOver = useCallback((finalScore: number, capturedScreenshots: string[]) => {
    setStatus(GameStatus.GAME_OVER);
    setScreenshots(capturedScreenshots);
    // Default to the last screenshot (usually the death moment)
    setSelectedScreenshotIdx(Math.max(0, capturedScreenshots.length - 1));
    
    // Pick random CTA
    const randomCta = GAME_OVER_CTAS[Math.floor(Math.random() * GAME_OVER_CTAS.length)];
    setCtaText(randomCta);

    setHighScore(prev => {
        if (finalScore > prev) {
            localStorage.setItem('bug-swat-highscore', finalScore.toString());
            return finalScore;
        }
        return prev;
    });
  }, []);

  // Generates a composite image with the screenshot, overlay text, score, and URL
  const generateCompositeBlob = async (imageUrl: string): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = imageUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        // 1. Draw Base Image
        ctx.drawImage(img, 0, 0);

        // 2. Draw Vignette/Gradient for text readability
        const gradient = ctx.createLinearGradient(0, canvas.height * 0.6, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(0.5, 'rgba(0,0,0,0.6)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 3. Draw Top CTA Text
        ctx.save();
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 10;
        ctx.font = 'bold 48px Roboto, sans-serif';
        ctx.fillStyle = '#ef4444'; // Red-500
        ctx.textAlign = 'center';
        ctx.fillText(ctaText.toUpperCase(), canvas.width / 2, 80);
        ctx.restore();

        // 4. Draw Score (Bottom Left)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Roboto, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('SCORE', 40, canvas.height - 80);
        ctx.font = '900 72px Roboto, sans-serif';
        ctx.fillStyle = '#10b981'; // Emerald-500
        ctx.fillText(score.toString(), 36, canvas.height - 25);

        // 5. Draw Watermark URL (Bottom Right)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '24px Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`Join the Fight at: ${GAME_URL}`, canvas.width - 40, canvas.height - 40);

        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png');
      };
      img.onerror = () => resolve(null);
    });
  };


  const handleShare = async () => {
    if (isGenerating || screenshots.length === 0) return;
    setIsGenerating(true);

    try {
      const blob = await generateCompositeBlob(screenshots[selectedScreenshotIdx]);
      if (blob) {
        // Prepare Clipboard Item
        // We try to write both text and image. Support varies by browser.
        const items: Record<string, Blob> = {};
        items['image/png'] = blob;
        const textBlob = new Blob([`Beat my score of ${score} in AR Shooter! Play here: ${window.location.href}`], { type: 'text/plain' });
        items['text/plain'] = textBlob;

        await navigator.clipboard.write([new ClipboardItem(items)]);

        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch (err) {
      console.error("Clipboard write failed", err);
      // Fallback: Just try to download it if clipboard fails
      if (screenshots[selectedScreenshotIdx]) {
         const link = document.createElement('a');
         link.href = screenshots[selectedScreenshotIdx];
         link.download = `bug-swat-${Date.now()}.jpg`;
         link.click();
         alert("Could not copy to clipboard (browser restriction). Saved image instead!");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate share message options
  const shareMessages = [
    `Just scored ${score} points swatting bugs with AR! Can you beat me? 🐛`,
    `AR Shooter champion here! ${score} points - think you can do better? 🎯`,
    `Finger guns out, bugs down! ${score} points in AR Shooter. Your turn! 👆`,
    `Reality check: ${score} points shooting virtual bugs. Beat that! 🌟`
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans select-none">
      {/* Header */}
      <header className="mb-4 text-center">
        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 tracking-tight">
          AR SHOOTER
        </h1>
        <p className="text-slate-400 mt-2 text-sm md:text-base">
          Shoot {theme} with finger guns • Protect your face!
        </p>
      </header>

      {/* Main Game Container */}
      <div className="relative w-full max-w-4xl aspect-video bg-black rounded-xl shadow-2xl overflow-hidden ring-1 ring-slate-700">
        
        <GameEngine 
          status={status}
          theme={theme}
          playerMode={playerMode}
          onGameOver={handleGameOver}
          onLivesChange={setLives}
          onScoreChange={setScore}
          onReady={handleCameraReady}
        />

        {/* --- UI Overlays --- */}

        {/* Pause Button */}
        {(status === GameStatus.PLAYING || status === GameStatus.PAUSED) && (
            <button 
              onClick={togglePause}
              className="absolute bottom-6 right-6 z-30 p-3 bg-slate-900/50 hover:bg-slate-800 text-white rounded-full transition-colors backdrop-blur-sm border border-white/10"
              title="Pause Game"
            >
              {status === GameStatus.PAUSED ? <PlayCircle className="w-8 h-8" /> : <Pause className="w-8 h-8" />}
            </button>
        )}

        {/* 1. Landing Screen */}
        {status === GameStatus.LANDING && (
          <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 p-6 text-center animate-in fade-in duration-500">
             <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <Video className="w-10 h-10 text-emerald-400" />
             </div>
             <h2 className="text-2xl font-bold text-white mb-2">Ready to play?</h2>
             
             <div className="flex flex-col gap-4 mb-8">
                {/* Player Mode */}
                <div className="flex gap-2 bg-slate-800 p-1 rounded-lg justify-center">
                   <button 
                     onClick={() => setPlayerMode('1p')}
                     className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-colors ${playerMode === '1p' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
                   >
                     <User className="w-4 h-4"/> 1 Player
                   </button>
                   <button 
                     onClick={() => setPlayerMode('2p')}
                     className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-colors ${playerMode === '2p' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
                   >
                     <Users className="w-4 h-4"/> 2 Players
                   </button>
                </div>

                {/* Enemy Selector */}
                <div className="flex gap-2 bg-slate-800 p-1 rounded-lg">
                    <button 
                    onClick={() => setTheme('bugs')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${theme === 'bugs' ? 'bg-emerald-500 text-slate-900' : 'text-slate-400 hover:text-white'}`}
                    >
                    Bugs
                    </button>
                    <button 
                    onClick={() => setTheme('zombies')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${theme === 'zombies' ? 'bg-emerald-500 text-slate-900' : 'text-slate-400 hover:text-white'}`}
                    >
                    Zombies
                    </button>
                    <button 
                    onClick={() => setTheme('spiders')}
                    className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${theme === 'spiders' ? 'bg-emerald-500 text-slate-900' : 'text-slate-400 hover:text-white'}`}
                    >
                    Spiders
                    </button>
                </div>
             </div>

             <ul className="text-slate-300 text-left space-y-3 mb-8 max-w-sm text-sm">
                <li className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-400 rounded-full"/> Allow camera access to begin.</li>
                <li className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-400 rounded-full"/> Use BOTH hands to shoot.</li>
                {playerMode === '2p' && (
                    <li className="flex items-center gap-2"><div className="w-2 h-2 bg-blue-400 rounded-full"/> P1 Left, P2 Right: Defend YOUR face!</li>
                )}
             </ul>
             <button 
               onClick={handleStartRequest}
               className="group relative px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-black rounded-full text-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/25 flex items-center gap-2"
             >
               START GAME
               <Play className="w-5 h-5 fill-current" />
             </button>
          </div>
        )}

        {/* 2. Loading Screen */}
        {status === GameStatus.LOADING_MODELS && (
          <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-10">
            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mb-4" />
            <p className="text-emerald-400 font-mono text-lg">Initializing AI Vision...</p>
          </div>
        )}

        {/* 3. Calibration / Ready Screen */}
        {status === GameStatus.CALIBRATING && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center z-10">
             {!cameraReady ? (
               <div className="flex flex-col items-center">
                 <Loader2 className="w-10 h-10 text-white animate-spin mb-2" />
                 <p className="text-white">Starting Camera...</p>
               </div>
             ) : (
               <div className="text-center animate-in fade-in zoom-in duration-300">
                 <div className="bg-black/50 p-6 rounded-2xl border border-white/10">
                   <h3 className="text-2xl font-bold text-white mb-2">Setup Check</h3>
                   <p className="text-slate-300 mb-6">
                       {playerMode === '2p' ? "Both players get in frame!" : "Center your face."}
                       <br/>Raise your index fingers.
                   </p>
                   <button 
                     onClick={startGame}
                     className="px-8 py-3 bg-white hover:bg-slate-200 text-slate-900 font-bold rounded-full transition-colors text-lg"
                   >
                     I'm Ready!
                   </button>
                 </div>
               </div>
             )}
          </div>
        )}

        {/* 4. HUD (Playing) */}
        {(status === GameStatus.PLAYING || status === GameStatus.PAUSED) && (
          <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
            
            {/* Top Bar: Lives */}
            <div className="flex justify-between items-start w-full">
                {/* P1 Lives */}
                <div className="flex flex-col gap-1 items-start">
                    {playerMode === '2p' && <span className="text-blue-400 font-bold text-xs bg-black/50 px-2 rounded">P1</span>}
                    <div className="flex items-center gap-1">
                        {Array.from({ length: MAX_LIVES }).map((_, i) => (
                        <Heart 
                            key={`p1-${i}`} 
                            className={`w-8 h-8 drop-shadow-md ${i < (lives[0] || 0) ? 'fill-red-500 text-red-600' : 'fill-slate-800 text-slate-700'}`} 
                        />
                        ))}
                    </div>
                </div>

                 {/* Score (Center) */}
                 <div className="flex flex-col items-center">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Score</div>
                    <div className="text-5xl font-black text-white drop-shadow-lg tabular-nums">
                        {score}
                    </div>
                 </div>

                {/* P2 Lives (Only in 2P) */}
                {playerMode === '2p' && (
                    <div className="flex flex-col gap-1 items-end">
                        <span className="text-green-400 font-bold text-xs bg-black/50 px-2 rounded">P2</span>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: MAX_LIVES }).map((_, i) => (
                            <Heart 
                                key={`p2-${i}`} 
                                className={`w-8 h-8 drop-shadow-md ${i < (lives[1] || 0) ? 'fill-red-500 text-red-600' : 'fill-slate-800 text-slate-700'}`} 
                            />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Paused Overlay */}
            {status === GameStatus.PAUSED && (
                 <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20 pointer-events-auto">
                    <h2 className="text-6xl font-black text-white tracking-widest uppercase mb-8">Paused</h2>
                    <div className="flex gap-4">
                        <button 
                            onClick={togglePause}
                            className="px-8 py-3 bg-white hover:bg-slate-200 text-slate-900 font-bold rounded-full transition-colors flex items-center gap-2"
                        >
                           <Play className="w-5 h-5" /> Resume
                        </button>
                        <button 
                            onClick={startGame}
                            className="px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-full transition-colors flex items-center gap-2"
                        >
                           <RotateCcw className="w-5 h-5" /> Restart
                        </button>
                    </div>
                 </div>
            )}
          </div>
        )}

        {/* 5. Game Over with Enhanced Share Flow */}
        {status === GameStatus.GAME_OVER && (
          <div className="absolute inset-0 bg-slate-900 z-40 flex flex-col md:flex-row overflow-hidden">
            
            {/* Left: Interactive Preview */}
            <div className="flex-1 relative bg-black flex items-center justify-center p-4">
                <div className="relative w-full max-w-lg aspect-video rounded-xl overflow-hidden shadow-2xl border border-slate-700">
                    {/* The Base Image */}
                    {screenshots.length > 0 && (
                        <img 
                            src={screenshots[selectedScreenshotIdx]} 
                            className="w-full h-full object-cover" 
                            alt="Game Over Screenshot"
                        />
                    )}
                    
                    {/* The Overlay (Mimics what is generated on the canvas) */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex flex-col justify-between p-6">
                         {/* Top: CTA */}
                         <div className="text-center pt-2">
                             <h2 className="text-2xl md:text-3xl font-black text-red-500 drop-shadow-md tracking-tight">
                                 {ctaText}
                             </h2>
                         </div>

                         {/* Bottom: Stats */}
                         <div className="flex justify-between items-end">
                             <div>
                                 <p className="text-xs font-bold text-slate-400">SCORE</p>
                                 <p className="text-5xl font-black text-emerald-400 leading-none">{score}</p>
                             </div>
                             <div className="text-right opacity-70">
                                 <p className="text-xs text-white">Join the Fight at:</p>
                                 <p className="text-sm font-bold text-white">{GAME_URL}</p>
                             </div>
                         </div>
                    </div>
                </div>
            </div>

            {/* Right: Controls & Gallery */}
            <div className="w-full md:w-80 bg-slate-800 border-l border-slate-700 p-6 flex flex-col gap-6 shadow-2xl z-50">
                <div className="text-center md:text-left">
                    <h2 className="text-3xl font-black text-white italic">GAME OVER</h2>
                    <p className="text-slate-400 text-sm">Select a moment to share</p>
                </div>

                {/* Gallery */}
                <div className="grid grid-cols-3 gap-2">
                    {screenshots.map((shot, idx) => (
                        <button
                            key={idx}
                            onClick={() => setSelectedScreenshotIdx(idx)}
                            className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${selectedScreenshotIdx === idx ? 'border-emerald-500 scale-105 shadow-emerald-500/50 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
                        >
                            <img src={shot} className="w-full h-full object-cover" alt={`Shot ${idx}`} />
                        </button>
                    ))}
                    {screenshots.length === 0 && (
                         <div className="col-span-3 text-center text-slate-500 text-xs py-4 italic">No screenshots captured</div>
                    )}
                </div>

                <div className="flex-1"></div>


                {/* Actions */}
                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleShare}
                        disabled={screenshots.length === 0}
                        className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${copied ? 'bg-slate-700 text-emerald-400' : 'bg-white hover:bg-emerald-50 text-slate-900 shadow-lg'}`}
                    >
                        {isGenerating ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : copied ? (
                            <>
                                <Check className="w-5 h-5" /> Copied Image & Link!
                            </>
                        ) : (
                            <>
                                <Copy className="w-5 h-5" /> Share Result
                            </>
                        )}
                    </button>

                    <button
                        onClick={startGame}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <RotateCcw className="w-5 h-5" /> PLAY AGAIN
                    </button>

                    <button
                         onClick={handleBackToMenu}
                         className="text-center text-slate-500 text-xs hover:text-slate-300 mt-2"
                    >
                        Back to Menu
                    </button>
                </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      {status === GameStatus.LANDING && (
        <div className="mt-6 flex flex-col md:flex-row gap-8 text-slate-500 text-sm animate-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                <span className="font-bold text-white">1</span>
            </div>
            <span>Face camera directly</span>
            </div>
            <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                <span className="font-bold text-white">2</span>
            </div>
            <span>Shoot glowing orbs!</span>
            </div>
            <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                <span className="font-bold text-white">3</span>
            </div>
            <span>Protect your face</span>
            </div>
        </div>
      )}
    </div>
  );
}
