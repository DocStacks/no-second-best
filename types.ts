export type Point = {
  x: number;
  y: number;
};

export type PlayerMode = '1p' | '2p';

export type EnemyTheme = 'bitcoin';

export type EnemyVisualType = 'eth' | 'usdt' | 'usdc' | 'bnb' | 'sol' | 'xrp' | 'trx' | 'doge' | 'ada' | 'steth' | 'link' | 'shib' | 'hbar' | 'dai' | 'avax' | 'uni' | 'aave' | 'comp' | 'zec' | 'etc';

export type Enemy = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  type: 'wanderer' | 'seeker';
  visualType: EnemyVisualType;
  speed: number;
  wobbleOffset: number;
  createdAt: number;
  animationOffset: number;
  targetFaceIndex: number; // 0 or 1
};

export type PowerUp = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  type: 'bomb' | 'bitcoin';
  life: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 1.0 to 0.0
  color: string;
  size: number;
};

export enum GameStatus {
  LANDING = 'LANDING',
  LOADING_MODELS = 'LOADING_MODELS',
  CALIBRATING = 'CALIBRATING',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
}

export interface GameStats {
  score: number;
  lives: number[]; // Array for P1 and P2
  highScore: number;
}