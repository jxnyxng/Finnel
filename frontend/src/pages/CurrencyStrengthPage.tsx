import React from 'react';
import { ChartHelpTooltip } from '../components/ChartElements';
import { MovingTabIndicator, useMovingTabIndicator } from '../components/MovingTabs';
import { koreanRegionNames, specialAreaDisplays } from '../constants';
import type { CurrencyStrengthRank } from '../types';
import { formatValue } from '../utils/format';

export function CurrencyStrengthPage({
  emptyMessage = '표시할 통화 랭킹 데이터가 없습니다.',
  isLoading = false,
  ranks
}: {
  emptyMessage?: string;
  isLoading?: boolean;
  ranks: CurrencyStrengthRank[];
}) {
  const [sortMode, setSortMode] = React.useState<'strong' | 'weak'>('strong');
  const sortModeKeys = React.useMemo(() => ['strong', 'weak'] as const, []);
  const {
    buttonRefs: sortModeButtonRefs,
    containerRef: sortModeContainerRef,
    indicator: sortModeIndicator,
    isMoving: isSortModeIndicatorMoving,
    labelActiveKey: activeSortModeLabelKey,
    startMoving: startSortModeIndicatorMoving
  } = useMovingTabIndicator({
    activeKey: sortMode,
    keys: sortModeKeys
  });
  const sortedRanks = React.useMemo(
    () => [...ranks].sort((a, b) => sortMode === 'strong' ? b.neerValue - a.neerValue : a.neerValue - b.neerValue),
    [ranks, sortMode]
  );
  const latestDate = sortedRanks[0]?.baseDate ?? null;
  const latestReerDate = sortedRanks.find((rank) => rank.reerBaseDate !== null)?.reerBaseDate ?? null;
  const neerValues = sortedRanks.map((rank) => rank.neerValue);
  const minNeer = neerValues.length > 0 ? Math.min(...neerValues) : 0;
  const maxNeer = neerValues.length > 0 ? Math.max(...neerValues) : 0;
  const benchmarkPosition = getScalePosition(100, minNeer, maxNeer);
  const rankingHelpContent = (
    <>
      <p className="mt-2">BIS broad NEER 기준입니다. NEER가 높을수록 교역상대국 대비 통화가 강하고, 낮을수록 약한 상태로 해석합니다.</p>
      <p className="mt-2">2020=100 기준선보다 낮으면 상대적 약세로 해석합니다. 순위와 점수 변동은 직전 NEER 기준일 대비이며, 앱은 금요일 USD/KRW 세션 종료 후 토요일 오전에 자동 확인합니다.</p>
      <p className="mt-2 font-medium text-zinc-700">매주 토요일 아침 갱신됩니다</p>
      <p className="mt-2 font-semibold text-zinc-800">NEER {latestDate ?? '-'} · REER {latestReerDate ?? '-'}</p>
      <p className="mt-2 text-zinc-700">NEER가 높을수록 교역상대국 대비 통화가 강한 상태입니다. 범위 {formatValue(minNeer, 2)} ~ {formatValue(maxNeer, 2)} · 기준선 100</p>
    </>
  );

  return (
    <section className="grid gap-4">
      <header className="page-tab-header">
        <div className="min-w-0">
          <h2 className="page-tab-title mt-0">화폐 랭킹</h2>
          <p className="page-tab-description">주요 통화의 상대 강도를 BIS broad NEER 기준으로 비교합니다.</p>
        </div>
      </header>
      {sortedRanks.length === 0 ? (
        <div className="glass-card grid min-h-32 place-items-center rounded-2xl text-sm text-white/45 shadow-sm">
          {isLoading ? '저장된 통화 랭킹 데이터를 불러오는 중입니다.' : emptyMessage}
        </div>
      ) : (
        <>
          <div className="pt-1.5">
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="min-w-0 text-xs font-medium text-zinc-500">
                    전체 {sortedRanks.length}개 지역 · {sortMode === 'strong' ? '강세 순 정렬' : '약세 순 정렬'}
                  </p>
                  <ChartHelpTooltip ariaLabel="화폐 랭킹 안내" title="화폐 랭킹 기준" widthClassName="w-80">
                    {rankingHelpContent}
                  </ChartHelpTooltip>
                </div>
                <div className="relative grid h-8 grid-cols-2 overflow-hidden rounded-full border border-zinc-200 bg-white p-0.5" ref={sortModeContainerRef}>
                  <MovingTabIndicator compact contained indicator={sortModeIndicator} isMoving={isSortModeIndicatorMoving} />
                  <button
                    className={`relative z-10 h-7 min-w-14 rounded-full px-3 text-[11px] font-semibold ${activeSortModeLabelKey === 'strong' ? 'moving-tab-active-label' : 'text-zinc-500 hover:text-zinc-950'}`}
                    onClick={() => {
                      if (sortMode !== 'strong') {
                        startSortModeIndicatorMoving();
                      }
                      setSortMode('strong');
                    }}
                    ref={(node) => {
                      sortModeButtonRefs.current.strong = node;
                    }}
                    type="button"
                  >
                    강세순
                  </button>
                  <button
                    className={`relative z-10 h-7 min-w-14 rounded-full px-3 text-[11px] font-semibold ${activeSortModeLabelKey === 'weak' ? 'moving-tab-active-label' : 'text-zinc-500 hover:text-zinc-950'}`}
                    onClick={() => {
                      if (sortMode !== 'weak') {
                        startSortModeIndicatorMoving();
                      }
                      setSortMode('weak');
                    }}
                    ref={(node) => {
                      sortModeButtonRefs.current.weak = node;
                    }}
                    type="button"
                  >
                    약세순
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-2">
            {sortedRanks.map((rank, index) => {
              const display = getAreaDisplay(rank.areaCode, rank.areaName);
              const valuePosition = getScalePosition(rank.neerValue, minNeer, maxNeer);
              const strengthScore = getStrengthScore(rank.neerValue, minNeer, maxNeer);
              const previousStrengthScore = rank.previousNeerValue === null ? null : getStrengthScore(rank.previousNeerValue, minNeer, maxNeer);
              const scoreChange = previousStrengthScore === null ? null : strengthScore - previousStrengthScore;
              const isWeak = rank.neerValue < 100;
              const isKorea = rank.areaCode === 'KR';
              const rankMovement = getRankMovement(rank, sortMode);
              return (
                <article
                  key={rank.areaCode}
                  className={`glass-list-card rounded-2xl px-3 py-2.5 shadow-sm sm:py-3 ${
                    isKorea ? 'ring-2 ring-teal-300/55' : ''
                  }`}
                >
                  <div className="grid grid-cols-[42px_38px_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[52px_44px_minmax(0,1fr)_auto] lg:grid-cols-[64px_56px_minmax(140px,180px)_minmax(0,1fr)_105px_120px] lg:gap-3">
                    <div className="grid grid-cols-[12px_minmax(0,1fr)] items-center gap-1.5">
                      <RankMovementIcon movement={rankMovement} />
                      <div className="grid h-10 w-full place-items-center rounded-xl border border-white/10 bg-white/8 px-1 text-center sm:h-11 lg:h-12 lg:rounded-2xl lg:px-2">
                        <p className={`text-sm font-semibold leading-none sm:text-base lg:text-lg ${isKorea ? 'text-teal-100' : 'text-white/75'}`}>{index + 1}</p>
                      </div>
                    </div>
                    <div className="grid h-10 place-items-center rounded-xl border border-white/10 bg-white/8 text-xl leading-none sm:h-11 sm:text-2xl lg:h-12 lg:rounded-2xl" aria-hidden="true">
                      {display.flag}
                    </div>
                    <div className="flex h-10 min-w-0 flex-col justify-center sm:h-11 lg:h-12">
                      <h3 className="truncate text-sm font-semibold leading-none text-white sm:text-base">{display.name}</h3>
                      <p className="mt-1 truncate text-xs text-white/55">{rank.areaCode} · BIS 원순위 {rank.neerRank}/{rank.totalCount}</p>
                    </div>

                    <div className="col-span-3 col-start-1 min-w-0 pr-1 lg:col-span-1 lg:col-start-auto lg:pr-0">
                      <div className="relative h-7">
                        <div className="absolute left-0 right-0 top-3 h-1.5 rounded-full bg-white/12" />
                        <div className="absolute left-0 top-3 h-1.5 rounded-full bg-rose-300/45" style={{ width: `${benchmarkPosition}%` }} />
                        <div
                          className="absolute right-0 top-3 h-1.5 rounded-r-full bg-teal-300/35"
                          style={{ left: `${benchmarkPosition}%` }}
                        />
                        <div className="absolute top-1 h-5 w-px bg-white/55" style={{ left: `${benchmarkPosition}%` }} />
                        <div
                          className={`absolute top-1 h-5 w-2 -translate-x-1/2 rounded-full ${isWeak ? 'bg-rose-600' : 'bg-teal-600'}`}
                          style={{ left: `${valuePosition}%` }}
                        />
                      </div>
                      <div className="relative mt-1 h-4 text-[11px] text-white/55">
                        <span className="absolute left-0 top-0">{formatValue(minNeer, 2)}</span>
                        <span className="absolute top-0 -translate-x-1/2" style={{ left: `${benchmarkPosition}%` }}>100</span>
                        <span className="absolute right-0 top-0">{formatValue(maxNeer, 2)}</span>
                      </div>
                    </div>

                    <div className="col-start-4 row-start-1 grid shrink-0 justify-items-end gap-0.5 text-right text-[11px] sm:text-xs lg:col-start-auto lg:row-start-auto lg:justify-items-center lg:text-center">
                      <p className={`font-semibold ${isWeak ? 'text-rose-200' : 'text-teal-100'}`}>
                        NEER {formatValue(rank.neerValue, 2)}
                      </p>
                      <p className="text-white/55">REER {rank.reerValue === null ? '-' : formatValue(rank.reerValue, 2)}</p>
                    </div>

                    <div className="col-start-4 row-start-2 flex h-full min-w-[4.5rem] items-center justify-end text-right lg:col-span-1 lg:col-start-auto lg:row-start-auto lg:flex-col lg:justify-center lg:border-l lg:py-1 lg:pl-4 lg:text-center">
                      <p className="hidden text-[11px] font-medium text-white/55 lg:block">100점 만점</p>
                      <div className="grid justify-items-end gap-1 lg:justify-items-center">
                        <p className="text-base font-semibold leading-none text-white lg:text-2xl">{strengthScore}점</p>
                        <ScoreChangeLabel value={scoreChange} />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function getScalePosition(value: number, minValue: number, maxValue: number) {
  if (maxValue <= minValue) {
    return 50;
  }

  return Math.min(100, Math.max(0, ((value - minValue) / (maxValue - minValue)) * 100));
}

function getStrengthScore(value: number, minValue: number, maxValue: number) {
  if (maxValue <= minValue) {
    return 100;
  }

  return Math.round(getScalePosition(value, minValue, maxValue));
}

type Movement = 'up' | 'down' | 'flat';

function getRankMovement(rank: CurrencyStrengthRank, sortMode: 'strong' | 'weak'): Movement {
  if (rank.previousNeerRank === null) {
    return 'flat';
  }

  const currentDisplayRank = toDisplayRank(rank.neerRank, rank.totalCount, sortMode);
  const previousDisplayRank = toDisplayRank(rank.previousNeerRank, rank.totalCount, sortMode);
  if (currentDisplayRank < previousDisplayRank) {
    return 'up';
  }
  if (currentDisplayRank > previousDisplayRank) {
    return 'down';
  }
  return 'flat';
}

function toDisplayRank(rank: number, totalCount: number, sortMode: 'strong' | 'weak') {
  return sortMode === 'strong' ? totalCount - rank + 1 : rank;
}

function RankMovementIcon({ movement }: { movement: Movement }) {
  const styles: Record<Movement, string> = {
    up: 'text-rose-300',
    down: 'text-sky-300',
    flat: 'text-zinc-300'
  };
  const symbols: Record<Movement, string> = {
    up: '▲',
    down: '▼',
    flat: '▬'
  };

  return (
    <span className={`grid h-3 w-3 place-items-center text-[11px] font-black leading-none ${styles[movement]}`} aria-label={`순위 ${movement}`}>
      {symbols[movement]}
    </span>
  );
}

function ScoreChangeLabel({ value }: { value: number | null }) {
  if (value === null || value === 0) {
    return <p className="h-3 text-[11px] font-semibold leading-none text-zinc-300">+0점</p>;
  }

  const isUp = value > 0;
  return (
    <p className={`h-3 text-[11px] font-semibold leading-none ${isUp ? 'text-rose-300' : 'text-sky-300'}`}>
      {isUp ? '+' : ''}{value}점
    </p>
  );
}

function getAreaDisplay(areaCode: string, fallbackName: string) {
  const specialDisplay = specialAreaDisplays[areaCode];
  if (specialDisplay) {
    return specialDisplay;
  }

  return {
    name: koreanRegionNames.of(areaCode) ?? fallbackName,
    flag: getFlagEmoji(areaCode)
  };
}

function getFlagEmoji(areaCode: string) {
  if (!/^[A-Z]{2}$/.test(areaCode)) {
    return '🏳️';
  }

  return areaCode
    .split('')
    .map((character) => String.fromCodePoint(127397 + character.charCodeAt(0)))
    .join('');
}
