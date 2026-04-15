import * as Lucide from "lucide-react";

interface Props {
  message: string;
}

/**
 * 轻量提示条，用于承载不会打断主流程的短消息。
 */
export function NoticeToast({ message }: Props) {
  return (
    <div
      aria-live="polite"
      className="notice-toast no-drag"
      role="status"
    >
      <span className="notice-toast-icon" aria-hidden="true">
        <Lucide.Info size={15} />
      </span>
      <span className="notice-toast-message">{message}</span>
    </div>
  );
}
