# spec-visualizer

[English](README.md) | 한국어

[GitHub spec-kit](https://github.com/github/spec-kit) 프로젝트를 보여 주는 로컬 읽기 전용 대시보드다.
스펙 주도 개발의 여섯 단계를 보드 하나에 펼치고, 어느 기능이 어느 단계에 있으며 다음에 무엇을 입력하면 되는지 보여 준다. 스펙 문서는 마크다운을 그대로 그리지 않고 문서 종류에 맞는 페이지로 보여 준다.

![단계 카드 여섯 장이 놓인 보드에서 카드 하나를 눌러 그 단계의 문서 페이지로 들어가는 모습](docs/media/board-to-document.gif)

## 설치

Node.js 20 이상이 필요하다.

```sh
npx spec-visualizer            # 현재 폴더의 spec-kit 프로젝트
npx spec-visualizer --demo     # 둘러볼 수 있는 예제 프로젝트
```

주소(기본값 `http://127.0.0.1:4321`)를 출력하고 브라우저에서 연다. 폴더에 `specs/`나 `.specify/`가 있어야 한다.

### Claude Code 플러그인

플러그인은 Claude Code 세션에서 같은 대시보드를 시작하고, 열고, 멈춘다. Claude Code에서 다음을 입력한다.

```text
/plugin marketplace add josephleee/spec-visualizer
/plugin install spec-visualizer@spec-visualizer
```

셸에서는 `claude plugin install spec-visualizer --marketplace josephleee/spec-visualizer` 한 줄로 둘을 함께 한다.

그다음 spec-kit 프로젝트에서 `/spec-visualizer:dashboard`를 실행한다(멈출 때는 `/spec-visualizer:dashboard stop`). Claude에게 스펙 현황을 보여 달라고 해도 된다.

## 사용법

```sh
spec-visualizer [path] [options]
```

경로를 생략하면 현재 폴더를 쓴다. 파일이 바뀌면 화면이 스스로 갱신된다. 화면은 한국어와 영어를 지원하고(위쪽 띠 오른쪽의 전환 버튼), 시스템의 밝은 / 어두운 설정을 따른다.

| 옵션 | 기본값 | 뜻 |
|---|---|---|
| `--port <n>` | `4321` | 들을 포트. 이 옵션이 없으면 포트가 사용 중일 때 다음 빈 포트로 넘어간다(4330까지). 이 옵션을 주면 사용 중인 포트는 오류다. |
| `--demo` | | 경로 대신 함께 들어 있는 예제 프로젝트(`examples/demo`)를 보여 준다. |
| `--no-open` | | 브라우저를 열지 않는다. 출력이 터미널이 아닐 때도 열지 않는다. |
| `--help`, `--version` | | 사용법이나 버전을 출력한다. |

## 보드

첫 화면은 단계 카드 여섯 장이 놓인 보드다. 단계는 헌법, 명세, 계획, 작업 분해, 구현, 완료다. 카드마다 그 단계의 명령, 여기 있는 기능 수와 지나간 기능 수, 여기 서 있는 기능의 링크, 그 단계가 남기는 문서, 그 기능들에 입력할 다음 명령과 복사 버튼이 있다. 헌법 카드는 원칙 목록을 보여 준다. 끝나지 않은 작업이 있는 기능이 서 있는 단계는 초록색으로 그린다.

보드 위의 어두운 띠에는 프로젝트 이름(과 `README.md`의 첫 문단), 작업 진행률, 끝난 기능 수, 진행 중인 기능의 다음 명령이 있다.

마지막으로 연 뒤에 새로 생기거나 바뀐 문서가 있는 기능에는 표시가 붙는다. 표시는 브라우저의 로컬 저장소에 프로젝트 폴더별로 저장한다. 프로젝트를 처음 열 때는 모든 문서를 이미 본 것으로 친다.

## 단계 페이지

카드나 기능을 누르면 그 단계의 문서로 들어간다(`#/stage/<단계>/<기능>`). 위쪽 막대로 보드에 돌아가고, 여섯 단계 사이를 옮기고, 기능을 바꾼다. 왼쪽 차례는 읽고 있는 구획을 따라간다. 기능이 아직 그 단계에 이르지 않았으면, 기능이 지금 어디에 있고 어떤 명령이 그 문서를 만드는지 알려 준다.

| 단계 | 파일 | 보여 주는 모습 |
|---|---|---|
| 1 헌법 | `.specify/memory/constitution.md` | 번호가 붙은 원칙 판, 버전과 제정일과 개정일, 항목표 |
| 2 명세 | `specs/<기능>/spec.md` | 개수, 우선순위와 서술이 있는 사용자 스토리, 시나리오별 Given → When → Then, 요구사항 묶음과 개수 막대, 성공 기준, 열린 질문(`NEEDS CLARIFICATION`) |
| 3 계획 | `specs/<기능>/plan.md` | 요약, 항목표로 그린 Technical Context, 표는 표로, 폴더 구조는 코드로 |
| | `research.md` | 결정마다 그 옆에 기각된 대안 |
| | `data-model.md` | 엔티티 카드 |
| | `quickstart.md` | 구획을 번호가 붙은 단계로 |
| | `contracts/*` | `.md`는 마크다운, 그 밖은 코드 보기 |
| 4 작업 분해 | `specs/<기능>/tasks.md` | 구조: 단계, 작업 하나에 표시 하나(채움 = 끝남, 테두리 = 남음), 병렬 `[P]` 작업은 쌓아서, 스토리 꼬리표, 작업 글은 펼쳐서 |
| 5 구현 | 같은 `tasks.md` | 진행: 끝난 수 / 전체, 모든 작업의 칸, 단계별·스토리별로 남은 것, 다음 명령 |
| 6 완료 | `specs/<기능>/checklists/*.md` | 묶음별 항목과 개수. 체크리스트가 여럿이면 고르는 버튼 |

기능 폴더의 그 밖의 `.md`는 `other` 문서다. 기능의 페이지에서 링크로 열고 구획별로 보여 준다(`#/doc/<경로>`). `contracts/` 밖에서는 `.md` 파일만 읽는다.

## 문서를 읽는 방법

서버가 마크다운 파서로 문서를 읽어, 알아본 부분(사용자 스토리, 시나리오, 요구사항 목록, 작업 단계, 이름표 항목, 결정, 엔티티)을 종류가 있는 블록으로 만들고, 브라우저가 그 블록을 그린다. AI를 쓰지 않으므로 페이지는 언제나 파일의 지금 내용을 보여 준다.

내용은 버리지 않는다. 규칙에 맞지 않는 부분은 마크다운으로 남기고, 페이지가 그리지 않은 부분은 페이지 끝에 접어 두며, 템플릿을 따르지 않은 문서는 원문 순서대로 보여 준다. 예외는 HTML 주석 하나이고, 주석은 숨긴다.

문서 종류별 정확한 규칙은 [docs/parsing-rules.md](docs/parsing-rules.md)에, 도구 전체의 설계는 [docs/design.md](docs/design.md)에 있다.

## 보안

- **로컬 전용.** 서버는 `127.0.0.1`에서만 듣고, `Host`가 `127.0.0.1:<포트>`나 `localhost:<포트>`인 요청에만 답한다.
- **읽기 전용.** 보여 주는 프로젝트에 쓰지 않고, `GET` 요청만 받는다.
- **스캔이 찾은 것만.** `specs/`와 `.specify/`를 스캔해 찾은 문서만 준다. 심볼릭 링크는 따라가지 않는다.
- **문서 내용은 신뢰하지 않는다.** 마크다운 안의 원시 HTML은 실행하지 않고 글자로 보여 준다. 이미지는 불러오지 않고 대체 글과 주소를 보여 준다. `http`, `https`, `#` 링크만 따라갈 수 있다.

## 하지 않는 것

- 문서 편집, 체크박스 체크
- 갱신된 문서에서 바뀐 부분 강조
- 다른 형식 읽기 (OpenSpec, Kiro 등)
- 여러 프로젝트를 한 번에 보기
- AI로 페이지 생성
- 정적 HTML 내보내기, 대시보드 호스팅, 로그인
- 엔티티 관계를 그래프로 그리기

## 개발

Node.js 24 이상을 쓴다. TypeScript 소스를 바로 실행한다.

```sh
git clone https://github.com/josephleee/spec-visualizer.git
cd spec-visualizer
npm install
npm test              # vitest
npx tsc --noEmit      # 타입 검사
npm run build         # 화면 파일은 dist/web 으로, 서버는 JavaScript 로 dist/server 에
npm start -- --demo   # TypeScript 소스에서 실행. `npm run build` 를 한 번 해서 화면 파일이 있어야 한다
npm start -- <path>   # 같은 방법으로 자기 프로젝트를 연다
```

`npm run dev`는 Vite로 화면 소스를 띄우고 `/api` 요청을 4321 포트의 서버로 넘긴다.

배포하는 패키지는 `dist/server/cli.js`를 실행하며 `dist/server`, `dist/web`, `examples/demo`를 담는다. Claude Code 플러그인은 `plugin/`에 있고, `.claude-plugin/marketplace.json`이 이 저장소를 그 플러그인의 마켓플레이스로 만든다. 변경 내역은 [CHANGELOG.md](CHANGELOG.md)에 있다.

## 라이선스

[MIT](LICENSE)

## 기여

빌드와 테스트 방법은 [CONTRIBUTING.md](CONTRIBUTING.md), 취약점 제보는 [SECURITY.md](SECURITY.md), 버전 규칙은 [RELEASING.md](RELEASING.md), 변경 내역은 [CHANGELOG.md](CHANGELOG.md)에 있다.
