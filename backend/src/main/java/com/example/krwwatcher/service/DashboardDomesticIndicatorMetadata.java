// Provides static dashboard copy and metadata for domestic indicators.
package com.example.krwwatcher.service;

class DashboardDomesticIndicatorMetadata {

    DomesticIndicatorMetadata baseMetadata(String code) {
        return switch (code) {
            case "USD_KRW" -> new DomesticIndicatorMetadata("원/달러 환율", "KRW");
            case "KR_POLICY_RATE" -> new DomesticIndicatorMetadata("한국 기준금리", "PERCENT");
            case "US_POLICY_RATE" -> new DomesticIndicatorMetadata("미국 기준금리", "PERCENT");
            case "KR_US_RATE_GAP" -> new DomesticIndicatorMetadata("한미 기준금리차", "PERCENT_POINT");
            case "FOREIGN_RESERVES" -> new DomesticIndicatorMetadata("외환보유액", "USD_MILLION");
            case "KR_NEER_RANK" -> new DomesticIndicatorMetadata("원화 명목실효환율 저평가 순위", "RANK");
            default -> null;
        };
    }

    DomesticIndicatorMetadata pendingMetadata(String code) {
        return switch (code) {
            case "US_TREASURY_1MO" -> new DomesticIndicatorMetadata("미국채 1개월", "PERCENT");
            case "US_TREASURY_3MO" -> new DomesticIndicatorMetadata("미국채 3개월", "PERCENT");
            case "US_TREASURY_6MO" -> new DomesticIndicatorMetadata("미국채 6개월", "PERCENT");
            case "US_TREASURY_1Y" -> new DomesticIndicatorMetadata("미국채 1년", "PERCENT");
            case "US_TREASURY_2Y" -> new DomesticIndicatorMetadata("미국채 2년", "PERCENT");
            case "US_TREASURY_3Y" -> new DomesticIndicatorMetadata("미국채 3년", "PERCENT");
            case "US_TREASURY_5Y" -> new DomesticIndicatorMetadata("미국채 5년", "PERCENT");
            case "US_TREASURY_7Y" -> new DomesticIndicatorMetadata("미국채 7년", "PERCENT");
            case "US_TREASURY_20Y" -> new DomesticIndicatorMetadata("미국채 20년", "PERCENT");
            case "US_TREASURY_30Y" -> new DomesticIndicatorMetadata("미국채 30년", "PERCENT");
            case "SOFR" -> new DomesticIndicatorMetadata("SOFR", "PERCENT");
            case "SOFR_30D_AVG" -> new DomesticIndicatorMetadata("SOFR 30일 평균", "PERCENT");
            case "SOFR_90D_AVG" -> new DomesticIndicatorMetadata("SOFR 90일 평균", "PERCENT");
            case "SOFR_180D_AVG" -> new DomesticIndicatorMetadata("SOFR 180일 평균", "PERCENT");
            case "SOFR_INDEX" -> new DomesticIndicatorMetadata("SOFR 지수", "INDEX");
            case "KOFR" -> new DomesticIndicatorMetadata("KOFR", "PERCENT");
            case "CD_91D" -> new DomesticIndicatorMetadata("CD(91일)", "PERCENT");
            case "GLOBAL_CREDIT_SPREAD_PROXY", "KOREA_CDS" -> new DomesticIndicatorMetadata("글로벌 신용스프레드 프록시", "PERCENT");
            case "FISCAL_BALANCE" -> new DomesticIndicatorMetadata("재정수지", "KRW_TRILLION");
            case "GOVERNMENT_DEBT" -> new DomesticIndicatorMetadata("중앙정부 국가채무", "KRW_TRILLION");
            default -> throw new IllegalArgumentException("Unsupported domestic indicator code: " + code);
        };
    }

    String impact(String code) {
        return switch (code) {
            case "US_TREASURY_1MO", "US_TREASURY_3MO", "US_TREASURY_6MO", "US_TREASURY_1Y", "US_TREASURY_2Y",
                "US_TREASURY_3Y", "US_TREASURY_5Y", "US_TREASURY_7Y", "US_TREASURY_20Y", "US_TREASURY_30Y" -> "미국채 금리 상승은 달러 자산의 상대 매력을 높이고, 곡선의 기울기 변화는 경기·정책금리 기대를 통해 환율에 영향을 줄 수 있습니다.";
            case "SOFR", "SOFR_30D_AVG", "SOFR_90D_AVG", "SOFR_180D_AVG" -> "SOFR 상승은 달러 단기 조달금리 부담을 키워 글로벌 달러 유동성 여건이 빡빡해지는 신호로 볼 수 있습니다.";
            case "SOFR_INDEX" -> "SOFR 지수는 SOFR 누적 성과를 보여주는 보조 지표로, 단기 달러 유동성의 누적 비용 흐름을 확인할 때 사용합니다.";
            case "KOFR" -> "KOFR 상승은 원화 단기자금시장의 조달 부담이 커지는 신호로, 달러-원 스왑과 원화 유동성 해석에 함께 봅니다.";
            case "CD_91D" -> "CD 91일 금리 상승은 은행권 단기 조달비용과 원화 시장금리 압력이 커지는 신호로 볼 수 있습니다.";
            case "M2" -> "통화량 증가가 빠르면 원화 공급 확대와 인플레이션 기대를 통해 원화 약세 압력이 커질 수 있습니다.";
            case "CURRENT_ACCOUNT" -> "경상수지 흑자는 달러 유입 기반을 강화해 원화 안정 요인으로 해석됩니다.";
            case "GOODS_ACCOUNT" -> "상품수지 흑자는 무역을 통한 달러 유입을 늘려 원화에 우호적입니다.";
            case "CPI" -> "소비자물가 상승은 기준금리 인상 압력을 키울 수 있지만, 실질 구매력 악화와 함께 봐야 합니다.";
            case "PPI" -> "생산자물가 상승은 수입물가와 기업 비용 부담을 통해 물가와 환율 압력으로 이어질 수 있습니다.";
            case "EXPORT_AMOUNT" -> "수출 증가는 달러 공급을 늘려 원화 안정에 도움이 될 수 있습니다.";
            case "IMPORT_AMOUNT" -> "수입 증가는 달러 수요를 늘려 원화 약세 압력으로 작용할 수 있습니다.";
            case "TRADE_BALANCE" -> "무역수지 흑자는 달러 순유입, 적자는 달러 순유출 압력으로 봅니다.";
            case "RESERVES_TO_SHORT_TERM_DEBT" -> "단기외채 대비 외환보유액 비율이 높을수록 단기 대외지급 압력에 대응할 완충 여력이 크다고 봅니다.";
            case "SHORT_TERM_EXTERNAL_DEBT" -> "단기대외채무 증가는 가까운 시점의 외화 상환 부담을 키우는 요인으로 봅니다.";
            case "FISCAL_BALANCE" -> "재정수지 악화는 정부 재정 건전성 우려와 국채 수급 부담을 통해 원화 신뢰도에 부담이 될 수 있습니다.";
            case "GOVERNMENT_DEBT" -> "중앙정부 국가채무 증가는 재정 여력과 국가 신용위험 평가에 영향을 줄 수 있어 중장기 환율 리스크와 함께 봅니다.";
            case "FOREIGN_STOCK_FLOW" -> "외국인 주식 순매수는 원화 자산 수요와 환전 흐름을 통해 원화에 영향을 줄 수 있습니다.";
            case "FOREIGN_BOND_FLOW" -> "외국인 채권 보유잔액 증가는 중장기 원화채 수요를 보여주지만, 환헤지 비용과 금리차를 함께 봐야 합니다.";
            case "TERMS_OF_TRADE" -> "교역조건 악화는 같은 수출량으로 확보하는 구매력이 낮아지는 신호라 원화 펀더멘털에 부담이 될 수 있습니다.";
            case "US_10Y_TREASURY" -> "미국 장기금리 상승은 달러 자산 매력을 높여 원화에는 부담이 될 수 있습니다.";
            case "VIX" -> "VIX 상승은 위험회피 심리 확대로 이어져 신흥국·원화 자산에는 부담이 될 수 있습니다.";
            case "WTI_OIL" -> "유가 상승은 에너지 수입 부담을 키워 무역수지와 원화 수급에 부정적일 수 있습니다.";
            case "GLOBAL_CREDIT_SPREAD_PROXY", "KOREA_CDS" -> "무료 공식 한국 CDS API가 없어 FRED 미국 하이일드 신용스프레드를 대외 신용위험 프록시로 사용합니다.";
            default -> "환율에 영향을 줄 수 있는 국내 정책·거시경제 지표입니다.";
        };
    }

    String note(String code) {
        return switch (code) {
            case "US_TREASURY_1MO" -> "FRED DGS1MO, 미국 1개월 만기 국채 수익률입니다.";
            case "US_TREASURY_3MO" -> "FRED DGS3MO, 미국 3개월 만기 국채 수익률입니다.";
            case "US_TREASURY_6MO" -> "FRED DGS6MO, 미국 6개월 만기 국채 수익률입니다.";
            case "US_TREASURY_1Y" -> "FRED DGS1, 미국 1년 만기 국채 수익률입니다.";
            case "US_TREASURY_2Y" -> "FRED DGS2, 미국 2년 만기 국채 수익률입니다.";
            case "US_TREASURY_3Y" -> "FRED DGS3, 미국 3년 만기 국채 수익률입니다.";
            case "US_TREASURY_5Y" -> "FRED DGS5, 미국 5년 만기 국채 수익률입니다.";
            case "US_TREASURY_7Y" -> "FRED DGS7, 미국 7년 만기 국채 수익률입니다.";
            case "US_TREASURY_20Y" -> "FRED DGS20, 미국 20년 만기 국채 수익률입니다.";
            case "US_TREASURY_30Y" -> "FRED DGS30, 미국 30년 만기 국채 수익률입니다.";
            case "SOFR" -> "FRED SOFR, Secured Overnight Financing Rate입니다.";
            case "SOFR_30D_AVG" -> "FRED SOFR30DAYAVG, SOFR 30일 평균입니다.";
            case "SOFR_90D_AVG" -> "FRED SOFR90DAYAVG, SOFR 90일 평균입니다.";
            case "SOFR_180D_AVG" -> "FRED SOFR180DAYAVG, SOFR 180일 평균입니다.";
            case "SOFR_INDEX" -> "FRED SOFRINDEX, SOFR 지수입니다.";
            case "KOFR" -> "ECOS 817Y002/010901000, KOFR(공시RFR) 일별 값입니다.";
            case "CD_91D" -> "ECOS 817Y002/010502000, CD(91일) 일별 금리입니다.";
            case "M2" -> "ECOS 161Y005, M2 평잔 계절조정계열입니다. 단일 최신값보다 1Y/3Y/5Y 추세 확인에 적합합니다.";
            case "CURRENT_ACCOUNT" -> "ECOS 301Y017, 경상수지 계절조정 월별 값입니다.";
            case "GOODS_ACCOUNT" -> "ECOS 301Y017, 상품수지 계절조정 월별 값입니다.";
            case "CPI" -> "ECOS 901Y009, 소비자물가지수 총지수입니다.";
            case "PPI" -> "ECOS 404Y014, 생산자물가지수 총지수입니다.";
            case "EXPORT_AMOUNT" -> "ECOS 901Y118, 수출금액입니다.";
            case "IMPORT_AMOUNT" -> "ECOS 901Y118, 수입금액입니다.";
            case "TRADE_BALANCE" -> "ECOS 901Y118 수출금액에서 수입금액을 뺀 계산값입니다.";
            case "RESERVES_TO_SHORT_TERM_DEBT" -> "ECOS 732Y001 외환보유액을 311Y004 단기대외채무로 나눠 계산한 분기 비율입니다.";
            case "SHORT_TERM_EXTERNAL_DEBT" -> "ECOS 311Y004, 대외채무 중 단기 항목 분기값입니다.";
            case "FISCAL_BALANCE" -> "열린재정 BudgetBalance, 월별 관리재정수지 조원 단위 저장값입니다.";
            case "GOVERNMENT_DEBT" -> "열린재정 GovernmentDebtMonth, 월별 중앙정부 국가채무 총액 조원 단위 저장값입니다.";
            case "FOREIGN_STOCK_FLOW" -> "ECOS 901Y055, 외국인 순매수 거래대금 월별 값이며 백만원을 억원으로 환산했습니다.";
            case "FOREIGN_BOND_FLOW" -> "ECOS 282Y006, 채권발행-보유관계표의 발행총계 중 국외 보유잔액 분기값이며 십억원을 조원으로 환산했습니다.";
            case "TERMS_OF_TRADE" -> "ECOS 403Y005, 순상품교역조건지수 월별 값입니다.";
            case "US_10Y_TREASURY" -> "FRED DGS10, 미국 10년 만기 국채 수익률입니다.";
            case "VIX" -> "FRED VIXCLS, CBOE VIX 종가 계열입니다.";
            case "WTI_OIL" -> "FRED DCOILWTICO, WTI 현물 유가 계열입니다.";
            case "GLOBAL_CREDIT_SPREAD_PROXY", "KOREA_CDS" -> "FRED BAMLH0A0HYM2, ICE BofA 미국 하이일드 옵션조정스프레드입니다. 한국 CDS가 아니라 글로벌 신용위험 프록시입니다.";
            default -> "ECOS 저장값 기준입니다.";
        };
    }
}
