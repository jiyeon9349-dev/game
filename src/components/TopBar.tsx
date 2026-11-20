import React from 'react';
import type { GameState } from '../game/types';

export type ModalKind = 'controls' | 'codex' | 'records' | null;

interface TopBarProps {
  gameState: GameState;
  onOpenModal: (modal: ModalKind) => void;
  onPrimaryAction: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  gameState,
  onOpenModal,
  onPrimaryAction,
}) => {
  const primaryLabel =
    gameState === 'PLAYING'
      ? '일시정지'
      : gameState === 'PAUSED'
        ? '계속하기'
        : gameState === 'GAME_OVER'
          ? '다시 시작'
          : gameState === 'ROUND_SUMMARY'
            ? '다음 웨이브'
            : '게임 시작';

  return (
    <header className="h-14 shrink-0 border-b border-white/10 bg-[#0D1726]/95 px-4 lg:px-8 flex items-center justify-between gap-8">
      {/* Zone 1: Single-element Brand Wordmark */}
      <span className="font-display text-lg font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0">
        Apex Strike
      </span>

      {/* Zone 2: Concise single-line navigation links */}
      <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-300">
        <button
          type="button"
          onClick={() => onOpenModal('controls')}
          className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm py-1"
        >
          조작 안내
        </button>
        <button
          type="button"
          onClick={() => onOpenModal('codex')}
          className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm py-1"
        >
          전투 도감
        </button>
        <button
          type="button"
          onClick={() => onOpenModal('records')}
          className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm py-1"
        >
          최고 기록
        </button>
      </nav>

      {/* Zone 3: Single primary action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onPrimaryAction}
          className="px-4 py-2 text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 active:translate-y-px transition-all rounded-md whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          {primaryLabel}
        </button>
      </div>
    </header>
  );
};
