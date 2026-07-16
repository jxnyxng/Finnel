import React from 'react';
import { koreanRegionNames, specialAreaDisplays } from '../constants';
import type { CurrencyStrengthRank } from '../types';
import { formatValue } from '../utils/format';

export function CurrencyStrengthPage({ ranks, statusNode }: { ranks: CurrencyStrengthRank[]; statusNode?: React.ReactNode }) {
  const weaknessRanks = React.useMemo(
    () => [...ranks].sort((a, b) => a.neerValue - b.neerValue),
    [ranks]
  );
  const latestDate = weaknessRanks[0]?.baseDate ?? null;
  const latestReerDate = weaknessRanks.find((rank) => rank.reerBaseDate !== null)?.reerBaseDate ?? null;
  const neerValues = weaknessRanks.map((rank) => rank.neerValue);
  const minNeer = neerValues.length > 0 ? Math.min(...neerValues) : 0;
  const maxNeer = neerValues.length > 0 ? Math.max(...neerValues) : 0;
  const benchmarkPosition = getScalePosition(100, minNeer, maxNeer);

  return (
    <section className="grid gap-4">
      <header className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">화폐 랭킹</h2>
            <p className="mt-1 text-xs text-zinc-500">BIS broad NEER 기준입니다. <span className="font-semibold text-rose-700">NEER가 낮아 교역상대국 대비 약한 통화부터</span> 보여줍니다.</p>
            <p className="mt-1 text-xs text-zinc-500">2020=100 기준선보다 낮으면 상대적 약세로 해석합니다. BIS 발표: NEER 주중, REER 월중 · 앱 자동 확인: 평일 09:10/15:10 KST</p>
          </div>
          <div className="flex min-w-0 flex-col items-start gap-1.5 md:flex-row md:items-center md:justify-between">
            <p className="text-xs font-medium text-zinc-500">
              NEER {latestDate ?? '-'} · REER {latestReerDate ?? '-'}
            </p>
            {statusNode}
          </div>
        </div>
      </header>
      {weaknessRanks.length === 0 ? (
        <div className="grid min-h-32 place-items-center rounded-xl border border-zinc-200 bg-white text-sm text-zinc-400 shadow-sm">
          표시할 통화 랭킹 데이터가 없습니다.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-500 shadow-sm">
            <p>전체 {weaknessRanks.length}개 지역 · <span className="font-semibold text-rose-700">약세 순 정렬</span></p>
            <p>범위 {formatValue(minNeer, 2)} ~ {formatValue(maxNeer, 2)} · 기준선 100</p>
          </div>
          <div className="grid gap-2">
            {weaknessRanks.map((rank, index) => {
              const display = getAreaDisplay(rank.areaCode, rank.areaName);
              const valuePosition = getScalePosition(rank.neerValue, minNeer, maxNeer);
              const strengthScore = getStrengthScore(rank.neerValue, minNeer, maxNeer);
              const isWeak = rank.neerValue < 100;
              const isKorea = rank.areaCode === 'KR';
              return (
                <article
                  key={rank.areaCode}
                  className={`rounded-xl border px-3 py-3 shadow-sm ${
                    isKorea ? 'border-2 border-teal-600 bg-white' : 'border-zinc-100 bg-white'
                  }`}
                >
                  <div className="grid gap-3 md:grid-cols-[56px_56px_minmax(140px,180px)_minmax(0,1fr)_105px_120px] md:items-center">
                    <div className="grid h-12 place-items-center rounded-xl border border-zinc-100 bg-zinc-50 px-2 text-center">
                      <p className={`text-lg font-semibold leading-none ${isKorea ? 'text-teal-700' : 'text-zinc-700'}`}>{index + 1}</p>
                    </div>
                    <div className="grid h-12 place-items-center rounded-xl border border-zinc-100 bg-white text-2xl leading-none" aria-hidden="true">
                      {display.flag}
                    </div>
                    <div className="flex h-12 min-w-0 flex-col justify-center">
                      <h3 className="truncate text-base font-semibold leading-none text-zinc-950">{display.name}</h3>
                      <p className="mt-1 truncate text-xs text-zinc-500">{rank.areaCode} · BIS 원순위 {rank.neerRank}/{rank.totalCount}</p>
                    </div>

                    <div>
                      <div className="relative h-7">
                        <div className="absolute left-0 right-0 top-3 h-1.5 rounded-full bg-zinc-200" />
                        <div className="absolute left-0 top-3 h-1.5 rounded-full bg-rose-200" style={{ width: `${benchmarkPosition}%` }} />
                        <div className="absolute top-1 h-5 w-px bg-zinc-500" style={{ left: `${benchmarkPosition}%` }} />
                        <div
                          className={`absolute top-1 h-5 w-2 -translate-x-1/2 rounded-full ${isWeak ? 'bg-rose-600' : 'bg-teal-600'}`}
                          style={{ left: `${valuePosition}%` }}
                        />
                      </div>
                      <div className="relative mt-1 h-4 text-[11px] text-zinc-500">
                        <span className="absolute left-0 top-0">{formatValue(minNeer, 2)}</span>
                        <span className="absolute top-0 -translate-x-1/2" style={{ left: `${benchmarkPosition}%` }}>100</span>
                        <span className="absolute right-0 top-0">{formatValue(maxNeer, 2)}</span>
                      </div>
                    </div>

                    <div className="grid justify-items-center gap-0.5 text-center text-xs">
                      <p className={`font-semibold ${isWeak ? 'text-rose-700' : 'text-teal-700'}`}>
                        NEER {formatValue(rank.neerValue, 2)}
                      </p>
                      <p className="text-zinc-500">REER {rank.reerValue === null ? '-' : formatValue(rank.reerValue, 2)}</p>
                    </div>

                    <div className="flex h-full flex-col justify-center border-t border-zinc-100 pt-2 text-center md:border-l md:border-t-0 md:py-1 md:pl-4">
                      <p className="text-[11px] font-medium text-zinc-500">100점 만점</p>
                      <p className="text-2xl font-semibold leading-none text-zinc-950">{strengthScore}점</p>
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
