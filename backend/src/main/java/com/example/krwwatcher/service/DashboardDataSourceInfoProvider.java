// Provides dashboard data-source descriptions in API response order.
package com.example.krwwatcher.service;

import java.util.List;

class DashboardDataSourceInfoProvider {

    List<DashboardService.DataSourceInfo> dataSourceInfos() {
        return List.of(
            new DashboardService.DataSourceInfo(
                "USD_KRW",
                "USD/KRW 추이",
                "Twelve Data time_series USD/KRW 1min, 한국수출입은행 현재환율 API, FRED DEXKOUS fallback",
                "1일 차트는 주중 24시간 intraday 세션을 별도로 수집하고, 전체 수집은 평일 09:10/15:10에 실행합니다.",
                "Twelve Data는 API 제한 보호를 위해 1일 1분봉에만 사용하고, 긴 기간은 Koreaexim/FRED 일별 저장값을 사용합니다."
            ),
            new DashboardService.DataSourceInfo(
                "ADVANCED_DOLLAR_INDEX",
                "주요 7개 통화권 달러인덱스",
                "FRED DTWEXAFEGS",
                "전체 시장 데이터 수집 시 FRED daily observations 저장",
                "유로지역, 캐나다, 일본, 영국, 스위스, 호주, 스웨덴 통화권 대비 달러 강도를 보는 FRED 공식 무역가중 지표입니다. 공식 ICE DXY와는 다른 지표입니다."
            ),
            new DashboardService.DataSourceInfo(
                "BROAD_DOLLAR_INDEX",
                "26개 교역 상대 달러인덱스",
                "FRED DTWEXBGS",
                "전체 시장 데이터 수집 시 FRED daily observations 저장",
                "한국, 중국, 멕시코, 캐나다, 유로지역 등 26개 교역 상대 통화 대비 달러 강도를 보는 FRED 공식 무역가중 지표입니다."
            ),
            new DashboardService.DataSourceInfo(
                "CURRENCY_STRENGTH",
                "실효환율 통화가치 랭킹",
                "BIS WS_EER effective exchange rates bulk CSV",
                "평일 09:10/15:10 KST 전체 시장 데이터 수집 시 broad NEER/REER 최신 발표값 저장",
                "NEER/REER는 2020=100 지수이며 낮을수록 교역상대국 대비 통화가치가 낮습니다. 랭킹은 낮은 NEER부터 매긴 저평가 순위입니다."
            ),
            new DashboardService.DataSourceInfo(
                "FOREIGN_EXCHANGE",
                "주요 통화 원화 환율",
                "Twelve Data exchange_rate, 한국수출입은행 현재환율 API AP01, FRED 주요 통화 환율 시리즈 fallback",
                "15분마다 최대 4개 통화만 확인하며, 각 통화는 약 1시간 주기로 순차 갱신합니다.",
                "Twelve Data 현재환율을 우선 사용하고 실패하면 한국수출입은행/FRED 일별 값으로 보강합니다. JPY는 100엔당 기준을 함께 표시합니다."
            ),
            new DashboardService.DataSourceInfo(
                "MACRO",
                "금리·외환 여건",
                "FRED FEDFUNDS/DGS10/VIXCLS/DCOILWTICO, ECOS 722Y001/732Y001",
                "전체 시장 데이터 수집 시 발표된 최신값 저장",
                "한국 기준금리와 외환보유액은 한국은행 ECOS, 미국 기준금리·장기금리·VIX·WTI 유가는 FRED를 사용합니다."
            ),
            new DashboardService.DataSourceInfo(
                "FISCAL_POLICY",
                "재정 정책",
                "열린재정 Open API BudgetBalance/GovernmentDebtMonth",
                "전체 시장 데이터 수집 시 최근 3년 월별 재정수지와 중앙정부 국가채무 저장",
                "재정수지는 관리재정수지, 국가채무는 중앙정부 국가채무 총액을 조원 단위로 저장합니다."
            ),
            new DashboardService.DataSourceInfo(
                "CAPITAL_FLOW",
                "자본 흐름·신용위험",
                "ECOS 901Y055/282Y006, FRED BAMLH0A0HYM2",
                "전체 시장 데이터 수집 시 발표된 최신 월별·분기별·일별 값을 저장",
                "외국인 주식은 순매수 거래대금, 채권은 국외 보유잔액입니다. 한국 CDS는 무료 공식 API가 없어 글로벌 신용스프레드 프록시로 표시합니다."
            )
        );
    }
}
