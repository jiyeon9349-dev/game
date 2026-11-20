import React from 'react';
import { Shield, Zap, Crosshair, Wrench, Cpu } from 'lucide-react';
import { type HudSnapshot, type UpgradeId, getUpgradeCost } from '../game/types';

interface UpgradeSidebarProps {
  hud: HudSnapshot;
  onUpgrade: (id: UpgradeId) => void;
  onTriggerBomb: () => void;
}

export const UpgradeSidebar: React.FC<UpgradeSidebarProps> = ({
  hud,
  onUpgrade,
  onTriggerBomb,
}) => {
  const hpRatio = hud.maxHp > 0 ? hud.hp / hud.maxHp : 0;
  const hpStateLabel =
    hpRatio > 0.6 ? '안정' : hpRatio > 0.3 ? '주의' : '위험';
  const hpBarColor =
    hpRatio > 0.6
      ? 'bg-emerald-500'
      : hpRatio > 0.3
        ? 'bg-amber-500'
        : 'bg-red-500';

  const canShop = hud.gameState === 'PLAYING' || hud.gameState === 'ROUND_SUMMARY';

  const upgradeItems: Array<{
    id: UpgradeId;
    hotkey: string;
    name: string;
    subtitle: string;
    level: number;
    maxLevel: number;
    icon: React.ReactNode;
  }> = [
    {
      id: 'weapon',
      hotkey: '1',
      name: '주포 화력',
      subtitle: '탄 수 증가 및 Lv.4 유도 미사일',
      level: hud.upgrades.weaponLevel,
      maxLevel: 5,
      icon: <Crosshair className="w-4 h-4 text-amber-400 shrink-0" />,
    },
    {
      id: 'firerate',
      hotkey: '2',
      name: '연사 속도',
      subtitle: '발사 간격 단축',
      level: hud.upgrades.fireRateLevel,
      maxLevel: 5,
      icon: <Zap className="w-4 h-4 text-amber-400 shrink-0" />,
    },
    {
      id: 'drone',
      hotkey: '3',
      name: '보조 드론',
      subtitle: '자동 사격 호위기 편성',
      level: hud.upgrades.droneCount,
      maxLevel: 2,
      icon: <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />,
    },
    {
      id: 'repair',
      hotkey: '4',
      name: '긴급 수리',
      subtitle: '선체 내구도 +35 회복',
      level: hud.hp >= hud.maxHp ? 1 : 0,
      maxLevel: 1,
      icon: <Wrench className="w-4 h-4 text-emerald-400 shrink-0" />,
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col gap-5 bg-[#0F1929] border border-white/10 rounded-xl p-5 h-full justify-between">
      {/* Hull & Tactical Stock */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between border-b border-white/10 pb-3">
          <h2 className="font-display text-sm font-semibold text-slate-100">
            기체 상태
          </h2>
          <span className="text-xs text-slate-400">
            보유 크레딧 <strong className="font-mono-tabular text-amber-400 ml-1">{hud.credits.toLocaleString()}</strong>
          </span>
        </div>

        {/* Hull Bar with Non-Hue-Only Explicit Text State */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300">선체 내구도</span>
            <span className="font-mono-tabular text-slate-100">
              {hud.hp}/{hud.maxHp} · {hpStateLabel}
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-800 rounded-sm overflow-hidden">
            <div
              className={`h-full ${hpBarColor} transition-all duration-150`}
              style={{ width: `${Math.round(hpRatio * 100)}%` }}
            />
          </div>
        </div>

        {/* Shields & Bombs */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="bg-slate-900/70 border border-white/10 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Shield className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>에너지 보호막</span>
            </div>
            <div className="mt-1 font-mono-tabular text-lg font-bold text-slate-100">
              {hud.shields} / 3
            </div>
          </div>

          <button
            type="button"
            onClick={onTriggerBomb}
            disabled={hud.gameState !== 'PLAYING' || hud.bombs <= 0}
            className="text-left bg-slate-900/70 border border-white/10 hover:border-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg p-3 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>EMP 폭탄</span>
              <span className="font-mono-tabular text-[11px] text-amber-400">[B]</span>
            </div>
            <div className="mt-1 font-mono-tabular text-lg font-bold text-amber-400">
              {hud.bombs}발
            </div>
          </button>
        </div>
      </div>

      {/* Live Upgrades */}
      <div className="space-y-3 pt-2 border-t border-white/10 flex-1 flex flex-col justify-end">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-slate-100">
            전투 업그레이드
          </h2>
          <span className="text-xs text-slate-400">단축키 1–4</span>
        </div>

        <div className="space-y-2.5">
          {upgradeItems.map((item) => {
            const cost = getUpgradeCost(item.id, hud.upgrades);
            const isMax =
              item.id === 'repair' ? hud.hp >= hud.maxHp : cost === null;
            const affordable = cost !== null && hud.credits >= cost;
            const disabled = !canShop || isMax || !affordable;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onUpgrade(item.id)}
                disabled={disabled}
                className="w-full text-left p-3 rounded-lg border border-white/10 bg-slate-900/60 hover:bg-slate-800/80 hover:border-amber-500/40 disabled:opacity-55 disabled:hover:bg-slate-900/60 disabled:hover:border-white/10 disabled:cursor-not-allowed transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.icon}
                    <span className="text-sm font-medium text-slate-100 truncate">
                      {item.name}
                    </span>
                  </div>
                  <span className="font-mono-tabular text-xs font-semibold text-amber-400 whitespace-nowrap shrink-0">
                    {isMax
                      ? item.id === 'repair'
                        ? '완전 상태'
                        : '최대 단계'
                      : `${cost} C`}
                  </span>
                </div>

                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-400 truncate">
                    {item.subtitle}
                  </span>
                  <span className="font-mono-tabular text-[11px] text-slate-500 shrink-0">
                    [{item.hotkey}]
                  </span>
                </div>

                {item.id !== 'repair' && (
                  <div className="mt-2 flex gap-1">
                    {Array.from({ length: item.maxLevel }).map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-1 flex-1 rounded-xs ${
                          idx < item.level ? 'bg-amber-500' : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
