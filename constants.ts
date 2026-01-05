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

// Power Ups
export const POWERUP_SPAWN_CHANCE = 0.002;
export const POWERUP_SIZE = 0.08;

// Colors - Bugs
export const COLOR_BUG_BEETLE = '#ef4444'; // Red
export const COLOR_BUG_WASP = '#fbbf24'; // Amber
export const COLOR_BUG_WASP_STRIPE = '#1f2937'; // Slate
export const COLOR_BUG_FLY = '#22d3ee'; // Cyan
export const COLOR_BUG_WING = 'rgba(255, 255, 255, 0.6)';

// Colors - Zombies
export const COLOR_ZOMBIE_SKIN = '#84cc16'; // Lime
export const COLOR_ZOMBIE_SHIRT = '#3b82f6'; // Blue
export const COLOR_ZOMBIE_EYES = '#ef4444'; // Red

// Colors - Spiders
export const COLOR_SPIDER_BODY = '#1e293b'; // Slate 800
export const COLOR_SPIDER_LEGS = '#0f172a'; // Slate 900
export const COLOR_SPIDER_EYES = '#a855f7'; // Purple

export const COLOR_POWERUP_ORB = '#f59e0b';
export const COLOR_POWERUP_GLOW = 'rgba(245, 158, 11, 0.4)';

export const COLOR_SWAT_ACTIVE = '#22c55e';
export const COLOR_SWAT_IDLE = '#fbbf24';
export const COLOR_FACE_ZONE = 'rgba(239, 68, 68, 0.2)';