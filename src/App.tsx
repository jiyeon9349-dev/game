import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Zap, Shield } from 'lucide-react';
import { SoundEngine } from './game/audio';
import { ShooterEngine } from './game/engine';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DIFFICULTIES,
  type Difficulty,
  type GameSettings,
  type HighScoreRecord,
  type HudSnapshot,
  type UpgradeId,
  getUpgradeCost,
} from './game/types';
import { TopBar, type ModalKind } from './components/TopBar';
import { UpgradeSidebar } from './components/UpgradeSidebar';
import { TelemetrySidebar } from './components/TelemetrySidebar';
import { GameModals } from './components/GameModals';

const KEYART_SRC = '/src/assets/images/apex_strike_keyart_1795160093048.jpg';
const RECORDS_STORAGE_KEY = 'apex_strike_records_v1';

const INITIAL_HUD: HudSnapshot = {
  gameState: 'TITLE_MENU',
  difficulty: 'standard',
  score: 0,
  highScore: 0,
  credits: 0,
  combo: 1.0,
  comboTimerRatio: 0,
  wave: 1,
  waveProgress: 0,
  enemiesRemaining: 0,
  hp: 100,
  maxHp: 100,
  shields: 1,
  bombs: 3,
  upgrades: {
    weaponLevel: 1,
    fireRateLevel: 1,
    droneCount: 0,
  },
  bossActive: false,
  bossName: '',
  bossHp: 0,
  bossMaxHp: 1,
  kills: 0,
  shotsFired: 0,
  shotsHit: 0,
  waveKills: 0,
  waveBonusCredits: 0,
  waveDamageTaken: 0,
  bossWarningText: null,
};

function loadRecords(): HighScoreRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECORDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ShooterEngine | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('standard');
  const [settings, setSettings] = useState<GameSettings>({
    autoFire: true,
    muted: false,
    mouseFollow: true,
  });
  const [activeModal, setActiveModal] = useState<ModalKind>(null);
  const [records, setRecords] = useState<HighScoreRecord[]>(() => loadRecords());
  const [keyArtError, setKeyArtError] = useState(false);

  const handleGameOver = useCallback((finalSnap: HudSnapshot) => {
    const newEntry: HighScoreRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      score: finalSnap.score,
      wave: finalSnap.wave,
      kills: finalSnap.kills,
      difficulty: finalSnap.difficulty,
      date: new Date().toISOString(),
    };
    setRecords((prev) => {
      const updated = [...prev, newEntry]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      try {
        window.localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage quota issues
      }
      return updated;
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sound = new SoundEngine();
    soundRef.current = sound;

    const engine = new ShooterEngine(
      canvas,
      sound,
      (snap) => setHud(snap),
      handleGameOver
    );
    engineRef.current = engine;

    const onResize = () => engine.setupCanvasResolution();
    window.addEventListener('resize', onResize);

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(
          e.code
        )
      ) {
        e.preventDefault();
      }
      engine.handleKeyDown(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      engine.handleKeyUp(e.code);
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      engine.destroy();
      engineRef.current = null;
    };
  }, [handleGameOver]);

  const handleStartGame = () => {
    setActiveModal(null);
    engineRef.current?.startNewGame(selectedDifficulty);
  };

  const handleSelectDifficulty = (diff: Difficulty) => {
    setSelectedDifficulty(diff);
    engineRef.current?.setDifficulty(diff);
  };

  const handlePrimaryTopAction = () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (hud.gameState === 'PLAYING' || hud.gameState === 'PAUSED') {
      engine.togglePause();
    } else if (hud.gameState === 'ROUND_SUMMARY') {
      engine.continueNextWave();
    } else {
      handleStartGame();
    }
  };

  const handleUpgrade = (id: UpgradeId) => {
    engineRef.current?.purchaseUpgrade(id);
  };

  const handleTriggerBomb = () => {
    engineRef.current?.triggerBomb();
  };

  const handleToggleSetting = (key: keyof GameSettings) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      engineRef.current?.setSettings(next);
      return next;
    });
  };

  const handleClearRecords = () => {
    setRecords([]);
    try {
      window.localStorage.removeItem(RECORDS_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const accuracy =
    hud.shotsFired > 0 ? Math.round((hud.shotsHit / hud.shotsFired) * 100) : 0;

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-[#09111E] text-slate-100 lg:overflow-hidden">
      <TopBar
        gameState={hud.gameState}
        onOpenModal={(m) => {
          if (hud.gameState === 'PLAYING') {
            engineRef.current?.togglePause();
          }
          setActiveModal(m);
        }}
        onPrimaryAction={handlePrimaryTopAction}
      />

      {/* Mobile Compact Telemetry Bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#0D1726] text-xs">
        <div className="flex items-center gap-3">
          <span className="font-mono-tabular font-bold text-slate-50">
            {hud.score.toLocaleString()}점
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="font-mono-tabular text-amber-400">
            W{hud.wave}
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="font-mono-tabular text-emerald-400">
            HP {hud.hp}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono-tabular text-amber-400">{hud.credits} C</span>
          <button
            type="button"
            onClick={() => handleToggleSetting('muted')}
            aria-label={settings.muted ? '효과음 켜기' : '음소거'}
            className="p-1.5 rounded-md bg-slate-800 text-slate-200 cursor-pointer"
          >
            {settings.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main 3-Column Tactical Arena */}
      <main className="flex-1 min-h-0 w-full max-w-[1320px] mx-auto px-3 py-3 lg:px-6 lg:py-4 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_280px] gap-4 lg:gap-6 items-stretch">
        {/* Left Sidebar: Hull & Live Upgrades */}
        <UpgradeSidebar
          hud={hud}
          onUpgrade={handleUpgrade}
          onTriggerBomb={handleTriggerBomb}
        />

        {/* Center Stage: Dominant Game Canvas */}
        <section className="relative flex items-center justify-center min-h-0">
          <div
            className="relative w-full max-w-[540px] lg:max-w-none lg:h-full aspect-[560/740] max-h-[calc(100vh-12rem)] lg:max-h-full bg-[#09111E] border border-white/15 rounded-xl overflow-hidden shadow-2xl select-none"
            onContextMenu={(e) => e.preventDefault()}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onPointerMove={(e) =>
                engineRef.current?.handlePointerMove(e.clientX, e.clientY)
              }
              onPointerDown={(e) =>
                engineRef.current?.handlePointerDown(e.clientX, e.clientY, e.button)
              }
              onPointerUp={() => engineRef.current?.handlePointerUp()}
              onPointerLeave={() => engineRef.current?.handlePointerLeave()}
              className="w-full h-full block touch-none cursor-crosshair"
            />

            {/* Boss HP Header inside Canvas */}
            {hud.gameState === 'PLAYING' && hud.bossActive && (
              <div className="pointer-events-none absolute top-3 inset-x-4 bg-slate-950/85 border border-red-500/40 rounded-lg px-3.5 py-2 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-display font-semibold text-red-400">
                    {hud.bossName}
                  </span>
                  <span className="font-mono-tabular text-slate-200">
                    {Math.max(0, hud.bossHp).toLocaleString()} / {hud.bossMaxHp.toLocaleString()}
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-xs overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all duration-100"
                    style={{
                      width: `${Math.max(0, Math.round((hud.bossHp / hud.bossMaxHp) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Boss Approach Alert Banner */}
            {hud.gameState === 'PLAYING' && hud.bossWarningText && (
              <div className="pointer-events-none absolute top-16 inset-x-6 bg-red-950/90 border border-red-500/50 rounded-lg px-4 py-2.5 text-center">
                <span className="font-display text-sm font-bold text-red-200 tracking-wide">
                  {hud.bossWarningText}
                </span>
              </div>
            )}

            {/* TITLE MENU OVERLAY */}
            {hud.gameState === 'TITLE_MENU' && (
              <div className="absolute inset-0 flex flex-col justify-between bg-[#09111E]">
                {/* Key Art Banner with Measured Scrim */}
                <div className="relative h-52 sm:h-60 w-full overflow-hidden border-b border-white/10">
                  {!keyArtError ? (
                    <img
                      src={KEYART_SRC}
                      alt="전술 요격기 에이펙스 스트라이크 출격 일러스트"
                      referrerPolicy="no-referrer"
                      onError={() => setKeyArtError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-[#09111E] flex items-center justify-center">
                      <Zap className="w-12 h-12 text-amber-500/60" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#09111E] via-[#09111E]/35 to-transparent" />
                  <div className="absolute bottom-4 left-6 right-6">
                    <div className="text-xs font-medium text-amber-400">
                      전술 공중 아케이드 슈터
                    </div>
                    <h1 className="mt-1 font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                      Apex Strike
                    </h1>
                  </div>
                </div>

                {/* Menu Body */}
                <div className="flex-1 p-6 flex flex-col justify-between gap-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>난이도 선택</span>
                      {hud.highScore > 0 && (
                        <span className="font-mono-tabular text-slate-200">
                          최고 점수 {hud.highScore.toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-1 bg-slate-900 rounded-lg border border-white/10">
                      {(['standard', 'veteran', 'ace'] as Difficulty[]).map(
                        (diff) => {
                          const cfg = DIFFICULTIES[diff];
                          const active = selectedDifficulty === diff;
                          return (
                            <button
                              key={diff}
                              type="button"
                              onClick={() => handleSelectDifficulty(diff)}
                              className={`py-2 px-2 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                active
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
                              }`}
                            >
                              {cfg.label}
                            </button>
                          );
                        }
                      )}
                    </div>

                    <p className="text-xs text-slate-400">
                      {DIFFICULTIES[selectedDifficulty].description}
                    </p>
                  </div>

                  {/* Concise unboxed controls summary */}
                  <div className="border-t border-white/10 pt-4 space-y-2 text-xs text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">기체 이동</span>
                      <span className="font-mono-tabular">WASD · 방향키 · 마우스</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">주포 / EMP 폭탄</span>
                      <span className="font-mono-tabular">Space(자동) · B / 우클릭</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">실시간 강화</span>
                      <span className="font-mono-tabular">1~4 키 또는 좌측 패널</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartGame}
                    className="w-full py-3.5 px-6 bg-amber-500 hover:bg-amber-400 active:translate-y-px text-slate-950 font-display font-bold text-base rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  >
                    게임 시작
                  </button>
                </div>
              </div>
            )}

            {/* PAUSED OVERLAY */}
            {hud.gameState === 'PAUSED' && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-6">
                <div className="w-full max-w-xs bg-[#0F1929] border border-white/15 rounded-xl p-6 text-center space-y-5">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-slate-50">
                      일시정지
                    </h2>
                    <p className="mt-1 text-xs text-slate-400">
                      웨이브 {hud.wave} · 현재 점수 {hud.score.toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => engineRef.current?.togglePause()}
                      className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      계속하기
                    </button>
                    <button
                      type="button"
                      onClick={() => engineRef.current?.returnToMenu()}
                      className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      타이틀로 돌아가기
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ROUND SUMMARY OVERLAY */}
            {hud.gameState === 'ROUND_SUMMARY' && (
              <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-6">
                <div className="w-full max-w-sm bg-[#0F1929] border border-white/15 rounded-xl p-6 space-y-5">
                  <div className="border-b border-white/10 pb-3">
                    <div className="text-xs font-medium text-emerald-400">
                      구역 확보 완료
                    </div>
                    <h2 className="mt-1 font-display text-2xl font-bold text-slate-50">
                      웨이브 {hud.wave} 돌파
                    </h2>
                  </div>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">격추한 적</span>
                      <span className="font-mono-tabular font-semibold text-slate-100">
                        {hud.waveKills}기
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">웨이브 보상 크레딧</span>
                      <span className="font-mono-tabular font-semibold text-amber-400">
                        +{hud.waveBonusCredits} C
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">무피해 보너스</span>
                      <span className="font-mono-tabular text-slate-200">
                        {hud.waveDamageTaken === 0 ? '달성 (+50 C)' : '미달성'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400">
                    다음 웨이브 출격 전 보유 크레딧({hud.credits} C)으로 기체를 강화할 수 있습니다.
                  </p>

                  <button
                    type="button"
                    onClick={() => engineRef.current?.continueNextWave()}
                    className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    웨이브 {hud.wave + 1} 시작 (Space)
                  </button>
                </div>
              </div>
            )}

            {/* GAME OVER OVERLAY */}
            {hud.gameState === 'GAME_OVER' && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-6">
                <div className="w-full max-w-sm bg-[#0F1929] border border-white/15 rounded-xl p-6 space-y-5">
                  <div className="border-b border-white/10 pb-3">
                    <div className="text-xs font-medium text-red-400">
                      기체 대파 · 작전 종료
                    </div>
                    <h2 className="mt-1 font-display text-2xl font-bold text-slate-50">
                      최종 전투 결과
                    </h2>
                  </div>

                  <div>
                    <div className="text-xs text-slate-400">최종 점수</div>
                    <div className="mt-0.5 font-mono-tabular text-3xl font-extrabold text-amber-400">
                      {hud.score.toLocaleString()}
                    </div>
                    {hud.score > 0 && hud.score >= hud.highScore && (
                      <div className="mt-1 text-xs font-medium text-emerald-400">
                        신기록 달성
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/10 text-xs">
                    <div>
                      <div className="text-slate-400">도달 웨이브</div>
                      <div className="mt-0.5 font-mono-tabular text-base font-bold text-slate-100">
                        W{hud.wave}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">격추 수</div>
                      <div className="mt-0.5 font-mono-tabular text-base font-bold text-slate-100">
                        {hud.kills}기
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">명중률</div>
                      <div className="mt-0.5 font-mono-tabular text-base font-bold text-slate-100">
                        {accuracy}%
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleStartGame}
                      className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      다시 플레이
                    </button>
                    <button
                      type="button"
                      onClick={() => engineRef.current?.returnToMenu()}
                      className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      타이틀
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Sidebar: Score Telemetry & Settings */}
        <TelemetrySidebar
          hud={hud}
          settings={settings}
          onToggleSetting={handleToggleSetting}
        />
      </main>

      {/* Mobile Bottom Controls & Quick Upgrades */}
      <div className="lg:hidden border-t border-white/10 bg-[#0D1726] px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(['weapon', 'firerate', 'drone', 'repair'] as UpgradeId[]).map((id) => {
            const cost = getUpgradeCost(id, hud.upgrades);
            const label =
              id === 'weapon'
                ? '주포'
                : id === 'firerate'
                  ? '연사'
                  : id === 'drone'
                    ? '드론'
                    : '수리';
            const disabled =
              (hud.gameState !== 'PLAYING' && hud.gameState !== 'ROUND_SUMMARY') ||
              cost === null ||
              hud.credits < cost ||
              (id === 'repair' && hud.hp >= hud.maxHp);
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => handleUpgrade(id)}
                className="px-2.5 py-2 rounded-md border border-white/10 bg-slate-900 text-xs font-medium text-slate-200 disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {label} {cost !== null ? `${cost}C` : 'MAX'}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={hud.gameState !== 'PLAYING' || hud.bombs <= 0}
            onClick={handleTriggerBomb}
            className="px-3 py-2 rounded-md bg-amber-500 text-slate-950 font-semibold text-xs disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>EMP ({hud.bombs})</span>
          </button>
        </div>
      </div>

      <GameModals
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
        records={records}
        onClearRecords={handleClearRecords}
      />
    </div>
  );
}
