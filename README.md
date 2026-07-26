# 더샵갤러리 테라리움 웨이팅

주말 현장 운영을 위한 웨이팅 관리 웹앱입니다.

## 주요 기능

- 휴대폰 번호, 입장 인원, 음료 주문, 직원 메모 등록
- 현재 대기·호출 완료·평균 대기 시간 현황
- 카카오 호출, 입장 완료, 웨이팅 취소 처리
- 연락처 마스킹 및 운영 종료 후 파기 안내
- Cloudflare D1 기반 웨이팅 기록 저장
- 카카오 알림톡 발송사 웹훅 연동 준비

## 로컬 실행

```bash
npm install
npm run dev
```

## 카카오 알림톡 연결

`.env.example`의 두 환경값을 배포 환경에 설정합니다.

- `KAKAO_ALIMTALK_WEBHOOK_URL`
- `KAKAO_ALIMTALK_WEBHOOK_SECRET`

웹훅은 `TERRARIUM_READY` 템플릿과 휴대폰 번호, 대기번호, 방문 요청 시간을 전달받습니다. 실제 알림톡 발송 전에는 카카오 비즈니스 채널 개설, 발신 프로필 및 정보성 템플릿 승인, 공식 발송사 계약이 필요합니다.

## 이미지 교체 위치

이미지는 WebP 또는 JPG 형식을 권장합니다. 아래 파일을 같은 이름으로 교체하면 화면에 바로 반영됩니다.

### 태블릿 첫 화면

| 화면 | 파일 위치 | 권장 크기 |
| --- | --- | --- |
| 시그니처 음료 주문 | `public/images/home/signature-drink.webp` | 1600 × 1000px |
| 테라리움 웨이팅 등록 | `public/images/home/terrarium-waiting.webp` | 1600 × 1000px |

중요한 피사체와 글자는 이미지 중앙 70% 안쪽에 배치합니다. 화면 비율에 따라 가장자리는 일부 잘릴 수 있습니다.

### 제품 카드

| 제품 | 파일 위치 |
| --- | --- |
| 플로럴 커피 | `public/images/products/floral-coffee.webp` |
| 블랙 커피 | `public/images/products/black-coffee.webp` |
| 디카페인 커피 | `public/images/products/decaf-coffee.webp` |
| 블랙 티 | `public/images/products/black-tea.webp` |
| 골드 티 | `public/images/products/gold-tea.webp` |

제품 이미지는 모두 1200 × 900px(4:3)를 권장합니다. 이미지 안에는 제품명이나 설명을 넣지 않아도 됩니다. 이름과 설명은 화면에서 별도로 표시됩니다.
