# 문서별 파싱 규칙

서버가 spec-kit 문서를 어떻게 읽어 블록으로 만드는지, 그리고 화면이 각 블록을 어떻게 그리는지 적은 문서다. 파서는 `server/md.ts`와 `server/parsers.ts`, 프로젝트 스캔은 `server/scan.ts`, 화면은 `web/forms/`에 있다. OpenSpec과 Kiro 문서는 [OpenSpec](#openspec)과 [Kiro](#kiro) 절에 따로 적었다(`server/openspec.ts`, `server/kiro.ts`, `server/items.ts`). 아래의 공통 원칙과 전처리는 모든 형식에 같다. 전체 구조는 [설계 문서](design.md)를 본다.

## 공통 원칙

1. **내용을 버리지 않는다.** 규칙에 맞지 않는 부분은 `raw` 블록(원문 마크다운)이나 각 블록의 `rest`로 남겨 화면에 보여 준다. 숨기는 것은 HTML 주석뿐이다.
2. **파일 순서를 지킨다.** 블록은 문서에 나온 순서대로 나온다.
3. **파서가 실패해도 문서는 보인다.** 문서 종류별 파서에서 예외가 나면 문서 전체를 `raw` 블록 하나로 돌려준다.
4. **숫자는 직접 센다.** 문서에 적힌 요약 숫자가 아니라 체크박스와 항목을 세어 표시한다.
5. **문서의 글은 신뢰하지 않는다.** 원시 HTML은 글자로 보여 주고, 이미지는 불러오지 않는다.

## 블록 종류

파서의 결과는 `ParsedDoc`이다. 문서 제목(`title`), 머리 정보(`meta`), 블록 목록(`blocks`)을 가진다. 정의는 `server/types.ts`에 있다.

| 블록 | 담는 것 |
|---|---|
| `raw` | 제목(`heading`, 없을 수 있음), 제목 깊이, 원문 마크다운 |
| `stories` | 스토리 목록. 스토리마다 제목, 우선순위, `narrative`, `why`, `test`, 시나리오(`given`, `when`, `then`), `rest` |
| `idList` | 제목과 `{ id, text }` 항목 목록, `rest` |
| `phase` | 제목, 이름표 항목(`fields`), 체크박스 항목(`items`), `rest` |
| `fields` | 제목과 `{ label, value }` 항목 목록, `rest` |
| `cards` | 제목과 `{ title, markdown }` 카드 목록 |
| `decisions` | 결정 목록. 결정마다 제목, 이름표 항목, `rest` |
| `code` | 언어와 원문 글자 |
| `requirements` | OpenSpec과 Kiro의 요구사항. 제목, 깊이, 델타 종류(`op`: `ADDED`, `MODIFIED`, `REMOVED`, `RENAMED` 또는 없음), 첫 요구사항 앞의 글(`text`), 요구사항 목록, `rest`. 요구사항마다 번호, 제목, 사용자 스토리, 본문(`text`), 기준(`criteria`), `rest`. 기준마다 번호, 이름, 단계(`steps`: `{ key, text }`, `key`는 `GIVEN`, `WHEN`, `THEN`, `AND`, `IF` 등이나 빈 글자) |

`rest`와 이름표의 값은 모두 마크다운이다. 체크박스 항목에는 OpenSpec과 Kiro 문서에서만 `optional`(Kiro의 선택 작업)과 `notes`(항목 아래에 딸린 글)가 붙는다.

## 전처리

모든 마크다운 문서에 먼저 적용한다.

| 단계 | 규칙 |
|---|---|
| 정리 | 맨 앞의 BOM을 지우고, CRLF와 CR을 LF로 바꾸고, HTML 주석을 지운다. 코드 블록 안의 주석은 남는다 |
| 제목 | 첫 `#` 제목이 문서 제목이다 |
| 머리 정보 | 첫 `##` 앞에 있는 `**이름**: 값` 이름표가 `meta`가 된다 (예: Feature Branch, Created, Status) |
| 머리말 | 첫 `##` 앞의 나머지 글은 제목 없는 `raw` 블록이 된다 |
| 구획 | `##` 단위로 나누어 문서 종류별 규칙을 적용한다 |

### 이름표

`**이름**: 값` 꼴을 이름표라고 부른다. 쌍점은 굵은 글씨 밖에 있어야 한다.

| 규칙 | 내용 |
|---|---|
| 시작 | 줄 맨 앞이나 `\|` 바로 뒤의 `**이름**:`이 이름표다. 한 문단에 여러 개가 있으면 각각 나눈다 |
| 값 | 이름표 뒤부터 다음 이름표 전까지다. 뒤따르는 문단, 목록, 코드 블록도 빈 줄로 이어 값에 넣는다 |
| 값의 끝 | 구분선(`---`)을 만나면 값이 끝난다. 구분선 뒤의 글은 다음 이름표가 나올 때까지 `rest`로 간다 |
| 앞의 글 | 첫 이름표 문단보다 앞에 있는 글은 `rest`로 간다 |
| 줄 끝의 `\|` | 값 끝에 남은 `\|`는 뗀다 |

### 체크박스 항목

`- [ ]`, `- [x]`, `- [X]` 항목 하나가 `CheckItem` 하나다. 중첩된 항목도 센다.

| 표시 | 읽는 값 |
|---|---|
| `[x]`, `[X]` | `done` |
| 맨 앞의 `T001`, `CHK001`, `T006a` (대문자, 숫자, 소문자 접미 한 글자까지) | `id`. 없어도 항목으로 센다 |
| `[P]` | `parallel` |
| `[US1]` | `story` |
| 나머지 글 | `text` (위 표시는 뗀다) |

### 긴 문서와 캐시

| 대상 | 규칙 |
|---|---|
| 65,536자를 넘는 문서 | 32,768자 이상씩, 줄 맨 앞의 제목 줄에서 잘라 조각별로 파싱한다. 자른 자리의 제목 줄이 제목으로 읽히지 않으면(열린 코드 블록이나 HTML 블록 안이면) 조각을 다음 제목 줄까지 늘린다 |
| 참조 정의(`[이름]: 주소`)가 있는 문서 | 길어도 통째로 파싱한다 |
| 마지막 파싱 결과 | 같은 글을 다시 파싱하면 직전 결과를 그대로 쓴다 |
| 스캔 결과 | 파일 하나에서 계산한 값(작업 수, 열린 질문 수, 헌법 값, README 소개)을 프로젝트 경로, 파일 경로, 내용 해시별로 5000개까지 보관한다 |
| 파싱한 문서 | `/api/doc`가 보내는 JSON을 프로젝트 경로, 파일 경로, 내용 해시별로 글자 수 합계 약 64 MB까지 보관한다 |

두 보관소 모두 한도를 넘으면 가장 오래 쓰지 않은 것부터 내보낸다. 스캔할 때마다 파일을 읽고 해시를 계산하는 일은 그대로 하고, 내용이 바뀐 파일만 다시 파싱한다.

## 파일을 문서 종류로 나누는 규칙

이 절과 아래 1~6절은 spec-kit이다. `specs/` 바로 아래 폴더 하나가 기능 하나다. 기능 폴더를 하위 폴더까지 훑되 심볼릭 링크와 점으로 시작하는 이름은 건너뛴다. `.md` 파일과 `contracts/` 아래의 모든 파일만 읽는다.

| 경로 | 종류 | 단계 |
|---|---|---|
| `.specify/memory/constitution.md` | `constitution` | 1 헌법 |
| `specs/<기능>/spec.md` | `spec` | 2 명세 |
| `specs/<기능>/plan.md` | `plan` | 3 계획 (대표 문서) |
| `specs/<기능>/research.md`, `data-model.md`, `quickstart.md` | `research`, `data-model`, `quickstart` | 3 계획 (딸린 문서) |
| `specs/<기능>/contracts/` 아래 모든 파일 | `contract` | 3 계획 (딸린 문서) |
| `specs/<기능>/tasks.md` | `tasks` | 4 작업 분해, 5 구현 |
| `specs/<기능>/checklists/<이름>.md` | `checklist` | 6 완료 |
| 그 밖의 `.md` | `other` | 단계 없음. 기능의 문서 목록에서 연다 |

기능의 문서는 spec, plan, research, data-model, quickstart, contract, tasks, checklist, other 순서로, 같은 종류 안에서는 경로순으로 늘어놓는다.

## 프로젝트 정보

`/api/project`가 돌려주는 값 가운데 문서에서 읽는 것이다.

### README 소개

| 규칙 | 내용 |
|---|---|
| 파일 | 프로젝트 루트의 `README.md`. 이름의 대소문자는 가리지 않는다. 심볼릭 링크는 읽지 않는다 |
| 읽는 양 | 앞 64 KB만 읽는다. 파일이 더 길면 마지막 빈 줄 뒤의 잘린 블록은 버린다 |
| 고르는 문단 | 글자가 있는 첫 문단. 제목, 배지와 이미지만 있는 줄, HTML은 건너뛴다 |
| 글 | 서식을 뗀 글자만 남긴다. 링크는 글자만 남고, 공백은 한 칸으로 줄인다 |
| 길이 | 코드 포인트 300개를 넘으면 낱말 경계에서 자르고 `…`를 붙인다 |
| 없을 때 | README가 없거나 읽을 수 없거나 글 문단이 없으면 소개를 표시하지 않는다 |

### 헌법 값과 원칙 제목

| 값 | 규칙 |
|---|---|
| 버전, 제정일, 개정일 | 아래 "버전 줄" 규칙으로 읽은 `Version`, `Ratified`, `Last Amended`. 값이 비어 있으면 없는 것으로 본다 |
| 원칙 제목 | `## Core Principles`로 시작하는 구획의 `###` 제목. 서식을 뗀 글자만 남긴다 |
| 원칙 번호 | 제목 앞의 `I.`, `IV)`, `3.` 같은 번호는 뗀다. 번호로 보는 것은 I, V, X로 된 로마 숫자와 아라비아 숫자뿐이다. `C. Consistency`는 제목 그대로 둔다 |
| 빈 제목 | 글자가 없는 제목은 목록에서 뺀다 |

### 작업 수와 열린 질문

| 값 | 규칙 |
|---|---|
| 작업 수 | `tasks.md`의 체크박스 항목을 모두 센다. `##` 구획 밖에 있는 항목도 센다 |
| 열린 질문 | `spec.md`와 `plan.md`에 나오는 `NEEDS CLARIFICATION`의 개수. 대괄호가 없어도 센다. HTML 주석 안의 것은 세지 않는다 |

## 1. constitution.md

### 버전 줄

스캐너와 문서 파서가 같은 함수(`stamp`)로 읽으므로 보드와 헌법 페이지의 값이 같다.

```markdown
**Version**: 1.1.0 | **Ratified**: 2026-02-09 | **Last Amended**: 2026-06-15
```

| 규칙 | 내용 |
|---|---|
| 찾기 | 줄 맨 앞이나 `\|` 뒤에 `**Version**:`, `**Ratified**:`, `**Last Amended**:` 가운데 하나가 있는 줄 |
| 값 | 이름표 뒤부터 다음 `\|`나 줄 끝까지. 다음 줄이나 다음 블록은 값에 넣지 않는다 |
| 위치 | `## Governance` 같은 제목 아래에 있어도, 제목 없이 원칙 구획 끝에 있어도 읽는다 |
| 남는 글 | 그 줄에서 이름표가 아닌 부분과 같은 문단의 다른 줄은 `rest`로 남는다 |

### 구획

| 표시 | 블록 |
|---|---|
| `## Core Principles` 아래 `###` | `cards`. 원칙 하나가 카드 하나다. `##`와 첫 `###` 사이의 글은 `raw` |
| 원칙 구획 안의 버전 줄 | 제목이 빈 `fields` 블록으로 따로 나온다. 원칙 카드에는 원칙의 글만 남는다 |
| 그 밖의 `##` 중 이름표나 버전 줄이 있는 구획 | `fields`. 버전 줄 뒤의 글은 `rest` |
| 나머지 `##` | `raw` |

### 화면

| 블록 | 그리는 것 |
|---|---|
| `cards` | 번호가 붙은 원칙 판. 제목에 `IV.`나 `2.` 같은 번호가 있으면 그 번호를, 없으면 순서를 쓴다 |
| `fields`의 Version, Ratified, Last Amended | 원칙 수와 함께 맨 위의 큰 값. 이름표만 있고 값이 없으면 "없음"으로 표시한다 |
| `fields`의 나머지 항목 | 구획별 항목표 |

## 2. spec.md

### 구획

| 표시 | 블록 |
|---|---|
| `##` | 제목은 `raw` 블록으로 항상 남는다. 첫 `###` 앞의 글이 그 블록의 내용이다 |
| 스토리 제목인 `###` | 스토리. 이어진 스토리들이 `stories` 블록 하나가 된다 |
| 그 밖의 `###` | `**FR-001**: …` 꼴 목록 항목이 하나라도 있으면 `idList`, 없으면 `raw` |
| `###` 아래 `####` | `####`마다 따로 `idList` 또는 `raw`. `###`와 첫 `####` 사이의 글도 한 블록이 된다 |

`idList`의 ID는 `**대문자-숫자**:` 꼴이다(`FR-001`, `SC-003`, `NFR-012a`). 이 꼴이 아닌 목록 항목과 목록 밖의 글은 그 블록의 `rest`로 간다.

### 스토리 제목

| 꼴 | 예 |
|---|---|
| `User Story N - 제목 (Priority: P1)` | `### User Story 1 - Find a tool (Priority: P1)` |
| `US-N: 제목` | `### US-1: Basic Multi-File Concatenation` |

번호와 제목 사이에는 `-`, `–`, `—`, `:` 가운데 하나가 온다. `(Priority: …)`는 어느 꼴에서든 있으면 읽고, 없으면 우선순위가 없다.

### 스토리 본문

두 가지 쓰기 방식을 모두 읽는다.

```markdown
### User Story 1 - Find a tool (Priority: P1)

A member searches the catalog.

**Why this priority**: Nothing else works without it.

**Independent Test**: Search for "drill" and see the result.

**Acceptance Scenarios**:

1. **Given** a catalog, **When** I search "drill", **Then** drills are listed
```

```markdown
### US-1: Basic Multi-File Concatenation
**As a** DevOps engineer
**I want to** process multiple log files in a single command
**So that** I can view logs in one stream

**Acceptance Criteria:**
- Given multiple log files
- When I run `hl file1.log file2.log`
- Then all logs are displayed
- And the order is preserved
```

| 표시 | 규칙 |
|---|---|
| `**As a**`, `**As an**`, `**I want**`, `**I want to**`, `**So that**`으로 시작하는 문단 | 스토리의 `narrative` |
| `**Why this priority**:` | `why` (처음 나온 것) |
| `**Independent Test**:` | `test` (처음 나온 것) |
| `**Acceptance Scenarios**:` 또는 `**Acceptance Criteria**:` 이름표 | 값의 목록을 시나리오로 읽는다 |
| `**Acceptance Criteria:**`로 끝나는 문단 바로 뒤의 목록 | 그 목록을 시나리오로 읽는다. 쌍점이 굵은 글씨 안에 있어도 된다 |
| 그 문단에서 수용 기준 줄 위에 있는 이름표 줄 | 이름표로 읽는다 (빈 줄 없이 붙여 쓴 경우) |
| 그 밖의 이름표 | `rest`에 `**이름**: 값`으로 남는다 |
| 두 번째 수용 기준 이름표 | 시나리오로 읽지 않고 `rest`에 남는다 |
| 이름표 밖의 글 | `rest` |

### 시나리오

목록 항목 하나에 세 절이 모두 있는 방식과, 항목 하나에 절 하나를 쓰는 방식을 함께 읽는다.

| 규칙 | 내용 |
|---|---|
| 한 항목에 세 절 | `Given … When … Then …` 순서로 나눈다. 굵은 키워드(`**Given**`)를 먼저 찾으므로, 절 안에 굵지 않은 `Then`이 있어도 거기서 나뉘지 않는다 |
| 굵지 않은 키워드 | 첫 글자가 대문자인 `Given`, `When`, `Then`만 키워드다. 절 안의 소문자 `when`에서는 나뉘지 않는다 |
| 키워드 뒤의 문장 부호 | 키워드 바로 뒤의 쌍점이나 쉼표 하나는 뗀다. `When`과 `Then` 앞의 쉼표도 뗀다 |
| 한 항목에 한 절 | `Given`으로 시작하는 항목이 새 시나리오를 연다. `When`, `Then` 항목이 빈 칸을 채운다. 굵은 글씨와 대소문자는 가리지 않는다 |
| `And`, `But` 항목 | 바로 앞 절에 빈 줄을 두고 이어 붙인다. `And`, `But`을 포함해 적힌 그대로 붙인다 |
| 이미 찬 칸 | `When`이나 `Then`이 두 번 나오면 두 번째 항목은 `rest`로 간다. 그 뒤의 `And`, `But`도 `rest`로 간다 |
| 혼자 남은 `Given` | `When`도 `Then`도 얻지 못한 `Given`은 시나리오가 아니다. 적힌 그대로 `rest`에 남는다 |
| 키워드로 시작하지 않는 항목, 목록 밖의 글 | 적힌 그대로 `rest`에 남는다 |

### 화면

| 블록 | 그리는 것 |
|---|---|
| 전체 | 스토리 수, 시나리오 수, 요구사항 수, 성공 기준 수, 열린 질문 수 |
| `stories` | 스토리마다 우선순위, 제목, `narrative`, `why`, `test`, 시나리오별 Given → When → Then 세 칸, `rest` |
| ID가 `SC`로 시작하지 않는 `idList` | 요구사항. 묶음별 개수 막대와 항목. `NEEDS CLARIFICATION`이 있는 항목은 표시한다 |
| ID가 `SC`로 시작하는 `idList` | 성공 기준 |
| 나머지 (Edge Cases, Key Entities, Assumptions 등) | 문서 끝의 "원문 블록 더 있음" 아래 |

## 3. plan.md와 딸린 문서

### plan.md

| 표시 | 블록 | 화면 |
|---|---|---|
| `## Summary` | `raw` | 맨 위의 요약 |
| `## Technical Context`의 이름표 | `fields` | 기술 맥락 항목표 |
| `## Constitution Check` | `raw` | 헌법 점검. 표는 표로 그린다 |
| `## Project Structure` | `raw` | 프로젝트 구조. 코드 블록의 폴더 구조를 코드로 그린다 |
| 나머지 `##` | `raw` | 문서 끝의 "원문 블록 더 있음" 아래 |

구획 이름은 정확히 같아야 한다. 이름표가 하나도 없는 `Technical Context`는 `raw`로 남는다.

### research.md

| 표시 | 블록 |
|---|---|
| `**Decision**:` 이름표가 있는 `###` 구획 | 결정 하나. 구획의 이름표가 모두 결정의 `fields`가 된다 |
| `###` 없이 `##` 바로 아래에 `**Decision**:`이 있는 구획 | 결정 하나. 제목은 `##` 제목이다 |
| `###`를 가진 `##` | 제목은 `raw` 블록으로 남는다 |
| `Decision`이 없는 구획 | `raw` |

이어진 결정들이 `decisions` 블록 하나가 된다. 화면은 결정마다 왼쪽에 Decision과 Rationale, 오른쪽에 Alternatives Considered를 그린다. Question 이름표가 있으면 제목 아래에 쓴다. 그 밖의 이름표는 이름과 함께 오른쪽에 쓴다. 대안이 없는 결정은 "기각된 대안 기록 없음"으로 표시한다.

### data-model.md

| 표시 | 블록 | 화면 |
|---|---|---|
| `## Entities`로 시작하는 구획의 `###` | `cards`. 엔티티 하나가 카드 하나, 내용은 마크다운 | 엔티티 카드. 카드 안의 표와 코드는 그대로 그린다 |
| `## Relationships` | `raw` | 관계 구획 |
| 나머지 `##` | `raw` | 문서 끝의 "원문 블록 더 있음" 아래 |

엔티티의 필드를 표나 코드에서 뽑아내지는 않는다.

### quickstart.md

전용 파서가 없다. `##` 구획이 그대로 `raw` 블록이 되고, 화면은 구획마다 번호를 붙인 단계로 그린다.

### contracts/*

| 파일 | 블록 | 화면 |
|---|---|---|
| `.md`가 아닌 파일 | `code` 하나. 확장자가 언어다. 전처리를 하지 않는다 | 코드 보기 |
| `.md` | `##`마다 `raw` | 구획별 마크다운 |

## 4·5. tasks.md

| 표시 | 블록 |
|---|---|
| 체크박스 항목이 있는 `##` | `phase`. 제목이 단계 이름이다 |
| 체크박스 항목 | `items`의 항목 하나 ([체크박스 항목](#체크박스-항목) 규칙) |
| 단계 안의 `**Goal**:`, `**Purpose**:`, `**Checkpoint**:` 등 | 단계의 `fields`. 하위 제목이 나오면 그 앞 이름표의 값이 끝난다 |
| 하위 제목, 체크박스가 아닌 목록 항목, 그 밖의 글, 체크박스 항목 아래의 코드 블록과 체크박스가 아닌 하위 목록 | 단계의 `rest`. 파일 순서대로 |
| 체크박스 항목이 없는 `##` | `raw` |

같은 문서를 두 단계에서 다르게 그린다.

| 단계 | 그리는 것 |
|---|---|
| 4 작업 분해 | 구조. 단계 수, 작업 수, 병렬 작업 수, 스토리 수. 단계마다 Goal(없으면 Purpose), 작업 하나에 표시 하나(채움 = 끝남, 테두리 = 남음), 이어진 `[P]` 작업은 한 열에 쌓음, 단계의 첫 스토리 꼬리표, 끝난 수 / 전체. 작업 글과 나머지 이름표, `rest`는 펼쳐서 본다 |
| 5 구현 | 진행. 끝난 수 / 전체와 백분율(내림), 모든 작업의 칸, 다음 명령, 단계별로 남은 작업, 스토리별 진행. "다음 차례"는 남은 작업이 있는 첫 단계의 남은 작업이다 |

구현 페이지의 전체 수는 스캔이 센 값이다. `##` 구획 밖에 있는 체크박스는 칸이 없으므로, 그런 작업이 있으면 몇 개인지 따로 적는다.

제목의 이모지(예: 끝난 단계의 ✅)는 화면 제목에서만 뺀다.

## 6. checklists/*.md

`tasks.md`와 같은 규칙으로 읽는다. `##`이 묶음, 체크박스가 항목이다. 화면은 확인한 수 / 전체, 묶음 수, 기능의 단계와 작업 수를 쓰고, 묶음별로 항목을 그린다. 체크리스트가 여러 개면 문서 위쪽에서 고른다.

## 종류를 모르는 `.md`

`##` 구획이 그대로 `raw` 블록이 된다. 화면은 구획마다 한 장씩 원문 순서대로 그린다.

## OpenSpec

### 파일

| 경로 | 종류 | 단계 |
|---|---|---|
| `openspec/specs/**/spec.md` (기능 영역 폴더 안) | `capability` | 1 스펙 |
| `openspec/config.yaml`, `openspec/project.md` | `context` | 1 스펙 |
| `openspec/changes/<변경>/proposal.md` | `proposal` | 2 제안 |
| `openspec/changes/<변경>/specs/**/spec.md` | `delta` | 2 제안(탭), 6 보관 |
| `design.md` | `design` | 3 설계 |
| `tasks.md` | `tasks` | 4 작업 분해, 5 적용 |
| 변경 폴더의 그 밖의 `.md` | `other` | 단계 없음 |

`openspec/changes/` 아래 폴더(`archive` 제외)가 변경 하나, `openspec/changes/archive/` 아래 폴더가 보관된 변경 하나다(아이디는 `archive/<날짜>-<이름>`). 점으로 시작하는 폴더와 심볼릭 링크는 건너뛰고, `.md`만 읽는다(`config.yaml`은 예외). 변경은 이름순, 보관된 변경은 최신순이다.

| 조건 | 단계 |
|---|---|
| `archive/` 아래에 있음 | 보관 |
| 체크된 작업이 하나 이상 (모두 체크돼도 보관 전까지) | 적용 |
| `tasks.md`가 있음 | 작업 분해 |
| `design.md`가 있음 | 설계 |
| 그 외 | 제안 |

### spec.md (주 스펙과 델타 스펙)

| 표시 | 블록 |
|---|---|
| `## Requirements` 또는 `## ADDED/MODIFIED/REMOVED/RENAMED Requirements` (대소문자 무관) | `requirements`. 델타 구획의 종류가 `op`, 첫 `###` 앞의 글이 `text` |
| 그 아래 `### Requirement: 이름` | 요구사항 하나. 첫 `####` 앞의 글이 본문 |
| `#### Scenario: 이름` | 기준 하나. 목록 항목마다 단계 하나. `**WHEN**`, `WHEN:` 등 앞의 키워드(굵게 써도, 대소문자 달라도)가 `key`, 나머지가 `text`. 키워드가 없는 항목과 목록 밖의 글은 `key`가 빈 단계 |
| `Requirement:`가 아닌 `###`, `Scenario:`가 아닌 `####` | 제목 줄과 함께 그 블록이나 요구사항의 `rest` |
| `RENAMED` 구획의 `FROM:` / `TO:` 줄 | 그 구획의 `text`. 화면은 `TO:` 줄 수를 이름 변경 수로 센다 |
| 그 밖의 `##` (`Purpose` 등) | `raw` |

### tasks.md

`##` 구획마다 체크박스가 있으면 `phase` 하나다. `[ ]`, `[x]` 밖에 `[~]`, `[]`, `[ x ]`처럼 한 글자 표시도 작업으로 세고, `x`/`X`만 끝난 것이다(OpenSpec과 같은 규칙). 맨 앞의 `1.1` 같은 번호가 `id`, 중첩된 하위 작업도 모두 센다. 작업 아래의 체크박스가 아닌 글은 그 작업의 `notes`, 구획 안의 그 밖의 글은 `rest`다. 첫 `##` 앞에 쓴 작업 목록도 문서 제목을 이름으로 한 `phase`가 된다. `[Some link](…)` 같은 링크 항목은 작업이 아니다.

### proposal.md, design.md, config.yaml

`proposal.md`는 `##` 구획마다 `raw`다. `design.md`는 `## Decisions`(또는 `Key/Architecture/Design/Technical Decisions`)와 `## Correctness Properties` 아래의 `###`를 `cards`로, 나머지 구획을 `raw`로 만든다. `config.yaml`은 `.md`가 아니므로 `code` 하나다.

## Kiro

### 파일

| 경로 | 종류 | 단계 |
|---|---|---|
| `.kiro/steering/**/*.md` | `context` | 1 스티어링. `product.md`, `tech.md`, `structure.md`가 먼저, 나머지는 경로순 |
| `.kiro/specs/<스펙>/requirements.md`, `bugfix.md` | `requirements` | 2 요구사항 |
| `design.md` | `design` | 3 설계 |
| `tasks.md` | `tasks` | 4 작업 분해, 5 구현, 6 완료 |
| 스펙 폴더의 그 밖의 `.md` (cc-sdd의 `research.md` 등) | `other` | 단계 없음 |

`.kiro/specs/` 아래 폴더 하나가 스펙 하나다. `spec.json`처럼 `.md`가 아닌 파일은 읽지 않는다. 단계는 spec-kit과 같은 규칙에서 `plan.md` 대신 `design.md`를 보고, 작업 수는 선택 작업(`- [ ]*`)을 빼고 센다.

### 스티어링 파일

맨 앞의 YAML 앞머리(`---`로 둘러싼 줄)에서 `이름: 값` 줄은 머리 정보가 되고(값은 코드로 보인다), 그 밖의 줄은 `yaml` `code` 블록으로 남는다. 본문은 일반 문서처럼 `##`마다 `raw`다.

### requirements.md와 bugfix.md

| 표시 | 블록 |
|---|---|
| `### Requirement N` 또는 `### Requirement N: 제목` | 요구사항 하나. `N`이 번호, 제목이 없으면 머리 글 전체가 제목 |
| `**User Story:**` 또는 `**Objective:**`(cc-sdd)로 시작하는 문단 | 사용자 스토리 |
| `#### Acceptance Criteria` 아래 목록 | 항목마다 기준 하나. 번호는 `<요구사항 번호>.<목록 번호>` |
| EARS 문장 | `WHEN`/`IF`/`WHILE`/`WHERE`로 시작하면 조건과 응답 두 단계로 나눈다. 응답은 `THEN` 뒤, 또는 `, THE`나 ` THE` 앞에서 시작한다(응답 단계의 `key`는 `THEN`). 키워드는 대문자일 때만 읽는다. 조건이 없는 문장(`THE … SHALL …`)과 그 밖의 문장은 `key`가 빈 단계 하나 |
| `Requirement N`이 아닌 `###`에 EARS 줄(문단이나 목록 항목, 앞에 `1.1` 같은 번호가 있어도 된다)이 있음 | 그 `###`가 기준 묶음 하나. bugfix의 `### Current Behavior (Defect)` 등 |
| EARS 줄이 없는 `###`, 그 밖의 `####` | 제목 줄과 함께 `rest` |
| 그 밖의 `##` (`Introduction`, `Glossary` 등) | `raw` |

### tasks.md

체크박스 표시는 OpenSpec과 같고, `- [ ]*`는 선택 작업, `- [-]`는 진행 중인 작업(끝나지 않은 것으로 센다)이다. 번호가 붙은 최상위 작업(`- [ ] 1.`)이 `phase` 하나이고, 그 아래에 중첩되거나 같은 들여쓰기로 이어 쓴 `1.1` 같은 하위 작업(cc-sdd)이 항목이다. 하위 작업이 있는 작업의 자기 체크박스는 세지 않고, 그 아래 글은 `phase`의 `rest`다. 하위 작업이 없는 최상위 작업은 그 자체가 자기 `phase`의 항목이고, 구획 안의 어떤 작업에도 하위 작업이 없으면 구획 전체가 `phase` 하나다. 번호 뒤의 `(P)`는 병렬 표시다. 작업 아래의 세부 목록과 `_Requirements: …_`는 그 작업의 `notes`다.

### 화면

| 문서 | 그리는 것 |
|---|---|
| `requirements` 블록이 있는 문서 (`capability`, `delta`, `requirements`) | 요구사항 수, 시나리오(이름이 있을 때)나 기준 수, 델타 종류별 수. 그다음 모든 블록을 원문 순서대로. 요구사항은 카드로: 번호, 델타 종류, 제목, 사용자 스토리, 본문, 기준마다 번호·이름과 단계 |
| `design` | 구획 수, 결정 수, Mermaid 도표 수. 그다음 모든 블록을 원문 순서대로 |
| `proposal`, `context` | 원문의 구획 순서대로 |
| `tasks` | spec-kit과 같은 작업 분해·진행 화면. 선택 작업은 점선 표시와 꼬리표로 보이고 세지 않는다. 작업의 `notes`는 작업 글 아래에 보인다. OpenSpec에서 작업이 모두 끝나면 다음 명령으로 보관 명령을 보여 준다 |

## 화면이 블록을 놓치지 않는 방법

| 경우 | 화면 |
|---|---|
| 문서 종류의 화면이 그리지 않은 블록 | 문서 끝의 "원문 블록 더 있음"을 펼치면 모두 나온다 |
| 기대한 구조가 하나도 없는 문서 | 틀을 따르지 않았다고 알리고, 원문의 구획 순서대로 그린다 |
| 화면이 따로 없는 종류 (`contract`의 `.md`, `other`) | 원문의 구획 순서대로 그린다 |

마크다운을 그릴 때의 규칙은 [설계 문서의 보안 경계](design.md#보안-경계)에 있다.
