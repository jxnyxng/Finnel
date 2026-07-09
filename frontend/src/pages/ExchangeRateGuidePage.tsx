import React from 'react';

const conceptCards = [
  {
    title: '환율은 돈의 교환 가격입니다',
    body: 'USD/KRW 1,300은 1달러를 사기 위해 원화 1,300원이 필요하다는 뜻입니다. 상품 가격이 원으로 표시되듯, 외국 돈의 가격도 원화로 표시할 수 있습니다.'
  },
  {
    title: '원/달러 환율은 원화 기준 달러 가격입니다',
    body: '우리 서비스의 USD/KRW 차트는 달러 1단위를 원화로 얼마에 교환하는지 보여줍니다. 숫자가 커질수록 달러가 비싸지고 원화는 약해진 것으로 봅니다.'
  },
  {
    title: '환율은 매일 움직입니다',
    body: '금리, 물가, 무역수지, 투자자 심리, 지정학 리스크, 달러 자체 강세 등 여러 요인이 동시에 반영되기 때문에 환율은 고정된 값이 아닙니다.'
  }
];

const directionCards = [
  {
    title: '환율 상승',
    label: '원화 약세',
    value: '1달러 = 1,300원에서 1,350원',
    body: '같은 1달러를 사는 데 더 많은 원화가 필요합니다. 원화 가치가 달러 대비 낮아진 상태로 이해하면 됩니다.',
    points: ['해외여행·해외직구 부담 증가', '수입 원자재와 에너지 비용 상승 가능', '달러 매출이 있는 수출기업에는 환산 이익이 될 수 있음']
  },
  {
    title: '환율 하락',
    label: '원화 강세',
    value: '1달러 = 1,350원에서 1,300원',
    body: '같은 1달러를 사는 데 필요한 원화가 줄어듭니다. 원화 가치가 달러 대비 높아진 상태로 이해하면 됩니다.',
    points: ['해외여행·해외직구 부담 감소', '수입 물가와 원자재 비용 부담 완화 가능', '수출기업의 가격 경쟁력에는 부담이 될 수 있음']
  }
];

const importanceCards = [
  {
    title: '내 지갑에 영향을 줍니다',
    body: '여행 경비, 유학비, 해외 결제, 직구 가격은 환율에 따라 원화 부담이 달라집니다.'
  },
  {
    title: '물가와 기업 비용에 영향을 줍니다',
    body: '한국은 에너지와 원자재 수입 비중이 높아 원화 약세가 길어지면 수입물가 부담이 커질 수 있습니다.'
  },
  {
    title: '수출입 기업의 실적에 영향을 줍니다',
    body: '수출기업은 달러 매출을 원화로 바꿀 때 환율 영향을 받고, 수입기업은 외화 결제 비용에 영향을 받습니다.'
  },
  {
    title: '투자 심리를 보여줍니다',
    body: '위험회피가 커지면 달러 수요가 늘어 원화가 약해질 수 있습니다. 그래서 환율은 시장 불안의 신호로도 활용됩니다.'
  }
];

const wonRiskCards = [
  {
    title: '수입물가가 먼저 흔들립니다',
    body: '원화 가치가 떨어지면 같은 달러 가격의 원유, 가스, 원자재, 식료품을 사는 데 더 많은 원화가 필요합니다. 이 비용은 시간이 지나며 전기요금, 운송비, 제품 가격에 반영될 수 있습니다.'
  },
  {
    title: '물가와 금리 부담이 커질 수 있습니다',
    body: '환율 상승이 물가를 밀어 올리면 중앙은행은 금리를 빨리 낮추기 어렵습니다. 가계와 기업은 물가 부담과 이자 부담을 동시에 느낄 수 있습니다.'
  },
  {
    title: '외화 조달 부담이 늘어납니다',
    body: '달러로 빌린 돈이나 수입 결제가 많은 기업은 원화 약세 때 상환 부담이 커집니다. 금융시장이 불안하면 달러를 구하기 위한 비용도 올라갈 수 있습니다.'
  },
  {
    title: '국가 신뢰도 신호로 해석될 수 있습니다',
    body: '원화만 유독 약하면 투자자들이 한국의 성장, 무역수지, 정책 여력, 지정학 리스크를 더 걱정하고 있다는 신호일 수 있습니다.'
  }
];

const divergenceRows = [
  {
    condition: '달러 강세 + 원화 약세',
    reading: '글로벌 달러 선호가 커진 국면일 수 있습니다.',
    caution: '다른 통화도 함께 약한지 비교해야 합니다.'
  },
  {
    condition: '달러 약세 + 원화 강세',
    reading: '위험 선호가 회복되거나 원화 자산 선호가 좋아진 국면일 수 있습니다.',
    caution: '추세가 일시적인지 관련 지표로 확인합니다.'
  },
  {
    condition: '달러 약세 + 원화 약세',
    reading: '달러가 전반적으로 약한데도 원화가 약하다는 뜻입니다.',
    caution: '한국 고유 리스크, 외국인 자금 유출, 무역수지 악화, 성장 둔화 우려를 경계해야 합니다.'
  }
];

const rateRows = [
  {
    label: '매매기준율',
    meaning: '은행이 외환을 사고팔 때 기준으로 삼는 대표 환율',
    point: '뉴스, 차트, 대시보드에서 보는 환율은 보통 이 기준 환율에 가깝습니다.'
  },
  {
    label: '송금 보낼 때',
    meaning: '원화를 외화로 바꿔 해외로 보낼 때 적용되는 환율',
    point: '보통 매매기준율보다 높습니다. 사용자는 같은 달러를 사기 위해 더 많은 원화를 냅니다.'
  },
  {
    label: '송금 받을 때',
    meaning: '외화를 원화로 바꿔 받을 때 적용되는 환율',
    point: '보통 매매기준율보다 낮습니다. 외화를 원화로 바꿀 때 은행 스프레드가 반영됩니다.'
  },
  {
    label: '스프레드',
    meaning: '살 때와 팔 때 가격 차이',
    point: '은행 수수료와 마진이 포함된 실질 비용입니다. 환전 전에는 기준율뿐 아니라 실제 적용 환율을 확인해야 합니다.'
  }
];

const currencyCards = [
  { code: 'USD', name: '미국 달러', body: '세계 무역과 금융시장에서 가장 널리 쓰이는 통화입니다. 위기 때 달러 수요가 커지는 경우가 많습니다.' },
  { code: 'EUR', name: '유로', body: '유로지역의 공동 통화입니다. 유럽 경기, 에너지 가격, ECB 금리 정책의 영향을 받습니다.' },
  { code: 'JPY', name: '일본 엔', body: '일본 금리와 글로벌 위험회피 심리에 민감합니다. 원화와 함께 아시아 통화 흐름을 볼 때 참고합니다.' },
  { code: 'CNY', name: '중국 위안', body: '중국 경기와 무역 흐름을 반영합니다. 한국 수출 경기와 연결해 보는 경우가 많습니다.' }
];

const accordionItems = [
  {
    title: '환율이 오르면 무조건 나쁜가요?',
    body: '항상 나쁘다고 볼 수는 없습니다. 소비자 입장에서는 해외 결제와 수입물가 부담이 커질 수 있지만, 달러 매출이 있는 수출기업에는 원화 환산 매출이 늘어나는 효과가 있을 수 있습니다. 그래서 환율은 누구의 관점에서 보는지가 중요합니다.'
  },
  {
    title: '원화 약세와 달러 강세는 같은 말인가요?',
    body: 'USD/KRW만 보면 비슷하게 보일 수 있지만 완전히 같은 말은 아닙니다. 달러가 전 세계 통화 대비 강해져도 USD/KRW가 오를 수 있고, 달러는 안정적인데 원화만 약해져도 오를 수 있습니다. 그래서 달러 지수와 원화 관련 지표를 함께 봅니다.'
  },
  {
    title: '환율은 왜 금리와 함께 움직이나요?',
    body: '금리가 높은 통화는 예금·채권 수익률 매력이 커질 수 있습니다. 다만 성장 둔화, 신용위험, 정책 기대도 함께 작용하므로 금리 하나만으로 환율을 설명하기는 어렵습니다.'
  },
  {
    title: '실제 환전 금액이 차트 환율과 다른 이유는 무엇인가요?',
    body: '차트는 기준 환율에 가깝고, 실제 환전·송금에는 은행별 스프레드와 수수료가 붙습니다. 그래서 송금 보낼 때, 받을 때, 현찰 살 때, 현찰 팔 때 환율이 서로 다르게 표시됩니다.'
  }
];

export function ExchangeRateGuidePage() {
  const [openIndex, setOpenIndex] = React.useState(0);

  return (
    <section className="grid gap-4">
      <header className="overflow-hidden rounded-md border border-zinc-200 bg-white shadow-sm">
        <div className="grid gap-0 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="flex min-h-64 flex-col justify-between bg-teal-700 p-5 text-white">
            <div>
              <p className="text-xs font-semibold text-teal-100">EXCHANGE BASICS</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-normal">환율이란</h2>
              <p className="mt-3 text-sm leading-6 text-teal-50">
                환율은 외국 돈의 가격입니다. 숫자 하나가 여행 경비, 수입물가, 기업 실적, 투자 심리까지 연결됩니다.
              </p>
            </div>
            <div className="mt-6 rounded-md bg-white/15 p-3">
              <p className="text-xs font-semibold text-teal-100">예시</p>
              <p className="mt-1 text-lg font-semibold">USD/KRW 1,300</p>
              <p className="mt-1 text-xs leading-5 text-teal-50">1달러를 사는 데 1,300원이 필요하다는 뜻</p>
            </div>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-3">
            {conceptCards.map((card) => (
              <article className="rounded-md border border-zinc-100 bg-zinc-50 p-4" key={card.title}>
                <h3 className="text-sm font-semibold text-zinc-950">{card.title}</h3>
                <p className="mt-3 text-xs leading-5 text-zinc-600">{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        {directionCards.map((card) => (
          <article className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm" key={card.title}>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 pb-3">
              <div>
                <p className="text-xs font-semibold text-teal-700">{card.label}</p>
                <h3 className="mt-1 text-base font-semibold text-zinc-950">{card.title}</h3>
              </div>
              <span className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700">{card.value}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-700">{card.body}</p>
            <ul className="mt-3 grid gap-2 text-xs leading-5 text-zinc-500">
              {card.points.map((point) => (
                <li className="flex gap-2" key={point}>
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-teal-600" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="border-b border-zinc-100 pb-3">
          <h3 className="text-sm font-semibold text-zinc-950">왜 환율이 중요한가요?</h3>
          <p className="mt-1 text-xs text-zinc-500">환율은 개인 소비, 기업 비용, 물가, 금융시장 심리를 동시에 연결합니다.</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {importanceCards.map((card, index) => (
            <article className="rounded-md border border-zinc-100 bg-zinc-50 p-3" key={card.title}>
              <span className="grid h-7 w-7 place-items-center rounded bg-teal-700 text-xs font-semibold text-white">{index + 1}</span>
              <h4 className="mt-3 text-sm font-semibold text-zinc-950">{card.title}</h4>
              <p className="mt-2 text-xs leading-5 text-zinc-500">{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="border-b border-zinc-100 pb-3">
          <h3 className="text-sm font-semibold text-zinc-950">원화가치 하락을 왜 경계해야 하나요?</h3>
          <p className="mt-1 text-xs text-zinc-500">환율 상승이 길어지면 단순히 달러가 비싸지는 문제를 넘어 경제 전반의 비용이 올라갈 수 있습니다.</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {wonRiskCards.map((card) => (
            <article className="rounded-md border border-rose-100 bg-rose-50/50 p-4" key={card.title}>
              <h4 className="text-sm font-semibold text-rose-950">{card.title}</h4>
              <p className="mt-2 text-xs leading-5 text-rose-900/80">{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="border-b border-zinc-100 pb-3">
          <h3 className="text-sm font-semibold text-zinc-950">달러도 약한데 원화도 약하면 더 조심해야 합니다</h3>
          <p className="mt-1 text-xs text-zinc-500">USD/KRW만 보지 말고 달러 지수와 함께 보면 원화 약세의 성격을 구분할 수 있습니다.</p>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-0 text-left">
            <thead>
              <tr className="text-[11px] font-semibold text-zinc-400">
                <th className="w-[26%] border-b border-zinc-100 px-2 py-2">상황</th>
                <th className="w-[34%] border-b border-zinc-100 px-2 py-2">해석</th>
                <th className="w-[40%] border-b border-zinc-100 px-2 py-2">확인할 점</th>
              </tr>
            </thead>
            <tbody>
              {divergenceRows.map((row) => (
                <tr key={row.condition}>
                  <td className="border-b border-zinc-100 px-2 py-3 text-xs font-semibold text-zinc-900">{row.condition}</td>
                  <td className="border-b border-zinc-100 px-2 py-3 text-xs leading-5 text-zinc-700">{row.reading}</td>
                  <td className="border-b border-zinc-100 px-2 py-3 text-xs leading-5 text-zinc-500">{row.caution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 rounded-md border border-amber-100 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-950">핵심</p>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            달러 지수가 내려가는데 USD/KRW가 오른다면, 원화가 글로벌 달러 흐름보다 더 약하다는 뜻일 수 있습니다. 이때는 외국인 주식·채권 자금 흐름, 경상수지, 외환보유액, 금리차, 대외 리스크 지표를 함께 확인해야 합니다.
          </p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <article className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="border-b border-zinc-100 pb-3">
            <h3 className="text-sm font-semibold text-zinc-950">매매기준율과 실제 환전 환율</h3>
            <p className="mt-1 text-xs text-zinc-500">차트 환율과 실제 환전 금액이 다른 이유를 이해하는 핵심입니다.</p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] table-fixed border-separate border-spacing-0 text-left">
              <thead>
                <tr className="text-[11px] font-semibold text-zinc-400">
                  <th className="w-[22%] border-b border-zinc-100 px-2 py-2">구분</th>
                  <th className="w-[34%] border-b border-zinc-100 px-2 py-2">뜻</th>
                  <th className="w-[44%] border-b border-zinc-100 px-2 py-2">읽는 법</th>
                </tr>
              </thead>
              <tbody>
                {rateRows.map((row) => (
                  <tr key={row.label}>
                    <td className="border-b border-zinc-100 px-2 py-3 text-xs font-semibold text-zinc-900">{row.label}</td>
                    <td className="border-b border-zinc-100 px-2 py-3 text-xs leading-5 text-zinc-700">{row.meaning}</td>
                    <td className="border-b border-zinc-100 px-2 py-3 text-xs leading-5 text-zinc-500">{row.point}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="border-b border-zinc-100 pb-3">
            <h3 className="text-sm font-semibold text-zinc-950">자주 보는 주요 통화</h3>
            <p className="mt-1 text-xs text-zinc-500">원화 흐름을 이해할 때 함께 보면 좋은 통화입니다.</p>
          </div>
          <div className="mt-4 grid gap-2">
            {currencyCards.map((currency) => (
              <div className="rounded-md border border-zinc-100 bg-zinc-50 p-3" key={currency.code}>
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-12 shrink-0 place-items-center rounded bg-white text-xs font-semibold text-teal-700 shadow-sm">{currency.code}</span>
                  <div>
                    <p className="text-xs font-semibold text-zinc-900">{currency.name}</p>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">{currency.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="rounded-md border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="border-b border-zinc-100 pb-3">
          <h3 className="text-sm font-semibold text-zinc-950">헷갈리기 쉬운 질문</h3>
          <p className="mt-1 text-xs text-zinc-500">환율을 처음 볼 때 자주 생기는 오해를 정리했습니다.</p>
        </div>
        <div className="mt-3 divide-y divide-zinc-100">
          {accordionItems.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={item.title}>
                <button
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left"
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  type="button"
                >
                  <span className="text-sm font-semibold text-zinc-900">{item.title}</span>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded border border-zinc-200 text-xs font-semibold text-zinc-500">
                    {isOpen ? '-' : '+'}
                  </span>
                </button>
                {isOpen ? <p className="pb-4 text-sm leading-6 text-zinc-600">{item.body}</p> : null}
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}
