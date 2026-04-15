import type { KeyboardEvent, MouseEvent } from "react";
import * as Lucide from "lucide-react";

import type { AppLocaleText } from "../constants/i18n";
import { UsageHistorySparkline } from "./UsageHistorySparkline";

import type { Account, AccountUsageHistoryPoint } from "../types";
import {
  canManuallySwitchTo,
  clampUsage,
  getPlanTone,
  getShortAccountId,
  getStatusTone,
  getUsageTone,
} from "../utils/account-display";

interface Props {
  account: Account;
  historyPoints: AccountUsageHistoryPoint[];
  isActive: boolean;
  isPinned: boolean;
  isExcludedFromAutoSwitch: boolean;
  isRefreshing: boolean;
  isRepairing: boolean;
  isSwitching: boolean;
  onSwitch: (acc: Account) => void;
  onUnavailableSwitchAttempt: (acc: Account) => void;
  onTogglePin: (acc: Account) => void;
  onToggleExcludeAutoSwitch: (acc: Account) => void;
  onRepair: (acc: Account) => void;
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
  historyPoints,
  isActive,
  isPinned,
  isExcludedFromAutoSwitch,
  isRefreshing,
  isRepairing,
  isSwitching,
  onSwitch,
  onUnavailableSwitchAttempt,
  onTogglePin,
  onToggleExcludeAutoSwitch,
  onRepair,
  onRefresh,
  onDelete,
  resetText,
  reset5hText,
  resetWeekText,
  translations: t,
}: Props) {
  const statusTone = getStatusTone(account.status);
  const planTone = getPlanTone(account.planType || "free");
  const isBusy = isRefreshing || isSwitching || isRepairing;
  const canSwitchAccount = !isActive && !isSwitching && canManuallySwitchTo(account);
  const canExplainUnavailable =
    !isActive && !isSwitching && !canManuallySwitchTo(account);
  const canInteractWithCard = canSwitchAccount || canExplainUnavailable;
  const shouldShowRepairAction =
    account.status === "expired" ||
    account.status === "disabled" ||
    account.status === "exhausted";

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
    if (canSwitchAccount) {
      onSwitch(account);
      return;
    }

    if (canExplainUnavailable) {
      onUnavailableSwitchAttempt(account);
    }
  };

  /**
   * 允许通过键盘触发卡片切换，补齐基础可访问性。
   */
  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (!canInteractWithCard || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    handleCardSwitch();
  };

  /**
   * 卡片内按钮点击时阻止冒泡，避免同时触发整卡切换。
   */
  const stopCardClick = (event: MouseEvent<HTMLElement>): void => {
    event.stopPropagation();
  };

  return (
    <article
      className={`account-card ${isActive ? "is-active" : ""} ${canSwitchAccount ? "is-clickable" : ""} ${canExplainUnavailable ? "is-unavailable-clickable" : ""}`}
      role={canInteractWithCard ? "button" : undefined}
      tabIndex={canInteractWithCard ? 0 : undefined}
      onClick={handleCardSwitch}
      onKeyDown={handleCardKeyDown}
    >
      <div className="account-card-top">
        <div className="account-title-row">
          <h3 className="account-title">
            {account.orgName || t.personalWorkspace}
          </h3>
          <span className={`plan-badge plan-badge--${planTone}`}>
            {account.planType || "Free"}
          </span>
          <div className="account-icon-actions">
            <button
              className={`icon-button ${isPinned ? "is-active" : ""}`}
              type="button"
              onClick={(event) => {
                stopCardClick(event);
                onTogglePin(account);
              }}
              title={isPinned ? t.actions.unpin : t.actions.pin}
            >
              {isPinned ? <Lucide.PinOff size={15} /> : <Lucide.Pin size={15} />}
            </button>
            <button
              className={`icon-button ${isExcludedFromAutoSwitch ? "is-active" : ""}`}
              type="button"
              onClick={(event) => {
                stopCardClick(event);
                onToggleExcludeAutoSwitch(account);
              }}
              title={
                isExcludedFromAutoSwitch
                  ? t.actions.includeAutoSwitch
                  : t.actions.excludeAutoSwitch
              }
            >
              {isExcludedFromAutoSwitch ? (
                <Lucide.ShieldCheck size={15} />
              ) : (
                <Lucide.ShieldOff size={15} />
              )}
            </button>
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
                size={15}
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
              <Lucide.Trash2 size={15} />
            </button>
          </div>
        </div>

        <div className="account-meta-row">
          {isActive && (
            <span className="active-pill">
              <Lucide.CheckCircle2 size={13} />
              <span>{t.meta.current}</span>
            </span>
          )}
          <span className={`status-pill status-pill--${statusTone}`}>
            {t.status[account.status]}
          </span>
          <span className="account-id-pill">
            {t.meta.accountId} · {getShortAccountId(account.accountId)}
          </span>
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

      <div className="account-insight-row">
        <div className="account-trend">
          <span className="account-trend-label">{t.history.recentTrend}</span>
          <UsageHistorySparkline
            emptyLabel={t.history.empty}
            points={historyPoints}
            title={t.history.recentTrend}
          />
        </div>

        <div className="account-quick-actions">
          {shouldShowRepairAction && (
            <button
              className="secondary-chip secondary-chip--accent secondary-chip--compact"
              type="button"
              onClick={(event) => {
                stopCardClick(event);
                onRepair(account);
              }}
              disabled={isBusy}
              title={isRepairing ? t.actions.repairing : t.actions.repair}
            >
              <Lucide.Wrench size={13} />
              <span>{isRepairing ? t.actions.repairing : t.actions.repair}</span>
            </button>
          )}
          {isExcludedFromAutoSwitch && (
            <span className="secondary-chip secondary-chip--compact secondary-chip--muted">
              <Lucide.MinusCircle size={13} />
              <span>{t.settings.excludedAccount}</span>
            </span>
          )}
        </div>
      </div>

      <div className="account-card-footer">
        <span className="account-footnote">{account.email}</span>
        <button
          className={`switch-button ${isActive ? "is-active" : ""} ${isSwitching ? "is-loading" : ""} ${canExplainUnavailable ? "is-unavailable" : ""}`}
          type="button"
          onClick={(event) => {
            stopCardClick(event);
            if (canSwitchAccount) {
              onSwitch(account);
              return;
            }

            if (canExplainUnavailable) {
              onUnavailableSwitchAttempt(account);
            }
          }}
          aria-disabled={canExplainUnavailable || undefined}
          disabled={isActive || isSwitching}
        >
          {isActive
            ? t.meta.current
            : isSwitching
              ? t.actions.switching
              : canExplainUnavailable
                ? t.actions.unavailable
                : t.actions.switch}
        </button>
      </div>
    </article>
  );
}
