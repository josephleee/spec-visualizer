import type { Project } from '../server/types.ts'
import { CMD, leadFeature, nextCommand, projectTotals, tasksLeft } from './guide.ts'
import { useLang } from './i18n.ts'
import { Copy, cssVars } from './parts.tsx'

// The dark band: which project, how far along, what to type next.
export function Strip({ project }: { project: Project | null }) {
  const { lang, setLang, t } = useLang()
  const totals = project && projectTotals(project)
  const lead = project && leadFeature(project)
  // No features at all: the first command starts one. Features but none unfinished: nothing to type.
  const cmd = !project ? null : lead ? nextCommand(lead).cmd : project.features.length ? null : CMD.specify
  const why = !project ? '' : !lead ? t(project.features.length ? 'strip.none' : 'strip.empty')
    : lead.tasks && tasksLeft(lead) > 0 ? t('strip.left', lead.id, tasksLeft(lead)) : t('strip.at', lead.id, t(`n.${lead.stage}`))
  return (
    <header className="strip">
      <a className="brand" href="#/">
        <svg className="logo" viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="21" /><rect className="logo-in" x="9" y="9" width="10" height="10" /></svg>
        {project ? <span className="brand-name">{project.name}</span> : <span className="skel skel-name" />}
      </a>
      {project ? <p className="about">{project.about}</p> : <p className="about"><span className="skel skel-line" /></p>}
      {project && totals && (
        <dl className="facts">
          <div><dt>{t('f.stages')}</dt><dd><b>6</b> {t('f.stages.u')}</dd></div>
          <div><dt>{t('f.tasks')}</dt><dd><b>{totals.pct}%</b> {totals.done} / {totals.total}</dd></div>
          <div><dt>{t('f.feats')}</dt><dd><b>{totals.finished} / {project.features.length}</b> {t('f.done')}</dd></div>
        </dl>
      )}
      {project && (
        <div className="nextcmd">
          <span className="nextcmd-label">{t('nextcmd')}</span>
          <code className={cmd ? undefined : 'none'}>{cmd ?? t('nocmd')}</code>
          {cmd && <Copy cmd={cmd} />}
          <span className="nextcmd-why">{why}</span>
        </div>
      )}
      <div className="lang" role="group" aria-label={t('language')}>
        <button type="button" lang="ko" aria-pressed={lang === 'ko'} onClick={() => setLang('ko')}>한국어</button>
        <button type="button" lang="en" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>EN</button>
      </div>
      {totals && <i className="strip-bar" aria-hidden style={cssVars({ '--v': totals.total ? totals.done / totals.total : 0 })} />}
    </header>
  )
}
