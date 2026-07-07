# KRW Watcher

원화 소득으로 미국 주식에 투자하는 개인 투자자를 위한 원화 가치 및 매크로 리스크 대시보드입니다.

## Goal

복잡한 환율, 금리, 외환보유액 데이터를 한곳에 모아 "지금 원화 가치가 안전한가, 위험한가"를 직관적으로 확인할 수 있게 합니다.

## MVP Scope

- USD/KRW 환율 추이
- USD/KRW 기간 선택: 1일, 3개월, 1년, 5년
- 선진국 달러 지수 추이: 3개월, 1년, 5년
- 광의 달러 지수 추이: 3개월, 1년, 5년
- BIS broad NEER/REER 기반 실효환율 통화가치 랭킹
- 한국/미국 기준금리와 금리차
- 대한민국 외환보유액
- Spring Boot REST API
- React 단일 페이지 대시보드
- Mock/seed 데이터 기반 초기 개발
- 이후 ECOS/FRED 등 실제 API 연동

## Later Scope

- 외국인 KOSPI/KOSDAQ 수급
- 가계부채 및 GDP 대비 비율
- 부동산 PF 대출 잔액 및 연체율
- 관리자용 수동 데이터 업로드
- AWS EC2 + Docker + GitHub Actions 배포 자동화

## Tech Stack

- Frontend: React, Vite, TypeScript, Recharts, Tailwind CSS
- Backend: Spring Boot 3.x, Java 17
- Database: MySQL
- Infra: Docker Compose for local development, AWS EC2 for deployment
- CI/CD: GitHub Actions

## Data Sources

| Metric | Source | API/Series | Update Policy |
| --- | --- | --- | --- |
| USD/KRW | 한국수출입은행 오픈API, FRED fallback | 현재환율 API USD `deal_bas_r`, FRED `DEXKOUS` | 1일 1회 배치 저장 |
| USD/KRW intraday | Twelve Data | `time_series`, `USD/KRW`, `5min` | 1일 차트용, 제한 내 배치 저장 |
| 선진국 달러 지수 | FRED | `DTWEXAFEGS` Nominal Advanced Foreign Economies U.S. Dollar Index | 1일 1회 배치 저장 |
| 광의 달러 지수 | FRED | `DTWEXBGS` Nominal Broad U.S. Dollar Index | 1일 1회 배치 저장 |
| 실효환율 통화가치 랭킹 | BIS | `WS_EER` effective exchange rates, broad NEER/REER | 전체 시장 데이터 수집 시 최신 발표값 저장 |
| 미국 기준금리 | FRED | `FEDFUNDS` 또는 정책금리 target range series | 1일 1회 체크, 변경분 저장 |
| 미국 금융여건·리스크 | FRED | 10년 국채금리 `DGS10`, VIX `VIXCLS`, WTI `DCOILWTICO`, 신용스프레드 프록시 `BAMLH0A0HYM2` | 전체 시장 데이터 수집 시 최신 발표값 저장 |
| 한국 기준금리 | 한국은행 ECOS | `722Y001` item `0101000` | 1일 1회 체크, 변경분 저장 |
| 외환보유액 | 한국은행 ECOS | `732Y001` item `99` | 월 1회 이상 체크, 변경분 저장 |
| 국내 정책·거시 지표 | 한국은행 ECOS | M2 `161Y005`, 경상/상품수지 `301Y017`, CPI `901Y009`, PPI `404Y014`, 수출입 `901Y118`, 순상품교역조건 `403Y005` | 전체 시장 데이터 수집 시 최신 발표값 저장 |
| 재정 정책 | 열린재정 Open API | `BudgetBalance` 재정수지, `GovernmentDebtMonth` 월별 중앙정부 국가채무 | `OPENFISCAL_API_KEY` 설정 후 전체 시장 데이터 수집 시 최근 3년 월별 저장 |
| 자본 흐름·신용위험 | 한국은행 ECOS, FRED, 한국은행 홈페이지 | 외국인 주식 순매수 `901Y055`, 국외 채권 보유잔액 `282Y006`, 신용스프레드 프록시 `BAMLH0A0HYM2`, 금통위 의사록 공식 목록 | 전체 시장 데이터 수집 시 최신 발표값 저장 |
| 환율·금리 뉴스 | 네이버 뉴스 검색 API | `원달러 환율`, `외환시장`, `한국은행 기준금리`, `미국 연준 FOMC`, `외환당국 환율` | `NEWS_SYNC_CRON` 스케줄 저장 |

`DTWEXBGS`는 ICE가 산출하는 전통적인 DXY와 동일한 지표가 아닙니다. MVP에서는 FRED에서 안정적으로 받을 수 있는 광의 무역가중 달러 지수로 달러 강세를 대체 측정합니다.

선진국 달러 지수는 FRED `DTWEXAFEGS` 공식 시리즈를 사용합니다. 주요 선진국 교역 상대 통화 대비 달러 강도를 보는 무역가중 지표이며, 공식 ICE DXY와는 다른 지표입니다.

BIS 실효환율 통화가치 랭킹은 broad NEER를 기본 기준으로 사용합니다. NEER/REER는 2020=100 지수이며, 낮을수록 교역상대국 대비 통화가치가 낮다는 뜻입니다. 화면의 순위는 낮은 NEER부터 매긴 저평가 순위라 1위에 가까울수록 통화가치가 낮은 편입니다. NEER는 명목 지표이고, REER는 물가 수준을 반영한 실질 지표입니다.

한국수출입은행 API가 응답하지 않으면 FRED `DEXKOUS`를 fallback으로 사용합니다. `DEXKOUS`는 FRED의 “South Korean Won to U.S. Dollar Spot Exchange Rate” 일별 시리즈지만 업데이트 지연이 있을 수 있습니다. Twelve Data는 API 제한 보호를 위해 USD/KRW 1일 intraday 차트에만 사용합니다.

## API Key Policy

- API Key는 `.env`, 환경변수, GitHub Secrets로만 관리합니다.
- API Key를 Git에 커밋하지 않습니다.
- 유저가 대시보드에 접속할 때 외부 API를 직접 호출하지 않습니다.
- Spring Scheduler가 정해진 주기로 외부 API를 호출하고 MySQL에 upsert합니다.
- 화면/API 요청은 MySQL에 저장된 최신 데이터를 조회합니다.
- 주말, 공휴일, 미발표일에는 latest available data를 유지합니다.

## Database Policy

- MySQL은 Docker Compose로 실행합니다.
- 테이블 생성과 변경은 Flyway migration으로 관리합니다.
- JPA Entity는 DB 매핑과 검증에 사용합니다.
- `spring.jpa.hibernate.ddl-auto`는 `validate`를 유지합니다.
- 운영/배포 환경에서도 `create`, `update`를 사용하지 않습니다.

Initial tables:

- `exchange_rates`: USD/KRW 환율
- `intraday_exchange_rates`: USD/KRW 1일 차트용 intraday 환율
- `dollar_indexes`: FRED `DTWEXBGS` 광의 달러 지수
- `currency_strengths`: 이전 USD 대비 통화 랭킹 저장 테이블
- `effective_exchange_rates`: BIS broad NEER/REER 실효환율
- `interest_rates`: 한국/미국 기준금리
- `foreign_reserves`: 외환보유액
- `batch_job_runs`: 배치 실행 이력

## Structure

```text
krw-watcher/
  backend/
  frontend/
  docker/
  .github/workflows/
  README.md
  CODEX.md
```

## Commands

```bash
# local database
docker compose -f docker/docker-compose.yml up -d

# backend
cd backend
./gradlew bootRun

# frontend
cd frontend
npm install
npm run dev
```

Docker Desktop or a compatible Docker daemon must be running before starting the local database.

## API Draft

- `GET /api/v1/dashboard/daily`
  - USD/KRW, broad dollar index, interest rate gap summary and daily time series
- `GET /api/v1/dashboard/macro`
  - foreign reserves and other macro indicators

## Notes

- API keys must not be committed.
- External API calls should be handled by scheduled backend jobs, not directly from user requests.
- Weekend and holiday gaps should use the latest available market data.
- The 1-day USD/KRW chart uses Twelve Data intraday data. Longer ranges use stored daily USD/KRW rows from Koreaexim or FRED `DEXKOUS`.
- The 1-day USD/KRW chart is the default first view. It uses a fixed 24-hour x-axis, shows only today's intraday data, highlights the latest value, and extends the latest known value to the current time for a live-like experience.
- Weekend intraday rows are not used for the 1-day chart. The backend returns the latest weekday intraday date.
- Market data sync runs through Spring Scheduler and can also be requested manually through `POST /api/v1/sync/market-data`.
- Manual sync requests are protected by cooldown so repeated clicks do not burn through Twelve Data/FRED API limits.
- The 1-day USD/KRW tab can request `POST /api/v1/sync/intraday-exchange`, which refreshes only Twelve Data intraday rows and is protected by its own cooldown.
- Intraday USD/KRW refresh also runs on a weekday scheduler, so today's chart can update without repeatedly running the full market-data sync.
- Daily USD/KRW has a dedicated weekday backfill job through `POST /api/v1/sync/daily-exchange/backfill`, so missing weekday rows such as an omitted Monday are detected and upserted without running every macro data source.
- The frontend polls stored dashboard data and sync status without triggering external API calls, so the screen feels current while API tokens are protected.
- The public dashboard no longer exposes a manual sync button. It shows an automatic refresh status badge instead.
- USD/KRW and broad dollar index charts share the same visual pattern: right-side axis, latest-value marker, horizontal reference line, price/index bookmark, range controls, and hover guidance.
- Advanced foreign economies dollar index uses FRED `DTWEXAFEGS` and is shown separately from the broad dollar index.
- The currency ranking card uses BIS broad NEER as the main weakness ranking and shows broad REER as a supplementary real effective exchange rate.
- The dashboard includes a data source/update guide for every chart and major data card.
- Newsroom uses Naver News Search API through the backend scheduler. The public frontend does not expose a manual news sync button.

## Work Memory

### 2026-07-02

- Frontend tab structure currently has Dashboard, 국내 현황, Ranking, Newsroom, plus separate service guide and developer info pages.
- Dashboard charts use Recharts with custom crosshair overlays. Position transitions were removed from crosshair/axis labels so cursor tracking does not lag.
- USD/KRW 1-day chart must use real Twelve Data intraday rows only. Do not fabricate flat projected points for missing intraday data.
- Backend loads both `.env` and `backend/.env` from `application.yml`; this matters when running from IntelliJ project root.
- Domestic status tab is intended to show domestic policy and macro conditions that influence KRW, not just a generic metric dashboard.
- ECOS-backed domestic policy indicators are stored in `domestic_policy_indicators` via Flyway V5. Current collected indicators include M2, current account, goods account, CPI, PPI, export amount, import amount, calculated trade balance, terms of trade, foreign stock net buying, and foreign bond holdings.
- OpenFiscal fiscal policy data uses `OPENFISCAL_API_KEY` for fiscal balance and central-government debt.
- Free official Korea CDS API was not identified. The dashboard uses FRED `BAMLH0A0HYM2` as a clearly labeled global credit-spread proxy, not an actual Korea CDS series.
- Newsroom is backed by Naver News Search API via Flyway V6 `news_articles`. Required env keys are `NAVER_CLIENT_ID` and `NAVER_CLIENT_SECRET`.
- News categories are `원달러 환율`, `외환시장`, `한국은행 기준금리`, `미국 연준 FOMC`, and `외환당국 환율`.
- News rows reserve nullable `ai_summary` and `market_sentiment` columns for later AI work.
- News sync is automatic through `NEWS_SYNC_CRON`; the frontend manual news collection button was intentionally removed.
- News sync stores recent articles in MySQL with a unique article key, prunes articles older than 5 years, backfills paged Naver search results on manual/startup stale sync, and runs lightweight latest-page sync on the scheduler.
- If Naver returns 403 again, backend should surface `NAVER_API_ERROR · HTTP 403 ...`; first check that backend was restarted after editing `backend/.env`.
- Frontend legacy local component copies were removed from `frontend/src/main.tsx`. Shared chart elements now live in `frontend/src/components/ChartElements.tsx`, and pure chart/status/time/metric logic lives under `frontend/src/utils/`.
- Dashboard chart sections were split into `frontend/src/components/MarketChartSection.tsx` so USD/KRW, advanced dollar index, and broad dollar index share the same chart frame and overlay behavior.

## Next Tasks

- Add a proper FX holiday/business-day calendar beyond simple Monday-Friday checks.
- Refine frontend loading, empty, and error states.
- Add real integrations for open finance fiscal data and public-data monetary-policy minutes once API keys are available.
- Refine newsroom deduplication beyond canonical URLs, including Naver redirect variants, similar-title matching, and multi-category article mapping.
- Improve news representative-image enrichment with per-domain metadata handling, caching, and preservation of enriched fields when duplicate rows are merged.
