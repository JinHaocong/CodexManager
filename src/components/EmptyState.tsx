import * as Lucide from 'lucide-react'

interface Props {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}

/**
 * 空态占位组件，用于承接“无账号”和“筛选无结果”两类场景。
 */
export function EmptyState({ title, description, actionLabel, onAction }: Props) {
  return (
    <section className="empty-state">
      <div className="empty-state-orb">
        <Lucide.Plus size={22} />
      </div>
      <h2 className="empty-state-title">{title}</h2>
      <p className="empty-state-description">{description}</p>
      <button className="empty-state-button" type="button" onClick={onAction}>
        {actionLabel}
      </button>
    </section>
  )
}
