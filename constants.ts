export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 720;
export const ASPECT_RATIO = VIDEO_WIDTH / VIDEO_HEIGHT;

export const MAX_LIVES = 3;
export const FACE_HIT_RADIUS = 0.15; // Normalized relative to screen width
export const SHOOT_RADIUS = 0.08; // Radius for shooting altcoins with finger guns
export const ENEMY_SPAWN_INTERVAL_START = 1500; // ms - Starting spawn rate for altcoins
export const ENEMY_SPAWN_INTERVAL_MIN = 400; // ms - Minimum spawn rate (max difficulty)
export const ENEMY_SPEED_BASE = 0.003; // Normalized movement per frame
export const ENEMY_SIZE = 0.05; // Normalized size for altcoins

// Power Ups (Bitcoin)
export const POWERUP_SPAWN_CHANCE = 0.008; // Reduced from 0.025 to make Bitcoin less common
export const POWERUP_SIZE = 0.08;
export const BITCOIN_EAT_RADIUS = 0.1; // Radius for mouth to "eat" Bitcoin

// Bitcoin Theme Colors
export const COLOR_BITCOIN_PRIMARY = '#f7931a'; // Bitcoin Orange
export const COLOR_BITCOIN_DARK = '#d97706'; // Dark Orange
export const COLOR_BITCOIN_LIGHT = '#fed7aa'; // Light Orange
export const COLOR_BITCOIN_SHADOW = '#92400e'; // Shadow Orange

export const COLOR_POWERUP_ORB = '#f59e0b';
export const COLOR_POWERUP_GLOW = 'rgba(245, 158, 11, 0.4)';

export const COLOR_TARGET_ACTIVE = '#f7931a'; // Orange color for finger gun targets (Bitcoin theme)
export const COLOR_TARGET_IDLE = '#fbbf24';
export const COLOR_FACE_ZONE = 'rgba(239, 68, 68, 0.2)';

// Bitcoin Theme - Michael Saylor Hero
export const MICHAEL_SAYLOR_IMAGE = '/assets/michael-saylor.png';

// Bitcoin Theme - Bitcoin (Power-up)
export const COLOR_BITCOIN_ORB = '#f7931a'; // Bitcoin orange
export const COLOR_BITCOIN_GLOW = 'rgba(247, 147, 26, 0.4)';

// Bitcoin Theme - Power-up Images (local assets)
export const BITCOIN_IMAGE = '/assets/coins/bitcoin.png';

// Bitcoin Theme - Altcoin Images (local assets)
export const ALTCOIN_IMAGES = {
  'eth': '/assets/coins/eth.png',
  'usdt': '/assets/coins/usdt.png',
  'usdc': '/assets/coins/usdc.png',
  'bnb': '/assets/coins/bnb.png',
  'sol': '/assets/coins/sol.png',
  'xrp': '/assets/coins/xrp.png',
  'trx': '/assets/coins/trx.png',
  'doge': '/assets/coins/doge.png',
  'ada': '/assets/coins/ada.png',
  'steth': '/assets/coins/steth.png',
  'link': '/assets/coins/link.png',
  'shib': '/assets/coins/shib.png',
  'hbar': '/assets/coins/hbar.png',
  'dai': '/assets/coins/dai.png',
  'avax': '/assets/coins/avax.png',
  'uni': '/assets/coins/uni.png',
  'aave': '/assets/coins/aave.png',
  'comp': '/assets/coins/comp.png',
  'zec': '/assets/coins/zec.png',
  'etc': '/assets/coins/etc.png'
};

// Fallback colors for altcoins (if images fail to load)
export const ALTCOIN_COLORS = {
  'eth': '#627eea',
  'usdt': '#26a17b',
  'usdc': '#2775ca',
  'bnb': '#f3ba2f',
  'sol': '#9945ff',
  'xrp': '#23292f',
  'trx': '#ff060a',
  'doge': '#c2a633',
  'ada': '#0033ad',
  'steth': '#00a3ff',
  'link': '#375bd2',
  'shib': '#ffa409',
  'hbar': '#0e002a',
  'dai': '#f4b731',
  'avax': '#e84142',
  'uni': '#ff007a',
  'aave': '#b6509e',
  'comp': '#00d395',
  'zec': '#f4b728',
  'etc': '#328332'
};