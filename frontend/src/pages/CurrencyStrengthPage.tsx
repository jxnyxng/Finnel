import { koreanRegionNames, specialAreaDisplays } from '../constants';
import type { CurrencyStrengthRank } from '../types';
import { formatValue } from '../utils/format';

export function CurrencyStrengthPage({ ranks }: { ranks: CurrencyStrengthRank[] }) {
  const latestDate = ranks[0]?.baseDate ?? null;
  const latestReerDate = ranks.find((rank) => rank.reerBaseDate !== null)?.reerBaseDate ?? null;
  const neerValues = ranks.map((rank) => rank.neerValue);
  const minNeer = neerValues.length > 0 ? Math.min(...neerValues) : 0;
  const maxNeer = neerValues.length > 0 ? Math.max(...neerValues) : 0;
  const benchmarkPosition = getScalePosition(100, minNeer, maxNeer);

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-1 border-b border-zinc-100 pb-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-base font-semibold">자국 화폐가치 약세 순위</h2>
          <p className="mt-1 text-xs text-zinc-500">BIS broad NEER 약세 순위 · 2020=100, 낮을수록 교역상대국 대비 약세입니다.</p>
          <p className="mt-1 text-xs text-zinc-500">BIS 발표: NEER 주중, REER 월중 · 앱 자동 확인: 평일 09:10/15:10 KST</p>
        </div>
        <p className="text-xs font-medium text-zinc-500">
          NEER {latestDate ?? '-'} · REER {latestReerDate ?? '-'}
        </p>
      </div>
      {ranks.length === 0 ? (
        <div className="grid min-h-32 place-items-center text-sm text-zinc-400">
          표시할 통화 랭킹 데이터가 없습니다.
        </div>
      ) : (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
            <p>전체 {ranks.length}개 지역 · 1위에 가까울수록 NEER가 낮아 통화가치 약세</p>
            <p>범위 {formatValue(minNeer, 2)} ~ {formatValue(maxNeer, 2)} · 기준선 100</p>
          </div>
          <div className="max-h-[68vh] overflow-y-auto pr-1">
            <div className="flex flex-col gap-2">
              {ranks.map((rank) => {
                const display = getAreaDisplay(rank.areaCode, rank.areaName);
                const valuePosition = getScalePosition(rank.neerValue, minNeer, maxNeer);
                const isWeak = rank.neerValue < 100;
                const isKorea = rank.areaCode === 'KR';
                return (
                  <article
                    key={rank.areaCode}
                    className={`rounded-md border px-3 py-3 ${
                      isKorea ? 'border-teal-200 bg-white shadow-sm' : 'border-zinc-100 bg-zinc-50'
                    }`}
                  >
                    <div className="grid gap-3 md:grid-cols-[minmax(180px,240px)_minmax(0,1fr)_150px] md:items-center">
                      <div className="flex min-w-0 items-center gap-3">
                        <p className="w-10 shrink-0 text-right text-sm font-semibold text-zinc-500">#{rank.neerRank}</p>
                        <span className="shrink-0 text-2xl leading-none" aria-hidden="true">{display.flag}</span>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-zinc-950">{display.name}</h3>
                          <p className="truncate text-xs text-zinc-500">{rank.areaCode} · {rank.neerRank}/{rank.totalCount}</p>
                        </div>
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
                      <div className="grid grid-cols-2 gap-2 text-right text-xs md:grid-cols-1">
                        <p className={`font-semibold ${isWeak ? 'text-rose-700' : 'text-teal-700'}`}>
                          NEER {formatValue(rank.neerValue, 2)}
                        </p>
                        <p className="text-zinc-500">REER {rank.reerValue === null ? '-' : formatValue(rank.reerValue, 2)}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
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
