# 세계 에너지 탐색기 (World Energy Explorer)

세계 각국의 전력 발전량, 소비량, 수입량을 시각화하여 에너지 자급률을 분석할 수 있는 인터랙티브 웹 애플리케이션입니다.

## 프로젝트 개요

이 프로젝트는 1980년부터 2021년까지 230개국의 전력 데이터를 사용하여 다음과 같은 기능을 제공합니다:
- 국가별 에너지 자급률 시각화 (지도 및 막대 차트)
- 연도별 데이터 변화 추적
- 인터랙티브 지도와 차트 간의 연동 기능

## 파일 구조 및 설명

### 루트 디렉토리

#### `index.html` (2.4KB, 79줄)
- **목적**: 웹 애플리케이션의 메인 HTML 파일
- **내용**: 
  - 전체 화면 분할 레이아웃 (좌측: 지도, 우측: 막대 차트)
  - 연도 슬라이더 컨트롤
  - D3.js 및 TopoJSON 라이브러리 임포트
  - 반응형 디자인을 위한 기본 구조

### src 디렉토리

#### `src/main.js` (30KB, 943줄)
- **목적**: 메인 JavaScript 애플리케이션 로직
- **주요 기능**:
  - D3.js를 사용한 세계 지도 렌더링
  - 에너지 자급률에 따른 색상 매핑 (빨강-노랑-초록 스케일)
  - 수평 막대 차트 생성 및 업데이트
  - 연도 슬라이더와 시각화 연동
  - 지도와 차트 간 인터랙티브 연결 (호버 효과)
  - 툴팁 및 레전드 표시

#### `src/style.css` (8.4KB, 498줄)
- **목적**: 전체 애플리케이션 스타일링
- **주요 스타일**:
  - 전체 화면 분할 레이아웃 (50:50)
  - 지도 및 차트 컨테이너 스타일
  - 연도 슬라이더 디자인
  - 툴팁 및 레전드 스타일
  - 반응형 디자인
  - 호버 효과 및 하이라이팅

### src/data 디렉토리

#### `src/data/Global Electricity Statistics.csv` (435KB, 1612줄)
- **목적**: 원본 전력 통계 데이터
- **내용**: 
  - 1980-2021년 전세계 국가별 전력 데이터
  - 순발전량, 순소비량, 수입량 정보
  - 지역별, 연도별 상세 통계

#### `src/data/countries.js` (898KB, 41408줄)
- **목적**: 처리된 국가별 전력 데이터 (JavaScript 형식)
- **내용**:
  - 230개국의 연도별 전력 데이터
  - 계산된 에너지 자급률 ((순발전량/순소비량) × 100%)
  - main.js에서 직접 import하여 사용

#### `src/data/countries-110m.json` (105KB, 2줄)
- **목적**: 세계 지도 GeoJSON 데이터 (TopoJSON 형식)
- **내용**: 
  - 중간 해상도 (1:110m) 세계 국경 정보
  - D3.js 지도 렌더링용 토폴로지 데이터

### src/data/json 디렉토리 (처리된 데이터 파일들)

#### `src/data/json/global_electricity_complete.json` (894KB, 41172줄)
- **목적**: 전체 국가 데이터 통합 파일
- **내용**: 모든 국가의 1980-2021년 전력 데이터 및 자급률

#### 지역별 데이터 파일들:
- **`africa_electricity.json`** (219KB, 10205줄): 아프리카 국가들
- **`asia_and_oceania_electricity.json`** (190KB, 8773줄): 아시아 및 오세아니아
- **`europe_electricity.json`** (177KB, 8057줄): 유럽 국가들
- **`central_and_south_america_electricity.json`** (175KB, 8057줄): 중남미
- **`eurasia_electricity.json`** (50KB, 2329줄): 유라시아 지역
- **`middle_east_electricity.json`** (54KB, 2508줄): 중동 지역
- **`north_america_electricity.json`** (28KB, 1255줄): 북미


## 주요 기능

1. **인터랙티브 세계 지도**: 
   - 에너지 자급률에 따른 색상 코딩
   - 호버 시 상세 정보 표시

2. **수평 막대 차트**:
   - 순소비량, 순발전량, 수입량 시각화
   - 국가별 비교 가능

3. **연도별 데이터 탐색**:
   - 슬라이더로 1980-2021년 데이터 탐색
   - 실시간 차트 업데이트

4. **상호작용 기능**:
   - 지도와 차트 간 연동 하이라이팅
   - 상세 툴팁 정보

## 실행 방법

```bash
npm install    # 의존성 설치
npm run dev    # 개발 서버 실행 (포트 3000)
```

## 데이터 출처
- 국제에너지기구(IEA) 전력 통계 데이터 기반
- 1980-2021년 기간 230개국 데이터 포함 
