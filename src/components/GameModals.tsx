import React from 'react';
import { X, Trash2 } from 'lucide-react';
import { DIFFICULTIES, type HighScoreRecord } from '../game/types';
import type { ModalKind } from './TopBar';

interface GameModalsProps {
  activeModal: ModalKind;
  onClose: () => void;
  records: HighScoreRecord[];
  onClearRecords: () => void;
}

export const GameModals: React.FC<GameModalsProps> = ({
  activeModal,
  onClose,
  records,
  onClearRecords,
}) => {
  if (!activeModal) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg bg-[#0F1929] border border-white/15 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="font-display text-lg font-bold text-slate-50">
            {activeModal === 'controls'
              ? '조작 안내'
              : activeModal === 'codex'
                ? '전투 도감'
                : '최고 기록'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto text-sm text-slate-300 space-y-5">
          {activeModal === 'controls' && (
            <>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <span className="text-slate-200 font-medium">기체 조종</span>
                  <span className="font-mono-tabular text-xs text-amber-400">
                    WASD / 방향키 / 마우스·터치
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <span className="text-slate-200 font-medium">주포 사격</span>
                  <span className="font-mono-tabular text-xs text-amber-400">
                    Space / 좌클릭 (자동 사격 지원)
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <span className="text-slate-200 font-medium">EMP 충격파 폭탄</span>
                  <span className="font-mono-tabular text-xs text-amber-400">
                    B / Shift / 마우스 우클릭
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/10">
                  <span className="text-slate-200 font-medium">실시간 업그레이드</span>
                  <span className="font-mono-tabular text-xs text-amber-400">
                    숫자 키 1 ~ 4 또는 좌측 패널
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-slate-200 font-medium">일시정지</span>
                  <span className="font-mono-tabular text-xs text-amber-400">
                    P / Esc
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                기체 중앙의 흰색 코어가 실제 피격 판정 지점입니다. 적 탄막 사이를 정밀하게 회피하며 연속 격추 배율(최대 x4.0)을 유지하세요.
              </p>
            </>
          )}

          {activeModal === 'codex' && (
            <div className="space-y-5">
              <div className="space-y-2.5">
                <h3 className="font-display text-sm font-semibold text-slate-100">
                  적 기체 유형
                </h3>
                <div className="divide-y divide-white/10 text-xs">
                  <div className="py-2.5 flex justify-between gap-4">
                    <span className="font-semibold text-slate-100 shrink-0">정찰 드론</span>
                    <span className="text-slate-400 text-right">빠른 하강 속도와 단발 조준 사격</span>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <span className="font-semibold text-slate-100 shrink-0">요격기</span>
                    <span className="text-slate-400 text-right">좌우 파동 기동 및 쌍발 확산탄 발사</span>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <span className="font-semibold text-slate-100 shrink-0">중폭격기</span>
                    <span className="text-slate-400 text-right">높은 장갑, 3방향 탄막, 보급품 높은 확률 드롭</span>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <span className="font-semibold text-slate-100 shrink-0">저격기</span>
                    <span className="text-slate-400 text-right">붉은 조준선 예고 후 초고속 탄환 발사</span>
                  </div>
                  <div className="py-2.5 flex justify-between gap-4">
                    <span className="font-semibold text-amber-400 shrink-0">섹터 보스</span>
                    <span className="text-slate-400 text-right">5웨이브마다 출현, 내구도 50% 이하 시 2단계 폭주</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 pt-2 border-t border-white/10">
                <h3 className="font-display text-sm font-semibold text-slate-100">
                  전장 보급 아이템
                </h3>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-white/10">
                    <span className="font-mono-tabular font-bold text-amber-400">P · 무기 강화</span>
                    <p className="mt-1 text-slate-400">주포 레벨 즉시 +1</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-white/10">
                    <span className="font-mono-tabular font-bold text-emerald-400">H · 선체 수리</span>
                    <p className="mt-1 text-slate-400">내구도 +25 회복</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-white/10">
                    <span className="font-mono-tabular font-bold text-sky-400">S · 에너지 보호막</span>
                    <p className="mt-1 text-slate-400">피격 1회 무효화</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900/70 border border-white/10">
                    <span className="font-mono-tabular font-bold text-orange-400">B · EMP 폭탄</span>
                    <p className="mt-1 text-slate-400">화면 적 탄환 전체 소거</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeModal === 'records' && (
            <div className="space-y-4">
              {records.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">
                  아직 완료된 출격 기록이 없습니다. 첫 전투를 시작해 보세요.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400">
                          <th className="py-2 font-medium">순위</th>
                          <th className="py-2 font-medium">점수</th>
                          <th className="py-2 font-medium">웨이브</th>
                          <th className="py-2 font-medium">격추</th>
                          <th className="py-2 font-medium">난이도</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {records.map((rec, index) => (
                          <tr key={rec.id}>
                            <td className="py-2.5 font-mono-tabular text-slate-400">
                              {index + 1}
                            </td>
                            <td className="py-2.5 font-mono-tabular font-bold text-amber-400">
                              {rec.score.toLocaleString()}
                            </td>
                            <td className="py-2.5 font-mono-tabular text-slate-200">
                              W{rec.wave}
                            </td>
                            <td className="py-2.5 font-mono-tabular text-slate-200">
                              {rec.kills}기
                            </td>
                            <td className="py-2.5 text-slate-300">
                              {DIFFICULTIES[rec.difficulty].label}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={onClearRecords}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>기록 초기화</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-md transition-colors cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
