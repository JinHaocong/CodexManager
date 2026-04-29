import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AccountCard } from "./components/AccountCard";
import { AutoSwitchDialog } from "./components/AutoSwitchDialog";
import { ControlBar } from "./components/ControlBar";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { EmptyState } from "./components/EmptyState";
import { NoticeToast } from "./components/NoticeToast";
import { PageTabs } from "./components/PageTabs";
import { SettingsPanel } from "./components/SettingsPanel";
import { ShellHeader } from "./components/ShellHeader";

import { translations } from "./constants/i18n";
import {
  SAGE_THEME_STORAGE_KEY,
  getSageThemeVariables,
  isSageThemeColor,
} from "./constants/theme";
import type { SageThemeColor } from "./constants/theme";

import { useAccounts } from "./hooks/useAccounts";
import { useAutoSwitch } from "./hooks/useAutoSwitch";

import {
  DEFAULT_AUTO_SWITCH_STRATEGY,
  DEFAULT_NOTIFICATION_SETTINGS,
  REFRESH_INTERVAL_OPTIONS,
} from "./types";
import type {
  Account,
  AccountFilter,
  AccountSortKey,
  AppBackupPayload,
  DiagnosticLogEntry,
  DiagnosticLogInput,
  Lang,
  NotificationKind,
  NotificationSettings,
  OAuthErrorPayload,
  RefreshIntervalMinutes,
  SecureStorageStatus,
  SystemNotificationIntent,
} from "./types";
import {
  formatResetTime,
  formatTimestamp,
  getAttentionCount,
  getAutoSwitchCause,
  getFilteredAccounts,
  getReadyCount,
  groupAccounts,
} from "./utils/account-display";

const MAX_DIAGNOSTIC_LOGS = 120;
type AppPage = "accounts" | "strategy" | "system";

/**
 * 从本地偏好读取 Sage 主题色；异常值统一回落到 teal，避免坏缓存污染界面变量。
 */
function readStoredThemeColor(): SageThemeColor {
  const storedValue = window.localStorage.getItem(SAGE_THEME_STORAGE_KEY);

  return isSageThemeColor(storedValue) ? storedValue : "teal";
}

/**
 * 计算当前时间是否处于通知静默时段内。
 *
 * @param settings 当前通知配置。
 */
function isWithinQuietHours(settings: NotificationSettings): boolean {
  if (!settings.quietHoursEnabled) {
    return false;
  }

  const [startHour = "0", startMinute = "0"] = settings.quietHoursStart.split(":");
  const [endHour = "0", endMinute = "0"] = settings.quietHoursEnd.split(":");
  const start = Number(startHour) * 60 + Number(startMinute);
  const end = Number(endHour) * 60 + Number(endMinute);
  const now = new Date();
  const current = now.getHours() * 60 + now.getMinutes();

  if (start === end) {
    return true;
  }

  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

/**
 * 应用主界面，负责串联账号数据、筛选、设置、诊断与自动切换。
 */
function App() {
  const [lang, setLang] = useState<Lang>("EN");
  const [langReady, setLangReady] = useState(false);
  const [page, setPage] = useState<AppPage>("accounts");
  const [themeColor, setThemeColor] =
    useState<SageThemeColor>(readStoredThemeColor);
  const [filter, setFilter] = useState<AccountFilter>("all");
  const [sortKey, setSortKey] = useState<AccountSortKey>("priority");
  const [searchQuery, setSearchQuery] = useState("");
  const [launchAtLoginEnabled, setLaunchAtLoginEnabled] = useState(false);
  const [refreshIntervalMinutes, setRefreshIntervalMinutes] =
    useState<RefreshIntervalMinutes>(3);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [repairingId, setRepairingId] = useState<string | null>(null);
  const [skipAutoSwitchConfirm, setSkipAutoSwitchConfirm] = useState(false);
  const [autoSwitchStrategy, setAutoSwitchStrategy] = useState(
    DEFAULT_AUTO_SWITCH_STRATEGY,
  );
  const [notificationSettings, setNotificationSettings] = useState(
    DEFAULT_NOTIFICATION_SETTINGS,
  );
  const [pinnedAccountIds, setPinnedAccountIds] = useState<string[]>([]);
  const [diagnosticLogs, setDiagnosticLogs] = useState<DiagnosticLogEntry[]>([]);
  const [secureStorageStatus, setSecureStorageStatus] =
    useState<SecureStorageStatus>({
      available: false,
      mode: "base64-fallback",
    });
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [noticeNonce, setNoticeNonce] = useState(0);

  /**
   * 统一追加诊断日志，并限制日志总数，避免面板长期累积无上限增长。
   *
   * @param entry 需要记录的日志内容。
   */
  const appendDiagnosticLog = useCallback((entry: DiagnosticLogInput): void => {
    setDiagnosticLogs((previous) => {
      const nextEntry: DiagnosticLogEntry = {
        id: entry.id ?? crypto.randomUUID(),
        timestamp: entry.timestamp ?? new Date().toISOString(),
        ...entry,
      };

      return [...previous, nextEntry].slice(-MAX_DIAGNOSTIC_LOGS);
    });
  }, []);

  const {
    accounts,
    setAccounts,
    usageHistory,
    setUsageHistory,
    activeId,
    setActiveId,
    isRefreshing,
    refreshingIds,
    refreshAll,
    handleRefreshOne,
    lastUpdateAt,
  } = useAccounts({
    lang,
    refreshIntervalMinutes,
    appendDiagnosticLog,
  });

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
      // 偏好项统一初始化，避免首屏出现多次闪动或功能先后失效。
      const [
        savedLang,
        savedLaunchAtLoginEnabled,
        savedSkipAutoSwitchConfirm,
        savedRefreshIntervalMinutes,
        savedAutoSwitchStrategy,
        savedNotificationSettings,
        savedPinnedAccountIds,
        savedDiagnosticLogs,
        nextSecureStorageStatus,
      ] = await Promise.all([
        window.codexAPI.getLang(),
        window.codexAPI.getLaunchAtLoginEnabled(),
        window.codexAPI.getSkipAutoSwitchConfirm(),
        window.codexAPI.getRefreshIntervalMinutes(),
        window.codexAPI.getAutoSwitchStrategy(),
        window.codexAPI.getNotificationSettings(),
        window.codexAPI.getPinnedAccountIds(),
        window.codexAPI.getDiagnosticLogs(),
        window.codexAPI.getSecureStorageStatus(),
      ]);

      if (!mounted) return;

      if (savedLang) setLang(savedLang);
      setLaunchAtLoginEnabled(Boolean(savedLaunchAtLoginEnabled));
      setSkipAutoSwitchConfirm(Boolean(savedSkipAutoSwitchConfirm));
      setRefreshIntervalMinutes(
        normalizeRefreshInterval(savedRefreshIntervalMinutes),
      );
      setAutoSwitchStrategy(
        savedAutoSwitchStrategy ?? DEFAULT_AUTO_SWITCH_STRATEGY,
      );
      setNotificationSettings(
        savedNotificationSettings ?? DEFAULT_NOTIFICATION_SETTINGS,
      );
      setPinnedAccountIds(savedPinnedAccountIds ?? []);
      setDiagnosticLogs(savedDiagnosticLogs ?? []);
      setSecureStorageStatus(nextSecureStorageStatus);
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
      void window.codexAPI.setLaunchAtLoginEnabled(launchAtLoginEnabled);
    }
  }, [launchAtLoginEnabled, preferencesReady]);

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

  useEffect(() => {
    if (preferencesReady) {
      void window.codexAPI.setAutoSwitchStrategy(autoSwitchStrategy);
    }
  }, [autoSwitchStrategy, preferencesReady]);

  useEffect(() => {
    if (preferencesReady) {
      void window.codexAPI.setNotificationSettings(notificationSettings);
    }
  }, [notificationSettings, preferencesReady]);

  useEffect(() => {
    if (preferencesReady) {
      void window.codexAPI.setPinnedAccountIds(pinnedAccountIds);
    }
  }, [pinnedAccountIds, preferencesReady]);

  useEffect(() => {
    if (preferencesReady) {
      void window.codexAPI.setDiagnosticLogs(diagnosticLogs);
    }
  }, [diagnosticLogs, preferencesReady]);

  useEffect(() => {
    window.localStorage.setItem(SAGE_THEME_STORAGE_KEY, themeColor);
  }, [themeColor]);

  const filteredAccounts = useMemo(
    () => getFilteredAccounts(accounts, filter, searchQuery),
    [accounts, filter, searchQuery],
  );
  const groupedAccounts = useMemo(() => {
    return groupAccounts(filteredAccounts, activeId, {
      sortKey,
      pinnedAccountIds,
    });
  }, [activeId, filteredAccounts, pinnedAccountIds, sortKey]);

  const activeAccount = useMemo(() => {
    return accounts.find((account) => account.id === activeId) || null;
  }, [accounts, activeId]);

  const readyCount = useMemo(() => getReadyCount(accounts), [accounts]);
  const attentionCount = useMemo(() => getAttentionCount(accounts), [accounts]);
  const excludedCount = autoSwitchStrategy.excludedAccountIds.length;
  const lastUpdatedLabel = useMemo(() => {
    const formatted = formatTimestamp(lastUpdateAt, lang);
    return t.lastUpdated(formatted || t.meta.never);
  }, [lang, lastUpdateAt, t]);
  const themeVariables = useMemo(
    () => getSageThemeVariables(themeColor),
    [themeColor],
  );

  /**
   * 展示短时轻提示，并在重复点击同一消息时重置消失计时。
   *
   * @param message 需要提示的文案。
   */
  const showNotice = useCallback((message: string): void => {
    setNoticeMessage(message);
    setNoticeNonce((value) => value + 1);
  }, []);

  /**
   * 判断当前类型的系统通知是否允许发出，并统一处理静默时段。
   *
   * @param kind 通知分类。
   * @param title 通知标题。
   * @param body 通知正文。
   * @param intent 点击通知后的意图。
   */
  const showManagedSystemNotification = useCallback(
    (
      kind: NotificationKind,
      title: string,
      body: string,
      intent: SystemNotificationIntent,
    ): boolean => {
      if (!notificationSettings[kind]) {
        return false;
      }

      if (isWithinQuietHours(notificationSettings)) {
        return false;
      }

      if (
        typeof window.Notification !== "undefined" &&
        window.Notification.permission === "denied"
      ) {
        return false;
      }

      window.codexAPI.showSystemNotification({ title, body, intent });
      return true;
    },
    [notificationSettings],
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
   * 切换当前激活账号，并在成功后持久化选择结果与最近切换时间。
   */
  const handleSwitchAccount = useCallback(
    async (account: Account): Promise<boolean> => {
      if (switchingId) return false;

      setSwitchingId(account.id);
      try {
        const switchedAt = new Date().toISOString();
        const nextAccounts = accounts.map((item) =>
          item.id === account.id ? { ...item, last_switched_at: switchedAt } : item,
        );
        const previousActiveId = activeId;

        setAccounts(nextAccounts);
        await window.codexAPI.setAccounts(nextAccounts);
        await window.codexAPI.setActiveId(account.id);

        const result = await window.codexAPI.switchAccount(account);
        if (result?.success) {
          setActiveId(account.id);
          appendDiagnosticLog({
            level: "info",
            category: "switch",
            message: `已手动切换到账号 ${account.email}。`,
            accountId: account.id,
            email: account.email,
          });
          return true;
        }

        setAccounts(accounts);
        await window.codexAPI.setAccounts(accounts);
        await window.codexAPI.setActiveId(previousActiveId);
        appendDiagnosticLog({
          level: "warning",
          category: "switch",
          message: `切换到账号 ${account.email} 失败。`,
          accountId: account.id,
          email: account.email,
        });
        return false;
      } finally {
        setSwitchingId(null);
      }
    },
    [accounts, activeId, appendDiagnosticLog, setAccounts, setActiveId, switchingId],
  );

  /**
   * 删除账号时同步修正当前激活状态及相关策略数据，避免残留脏引用。
   */
  const handleDeleteAccount = useCallback(
    (account: Account): void => {
      if (!window.confirm(t.removeConfirm)) return;

      const nextAccounts = accounts.filter((item) => item.id !== account.id);
      setAccounts(nextAccounts);
      setUsageHistory((previous) => {
        const nextHistory = { ...previous };
        delete nextHistory[account.id];
        return nextHistory;
      });
      setPinnedAccountIds((previous) =>
        previous.filter((item) => item !== account.id),
      );
      setAutoSwitchStrategy((previous) => ({
        ...previous,
        excludedAccountIds: previous.excludedAccountIds.filter(
          (item) => item !== account.id,
        ),
      }));

      if (account.id === activeId) {
        setActiveId(nextAccounts[0]?.id ?? null);
      }

      appendDiagnosticLog({
        level: "info",
        category: "settings",
        message: `已移除账号 ${account.email}。`,
        accountId: account.id,
        email: account.email,
      });
    },
    [
      accounts,
      activeId,
      appendDiagnosticLog,
      setAccounts,
      setActiveId,
      setUsageHistory,
      t.removeConfirm,
    ],
  );

  const handleToggleLang = useCallback((): void => {
    setLang((currentLang) => (currentLang === "EN" ? "ZH" : "EN"));
  }, []);

  /**
   * 触发 OAuth 流程，交给主进程拉起外部浏览器登录。
   */
  const handleAddAccount = useCallback((): void => {
    appendDiagnosticLog({
      level: "info",
      category: "oauth",
      message: "已发起新的账号登录流程。",
    });
    window.codexAPI.startOAuth();
  }, [appendDiagnosticLog]);

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
            ? Math.max(account.reset_5h ?? 0, account.reset_week ?? 0) ||
              undefined
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

  /**
   * 切换账号置顶状态，用于排序和自动切换优先级控制。
   *
   * @param account 目标账号。
   */
  const handleTogglePin = useCallback(
    (account: Account): void => {
      const isPinned = pinnedAccountIds.includes(account.id);
      const nextPinnedIds = isPinned
        ? pinnedAccountIds.filter((item) => item !== account.id)
        : [account.id, ...pinnedAccountIds];

      setPinnedAccountIds(nextPinnedIds);
      showNotice(isPinned ? t.actions.unpin : t.actions.pin);
      appendDiagnosticLog({
        level: "info",
        category: "settings",
        message: isPinned
          ? `账号 ${account.email} 已取消置顶。`
          : `账号 ${account.email} 已置顶。`,
        accountId: account.id,
        email: account.email,
      });
    },
    [appendDiagnosticLog, pinnedAccountIds, showNotice, t.actions.pin, t.actions.unpin],
  );

  /**
   * 切换账号是否参与自动切换候选池。
   *
   * @param account 目标账号。
   */
  const handleToggleExcludeAutoSwitch = useCallback(
    (account: Account): void => {
      const isExcluded = autoSwitchStrategy.excludedAccountIds.includes(account.id);
      const nextExcludedIds = isExcluded
        ? autoSwitchStrategy.excludedAccountIds.filter((item) => item !== account.id)
        : [...autoSwitchStrategy.excludedAccountIds, account.id];

      setAutoSwitchStrategy({
        ...autoSwitchStrategy,
        excludedAccountIds: nextExcludedIds,
      });
      appendDiagnosticLog({
        level: "info",
        category: "settings",
        message: isExcluded
          ? `账号 ${account.email} 已恢复参与自动切换。`
          : `账号 ${account.email} 已从自动切换候选中排除。`,
        accountId: account.id,
        email: account.email,
      });
    },
    [appendDiagnosticLog, autoSwitchStrategy],
  );

  /**
   * 为异常账号提供一键修复入口。
   * 优先尝试刷新状态；会话失效类问题再升级为浏览器重新登录。
   *
   * @param account 目标账号。
   */
  const handleRepairAccount = useCallback(
    async (account: Account): Promise<void> => {
      if (repairingId) {
        return;
      }

      setRepairingId(account.id);
      appendDiagnosticLog({
        level: "info",
        category: "repair",
        message: `开始修复账号 ${account.email}。`,
        accountId: account.id,
        email: account.email,
      });

      try {
        const updated = await handleRefreshOne(account);

        if (updated.status === "normal" || updated.status === "warning") {
          showNotice(t.repair.refreshed(updated.email));
          appendDiagnosticLog({
            level: "info",
            category: "repair",
            message: `账号 ${updated.email} 已恢复可用。`,
            accountId: updated.id,
            email: updated.email,
          });
          return;
        }

        if (updated.status === "expired" || updated.status === "disabled") {
          showNotice(t.repair.relogin(updated.email));
          appendDiagnosticLog({
            level: "warning",
            category: "repair",
            message: `账号 ${updated.email} 需要通过浏览器重新登录来完成修复。`,
            accountId: updated.id,
            email: updated.email,
          });
          window.codexAPI.startOAuth();
          return;
        }

        showNotice(t.repair.stillExhausted(updated.email));
        appendDiagnosticLog({
          level: "info",
          category: "repair",
          message: `账号 ${updated.email} 刷新后额度仍未恢复。`,
          accountId: updated.id,
          email: updated.email,
        });
      } finally {
        setRepairingId(null);
      }
    },
    [
      appendDiagnosticLog,
      handleRefreshOne,
      repairingId,
      showNotice,
      t.repair,
    ],
  );

  /**
   * 导出当前应用状态，便于迁移到新设备或回滚本地配置。
   */
  const handleExportBackup = useCallback(async (): Promise<void> => {
    const backupPayload: AppBackupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        accounts,
        activeId,
        lang,
        launchAtLoginEnabled,
        skipAutoSwitchConfirm,
        refreshIntervalMinutes,
        autoSwitchStrategy,
        notificationSettings,
        pinnedAccountIds,
        usageHistory,
        diagnosticLogs,
      },
    };

    const result = await window.codexAPI.exportAppBackup(backupPayload);
    if (result.success) {
      showNotice(t.backup.exportSuccess);
      appendDiagnosticLog({
        level: "info",
        category: "backup",
        message: "当前配置已导出为备份文件。",
      });
      return;
    }

    if (result.error !== "cancelled") {
      showNotice(t.backup.exportFailed);
      appendDiagnosticLog({
        level: "error",
        category: "backup",
        message: `导出备份失败：${result.error || "unknown"}`,
      });
    }
  }, [
    accounts,
    activeId,
    appendDiagnosticLog,
    autoSwitchStrategy,
    diagnosticLogs,
    lang,
    launchAtLoginEnabled,
    notificationSettings,
    pinnedAccountIds,
    refreshIntervalMinutes,
    showNotice,
    skipAutoSwitchConfirm,
    t.backup,
    usageHistory,
  ]);

  /**
   * 导入备份并覆盖当前本地状态。
   */
  const handleImportBackup = useCallback(async (): Promise<void> => {
    if (!window.confirm(t.settings.importConfirm)) {
      return;
    }

    const result = await window.codexAPI.importAppBackup();
    if (!result.success) {
      showNotice(t.backup.importFailed);
      appendDiagnosticLog({
        level: "error",
        category: "backup",
        message: `导入备份失败：${result.error || "unknown"}`,
      });
      return;
    }

    if (!result.data) {
      return;
    }

    const backup = result.data.data;

    setAccounts(backup.accounts);
    setActiveId(backup.activeId);
    setLang(backup.lang);
    setLaunchAtLoginEnabled(Boolean(backup.launchAtLoginEnabled));
    setSkipAutoSwitchConfirm(backup.skipAutoSwitchConfirm);
    setRefreshIntervalMinutes(backup.refreshIntervalMinutes);
    setAutoSwitchStrategy(backup.autoSwitchStrategy);
    setNotificationSettings(backup.notificationSettings);
    setPinnedAccountIds(backup.pinnedAccountIds);
    setUsageHistory(backup.usageHistory);
    setDiagnosticLogs([
      ...backup.diagnosticLogs,
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        level: "info" as const,
        category: "backup" as const,
        message: "已成功导入备份并覆盖当前本地状态。",
      },
    ].slice(-MAX_DIAGNOSTIC_LOGS));
    setPage("system");
    showNotice(t.backup.importSuccess);
  }, [
    appendDiagnosticLog,
    setAccounts,
    setActiveId,
    setUsageHistory,
    showNotice,
    t.backup.importFailed,
    t.backup.importSuccess,
    t.settings.importConfirm,
  ]);

  /**
   * 根据设置更新单项通知偏好。
   *
   * @param key 配置键。
   * @param value 新值。
   */
  const handleNotificationChange = useCallback(
    (
      key:
        | NotificationKind
        | "quietHoursEnabled"
        | "quietHoursStart"
        | "quietHoursEnd",
      value: boolean | string,
    ): void => {
      setNotificationSettings((previous) => ({
        ...previous,
        [key]: value,
      }));
    },
    [],
  );

  /**
   * 更新开机自启偏好，并记录设置变更，方便排查系统登录项是否同步成功。
   *
   * @param value 是否启用开机自启。
   */
  const handleLaunchAtLoginChange = useCallback(
    (value: boolean): void => {
      setLaunchAtLoginEnabled(value);
      appendDiagnosticLog({
        level: "info",
        category: "settings",
        message: value ? "已启用开机自启。" : "已关闭开机自启。",
      });
    },
    [appendDiagnosticLog],
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

      const shown = showManagedSystemNotification(
        "oauthError",
        t.oauth.title,
        message,
        "show-window",
      );

      appendDiagnosticLog({
        level: "warning",
        category: "oauth",
        message,
      });

      if (!shown) {
        showNotice(message);
      }
    };

    return window.codexAPI.onOAuthError(handleOAuthError);
  }, [appendDiagnosticLog, showManagedSystemNotification, showNotice, t.oauth]);

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
    autoSwitchStrategy,
    pinnedAccountIds,
    skipAutoSwitchConfirm,
    setSkipAutoSwitchConfirm,
    handleSwitchAccount,
    appendDiagnosticLog,
    showSystemNotification: showManagedSystemNotification,
    getAccountDisplayName,
    t,
  });

  const renderAccountsContent = (): ReactNode => {
    return (
      <>
        <section className="overview-strip">
          <article className="overview-card">
            <span className="overview-label">{t.stats.total}</span>
            <strong className="overview-value">{accounts.length}</strong>
          </article>
          <article className="overview-card">
            <span className="overview-label">{t.stats.ready}</span>
            <strong className="overview-value">{readyCount}</strong>
          </article>
          <article className="overview-card">
            <span className="overview-label">{t.stats.attention}</span>
            <strong className="overview-value">{attentionCount}</strong>
          </article>
        </section>

        <ControlBar
          filter={filter}
          resultCount={filteredAccounts.length}
          searchValue={searchQuery}
          sortKey={sortKey}
          translations={t}
          onFilterChange={setFilter}
          onSearchChange={setSearchQuery}
          onSortChange={setSortKey}
        />

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
                    historyPoints={usageHistory[account.id] ?? []}
                    isActive={activeId === account.id}
                    isExcludedFromAutoSwitch={autoSwitchStrategy.excludedAccountIds.includes(
                      account.id,
                    )}
                    isPinned={pinnedAccountIds.includes(account.id)}
                    isRefreshing={refreshingIds.has(account.id)}
                    isRepairing={repairingId === account.id}
                    isSwitching={switchingId === account.id}
                    translations={t}
                    resetText={formatResetTime(
                      account.reset_week || account.reset_5h,
                      lang,
                    )}
                    reset5hText={formatResetTime(account.reset_5h, lang)}
                    resetWeekText={formatResetTime(account.reset_week, lang)}
                    onDelete={handleDeleteAccount}
                    onRefresh={(currentAccount) => {
                      void handleRefreshOne(currentAccount);
                    }}
                    onRepair={(currentAccount) => {
                      void handleRepairAccount(currentAccount);
                    }}
                    onSwitch={handleSwitchAccount}
                    onToggleExcludeAutoSwitch={handleToggleExcludeAutoSwitch}
                    onTogglePin={handleTogglePin}
                    onUnavailableSwitchAttempt={handleUnavailableSwitchAttempt}
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
              accounts.length > 0
                ? () => {
                    setFilter("all");
                    setSearchQuery("");
                  }
                : handleAddAccount
            }
          />
        )}
      </>
    );
  };

  const renderStrategyContent = (): ReactNode => {
    return (
      <>
        <section className="page-caption">
          <div>
            <h2 className="page-caption-title">{t.pages.strategyTitle}</h2>
            <p className="page-caption-description">{t.pages.strategyDescription}</p>
          </div>
        </section>

        <SettingsPanel
          autoSwitchStrategy={autoSwitchStrategy}
          excludedCount={excludedCount}
          launchAtLoginEnabled={launchAtLoginEnabled}
          notificationSettings={notificationSettings}
          pinnedCount={pinnedAccountIds.length}
          refreshIntervalMinutes={refreshIntervalMinutes}
          secureStorageStatus={secureStorageStatus}
          skipAutoSwitchConfirm={skipAutoSwitchConfirm}
          translations={t}
          onExport={() => void handleExportBackup()}
          onImport={() => void handleImportBackup()}
          onLaunchAtLoginChange={handleLaunchAtLoginChange}
          onNotificationChange={handleNotificationChange}
          onRefreshIntervalChange={setRefreshIntervalMinutes}
          onSkipAutoSwitchConfirmChange={setSkipAutoSwitchConfirm}
          onStrategyChange={setAutoSwitchStrategy}
          sections={["strategy", "notifications"]}
          showHeader={false}
        />
      </>
    );
  };

  const renderSystemContent = (): ReactNode => {
    return (
      <>
        <section className="page-caption">
          <div>
            <h2 className="page-caption-title">{t.pages.systemTitle}</h2>
            <p className="page-caption-description">{t.pages.systemDescription}</p>
          </div>
        </section>

        <div className="system-layout">
          <SettingsPanel
            autoSwitchStrategy={autoSwitchStrategy}
            excludedCount={excludedCount}
            launchAtLoginEnabled={launchAtLoginEnabled}
            notificationSettings={notificationSettings}
            pinnedCount={pinnedAccountIds.length}
            refreshIntervalMinutes={refreshIntervalMinutes}
            secureStorageStatus={secureStorageStatus}
            skipAutoSwitchConfirm={skipAutoSwitchConfirm}
            translations={t}
            onExport={() => void handleExportBackup()}
            onImport={() => void handleImportBackup()}
            onLaunchAtLoginChange={handleLaunchAtLoginChange}
            onNotificationChange={handleNotificationChange}
            onRefreshIntervalChange={setRefreshIntervalMinutes}
            onSkipAutoSwitchConfirmChange={setSkipAutoSwitchConfirm}
            onStrategyChange={setAutoSwitchStrategy}
            onThemeColorChange={setThemeColor}
            sections={["appearance", "backup", "security"]}
            showHeader={false}
            themeColor={themeColor}
          />

          <DiagnosticsPanel
            logs={diagnosticLogs}
            translations={t}
            onClear={() => setDiagnosticLogs([])}
          />
        </div>
      </>
    );
  };

  return (
    <div
      className="app-shell"
      data-theme-color={themeColor}
      style={themeVariables}
    >
      <div className="app-background app-background--one" />
      <div className="app-background app-background--two" />

      <ShellHeader
        activeLabel={
          activeAccount ? getAccountDisplayName(activeAccount) : t.meta.inactive
        }
        isRefreshing={isRefreshing}
        lang={lang}
        lastUpdatedLabel={lastUpdatedLabel}
        onAddAccount={handleAddAccount}
        onQuit={() => window.codexAPI.quitApp()}
        onRefreshAll={refreshAll}
        onToggleLang={handleToggleLang}
        translations={t}
      />

      <PageTabs currentPage={page} onChange={setPage} translations={t} />

      <main className="scroll-area no-drag">
        <div className="page-stack">
          {page === "accounts"
            ? renderAccountsContent()
            : page === "strategy"
              ? renderStrategyContent()
              : renderSystemContent()}
        </div>
      </main>

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
