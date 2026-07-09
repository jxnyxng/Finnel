const serviceIntroHero = '/assets/service-intro-hero.png';

const slides = [
  {
    eyebrow: 'KOREA WON MONITOR',
    title: '원화 움직임을 한 화면에서 읽으세요.',
    body: ['환율, 달러 지수, 관련 지표, 화폐 랭킹, 뉴스를 연결해 보여줍니다.', '원화가 왜 움직이는지 순서대로 확인할 수 있습니다.'],
    action: ['환율 현황에서 오늘의 USD/KRW 흐름을 먼저 확인해보세요.'],
    placement: 'items-start text-left',
    imagePosition: 'center center'
  },
  {
    eyebrow: 'COMPARE THE DOLLAR',
    title: '달러가 강한 건지, 원화가 약한 건지 구분하세요.',
    body: ['USD/KRW만 보면 원인을 알기 어렵습니다.', '달러 지수를 함께 보면 글로벌 달러 강세와 원화 고유 약세를 나눠 볼 수 있습니다.'],
    action: ['달러 지수와 원/달러 환율이 같은 방향인지 비교해보세요.'],
    placement: 'items-end text-right',
    imagePosition: 'right center'
  },
  {
    eyebrow: 'READ THE CONTEXT',
    title: '환율 뒤에 있는 지표를 함께 보세요.',
    body: ['금리, 물가, 외환보유액, 무역수지, 자본 흐름을 함께 확인합니다.', '이 지표들은 원화의 체력을 판단하는 단서가 됩니다.'],
    action: ['관련 지표에서 외환 방어력과 자본 흐름을 점검해보세요.'],
    placement: 'items-start text-left',
    imagePosition: 'center center'
  },
  {
    eyebrow: 'CHECK RELATIVE WEAKNESS',
    title: '원화가 유독 약한지도 확인하세요.',
    body: ['BIS broad NEER 화폐 랭킹은 원화의 상대 위치를 보여줍니다.', 'USD/KRW 하나만 볼 때 놓치는 신호를 보완합니다.'],
    action: ['화폐 랭킹에서 원화의 상대 위치를 확인해보세요.'],
    placement: 'items-end text-right',
    imagePosition: 'right center'
  }
];

export function ServiceGuidePage() {
  return (
    <section className="relative left-1/2 -my-4 w-screen -translate-x-1/2">
      {slides.map((slide, index) => (
        <section
          className="relative min-h-[calc(100vh-2.75rem)] overflow-hidden bg-zinc-950"
          key={slide.title}
        >
          <div
            className="absolute inset-0 scale-105 bg-cover blur-[2px]"
            style={{
              backgroundImage: `url(${serviceIntroHero})`,
              backgroundPosition: slide.imagePosition
            }}
          />
          <div className="absolute inset-0 bg-zinc-950/45" />
          <div className={`absolute inset-0 ${index % 2 === 0 ? 'bg-gradient-to-r' : 'bg-gradient-to-l'} from-zinc-950/95 via-zinc-950/50 to-transparent`} />
          <div className="relative z-10 flex min-h-[calc(100vh-2.75rem)] items-center justify-center px-6 py-16 md:px-14 md:py-20">
            <div className={`flex w-full max-w-[88vw] flex-col md:max-w-[60vw] ${slide.placement}`}>
              <p className="text-sm font-semibold text-teal-200 drop-shadow">{slide.eyebrow}</p>
              <h2 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-normal text-white drop-shadow-2xl md:text-5xl">
                {slide.title}
              </h2>
              <div className="mt-6 grid max-w-3xl gap-1 text-base leading-7 text-zinc-100 drop-shadow md:text-lg md:leading-8">
                {slide.body.map((sentence) => (
                  <p key={sentence}>{sentence}</p>
                ))}
              </div>
              <div className="mt-8 grid max-w-3xl gap-1 text-sm font-semibold leading-6 text-teal-100 drop-shadow md:text-base">
                {slide.action.map((sentence) => (
                  <p key={sentence}>{sentence}</p>
                ))}
              </div>
            </div>
          </div>
        </section>
      ))}
    </section>
  );
}
