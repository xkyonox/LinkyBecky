# LinkyBecky - 링크 인 바이오 애플리케이션

LinkyBecky는 Linktree에서 영감을 받은 풀스택, 모바일 우선 링크 인 바이오 애플리케이션입니다. AI 기능과 LinkyVicky 통합으로 강화된 맞춤형 랜딩 페이지를 제공합니다.

## 주요 기능

- 커스터마이징 가능한 링크 인 바이오 페이지
- 드래그 앤 드롭 링크 순서 지정
- AI 기반 링크 관리 및 분석
- 모바일 우선 반응형 디자인
- LinkyVicky URL 단축기와의 통합
- 구글 OAuth 인증

## 환경 설정

1. 저장소를 클론합니다:
   ```
   git clone https://github.com/your-username/linkybecky.git
   cd linkybecky
   ```

2. 필요한 패키지를 설치합니다:
   ```
   npm install
   ```

3. `.env.example` 파일을 복사하여 `.env` 파일을 생성합니다:
   ```
   cp .env.example .env
   ```

4. `.env` 파일에 필요한 API 키와 설정을 추가합니다:
   ```
   OPENAI_API_KEY=your_openai_key_here
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_secret
   LINKYVICKY_API_TOKEN=your_linkyvicky_api_token
   SESSION_SECRET=your_session_secret
   ```

## API 키 획득 방법

### OpenAI API 키
- [OpenAI 웹사이트](https://platform.openai.com/signup)에 가입
- API 키 발급 페이지에서 새 API 키 생성

### Google OAuth Credentials
1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 프로젝트를 생성하고 OAuth 동의 화면 설정
3. 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID
4. 애플리케이션 유형으로 '웹 애플리케이션' 선택
5. 승인된 리디렉션 URI에 `http://localhost:5000/api/auth/google/callback` 추가
6. 생성된 클라이언트 ID와 클라이언트 시크릿 사용

### LinkyVicky API 토큰
- [LinkyVicky 웹사이트](https://www.linkyvicky.com/)에서 계정 생성
- 개발자 설정에서 API 토큰 발급

## 서버 실행

개발 서버를 실행합니다:
```
npm run dev
```

애플리케이션은 http://localhost:5000 에서 접속할 수 있습니다.