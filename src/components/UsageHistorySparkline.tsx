import type { AccountUsageHistoryPoint } from '../types'

interface Props {
  points: AccountUsageHistoryPoint[]
  emptyLabel: string
  title: string
}

/**
 * 展示账号最近几次刷新得到的额度趋势，帮助用户快速感知波动方向。
 */
export function UsageHistorySparkline({ points, emptyLabel, title }: Props) {
  // 卡片空间有限，只保留最近 6 个采样点，避免趋势区横向和纵向都过度膨胀。
  const visiblePoints = points.slice(-6)

  if (!visiblePoints.length) {
    return <span className="history-empty">{emptyLabel}</span>
  }

  return (
    <div className="history-sparkline" aria-label={title} title={title}>
      {visiblePoints.map((point) => {
        const value = Math.max(point.usage5h, point.usageWeek)
        const tone =
          value >= 100 ? 'danger' : value >= 80 ? 'warning' : 'healthy'

        return (
          <span
            key={point.timestamp}
            className={`history-bar history-bar--${tone}`}
            style={{ height: `${Math.max(16, value)}%` }}
          />
        )
      })}
    </div>
  )
}
