export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'ROUND_SUMMARY' | 'GAME_OVER';

export type Difficulty = 'standard' | 'veteran' | 'ace';

export type EnemyType = 'scout' | 'interceptor' | 'bomber' | 'sniper' | 'boss';

export type PickupType = 'weapon' | 'repair' | 'shield' | 'bomb' | 'credit';

export type UpgradeId = 'weapon' | 'firerate' | 'drone' | 'repair';

export interface DifficultyConfig {
  id: Difficulty;
  label: string;
  description: string;
  enemyHpMult: number;
  enemySpeedMult: number;
  bulletSpeedMult: number;
  scoreMult: number;
  startingBombs: number;
  startingShields: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  standard: {
    id: 'standard',
    label: '표준',
    description: '균형 잡힌 탄속과 적 편대 구성',
    enemyHpMult: 1.0,
    enemySpeedMult: 1.0,
    bulletSpeedMult: 0.9,
    scoreMult: 1.0,
    startingBombs: 3,
    startingShields: 1,
  },
  veteran: {
    id: 'veteran',
    label: '베테랑',
    description: '빠른 탄막과 강화된 적 장갑 (점수 1.35배)',
    enemyHpMult: 1.25,
    enemySpeedMult: 1.15,
    bulletSpeedMult: 1.15,
    scoreMult: 1.35,
    startingBombs: 2,
    startingShields: 1,
  },
  ace: {
    id: 'ace',
    label: '에이스',
    description: '고밀도 탄막과 극한 공중전 (점수 1.75배)',
    enemyHpMult: 1.55,
    enemySpeedMult: 1.28,
    bulletSpeedMult: 1.35,
    scoreMult: 1.75,
    startingBombs: 2,
    startingShields: 0,
  },
};

export interface UpgradeState {
  weaponLevel: number;    // 1..5
  fireRateLevel: number;  // 1..5
  droneCount: number;     // 0..2
}

export interface HudSnapshot {
  gameState: GameState;
  difficulty: Difficulty;
  score: number;
  highScore: number;
  credits: number;
  combo: number;
  comboTimerRatio: number;
  wave: number;
  waveProgress: number; // 0..1
  enemiesRemaining: number;
  hp: number;
  maxHp: number;
  shields: number;
  bombs: number;
  upgrades: UpgradeState;
  bossActive: boolean;
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
  kills: number;
  shotsFired: number;
  shotsHit: number;
  waveKills: number;
  waveBonusCredits: number;
  waveDamageTaken: number;
  bossWarningText: string | null;
}

export interface HighScoreRecord {
  id: string;
  score: number;
  wave: number;
  kills: number;
  difficulty: Difficulty;
  date: string;
}

export interface GameSettings {
  autoFire: boolean;
  muted: boolean;
  mouseFollow: boolean;
}

export const CANVAS_WIDTH = 560;
export const CANVAS_HEIGHT = 740;

export function getUpgradeCost(id: UpgradeId, upgrades: UpgradeState): number | null {
  switch (id) {
    case 'weapon':
      if (upgrades.weaponLevel >= 5) return null;
      return 120 * upgrades.weaponLevel;
    case 'firerate':
      if (upgrades.fireRateLevel >= 5) return null;
      return 100 * upgrades.fireRateLevel;
    case 'drone':
      if (upgrades.droneCount >= 2) return null;
      return upgrades.droneCount === 0 ? 220 : 380;
    case 'repair':
      return 80;
  }
}
