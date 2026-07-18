# KRW Watcher

원화 소득으로 미국 주식에 투자하는 사용자를 위한 원화 가치 및 매크로 리스크 대시보드입니다.

## Stack

- Frontend: React, Vite, TypeScript, Recharts, Tailwind CSS
- Backend: Spring Boot 3.x, Java 17
- Database: MySQL, Flyway
- Infra: Docker Compose for local development

## Data Sources

| Area | Source |
| --- | --- |
| USD/KRW daily | 한국수출입은행, FRED `DEXKOUS` fallback |
| USD/KRW intraday | Twelve Data `USD/KRW` 5min |
| Dollar indexes | FRED `DTWEXAFEGS`, `DTWEXBGS` |
| Effective exchange rates | BIS `WS_EER` broad NEER/REER |
| Rates and macro | ECOS, FRED |
| Fiscal policy | OpenFiscal `BudgetBalance`, `GovernmentDebtMonth` |
| Capital flow and credit risk | ECOS `901Y055`, ECOS `282Y006`, FRED `BAMLH0A0HYM2`, BOK MPC page |
| News | Naver News Search API |

## Environment

Secrets belong in `.env`, environment variables, or GitHub Secrets only.

Required or active keys:

- `KOREAEXIM_API_KEY`
- `ECOS_API_KEY`
- `FRED_API_KEY`
- `TWELVE_DATA_API_KEY`
- `OPENFISCAL_API_KEY`
- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`

Useful non-secret defaults:

- `OPENFISCAL_BASE_URL=https://www.openfiscaldata.go.kr`
- `BOK_PORTAL_BASE_URL=https://www.bok.or.kr`
- `FRED_CREDIT_SPREAD_PROXY_SERIES_ID=BAMLH0A0HYM2`

## Commands

```bash
docker compose -f docker/docker-compose.yml up -d

cd backend
./gradlew bootRun

cd frontend
npm install
npm run dev
```

Verification:

```bash
cd backend && ./gradlew test
cd frontend && npm run build
```

## Work Memory

- Backend loads both `.env` and `backend/.env`.
- External APIs are called by scheduler/manual sync jobs, not directly from frontend page loads.
- Dashboard APIs read latest stored MySQL data.
- API keys must never be committed or printed.
- USD/KRW 1-day chart must use real Twelve Data intraday rows only. Do not fabricate flat projected rows.
- On weekends/non-business days, show the latest displayable weekday intraday session. Avoid stale flat weekend sessions.
- Business-day logic excludes weekends and Korean public holidays from KASI `SpcdeInfoService`.
- USD/KRW has no single official exchange-style holiday calendar because it is primarily OTC. Use Korean public holidays first, then add US bank/Fed holidays, and keep data-availability fallback as the final guard.
- OpenFiscal works through `https://www.openfiscaldata.go.kr/openApi/preview/{serviceName}` with `OPENFISCAL_API_KEY`.
- OpenFiscal values used here are monthly fiscal balance and central-government debt in trillion KRW.
- KRX server-side calls returned `LOGOUT`; use ECOS-backed official alternatives until a stable KRX path is proven.
- Foreign stock flow is ECOS `901Y055` foreign net buying amount, converted from KRW million to KRW 100M.
- Foreign bond card is ECOS `282Y006` foreign-held bond balance, not net investment flow.
- No free official Korea CDS API is confirmed. Use FRED `BAMLH0A0HYM2` only as a clearly labeled global credit-spread proxy.
- BOK MPC card currently confirms official minutes page availability; it is not document sentiment analysis.
- BIS rank is an undervaluation rank sorted by low broad NEER first. Rank 1 means the currency is weaker by this metric.
- Public frontend should not expose manual sync buttons; show automatic refresh/status instead.

## Next

- Add `US_FED` holidays to the FX calendar and keep actual data-availability fallback as the final guard.
- Improve MPC document parsing/sentiment only after a stable official feed is confirmed.
- Keep README and CODEX concise; move long PR notes or investigations out of permanent docs.
