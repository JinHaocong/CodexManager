import { useCallback, useEffect, useMemo, useState } from "react";

import { AccountCard } from "./components/AccountCard";
import { AutoSwitchDialog } from "./components/AutoSwitchDialog";
import { EmptyState } from "./components/EmptyState";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { NoticeToast } from "./components/NoticeToast";

import { translations } from "./constants/i18n";

import { useAccounts } from "./hooks/useAccounts";
import { useAutoSwitch } from "./hooks/useAutoSwitch";

import { REFRESH_INTERVAL_OPTIONS } from "./types";
import type {
  Account,
  AccountFilter,
  Lang,
  OAuthErrorPayload,
  RefreshIntervalMinutes,
  SystemNotificationIntent,
} from "./types";
import {
  getAutoSwitchCause,
  formatResetTime,
  formatTimestamp,
  getAttentionCount,
  getFilteredAccounts,
  getReadyCount,
  groupAccounts,
} from "./utils/account-display";

/**
 * 应用主界面，负责串联账号数据、筛选、切换与自动切换提醒。
 */
function App() {
  const [lang, setLang] = useState<Lang>("EN");
  const [langReady, setLangReady] = useState(false);
  const [filter, setFilter] = useState<AccountFilter>("all");
  const [refreshIntervalMinutes, setRefreshIntervalMinutes] =
    useState<RefreshIntervalMinutes>(3);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [skipAutoSwitchConfirm, setSkipAutoSwitchConfirm] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [noticeNonce, setNoticeNonce] = useState(0);

  const {
    accounts,
    setAccounts,
    activeId,
    setActiveId,
    isRefreshing,
    refreshingIds,
    refreshAll,
    handleRefreshOne,
    lastUpdateAt,
  } = useAccounts(lang, refreshIntervalMinutes);

  const t = translations[lang];

  useEffect(() => {
    let mounted = true;

    /**
     * 兜底处理外部存储中的异常值，保证界面和轮询逻辑始终落在支持的档位内。
     */
    const normalizeRefreshInterval = (
      value: unknown,
    ): RefreshIntervalMinutes => {
      if (
        typeof value === "number" &&
        REFRESH_INTERVAL_OPTIONS.includes(value as RefreshIntervalMinutes)
      ) {
        return value as RefreshIntervalMinutes;
      }
      return 3;
    };

    const initPreferences = async (): Promise<void> => {
      // 语言、自动切换确认和后台刷新间隔都依赖本地持久化，首屏统一初始化可避免界面闪动。
      const [
        savedLang,
        savedSkipAutoSwitchConfirm,
        savedRefreshIntervalMinutes,
      ] = await Promise.all([
        window.codexAPI.getLang(),
        window.codexAPI.getSkipAutoSwitchConfirm(),
        window.codexAPI.getRefreshIntervalMinutes(),
      ]);

      if (!mounted) return;

      if (savedLang) setLang(savedLang);
      setSkipAutoSwitchConfirm(Boolean(savedSkipAutoSwitchConfirm));
      setRefreshIntervalMinutes(
        normalizeRefreshInterval(savedRefreshIntervalMinutes),
      );
      setPreferencesReady(true);
      setLangReady(true);
    };

    void initPreferences();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (langReady) {
      void window.codexAPI.setLang(lang);
    }
  }, [lang, langReady]);

  useEffect(() => {
    if (preferencesReady) {
      void window.codexAPI.setSkipAutoSwitchConfirm(skipAutoSwitchConfirm);
    }
  }, [preferencesReady, skipAutoSwitchConfirm]);

  useEffect(() => {
    if (preferencesReady) {
      void window.codexAPI.setRefreshIntervalMinutes(refreshIntervalMinutes);
    }
  }, [preferencesReady, refreshIntervalMinutes]);

  const filteredAccounts = useMemo(
    () => getFilteredAccounts(accounts, filter),
    [accounts, filter],
  );
  const groupedAccounts = useMemo(() => {
    return groupAccounts(filteredAccounts, activeId);
  }, [activeId, filteredAccounts]);

  const activeAccount = useMemo(() => {
    return accounts.find((account) => account.id === activeId) || null;
  }, [accounts, activeId]);

  const readyCount = useMemo(() => getReadyCount(accounts), [accounts]);
  const attentionCount = useMemo(() => getAttentionCount(accounts), [accounts]);
  const lastUpdatedLabel = useMemo(() => {
    const formatted = formatTimestamp(lastUpdateAt, lang);
    return t.lastUpdated(formatted || t.meta.never);
  }, [lang, lastUpdateAt, t]);

  /**
   * 切换当前激活账号，并在成功后持久化选择结果。
   */
  const handleSwitchAccount = useCallback(
    async (account: Account): Promise<boolean> => {
      if (switchingId) return false;

      setSwitchingId(account.id);
      try {
        const result = await window.codexAPI.switchAccount(account);
        if (result?.success) {
          setActiveId(account.id);
          return true;
        }
        return false;
      } finally {
        setSwitchingId(null);
      }
    },
    [setActiveId, switchingId],
  );

  /**
   * 删除账号时同步修正当前激活状态，避免界面保留失效选中项。
   */
  const handleDeleteAccount = useCallback(
    (account: Account): void => {
      if (!window.confirm(t.removeConfirm)) return;

      const nextAccounts = accounts.filter((item) => item.id !== account.id);
      setAccounts(nextAccounts);

      if (account.id === activeId) {
        setActiveId(nextAccounts[0]?.id ?? null);
      }
    },
    [accounts, activeId, setAccounts, setActiveId, t.removeConfirm],
  );

  const handleToggleLang = useCallback((): void => {
    setLang((currentLang) => (currentLang === "EN" ? "ZH" : "EN"));
  }, []);

  /**
   * 触发 OAuth 流程，交给主进程拉起外部浏览器登录。
   */
  const handleAddAccount = useCallback((): void => {
    window.codexAPI.startOAuth();
  }, []);

  /**
   * 只有在浏览器层面未被明确拒绝时，才优先尝试系统通知。
   */
  const canUseSystemNotifications = useCallback((): boolean => {
    return (
      typeof window.Notification !== "undefined" &&
      window.Notification.permission !== "denied"
    );
  }, []);

  /**
   * 统一由主进程派发系统通知，点击通知后再决定是否展开应用内确认。
   */
  const showSystemNotification = useCallback(
    (title: string, body: string, intent: SystemNotificationIntent): void => {
      window.codexAPI.showSystemNotification({ title, body, intent });
    },
    [],
  );

  /**
   * 统一获取弹窗里展示的账户名称，避免出现空名称。
   */
  const getAccountDisplayName = useCallback(
    (account: Account | null): string => {
      if (!account) return t.personalWorkspace;
      const orgName = account.orgName || t.personalWorkspace;
      return `${account.email} (${orgName})`;
    },
    [t.personalWorkspace],
  );

  /**
   * 计算额度用尽账号距离“再次可切换”的预计恢复时间。
   *
   * `both` 需要等两个窗口都恢复，因此取更晚的重置时间。
   *
   * @param account 当前账号。
   */
  const getUnavailableResetTime = useCallback(
    (account: Account): string => {
      const cause = getAutoSwitchCause(account);
      const resetAt =
        cause === "7d"
          ? account.reset_week
          : cause === "both"
            ? Math.max(account.reset_5h ?? 0, account.reset_week ?? 0) || undefined
            : account.reset_5h;

      return formatResetTime(resetAt, lang);
    },
    [lang],
  );

  /**
   * 给不可切换账号生成更明确的提示语，避免用户只看到按钮不可用却不知道原因。
   */
  const getUnavailableSwitchMessage = useCallback(
    (account: Account): string => {
      if (account.status === "disabled") {
        return t.switchGuard.disabled;
      }

      if (account.status === "expired") {
        return t.switchGuard.expired;
      }

      if (account.status === "exhausted") {
        const cause = getAutoSwitchCause(account) ?? "5h";
        const resetText = getUnavailableResetTime(account);
        const reasonLabel = t.autoSwitch.reasonLabel(cause);

        if (resetText) {
          return t.switchGuard.exhaustedWithReset(reasonLabel, resetText);
        }

        return t.switchGuard.exhausted(reasonLabel);
      }

      return t.switchGuard.unavailable;
    },
    [getUnavailableResetTime, t],
  );

  /**
   * 展示短时轻提示，并在重复点击同一账号时重置消失计时。
   *
   * @param message 需要提示的文案。
   */
  const showNotice = useCallback((message: string): void => {
    setNoticeMessage(message);
    setNoticeNonce((value) => value + 1);
  }, []);

  /**
   * 不可切换账号被点击时，给出明确原因提示。
   *
   * @param account 用户尝试切换的账号。
   */
  const handleUnavailableSwitchAttempt = useCallback(
    (account: Account): void => {
      showNotice(getUnavailableSwitchMessage(account));
    },
    [getUnavailableSwitchMessage, showNotice],
  );

  useEffect(() => {
    if (!noticeMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setNoticeMessage(null);
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [noticeMessage, noticeNonce]);

  useEffect(() => {
    /**
     * OAuth 流程异常时给出统一提示，避免用户只看到浏览器没反应。
     */
    const handleOAuthError = (payload?: OAuthErrorPayload): void => {
      const code = payload?.code;
      const message =
        code === "in-progress"
          ? t.oauth.inProgress
          : code === "token-exchange-failed"
            ? t.oauth.exchangeFailed
            : code === "timeout"
              ? t.oauth.timeout
              : t.oauth.unavailable;

      if (canUseSystemNotifications()) {
        showSystemNotification(t.oauth.title, message, "show-window");
        return;
      }
      window.alert(message);
    };

    return window.codexAPI.onOAuthError(handleOAuthError);
  }, [canUseSystemNotifications, showSystemNotification, t.oauth]);

  // 自动切换逻辑全部委托给 useAutoSwitch，App 只关注数据和 UI 渲染。
  const {
    autoSwitchCause,
    nextAvailableAccount,
    autoSwitchDialogMode,
    rememberAutoSwitchChoice,
    setRememberAutoSwitchChoice,
    handleConfirmAutoSwitch,
    handleCloseAutoSwitchDialog,
  } = useAutoSwitch({
    accounts,
    activeAccount,
    activeId,
    preferencesReady,
    skipAutoSwitchConfirm,
    setSkipAutoSwitchConfirm,
    handleSwitchAccount,
    canUseSystemNotifications,
    showSystemNotification,
    getAccountDisplayName,
    t,
  });

  return (
    <div className="app-shell">
      <div className="app-background app-background--one" />
      <div className="app-background app-background--two" />

      <Header
        title="CodexManager"
        subtitle={t.subtitle}
        totalCount={accounts.length}
        readyCount={readyCount}
        attentionCount={attentionCount}
        activeLabel={
          activeAccount ? getAccountDisplayName(activeAccount) : t.meta.inactive
        }
        selectedFilter={filter}
        lastUpdatedLabel={lastUpdatedLabel}
        isRefreshing={isRefreshing}
        onRefreshAll={refreshAll}
        onFilterChange={setFilter}
        translations={t}
      />

      <main className="scroll-area no-drag">
        {groupedAccounts.length > 0 ? (
          groupedAccounts.map(({ email, accounts: groupedList }) => (
            <section className="account-group" key={email}>
              <div className="account-group-header">
                <span className="account-group-email">{email}</span>
                <span className="account-group-count">
                  {t.groupCount(groupedList.length)}
                </span>
              </div>

              <div className="account-group-list">
                {groupedList.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    isActive={activeId === account.id}
                    isRefreshing={refreshingIds.has(account.id)}
                    isSwitching={switchingId === account.id}
                    translations={t}
                    // 周额度通常比短窗口更能说明恢复时间，缺失时再回退到 5 小时窗口。
                    resetText={formatResetTime(
                      account.reset_week || account.reset_5h,
                      lang,
                    )}
                    reset5hText={formatResetTime(account.reset_5h, lang)}
                    resetWeekText={formatResetTime(account.reset_week, lang)}
                    onSwitch={handleSwitchAccount}
                    onUnavailableSwitchAttempt={handleUnavailableSwitchAttempt}
                    onRefresh={handleRefreshOne}
                    onDelete={handleDeleteAccount}
                  />
                ))}
              </div>
            </section>
          ))
        ) : (
          <EmptyState
            title={
              accounts.length > 0
                ? t.empty.noMatchTitle
                : t.empty.noAccountsTitle
            }
            description={
              accounts.length > 0
                ? t.empty.noMatchDescription
                : t.empty.noAccountsDescription
            }
            actionLabel={
              accounts.length > 0 ? t.actions.showAll : t.actions.addAccount
            }
            onAction={
              accounts.length > 0 ? () => setFilter("all") : handleAddAccount
            }
          />
        )}
      </main>

      <Footer
        lang={lang}
        refreshIntervalMinutes={refreshIntervalMinutes}
        onAddAccount={handleAddAccount}
        onRefreshIntervalChange={setRefreshIntervalMinutes}
        onToggleLang={handleToggleLang}
        onQuit={() => window.codexAPI.quitApp()}
        translations={t}
      />

      {noticeMessage && <NoticeToast message={noticeMessage} />}

      {autoSwitchDialogMode && activeAccount && (
        <AutoSwitchDialog
          currentLabel={getAccountDisplayName(activeAccount)}
          mode={autoSwitchDialogMode}
          reasonLabel={t.autoSwitch.reasonLabel(autoSwitchCause ?? "5h")}
          nextLabel={
            nextAvailableAccount
              ? getAccountDisplayName(nextAvailableAccount)
              : undefined
          }
          rememberChoice={rememberAutoSwitchChoice}
          translations={t}
          onCancel={handleCloseAutoSwitchDialog}
          onConfirm={() => void handleConfirmAutoSwitch()}
          onRememberChoiceChange={setRememberAutoSwitchChoice}
        />
      )}
    </div>
  );
}

export default App;
