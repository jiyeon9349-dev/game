import React from 'react';
import { Volume2, VolumeX, Crosshair, MousePointer } from 'lucide-react';
import { DIFFICULTIES, type GameSettings, type HudSnapshot } from '../game/types';

interface TelemetrySidebarProps {
  hud: HudSnapshot;
  settings: GameSettings;
  onToggleSetting: (key: keyof GameSettings) => void;
}

export const TelemetrySidebar: React.FC<TelemetrySidebarProps> = ({
  hud,
  settings,
  onToggleSetting,
}) => {
  const accuracy =
    hud.shotsFired > 0 ? Math.round((hud.shotsHit / hud.shotsFired) * 100) : 0;

  return (
    <aside className="hidden lg:flex flex-col justify-between gap-5 bg-[#0F1929] border border-white/10 rounded-xl p-5 h-full">
      {/* Score & Wave Telemetry */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between border-b border-white/10 pb-3">
          <h2 className="font-display text-sm font-semibold text-slate-100">
            전투 기록
          </h2>
          <span className="text-xs text-slate-400">
            난이도 · {DIFFICULTIES[hud.difficulty].label}
          </span>
        </div>

        <div>
          <div className="text-xs text-slate-400">현재 점수</div>
          <div className="mt-0.5 font-mono-tabular text-3xl font-bold text-slate-50 tracking-tight">
            {hud.score.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <span>최고 기록</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular text-slate-200">
              {hud.highScore.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Combo Multiplier */}
        <div className="bg-slate-900/70 border border-white/10 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">연속 격추 배율</span>
            <span className="font-mono-tabular text-sm font-bold text-amber-400">
              x{hud.combo.toFixed(2)}
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-sm overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all duration-100"
              style={{ width: `${Math.round(hud.comboTimerRatio * 100)}%` }}
            />
          </div>
        </div>

        {/* Wave Progress */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium">
              웨이브 {hud.wave} {hud.wave % 5 === 0 ? '· 보스전' : ''}
            </span>
            <span className="font-mono-tabular text-slate-400">
              남은 적 {hud.enemiesRemaining}
            </span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-sm overflow-hidden">
            <div
              className="h-full bg-slate-200 transition-all duration-150"
              style={{ width: `${Math.round(hud.waveProgress * 100)}%` }}
            />
          </div>
        </div>

        {/* Stats Row (Unboxed with middot) */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10 text-xs">
          <div>
            <div className="text-slate-400">총 격추</div>
            <div className="mt-0.5 font-mono-tabular text-base font-semibold text-slate-100">
              {hud.kills.toLocaleString()}기
            </div>
          </div>
          <div>
            <div className="text-slate-400">명중률</div>
            <div className="mt-0.5 font-mono-tabular text-base font-semibold text-slate-100">
              {accuracy}%
            </div>
          </div>
        </div>
      </div>

      {/* Tactical Toggles & Key Legend */}
      <div className="space-y-3 pt-2 border-t border-white/10">
        <h2 className="font-display text-sm font-semibold text-slate-100">
          전투 설정
        </h2>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onToggleSetting('autoFire')}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-white/10 bg-slate-900/60 hover:bg-slate-800/80 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <span className="flex items-center gap-2 text-xs font-medium text-slate-200">
              <Crosshair className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>자동 사격</span>
            </span>
            <span className={`font-mono-tabular text-xs font-semibold ${settings.autoFire ? 'text-emerald-400' : 'text-slate-400'}`}>
              {settings.autoFire ? '켜짐' : '꺼짐'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onToggleSetting('mouseFollow')}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-white/10 bg-slate-900/60 hover:bg-slate-800/80 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <span className="flex items-center gap-2 text-xs font-medium text-slate-200">
              <MousePointer className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>마우스 조종</span>
            </span>
            <span className={`font-mono-tabular text-xs font-semibold ${settings.mouseFollow ? 'text-emerald-400' : 'text-slate-400'}`}>
              {settings.mouseFollow ? '켜짐' : '꺼짐'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onToggleSetting('muted')}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-white/10 bg-slate-900/60 hover:bg-slate-800/80 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <span className="flex items-center gap-2 text-xs font-medium text-slate-200">
              {settings.muted ? (
                <VolumeX className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              )}
              <span>효과음</span>
            </span>
            <span className={`font-mono-tabular text-xs font-semibold ${!settings.muted ? 'text-emerald-400' : 'text-slate-400'}`}>
              {!settings.muted ? '켜짐' : '음소거'}
            </span>
          </button>
        </div>

        <div className="pt-2 text-xs text-slate-400 space-y-1.5 border-t border-white/10">
          <div className="flex justify-between">
            <span>이동</span>
            <span className="font-mono-tabular text-slate-300">WASD · 방향키 · 마우스</span>
          </div>
          <div className="flex justify-between">
            <span>사격 / 폭탄</span>
            <span className="font-mono-tabular text-slate-300">Space · B · 우클릭</span>
          </div>
          <div className="flex justify-between">
            <span>일시정지</span>
            <span className="font-mono-tabular text-slate-300">P · Esc</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
