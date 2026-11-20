import { SoundEngine } from './audio';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DIFFICULTIES,
  type Difficulty,
  type EnemyType,
  type GameSettings,
  type GameState,
  type HudSnapshot,
  type PickupType,
  type UpgradeId,
  type UpgradeState,
  getUpgradeCost,
} from './types';

interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
  alpha: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  isPlayer: boolean;
  isHoming?: boolean;
  isDrone?: boolean;
  color: string;
  trail?: Array<{ x: number; y: number }>;
}

interface Enemy {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  fireCooldown: number;
  age: number;
  hitFlash: number;
  scoreValue: number;
  creditValue: number;
  phaseSeed: number;
  // Sniper telegraph
  telegraphTimer: number;
  targetAngle: number;
  // Boss state
  bossPatternIndex: number;
  bossPatternTimer: number;
  bossTitle: string;
}

interface Pickup {
  x: number;
  y: number;
  vy: number;
  type: PickupType;
  radius: number;
  age: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
}

interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

interface SpawnEntry {
  delay: number;
  type: EnemyType;
  x: number;
}

const HIGH_SCORE_KEY = 'apex_strike_high_score_v1';

export class ShooterEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sound: SoundEngine;
  private onHudUpdate: (snapshot: HudSnapshot) => void;
  private onGameOverCallback: (snapshot: HudSnapshot) => void;

  private rafId: number | null = null;
  private lastTimestamp = 0;
  private hudSyncTimer = 0;
  private reducedMotion = false;

  // Game State
  private gameState: GameState = 'TITLE_MENU';
  private difficulty: Difficulty = 'standard';
  private settings: GameSettings = {
    autoFire: true,
    muted: false,
    mouseFollow: true,
  };

  // Player
  private player = {
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 96,
    vx: 0,
    vy: 0,
    speed: 350,
    radius: 6, // Tight core hitbox
    hp: 100,
    maxHp: 100,
    shields: 1,
    bombs: 3,
    invulnTimer: 0,
    fireTimer: 0,
    homingTimer: 0,
    bank: 0, // -1 to 1 visual tilt
  };

  private upgrades: UpgradeState = {
    weaponLevel: 1,
    fireRateLevel: 1,
    droneCount: 0,
  };

  // Progression & Stats
  private score = 0;
  private highScore = 0;
  private credits = 0;
  private combo = 1.0;
  private comboTimer = 0;
  private readonly maxComboTimer = 3.2;

  private wave = 1;
  private waveTotalEnemies = 0;
  private waveSpawnedCount = 0;
  private spawnQueue: SpawnEntry[] = [];
  private spawnElapsed = 0;
  private waveKills = 0;
  private waveBonusCredits = 0;
  private waveDamageTaken = 0;
  private waveClearDelay = 0;

  private kills = 0;
  private shotsFired = 0;
  private shotsHit = 0;
  private nextEnemyId = 1;

  // Boss Warning Banner
  private bossWarningTimer = 0;
  private bossWarningText: string | null = null;

  // Entities
  private stars: Star[] = [];
  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private pickups: Pickup[] = [];
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];
  private floatingTexts: FloatingText[] = [];

  // Visual Juice
  private gridOffset = 0;
  private screenShake = 0;

  // Inputs
  private keys = new Set<string>();
  private pointerActive = false;
  private pointerDown = false;
  private pointerX = CANVAS_WIDTH / 2;
  private pointerY = CANVAS_HEIGHT - 96;
  private mobileFireHeld = false;

  constructor(
    canvas: HTMLCanvasElement,
    sound: SoundEngine,
    onHudUpdate: (snapshot: HudSnapshot) => void,
    onGameOverCallback: (snapshot: HudSnapshot) => void
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not initialize 2D canvas context');
    }
    this.ctx = context;
    this.sound = sound;
    this.onHudUpdate = onHudUpdate;
    this.onGameOverCallback = onGameOverCallback;

    if (typeof window !== 'undefined') {
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const saved = window.localStorage.getItem(HIGH_SCORE_KEY);
      if (saved) {
        const parsed = Number.parseInt(saved, 10);
        if (!Number.isNaN(parsed)) this.highScore = parsed;
      }
    }

    this.initStars();
    this.setupCanvasResolution();
    this.emitHud();
    this.startLoop();
  }

  public setupCanvasResolution(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = CANVAS_WIDTH * dpr;
    this.canvas.height = CANVAS_HEIGHT * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private initStars(): void {
    this.stars = [];
    for (let i = 0; i < 90; i++) {
      const layer = Math.random();
      this.stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        speed: 22 + layer * 95,
        size: 0.8 + layer * 1.6,
        alpha: 0.2 + layer * 0.65,
      });
    }
  }

  private startLoop(): void {
    this.lastTimestamp = performance.now();
    const tick = (now: number) => {
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = Math.min(rawDt, 0.05);

      this.update(dt);
      this.render();

      this.rafId = window.requestAnimationFrame(tick);
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  public destroy(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public setSettings(next: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...next };
    this.sound.setMuted(this.settings.muted);
  }

  public setDifficulty(difficulty: Difficulty): void {
    this.difficulty = difficulty;
    this.emitHud();
  }

  public startNewGame(difficulty?: Difficulty): void {
    if (difficulty) {
      this.difficulty = difficulty;
    }
    this.sound.unlock();
    const cfg = DIFFICULTIES[this.difficulty];

    this.gameState = 'PLAYING';
    this.score = 0;
    this.credits = 60;
    this.combo = 1.0;
    this.comboTimer = 0;
    this.wave = 1;
    this.kills = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;

    this.player.x = CANVAS_WIDTH / 2;
    this.player.y = CANVAS_HEIGHT - 96;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.hp = 100;
    this.player.maxHp = 100;
    this.player.shields = cfg.startingShields;
    this.player.bombs = cfg.startingBombs;
    this.player.invulnTimer = 1.2;
    this.player.fireTimer = 0;
    this.player.homingTimer = 0;
    this.player.bank = 0;

    this.upgrades = {
      weaponLevel: 1,
      fireRateLevel: 1,
      droneCount: 0,
    };

    this.bullets = [];
    this.enemies = [];
    this.pickups = [];
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.screenShake = 0;
    this.bossWarningTimer = 0;
    this.bossWarningText = null;

    this.prepareWave(1);
    this.emitHud();
  }

  public togglePause(): void {
    if (this.gameState === 'PLAYING') {
      this.gameState = 'PAUSED';
      this.emitHud();
    } else if (this.gameState === 'PAUSED') {
      this.gameState = 'PLAYING';
      this.emitHud();
    }
  }

  public continueNextWave(): void {
    if (this.gameState !== 'ROUND_SUMMARY') return;
    this.wave += 1;
    this.gameState = 'PLAYING';
    this.prepareWave(this.wave);
    this.emitHud();
  }

  public returnToMenu(): void {
    this.gameState = 'TITLE_MENU';
    this.bullets = [];
    this.enemies = [];
    this.pickups = [];
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.emitHud();
  }

  public setMobileFire(held: boolean): void {
    this.mobileFireHeld = held;
  }

  public handleKeyDown(code: string): void {
    this.keys.add(code);
    if (code === 'KeyP' || code === 'Escape') {
      if (this.gameState === 'PLAYING' || this.gameState === 'PAUSED') {
        this.togglePause();
      }
    } else if (code === 'KeyB' || code === 'ShiftLeft' || code === 'ShiftRight') {
      if (this.gameState === 'PLAYING') {
        this.triggerBomb();
      }
    } else if (code === 'Digit1') {
      this.purchaseUpgrade('weapon');
    } else if (code === 'Digit2') {
      this.purchaseUpgrade('firerate');
    } else if (code === 'Digit3') {
      this.purchaseUpgrade('drone');
    } else if (code === 'Digit4') {
      this.purchaseUpgrade('repair');
    } else if (code === 'Space' && this.gameState === 'ROUND_SUMMARY') {
      this.continueNextWave();
    }
  }

  public handleKeyUp(code: string): void {
    this.keys.delete(code);
  }

  public handlePointerMove(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const x = ((clientX - rect.left) / rect.width) * CANVAS_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
    this.pointerX = Math.max(20, Math.min(CANVAS_WIDTH - 20, x));
    this.pointerY = Math.max(40, Math.min(CANVAS_HEIGHT - 24, y));
    this.pointerActive = true;
  }

  public handlePointerDown(clientX: number, clientY: number, button: number): void {
    this.sound.unlock();
    if (button === 2) {
      if (this.gameState === 'PLAYING') {
        this.triggerBomb();
      }
      return;
    }
    this.pointerDown = true;
    this.handlePointerMove(clientX, clientY);
  }

  public handlePointerUp(): void {
    this.pointerDown = false;
  }

  public handlePointerLeave(): void {
    this.pointerDown = false;
    this.pointerActive = false;
  }

  public purchaseUpgrade(id: UpgradeId): boolean {
    if (this.gameState !== 'PLAYING' && this.gameState !== 'ROUND_SUMMARY') {
      return false;
    }

    const cost = getUpgradeCost(id, this.upgrades);
    if (cost === null || this.credits < cost) return false;

    if (id === 'repair' && this.player.hp >= this.player.maxHp) {
      return false;
    }

    this.credits -= cost;
    this.sound.playUpgrade();

    if (id === 'weapon') {
      this.upgrades.weaponLevel += 1;
      this.spawnFloatingText(this.player.x, this.player.y - 26, `주포 Lv.${this.upgrades.weaponLevel}`, '#F59E0B');
    } else if (id === 'firerate') {
      this.upgrades.fireRateLevel += 1;
      this.spawnFloatingText(this.player.x, this.player.y - 26, `연사 Lv.${this.upgrades.fireRateLevel}`, '#F59E0B');
    } else if (id === 'drone') {
      this.upgrades.droneCount += 1;
      this.spawnFloatingText(this.player.x, this.player.y - 26, '보조 드론 배치', '#10B981');
    } else if (id === 'repair') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 35);
      this.spawnFloatingText(this.player.x, this.player.y - 26, '+35 내구도 수리', '#10B981');
    }

    this.spawnShockwave(this.player.x, this.player.y, 46, '#F59E0B');
    this.emitHud();
    return true;
  }

  public triggerBomb(): boolean {
    if (this.gameState !== 'PLAYING' || this.player.bombs <= 0) return false;

    this.player.bombs -= 1;
    this.player.invulnTimer = Math.max(this.player.invulnTimer, 1.4);
    this.sound.playBomb();

    if (!this.reducedMotion) {
      this.screenShake = Math.max(this.screenShake, 12);
    }

    this.spawnShockwave(this.player.x, this.player.y, 520, '#F59E0B');
    this.spawnFloatingText(this.player.x, this.player.y - 34, 'EMP 충격파 발동', '#FBBF24');

    // Clear all enemy bullets and award bonus points
    let clearedCount = 0;
    this.bullets = this.bullets.filter((b) => {
      if (!b.isPlayer) {
        clearedCount += 1;
        this.spawnParticles(b.x, b.y, 3, '#FBBF24', 90);
        return false;
      }
      return true;
    });
    if (clearedCount > 0) {
      this.addScore(clearedCount * 15);
    }

    // Damage all active enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const dmg = e.type === 'boss' ? 280 : 220;
      e.hp -= dmg;
      e.hitFlash = 0.16;
      this.spawnParticles(e.x, e.y, 10, '#F59E0B', 160);
      if (e.hp <= 0) {
        this.destroyEnemy(i);
      }
    }

    this.emitHud();
    return true;
  }

  private prepareWave(waveNum: number): void {
    this.spawnQueue = [];
    this.spawnElapsed = 0;
    this.waveSpawnedCount = 0;
    this.waveKills = 0;
    this.waveBonusCredits = 0;
    this.waveDamageTaken = 0;
    this.waveClearDelay = 0;

    const isBossWave = waveNum % 5 === 0;

    if (isBossWave) {
      this.bossWarningTimer = 2.6;
      const bossNames = ['아이기스 드레드노트', '타이탄 헤비 캐리어', '오메가 발키리'];
      const name = bossNames[(Math.floor(waveNum / 5) - 1) % bossNames.length];
      this.bossWarningText = `경고 · ${name} 접근 중`;
      this.sound.playBossWarning();

      this.spawnQueue.push({
        delay: 1.8,
        type: 'boss',
        x: CANVAS_WIDTH / 2,
      });
      this.waveTotalEnemies = 1;
      return;
    }

    // Standard Tactical Formations
    let cursorDelay = 0.6;
    const squadCount = Math.min(4 + Math.floor(waveNum * 0.8), 10);

    for (let s = 0; s < squadCount; s++) {
      const roll = Math.random();
      if (waveNum >= 3 && roll < 0.22) {
        // Sniper pair
        this.spawnQueue.push({ delay: cursorDelay, type: 'sniper', x: 110 + Math.random() * 120 });
        this.spawnQueue.push({ delay: cursorDelay + 0.25, type: 'sniper', x: CANVAS_WIDTH - 110 - Math.random() * 120 });
        cursorDelay += 1.9;
      } else if (waveNum >= 2 && roll < 0.45) {
        // Heavy Bomber with Scout escorts
        const bx = 130 + Math.random() * (CANVAS_WIDTH - 260);
        this.spawnQueue.push({ delay: cursorDelay, type: 'bomber', x: bx });
        this.spawnQueue.push({ delay: cursorDelay + 0.3, type: 'scout', x: Math.max(45, bx - 75) });
        this.spawnQueue.push({ delay: cursorDelay + 0.3, type: 'scout', x: Math.min(CANVAS_WIDTH - 45, bx + 75) });
        cursorDelay += 2.2;
      } else if (roll < 0.72) {
        // Interceptor V-Formation
        const cx = 120 + Math.random() * (CANVAS_WIDTH - 240);
        this.spawnQueue.push({ delay: cursorDelay, type: 'interceptor', x: cx });
        this.spawnQueue.push({ delay: cursorDelay + 0.25, type: 'interceptor', x: Math.max(50, cx - 70) });
        this.spawnQueue.push({ delay: cursorDelay + 0.25, type: 'interceptor', x: Math.min(CANVAS_WIDTH - 50, cx + 70) });
        cursorDelay += 1.75;
      } else {
        // Scout rush wave
        const count = 3 + (waveNum >= 4 ? 1 : 0);
        const startX = 70 + Math.random() * 120;
        const step = (CANVAS_WIDTH - 140) / count;
        for (let k = 0; k < count; k++) {
          this.spawnQueue.push({
            delay: cursorDelay + k * 0.22,
            type: 'scout',
            x: Math.max(40, Math.min(CANVAS_WIDTH - 40, startX + k * step * 0.7)),
          });
        }
        cursorDelay += 1.65;
      }
    }

    this.waveTotalEnemies = this.spawnQueue.length;
  }

  private spawnEnemy(type: EnemyType, x: number): void {
    const cfg = DIFFICULTIES[this.difficulty];
    const waveScale = 1 + (this.wave - 1) * 0.14;

    if (type === 'boss') {
      const tier = Math.floor(this.wave / 5);
      const bossNames = ['아이기스 드레드노트', '타이탄 헤비 캐리어', '오메가 발키리'];
      const bossTitle = bossNames[(tier - 1) % bossNames.length];
      const maxHp = Math.round((1350 + tier * 750) * cfg.enemyHpMult);

      this.enemies.push({
        id: this.nextEnemyId++,
        type: 'boss',
        x,
        y: -90,
        vx: 75 * cfg.enemySpeedMult,
        vy: 60,
        width: 150,
        height: 82,
        hp: maxHp,
        maxHp,
        fireCooldown: 1.4,
        age: 0,
        hitFlash: 0,
        scoreValue: 2500 * tier,
        creditValue: 180 + tier * 60,
        phaseSeed: Math.random() * Math.PI * 2,
        telegraphTimer: 0,
        targetAngle: Math.PI / 2,
        bossPatternIndex: 0,
        bossPatternTimer: 0,
        bossTitle,
      });
      return;
    }

    const specs: Record<Exclude<EnemyType, 'boss'>, { hp: number; w: number; h: number; vy: number; score: number; credit: number; cd: number }> = {
      scout: { hp: 22, w: 30, h: 28, vy: 135, score: 100, credit: 14, cd: 1.5 },
      interceptor: { hp: 42, w: 38, h: 32, vy: 105, score: 180, credit: 22, cd: 1.35 },
      bomber: { hp: 115, w: 54, h: 46, vy: 62, score: 340, credit: 42, cd: 1.85 },
      sniper: { hp: 56, w: 36, h: 34, vy: 82, score: 260, credit: 32, cd: 2.4 },
    };

    const spec = specs[type];
    const maxHp = Math.round(spec.hp * waveScale * cfg.enemyHpMult);

    this.enemies.push({
      id: this.nextEnemyId++,
      type,
      x,
      y: -42,
      vx: type === 'interceptor' ? (Math.random() < 0.5 ? -75 : 75) : 0,
      vy: spec.vy * cfg.enemySpeedMult,
      width: spec.w,
      height: spec.h,
      hp: maxHp,
      maxHp,
      fireCooldown: spec.cd * (0.6 + Math.random() * 0.5),
      age: 0,
      hitFlash: 0,
      scoreValue: spec.score,
      creditValue: spec.credit,
      phaseSeed: Math.random() * Math.PI * 2,
      telegraphTimer: 0,
      targetAngle: Math.PI / 2,
      bossPatternIndex: 0,
      bossPatternTimer: 0,
      bossTitle: '',
    });
  }

  private update(dt: number): void {
    // Always animate background stars cleanly
    this.gridOffset = (this.gridOffset + 48 * dt) % 40;
    for (const s of this.stars) {
      s.y += s.speed * dt;
      if (s.y > CANVAS_HEIGHT) {
        s.y = -4;
        s.x = Math.random() * CANVAS_WIDTH;
      }
    }

    if (this.gameState !== 'PLAYING') {
      return;
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 32);
    }

    if (this.bossWarningTimer > 0) {
      this.bossWarningTimer -= dt;
      if (this.bossWarningTimer <= 0) {
        this.bossWarningText = null;
      }
    }

    // Combo decay
    if (this.combo > 1.0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1.0;
        this.comboTimer = 0;
      }
    }

    this.updatePlayer(dt);
    this.updateSpawning(dt);
    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updatePickups(dt);
    this.updateEffects(dt);

    // Check Wave Complete
    if (
      this.spawnQueue.length === 0 &&
      this.enemies.length === 0 &&
      this.gameState === 'PLAYING'
    ) {
      this.waveClearDelay += dt;
      if (this.waveClearDelay >= 0.9) {
        const noDamageBonus = this.waveDamageTaken === 0 ? 50 : 0;
        const clearCredits = 60 + this.wave * 15 + noDamageBonus;
        this.waveBonusCredits = clearCredits;
        this.credits += clearCredits;
        this.addScore(300 * this.wave);
        this.sound.playWaveClear();
        this.gameState = 'ROUND_SUMMARY';
        this.emitHud();
      }
    }

    this.hudSyncTimer += dt;
    if (this.hudSyncTimer >= 0.065) {
      this.hudSyncTimer = 0;
      this.emitHud();
    }
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    if (p.invulnTimer > 0) p.invulnTimer = Math.max(0, p.invulnTimer - dt);

    let moveX = 0;
    let moveY = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) moveX -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) moveX += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) moveY -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) moveY += 1;

    if (moveX !== 0 || moveY !== 0) {
      const len = Math.hypot(moveX, moveY);
      p.vx = (moveX / len) * p.speed;
      p.vy = (moveY / len) * p.speed;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    } else if (this.pointerActive && (this.settings.mouseFollow || this.pointerDown)) {
      const dx = this.pointerX - p.x;
      const dy = this.pointerY - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 2) {
        const followSpeed = Math.min(dist * 14, 540);
        p.vx = (dx / dist) * followSpeed;
        p.vy = (dy / dist) * followSpeed;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      } else {
        p.vx = 0;
        p.vy = 0;
      }
    } else {
      p.vx *= 0.78;
      p.vy *= 0.78;
    }

    p.x = Math.max(24, Math.min(CANVAS_WIDTH - 24, p.x));
    p.y = Math.max(40, Math.min(CANVAS_HEIGHT - 28, p.y));

    // Smooth visual banking
    const targetBank = Math.max(-1, Math.min(1, p.vx / 280));
    p.bank += (targetBank - p.bank) * Math.min(1, dt * 14);

    // Thruster particles
    if (Math.random() < 0.75) {
      this.particles.push({
        x: p.x - 6 + (Math.random() - 0.5) * 3,
        y: p.y + 18,
        vx: (Math.random() - 0.5) * 18,
        vy: 140 + Math.random() * 70,
        life: 0.16,
        maxLife: 0.16,
        size: 2.3,
        color: '#F59E0B',
      });
      this.particles.push({
        x: p.x + 6 + (Math.random() - 0.5) * 3,
        y: p.y + 18,
        vx: (Math.random() - 0.5) * 18,
        vy: 140 + Math.random() * 70,
        life: 0.16,
        maxLife: 0.16,
        size: 2.3,
        color: '#F59E0B',
      });
    }

    // Firing
    p.fireTimer -= dt;
    p.homingTimer -= dt;
    const wantsFire =
      this.settings.autoFire ||
      this.keys.has('Space') ||
      this.pointerDown ||
      this.mobileFireHeld;

    if (wantsFire && p.fireTimer <= 0) {
      const interval = Math.max(0.082, 0.175 - (this.upgrades.fireRateLevel - 1) * 0.02);
      p.fireTimer = interval;
      this.firePlayerWeapons();
    }
  }

  private firePlayerWeapons(): void {
    const { x, y } = this.player;
    const lv = this.upgrades.weaponLevel;
    this.sound.playShoot(lv);

    const spawnShot = (ox: number, oy: number, vx: number, vy: number, dmg: number, r = 3.2, color = '#FBBF24') => {
      this.bullets.push({
        x: x + ox,
        y: y + oy,
        vx,
        vy,
        damage: dmg,
        radius: r,
        isPlayer: true,
        color,
      });
      this.shotsFired += 1;
    };

    if (lv === 1) {
      spawnShot(-8, -14, 0, -680, 11);
      spawnShot(8, -14, 0, -680, 11);
    } else if (lv === 2) {
      spawnShot(0, -18, 0, -710, 13, 3.6, '#FDE68A');
      spawnShot(-11, -10, -75, -660, 10);
      spawnShot(11, -10, 75, -660, 10);
    } else if (lv === 3) {
      spawnShot(-6, -16, 0, -720, 13, 3.6, '#FDE68A');
      spawnShot(6, -16, 0, -720, 13, 3.6, '#FDE68A');
      spawnShot(-15, -8, -110, -650, 10);
      spawnShot(15, -8, 110, -650, 10);
    } else if (lv === 4) {
      spawnShot(0, -20, 0, -760, 18, 4.2, '#FEF08A');
      spawnShot(-10, -14, -45, -700, 12);
      spawnShot(10, -14, 45, -700, 12);
      spawnShot(-18, -6, -145, -640, 10);
      spawnShot(18, -6, 145, -640, 10);
    } else {
      spawnShot(-5, -20, 0, -780, 16, 4.0, '#FEF08A');
      spawnShot(5, -20, 0, -780, 16, 4.0, '#FEF08A');
      spawnShot(-14, -12, -80, -710, 12);
      spawnShot(14, -12, 80, -710, 12);
      spawnShot(-20, -6, -175, -640, 11);
      spawnShot(20, -6, 175, -640, 11);
    }

    // Homing missiles on Lv.4+
    if (lv >= 4 && this.player.homingTimer <= 0 && this.enemies.length > 0) {
      this.player.homingTimer = lv === 5 ? 0.42 : 0.62;
      this.bullets.push({
        x: x - 16,
        y: y - 4,
        vx: -110,
        vy: -320,
        damage: 24,
        radius: 4,
        isPlayer: true,
        isHoming: true,
        color: '#34D399',
        trail: [],
      });
      this.bullets.push({
        x: x + 16,
        y: y - 4,
        vx: 110,
        vy: -320,
        damage: 24,
        radius: 4,
        isPlayer: true,
        isHoming: true,
        color: '#34D399',
        trail: [],
      });
      this.shotsFired += 2;
    }

    // Wingman Drones
    if (this.upgrades.droneCount >= 1) {
      const dx = x - 34;
      const dy = y + 4;
      this.bullets.push({
        x: dx,
        y: dy - 8,
        vx: 0,
        vy: -670,
        damage: 9,
        radius: 2.6,
        isPlayer: true,
        isDrone: true,
        color: '#10B981',
      });
      this.shotsFired += 1;
    }
    if (this.upgrades.droneCount >= 2) {
      const dx = x + 34;
      const dy = y + 4;
      this.bullets.push({
        x: dx,
        y: dy - 8,
        vx: 0,
        vy: -670,
        damage: 9,
        radius: 2.6,
        isPlayer: true,
        isDrone: true,
        color: '#10B981',
      });
      this.shotsFired += 1;
    }
  }

  private updateSpawning(dt: number): void {
    if (this.spawnQueue.length === 0) return;
    this.spawnElapsed += dt;

    while (this.spawnQueue.length > 0 && this.spawnQueue[0].delay <= this.spawnElapsed) {
      const next = this.spawnQueue.shift();
      if (next) {
        this.spawnEnemy(next.type, next.x);
        this.waveSpawnedCount += 1;
      }
    }
  }

  private updateBullets(dt: number): void {
    const p = this.player;

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];

      if (b.isHoming && this.enemies.length > 0) {
        let closest: Enemy | null = null;
        let minDist = Infinity;
        for (const e of this.enemies) {
          const d = Math.hypot(e.x - b.x, e.y - b.y);
          if (d < minDist) {
            minDist = d;
            closest = e;
          }
        }
        if (closest) {
          const desiredAngle = Math.atan2(closest.y - b.y, closest.x - b.x);
          const speed = 470;
          const targetVx = Math.cos(desiredAngle) * speed;
          const targetVy = Math.sin(desiredAngle) * speed;
          b.vx += (targetVx - b.vx) * Math.min(1, dt * 7.5);
          b.vy += (targetVy - b.vy) * Math.min(1, dt * 7.5);
        }
        if (b.trail) {
          b.trail.push({ x: b.x, y: b.y });
          if (b.trail.length > 6) b.trail.shift();
        }
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < -30 || b.x > CANVAS_WIDTH + 30 || b.y < -30 || b.y > CANVAS_HEIGHT + 30) {
        this.bullets.splice(i, 1);
        continue;
      }

      if (b.isPlayer) {
        let hit = false;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          const hw = e.width * 0.5 + b.radius;
          const hh = e.height * 0.5 + b.radius;
          if (Math.abs(b.x - e.x) <= hw && Math.abs(b.y - e.y) <= hh) {
            e.hp -= b.damage;
            e.hitFlash = 0.08;
            this.shotsHit += 1;
            this.sound.playHit();
            this.spawnParticles(b.x, b.y, 4, b.color, 95);
            if (e.hp <= 0) {
              this.destroyEnemy(j);
            }
            hit = true;
            break;
          }
        }
        if (hit) {
          this.bullets.splice(i, 1);
        }
      } else {
        // Enemy bullet vs Player core hitbox
        const dist = Math.hypot(b.x - p.x, b.y - p.y);
        if (dist <= p.radius + b.radius * 0.75) {
          this.bullets.splice(i, 1);
          this.damagePlayer(18);
        }
      }
    }
  }

  private updateEnemies(dt: number): void {
    const cfg = DIFFICULTIES[this.difficulty];
    const p = this.player;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.age += dt;
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);

      if (e.type === 'boss') {
        this.updateBoss(e, dt, cfg.bulletSpeedMult);
      } else if (e.type === 'scout') {
        e.y += e.vy * dt;
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0 && e.y > 40 && e.y < CANVAS_HEIGHT * 0.65) {
          e.fireCooldown = 1.8 / cfg.enemySpeedMult;
          this.fireEnemyAimed(e.x, e.y + 12, 230 * cfg.bulletSpeedMult, '#EF4444', 4);
        }
      } else if (e.type === 'interceptor') {
        e.y += e.vy * dt;
        e.x += Math.sin(e.age * 3.2 + e.phaseSeed) * 145 * dt;
        e.x = Math.max(30, Math.min(CANVAS_WIDTH - 30, e.x));
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0 && e.y > 40 && e.y < CANVAS_HEIGHT * 0.7) {
          e.fireCooldown = 1.45 / cfg.enemySpeedMult;
          const speed = 250 * cfg.bulletSpeedMult;
          this.bullets.push({
            x: e.x - 10,
            y: e.y + 12,
            vx: -38,
            vy: speed,
            damage: 16,
            radius: 4,
            isPlayer: false,
            color: '#F87171',
          });
          this.bullets.push({
            x: e.x + 10,
            y: e.y + 12,
            vx: 38,
            vy: speed,
            damage: 16,
            radius: 4,
            isPlayer: false,
            color: '#F87171',
          });
        }
      } else if (e.type === 'bomber') {
        e.y += e.vy * dt;
        e.fireCooldown -= dt;
        if (e.fireCooldown <= 0 && e.y > 50 && e.y < CANVAS_HEIGHT * 0.72) {
          e.fireCooldown = 1.95;
          const speed = 215 * cfg.bulletSpeedMult;
          const angles = [-0.32, 0, 0.32];
          for (const offset of angles) {
            const base = Math.atan2(p.y - e.y, p.x - e.x) + offset;
            this.bullets.push({
              x: e.x,
              y: e.y + 16,
              vx: Math.cos(base) * speed,
              vy: Math.sin(base) * speed,
              damage: 18,
              radius: 4.8,
              isPlayer: false,
              color: '#EF4444',
            });
          }
        }
      } else if (e.type === 'sniper') {
        if (e.y < 140) {
          e.y += e.vy * dt;
        } else {
          e.y += 14 * dt;
        }
        if (e.telegraphTimer > 0) {
          e.telegraphTimer -= dt;
          if (e.telegraphTimer <= 0) {
            const speed = 440 * cfg.bulletSpeedMult;
            this.bullets.push({
              x: e.x,
              y: e.y + 10,
              vx: Math.cos(e.targetAngle) * speed,
              vy: Math.sin(e.targetAngle) * speed,
              damage: 22,
              radius: 4.5,
              isPlayer: false,
              color: '#FCA5A5',
            });
            e.fireCooldown = 2.3;
          }
        } else {
          e.fireCooldown -= dt;
          if (e.fireCooldown <= 0 && e.y > 50 && e.y < CANVAS_HEIGHT * 0.6) {
            e.targetAngle = Math.atan2(p.y - e.y, p.x - e.x);
            e.telegraphTimer = 0.65;
          }
        }
      }

      // Remove if off-bottom
      if (e.y > CANVAS_HEIGHT + 80) {
        this.enemies.splice(i, 1);
        continue;
      }

      // Collision with player body
      const distX = Math.abs(e.x - p.x);
      const distY = Math.abs(e.y - p.y);
      if (distX < e.width * 0.42 + p.radius && distY < e.height * 0.42 + p.radius) {
        this.damagePlayer(e.type === 'boss' ? 30 : 24);
        if (e.type !== 'boss') {
          e.hp -= 80;
          if (e.hp <= 0) {
            this.destroyEnemy(i);
          }
        }
      }
    }
  }

  private updateBoss(e: Enemy, dt: number, bulletSpeedMult: number): void {
    if (e.y < 118) {
      e.y += 85 * dt;
      return;
    }

    const enraged = e.hp < e.maxHp * 0.5;
    const speedFactor = enraged ? 1.45 : 1.0;

    e.x += e.vx * speedFactor * dt;
    if (e.x < 95) {
      e.x = 95;
      e.vx = Math.abs(e.vx);
    } else if (e.x > CANVAS_WIDTH - 95) {
      e.x = CANVAS_WIDTH - 95;
      e.vx = -Math.abs(e.vx);
    }

    e.bossPatternTimer += dt * speedFactor;
    e.fireCooldown -= dt * speedFactor;

    if (e.fireCooldown <= 0) {
      const pattern = e.bossPatternIndex % 3;

      if (pattern === 0) {
        // Aimed 5-way fan
        const base = Math.atan2(this.player.y - e.y, this.player.x - e.x);
        const count = enraged ? 7 : 5;
        const spread = 0.16;
        for (let k = 0; k < count; k++) {
          const angle = base + (k - (count - 1) / 2) * spread;
          const speed = 245 * bulletSpeedMult;
          this.bullets.push({
            x: e.x,
            y: e.y + 28,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            damage: 18,
            radius: 4.5,
            isPlayer: false,
            color: '#EF4444',
          });
        }
        e.fireCooldown = 0.95;
      } else if (pattern === 1) {
        // Radial burst ring
        const ringCount = enraged ? 14 : 10;
        const offset = e.age * 1.1;
        for (let k = 0; k < ringCount; k++) {
          const angle = offset + (k / ringCount) * Math.PI * 2;
          const speed = 195 * bulletSpeedMult;
          this.bullets.push({
            x: e.x,
            y: e.y + 10,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            damage: 16,
            radius: 4.2,
            isPlayer: false,
            color: '#F87171',
          });
        }
        e.fireCooldown = 1.05;
      } else {
        // Twin wing turret streams
        const speed = 290 * bulletSpeedMult;
        this.fireEnemyAimed(e.x - 46, e.y + 20, speed, '#FCA5A5', 4.5);
        this.fireEnemyAimed(e.x + 46, e.y + 20, speed, '#FCA5A5', 4.5);
        e.fireCooldown = 0.42;
      }

      if (e.bossPatternTimer > 3.6) {
        e.bossPatternTimer = 0;
        e.bossPatternIndex += 1;
      }
    }
  }

  private fireEnemyAimed(x: number, y: number, speed: number, color: string, radius: number): void {
    const angle = Math.atan2(this.player.y - y, this.player.x - x);
    this.bullets.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage: 16,
      radius,
      isPlayer: false,
      color,
    });
  }

  private destroyEnemy(index: number): void {
    const e = this.enemies[index];
    this.enemies.splice(index, 1);

    this.kills += 1;
    this.waveKills += 1;
    this.combo = Math.min(4.0, Number((this.combo + 0.15).toFixed(2)));
    this.comboTimer = this.maxComboTimer;

    const gained = this.addScore(e.scoreValue);
    this.credits += e.creditValue;

    if (e.type === 'boss') {
      this.sound.playExplosion('boss');
      if (!this.reducedMotion) this.screenShake = 16;
      this.spawnParticles(e.x, e.y, 48, '#F59E0B', 260);
      this.spawnParticles(e.x, e.y, 32, '#EF4444', 200);
      this.spawnShockwave(e.x, e.y, 220, '#F59E0B');
      this.spawnFloatingText(e.x, e.y, `+${gained.toLocaleString()} 보스 격파`, '#FBBF24');

      // Boss clears remaining enemy bullets safely
      this.bullets = this.bullets.filter((b) => b.isPlayer);
      this.spawnPickup(e.x - 24, e.y, 'repair');
      this.spawnPickup(e.x + 24, e.y, 'bomb');
      this.spawnPickup(e.x, e.y - 16, 'shield');
    } else {
      this.sound.playExplosion(e.type === 'bomber' ? 'medium' : 'small');
      if (e.type === 'bomber' && !this.reducedMotion) {
        this.screenShake = Math.max(this.screenShake, 5);
      }
      this.spawnParticles(e.x, e.y, e.type === 'bomber' ? 22 : 12, '#F59E0B', 170);
      this.spawnParticles(e.x, e.y, 8, '#EF4444', 120);
      this.spawnShockwave(e.x, e.y, e.type === 'bomber' ? 62 : 34, '#F59E0B');
      this.spawnFloatingText(e.x, e.y - 8, `+${gained}`, '#F8FAFC');

      // Pickup drop roll
      const dropRoll = Math.random();
      if (e.type === 'bomber') {
        this.spawnPickup(e.x, e.y, dropRoll < 0.35 ? 'weapon' : dropRoll < 0.65 ? 'repair' : 'credit');
      } else if (dropRoll < 0.22) {
        const sub = Math.random();
        const type: PickupType =
          sub < 0.52 ? 'credit' : sub < 0.72 ? 'repair' : sub < 0.88 ? 'weapon' : sub < 0.96 ? 'shield' : 'bomb';
        this.spawnPickup(e.x, e.y, type);
      }
    }
  }

  private spawnPickup(x: number, y: number, type: PickupType): void {
    this.pickups.push({
      x,
      y,
      vy: 95,
      type,
      radius: 12,
      age: 0,
    });
  }

  private updatePickups(dt: number): void {
    const p = this.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.age += dt;
      pk.y += pk.vy * dt;

      // Gentle magnet pull when near player
      const dist = Math.hypot(p.x - pk.x, p.y - pk.y);
      if (dist < 110) {
        const pull = (1 - dist / 110) * 320 * dt;
        const angle = Math.atan2(p.y - pk.y, p.x - pk.x);
        pk.x += Math.cos(angle) * pull;
        pk.y += Math.sin(angle) * pull;
      }

      if (dist < 26) {
        this.collectPickup(pk.type, pk.x, pk.y);
        this.pickups.splice(i, 1);
        continue;
      }

      if (pk.y > CANVAS_HEIGHT + 30) {
        this.pickups.splice(i, 1);
      }
    }
  }

  private collectPickup(type: PickupType, x: number, y: number): void {
    this.sound.playPickup(type);
    if (type === 'credit') {
      this.credits += 35;
      this.addScore(80);
      this.spawnFloatingText(x, y, '+35 크레딧', '#FBBF24');
    } else if (type === 'repair') {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
      this.spawnFloatingText(x, y, '+25 내구도', '#10B981');
    } else if (type === 'shield') {
      this.player.shields = Math.min(3, this.player.shields + 1);
      this.spawnFloatingText(x, y, '보호막 +1', '#38BDF8');
    } else if (type === 'bomb') {
      this.player.bombs = Math.min(5, this.player.bombs + 1);
      this.spawnFloatingText(x, y, 'EMP 폭탄 +1', '#F59E0B');
    } else if (type === 'weapon') {
      if (this.upgrades.weaponLevel < 5) {
        this.upgrades.weaponLevel += 1;
        this.spawnFloatingText(x, y, `주포 Lv.${this.upgrades.weaponLevel}`, '#FBBF24');
      } else {
        this.credits += 65;
        this.addScore(250);
        this.spawnFloatingText(x, y, '+65 보너스 크레딧', '#FBBF24');
      }
    }
    this.emitHud();
  }

  private damagePlayer(amount: number): void {
    const p = this.player;
    if (p.invulnTimer > 0) return;

    if (p.shields > 0) {
      p.shields -= 1;
      p.invulnTimer = 1.2;
      this.sound.playPlayerDamage();
      this.spawnShockwave(p.x, p.y, 58, '#38BDF8');
      this.spawnFloatingText(p.x, p.y - 24, '보호막 흡수', '#38BDF8');
      this.emitHud();
      return;
    }

    p.hp = Math.max(0, p.hp - amount);
    p.invulnTimer = 1.1;
    this.waveDamageTaken += amount;
    this.combo = 1.0;
    this.comboTimer = 0;

    this.sound.playPlayerDamage();
    if (!this.reducedMotion) {
      this.screenShake = Math.max(this.screenShake, 9);
    }
    this.spawnParticles(p.x, p.y, 16, '#EF4444', 180);
    this.spawnFloatingText(p.x, p.y - 22, `-${amount}`, '#EF4444');

    if (p.hp <= 0) {
      this.triggerGameOver();
    } else {
      this.emitHud();
    }
  }

  private triggerGameOver(): void {
    this.gameState = 'GAME_OVER';
    this.sound.playExplosion('boss');
    this.spawnParticles(this.player.x, this.player.y, 38, '#F59E0B', 240);
    this.spawnShockwave(this.player.x, this.player.y, 140, '#EF4444');

    if (this.score > this.highScore) {
      this.highScore = this.score;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
      }
    }

    const snap = this.buildHudSnapshot();
    this.onHudUpdate(snap);
    this.onGameOverCallback(snap);
  }

  private addScore(base: number): number {
    const cfg = DIFFICULTIES[this.difficulty];
    const earned = Math.round(base * this.combo * cfg.scoreMult);
    this.score += earned;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore));
      }
    }
    return earned;
  }

  private spawnParticles(x: number, y: number, count: number, color: string, speed: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.3 + Math.random() * 0.7) * speed;
      const life = 0.25 + Math.random() * 0.28;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life,
        maxLife: life,
        size: 1.8 + Math.random() * 2.5,
        color,
      });
    }
  }

  private spawnShockwave(x: number, y: number, maxRadius: number, color: string): void {
    this.shockwaves.push({
      x,
      y,
      radius: 8,
      maxRadius,
      life: 0.35,
      maxLife: 0.35,
      color,
    });
  }

  private spawnFloatingText(x: number, y: number, text: string, color: string): void {
    this.floatingTexts.push({
      x,
      y,
      vy: -42,
      text,
      color,
      life: 0.75,
      maxLife: 0.75,
    });
  }

  private updateEffects(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      const progress = 1 - sw.life / sw.maxLife;
      sw.radius = 8 + (sw.maxRadius - 8) * progress;
      if (sw.life <= 0) this.shockwaves.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
  }

  private buildHudSnapshot(): HudSnapshot {
    const boss = this.enemies.find((e) => e.type === 'boss');
    const remaining = this.spawnQueue.length + this.enemies.length;
    const progress =
      this.waveTotalEnemies > 0
        ? Math.min(1, Math.max(0, (this.waveTotalEnemies - remaining) / this.waveTotalEnemies))
        : 0;

    return {
      gameState: this.gameState,
      difficulty: this.difficulty,
      score: this.score,
      highScore: this.highScore,
      credits: this.credits,
      combo: this.combo,
      comboTimerRatio: this.combo > 1 ? Math.max(0, this.comboTimer / this.maxComboTimer) : 0,
      wave: this.wave,
      waveProgress: progress,
      enemiesRemaining: remaining,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      shields: this.player.shields,
      bombs: this.player.bombs,
      upgrades: { ...this.upgrades },
      bossActive: Boolean(boss),
      bossName: boss?.bossTitle ?? '',
      bossHp: boss?.hp ?? 0,
      bossMaxHp: boss?.maxHp ?? 1,
      kills: this.kills,
      shotsFired: this.shotsFired,
      shotsHit: this.shotsHit,
      waveKills: this.waveKills,
      waveBonusCredits: this.waveBonusCredits,
      waveDamageTaken: this.waveDamageTaken,
      bossWarningText: this.bossWarningText,
    };
  }

  private emitHud(): void {
    this.onHudUpdate(this.buildHudSnapshot());
  }

  // ==================== RENDERING ====================
  private render(): void {
    const ctx = this.ctx;
    ctx.save();

    // Base Deep Slate-Navy Background (60% Dominant Neutral Canvas)
    ctx.fillStyle = '#09111E';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Subtle atmospheric horizon glow
    const bgGrad = ctx.createRadialGradient(
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT * 0.25,
      40,
      CANVAS_WIDTH / 2,
      CANVAS_HEIGHT * 0.45,
      440
    );
    bgGrad.addColorStop(0, 'rgba(30, 41, 59, 0.35)');
    bgGrad.addColorStop(1, 'rgba(9, 17, 30, 0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Tactical grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 40; x < CANVAS_WIDTH; x += 40) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
    }
    for (let y = this.gridOffset; y < CANVAS_HEIGHT; y += 40) {
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
    }
    ctx.stroke();

    // Parallax Starfield
    for (const s of this.stars) {
      ctx.fillStyle = `rgba(226, 232, 240, ${s.alpha})`;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }

    // Screen Shake
    if (this.screenShake > 0.2 && !this.reducedMotion) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

    // Shockwaves
    for (const sw of this.shockwaves) {
      const alpha = Math.max(0, sw.life / sw.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha * 0.8;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Pickups
    for (const pk of this.pickups) {
      this.drawPickup(ctx, pk);
    }

    // Enemies
    for (const e of this.enemies) {
      this.drawEnemy(ctx, e);
    }

    // Bullets
    for (const b of this.bullets) {
      this.drawBullet(ctx, b);
    }

    // Player & Drones (visible in PLAYING / PAUSED / ROUND_SUMMARY)
    if (this.gameState !== 'TITLE_MENU') {
      this.drawPlayer(ctx);
    }

    // Particles
    for (const pt of this.particles) {
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Floating Score / Status Text
    for (const ft of this.floatingTexts) {
      const alpha = Math.max(0, ft.life / ft.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '700 12px "JetBrains Mono", "Noto Sans KR", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    if (p.invulnTimer > 0 && Math.floor(p.invulnTimer * 18) % 2 === 0) {
      ctx.save();
      ctx.globalAlpha = 0.45;
    } else {
      ctx.save();
    }

    // Wingman Drones
    if (this.upgrades.droneCount >= 1) {
      this.drawDrone(ctx, p.x - 34, p.y + 4);
    }
    if (this.upgrades.droneCount >= 2) {
      this.drawDrone(ctx, p.x + 34, p.y + 4);
    }

    // Shield Aura
    if (p.shields > 0) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.fill();
    }

    // Fighter Jet Vector Shape with Bank Compression
    ctx.translate(p.x, p.y);
    const wingScaleX = 1 - Math.abs(p.bank) * 0.24;
    ctx.scale(wingScaleX, 1);

    // Main swept wings
    ctx.fillStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(22, 12);
    ctx.lineTo(14, 16);
    ctx.lineTo(5, 8);
    ctx.lineTo(-5, 8);
    ctx.lineTo(-14, 16);
    ctx.lineTo(-22, 12);
    ctx.closePath();
    ctx.fill();

    // Inner wing armor accent
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(13, 9);
    ctx.lineTo(0, 5);
    ctx.lineTo(-13, 9);
    ctx.closePath();
    ctx.fill();

    // Nose & Fuselage spine
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.moveTo(0, -23);
    ctx.lineTo(5, -4);
    ctx.lineTo(4, 15);
    ctx.lineTo(-4, 15);
    ctx.lineTo(-5, -4);
    ctx.closePath();
    ctx.fill();

    // Canopy (Amber tactical glass)
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.ellipse(0, -6, 2.7, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle Core Hitbox Indicator (helps bullet-hell dodging)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 1, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawDrone(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#10B981';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ECFDF5';
    ctx.beginPath();
    ctx.arc(0, -1, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy): void {
    ctx.save();

    // Sniper targeting telegraph laser
    if (e.type === 'sniper' && e.telegraphTimer > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y + 8);
      ctx.lineTo(e.x + Math.cos(e.targetAngle) * 760, e.y + Math.sin(e.targetAngle) * 760);
      ctx.stroke();
      ctx.restore();
    }

    ctx.translate(e.x, e.y);
    const flash = e.hitFlash > 0;

    if (e.type === 'scout') {
      ctx.fillStyle = flash ? '#FFFFFF' : '#94A3B8';
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.lineTo(14, -10);
      ctx.lineTo(0, -5);
      ctx.lineTo(-14, -10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = flash ? '#FFFFFF' : '#EF4444';
      ctx.beginPath();
      ctx.arc(0, 1, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'interceptor') {
      ctx.fillStyle = flash ? '#FFFFFF' : '#64748B';
      ctx.beginPath();
      ctx.moveTo(0, 16);
      ctx.lineTo(19, -4);
      ctx.lineTo(11, -15);
      ctx.lineTo(0, -8);
      ctx.lineTo(-11, -15);
      ctx.lineTo(-19, -4);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = flash ? '#FFFFFF' : '#DC2626';
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.lineTo(5, -6);
      ctx.lineTo(-5, -6);
      ctx.closePath();
      ctx.fill();
    } else if (e.type === 'bomber') {
      ctx.fillStyle = flash ? '#FFFFFF' : '#475569';
      ctx.beginPath();
      ctx.moveTo(0, 22);
      ctx.lineTo(26, 4);
      ctx.lineTo(22, -18);
      ctx.lineTo(-22, -18);
      ctx.lineTo(-26, 4);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = flash ? '#FFFFFF' : '#EF4444';
      ctx.fillRect(-14, -6, 28, 8);
    } else if (e.type === 'sniper') {
      ctx.fillStyle = flash ? '#FFFFFF' : '#334155';
      ctx.beginPath();
      ctx.moveTo(0, 18);
      ctx.lineTo(16, -12);
      ctx.lineTo(-16, -12);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = flash ? '#FFFFFF' : '#FCA5A5';
      ctx.beginPath();
      ctx.arc(0, 2, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'boss') {
      // Dreadnought Boss Silhouette
      ctx.fillStyle = flash ? '#FFFFFF' : '#334155';
      ctx.beginPath();
      ctx.moveTo(0, 40);
      ctx.lineTo(28, 22);
      ctx.lineTo(74, 8);
      ctx.lineTo(66, -24);
      ctx.lineTo(24, -36);
      ctx.lineTo(-24, -36);
      ctx.lineTo(-66, -24);
      ctx.lineTo(-74, 8);
      ctx.lineTo(-28, 22);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Wing turrets
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-54, -8, 16, 22);
      ctx.fillRect(38, -8, 16, 22);

      // Core reactor
      const coreColor = e.hp < e.maxHp * 0.5 ? '#F59E0B' : '#EF4444';
      ctx.fillStyle = flash ? '#FFFFFF' : coreColor;
      ctx.beginPath();
      ctx.arc(0, 4, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mini HP bar for damaged multi-hit enemies (non-boss)
    if (e.type !== 'boss' && e.hp < e.maxHp) {
      const bw = e.width;
      const ratio = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(-bw / 2, -e.height / 2 - 9, bw, 3.5);
      ctx.fillStyle = '#EF4444';
      ctx.fillRect(-bw / 2, -e.height / 2 - 9, bw * ratio, 3.5);
    }

    ctx.restore();
  }

  private drawBullet(ctx: CanvasRenderingContext2D, b: Bullet): void {
    ctx.save();

    if (b.trail && b.trail.length > 1) {
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.trail[0].x, b.trail[0].y);
      for (let i = 1; i < b.trail.length; i++) {
        ctx.lineTo(b.trail[i].x, b.trail[i].y);
      }
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    ctx.fillStyle = b.color;
    if (b.isPlayer && !b.isHoming) {
      ctx.fillRect(b.x - b.radius * 0.65, b.y - b.radius * 2.2, b.radius * 1.3, b.radius * 4.4);
    } else {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();

      if (!b.isPlayer) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawPickup(ctx: CanvasRenderingContext2D, pk: Pickup): void {
    ctx.save();
    ctx.translate(pk.x, pk.y);

    const palette: Record<PickupType, { border: string; bg: string; label: string }> = {
      weapon: { border: '#F59E0B', bg: 'rgba(245, 158, 11, 0.2)', label: 'P' },
      repair: { border: '#10B981', bg: 'rgba(16, 185, 129, 0.2)', label: 'H' },
      shield: { border: '#38BDF8', bg: 'rgba(56, 189, 248, 0.2)', label: 'S' },
      bomb: { border: '#F97316', bg: 'rgba(249, 115, 22, 0.2)', label: 'B' },
      credit: { border: '#FBBF24', bg: 'rgba(251, 191, 36, 0.18)', label: 'C' },
    };

    const style = palette[pk.type];
    const pulse = 1 + Math.sin(pk.age * 6) * 0.08;
    ctx.scale(pulse, pulse);

    ctx.fillStyle = style.bg;
    ctx.strokeStyle = style.border;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, pk.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 11px "JetBrains Mono", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.label, 0, 0.5);

    ctx.restore();
  }
}
