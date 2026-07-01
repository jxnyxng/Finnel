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

- 작업 전 이 프로젝트의 `README.md`와 루트 `MEMORY.md`를 확인합니다.
- 변경 전 관련 파일을 읽고 기존 구조를 따릅니다.
- 외부 API Key는 환경변수나 secret으로만 다룹니다.
- 사용자가 요청하지 않으면 커밋을 만들지 않습니다.
- 변경 후 가능한 검증 명령을 실행하고 결과를 보고합니다.

## Backend

- Java 17과 Spring Boot 3.x를 기준으로 합니다.
- REST API 경로는 `/api/v1` prefix를 사용합니다.
- 외부 API 호출은 유저 요청 경로가 아니라 batch/scheduler 경로에서 처리합니다.
- 외부 API는 지표별 1일 1회 또는 발표 주기별 체크를 기본으로 하며, DB 저장 데이터가 화면 조회의 기준입니다.
- 주말/공휴일 데이터 공백은 latest available data 정책으로 처리합니다.
- DB 쓰기는 upsert 기준으로 설계합니다.
- DB 스키마는 Flyway migration으로 관리하고, Hibernate `ddl-auto`는 `validate`를 유지합니다.
- 운영/배포 환경에서 Hibernate `create`, `update`를 사용하지 않습니다.

## Frontend

- React 컴포넌트는 대시보드 섹션 단위로 작게 나눕니다.
- 차트는 Recharts를 우선 사용합니다.
- API 호출은 별도 client/service 모듈로 분리합니다.
- 투자 조언처럼 보이는 문구는 피하고, 데이터 상태와 해석 보조 수준으로 표현합니다.

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
