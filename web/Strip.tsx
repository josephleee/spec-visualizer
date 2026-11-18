import type { Project } from '../server/types.ts'
import { projectTotals, stripGuide } from './guide.ts'
import { useLang } from './i18n.ts'
import { bootFlow, flowOf } from './flows.ts'
import { Copy, cssVars } from './parts.tsx'

// The dark band: which project, how far along, what to type next.
// Its height and its slots are the same in every state, so nothing below it moves when the project arrives.
export function Strip({ project }: { project: Project | null }) {
  const { lang, setLang, t } = useLang()
  const totals = project && projectTotals(project)
  const g = project && stripGuide(project)
  const n = (project ? flowOf(project) : bootFlow()).stages.length
  const why = !g ? '' : g.kind !== 'feature' ? t(g.kind === 'constitution' ? 'strip.const' : g.kind === 'first' ? 'strip.empty' : 'strip.new')
    : g.left > 0 ? t('strip.left', g.feature.id, g.left) : t('strip.at', g.feature.id, t(`n.${g.feature.stage}`))
  return (
    <header className="strip" aria-busy={!project}>
      <a className="brand" href="#/">
        <svg className="logo" viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="21" /><rect className="logo-in" x="9" y="9" width="10" height="10" /></svg>
        {project && <span className="brand-name">{project.name}</span>}
      </a>
      <p className="about" title={project?.about ?? undefined}>{project?.about}</p>
      <dl className="facts">
        {project && totals && <>
          <div><dt>{t('f.stages')}</dt><dd><b>{n}</b> {t('f.stages.u')}</dd></div>
          <div><dt>{t('f.tasks')}</dt><dd><b>{totals.pct}%</b> {totals.done} / {totals.total}</dd></div>
          <div><dt>{t('f.feats')}</dt><dd><b>{totals.finished} / {project.features.length}</b> {t('f.done')}</dd></div>
        </>}
      </dl>
      <div className="nextcmd">
        {g && <>
          <span className="nextcmd-label">{t('nextcmd')}</span>
          <code>{g.cmd}</code>
          <Copy cmd={g.cmd} />
          <span className="nextcmd-why" title={why}>{why}</span>
        </>}
      </div>
      <div className="lang" role="group" aria-label={t('language')}>
        <button type="button" lang="ko" aria-pressed={lang === 'ko'} onClick={() => setLang('ko')}>한국어</button>
        <button type="button" lang="en" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
      </div>
      {totals && <i className="strip-bar" aria-hidden style={cssVars({ '--v': totals.total ? totals.done / totals.total : 0 })} />}
    </header>
  )
}
