import { useSyncExternalStore } from 'react'

export type Lang = 'en' | 'ko'

const LABELS = {
  en: {
    features: 'Features', documents: 'Documents', tasks: 'Tasks', openQuestions: 'Open questions',
    current: 'Current', new: 'New', changed: 'Changed', noFeatures: 'No features found in this project yet.',
    disconnected: 'Disconnected from the server. Reconnecting…', constitution: 'Constitution',
    noConstitution: 'No constitution', home: 'Home', docGone: 'This document no longer exists.',
    readError: 'Could not read this document', language: 'Language', missing: 'missing',
    stage: 'Stage', progress: 'Task progress', loading: 'Loading…', version: 'version', stages: 'Stages',
    storyFilter: 'Filter by story', all: 'All',
    stageDone: 'completed', stageCurrent: 'current', stageTodo: 'upcoming',
    itemDone: 'done', itemOpen: 'open', refreshError: 'Could not refresh this document. Showing the last version read.',
  },
  ko: {
    features: '기능', documents: '문서', tasks: '태스크', openQuestions: '미해결 질문',
    current: '현재', new: '새 문서', changed: '갱신', noFeatures: '이 프로젝트에는 아직 기능이 없습니다.',
    disconnected: '서버와 연결이 끊어졌습니다. 다시 연결하는 중…', constitution: 'Constitution',
    noConstitution: 'Constitution 없음', home: '홈', docGone: '이 문서는 더 이상 없습니다.',
    readError: '이 문서를 읽을 수 없습니다', language: '언어', missing: '없음',
    stage: '단계', progress: '태스크 진행률', loading: '불러오는 중…', version: '버전', stages: '단계 목록',
    storyFilter: '스토리로 거르기', all: '전체',
    stageDone: '완료', stageCurrent: '현재', stageTodo: '예정',
    itemDone: '완료', itemOpen: '미완료', refreshError: '문서를 새로 읽지 못했습니다. 마지막으로 읽은 내용을 보여 줍니다.',
  },
} satisfies Record<Lang, Record<string, string>>

export type LabelKey = keyof (typeof LABELS)['en']

// Compile-time check that both languages have exactly the same keys.
const _same: Record<LabelKey, string> = LABELS.ko
void _same

function initial(): Lang {
  try { const s = localStorage.getItem('specviz:lang'); if (s === 'en' || s === 'ko') return s } catch { /* ignore */ }
  return navigator.language.startsWith('ko') ? 'ko' : 'en'
}

let lang: Lang | null = null
const listeners = new Set<() => void>()
const get = () => (lang ??= initial())

function setLang(l: Lang) {
  lang = l
  try { localStorage.setItem('specviz:lang', l) } catch { /* ignore */ }
  document.documentElement.lang = l
  listeners.forEach(f => f())
}

export function useLang() {
  const l = useSyncExternalStore(f => { listeners.add(f); return () => void listeners.delete(f) }, get)
  document.documentElement.lang = l
  return { lang: l, setLang, t: (key: LabelKey) => LABELS[l][key] }
}
