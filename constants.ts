export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 720;
export const ASPECT_RATIO = VIDEO_WIDTH / VIDEO_HEIGHT;

export const MAX_LIVES = 3;
export const FACE_HIT_RADIUS = 0.15; // Normalized relative to screen width
export const SWAT_RADIUS = 0.08;
export const BUG_SPAWN_INTERVAL_START = 1500; // ms
export const BUG_SPAWN_INTERVAL_MIN = 400; // ms
export const BUG_SPEED_BASE = 0.003; // Normalized movement per frame
export const BUG_SIZE = 0.05; // Normalized size

// Power Ups (Bitcoin)
export const POWERUP_SPAWN_CHANCE = 0.002;
export const POWERUP_SIZE = 0.08;
export const BITCOIN_EAT_RADIUS = 0.1; // Radius for mouth to "eat" Bitcoin

// Colors - Bugs
export const COLOR_BUG_BEETLE = '#ef4444'; // Red
export const COLOR_BUG_WASP = '#fbbf24'; // Amber
export const COLOR_BUG_WASP_STRIPE = '#1f2937'; // Slate
export const COLOR_BUG_FLY = '#22d3ee'; // Cyan
export const COLOR_BUG_WING = 'rgba(255, 255, 255, 0.6)';

// Bitcoin Theme Colors
export const COLOR_BITCOIN_PRIMARY = '#f7931a'; // Bitcoin Orange
export const COLOR_BITCOIN_DARK = '#d97706'; // Dark Orange
export const COLOR_BITCOIN_LIGHT = '#fed7aa'; // Light Orange
export const COLOR_BITCOIN_SHADOW = '#92400e'; // Shadow Orange

export const COLOR_POWERUP_ORB = '#f59e0b';
export const COLOR_POWERUP_GLOW = 'rgba(245, 158, 11, 0.4)';

export const COLOR_SWAT_ACTIVE = '#22c55e';
export const COLOR_SWAT_IDLE = '#fbbf24';
export const COLOR_FACE_ZONE = 'rgba(239, 68, 68, 0.2)';

// Bitcoin Theme - Michael Saylor Hero
export const MICHAEL_SAYLOR_IMAGE = '/assets/michael-saylor.png';

// Bitcoin Theme - Bitcoin (Power-up)
export const COLOR_BITCOIN_ORB = '#f7931a'; // Bitcoin orange
export const COLOR_BITCOIN_GLOW = 'rgba(247, 147, 26, 0.4)';

// Bitcoin Theme - Power-up Images
export const BITCOIN_IMAGE = 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png';

// Bitcoin Theme - Altcoin Images (from CoinGecko CDN)
export const ALTCOIN_IMAGES = {
  'eth': 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
  'usdt': 'https://assets.coingecko.com/coins/images/325/large/Tether.png',
  'usdc': 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
  'bnb': 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
  'sol': 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
  'xrp': 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png',
  'trx': 'https://assets.coingecko.com/coins/images/1094/large/tron-logo.png',
  'doge': 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png',
  'ada': 'https://assets.coingecko.com/coins/images/975/large/cardano.png',
  'steth': 'https://assets.coingecko.com/coins/images/13442/large/steth_logo.png',
  'link': 'https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png',
  'shib': 'https://assets.coingecko.com/coins/images/11939/large/shiba.png',
  'hbar': 'https://assets.coingecko.com/coins/images/3688/large/hbar.png',
  'dai': 'https://assets.coingecko.com/coins/images/9956/large/Badge_Dai.png',
  'avax': 'https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png',
  'uni': 'https://assets.coingecko.com/coins/images/12504/large/uniswap-uni.png',
  'aave': 'https://assets.coingecko.com/coins/images/12645/large/AAVE.png',
  'comp': 'https://assets.coingecko.com/coins/images/10775/large/COMP.png',
  'zec': 'https://assets.coingecko.com/coins/images/486/large/circle-zcash-color.png',
  'etc': 'https://assets.coingecko.com/coins/images/453/large/ethereum-classic-logo.png'
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