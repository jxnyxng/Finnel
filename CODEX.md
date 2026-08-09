# Codex Guide

이 파일은 `krw-watcher` 프로젝트 안에서 적용되는 작업 규칙입니다.

## Project Context

- Goal: 원화 가치 및 매크로 리스크 대시보드
- Target user: 원화 소득 기반 미국 주식 투자자, 매크로 리스크 모니터링 실무자
- MVP: USD/KRW, 광의 달러 지수, 한미 금리차, 외환보유액
- Tech stack: React + Vite + TypeScript, Spring Boot 3.x, MySQL, Docker, AWS EC2, GitHub Actions
- Initial data mode: mock/seed data first, real ECOS/FRED integration later
- Data sources: 한국수출입은행 오픈API, 한국은행 ECOS, FRED
- Dollar index policy: DXY 대신 FRED `DTWEXBGS`를 광의 달러 지수로 사용
- USD/KRW fallback policy: 한국수출입은행 API가 실패하면 FRED `DEXKOUS`를 사용

## Workflow

- 작업 전 이 프로젝트의 `README.md` Work Memory를 확인합니다.
- 변경 전 관련 파일을 읽고 기존 구조를 따릅니다.
- 외부 API Key는 환경변수나 secret으로만 다룹니다.
- 사용자가 요청하지 않으면 커밋을 만들지 않습니다.
- 변경 후 가능한 검증 명령을 실행하고 결과를 보고합니다.
- 운영 배포 기준 브랜치는 `main`입니다. `main`에 긴급 반영한 운영 수정은 GitHub PR로 `dev`에 역동기화합니다.
- 신규 기능 작업은 `dev` 기준 작업 브랜치를 만들고, 검증 후 `dev -> main` 흐름으로 배포합니다.

## Backend

- Java 17과 Spring Boot 3.x를 기준으로 합니다.
- REST API 경로는 `/api/v1` prefix를 사용합니다.
- 외부 API 호출은 유저 요청 경로가 아니라 batch/scheduler 경로에서 처리합니다.
- 외부 API는 지표별 1일 1회 또는 발표 주기별 체크를 기본으로 하며, DB 저장 데이터가 화면 조회의 기준입니다.
- 주말/공휴일 데이터 공백은 latest available data 정책으로 처리합니다.
- USD/KRW는 거래소 주식시장처럼 공식 단일 휴장일 캘린더가 있다고 보지 않습니다. OTC 성격을 감안해 한국 공휴일, 미국 bank/Fed holiday, 실제 데이터 유무 fallback을 조합합니다.
- FX 캘린더는 `KR_PUBLIC`을 먼저 적용했습니다. 다음 단계는 `US_FED` 추가입니다.
- DB 쓰기는 upsert 기준으로 설계합니다.
- DB 스키마는 Flyway migration으로 관리하고, Hibernate `ddl-auto`는 `validate`를 유지합니다.
- 운영/배포 환경에서 Hibernate `create`, `update`를 사용하지 않습니다.
- 운영 EC2 systemd 서비스명은 `koreaone-backend`입니다.
- 운영 MySQL은 EC2 Docker 컨테이너 `krw-watcher-mysql`을 사용합니다.
- 운영 Nginx는 `/api/`, `/actuator/`를 `127.0.0.1:8080` 백엔드로 프록시하고, 프론트 정적 파일은 `/var/www/koreaone`에 배포합니다.
- 운영 EC2 프론트 반영은 `frontend`에서 `npm run build` 후 `sudo rsync -av --delete dist/ /var/www/koreaone/` 및 `sudo systemctl reload nginx` 순서로 수행합니다. 기본 Nginx root인 `/usr/share/nginx/html`에 복사해도 실제 서비스 화면은 바뀌지 않을 수 있습니다.
- 운영 JVM timezone은 `Asia/Seoul`로 맞춰져 있습니다. 시간대 처리는 별도 코드/테스트 정리가 필요합니다.
- 정책브리핑 API는 3일 초과 조회 시 `THREE_DAYS_OVER_ERROR`가 발생하므로 최신/백필 수집은 3일 이하 단위로 호출해야 합니다.
- 정책브리핑 API는 XML 또는 JSON으로 응답할 수 있습니다. `PolicyBriefingClient`는 둘 다 파싱해야 하며, 금융/환율/재정/무역/물가 관련 필터는 유지합니다.
- 정책브리핑 운영 데이터는 수동 SQL이 아니라 backend sync/backfill로 적재되어야 합니다.
- 한국수출입은행 환율 API 운영 도메인은 `https://oapi.koreaexim.go.kr/site/program/financial`입니다.
- FRED `DEXKOUS` 최신 지연분을 한국수출입은행 최근 일환율로 자동 보정하는 코드는 아직 미완료입니다.

## Frontend

- React 컴포넌트는 대시보드 섹션 단위로 작게 나눕니다.
- 차트는 Recharts를 우선 사용합니다.
- API 호출은 별도 client/service 모듈로 분리합니다.
- 투자 조언처럼 보이는 문구는 피하고, 데이터 상태와 해석 보조 수준으로 표현합니다.
- 다음 프론트 작업 이슈: 반응형 탭/모달 UX 개선. 상단 메인 탭은 한 줄 유지 및 가로 스크롤, 상단 탭 선택은 제자리 강조 방식, 하위 탭 인디케이터는 크기 변화 없이 이동만, 모달은 화면별 최대 크기와 내부 스크롤을 정리합니다.

## Commands

```bash
# database
docker compose -f docker/docker-compose.yml up -d

# backend
cd backend
./gradlew bootRun

# frontend
cd frontend
npm install
npm run dev
```
