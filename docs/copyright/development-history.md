# Craftoon 개발 이력과 증거 목록

작성일: 2026-11-22 (America/Vancouver).
[설계 결정](design-decisions.md) · [AI 기여 구분](ai-contributions.md)

## 조사 범위와 보존 원칙

- 앱 폴더: `/Volumes/Data/AI/app/Craftoon`, HEAD `1860d692fe22518952a6c40abf32da2ace2c9fe2`.
- 관련 폴더: `/Volumes/Data/AI/app/Craftoon-web` (읽기 전용으로 조사).
- 소스: Git 객체·커밋 변경 파일, 현재 코드·문서, 제공된 사용자/AI 대화.
- 원격: `https://github.com/tignarius/craftoon.git`. 이번 조사에서 `git ls-remote --heads origin`과 `--tags origin`만 실행했으며 fetch/push/설정 변경은 하지 않았다.
- 아래 일자는 Git author timestamp를 **America/Vancouver로 변환**한 기록일이다. 커밋은 내용을 기록한 시점이며 최초 창작일이나 제3자 타임스탬프 보증이 아니다. 확인한 두 이력의 author/committer timestamp는 동일하지만 기기 시계의 정확성은 별도 확인 필요다.
- 작성자 필드는 앱 이력에서 `Yonggyu Park` 또는 `tignarius`, 웹 이력에서 `Yonggyu Park`이다. 실제 타이핑한 사람, AI 미사용, 권리 귀속을 확정하지 않는다. 개인 이메일은 이 문서에 재기재하지 않았다.

## 저장소·폴더 관계와 푸시 상태

1. 앱 `main`의 최초 커밋은 `cf461f62`(2025-12-08), 마지막은 `1860d692`(2026-11-21)이며 총 **23개** 커밋이다.
2. 같은 객체 저장소에 웹 이력 `web-legacy`가 남아 있다. 최초 `4ef6d867`(2025-11-24), 끝 `1d4390b37f5ca34c883f058874589968992fa4aa`(2026-08-23), 총 **14개** 커밋이다. `git merge-base main web-legacy`는 공통 조상을 반환하지 않았다. 공통 Git 조상이 없는 별도 이력이며, 이를 단일 선형 이력으로 합쳐 서술하지 않는다.
3. 웹 폴더 `.git`는 `gitdir: /Volumes/Data/AI/app/comic-layout-app/.git/worktrees/comic-layout-app-web`를 가리킨다. 현재 그 연결로 Git 명령이 실패한다. 앱의 `git worktree list --porcelain`에도 옛 경로 `/Volumes/Data/AI/app/comic-layout-app-web`와 prunable 표기가 있다. 연결 파일이나 worktree 메타데이터는 수정하지 않았다.
4. 웹 주요 파일 7개의 현재 바이트와 `web-legacy` 마지막 커밋의 파일 바이트가 일치했다. 따라서 관련 자료로 연결할 근거가 있다. 웹 폴더 전체가 그 커밋과 완전히 동일하다고 주장하지 않는다. 실제 `package.json`은 커밋의 `comic-layout-app`과 달리 현재 이름이 `craftoon-web`이며 바이트가 일치하지 않는다.
5. 2026-11-22 조회 시 원격에 노출된 head는 `refs/heads/main = afb3ab05c07c4c12e6bbd61f99186cb612db9b9c` 하나였고, 노출된 태그는 없었다. 로컬 main은 3개 커밋 앞선다. 로컬 태그 `backup/docs-before-refresh-20261120`는 `7312da23`를 가리킨다.
6. 사용자는 웹 관련 자료를 Git에 푸시해 놓았다고 설명했다. **사용자 진술로 기록**한다. 이번 조회에서는 원격 `web-legacy` 브랜치가 보이지 않았으므로 사용자가 지정한 이 저장소에 대한 과거 푸시 일시·삭제된 브랜치·원격 객체 보존 여부는 **확인 필요**다. ‘푸시된 적이 없다’는 결론은 내리지 않는다.

## 제작 경위에 대한 사용자 정정·확인 (2026-11-22)

사용자는 종전의 ‘앱을 먼저 만들었다’라는 표현을 **‘웹을 먼저 만들었다’**로 정정했다. 따라서 이전 표현을 미해결 제작 순서 충돌로 유지하지 않는다. 남아 있는 최초 웹 커밋(2025-11-24)과 현재 RN 앱 저장소 시작(2025-12-08)의 순서도 정정된 설명과 부합한다. 다만 Git 기록은 실제 최초 작업 시점 그 자체를 보증하지 않는다.

사용자는 `Yonggyu Park`·`tignarius`·`Squareplayer`가 모두 본인이며 프로젝트 아이디어는 모두 본인의 것이라고 밝혔다. 초기에는 Gemini로 제작했고, 가장 최근에는 Codex를 사용했다고 설명했다. 당시 이미지 제작에 ChatGPT도 한 번 썼던 것 같다는 부분은 확정하지 않은 회고이므로 **확인 필요**로 기록한다. 사용자 기획·도구 사용 진술과 코드별 생성/직접 작성 증거는 구분한다.

사용자가 알려준 저장소 `https://github.com/tignarius/craftoon.git`는 현재 로컬 origin과 동일하다. 추가 읽기 전용 명령 `git ls-remote --heads --tags https://github.com/tignarius/craftoon.git`로 재조회했으며 결과는 위의 main 해시와 동일했고 웹 브랜치·태그는 노출되지 않았다. 따라서 주소 불명확성은 해소됐지만, 과거 웹 이력의 푸시·삭제·현재 서버 객체 잔존 여부까지 확인된 것은 아니다.

웹 폴더 안의 Expo/Skia 앱 소스 `CraftoonRN/`는 `web-legacy`의 2026-08-23 백업 커밋에서 처음 추적된다. 그 날짜를 실제 앱 개발 시작일이나 웹에서 앱으로 전환한 날로 확정하지 않는다.

위 내용은 이번 대화에서 확보한 사용자 진술이며, 독립적인 원본 대화 내보내기·신원·외부 계정 로그를 검증한 것은 아니다.

## 개발 환경 이전에 관한 사용자 설명 (2026-11-22)

사용자는 **Windows에서 개발을 시작했고, Mac으로 시스템을 옮기면서 폴더 구조가 모두 바뀌었다**고 설명했다. 이는 사용자 진술로 기록하며, 이전 운영체제의 원본 폴더·백업·Git 설정을 직접 검사한 것은 아니다. Windows 개발 시작일과 Mac 이전일은 **확인 필요**다.

현재 `Craftoon-web/.git`와 worktree 메타데이터가 옛 폴더 경로를 참조하는 사실은 별도로 확인됐다. 환경 이전·경로 변경 설명은 이 상태를 이해하는 배경이지만, 어느 이동 작업이 언제 연결을 끊었는지까지 증명하지는 않는다. 옛 경로 참조가 남았다는 이유로 웹 개발 이력이나 파일이 없어졌다고 판단하지 않는다. 현재 웹 파일과 로컬 `web-legacy`의 보존 상태는 위의 바이트 비교·커밋 목록을 따른다.

추가 자료가 있다면 Windows 당시 프로젝트 폴더·원격 설정·백업·초기 AI 대화와 Mac 이전 기록을 함께 보존한다. 이번 작업에서는 폴더 이동, worktree 연결 복구, 브랜치 전환 또는 Git 설정 변경을 하지 않았다.

## 앱 main 전체 커밋 목록

커밋 메시지는 원문이며, 제목만으로 기능 완성·AI 기여를 판단하지 않았다. 아래 해시는 저장소에서 `git show <hash>`로 전체 변경을 열 수 있다.

| Vancouver 기록일 | 커밋 | 메시지 |
| --- | --- | --- |
| 2025-12-08 | `cf461f62` | Initial commit |
| 2025-12-08 | `89592f1a` | Update App.tsx |
| 2025-12-09 | `5361d821` | Implement SplashScreen and PencilKit integration |
| 2025-12-09 | `57694aaa` | Trigger rebuild for splash screen verification |
| 2025-12-09 | `5ab312e4` | Update splash screen to use SVGs (v3) and configure react-native-svg |
| 2025-12-09 | `419a4c7f` | feat: optimize assets, fix iPad layout, and update background |
| 2026-08-23 | `0db093d4` | Save RN changes |
| 2026-08-23 | `ec539ef0` | Update app with PencilKit and web layout workspace |
| 2026-11-06 | `c463752e` | feat: save optimized iPad comic studio checkpoint |
| 2026-11-07 | `8c5ca2c3` | feat: refine comic editing, recovery, and Pro access |
| 2026-11-13 | `fb6a0996` | feat: save tracing, ink performance, and library UI checkpoint |
| 2026-11-18 | `6000a0db` | feat: checkpoint panel shaping, sharp zoom, and refined iPad editing |
| 2026-11-19 | `e2680f10` | feat: refine iPad panel editing and drawing continuity |
| 2026-11-19 | `33b696af` | feat: update quick guide and refine iPad rotation behavior |
| 2026-11-19 | `a9cf104b` | fix: skip template save prompt on blank pages |
| 2026-11-20 | `3b58b536` | feat: refine panel auto layout and preserve ink during reshaping |
| 2026-11-20 | `6275da4f` | feat: refresh quick guide and clarify panel control icons |
| 2026-11-20 | `fa09e78a` | docs: align quick guide columns and distinguish Read mode |
| 2026-11-20 | `7312da23` | feat: reorder library comics and refine email export and quick guide |
| 2026-11-20 | `afb3ab05` | docs: sync project documentation with current iPad release checkpoint |
| 2026-11-21 | `851c81df` | feat: edit library titles inline and align canvas picker |
| 2026-11-21 | `8b89c033` | fix: align compact iPad header controls with canvas edges |
| 2026-11-21 | `1860d692` | fix: include verified official Hermes Release symbols |

## 웹 web-legacy 전체 커밋 목록

이 표는 앱 저장소의 로컬 브랜치를 조회한 결과다. 원격에서 해당 브랜치를 확인했다는 뜻은 아니다.

| Vancouver 기록일 | 커밋 | 메시지 |
| --- | --- | --- |
| 2025-11-24 | `4ef6d867` | Initial commit: Comic Studio with enhanced drawing tools |
| 2025-11-27 | `eac97141` | Refine UI: Fix eraser, adjust shadows, rename app, resize toolbar elements |
| 2025-11-27 | `ec286375` | Fix drawing tools, eraser cursor, navigation, and selection box |
| 2025-11-28 | `26330475` | feat: Add resize handles, fix menu auto-close, and improve toolbar stability |
| 2025-11-28 | `58feeaeb` | Refine zoom UI, adjust slider spacing, and fix Workspace interaction bugs |
| 2025-11-29 | `10d8a801` | Fix blank page, improve zoom UX, and smooth drawing lines |
| 2025-12-01 | `d3a9fcab` | Implement speech bubble functionality: creation, editing, moving, resizing, and deletion |
| 2025-12-02 | `c2430aad` | Enhance speech bubble functionality and UI: zoom fixes, text formatting, stroke smoothing |
| 2025-12-02 | `b5e37da7` | Refine page navigation UI and layout resize handles |
| 2025-12-03 | `9cb8d726` | Refactor Story/Print features: New icons, menu behavior, and state reset fixes |
| 2025-12-04 | `a466d99b` | Update splash screen with new design, assets, and layout |
| 2025-12-04 | `a63e501b` | Refine splash screen: adjust sizes, spacing, fonts, and shadows |
| 2025-12-08 | `8343b34e` | Refine speech bubble interaction: switch to pen on cancel, deselect on draw |
| 2026-08-23 | `1d4390b3` | Backup: Web version with local changes |

## 원본 파일 동일성 증거

다음은 2026-11-22에 현재 웹 폴더 파일의 SHA-256을 계산하고, 앱 저장소의 `git show web-legacy:<경로>` 출력과 바이트 단위로 비교한 결과다. 이것은 내용 동일성 확인이며 제3자 시점 인증은 아니다. 파일 수정일·파일명 속 날짜를 창작일로 쓰지 않았다.

| 웹 상대 경로 | SHA-256 | web-legacy와 일치 |
| --- | --- | --- |
| `src/App.jsx` | `63038cf0e0283f8e4b7fad44ba7b9c96f523c1d9f4365abc933959338db62328` | 예 |
| `src/components/Workspace.jsx` | `46482503ec530519c2ded72492d73efb9138374f7a83342935700785faed6937` | 예 |
| `src/hooks/useDrawing.js` | `c6e4f884c01bd65176494743be3624e4e8d5d39ba9e31b97c8d5bf93d2b35982` | 예 |
| `design/splash_screen_prompt.txt` | `4e3cf0d5018a2153e9fa0cc0b884f0f1e6d9bf57c31a5a49333cfdb59fbf9da8` | 예 |
| `design/Gemini_Generated_Image_4bzv8l4bzv8l4bzv.png` | `dc8bc6921643e92753af28db00741106c2dc9b83d1b3f7d51acc22ef5242661d` | 예 |
| `design/splash_comic.ai` | `3b2a380b8f047d81cb3b2ea6a9f0c442996c9740ed9a907d19bb110c97e9a2e6` | 예 |
| `CraftoonRN/App.js` | `ee4993605098ca089823b0135b0d0e36b22ce2867a2e502a23f5974118aceb1f` | 예 |
| `package.json` | `ba032664ce58b9dd6a4d15dabce73d7a26ad64d012a0153ef42e7ae8aa041f0c` | 아니오 — 현재 폴더 수정본 |

## 주요 전환점: 코드·문서 확인

- 웹 `4ef6d867`: React/Vite 프로젝트와 `ComicPanel.jsx`, `Workspace.jsx`, `useDrawing.js` 존재. `d3a9fcab`·`c2430aad`에서 말풍선 생성·편집 관련 변경이 기록된다. 웹 `App.jsx`에는 페이지별 패널/말풍선/히스토리 상태, Undo/Redo와 `html2canvas` 기반 내보내기가 있다.
- 웹 `eac97141`: `design/splash_screen_prompt.txt`와 Gemini 이름의 이미지가 추적됨. `a466d99b`에는 스플래시 컴포넌트와 SVG/PNG 자산 변경이 있다. 생성 프롬프트와 특정 채택 출력물의 일대일 관계는 확인 필요다.
- 웹 `1d4390b3`: Expo 51·React Native 0.74.1·Skia를 명시한 `CraftoonRN/package.json` 및 앱 소스가 보존된다. 이는 현재 앱의 RN 0.82.1과 다른 앱 시도다.
- 앱 `cf461f62`: 초기 `package.json`이 React Native 0.82.1 / React 19.1.1을 명시한다. `5361d821`에는 `PencilKitView.tsx`, Swift/Objective-C 브리지, SplashScreen과 자산 변경이 있다. `ec539ef0`에는 패널/말풍선/툴바/작업영역 컴포넌트 변경이 있다.
- 앱 `8c5ca2c3`·`fb6a0996`: Pro 접근, 복구, 라이브러리, 추적 이미지와 잉크 성능 체크포인트. 구체적 파일 저장/불변 참조/미리보기 정책은 `docs/PERFORMANCE.md`와 네이티브 코드에 기록돼 있다.
- 앱 `6000a0db`·`3b58b536`: 패널 형상, 확대와 그림 보존·자동 배치. 가이드 변화는 `6275da4f`, `fa09e78a`, `7312da23` 및 `docs/manual/README.md`에서 확인한다.
- 앱 `851c81df`: 제공된 대화와 연결되는 제목 직접 편집·키보드 회피·빈 공간 스크롤·방향 선택창 간격 수정이 묶여 있다.
- 앱 `8b89c033`: mini 화면의 상단 정렬 수정. 작은 화면에만 적용하고 큰 iPad의 기존 간격을 유지하라는 사용자 조건과 연결된다.
- 앱 `1860d692`: 공식 Hermes dSYM 준비·UUID 검증·복사 단계와 검증 문서. 이력상 앱 버전 1.0 / 빌드 번호 1을 유지했고, Build 2 진행은 확인 대기로 남겼다.

## 배포·검증 기록의 출처와 시간 차이

2026-11-20 기준 `README.md`, `docs/app-store/SUBMISSION_STATUS.md`에는 App Store 제출 미확인이라고 적혀 있다. 이후 제공된 사용자 대화에서는 **Craftoon 1.0 Build 1을 App Store Connect에 업로드했고 TestFlight Beta App Review 대기 중**이라고 명시했다. 후자는 사용자 진술이며, 이번 정리에서 App Store Connect 화면이나 서버 기록을 다시 검증하지 않았다. 현재 심사 상태·완료 시각은 확인 필요다. 오래된 문서의 미제출 표기를 현재 사실로 덮어쓰지 않았으며 기존 문서도 수정하지 않았다.

기존 대화와 `docs/HERMES_DSYM.md`에는 일반 Release 빌드, UUID·DWARF·서명 검증 결과가 기록돼 있다. 이번 작업은 그 기록을 분석한 것이며 빌드·Archive·테스트를 새로 실행하지 않았다. GitHub 원격 main보다 앞선 3개 로컬 커밋이 존재한다는 사실과 TestFlight 제출 사실도 별개의 증거다.

## 재조회 방법과 남은 자료

앱 폴더에서 다음 읽기 전용 명령으로 재조회할 수 있다. 웹 `.git`를 고치지 않아도 앱 객체 저장소의 보존 브랜치를 확인할 수 있다.

```sh
git log main --reverse --format=fuller
git log web-legacy --reverse --format=fuller
git show 1d4390b3:design/splash_screen_prompt.txt
git show 851c81df -- App.tsx src/LibraryScreen.tsx
git show 8b89c033 -- src/components/ScreenHeader.tsx
git show 1860d692 -- scripts/hermes-dsym.sh docs/HERMES_DSYM.md
git ls-remote --heads origin
git ls-remote --tags origin
```

추가 보존·확인 필요: 최초 앱 제작 자료, 초기 AI 대화 원본, 자산별 생성/편집 기록, 확인된 웹 저장소 주소에 대한 과거 푸시 증거, 사용자 동일인 진술 외의 다른 참여자·권리 관계, 제3자 자산 이용 조건. 필요 시 Git 전체 객체를 보존하는 bundle 및 원본 파일의 별도 백업을 준비할 수 있으나, 이번 작업에서는 생성하거나 푸시하지 않았다.

이 문서 작성 전에 이미 `ios/build_test/`의 추적된 캐시·로그 변경이 있었다. 해당 변경은 이 문서 작업의 결과로 분류하지 않으며 손대지 않았다. 이번 작업의 신규 산출물은 `docs/copyright/`의 요청된 Markdown 세 파일뿐이다.
