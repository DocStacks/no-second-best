import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameStatus, Enemy, Point, Particle, EnemyVisualType, PowerUp, EnemyTheme, PlayerMode } from '../types';
import {
  VIDEO_WIDTH, VIDEO_HEIGHT, BUG_SIZE, SWAT_RADIUS,
  FACE_HIT_RADIUS, MAX_LIVES,
  BUG_SPAWN_INTERVAL_START, BUG_SPAWN_INTERVAL_MIN, BUG_SPEED_BASE,
  COLOR_SWAT_ACTIVE, POWERUP_SPAWN_CHANCE, POWERUP_SIZE,
  BITCOIN_EAT_RADIUS, MICHAEL_SAYLOR_IMAGE,
  COLOR_BITCOIN_ORB, COLOR_BITCOIN_GLOW, COLOR_BITCOIN_PRIMARY,
  BITCOIN_IMAGE, ALTCOIN_IMAGES, ALTCOIN_COLORS,
  COLOR_POWERUP_ORB, COLOR_POWERUP_GLOW
} from '../constants';
import { detectFace, detectHands, getMouthPosition } from '../services/visionService';
import { playBlastSound, playBiteSound, playPowerUpSound, playHeroSound, startMusic, stopMusic } from '../services/audioService';

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
  const michaelSaylorImageRef = useRef<HTMLImageElement | null>(null);
  const altcoinImagesRef = useRef<{ [key: string]: HTMLImageElement }>({});

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

  // Initialize Camera and preload Michael Saylor image
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

    // Preload Michael Saylor image for Bitcoin theme
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      michaelSaylorImageRef.current = img;
    };
    img.src = MICHAEL_SAYLOR_IMAGE;

    // Preload Bitcoin image for power-ups
    const bitcoinImg = new Image();
    bitcoinImg.crossOrigin = 'anonymous';
    bitcoinImg.onload = () => {
      altcoinImagesRef.current['bitcoin'] = bitcoinImg;
    };
    bitcoinImg.src = BITCOIN_IMAGE;

    // Preload altcoin images
    Object.entries(ALTCOIN_IMAGES).forEach(([coin, url]) => {
      const coinImg = new Image();
      coinImg.crossOrigin = 'anonymous';
      coinImg.onload = () => {
        altcoinImagesRef.current[coin] = coinImg;
      };
      coinImg.src = url;
    });

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
       const isBitcoinTheme = theme === 'bitcoin';
       const powerUpType = isBitcoinTheme && Math.random() < 0.7 ? 'bitcoin' : 'bomb'; // 70% Bitcoin in Bitcoin theme

       powerUpsRef.current.push({
         id: Math.random().toString(),
         x: -0.1, // Start off left
         y: randomRange(0.2, 0.8),
         vx: 0.002, // Slow float right
         vy: Math.sin(now * 0.001) * 0.001,
         size: POWERUP_SIZE,
         type: powerUpType,
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

      // Altcoins as enemies - all are seekers (they chase Bitcoin)
      const altcoinTypes = ['eth', 'usdt', 'usdc', 'bnb', 'sol', 'xrp', 'trx', 'doge', 'ada', 'steth', 'link', 'shib', 'hbar', 'dai', 'avax', 'uni', 'aave', 'comp', 'zec', 'etc'];
      visualType = altcoinTypes[Math.floor(rand * altcoinTypes.length)] as EnemyVisualType;
      speedMultiplier = 0.8 + rand * 0.6; // Varying speeds for different altcoins
      isSeeker = true; // All altcoins chase the player

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

    // Position altcoin
    ctx.translate(bx, by);

    // Subtle rotation based on movement
    let angle = Math.atan2(enemy.vy, enemy.vx);
    ctx.rotate(angle + Math.PI / 2);

    // Draw altcoin with image
    const altcoinImg = altcoinImagesRef.current[enemy.visualType];
    const fallbackColor = ALTCOIN_COLORS[enemy.visualType as keyof typeof ALTCOIN_COLORS] || COLOR_BITCOIN_PRIMARY;

    if (altcoinImg && altcoinImg.complete) {
      // Draw actual altcoin image with glow effect
      ctx.shadowColor = fallbackColor;
      ctx.shadowBlur = 10;
      // Mirror the image in X plane to display correctly (since video is mirrored)
      ctx.scale(-1, 1);
      ctx.drawImage(altcoinImg, -bSize, -bSize, bSize * 2, bSize * 2);
      ctx.shadowBlur = 0;
    } else {
      // Fallback: Draw colored circle while image loads
      ctx.shadowColor = fallbackColor;
      ctx.shadowBlur = 15;
      ctx.fillStyle = fallbackColor;
      ctx.beginPath();
      ctx.arc(0, 0, bSize * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw altcoin symbol as fallback
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${bSize * 1.2}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const symbols: { [key: string]: string } = {
        'eth': 'Ξ', 'usdt': '₮', 'usdc': '$', 'bnb': 'BNB', 'sol': '◎',
        'xrp': '✕', 'trx': 'TRX', 'doge': 'Ð', 'ada': '₳', 'steth': 'stETH',
        'link': 'LINK', 'shib': 'SHIB', 'hbar': 'HBAR', 'dai': 'DAI',
        'avax': 'AVAX', 'uni': 'UNI', 'aave': 'AAVE', 'comp': 'COMP',
        'zec': 'ZEC', 'etc': 'ETC'
      };
      ctx.fillText(symbols[enemy.visualType] || enemy.visualType.toUpperCase(), 0, 0);
    }

    ctx.restore();
  };

  const drawPowerUp = (ctx: CanvasRenderingContext2D, p: PowerUp, w: number, h: number, time: number) => {
      const x = p.x * w;
      const y = p.y * h;
      const size = p.size * w;
      const pulse = 1 + Math.sin(time * 0.005) * 0.1;

      if (p.type === 'bitcoin') {
        // Draw Bitcoin logo from image
        const bitcoinImg = altcoinImagesRef.current['bitcoin'];

        if (bitcoinImg && bitcoinImg.complete) {
          // Draw actual Bitcoin logo with glow effect
          ctx.shadowColor = COLOR_BITCOIN_ORB;
          ctx.shadowBlur = 20 * pulse;
          // Mirror the image in X plane to display correctly
          ctx.save();
          ctx.scale(-1, 1);
          ctx.drawImage(bitcoinImg, -x - size, y - size, size * 2, size * 2);
          ctx.restore();
          ctx.shadowBlur = 0;
        } else {
          // Fallback: Draw glowing orange orb with Bitcoin symbol
          ctx.shadowColor = COLOR_BITCOIN_ORB;
          ctx.shadowBlur = 30 * pulse;
          ctx.fillStyle = COLOR_BITCOIN_GLOW;
          ctx.beginPath();
          ctx.arc(x, y, size * 0.8 * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Bitcoin symbol as fallback
          ctx.fillStyle = COLOR_BITCOIN_ORB;
          ctx.font = `bold ${size * 0.6}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('₿', x, y);
        }
      } else {
        // Original bomb power-up
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
      }
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
    const mouthPositions: (Point | null)[] = [];

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

        // Get mouth positions for Bitcoin eating
        faceResult.faceLandmarks.forEach(landmarks => {
          mouthPositions.push(getMouthPosition({ faceLandmarks: [landmarks] }));
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

      // Draw Michael Saylor overlay on faces for Bitcoin theme
      if (theme === 'bitcoin' && faceResult && michaelSaylorImageRef.current) {
        faceResult.faceLandmarks.forEach((landmarks, faceIndex) => {
          if (faceIndex >= faceTargets.length) return;

          const nose = landmarks[1]; // Nose tip landmark
          const leftEye = landmarks[33]; // Left eye landmark
          const rightEye = landmarks[263]; // Right eye landmark

          // Calculate face dimensions and position
          const faceWidth = Math.abs(rightEye.x - leftEye.x) * w * 3; // Scale up for overlay
          const faceHeight = faceWidth * 1.2; // Slightly taller than wide
          const faceX = nose.x * w - faceWidth / 2;
          const faceY = nose.y * h - faceHeight / 2;

          // Draw Michael Saylor image overlay
          ctx.save();
          ctx.globalAlpha = 0.6; // Semi-transparent overlay
          ctx.drawImage(michaelSaylorImageRef.current, faceX, faceY, faceWidth, faceHeight);
          ctx.globalAlpha = 1.0;
          ctx.restore();
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
          // Bitcoin can only be eaten with mouth, not shot with hands
          if (p.type !== 'bitcoin') {
              for (const hand of handTips) {
                  const d = Math.sqrt(Math.pow(p.x - hand.x, 2) + Math.pow(p.y - hand.y, 2));
                  if (d < (p.size + SWAT_RADIUS)) {
                      hit = true;
                      break;
                  }
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

      // --- Bitcoin Eating (Mouth Detection) ---
      if (theme === 'bitcoin') {
        mouthPositions.forEach((mouth, mouthIndex) => {
          if (!mouth) return;

          for (let i = powerUpsRef.current.length - 1; i >= 0; i--) {
            const p = powerUpsRef.current[i];
            if (p.type !== 'bitcoin') continue;

            const distToMouth = Math.sqrt(Math.pow(p.x - mouth.x, 2) + Math.pow(p.y - mouth.y, 2));
            if (distToMouth < BITCOIN_EAT_RADIUS) {
              // Player ate Bitcoin! Trigger hero sound and effects
              playHeroSound();

              // Massive score bonus and particle effect
              scoreRef.current += 50; // Big points for eating Bitcoin
              onScoreChange(scoreRef.current);

              // Spawn lots of golden particles
              spawnParticles(p.x, p.y, COLOR_BITCOIN_ORB, w, h, 15, 3);

              // Heal player
              if (mouthIndex < livesRef.current.length && livesRef.current[mouthIndex] < MAX_LIVES) {
                livesRef.current[mouthIndex] = Math.min(MAX_LIVES, livesRef.current[mouthIndex] + 1);
                onLivesChange([...livesRef.current]);
              }

              powerUpsRef.current.splice(i, 1);
              break; // Only eat one Bitcoin per mouth per frame
            }
          }
        });
      }

      // --- Enemies ---
      for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
        const enemy = enemiesRef.current[i];
        
        let moveX = enemy.vx;
        let moveY = enemy.vy;

        // Altcoin movement - steady seeking
        const wobble = Math.sin(time * 0.005 + enemy.wobbleOffset) * 0.001;
        moveX += wobble;
        moveY += wobble;

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

             let pColor = COLOR_BITCOIN_PRIMARY;
             if (enemy.visualType in ALTCOIN_COLORS) {
                pColor = ALTCOIN_COLORS[enemy.visualType as keyof typeof ALTCOIN_COLORS];
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