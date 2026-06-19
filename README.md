# 볼보 브로셔 플립북 뷰어

선문대 모빌리티시스템공학과(볼보트럭코리아) 브로셔 PDF를 페이지 넘기는 플립북 형태로 보여주는 Next.js 프로젝트입니다.

## 로컬에서 테스트하기

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속

## 구조

- `public/pages/page-1.jpg ~ page-9.jpg` — PDF에서 추출한 페이지 이미지 (150dpi)
- `pages/index.js` — react-pageflip 기반 뷰어
- `styles/globals.css` — 전체 스타일 (다크 배경 + 책 그림자)

## PDF를 다른 파일로 교체하고 싶을 때

1. `public/pages/` 안의 page-1.jpg ~ page-N.jpg 를 새 이미지로 교체
   (poppler 설치 후 `pdftoppm -jpeg -r 150 -jpegopt quality=85 원본.pdf public/pages/page` 로 변환 가능)
2. `pages/index.js` 상단의 `TOTAL_PAGES` 값을 페이지 수에 맞게 수정
3. `PAGE_RATIO` 값도 새 이미지의 세로/가로 비율로 맞춰주면 책 모양이 깨지지 않습니다

## 깃허브 → Vercel 배포

1. 이 폴더를 새 깃허브 레포로 push
2. Vercel에서 해당 레포 import (Framework Preset: Next.js, 별도 설정 불필요)
3. 배포 완료 후 원하는 도메인(예: kise.or.kr 서브도메인) 연결
