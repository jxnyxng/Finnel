import React from 'react';
import { FadeIn } from '../components/FadeIn';

const serviceIntroHero = '/assets/service-intro-hero.png';

const slides = [
    {
        eyebrow: 'FINNEL DATA BOARD',
        title: '경제·금융 데이터를 한 화면에서 읽으세요.',
        body: ['환율, 달러 지수, 경제지표, 화폐랭킹, 뉴스를 연결해 보여줍니다.', '흩어진 데이터를 Finnel 안에서 순서대로 확인할 수 있습니다.'],
        action: ['환율 탭에서 오늘의 USD/KRW 흐름을 먼저 확인해보세요.'],
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
        action: ['경제지표에서 외환 방어력과 자본 흐름을 점검해보세요.'],
        placement: 'items-start text-left',
        imagePosition: 'center center'
    },
    {
        eyebrow: 'CHECK RELATIVE WEAKNESS',
        title: '원화가 유독 약한지도 확인하세요.',
        body: ['BIS broad NEER 화폐랭킹은 원화의 상대 위치를 보여줍니다.', 'USD/KRW 하나만 볼 때 놓치는 신호를 보완합니다.'],
        action: ['화폐랭킹에서 원화의 상대 위치를 확인해보세요.'],
        placement: 'items-end text-right',
        imagePosition: 'right center'
    }
];

export function ServiceGuidePage() {
    return (
        <section className="service-guide-page relative left-1/2 -my-3 w-screen -translate-x-1/2 overflow-hidden">
            {slides.map((slide, index) => (
                <section
                    className="service-guide-slide relative overflow-hidden bg-zinc-50"
                    key={slide.title}
                >
                    <div
                        className="absolute inset-0 scale-105 bg-cover opacity-20 blur-[2px] saturate-75"
                        style={{
                            backgroundImage: `url(${serviceIntroHero})`,
                            backgroundPosition: slide.imagePosition
                        }}
                    />
                    <div className="absolute inset-0 bg-white/78" />
                    <div className={`absolute inset-0 ${index % 2 === 0 ? 'bg-gradient-to-r' : 'bg-gradient-to-l'} from-white via-white/86 to-transparent`} />

                    <div className="relative z-10 flex h-full items-center justify-center px-6 py-10 md:px-14 md:py-12">
                        <div className={`flex w-full max-w-[88vw] flex-col md:max-w-[60vw] ${slide.placement}`}>

                            {/* 1. 상단 말머리 (Eyebrow): 0.1초 등장 */}
                            <FadeIn delay={0.1}>
                                <p className="text-sm font-semibold text-teal-700">{slide.eyebrow}</p>
                            </FadeIn>

                            {/* 2. 메인 타이틀: 0.2초 등장 */}
                            <FadeIn delay={0.2}>
                                <h2 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-normal text-zinc-950 md:text-5xl">
                                    {slide.title}
                                </h2>
                            </FadeIn>

                            {/* 3. 본문 문장들: 0.3초 등장 */}
                            <FadeIn delay={0.3}>
                                <div className="mt-6 grid max-w-3xl gap-1 text-base leading-7 text-zinc-600 md:text-lg md:leading-8">
                                    {slide.body.map((sentence) => (
                                        <p key={sentence}>{sentence}</p>
                                    ))}
                                </div>
                            </FadeIn>

                            {/* 4. 액션 가이드 문장: 0.4초 등장 */}
                            <FadeIn delay={0.4}>
                                <div className="mt-8 grid max-w-3xl gap-1 text-sm font-semibold leading-6 text-teal-700 md:text-base">
                                    {slide.action.map((sentence) => (
                                        <p key={sentence}>{sentence}</p>
                                    ))}
                                </div>
                            </FadeIn>

                        </div>
                    </div>
                </section>
            ))}
        </section>
    );
}
