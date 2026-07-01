# KRW Watcher

원화 소득으로 미국 주식에 투자하는 개인 투자자를 위한 원화 가치 및 매크로 리스크 대시보드입니다.

## Goal

복잡한 환율, 금리, 외환보유액 데이터를 한곳에 모아 "지금 원화 가치가 안전한가, 위험한가"를 직관적으로 확인할 수 있게 합니다.

## MVP Scope

- USD/KRW 환율 추이
- USD/KRW 기간 선택: 1일, 3개월, 1년, 5년
- 광의 달러 지수 추이: 3개월, 1년, 5년
- 한국/미국 기준금리와 금리차
- 대한민국 외환보유액
- Spring Boot REST API
- React 단일 페이지 대시보드
- Mock/seed 데이터 기반 초기 개발
- 이후 ECOS/FRED 등 실제 API 연동

## Later Scope

- 외국인 KOSPI/KOSDAQ 수급
- REER/NEER
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
| USD/KRW | 한국수출입은행 오픈API, Twelve Data, FRED fallback | 현재환율 API USD `deal_bas_r`, Twelve Data `1day`, FRED `DEXKOUS` | 1일 1회 배치 저장 |
| USD/KRW intraday | Twelve Data | `time_series`, `USD/KRW`, `5min` | 1일 차트용, 제한 내 배치 저장 |
| 광의 달러 지수 | FRED | `DTWEXBGS` Nominal Broad U.S. Dollar Index | 1일 1회 배치 저장 |
| 미국 기준금리 | FRED | `FEDFUNDS` 또는 정책금리 target range series | 1일 1회 체크, 변경분 저장 |
| 한국 기준금리 | 한국은행 ECOS | `722Y001` item `0101000` | 1일 1회 체크, 변경분 저장 |
| 외환보유액 | 한국은행 ECOS | `732Y001` item `99` | 월 1회 이상 체크, 변경분 저장 |

`DTWEXBGS`는 ICE가 산출하는 전통적인 DXY와 동일한 지표가 아닙니다. MVP에서는 FRED에서 안정적으로 받을 수 있는 광의 무역가중 달러 지수로 달러 강세를 대체 측정합니다.

한국수출입은행 API가 응답하지 않으면 Twelve Data `1day`를 사용하고, Twelve Data도 실패하면 FRED `DEXKOUS`를 fallback으로 사용합니다. `DEXKOUS`는 FRED의 “South Korean Won to U.S. Dollar Spot Exchange Rate” 일별 시리즈지만 업데이트 지연이 있을 수 있습니다.

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
- The 1-day USD/KRW chart uses Twelve Data intraday data. Longer ranges use Twelve Data daily data, with FRED `DEXKOUS` as fallback.
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

## Next Tasks

- Consider adding DXY alongside the broad dollar index as a familiar headline dollar strength indicator.
- Add a proper FX holiday/business-day calendar beyond simple Monday-Friday checks.
- Refine frontend loading, empty, and error states.
