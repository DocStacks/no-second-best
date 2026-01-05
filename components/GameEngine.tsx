import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameStatus, Enemy, Point, Particle, EnemyVisualType, PowerUp, EnemyTheme, PlayerMode } from '../types';
import {
  VIDEO_WIDTH, VIDEO_HEIGHT, BUG_SIZE, SWAT_RADIUS,
  FACE_HIT_RADIUS, MAX_LIVES,
  BUG_SPAWN_INTERVAL_START, BUG_SPAWN_INTERVAL_MIN, BUG_SPEED_BASE,
  COLOR_BUG_BEETLE, COLOR_BUG_WASP, COLOR_BUG_WASP_STRIPE, COLOR_BUG_FLY, COLOR_BUG_WING,
  COLOR_ZOMBIE_SKIN, COLOR_ZOMBIE_SHIRT, COLOR_ZOMBIE_EYES,
  COLOR_SPIDER_BODY, COLOR_SPIDER_LEGS, COLOR_SPIDER_EYES,
  COLOR_SWAT_ACTIVE, POWERUP_SPAWN_CHANCE, POWERUP_SIZE, COLOR_POWERUP_ORB, COLOR_POWERUP_GLOW
} from '../constants';
import { detectFace, detectHands } from '../services/visionService';
import { playBlastSound, playBiteSound, playPowerUpSound, startMusic, stopMusic } from '../services/audioService';

interface GameEngineProps {
  status: GameStatus;
  theme: EnemyTheme;
  playerMode: PlayerMode;
  onGameOver: (score: number, screenshots: string[]) => void;
  onLivesChange: (lives: number[]) => void;
  onScoreChange: (score: number) => void;
  onReady: () => void;
}

const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

export const GameEngine: React.FC<GameEngineProps> = ({
  status,
  theme,
  playerMode,
  onGameOver,
  onLivesChange,
  onScoreChange,
  onReady
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  
  // Game State Refs
  const enemiesRef = useRef<Enemy[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const screenshotsRef = useRef<string[]>([]);
  const lastScreenshotTimeRef = useRef<number>(0);
  
  const lastSpawnTimeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const livesRef = useRef<number[]>([MAX_LIVES, MAX_LIVES]); // [P1, P2]
  const gameStartTimeRef = useRef<number>(0);
  const difficultyFactorRef = useRef<number>(0);

  // Initialize Camera
  useEffect(() => {
    const startCamera = async () => {
      if (videoRef.current) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: VIDEO_WIDTH },
              height: { ideal: VIDEO_HEIGHT },
              facingMode: "user"
            }
          });
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener('loadeddata', () => {
             onReady();
          });
        } catch (err) {
          console.error("Error accessing camera:", err);
          alert("Could not access camera. Please allow camera permissions.");
        }
      }
    };

    startCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      stopMusic();
    };
  }, [onReady]);

  // Handle Game Status Changes
  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      if (gameStartTimeRef.current === 0) {
        // First start or fresh restart
        enemiesRef.current = [];
        particlesRef.current = [];
        powerUpsRef.current = [];
        screenshotsRef.current = []; // Clear screenshots
        scoreRef.current = 0;
        // Reset lives based on player mode
        const initialLives = playerMode === '2p' ? [MAX_LIVES, MAX_LIVES] : [MAX_LIVES];
        livesRef.current = [...initialLives];
        
        gameStartTimeRef.current = performance.now();
        lastSpawnTimeRef.current = performance.now();
        onScoreChange(0);
        onLivesChange(livesRef.current);
      }
      startMusic();
    } else if (status === GameStatus.GAME_OVER) {
      stopMusic();
      gameStartTimeRef.current = 0; 
    } else {
      stopMusic(); 
    }
  }, [status, playerMode, onScoreChange, onLivesChange]);

  const captureScreenshot = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video && canvas && screenshotsRef.current.length < 3) {
      // We need to composite the video AND the canvas together
      const compositeCanvas = document.createElement('canvas');
      compositeCanvas.width = video.videoWidth;
      compositeCanvas.height = video.videoHeight;
      const ctx = compositeCanvas.getContext('2d');
      
      if (ctx) {
        // 1. Draw Video (Mirrored to match game view)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -compositeCanvas.width, 0, compositeCanvas.width, compositeCanvas.height);
        ctx.restore();

        // 2. Draw Game Overlay
        ctx.drawImage(canvas, 0, 0);

        // 3. Save
        const dataUrl = compositeCanvas.toDataURL('image/jpeg', 0.8);
        screenshotsRef.current.push(dataUrl);
      }
    } else if (video && canvas && Math.random() > 0.5) {
       // Replace a random one if full to get latest action
       const idx = Math.floor(Math.random() * 3);
       
       const compositeCanvas = document.createElement('canvas');
       compositeCanvas.width = video.videoWidth;
       compositeCanvas.height = video.videoHeight;
       const ctx = compositeCanvas.getContext('2d');
       
       if (ctx) {
         ctx.save();
         ctx.scale(-1, 1);
         ctx.drawImage(video, -compositeCanvas.width, 0, compositeCanvas.width, compositeCanvas.height);
         ctx.restore();
         ctx.drawImage(canvas, 0, 0);
         const dataUrl = compositeCanvas.toDataURL('image/jpeg', 0.8);
         screenshotsRef.current[idx] = dataUrl;
       }
    }
  }, []);

  const spawnParticles = (x: number, y: number, color: string, w: number, h: number, count = 8, speedMult = 1) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = randomRange(0.005, 0.015) * speedMult;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed * (h/w),
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color: color,
        size: randomRange(0.01, 0.02)
      });
    }
  };

  const spawnPowerUp = (now: number, w: number, h: number) => {
    if (Math.random() < POWERUP_SPAWN_CHANCE) {
       powerUpsRef.current.push({
         id: Math.random().toString(),
         x: -0.1, // Start off left
         y: randomRange(0.2, 0.8),
         vx: 0.002, // Slow float right
         vy: Math.sin(now * 0.001) * 0.001,
         size: POWERUP_SIZE,
         type: 'bomb',
         life: 1.0
       });
    }
  };

  const spawnEnemy = (now: number, faceTargets: Point[]) => {
    const timePlayed = now - gameStartTimeRef.current;
    difficultyFactorRef.current = Math.min(timePlayed / 60000, 1);
    
    // Faster spawns in 2P mode and for spiders
    const rateMultiplier = playerMode === '2p' ? 0.7 : 1.0;
    const themeMultiplier = theme === 'spiders' ? 0.7 : 1.0;
    const currentInterval = (BUG_SPAWN_INTERVAL_START - (difficultyFactorRef.current * (BUG_SPAWN_INTERVAL_START - BUG_SPAWN_INTERVAL_MIN))) * rateMultiplier * themeMultiplier;

    if (now - lastSpawnTimeRef.current > currentInterval) {
      let startX = 0, startY = 0;
      
      // --- THEME SPAWN LOGIC ---
      if (theme === 'spiders') {
        if (Math.random() < 0.6) {
           startX = Math.random(); 
           startY = -0.1; 
        } else {
           startX = Math.random() < 0.5 ? -0.1 : 1.1;
           startY = Math.random() * 0.5; 
        }
      } else {
         const edge = Math.floor(Math.random() * 4);
         switch(edge) {
            case 0: startX = Math.random(); startY = -0.1; break; // Top
            case 1: startX = 1.1; startY = Math.random(); break; // Right
            case 2: startX = Math.random(); startY = 1.1; break; // Bottom
            case 3: startX = -0.1; startY = Math.random(); break; // Left
          }
      }

      const rand = Math.random();
      let visualType: EnemyVisualType = 'beetle';
      let speedMultiplier = 1;
      let isSeeker = false;

      // Type determination based on theme
      if (theme === 'zombies') {
        if (rand > 0.8) {
             visualType = 'zombie_runner';
             speedMultiplier = 0.5;
             isSeeker = true;
        } else {
             visualType = 'zombie_walker';
             speedMultiplier = 0.3;
             isSeeker = true; 
        }
      } else if (theme === 'spiders') {
         if (rand > 0.4) {
             visualType = 'spider_jumper';
             speedMultiplier = 1.5;
             isSeeker = true;
         } else {
             visualType = 'spider_crawler';
             speedMultiplier = 1.0;
             isSeeker = false;
         }
      } else {
        // Bugs
        if (rand > 0.7) {
            visualType = 'wasp';
            speedMultiplier = 1.4;
            isSeeker = true;
        } else if (rand > 0.4) {
            visualType = 'fly';
            speedMultiplier = 1.2;
            isSeeker = false;
        } else {
            visualType = 'beetle';
            speedMultiplier = 0.9;
            isSeeker = Math.random() < (0.2 + difficultyFactorRef.current * 0.5);
        }
      }

      const speed = BUG_SPEED_BASE * (1 + difficultyFactorRef.current) * speedMultiplier;

      // Assign Target Face
      let targetIndex = 0;
      if (playerMode === '2p') {
          // 50/50 chance to target P1 (0) or P2 (1)
          // If a player is dead, target the living one
          if (livesRef.current[0] <= 0) targetIndex = 1;
          else if (livesRef.current[1] <= 0) targetIndex = 0;
          else targetIndex = Math.random() < 0.5 ? 0 : 1;
      }

      // Calculate Vector
      let vx = 0, vy = 0;
      let targetPos = faceTargets[targetIndex] || { x: 0.5, y: 0.5 };

      if (isSeeker) {
        const dx = targetPos.x - startX;
        const dy = targetPos.y - startY;
        const mag = Math.sqrt(dx*dx + dy*dy);
        vx = (dx / mag) * speed;
        vy = (dy / mag) * speed;
      } else {
        const dx = 0.5 - startX;
        const dy = 0.5 - startY;
        const mag = Math.sqrt(dx*dx + dy*dy);
        vx = (dx / mag) * speed + randomRange(-0.002, 0.002);
        vy = (dy / mag) * speed + randomRange(-0.002, 0.002);
      }

      enemiesRef.current.push({
        id: Math.random().toString(36).substr(2, 9),
        x: startX,
        y: startY,
        vx,
        vy,
        size: BUG_SIZE,
        type: isSeeker ? 'seeker' : 'wanderer',
        visualType,
        speed,
        wobbleOffset: Math.random() * Math.PI * 2,
        animationOffset: Math.random() * 100,
        createdAt: now,
        targetFaceIndex: targetIndex
      });
      
      lastSpawnTimeRef.current = now;
    }
  };

  const drawEnemy = (ctx: CanvasRenderingContext2D, enemy: Enemy, bx: number, by: number, bSize: number, time: number) => {
    ctx.save();
    
    // ZOMBIES: Add vertical "bob"
    let drawY = by;
    if (theme === 'zombies') {
        const walkBob = Math.abs(Math.sin(time * 0.008 + enemy.animationOffset)) * (bSize * 0.3);
        drawY = by - walkBob; 
        ctx.translate(bx, drawY);
        const sway = Math.sin(time * 0.005 + enemy.animationOffset) * 0.1;
        ctx.rotate(sway); 
    } else {
        ctx.translate(bx, by);
        let angle = Math.atan2(enemy.vy, enemy.vx);
        ctx.rotate(angle + Math.PI / 2);
    }
    
    const anim = Math.sin(time * 0.15 + enemy.animationOffset);

    // Color code enemies in 2P mode to show who they are attacking (Subtle hint)
    // Only if seeker.
    let targetTint = '';
    if (playerMode === '2p' && enemy.type === 'seeker') {
       // P1 (Left) = Reddish tint check, P2 (Right) = Blueish tint check?
       // Let's rely on trajectory mostly, but maybe eye color change
    }

    // --- ZOMBIES ---
    if (enemy.visualType.startsWith('zombie')) {
       // Shoulders
       ctx.fillStyle = COLOR_ZOMBIE_SHIRT;
       ctx.beginPath();
       ctx.roundRect(-bSize/2, -bSize/4, bSize, bSize/2, 5);
       ctx.fill();
       
       // Head
       ctx.fillStyle = COLOR_ZOMBIE_SKIN;
       ctx.beginPath();
       ctx.arc(0, -bSize/2, bSize/2.2, 0, Math.PI * 2);
       ctx.fill();

       // Eyes
       ctx.fillStyle = COLOR_ZOMBIE_EYES;
       ctx.beginPath();
       ctx.arc(-bSize/5, -bSize/2, bSize/8, 0, Math.PI * 2);
       ctx.arc(bSize/5, -bSize/2, bSize/8, 0, Math.PI * 2);
       ctx.fill();

       // Arms
       ctx.strokeStyle = COLOR_ZOMBIE_SKIN;
       ctx.lineWidth = bSize/6;
       ctx.beginPath();
       ctx.moveTo(-bSize/2, 0); ctx.lineTo(-bSize/1.5, bSize/2 + anim * 5);
       ctx.moveTo(bSize/2, 0); ctx.lineTo(bSize/1.5, bSize/2 - anim * 5);
       ctx.stroke();
    }
    // --- SPIDERS ---
    else if (enemy.visualType.startsWith('spider')) {
       // Draw web behind spider (only when near top of screen)
       if (enemy.y < 0.3) {
           ctx.strokeStyle = 'rgba(255,255,255,0.3)';
           ctx.lineWidth = 1;
           ctx.beginPath();
           ctx.moveTo(0, 0);
           ctx.lineTo(0, 1000);
           ctx.stroke();
       }
       ctx.strokeStyle = COLOR_SPIDER_LEGS;
       ctx.lineWidth = 2;
       for (let i = 0; i < 4; i++) {
          const legWiggle = Math.sin(time * 0.3 + i) * (bSize/3);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-bSize, (i - 1.5) * (bSize/2) + legWiggle);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(bSize, (i - 1.5) * (bSize/2) - legWiggle);
          ctx.stroke();
       }
       ctx.fillStyle = COLOR_SPIDER_BODY;
       ctx.beginPath();
       ctx.ellipse(0, 0, bSize/2, bSize/1.5, 0, 0, Math.PI * 2);
       ctx.fill();
       ctx.fillStyle = COLOR_SPIDER_EYES;
       ctx.beginPath();
       ctx.arc(-bSize/5, -bSize/2, bSize/10, 0, Math.PI * 2);
       ctx.arc(bSize/5, -bSize/2, bSize/10, 0, Math.PI * 2);
       ctx.fill();
    }
    // --- BUGS (Default) ---
    else {
        if (enemy.visualType === 'wasp') {
            ctx.fillStyle = COLOR_BUG_WING;
            ctx.beginPath();
            ctx.ellipse(bSize/2, 0, bSize/1.2, bSize/4, Math.PI/4 + 0.5 * anim, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(-bSize/2, 0, bSize/1.2, bSize/4, -Math.PI/4 - 0.5 * anim, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = COLOR_BUG_WASP;
            ctx.beginPath();
            ctx.ellipse(0, 0, bSize/2.5, bSize/1.5, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = COLOR_BUG_WASP_STRIPE;
            ctx.lineWidth = bSize / 8;
            ctx.beginPath();
            ctx.moveTo(-bSize/3, -bSize/4); ctx.lineTo(bSize/3, -bSize/4);
            ctx.moveTo(-bSize/3, 0); ctx.lineTo(bSize/3, 0);
            ctx.moveTo(-bSize/3, bSize/4); ctx.lineTo(bSize/3, bSize/4);
            ctx.stroke();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(0, -bSize/1.5, bSize/4, 0, Math.PI * 2);
            ctx.fill();
        } 
        else if (enemy.visualType === 'fly') {
            ctx.fillStyle = COLOR_BUG_WING;
            ctx.beginPath();
            ctx.ellipse(bSize/2, -bSize/4, bSize/1.5, bSize/2.5, 0.8 * anim, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(-bSize/2, -bSize/4, bSize/1.5, bSize/2.5, -0.8 * anim, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = COLOR_BUG_FLY;
            ctx.beginPath();
            ctx.arc(0, 0, bSize/2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#991b1b';
            ctx.beginPath();
            ctx.arc(-bSize/5, -bSize/3, bSize/6, 0, Math.PI * 2);
            ctx.arc(bSize/5, -bSize/3, bSize/6, 0, Math.PI * 2);
            ctx.fill();
        }
        else {
            // Beetle
            ctx.fillStyle = COLOR_BUG_WING;
            ctx.beginPath();
            ctx.ellipse(bSize/2, 0, bSize/1.5, bSize/3, Math.PI/6 + 0.3 * anim, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(-bSize/2, 0, bSize/1.5, bSize/3, -Math.PI/6 - 0.3 * anim, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = COLOR_BUG_BEETLE;
            ctx.beginPath();
            ctx.arc(0, 0, bSize/2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, -bSize/3); ctx.lineTo(0, bSize/2);
            ctx.stroke();
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(0, -bSize/1.8, bSize/5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
  };

  const drawPowerUp = (ctx: CanvasRenderingContext2D, p: PowerUp, w: number, h: number, time: number) => {
      const x = p.x * w;
      const y = p.y * h;
      const size = p.size * w;
      const pulse = 1 + Math.sin(time * 0.005) * 0.1;

      ctx.shadowColor = COLOR_POWERUP_ORB;
      ctx.shadowBlur = 20 * pulse;
      ctx.fillStyle = COLOR_POWERUP_GLOW;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.7 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = COLOR_POWERUP_ORB;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.fillRect(x - size * 0.15, y - size * 0.15, size * 0.3, size * 0.3);
  };

  const updateAndDraw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !video.videoWidth) {
      animationFrameRef.current = requestAnimationFrame(updateAndDraw);
      return;
    }

    if (status === GameStatus.PAUSED) {
        animationFrameRef.current = requestAnimationFrame(updateAndDraw);
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const w = canvas.width;
    const h = canvas.height;

    // Capture screenshot randomly (approx every 8 seconds)
    if (status === GameStatus.PLAYING && time - lastScreenshotTimeRef.current > 8000) {
       captureScreenshot();
       lastScreenshotTimeRef.current = time;
    }

    ctx.clearRect(0, 0, w, h);

    // 1. Detection
    const faceTargets: Point[] = [];
    const handTips: Point[] = [];

    if (status === GameStatus.PLAYING || status === GameStatus.CALIBRATING) {
      const faceResult = detectFace(video, time);
      if (faceResult && faceResult.faceLandmarks.length > 0) {
        // Sort faces left-to-right to maintain consistency for P1/P2
        const faces = faceResult.faceLandmarks.map(landmarks => landmarks[1]); // Nose tip
        // Mediapipe coordinates: x is 0 to 1 (left to right)
        // Sort by X coordinate
        faces.sort((a, b) => a.x - b.x);
        
        faces.forEach(nose => {
            faceTargets.push({ x: nose.x, y: nose.y });
        });
      }

      const handResult = detectHands(video, time);
      if (handResult && handResult.landmarks.length > 0) {
        handResult.landmarks.forEach(lm => {
            const indexTip = lm[8];
            handTips.push({ x: indexTip.x, y: indexTip.y });
        });

        // Draw Reticles
        handTips.forEach(tip => {
            const hx = tip.x * w;
            const hy = tip.y * h;
            const rSize = 25;

            ctx.beginPath();
            ctx.moveTo(hx - rSize, hy); ctx.lineTo(hx + rSize, hy);
            ctx.moveTo(hx, hy - rSize); ctx.lineTo(hx, hy + rSize);
            ctx.moveTo(hx + rSize * 0.5, hy); ctx.arc(hx, hy, rSize * 0.5, 0, Math.PI * 2);
            
            ctx.strokeStyle = COLOR_SWAT_ACTIVE;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 10;
            ctx.shadowColor = COLOR_SWAT_ACTIVE;
            ctx.stroke();
            ctx.shadowBlur = 0;
        });
      }
    }

    // 2. Game Logic
    if (status === GameStatus.PLAYING) {
      spawnEnemy(time, faceTargets);
      spawnPowerUp(time, w, h);

      // --- Particles ---
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;

        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.size * w * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // --- Power Ups ---
      for (let i = powerUpsRef.current.length - 1; i >= 0; i--) {
          const p = powerUpsRef.current[i];
          p.x += p.vx;
          p.y += p.vy; 
          p.y += Math.sin(time * 0.003) * 0.0005;

          drawPowerUp(ctx, p, w, h, time);

          let hit = false;
          for (const hand of handTips) {
              const d = Math.sqrt(Math.pow(p.x - hand.x, 2) + Math.pow(p.y - hand.y, 2));
              if (d < (p.size + SWAT_RADIUS)) {
                  hit = true;
                  break;
              }
          }

          if (hit) {
              playPowerUpSound();
              // Clear Enemies
              enemiesRef.current.forEach(e => {
                  spawnParticles(e.x, e.y, '#ffffff', w, h, 6, 2);
              });
              const points = enemiesRef.current.length * 2;
              enemiesRef.current = [];
              scoreRef.current += points;
              onScoreChange(scoreRef.current);
              
              // Heal both players
              livesRef.current = livesRef.current.map(l => l < MAX_LIVES ? l + 1 : l);
              onLivesChange([...livesRef.current]);

              powerUpsRef.current.splice(i, 1);
              continue;
          }

          if (p.x > 1.2) powerUpsRef.current.splice(i, 1);
      }

      // --- Enemies ---
      for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
        const enemy = enemiesRef.current[i];
        
        let moveX = enemy.vx;
        let moveY = enemy.vy;
        
        // MOVEMENT LOGIC
        if (theme === 'spiders') {
            const movePhase = Math.floor(time / 750) % 2;
            if (Math.random() < 0.08) {
                 moveX *= 4; moveY *= 4;
            } else if (movePhase === 1 && Math.random() < 0.6) {
                 moveX = 0; moveY = 0;
            }
        } else if (theme === 'zombies') {
             // Steady plodding
        } else {
             const wobble = Math.sin(time * 0.005 + enemy.wobbleOffset) * 0.002;
             moveX += (enemy.type === 'wanderer' ? wobble : 0);
             moveY += (enemy.type === 'wanderer' ? wobble : 0);
        }

        enemy.x += moveX;
        enemy.y += moveY;

        const bx = enemy.x * w;
        const by = enemy.y * h;
        const bSize = enemy.size * w;

        drawEnemy(ctx, enemy, bx, by, bSize, time);

        // Check Shot (Any hand can shoot any bug)
        let destroyed = false;
        for (const hand of handTips) {
             const distToHand = Math.sqrt(Math.pow(enemy.x - hand.x, 2) + Math.pow(enemy.y - hand.y, 2));
             if (distToHand < (enemy.size/2 + SWAT_RADIUS)) {
                destroyed = true;
                break;
             }
        }

        if (destroyed) {
             enemiesRef.current.splice(i, 1);
             scoreRef.current += 1;
             onScoreChange(scoreRef.current);
             playBlastSound();

             let pColor = '#fff';
             if (theme === 'bugs') {
                if (enemy.visualType === 'wasp') pColor = COLOR_BUG_WASP;
                else if (enemy.visualType === 'fly') pColor = COLOR_BUG_FLY;
                else pColor = COLOR_BUG_BEETLE;
             } else if (theme === 'zombies') {
                pColor = COLOR_ZOMBIE_SKIN;
             } else if (theme === 'spiders') {
                pColor = COLOR_SPIDER_EYES;
             }

             spawnParticles(enemy.x, enemy.y, pColor, w, h);
             continue;
        }

        // Check Bite
        let bitFace = false;
        let victimIndex = -1;

        // Only check against the specific target face if in 2P mode, or valid target
        if (playerMode === '2p') {
           // We sorted faceTargets by X (Left to Right).
           // enemy.targetFaceIndex 0 => Leftmost face
           const targetFace = faceTargets[enemy.targetFaceIndex];
           
           if (targetFace) {
               const distToFace = Math.sqrt(Math.pow(enemy.x - targetFace.x, 2) + Math.pow(enemy.y - targetFace.y, 2));
               if (distToFace < FACE_HIT_RADIUS) {
                   bitFace = true;
                   victimIndex = enemy.targetFaceIndex;
               }
           } else if (faceTargets.length > 0) {
               // Fallback if target face lost tracking: check closest
                faceTargets.forEach((face, idx) => {
                  const dist = Math.sqrt(Math.pow(enemy.x - face.x, 2) + Math.pow(enemy.y - face.y, 2));
                  if (dist < FACE_HIT_RADIUS) {
                      bitFace = true;
                      victimIndex = idx;
                  }
                });
           }

        } else {
            // 1P Mode: Check any face
            faceTargets.forEach((face, idx) => {
                const distToFace = Math.sqrt(Math.pow(enemy.x - face.x, 2) + Math.pow(enemy.y - face.y, 2));
                if (distToFace < FACE_HIT_RADIUS) {
                    bitFace = true;
                    victimIndex = 0; // In 1P mode, we affect lives[0]
                }
            });
        }

        if (bitFace && victimIndex !== -1 && livesRef.current[victimIndex] > 0) {
             enemiesRef.current.splice(i, 1);
             livesRef.current[victimIndex] = Math.max(0, livesRef.current[victimIndex] - 1);
             onLivesChange([...livesRef.current]);
             playBiteSound();
             
             // Game over if P1 dies in 1P, or Both die in 2P? 
             // Requirement: "3 bites ends the game". 
             // In 2P, let's say "Team Game Over" if total lives depleted or one person dies? 
             // Classic arcade coop usually ends when both die, but "Protect your face" implies personal responsibility.
             // Let's make it: Game Over if *anyone* runs out of lives completely (Hardcore).
             
             if (livesRef.current[victimIndex] <= 0) {
               // Capture final moment
               captureScreenshot();
               onGameOver(scoreRef.current, screenshotsRef.current);
             }
        }

        if (!destroyed && !bitFace && (enemy.x < -0.2 || enemy.x > 1.2 || enemy.y < -0.2 || enemy.y > 1.2)) {
          enemiesRef.current.splice(i, 1);
        }
      }
    }

    lastTimeRef.current = time;
    animationFrameRef.current = requestAnimationFrame(updateAndDraw);
  }, [status, theme, playerMode, captureScreenshot, onScoreChange, onLivesChange, onGameOver]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(updateAndDraw);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
  }, [updateAndDraw]);

  return (
    <div className="relative w-full max-w-4xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-700">
      <div className="absolute inset-0 w-full h-full mirror-x">
         <video 
           ref={videoRef}
           className="absolute inset-0 w-full h-full object-cover"
           autoPlay
           playsInline
           muted
         />
         <canvas 
           ref={canvasRef}
           className="absolute inset-0 w-full h-full object-cover"
         />
      </div>
    </div>
  );
};