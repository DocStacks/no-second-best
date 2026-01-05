import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameStatus, Enemy, Point, Particle, EnemyVisualType, PowerUp, EnemyTheme, PlayerMode } from '../types';
import {
  VIDEO_WIDTH, VIDEO_HEIGHT, ENEMY_SIZE, SHOOT_RADIUS,
  FACE_HIT_RADIUS, MAX_LIVES,
  ENEMY_SPAWN_INTERVAL_START, ENEMY_SPAWN_INTERVAL_MIN, ENEMY_SPEED_BASE,
  COLOR_TARGET_ACTIVE, POWERUP_SPAWN_CHANCE, POWERUP_SIZE,
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
  const lastFaceResultRef = useRef<any>(null); // Store last face detection result for screenshots
  const exitIntentTriggeredRef = useRef<boolean>(false); // Track if exit intent was already triggered
  const hasMouseMovedRef = useRef<boolean>(false); // Track if user has moved mouse at all
  
  // Hand tracking state for no-hands detection
  const handsEverDetectedRef = useRef<boolean>(false); // Track if hands have ever been shown
  const lastHandDetectedTimeRef = useRef<number>(0); // Last time hands were detected
  const noHandsGameOverTriggeredRef = useRef<boolean>(false); // Prevent multiple game overs
  const previousStatusRef = useRef<GameStatus>(status); // Track previous status for pause/resume handling

  const [showFingerGunPrompt, setShowFingerGunPrompt] = useState<boolean>(false);

  // Initialize Camera and preload Michael Saylor image
  useEffect(() => {
    const startCamera = async () => {
      if (videoRef.current) {
        try {
          // Detect if mobile device
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
          
          // On mobile, don't constrain dimensions - let camera use native orientation (portrait)
          // On desktop, prefer landscape dimensions
          const videoConstraints: MediaTrackConstraints = isMobile
            ? { facingMode: "user" }
            : {
                width: { ideal: VIDEO_WIDTH },
                height: { ideal: VIDEO_HEIGHT },
                facingMode: "user"
              };
          
          const stream = await navigator.mediaDevices.getUserMedia({
            video: videoConstraints
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
    img.onload = () => {
      console.log('Michael Saylor image loaded successfully');
      michaelSaylorImageRef.current = img;
    };
    img.onerror = () => {
      console.error('Failed to load Michael Saylor image');
    };
    img.src = MICHAEL_SAYLOR_IMAGE;

    // Preload Bitcoin image for power-ups
    const bitcoinImg = new Image();
    bitcoinImg.onload = () => {
      altcoinImagesRef.current['bitcoin'] = bitcoinImg;
    };
    bitcoinImg.src = BITCOIN_IMAGE;

    // Preload altcoin images
    Object.entries(ALTCOIN_IMAGES).forEach(([coin, url]) => {
      const coinImg = new Image();
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
        // Reset lives for single player
        livesRef.current = [MAX_LIVES];
        
        gameStartTimeRef.current = performance.now();
        lastSpawnTimeRef.current = performance.now();
        onScoreChange(0);
        onLivesChange(livesRef.current);
        
        // Reset exit intent tracking for new game
        exitIntentTriggeredRef.current = false;
        hasMouseMovedRef.current = false;
        
        // Reset hand tracking for new game
        handsEverDetectedRef.current = false;
        lastHandDetectedTimeRef.current = 0; // Will be set when hands are first detected
        noHandsGameOverTriggeredRef.current = false;
        setShowFingerGunPrompt(false);
      } else if (previousStatusRef.current === GameStatus.PAUSED) {
        // Resuming from pause - reset hand detection timer to prevent
        // immediate game over due to pause duration being counted
        if (handsEverDetectedRef.current) {
          lastHandDetectedTimeRef.current = performance.now();
        }
      }
      startMusic();
    } else if (status === GameStatus.GAME_OVER) {
      stopMusic();
      gameStartTimeRef.current = 0; 
    } else {
      stopMusic(); 
    }
    
    // Track previous status for next transition
    previousStatusRef.current = status;
  }, [status, playerMode, onScoreChange, onLivesChange]);

  const captureScreenshot = useCallback((faceResult?: any) => {
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

        // 2. Draw Michael Saylor overlay on faces (always, for screenshots)
        if (faceResult && faceResult.faceLandmarks.length > 0 && michaelSaylorImageRef.current) {
          faceResult.faceLandmarks.forEach((landmarks: any) => {
            const nose = landmarks[1]; // Nose tip landmark
            const leftEye = landmarks[33]; // Left eye landmark
            const rightEye = landmarks[263]; // Right eye landmark

            // Calculate face dimensions and position
            // Mirror the X coordinates to match the mirrored video
            const faceWidth = Math.abs(rightEye.x - leftEye.x) * compositeCanvas.width * 3; // Scale up for overlay
            const faceHeight = faceWidth * 1.2; // Slightly taller than wide
            const faceX = (1 - nose.x) * compositeCanvas.width - faceWidth / 2; // Mirror X coordinate
            const faceY = nose.y * compositeCanvas.height - faceHeight / 2;

            // Draw Michael Saylor image overlay with Bitcoin colors
            ctx.save();
            ctx.globalAlpha = 0.8; // More visible for screenshots

            // Add Bitcoin orange glow effect
            ctx.shadowColor = '#f7931a';
            ctx.shadowBlur = 20;

            ctx.drawImage(michaelSaylorImageRef.current, faceX, faceY, faceWidth, faceHeight);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1.0;
            ctx.restore();
          });
        }

        // 3. Draw Game Overlay
        ctx.drawImage(canvas, 0, 0);

        // 4. Draw Bitcoin Logo (bottom right corner)
        const bitcoinImg = altcoinImagesRef.current['bitcoin'];
        if (bitcoinImg && bitcoinImg.complete) {
          const logoSize = 80; // Size of the Bitcoin logo
          const padding = 20; // Padding from edges
          const logoX = compositeCanvas.width - logoSize - padding;
          const logoY = compositeCanvas.height - logoSize - padding;

          // Add glow effect
          ctx.save();
          ctx.shadowColor = '#f7931a';
          ctx.shadowBlur = 15;
          ctx.globalAlpha = 0.9; // Slightly transparent

          ctx.drawImage(bitcoinImg, logoX, logoY, logoSize, logoSize);
          ctx.restore();
        }

        // 5. Save
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

         // Draw Michael Saylor overlay on faces (always, for screenshots)
         if (faceResult && faceResult.faceLandmarks.length > 0 && michaelSaylorImageRef.current) {
           faceResult.faceLandmarks.forEach((landmarks: any) => {
             const nose = landmarks[1]; // Nose tip landmark
             const leftEye = landmarks[33]; // Left eye landmark
             const rightEye = landmarks[263]; // Right eye landmark

             // Calculate face dimensions and position
             // Mirror the X coordinates to match the mirrored video
             const faceWidth = Math.abs(rightEye.x - leftEye.x) * compositeCanvas.width * 3; // Scale up for overlay
             const faceHeight = faceWidth * 1.2; // Slightly taller than wide
             const faceX = (1 - nose.x) * compositeCanvas.width - faceWidth / 2; // Mirror X coordinate
             const faceY = nose.y * compositeCanvas.height - faceHeight / 2;

             // Draw Michael Saylor image overlay with Bitcoin colors
             ctx.save();
             ctx.globalAlpha = 0.8; // More visible for screenshots

             // Add Bitcoin orange glow effect
             ctx.shadowColor = '#f7931a';
             ctx.shadowBlur = 20;

             ctx.drawImage(michaelSaylorImageRef.current, faceX, faceY, faceWidth, faceHeight);
             ctx.shadowBlur = 0;
             ctx.globalAlpha = 1.0;
             ctx.restore();
           });
         }

         ctx.drawImage(canvas, 0, 0);

         // Draw Bitcoin Logo (bottom right corner)
         const bitcoinImg = altcoinImagesRef.current['bitcoin'];
         if (bitcoinImg && bitcoinImg.complete) {
           const logoSize = 80; // Size of the Bitcoin logo
           const padding = 20; // Padding from edges
           const logoX = compositeCanvas.width - logoSize - padding;
           const logoY = compositeCanvas.height - logoSize - padding;

           // Add glow effect
           ctx.save();
           ctx.shadowColor = '#f7931a';
           ctx.shadowBlur = 15;
           ctx.globalAlpha = 0.9; // Slightly transparent

           ctx.drawImage(bitcoinImg, logoX, logoY, logoSize, logoSize);
           ctx.restore();
         }

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
         type: 'bitcoin',
         life: 1.0
       });
    }
  };

  // Exit Intent Detection - trigger game over when user tries to leave
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Only track if game is actively playing
      if (status !== GameStatus.PLAYING) return;
      
      // Mark that user has moved mouse (they're engaged)
      if (!hasMouseMovedRef.current) {
        hasMouseMovedRef.current = true;
      }
      
      // Exit intent: mouse moves to top 50px of screen
      // This typically indicates user is going to close tab/window
      if (!exitIntentTriggeredRef.current && hasMouseMovedRef.current && e.clientY <= 50) {
        exitIntentTriggeredRef.current = true;
        
        // Capture final screenshot with current state
        captureScreenshot(lastFaceResultRef.current);
        
        // Trigger game over with current score and screenshots
        onGameOver(scoreRef.current, screenshotsRef.current);
      }
    };

    // Add event listener
    document.addEventListener('mousemove', handleMouseMove);

    // Cleanup
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [status, captureScreenshot, onGameOver]);

  const spawnEnemy = (now: number, faceTargets: Point[]) => {
    const timePlayed = now - gameStartTimeRef.current;
    difficultyFactorRef.current = Math.min(timePlayed / 60000, 1);
    
    // Calculate spawn interval with increasing difficulty
    const currentInterval = ENEMY_SPAWN_INTERVAL_START - (difficultyFactorRef.current * (ENEMY_SPAWN_INTERVAL_START - ENEMY_SPAWN_INTERVAL_MIN));

    if (now - lastSpawnTimeRef.current > currentInterval) {
      let startX = 0, startY = 0;
      
      // Spawn altcoins from random edges
      const edge = Math.floor(Math.random() * 4);
      switch(edge) {
        case 0: startX = Math.random(); startY = -0.1; break; // Top
        case 1: startX = 1.1; startY = Math.random(); break; // Right
        case 2: startX = Math.random(); startY = 1.1; break; // Bottom
        case 3: startX = -0.1; startY = Math.random(); break; // Left
      }

      const rand = Math.random();
      
      // All altcoins are seekers (they chase the player/Bitcoin)
      const altcoinTypes = ['eth', 'usdt', 'usdc', 'bnb', 'sol', 'xrp', 'trx', 'doge', 'ada', 'steth', 'link', 'shib', 'hbar', 'dai', 'avax', 'uni', 'aave', 'comp', 'zec', 'etc'];
      const visualType = altcoinTypes[Math.floor(rand * altcoinTypes.length)] as EnemyVisualType;
      const speedMultiplier = 0.8 + rand * 0.6; // Varying speeds for different altcoins
      const isSeeker = true; // All altcoins chase the player

      const speed = ENEMY_SPEED_BASE * (1 + difficultyFactorRef.current) * speedMultiplier;

      // Single player mode - always target the first face
      const targetIndex = 0;

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
        size: ENEMY_SIZE,
        type: isSeeker ? 'seeker' : 'wanderer',
        visualType,
        speed,
        wobbleOffset: Math.random() * Math.PI * 2,
        animationOffset: Math.random() * 100,
        createdAt: now,
        targetFaceIndex: 0
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
       captureScreenshot(lastFaceResultRef.current);
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
        // Store last face result for screenshot overlay
        lastFaceResultRef.current = faceResult;
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
      const handsDetectedThisFrame = handResult && handResult.landmarks.length > 0;
      
      if (handsDetectedThisFrame) {
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
            
            ctx.strokeStyle = COLOR_TARGET_ACTIVE;
            ctx.lineWidth = 3;
            ctx.shadowBlur = 10;
            ctx.shadowColor = COLOR_TARGET_ACTIVE;
            ctx.stroke();
            ctx.shadowBlur = 0;
        });
        
        // Mark that hands have been detected and update last detection time
        if (status === GameStatus.PLAYING) {
          handsEverDetectedRef.current = true;
          lastHandDetectedTimeRef.current = time;
          setShowFingerGunPrompt(false); // Hide prompt when hands are shown
        }
      }
      
      // No-hands detection logic (only when playing)
      if (status === GameStatus.PLAYING && !handsDetectedThisFrame) {
        const timeSinceLastHand = time - lastHandDetectedTimeRef.current;
        const timeSinceGameStart = time - gameStartTimeRef.current;
        
        if (!handsEverDetectedRef.current) {
          // Hands have never been shown - after 3 seconds, show finger gun prompt
          if (timeSinceGameStart > 3000) {
            setShowFingerGunPrompt(true);
          }
        } else {
          // Hands were shown before but now gone - trigger game over after brief grace period
          if (timeSinceLastHand > 1500 && !noHandsGameOverTriggeredRef.current) {
            noHandsGameOverTriggeredRef.current = true;
            captureScreenshot(lastFaceResultRef.current);
            onGameOver(scoreRef.current, screenshotsRef.current);
          }
        }
      }

      // Draw Michael Saylor overlay on faces for Bitcoin theme
      if (theme === 'bitcoin' && michaelSaylorImageRef.current && faceResult && faceResult.faceLandmarks.length > 0) {
        // Sort faces left-to-right to match faceTargets ordering
        const sortedFaces = faceResult.faceLandmarks.map(landmarks => landmarks[1]); // Nose tip
        sortedFaces.sort((a, b) => a.x - b.x);

        sortedFaces.forEach((nose, faceIndex) => {
          // Get the full landmark set for this face (find the original landmarks that correspond to this sorted nose)
          const originalLandmarks = faceResult.faceLandmarks.find(landmarks => landmarks[1] === nose);
          if (!originalLandmarks) return;

          // Validate landmarks exist and have valid coordinates
          const leftEye = originalLandmarks[33];
          const rightEye = originalLandmarks[263];

          if (!nose || !leftEye || !rightEye ||
              typeof nose.x !== 'number' || typeof nose.y !== 'number' ||
              typeof leftEye.x !== 'number' || typeof leftEye.y !== 'number' ||
              typeof rightEye.x !== 'number' || typeof rightEye.y !== 'number') {
            return;
          }

          // Calculate face dimensions and position
          const faceWidth = Math.abs(rightEye.x - leftEye.x) * w * 3; // Scale up for overlay
          const faceHeight = faceWidth * 1.2; // Slightly taller than wide
          const faceX = nose.x * w - faceWidth / 2;
          const faceY = nose.y * h - faceHeight / 2;

          // Validate calculated position
          if (faceWidth > 0 && faceHeight > 0 && faceX >= -faceWidth && faceX <= w && faceY >= -faceHeight && faceY <= h) {
            // Draw Michael Saylor image overlay
            ctx.save();

            // Draw the image
            ctx.globalAlpha = 0.8; // More visible overlay
            ctx.drawImage(michaelSaylorImageRef.current, faceX, faceY, faceWidth, faceHeight);

            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1.0;
            ctx.restore();
          }
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


          if (p.x > 1.2) powerUpsRef.current.splice(i, 1);
      }

      // --- Bitcoin Eating (Michael Saylor Overlay) ---
      if (theme === 'bitcoin') {
        // Use the stored faceResult from earlier detection to avoid double detection calls
        const faceResult = lastFaceResultRef.current;
        if (faceResult && faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
          faceResult.faceLandmarks.forEach((landmarks: any, faceIndex: number) => {
            if (faceIndex >= faceTargets.length) return;

            const nose = landmarks[1]; // Nose tip landmark
            const leftEye = landmarks[33]; // Left eye landmark
            const rightEye = landmarks[263]; // Right eye landmark

            // Calculate overlay dimensions and position (same as drawing code)
            const faceWidth = Math.abs(rightEye.x - leftEye.x) * w * 3;
            const faceHeight = faceWidth * 1.2;
            const faceX = nose.x * w - faceWidth / 2;
            const faceY = nose.y * h - faceHeight / 2;

            // Check if any Bitcoin intersects with the overlay rectangle
            for (let i = powerUpsRef.current.length - 1; i >= 0; i--) {
              const p = powerUpsRef.current[i];
              if (p.type !== 'bitcoin') continue;

              const bitcoinX = p.x * w;
              const bitcoinY = p.y * h;
              const bitcoinSize = p.size * w;

              // Check if Bitcoin center is within the overlay rectangle
              if (bitcoinX >= faceX && bitcoinX <= faceX + faceWidth &&
                  bitcoinY >= faceY && bitcoinY <= faceY + faceHeight) {
                // Player ate Bitcoin! Trigger hero sound and effects
                playHeroSound();

                // Massive score bonus and particle effect
                scoreRef.current += 50; // Big points for eating Bitcoin
                onScoreChange(scoreRef.current);

                // Spawn lots of golden particles
                spawnParticles(p.x, p.y, COLOR_BITCOIN_ORB, w, h, 15, 3);

                // Heal player
                if (faceIndex < livesRef.current.length && livesRef.current[faceIndex] < MAX_LIVES) {
                  livesRef.current[faceIndex] = Math.min(MAX_LIVES, livesRef.current[faceIndex] + 1);
                  onLivesChange([...livesRef.current]);
                }

                // Clear all enemies on screen
                enemiesRef.current.forEach(e => {
                    spawnParticles(e.x, e.y, '#ffffff', w, h, 6, 2);
                });
                const points = enemiesRef.current.length * 2;
                enemiesRef.current = [];
                scoreRef.current += points;
                onScoreChange(scoreRef.current);

                powerUpsRef.current.splice(i, 1);
                break; // Only eat one Bitcoin per face per frame
              }
            }
          });
        }
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

          // Check if finger gun hits altcoin
          let destroyed = false;
          for (const hand of handTips) {
               const distToHand = Math.sqrt(Math.pow(enemy.x - hand.x, 2) + Math.pow(enemy.y - hand.y, 2));
               if (distToHand < (enemy.size/2 + SHOOT_RADIUS)) {
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

          // Check if altcoin hits player's face - Single player mode
          let bitFace = false;
          let victimIndex = 0; // Always affect player 1

          // Check face for collision with altcoin
          faceTargets.forEach((face, idx) => {
              const distToFace = Math.sqrt(Math.pow(enemy.x - face.x, 2) + Math.pow(enemy.y - face.y, 2));
              if (distToFace < FACE_HIT_RADIUS) {
                  bitFace = true;
              }
          });

          if (bitFace && victimIndex !== -1 && livesRef.current[victimIndex] > 0) {
               enemiesRef.current.splice(i, 1);
               livesRef.current[victimIndex] = Math.max(0, livesRef.current[victimIndex] - 1);
               onLivesChange([...livesRef.current]);
               playBiteSound();

               // Game over when all lives depleted
              if (livesRef.current[victimIndex] <= 0) {
                // Capture final moment
                captureScreenshot(lastFaceResultRef.current);
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
    <div className="absolute inset-0 w-full h-full bg-black">
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
      
      {/* Finger Gun Prompt */}
      {showFingerGunPrompt && status === GameStatus.PLAYING && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="bg-black/80 backdrop-blur-sm px-8 py-6 rounded-2xl border-2 border-orange-500 shadow-lg shadow-orange-500/30 animate-pulse">
            <p className="text-white text-2xl md:text-3xl font-bold text-center">
              👆 Use your finger guns! 🔫
            </p>
            <p className="text-orange-400 text-lg md:text-xl text-center mt-2">
              Point at altcoins to destroy them
            </p>
          </div>
        </div>
      )}
    </div>
  );
};