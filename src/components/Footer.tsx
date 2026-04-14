import * as Lucide from 'lucide-react'

import type { AppLocaleText } from '../constants/i18n'
import type { Lang } from '../types'

interface Props {
  lang: Lang
  onAddAccount: () => void
  onToggleLang: () => void
  onQuit: () => void
  translations: AppLocaleText
}

/**
 * 底部操作栏，承载全局级别的新增、语言切换和退出入口。
 */
export function Footer({
  lang,
  onAddAccount,
  onToggleLang,
  onQuit,
  translations: t
}: Props) {
  return (
    <footer className="footer-bar no-drag">
      <button className="footer-primary" type="button" onClick={onAddAccount}>
        <Lucide.Plus size={16} />
        <span>{t.actions.addAccount}</span>
      </button>

      <div className="footer-actions">
        <button
          className="footer-chip"
          type="button"
          onClick={onToggleLang}
          title={t.actions.language}
        >
          {lang}
        </button>
        <button className="footer-chip footer-chip--danger" type="button" onClick={onQuit}>
          <Lucide.Power size={15} />
          <span>{t.actions.quit}</span>
        </button>
      </div>
    </footer>
  )
}
