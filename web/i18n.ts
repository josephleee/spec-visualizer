import { useSyncExternalStore } from 'react'
import { bootFlow, type Unit } from './flows.ts'

export type Lang = 'en' | 'ko'

// Every string the UI shows. {0}, {1}… are filled by the arguments of t().
const LABELS = {
  en: {
    'n.constitution': 'Constitution', 'n.specify': 'Specify', 'n.plan': 'Plan', 'n.tasks': 'Tasks', 'n.implement': 'Implement', 'n.done': 'Done',
    'f.stages': 'Stages', 'f.stages.u': 'stages', 'f.tasks': 'Tasks', 'f.feats': 'Features', 'f.done': 'done',
    nextcmd: 'Next command', copy: 'Copy', copied: 'Copied',
    'strip.left': '{0} · {1} {1:task|tasks} left', 'strip.at': '{0} · now at {1}', 'strip.new': 'Every feature is finished. A new one starts with this', 'strip.empty': 'No features yet. Start the first one', 'strip.const': 'No constitution yet. Set the principles first',
    title: '{0} spec board', board: '{0} project board', language: 'Language', project: 'Project',
    zone: 'Six SDD stages',
    'zone.empty': 'No features in this project yet. Type {0} to write the first specification',
    live: 'In progress', nocmd: 'No command', 'cmd.stage': 'Stage command',
    here: 'Here', passed: 'Passed', principles: 'Principles', follows: 'Features',
    'feat.here': 'Features here', 'feat.none': 'No feature is standing here', 'more.n': '+{0} more', fold: 'Show fewer',
    'pr.none': 'No constitution yet', docs: 'Documents at this stage',
    'g.move': 'Moves {0} {0:feature|features} on to {1}', 'g.clarify': '{0} with open questions: {1} first', 'g.impl': 'Continue with the {0} {0:task|tasks} left',
    'g.wait': 'Nothing here yet. Type it when a feature arrives', 'g.new': '{0} finished. A new feature starts here',
    'g.first': 'With principles set, specify a feature', 'g.const': 'No constitution yet. Set the principles first',
    new: 'New', changed: 'Changed',
    back: 'Back to board', 'bar.stages': 'Stages', 'bar.feature': 'Feature', 'bar.first': '← First', 'bar.last': 'Last →', nodoc: 'no document',
    toc: 'On this page', 'toc.none': 'No sections on this page', 'doc.layer': 'Stage document',
    'h.cmd': 'Command typed at this stage', 'h.nocmd': 'This stage has no command', 'h.restart': 'A new feature starts again with this',
    'h.feat': '{0} · now at {1}', 'h.featnext': 'Next command for this feature', 'h.all': '{0:The|All} {0} {0:feature follows|features follow} these principles',
    'h.docs': 'Documents of this feature', 'h.kind': 'Document kind',
    'e.title': 'This document does not exist yet', 'e.where': '{0} is at the {1} stage ({2} / {3}).',
    'e.missing': 'The {1} of the {0} stage has not been written.', 'e.make': 'Command that creates this document',
    'e.now': 'Command to type for this feature now', 'e.goto': 'Open the {1} document of {0}',
    'e.nomake': 'Done is not created by a command; a feature arrives when every task is finished.',
    'e.complete.title': 'Finished, with no checklist', 'e.complete': '{0} is complete. It has no checklist, and nothing is left to type for it.',
    'nf.tag': 'Not found', 'err.read': 'Read error', 'i.left.none': 'nothing left', 'scroll.more': 'More below: scroll',
    'e.project': 'This project has no features yet', 'e.project.say': 'A feature starts with a specification. Type this in your agent, then come back: the board updates by itself.',
    'e.constitution': 'The project has no constitution yet.',
    prev: 'Previous stage', next: 'Next stage', first: 'First stage', last: 'Last stage', zoomout: 'Zoom out', allboard: 'Whole board',
    'more.blocks': '{0} more source {0:block|blocks}', choose: 'Documents of this kind',
    'o.note': 'This document does not follow the template, so it is shown in its own order.', 'o.sections': 'Sections', 'o.blocks': 'Blocks', 'o.intro': 'Preamble', 'o.sub': '{0} {0:subsection|subsections}',
    'c.version': 'Version', 'c.ratified': 'Ratified', 'c.amended': 'Last amended', 'c.none': 'not set', 'n.items': '{0} {0:item|items}', 'n.count': '{0}',
    'sp.stories': 'User stories', 'sp.scen': 'Acceptance scenarios', 'sp.reqs': 'Requirements', 'sp.crit': 'Success criteria', 'sp.open': 'Open questions',
    'sp.story': 'Story {0} · {1} {1:scenario|scenarios}', 'sp.why': 'Why this priority', 'sp.test': 'Independent test', 'sp.groups': '{0} {0:group|groups} · {1}', 'sp.dist': 'Requirements per group',
    'p.tabs': 'Plan stage documents', 'p.note': 'The plan stage leaves several documents. plan.md is the lead one.',
    'p.lead': 'Lead document', 'p.has': 'Written', 'p.steps': 'Sections in order', 'p.files': '{0} {0:file|files}',
    'p.ctx': 'Technical context', 'p.check': 'Constitution check', 'p.struct': 'Project structure',
    'r.title': 'Decisions and rejected alternatives', 'r.dec': 'Decision', 'r.why': 'Rationale', 'r.alt': 'Rejected alternatives', 'r.noalt': 'No rejected alternatives recorded',
    'd.ent': 'Entities', 'd.rel': 'Relationships', 'q.steps': '{0} {0:step|steps}',
    't.phases': 'Phases', 't.tasks': 'Tasks', 't.par': 'Parallel', 't.stories': 'Stories', 't.struct': 'Task structure',
    't.done': 'Done', 't.open': 'Open', 't.next': 'Next', 't.story': 'User story', 't.expand': 'Show {0} {0:task|tasks}', 't.partag': 'parallel',
    'i.pct': '{0}% done · {1} left', 'i.aria': '{1} of {0} tasks done', 'i.next': 'Command to type next', 'i.cont': 'Continue with the {0} {0:task|tasks} left',
    'i.fin': 'Every task is finished. Nothing to type', 'i.left': 'What is left per phase', 'i.left.n': 'open in {0} {0:phase|phases}', 'i.nleft': '{0} left',
    'i.outside': '{0} of the {1} tasks {0:sits|sit} outside any phase, so {0:it has|they have} no cell here', 'i.bystory': 'Progress per story', 'i.groups': '{0} {0:group|groups}', 'i.common': 'Shared',
    'k.checked': 'Items checked', 'k.groups': 'Groups', 'k.feat': 'Tasks of this feature', 'k.title': 'Checklist', 'k.notasks': 'no tasks', 'k.stage': 'Stage of this feature',
    disconnected: 'Disconnected from the server. Reconnecting…', loading: 'Loading…',
    docGone: 'This document no longer exists.', 'docGone.say': 'Its file was deleted or moved while the page was open.',
    'err.title': 'This page could not be drawn', 'err.say': 'Something in it broke the page. The project files are untouched.',
    readError: 'Could not read this document', refreshError: 'Could not refresh this document. Showing the last version read.',
    // ---------- other formats ----------
    'n.specs': 'Specs', 'n.propose': 'Propose', 'n.design': 'Design', 'n.apply': 'Apply', 'n.archive': 'Archive', 'n.steering': 'Steering', 'n.requirements': 'Requirements',
    'zone.n': '{0} SDD stages', 'g.start': 'A new feature starts with this',
    'pr.caps': 'Capabilities', 'pr.caps.none': 'No specs yet. Archiving a change writes them', 'pr.steer': 'Steering files', 'pr.steer.none': 'No steering files yet',
    'e.project.os': 'A change starts with a proposal. Type this in your agent, then come back: the board updates by itself.',
    'e.project.kiro': 'A spec starts with its requirements. Type this in the Kiro CLI or start a spec in the Kiro IDE, then come back: the board updates by itself.',
    'e.shared.os': 'The project has no specs yet. They are written when a change is archived.',
    'e.shared.kiro': 'The project has no steering files yet. Write them in .kiro/steering/, or generate them in the Kiro IDE.',
    'p.note.propose': 'The propose stage leaves several documents. proposal.md is the lead one.',
    'i.archive': 'Every task is finished. Archiving merges the change into the specs',
    't.opt': 'optional', 't.optional': 'Optional, not counted',
    'q.reqs': 'Requirements', 'q.scen': 'Scenarios', 'q.crit': 'Criteria', 'q.story': 'User story', 'q.n': '{0} {0:requirement|requirements}',
    'q.ADDED': 'Added', 'q.MODIFIED': 'Modified', 'q.REMOVED': 'Removed', 'q.RENAMED': 'Renamed',
    'dz.sections': 'Sections', 'dz.cards': 'Decisions', 'dz.diagrams': 'Diagrams',
  },
  ko: {
    'n.constitution': '헌법', 'n.specify': '명세', 'n.plan': '계획', 'n.tasks': '작업 분해', 'n.implement': '구현', 'n.done': '완료',
    'f.stages': '단계', 'f.stages.u': '단계', 'f.tasks': '작업', 'f.feats': '기능', 'f.done': '완료',
    nextcmd: '다음 명령', copy: '복사', copied: '복사됨',
    'strip.left': '{0} · 남은 작업 {1}개', 'strip.at': '{0} · 지금 {1} 단계', 'strip.new': '모든 기능이 끝났다. 새 기능은 이 명령으로 시작', 'strip.empty': '기능이 아직 없다. 첫 기능을 시작', 'strip.const': '헌법이 아직 없다. 원칙부터 정한다',
    title: '{0} 스펙 보드', board: '{0} 프로젝트 보드', language: '언어', project: '프로젝트',
    zone: 'SDD 여섯 단계',
    'zone.empty': '이 프로젝트에는 아직 기능이 없다. {0} 를 입력해 첫 명세를 쓴다',
    live: '진행 중', nocmd: '명령 없음', 'cmd.stage': '이 단계 명령',
    here: '여기', passed: '지나감', principles: '원칙', follows: '적용 기능',
    'feat.here': '여기 있는 기능', 'feat.none': '지금 머무는 기능 없음', 'more.n': '+{0}개 더', fold: '접기',
    'pr.none': '헌법이 아직 없다', docs: '이 단계 문서',
    'g.move': '기능 {0}개를 {1} 단계로', 'g.clarify': '열린 질문이 있는 {0}개는 {1} 먼저', 'g.impl': '남은 작업 {0}개를 이어서 구현',
    'g.wait': '여기 선 기능이 없다. 기능이 오면 입력', 'g.new': '끝난 기능 {0}개. 새 기능은 여기서 다시 시작',
    'g.first': '원칙이 섰으면 기능 명세로', 'g.const': '헌법이 아직 없다. 원칙부터 정한다',
    new: '새 문서', changed: '갱신',
    back: '전체 보드로', 'bar.stages': '단계 이동', 'bar.feature': '기능', 'bar.first': '← 처음', 'bar.last': '끝 →', nodoc: '문서 없음',
    toc: '이 문서의 차례', 'toc.none': '이 문서에는 차례가 없음', 'doc.layer': '단계 문서',
    'h.cmd': '이 단계에서 입력하는 명령', 'h.nocmd': '이 단계에는 명령이 없다', 'h.restart': '새 기능은 이 명령으로 다시 시작',
    'h.feat': '{0} · 지금 {1} 단계', 'h.featnext': '이 기능의 다음 명령', 'h.all': '기능 {0}개가 모두 이 원칙을 따른다',
    'h.docs': '이 기능의 문서', 'h.kind': '문서 종류',
    'e.title': '이 문서는 아직 없다', 'e.where': '{0} 기능은 지금 {1} 단계({2} / {3})에 있다.',
    'e.missing': '{0} 단계의 {1} 문서가 아직 만들어지지 않았다.', 'e.make': '이 문서를 만드는 명령',
    'e.now': '이 기능에 지금 입력할 명령', 'e.goto': '{0} 의 {1} 문서 보기',
    'e.nomake': '완료 단계는 명령으로 만들지 않는다. 모든 작업이 끝나면 도달한다.',
    'e.complete.title': '완료된 기능, 체크리스트 없음', 'e.complete': '{0} 기능은 완료되었다. 체크리스트가 없고, 더 입력할 명령도 없다.',
    'nf.tag': '찾을 수 없음', 'err.read': '읽기 오류', 'i.left.none': '남은 것 없음', 'scroll.more': '아래에 더 있음: 스크롤',
    'e.project': '이 프로젝트에는 아직 기능이 없다', 'e.project.say': '기능은 명세에서 시작한다. 에이전트에 이 명령을 입력하고 돌아오면 보드가 스스로 바뀐다.',
    'e.constitution': '프로젝트에 헌법이 아직 없다.',
    prev: '이전 단계', next: '다음 단계', first: '첫 단계', last: '마지막 단계', zoomout: '축소', allboard: '전체 보드',
    'more.blocks': '원문 {0}개 블록 더 있음', choose: '같은 종류의 문서',
    'o.note': '이 문서는 정해진 틀로 쓰이지 않아 원문 차례 그대로 보여 준다.', 'o.sections': '섹션', 'o.blocks': '블록', 'o.intro': '머리말', 'o.sub': '하위 {0}개',
    'c.version': '버전', 'c.ratified': '제정', 'c.amended': '최근 개정', 'c.none': '없음', 'n.items': '{0}개 항목', 'n.count': '{0}개',
    'sp.stories': '사용자 스토리', 'sp.scen': '수용 시나리오', 'sp.reqs': '요구사항', 'sp.crit': '성공 기준', 'sp.open': '열린 질문',
    'sp.story': '스토리 {0} · 시나리오 {1}개', 'sp.why': '왜 이 우선순위인가', 'sp.test': '독립 검증', 'sp.groups': '{0}개 묶음 · {1}개', 'sp.dist': '묶음별 요구사항 수',
    'p.tabs': '계획 단계 문서', 'p.note': '계획 단계는 문서를 여러 개 남긴다. plan.md 가 대표 문서다.',
    'p.lead': '대표 문서', 'p.has': '작성됨', 'p.steps': '순서대로 본 구획', 'p.files': '파일 {0}개',
    'p.ctx': '기술 맥락', 'p.check': '헌법 점검', 'p.struct': '프로젝트 구조',
    'r.title': '결정과 기각된 대안', 'r.dec': '결정', 'r.why': '근거', 'r.alt': '기각된 대안', 'r.noalt': '기각된 대안 기록 없음',
    'd.ent': '엔티티', 'd.rel': '관계', 'q.steps': '{0}단계',
    't.phases': '단계', 't.tasks': '작업', 't.par': '병렬 가능', 't.stories': '스토리', 't.struct': '작업 구조',
    't.done': '완료', 't.open': '남음', 't.next': '다음 차례', 't.story': '사용자 스토리', 't.expand': '작업 {0}개 펼치기', 't.partag': '병렬',
    'i.pct': '{0}% 완료 · {1}개 남음', 'i.aria': '작업 {0}개 중 {1}개 완료', 'i.next': '다음에 입력할 명령', 'i.cont': '남은 작업 {0}개를 이어서 구현',
    'i.fin': '모든 작업이 끝났다. 입력할 명령 없음', 'i.left': '단계별로 남은 것', 'i.left.n': '{0}개 단계에 남음', 'i.nleft': '{0}개 남음',
    'i.outside': '작업 {1}개 중 {0}개는 어느 단계에도 속하지 않아 여기 칸이 없다', 'i.bystory': '스토리별 진행', 'i.groups': '{0}개 묶음', 'i.common': '공통',
    'k.checked': '확인한 항목', 'k.groups': '묶음', 'k.feat': '이 기능의 작업', 'k.title': '체크리스트', 'k.notasks': '작업 없음', 'k.stage': '이 기능의 단계',
    disconnected: '서버와 연결이 끊어졌다. 다시 연결하는 중…', loading: '불러오는 중…',
    docGone: '이 문서는 더 이상 없다.', 'docGone.say': '페이지를 연 뒤에 파일이 지워졌거나 옮겨졌다.',
    'err.title': '이 화면을 그리지 못했다', 'err.say': '화면을 그리다 오류가 났다. 프로젝트 파일은 그대로다.',
    readError: '이 문서를 읽을 수 없다', refreshError: '문서를 새로 읽지 못했다. 마지막으로 읽은 내용을 보여 준다.',
    // ---------- other formats ----------
    'n.specs': '스펙', 'n.propose': '제안', 'n.design': '설계', 'n.apply': '적용', 'n.archive': '보관', 'n.steering': '스티어링', 'n.requirements': '요구사항',
    'zone.n': 'SDD {0}단계', 'g.start': '새 기능은 이 명령으로 시작',
    'pr.caps': '스펙 영역', 'pr.caps.none': '스펙이 아직 없다. 변경을 보관하면 쓰인다', 'pr.steer': '스티어링 파일', 'pr.steer.none': '스티어링 파일이 아직 없다',
    'e.project.os': '변경은 제안에서 시작한다. 에이전트에 이 명령을 입력하고 돌아오면 보드가 스스로 바뀐다.',
    'e.project.kiro': '스펙은 요구사항에서 시작한다. Kiro CLI에 이 명령을 입력하거나 Kiro IDE에서 스펙을 시작하고 돌아오면 보드가 스스로 바뀐다.',
    'e.shared.os': '프로젝트에 스펙이 아직 없다. 변경을 보관할 때 쓰인다.',
    'e.shared.kiro': '프로젝트에 스티어링 파일이 아직 없다. .kiro/steering/ 에 쓰거나 Kiro IDE에서 만든다.',
    'p.note.propose': '제안 단계는 문서를 여러 개 남긴다. proposal.md 가 대표 문서다.',
    'i.archive': '모든 작업이 끝났다. 보관하면 변경이 스펙에 합쳐진다',
    't.opt': '선택', 't.optional': '선택 작업, 세지 않음',
    'q.reqs': '요구사항', 'q.scen': '시나리오', 'q.crit': '수용 기준', 'q.story': '사용자 스토리', 'q.n': '요구사항 {0}개',
    'q.ADDED': '추가', 'q.MODIFIED': '변경', 'q.REMOVED': '삭제', 'q.RENAMED': '이름 변경',
    'dz.sections': '구획', 'dz.cards': '결정', 'dz.diagrams': '도표',
  },
} satisfies Record<Lang, Record<string, string>>

export type LabelKey = keyof (typeof LABELS)['en']
export type T = (key: LabelKey, ...args: (string | number)[]) => string

// Compile-time check that both languages have exactly the same keys.
const _same: Record<LabelKey, string> = LABELS.ko
void _same

// Every label says "feature"; a format that calls its unit of work something else gets its own word, swapped in the
// label before the arguments go in, so a feature id holding the word is left alone. All three Korean nouns end in a
// consonant, so the particles after them stay right.
const NOUN: Record<Unit, Record<Lang, [RegExp, string][]>> = {
  feature: { en: [], ko: [] },
  change: { en: [[/\bFeature(s?)\b/g, 'Change$1'], [/\bfeature(s?)\b/g, 'change$1']], ko: [[/기능/g, '변경']] },
  spec: { en: [[/\bFeature(s?)\b/g, 'Spec$1'], [/\bfeature(s?)\b/g, 'spec$1']], ko: [[/기능/g, '스펙']] },
}

export const translate = (l: Lang, key: LabelKey, ...args: (string | number)[]) => fill(LABELS[l][key], args)
export const translateFor = (unit: Unit, l: Lang, key: LabelKey, ...args: (string | number)[]) =>
  fill(NOUN[unit][l].reduce((s, [from, to]) => s.replace(from, to), LABELS[l][key] as string), args)

const fill = (label: string, args: (string | number)[]) => label
  .replace(/\{(\d):([^|}]*)\|([^}]*)\}/g, (_, n: string, one: string, many: string) => (Number(args[Number(n)]) === 1 ? one : many)) // {0:task|tasks}
  .replace(/\{(\d)\}/g, (_, n: string) => String(args[Number(n)] ?? ''))

function initial(): Lang {
  try { const s = localStorage.getItem('specviz:lang'); if (s === 'en' || s === 'ko') return s } catch { /* ignore */ }
  return navigator.language.startsWith('ko') ? 'ko' : 'en'
}

let lang: Lang | null = null
let unit: Unit | null = null
const listeners = new Set<() => void>()
const get = () => (lang ??= initial())
const getUnit = () => (unit ??= bootFlow().unit)
const snapshot = () => `${get()} ${getUnit()}`

function setLang(l: Lang) {
  lang = l
  try { localStorage.setItem('specviz:lang', l) } catch { /* ignore */ }
  document.documentElement.lang = l
  listeners.forEach(f => f())
}

// The word for a unit of work, from the project's format (the same the page started with, from the server).
export function setUnit(u: Unit) {
  if (u === getUnit()) return
  unit = u
  listeners.forEach(f => f())
}

export function useLang(): { lang: Lang; setLang: (l: Lang) => void; t: T } {
  useSyncExternalStore(f => { listeners.add(f); return () => void listeners.delete(f) }, snapshot, snapshot)
  const l = get(), u = getUnit()
  if (typeof document !== 'undefined') document.documentElement.lang = l
  return { lang: l, setLang, t: (key, ...args) => translateFor(u, l, key, ...args) }
}
