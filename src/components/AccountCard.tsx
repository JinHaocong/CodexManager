import type { KeyboardEvent, MouseEvent } from "react";
import * as Lucide from "lucide-react";

import type { AppLocaleText } from "../constants/i18n";
import type { Account } from "../types";
import {
  clampUsage,
  getPlanTone,
  getShortAccountId,
  getStatusTone,
  getUsageTone,
} from "../utils/account-display";

interface Props {
  account: Account;
  isActive: boolean;
  isRefreshing: boolean;
  isSwitching: boolean;
  onSwitch: (acc: Account) => void;
  onRefresh: (acc: Account) => void;
  onDelete: (acc: Account) => void;
  resetText: string;
  reset5hText?: string;
  resetWeekText?: string;
  translations: AppLocaleText;
}

/**
 * 单个账号卡片，展示状态、额度与切换操作。
 */
export function AccountCard({
  account,
  isActive,
  isRefreshing,
  isSwitching,
  onSwitch,
  onRefresh,
  onDelete,
  resetText,
  reset5hText,
  resetWeekText,
  translations: t,
}: Props) {
  const statusTone = getStatusTone(account.status);
  const planTone = getPlanTone(account.planType || "free");
  const isBusy = isRefreshing || isSwitching;
  const canSwitchByCard = !isActive && !isSwitching;

  // 只有预警和耗尽状态才拼接重置文案，避免健康状态信息过载。
  const description =
    resetText &&
    (account.status === "warning" || account.status === "exhausted")
      ? `${t.statusDescription[account.status]} ${t.usage.resetIn} ${resetText}`
      : t.statusDescription[account.status];

  const usageMetrics = [
    {
      label: t.usage.shortWindow,
      value: clampUsage(account.usage_5h),
      resetText: reset5hText,
    },
    {
      label: t.usage.longWindow,
      value: clampUsage(account.usage_week),
      resetText: resetWeekText,
    },
  ];

  /**
   * 卡片本身支持直接切换，和悬浮手型保持一致。
   */
  const handleCardSwitch = (): void => {
    if (canSwitchByCard) {
      onSwitch(account);
    }
  };

  /**
   * 允许通过键盘触发卡片切换，补齐基础可访问性。
   */
  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (!canSwitchByCard || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    onSwitch(account);
  };

  /**
   * 卡片内按钮点击时阻止冒泡，避免同时触发整卡切换。
   */
  const stopCardClick = (event: MouseEvent<HTMLElement>): void => {
    event.stopPropagation();
  };

  return (
    <article
      className={`account-card ${isActive ? "is-active" : ""} ${canSwitchByCard ? "is-clickable" : ""}`}
      role={canSwitchByCard ? "button" : undefined}
      tabIndex={canSwitchByCard ? 0 : undefined}
      onClick={handleCardSwitch}
      onKeyDown={handleCardKeyDown}
    >
      <div className="account-card-top">
        <div className="account-card-main">
          <div className="account-title-row">
            <h3 className="account-title">
              {account.orgName || t.personalWorkspace}
            </h3>
            <span className={`plan-badge plan-badge--${planTone}`}>
              {account.planType || "Free"}
            </span>
            {isActive && (
              <span className="active-pill">
                <Lucide.CheckCircle2 size={14} />
                <span>{t.meta.current}</span>
              </span>
            )}
          </div>

          <div className="account-meta-row">
            <span className={`status-pill status-pill--${statusTone}`}>
              {t.status[account.status]}
            </span>
            <span className="account-id-pill">
              {t.meta.accountId} · {getShortAccountId(account.accountId)}
            </span>
          </div>
        </div>

        <div className="account-icon-actions">
          <button
            className="icon-button"
            type="button"
            onClick={(event) => {
              stopCardClick(event);
              onRefresh(account);
            }}
            disabled={isBusy}
            title={t.actions.refreshAll}
          >
            <Lucide.RefreshCw
              size={16}
              className={isRefreshing ? "spin" : ""}
            />
          </button>
          <button
            className="icon-button icon-button--danger"
            type="button"
            onClick={(event) => {
              stopCardClick(event);
              onDelete(account);
            }}
            disabled={isSwitching}
            title={t.actions.remove}
          >
            <Lucide.Trash2 size={16} />
          </button>
        </div>
      </div>

      <p className="account-description">{description}</p>

      <div className="usage-grid">
        {usageMetrics.map((metric) => {
          const usageTone = getUsageTone(metric.value);

          return (
            <div className="usage-card" key={metric.label}>
              <div className="usage-card-top">
                <div className="usage-label-group">
                  <span className="usage-label">{metric.label}</span>
                  {metric.resetText && (
                    <span className="usage-reset-text">
                      {metric.resetText}
                    </span>
                  )}
                </div>
                <strong className={`usage-value usage-value--${usageTone}`}>
                  {metric.value}%
                </strong>
              </div>
              <div className="progress-track">
                <div
                  className={`progress-fill progress-fill--${usageTone}`}
                  style={{ width: `${metric.value}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="account-card-footer">
        <span className="account-footnote">{account.email}</span>
        <button
          className={`switch-button ${isActive ? "is-active" : ""} ${isSwitching ? "is-loading" : ""}`}
          type="button"
          onClick={(event) => {
            stopCardClick(event);
            onSwitch(account);
          }}
          disabled={isActive || isSwitching}
        >
          {isActive
            ? t.meta.current
            : isSwitching
              ? t.actions.switching
              : t.actions.switch}
        </button>
      </div>
    </article>
  );
}
