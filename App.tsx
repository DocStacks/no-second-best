import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameEngine } from './components/GameEngine';
import { GameStatus, EnemyTheme, PlayerMode } from './types';
import { initializeVisionModels } from './services/visionService';
import { Heart, Play, Loader2, Video, Pause, PlayCircle, User, RotateCcw, Copy, Check, Download, Share2 } from 'lucide-react';
import { MAX_LIVES } from './constants';

const GAME_OVER_CTAS = [
  "THERE IS NO SECOND BEST",
  "BITCOIN IS THE BEST TREASURY RESERVE ASSET",
  "BITCOIN IS DIGITAL GOLD",
  "THERE IS ONLY ONE BITCOIN",
  "BITCOIN IS THE BEST FORM OF MONEY"
];

const GAME_URL = window.location.host; // Dynamically get the current URL

export default function App() {
  const [status, setStatus] = useState<GameStatus>(GameStatus.LANDING);
  const theme: EnemyTheme = 'bitcoin';
  const playerMode: PlayerMode = '1p';
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState<number[]>([MAX_LIVES]);
  const [highScore, setHighScore] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [selectedScreenshotIdx, setSelectedScreenshotIdx] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const [ctaText, setCtaText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
      setIsMobile(mobile);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('bitcoin-ar-highscore');
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
            localStorage.setItem('bitcoin-ar-highscore', finalScore.toString());
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

        // 2. Draw Enhanced Vignette with dual gradient
        const gradient = ctx.createLinearGradient(0, canvas.height * 0.5, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(0.4, 'rgba(0,0,0,0.3)');
        gradient.addColorStop(0.8, 'rgba(0,0,0,0.8)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.95)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add top gradient for CTA text
        const topGradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.3);
        topGradient.addColorStop(0, 'rgba(0,0,0,0.7)');
        topGradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = topGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height * 0.3);

        // 3. Draw Top CTA Text with better styling
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 4;
        
        // Wrap text if too long
        const maxWidth = canvas.width - 80;
        const words = ctaText.toUpperCase().split(' ');
        let line = '';
        let y = 60;
        const lineHeight = 52;
        
        ctx.font = 'bold 46px Roboto, sans-serif';
        ctx.fillStyle = '#f97316'; // Orange-500
        ctx.textAlign = 'center';
        
        for (let i = 0; i < words.length; i++) {
          const testLine = line + words[i] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && i > 0) {
            ctx.fillText(line.trim(), canvas.width / 2, y);
            line = words[i] + ' ';
            y += lineHeight;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line.trim(), canvas.width / 2, y);
        ctx.restore();

        // 4. Draw Score Box (Bottom Left) - Enhanced
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 15;
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Roboto, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('SCORE', 40, canvas.height - 100);
        
        // Orange glow for score number
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 20;
        ctx.font = '900 80px Roboto, sans-serif';
        ctx.fillStyle = '#fb923c'; // Orange-400
        ctx.fillText(score.toString(), 36, canvas.height - 30);
        ctx.restore();

        // 5. Draw Enhanced Watermark (Bottom Right)
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 10;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '20px Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('Play at:', canvas.width - 40, canvas.height - 60);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.font = 'bold 26px Roboto, sans-serif';
        ctx.fillText(GAME_URL, canvas.width - 40, canvas.height - 30);
        ctx.restore();

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
      if (!blob) {
        throw new Error("Failed to generate image");
      }

      // Generate compelling share text
      const shareText = score > 500 
        ? `🔥 INSANE ${score} POINTS! Can you beat me at this Bitcoin AR game? ${window.location.href}`
        : score > 300
        ? `Just scored ${score} defending Bitcoin! 💪 Think you can beat me? ${window.location.href}`
        : `There is NO SECOND BEST! ₿ Scored ${score} points - your turn! ${window.location.href}`;

      // On mobile, prefer Web Share API (works much better)
      if (isMobile && navigator.share) {
        const file = new File([blob], `bitcoin-ar-${Date.now()}.png`, { type: 'image/png' });
        
        // Check if sharing files is supported
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'No Second Best - Bitcoin AR Game',
            text: shareText,
            files: [file]
          });
          setCopied(true);
          setTimeout(() => setCopied(false), 5000);
        } else {
          // Share without file if file sharing not supported
          await navigator.share({
            title: 'No Second Best - Bitcoin AR Game',
            text: shareText,
            url: window.location.href
          });
          // Also download the image
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `bitcoin-ar-${Date.now()}.png`;
          link.click();
          URL.revokeObjectURL(link.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 5000);
        }
      } else {
        // Desktop: Use clipboard
        const items: Record<string, Blob> = {};
        items['image/png'] = blob;
        
        const textBlob = new Blob([shareText], { type: 'text/plain' });
        items['text/plain'] = textBlob;

        await navigator.clipboard.write([new ClipboardItem(items)]);

        setCopied(true);
        setTimeout(() => setCopied(false), 5000);
      }
    } catch (err) {
      console.error("Share failed", err);
      // Fallback: Download the image
      if (screenshots[selectedScreenshotIdx]) {
        const blob = await generateCompositeBlob(screenshots[selectedScreenshotIdx]);
        if (blob) {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `bitcoin-ar-${Date.now()}.png`;
          link.click();
          URL.revokeObjectURL(link.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 5000);
        }
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate share message options - Bitcoin themed
  const shareMessages = [
    `Just scored ${score} points defending Bitcoin from altcoins! ₿⚡ Can you beat me?`,
    `Bitcoin hero! ${score} points shooting altcoins - think you can do better? 🎯`,
    `HODLing and shooting! ${score} points in Bitcoin AR Shooter. Your turn! ₿`,
    `There is no second best! ${score} points protecting the king of crypto! 👑`
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-3 md:p-4 font-sans select-none">
      {/* Header */}
      <header className="mb-3 md:mb-4 text-center px-4">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-600 tracking-tight drop-shadow-lg">
          NO SECOND BEST
        </h1>
        <p className="text-slate-400 mt-2 text-xs md:text-sm lg:text-base">
          Bitcoin AR Battle • Shoot altcoins • Eat all the ₿!
        </p>
        {highScore > 0 && status === GameStatus.LANDING && (
          <div className="mt-2 md:mt-3 inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-slate-800 border border-slate-700 rounded-full">
            <span className="text-slate-400 text-[10px] md:text-xs">High Score:</span>
            <span className="text-orange-400 font-black text-base md:text-lg">{highScore}</span>
          </div>
        )}
      </header>

      {/* Main Game Container */}
      <div className="relative w-full max-w-4xl aspect-[3/4] md:aspect-video bg-black rounded-xl shadow-2xl overflow-hidden ring-1 ring-slate-700">
        
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
              className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-30 p-2 md:p-3 bg-slate-900/50 hover:bg-slate-800 text-white rounded-full transition-colors backdrop-blur-sm border border-white/10"
              title="Pause Game"
            >
              {status === GameStatus.PAUSED ? <PlayCircle className="w-6 h-6 md:w-8 md:h-8" /> : <Pause className="w-6 h-6 md:w-8 md:h-8" />}
            </button>
        )}

        {/* 1. Landing Screen */}
        {status === GameStatus.LANDING && (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900/95 via-slate-900/90 to-slate-800/95 backdrop-blur-md flex flex-col items-center justify-center z-10 py-4 px-3 md:p-6 text-center animate-in fade-in duration-500 overflow-y-auto">
             <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
               <div className="w-12 h-12 md:w-24 md:h-24 bg-gradient-to-br from-orange-500/30 to-amber-500/20 rounded-full flex items-center justify-center mb-2 md:mb-6 animate-pulse shadow-lg shadow-orange-500/20 flex-shrink-0">
                  <Video className="w-6 h-6 md:w-12 md:h-12 text-orange-400" />
               </div>
               <h2 className="text-xl md:text-3xl font-black text-white mb-1 md:mb-2">Ready to Defend Bitcoin?</h2>
               <p className="text-slate-400 text-[11px] md:text-sm mb-2 md:mb-6">Use your hands and face in this AR experience</p>

               {/* Mobile-specific instructions */}
               {isMobile && (
                 <div className="mb-2 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-lg p-2 w-full">
                   <p className="text-blue-300 text-[10px] font-semibold mb-0.5">📱 Mobile Setup</p>
                   <p className="text-slate-300 text-[10px] leading-tight">
                     <strong className="text-white">Set phone down</strong> at eye level, step back 2-3 feet!
                   </p>
                 </div>
               )}

               <ul className="text-slate-300 text-left space-y-1 md:space-y-3 mb-3 md:mb-8 w-full text-[11px] md:text-sm bg-slate-800/50 border border-slate-700/50 rounded-lg md:rounded-xl p-2.5 md:p-5 backdrop-blur-sm">
                  <li className="flex items-center gap-2 md:gap-3">
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-orange-400 font-bold text-[10px] md:text-xs">1</span>
                    </div>
                    <span><strong className="text-white">Allow camera</strong> access</span>
                  </li>
                  <li className="flex items-center gap-2 md:gap-3">
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-orange-400 font-bold text-[10px] md:text-xs">2</span>
                    </div>
                    <span>Use <strong className="text-white">both hands</strong> to shoot</span>
                  </li>
                  <li className="flex items-center gap-2 md:gap-3">
                    <div className="w-6 h-6 md:w-8 md:h-8 bg-amber-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-amber-400 font-bold text-[10px] md:text-xs">3</span>
                    </div>
                    <span><strong className="text-white">Eat all the ₿</strong> for power!</span>
                  </li>
               </ul>
               <button
                 onClick={handleStartRequest}
                 className="group relative px-8 py-3 md:px-10 md:py-5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black rounded-xl md:rounded-2xl text-base md:text-xl transition-all hover:scale-105 active:scale-95 shadow-xl shadow-orange-500/30 flex items-center gap-2 md:gap-3 w-full md:w-auto justify-center flex-shrink-0"
               >
                 <span>START GAME</span>
                 <Play className="w-4 h-4 md:w-6 md:h-6 fill-current group-hover:translate-x-1 transition-transform" />
               </button>
             </div>
          </div>
        )}

        {/* 2. Loading Screen */}
        {status === GameStatus.LOADING_MODELS && (
          <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-10">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin mb-4" />
            <p className="text-orange-400 font-mono text-lg">Initializing AI Vision...</p>
          </div>
        )}

        {/* 3. Calibration / Ready Screen */}
        {status === GameStatus.CALIBRATING && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex flex-col items-center justify-center z-10 p-4">
             {!cameraReady ? (
               <div className="flex flex-col items-center">
                 <Loader2 className="w-10 h-10 text-orange-400 animate-spin mb-2" />
                 <p className="text-orange-400 text-sm md:text-base">Starting Camera...</p>
               </div>
             ) : (
               <div className="text-center animate-in fade-in zoom-in duration-300">
                 <div className="bg-black/50 p-5 md:p-6 rounded-2xl border border-white/10 max-w-md mx-auto">
                   <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Setup Check</h3>
                   <p className="text-slate-300 text-sm md:text-base mb-4 md:mb-6">
                       {isMobile ? 'Step back 2-3 feet, face the camera, and raise your index fingers.' : 'Center your face and raise your index fingers.'}
                   </p>
                   <button
                     onClick={startGame}
                     className="px-6 py-3 md:px-8 md:py-3 bg-orange-500 hover:bg-amber-500 text-slate-900 font-bold rounded-full transition-colors text-base md:text-lg"
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
          <div className="absolute inset-0 pointer-events-none p-2 md:p-4 flex flex-col justify-between">
            
            {/* Top Bar: Lives and Score */}
            <div className="flex justify-between items-start w-full">
                {/* Lives */}
                <div className="flex items-center gap-0.5 md:gap-1">
                    {Array.from({ length: MAX_LIVES }).map((_, i) => (
                    <Heart
                        key={`life-${i}`}
                        className={`w-6 h-6 md:w-8 md:h-8 drop-shadow-md ${i < (lives[0] || 0) ? 'fill-orange-500 text-orange-600' : 'fill-slate-800 text-slate-700'}`}
                    />
                    ))}
                </div>

                 {/* Score (Center) */}
                 <div className="flex flex-col items-center">
                    <div className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest">Score</div>
                    <div className="text-3xl md:text-5xl font-black text-white drop-shadow-lg tabular-nums">
                        {score}
                    </div>
                 </div>

                {/* Empty space for balance */}
                <div className="w-20 md:w-32"></div>
            </div>

            {/* Paused Overlay */}
            {status === GameStatus.PAUSED && (
                 <div className="fixed inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-50 pointer-events-auto p-4">
                    <h2 className="text-4xl md:text-6xl font-black text-white tracking-widest uppercase mb-6 md:mb-8">Paused</h2>
                    <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-center justify-center">
                        <button 
                            onClick={togglePause}
                            className="px-6 py-3 md:px-8 md:py-3 bg-white hover:bg-slate-200 text-slate-900 font-bold rounded-full transition-colors flex items-center justify-center gap-2 text-sm md:text-base"
                        >
                           <Play className="w-4 h-4 md:w-5 md:h-5" /> Resume
                        </button>
                        <button
                            onClick={handleBackToMenu}
                            className="px-6 py-3 md:px-8 md:py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-full transition-colors flex items-center justify-center gap-2 text-sm md:text-base"
                        >
                           <RotateCcw className="w-4 h-4 md:w-5 md:h-5" /> Back to Menu
                        </button>
                    </div>
                 </div>
            )}
          </div>
        )}

      </div>

      {/* 5. Game Over with Enhanced Share Flow - OUTSIDE game container for consistent layout */}
      {status === GameStatus.GAME_OVER && (
        <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col">
          
          {/* Top: Interactive Preview - Flexible sizing */}
          <div className="flex-1 min-h-0 relative bg-black flex items-center justify-center p-3 md:p-6">
              <div className="relative w-full h-full max-w-3xl max-h-full flex items-center justify-center">
                  <div className="relative w-full aspect-video max-h-full rounded-lg md:rounded-xl overflow-hidden shadow-2xl border border-slate-700">
                      {/* The Base Image */}
                      {screenshots.length > 0 && (
                          <img 
                              src={screenshots[selectedScreenshotIdx]} 
                              className="w-full h-full object-cover" 
                              alt="Game Over Screenshot"
                          />
                      )}
                      
                      {/* The Overlay (Mimics what is generated on the canvas) */}
                      <div className="absolute inset-0 flex flex-col justify-between p-3 md:p-6">
                           {/* Top gradient */}
                           <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-transparent pointer-events-none" />
                           
                           {/* Bottom gradient */}
                           <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent pointer-events-none" />
                           
                           {/* Top: CTA */}
                           <div className="text-center pt-1 md:pt-2 relative z-10">
                               <h2 className="text-sm md:text-2xl lg:text-3xl font-black text-orange-500 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)] tracking-tight leading-tight px-2">
                                   {ctaText}
                               </h2>
                           </div>

                           {/* Bottom: Stats */}
                           <div className="flex justify-between items-end relative z-10">
                               <div className="drop-shadow-lg">
                                   <p className="text-[10px] md:text-xs font-bold text-white/90 mb-0.5 md:mb-1">SCORE</p>
                                   <p className="text-3xl md:text-5xl lg:text-6xl font-black text-orange-400 leading-none drop-shadow-[0_0_20px_rgba(249,115,22,0.6)]">{score}</p>
                               </div>
                               <div className="text-right drop-shadow-md">
                                   <p className="text-[8px] md:text-[10px] text-white/60">Play at:</p>
                                   <p className="text-xs md:text-sm font-bold text-white/95">{GAME_URL}</p>
                               </div>
                           </div>
                      </div>
                  </div>
              </div>
          </div>

          {/* Bottom: Controls & Gallery - Fixed height, never scrolls off screen */}
          <div className="shrink-0 w-full bg-slate-800 border-t border-slate-700 p-3 md:p-5">
              <div className="max-w-2xl mx-auto flex flex-col gap-3 md:gap-4">
                  {/* Header */}
                  <div className="text-center">
                      <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-600 italic">GAME OVER</h2>
                      <p className="text-slate-400 text-xs md:text-sm mt-0.5">Select your best moment</p>
                  </div>

                  {/* Gallery - Horizontal scroll */}
                  <div className="flex gap-2 overflow-x-auto pb-1 justify-center">
                      {screenshots.map((shot, idx) => (
                          <button
                              key={idx}
                              onClick={() => setSelectedScreenshotIdx(idx)}
                              className={`relative shrink-0 w-20 md:w-28 aspect-video rounded-md md:rounded-lg overflow-hidden border-2 transition-all ${selectedScreenshotIdx === idx ? 'border-orange-500 scale-105 shadow-orange-500/50 shadow-lg' : 'border-slate-600 opacity-60 hover:opacity-100 hover:border-slate-500'}`}
                          >
                              <img src={shot} className="w-full h-full object-cover" alt={`Shot ${idx}`} />
                          </button>
                      ))}
                      {screenshots.length === 0 && (
                           <div className="text-slate-500 text-xs py-2 italic">No screenshots captured</div>
                      )}
                  </div>

                  {/* Actions - Side by side on mobile for compactness */}
                  <div className="flex gap-2 md:gap-3">
                      <button
                          onClick={handleShare}
                          disabled={screenshots.length === 0 || isGenerating}
                          className={`flex-1 py-3 md:py-4 rounded-lg md:rounded-xl font-black text-sm md:text-base flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                              copied 
                                  ? 'bg-emerald-500/20 text-emerald-300 border-2 border-emerald-500/50' 
                                  : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25'
                          }`}
                      >
                          {isGenerating ? (
                              <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                          ) : copied ? (
                              <>
                                  <Check className="w-4 h-4 md:w-5 md:h-5" /> {isMobile ? 'Done!' : 'Copied!'}
                              </>
                          ) : (
                              <>
                                  {isMobile ? <Share2 className="w-4 h-4 md:w-5 md:h-5" /> : <Copy className="w-4 h-4 md:w-5 md:h-5" />} SHARE
                              </>
                          )}
                      </button>

                      <button
                          onClick={startGame}
                          className="flex-1 py-3 md:py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg md:rounded-xl transition-all flex items-center justify-center gap-2 border border-slate-600 text-sm md:text-base"
                      >
                          <RotateCcw className="w-4 h-4 md:w-5 md:h-5" /> PLAY AGAIN
                      </button>
                  </div>
              </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      {status === GameStatus.LANDING && (
        <div className="mt-4 md:mt-6 flex flex-col md:flex-row gap-4 md:gap-8 text-slate-500 text-xs md:text-sm animate-in slide-in-from-bottom-4 duration-700 px-4">
            <div className="flex items-center gap-2">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 flex-shrink-0">
                <span className="font-bold text-white text-xs md:text-sm">1</span>
            </div>
            <span>Face camera directly</span>
            </div>
            <div className="flex items-center gap-2">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 flex-shrink-0">
                <span className="font-bold text-white text-xs md:text-sm">2</span>
            </div>
            <span>Shoot altcoins with fingers</span>
            </div>
            <div className="flex items-center gap-2">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 flex-shrink-0">
                <span className="font-bold text-white text-xs md:text-sm">3</span>
            </div>
            <span>Eat all the ₿</span>
            </div>
        </div>
      )}

      {/* Footer Links */}
      <footer className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-slate-800 w-full max-w-4xl text-center px-4">
        <div className="flex flex-wrap justify-center items-center gap-3 md:gap-4 text-slate-400 text-xs">
          <button 
            onClick={() => setShowPrivacyModal(true)}
            className="hover:text-orange-400 transition-colors underline"
          >
            Privacy
          </button>
          <span className="text-slate-700 hidden sm:inline">•</span>
          <a 
            href="https://hope.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-orange-400 transition-colors"
          >
            Hope.com
          </a>
          <span className="text-slate-700 hidden sm:inline">•</span>
          <a 
            href="https://x.com/docstacks" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-orange-400 transition-colors"
          >
            @docstacks
          </a>
          <span className="text-slate-700 hidden sm:inline">•</span>
          <a 
            href="https://github.com/docstacks" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-orange-400 transition-colors"
          >
            GitHub
          </a>
        </div>
      </footer>

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
          onClick={() => setShowPrivacyModal(false)}
        >
          <div 
            className="bg-slate-800 border border-slate-700 rounded-xl p-5 md:p-6 max-w-md w-full shadow-2xl animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg md:text-xl font-bold text-white mb-3 md:mb-4">Privacy Policy</h3>
            <div className="text-slate-300 text-xs md:text-sm space-y-2 md:space-y-3 mb-5 md:mb-6">
              <p>
                <strong className="text-orange-400">No Data Collection:</strong> This game runs entirely in your browser. We do not collect, store, or transmit any personal data.
              </p>
              <p>
                <strong className="text-orange-400">Local Processing:</strong> All camera images and gameplay screenshots are processed locally on your device. Nothing is sent to any server.
              </p>
              <p>
                <strong className="text-orange-400">Camera Access:</strong> Camera access is only used for gameplay detection. The video stream never leaves your device.
              </p>
              <p>
                <strong className="text-orange-400">Screenshot Storage:</strong> When you share screenshots, they are temporarily stored in your browser's memory and only copied to your clipboard when you click the share button.
              </p>
            </div>
            <button
              onClick={() => setShowPrivacyModal(false)}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-colors text-sm md:text-base"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
