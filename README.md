# LGE Europe TV Profitability Simulator (2026 AX Task)

본 프로젝트는 LGE Europe TV 2026년 선행 수익성 시뮬레이터 웹 애플리케이션 구축 및 운영 배포 프로젝트입니다.
원천 엑셀 파일(`★손익 Simulator_26년 7월차 선행_1차.xlsx`)의 `Simulator` 시트 수식을 100% JavaScript 엔진으로 실시간 재계산하며, 매트릭스 표 기반으로 모델별 가격·차감율·수량·딜러마진 변경에 따른 수익성(COI/MP) 변동을 분석합니다.

---

## 🌐 Firebase Hosting 운영 배포 정보

- **운영 사이트 URL**: `https://lge-profitability-simulator-2026.web.app`
- **통합 영업 포털 (Sales Portal)**: `https://tv-sales-portal-lge.web.app` 내 '수익성 Simulator' 메뉴 연동 완료
- **보안 및 SSO 인증 규격 (`auth-guard.js`)**:
  - **포털 경유 (SSO)**: Global Sales Insight Portal에서 접속 시 인증 토큰 자율 검증을 거쳐 별도 로그인 입력 없이 자동 바로 접속.
  - **독립 직접 접속 (Direct)**: 브라우저에 대시보드 URL 직접 입력 진입 시 표준 풀스크린 로그인 가드 발동 (ID: `LGE135` / PW: `LGE246`).
  - **세션 관리**: 30분 활동 이력 자동 연장 및 30분 무활동 시 안전 자동 로그아웃.

---

## 📌 주요 특징 및 핵심 연산/디자인 규칙

1. **사이드바 상단/하단 최적화**
   - 사이드바 상단 로고 타이틀 부분에서 `LGE Europe TV AX Task` 문구를 제거하여 더욱 간결한 헤더 뷰를 구성했습니다.
   - 사이드바 하단 기존 `시뮬레이션 레이아웃 뷰` 영역을 삭제하고, **`POC / Harry Park / harry.park@lge.com`** 담당자 정보 카드를 깔끔하게 배치하여 시스템 운영 담당 정보를 제공합니다.

2. **상·하단 상하 여백 최적화 (Vertical Whitespace Optimization)**
   - 헤더 패딩(`px-6 py-2.5`) 및 메인 공간 패딩(`px-6 py-3`)을 50% 슬림화하여, 'TV 수익성 시뮬레이션 매트릭스' 제목 상단 여백을 대폭 줄였습니다.
   - 테이블 컨테이너 높이를 동적 화면 패널 높이(`max-h-[calc(100vh-140px)]`)로 변경하여 매트릭스 표 하단의 불필요한 빈 공간(하단 데드 스페이스)을 제거하고 전체 PnL 표 항목(Section 1, 2, 3)이 한눈에 들어오도록 가독성을 극대화했습니다.

3. **상단 타이틀 텍스트 깔끔화 (`TV 손익 시뮬레이션`)**
   - 대시보드 우측 상단 메인 헤더 타이틀 텍스트를 `${법인명} TV 손익 시뮬레이션` (예: `LGEUK (영국) TV 손익 시뮬레이션`)으로 수정하였습니다.
   - 환율 및 VAT 텍스트 배지(`[ GBP (환율: ... | VAT: ...) ]`)를 타이틀 옆에서 완전 제거하여 깔끔하고 세련된 헤더 UI를 제공합니다.

4. **엄격한 고정 모델 열 너비 (Strict Fixed Uniform Column Width)**
   - 대시보드에 조회되는 모델 수(1개~20개)와 관계없이 **항목 구분 열 `220px`**, **각 모델 열 `135px`**로 너비를 엄격히 고정했습니다.
   - `min-width: 100%` 속성을 제거하고 `table-layout: fixed; width: max-content;`를 적용하여, 모델 수가 1~3개로 적을 때도 화면 전체로 열이 과도하게 벌어지거나 늘어나지 않고 시안과 100% 동일하게 정돈된 고정 너비로 표출됩니다.
   - 입력 셀 박스(`.excel-input`)는 `84px` 중앙 정렬로 설계하여 첨부 이미지의 컴팩트한 입출력 셀 뷰를 제공합니다.

5. **매출원가(COGS) Column 20 (U열) 전수 추출 및 `G.Cost` 반영 (`build_simulator_data.js`)**
   - 엑셀 `Simulator` 시트 36행(`COGS ($)`) 수식이 Pivot 시트의 `합계 : COGS`를 참조함에 따라, 원천 `가공Raw` 시트의 Column 20 (`COGS`)을 정밀 추출하여 `G.Cost` (품질보증/일반원가, Col 17)가 누락되지 않도록 반영합니다.
   - 이를 통해 대시보드의 COGS 대당 단가가 엑셀 `Simulator` 시트 36행 수치와 100% 일치합니다 (예: Swiss 77C6 7월 = `$1,119`).

6. **한계이익(Marginal Profit) 수식 및 판관비 변동비 동기화**
   - 엑셀 56행(`Simulated 한계이익 $`) 수식 연동:
     $$\text{Simul. MP (\$)} = \text{Simul. N.Price (\$)} - \text{COGS (\$)} - \text{판관비 변동비 (\$)}$$
     $$\text{simMpUSD} = \text{baseMarginalProfit} \times \text{qtyRatio} + (\text{simNetSalesUSD} - \text{baseNetSalesUSD} \times \text{qtyRatio})$$
   - 엑셀 56행 VLOOKUP이 6개월 전체 피벗 원가를 차감하는 구조상 단일월(9월) 선택 시 대시보드는 9월 실제 발생 원가를 반영하여 $174, 전체 7~12월 선택 시 엑셀 피벗 수치인 $193과 100% 동기화됩니다.

7. **개편된 테이블 구조 (Section 1, Section 2, Section 3)**
   - **섹션 1 (`1. 선행 수익성 기준 정보`)**: `예상 RRP`, `예상 Promo. Price`, `F. Margin (%)`, `F. Margin(Promo) (%)`, `VAT (%)`, `통화 (적용환율)`, `G. Price` (27행 정수), `가판 (%)` (31행), `영업이익 ($)` (49행), `영업이익 (%)` (50행), `한계이익 ($)` (54행), `한계이익 (%)` (55행).
   - **섹션 2 (`2. 시뮬레이션 입력 요소 - Editable`)**: `예상 RRP` (동적 산출), `예상 Promo. Price` (동적 산출), `Simul. G. Price` (정수 입력), `Simul. 차감율 (%)` (입력).
   - **섹션 3 (`3. 수익성 지표 산출 결과 (Simulation)`)**: `N.Price ($)` (35행), `COGS ($)` (36행), `COGS (%)` (37행), `재료비 ($)` (38행), `재료비 (%)` (39행), `판관비 ($)` (43행), `판관비 (%)` (44행), `영업이익 ($)` (51행), `영업이익 (%)` (52행), `한계이익 ($)` (56행), `한계이익 (%)` (57행).

---

## 🚀 실행 및 배포 명령어

### 1) 원천 데이터 컴파일
```powershell
cd "d:\TV 유럽영업\15. AX Task\2026 AX 실행과제\10. 수익성 Simulator"
node build_simulator_data.js
```

### 2) Firebase Hosting 운영 배포
```powershell
npx --yes firebase-tools deploy --only hosting:profitability-simulator --project lge-advance-profitability-2026
```

---

## 🛠️ 주요 구조 파일

- `index.html`: 메인 웹 UI 레이아웃, `auth-guard.js` 연동, POC 카드가 적용된 사이드바 및 CSS 스타일
- `auth-guard.js`: 통합 보안 인증 가드 및 SSO 토큰 자동 검증 처리기
- `app.js`: 슬라이서 렌더링, 이벤트 핸들러, 대시보드 갱신
- `simulator_engine.js`: 엑셀 PnL 수식 실시간 연산 엔진
- `build_simulator_data.js`: 엑셀 원천 데이터 파싱 및 JSON 컴파일러
- `.firebaserc` / `firebase.json`: Firebase Hosting 멀티사이트 대상 배포 설정 파일
- `simulator_data.json` / `simulator_data.js`: 사전 빌드된 286개 모델 데이터셋
