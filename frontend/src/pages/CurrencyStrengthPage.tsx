import React from 'react';
import { koreanRegionNames, specialAreaDisplays } from '../constants';
import type { CurrencyStrengthRank } from '../types';
import { formatValue } from '../utils/format';

export function CurrencyStrengthPage({
  emptyMessage = '표시할 통화 랭킹 데이터가 없습니다.',
  isLoading = false,
  ranks,
  statusNode
}: {
  emptyMessage?: string;
  isLoading?: boolean;
  ranks: CurrencyStrengthRank[];
  statusNode?: React.ReactNode;
}) {
  const [sortMode, setSortMode] = React.useState<'strong' | 'weak'>('strong');
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

  return (
    <section className="grid gap-4">
      <header className="glass-card rounded-2xl p-4 shadow-sm">
        <div className="grid gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white">화폐 랭킹</h2>
            <p className="mt-1 text-xs text-white/60">BIS broad NEER 기준입니다. NEER가 높을수록 교역상대국 대비 통화가 강하고, 낮을수록 약한 상태로 해석합니다.</p>
            <p className="mt-1 text-xs text-white/60">2020=100 기준선보다 낮으면 상대적 약세로 해석합니다. BIS 발표: NEER 주중, REER 월중 · 앱 자동 확인: 평일 09:10/15:10 KST</p>
          </div>
          <div className="flex min-w-0 flex-col items-start gap-1.5 md:flex-row md:items-center md:justify-between">
            <p className="text-xs font-medium text-white/55">
              NEER {latestDate ?? '-'} · REER {latestReerDate ?? '-'}
            </p>
            {statusNode}
          </div>
        </div>
      </header>
      {sortedRanks.length === 0 ? (
        <div className="glass-card grid min-h-32 place-items-center rounded-2xl text-sm text-white/45 shadow-sm">
          {isLoading ? '저장된 통화 랭킹 데이터를 불러오는 중입니다.' : emptyMessage}
        </div>
      ) : (
        <>
          <div className="glass-card flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 text-xs text-white/60 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <p>전체 {sortedRanks.length}개 지역 · <span className={`font-semibold ${sortMode === 'strong' ? 'text-teal-100' : 'text-rose-200'}`}>{sortMode === 'strong' ? '강세 순 정렬' : '약세 순 정렬'}</span></p>
              <div className="relative grid h-8 grid-cols-2 rounded-full border border-white/15 bg-white/10 p-0.5">
                <span
                  className="pointer-events-none absolute bottom-0.5 top-0.5 rounded-full bg-teal-600 transition-transform duration-200 ease-out"
                  style={{
                    left: '2px',
                    transform: sortMode === 'weak' ? 'translateX(100%)' : 'translateX(0)',
                    width: 'calc(50% - 2px)'
                  }}
                />
                <button
                  className={`relative z-10 h-7 min-w-14 rounded-full px-3 text-[11px] font-semibold ${sortMode === 'strong' ? 'text-white' : 'text-white/60 hover:text-white'}`}
                  onClick={() => setSortMode('strong')}
                  type="button"
                >
                  강세순
                </button>
                <button
                  className={`relative z-10 h-7 min-w-14 rounded-full px-3 text-[11px] font-semibold ${sortMode === 'weak' ? 'text-white' : 'text-white/60 hover:text-white'}`}
                  onClick={() => setSortMode('weak')}
                  type="button"
                >
                  약세순
                </button>
              </div>
            </div>
            <p>범위 {formatValue(minNeer, 2)} ~ {formatValue(maxNeer, 2)} · 기준선 100</p>
          </div>
          <div className="grid gap-2">
            {sortedRanks.map((rank, index) => {
              const display = getAreaDisplay(rank.areaCode, rank.areaName);
              const valuePosition = getScalePosition(rank.neerValue, minNeer, maxNeer);
              const strengthScore = getStrengthScore(rank.neerValue, minNeer, maxNeer);
              const isWeak = rank.neerValue < 100;
              const isKorea = rank.areaCode === 'KR';
              return (
                <article
                  key={rank.areaCode}
                  className={`glass-list-card rounded-2xl px-3 py-3 shadow-sm ${
                    isKorea ? 'ring-2 ring-teal-300/55' : ''
                  }`}
                >
                  <div className="grid grid-cols-[34px_38px_minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[44px_44px_minmax(0,1fr)_auto] md:grid-cols-[56px_56px_minmax(140px,180px)_minmax(0,1fr)_105px_120px] md:gap-3">
                    <div className="grid h-10 place-items-center rounded-xl border border-white/10 bg-white/8 px-1 text-center sm:h-11 md:h-12 md:rounded-2xl md:px-2">
                      <p className={`text-sm font-semibold leading-none sm:text-base md:text-lg ${isKorea ? 'text-teal-100' : 'text-white/75'}`}>{index + 1}</p>
                    </div>
                    <div className="grid h-10 place-items-center rounded-xl border border-white/10 bg-white/8 text-xl leading-none sm:h-11 sm:text-2xl md:h-12 md:rounded-2xl" aria-hidden="true">
                      {display.flag}
                    </div>
                    <div className="flex h-10 min-w-0 flex-col justify-center sm:h-11 md:h-12">
                      <h3 className="truncate text-sm font-semibold leading-none text-white sm:text-base">{display.name}</h3>
                      <p className="mt-1 truncate text-xs text-white/55">{rank.areaCode} · BIS 원순위 {rank.neerRank}/{rank.totalCount}</p>
                    </div>

                    <div className="col-span-4 min-w-0 md:col-span-1">
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

                    <div className="col-start-4 row-start-1 grid shrink-0 justify-items-end gap-0.5 text-right text-[11px] sm:text-xs md:col-start-auto md:row-start-auto md:justify-items-center md:text-center">
                      <p className={`font-semibold ${isWeak ? 'text-rose-200' : 'text-teal-100'}`}>
                        NEER {formatValue(rank.neerValue, 2)}
                      </p>
                      <p className="text-white/55">REER {rank.reerValue === null ? '-' : formatValue(rank.reerValue, 2)}</p>
                    </div>

                    <div className="col-span-4 flex h-full items-center justify-between border-t border-white/10 pt-2 text-center md:col-span-1 md:flex-col md:justify-center md:border-l md:border-t-0 md:py-1 md:pl-4">
                      <p className="text-[11px] font-medium text-white/55">100점 만점</p>
                      <p className="text-lg font-semibold leading-none text-white md:text-2xl">{strengthScore}점</p>
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
