import type { DocKind, DocRef, Feature, Project, Stage } from '../server/types.ts'
import { useLang } from './i18n.ts'
import { markOf, type Seen } from './seen.ts'

const STAGES: { id: Stage; name: string }[] = [
  { id: 'specify', name: 'Specify' }, { id: 'plan', name: 'Plan' }, { id: 'tasks', name: 'Tasks' },
  { id: 'implement', name: 'Implement' }, { id: 'done', name: 'Done' },
]
const REQUIRED: DocKind[] = ['spec', 'plan', 'tasks']
const href = (d: DocRef) => `#/doc/${encodeURIComponent(d.path)}`
const label = (d: DocRef) => d.path.split('/').slice(-1)[0]

function Stages({ stage }: { stage: Stage }) {
  const { t } = useLang()
  const cur = STAGES.findIndex(s => s.id === stage)
  return (
    <ol className="stages" aria-label={t('stages')}>
      {STAGES.map((s, i) => {
        const state = i < cur ? 'done' : i === cur ? 'current' : 'todo'
        const text = state === 'done' ? t('stageDone') : state === 'current' ? t('stageCurrent') : t('stageTodo')
        return (
          <li key={s.id} className={`stage ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span aria-hidden>{state === 'done' ? '✓' : state === 'current' ? '●' : '○'}</span> {s.name}
            <span className="sr-only"> ({text})</span>
          </li>
        )
      })}
    </ol>
  )
}

function Chip({ doc, seen }: { doc: DocRef; seen: Seen }) {
  const { t } = useLang()
  const mark = markOf(doc, seen)
  return (
    <a className={doc.error ? 'chip error' : 'chip'} href={href(doc)} title={doc.error ?? doc.path}>
      {doc.error && '⚠ '}{doc.kind === 'other' ? label(doc) : doc.kind}
      {mark && <span className={`mark ${mark}`}> {t(mark)}</span>}
    </a>
  )
}

function FeatureCard({ f, current, seen }: { f: Feature; current: boolean; seen: Seen }) {
  const { t } = useLang()
  const missing = REQUIRED.filter(k => !f.docs.some(d => d.kind === k))
  return (
    <li className="feature">
      <h3>{f.id} {current && <span className="current-badge">{t('current')}</span>}</h3>
      <Stages stage={f.stage} />
      <ul className="chips">
        {f.docs.map(d => <li key={d.path}><Chip doc={d} seen={seen} /></li>)}
        {missing.map(k => <li key={k}><span className="chip missing" title={t('missing')}>{k} ({t('missing')})</span></li>)}
      </ul>
      {f.tasks && (
        <p className="progress">
          <progress max={f.tasks.total} value={f.tasks.done} aria-label={t('progress')} /> {f.tasks.done}/{f.tasks.total}
        </p>
      )}
      <p>{t('openQuestions')}: {f.openQuestions}</p>
    </li>
  )
}

export default function Home({ project, seen }: { project: Project; seen: Seen }) {
  const { t } = useLang()
  const docs = project.features.flatMap(f => f.docs)
  const all = project.constitution ? [...docs, project.constitution] : docs
  const byKind: Record<string, number> = {}
  for (const d of all) byKind[d.kind] = (byKind[d.kind] ?? 0) + 1
  const kinds = Object.entries(byKind).map(([k, n]) => `${k} ${n}`).join(', ')
  const done = project.features.reduce((n, f) => n + (f.tasks?.done ?? 0), 0)
  const total = project.features.reduce((n, f) => n + (f.tasks?.total ?? 0), 0)
  const questions = project.features.reduce((n, f) => n + f.openQuestions, 0)
  const c = project.constitution

  return (
    <>
      <h1>{project.name}</h1>
      <p>
        {c && !c.error ? <a href={href(c)}>{t('constitution')}</a> : <span>{c ? t('constitution') : t('noConstitution')}</span>}
        {c && project.constitutionVersion && <> · {t('version')} {project.constitutionVersion}</>}
        {c && markOf(c, seen) && <span className={`mark ${markOf(c, seen)}`}> {t(markOf(c, seen)!)}</span>}
      </p>
      <dl className="totals">
        <div><dt>{t('features')}</dt><dd>{project.features.length}</dd></div>
        <div><dt>{t('documents')}</dt><dd title={kinds}>{all.length}</dd></div>
        <div><dt>{t('tasks')}</dt><dd>{done}/{total}</dd></div>
        <div><dt>{t('openQuestions')}</dt><dd>{questions}</dd></div>
      </dl>
      {project.features.length === 0 ? <p>{t('noFeatures')}</p> : (
        <ul className="features">
          {project.features.map(f => <FeatureCard key={f.id} f={f} current={f.id === project.currentFeature} seen={seen} />)}
        </ul>
      )}
    </>
  )
}
