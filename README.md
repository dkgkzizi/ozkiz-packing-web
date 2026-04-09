# 인도 패킹리스트 클라우드 변환기 (India Packing List Web)

이 프로젝트는 기존 데스크톱용 인도 패킹리스트 변환기를 인터넷에서 바로 사용할 수 있도록 **Next.js** 기반의 클라우드 서비스로 전환한 버전입니다.

## 주요 기능

1.  **PDF 엑셀 변환 (Convert)**: 인도 패킹리스트 PDF를 업로드하면 데이터를 추출하여 구조화된 엑셀 파일로 변환합니다.
2.  **엑셀 데이터 매칭 (Match)**: 변환된 엑셀 파일을 구글 스프레드시트의 마스터 데이터와 연동하여 상품 코드 및 옵션을 자동으로 매칭합니다.
3.  **수량 검증 (Verify)**: 원본 PDF의 총 수량과 최종 엑셀의 수량이 정확히 일치하는지 정밀 검증합니다.

## 기술 스택

-   **Framework**: Next.js 15 (App Router)
-   **Styling**: Tailwind CSS, Lucide React (Icons)
-   **Backend**: Node.js Serverless Functions
-   **Libraries**: pdf2json (PDF 파싱), exceljs (엑셀 생성)

## 클라우드 배포 방법 (Vercel)

가장 쉽고 빠른 배포 방법은 **Vercel**을 사용하는 것입니다.

1.  **GitHub 프로젝트 생성**: 이 폴더의 내용을 본인의 GitHub 저장소에 업로드합니다.
2.  **Vercel 연동**: [Vercel](https://vercel.com)에 로그인 후 `Add New Project`를 클릭합니다.
3.  **저장소 선택**: 업로드한 GitHub 저장소를 선택합니다.
4.  **배포 (Deploy)**: 별도의 설정 변경 없이 `Deploy` 버튼을 누르면 약 1~2분 내에 서비스 주소(`https://...vercel.app`)가 생성됩니다.

## 로컬 실행 방법

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

---
© 2026 ANTIGRAVITY - Smart Logistics Solution
