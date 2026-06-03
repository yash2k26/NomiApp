import { useNotificationCenter, type AppNotification, type NotificationSeverity, type NotificationDetailRow } from '../store/notificationCenterStore';

/*
 * Ergonomic wrapper for the notification center store. Use anywhere — store
 * actions, components, services. Always pushes a toast AND a persistent
 * notification unless `toast: false` is passed.
 *
 * Usage:
 *   notify.success('Pet minted', '0.15 SOL deducted', { details: [...] });
 *   notify.error('Purchase failed', friendlyTxError(err));
 *   notify.warning('Daily cap reached', 'Adventure coins reset at midnight UTC');
 *   notify.info('Restoring from chain', undefined, { toast: false });
 *
 * The 4 severities map to fixed visual styling — see ToastHost / Modal for
 * the palette. Categories are optional and only used by future filtering.
 */

interface NotifyOptions {
  details?: NotificationDetailRow[];
  category?: AppNotification['category'];
  toast?: boolean;
  /** When set, the notification body renders a tappable "View on Solscan"
   *  link. Critical trust signal for any tx-related success/error — users
   *  expect immediate verifiable proof. */
  solscanTxSignature?: string;
}

function push(severity: NotificationSeverity, title: string, body?: string, opts: NotifyOptions = {}): string {
  return useNotificationCenter.getState().pushNotification({
    severity,
    title,
    body,
    details: opts.details,
    category: opts.category,
    solscanTxSignature: opts.solscanTxSignature,
    toast: opts.toast ?? true,
  });
}

export const notify = {
  success: (title: string, body?: string, opts?: NotifyOptions) => push('success', title, body, opts),
  error: (title: string, body?: string, opts?: NotifyOptions) => push('error', title, body, opts),
  warning: (title: string, body?: string, opts?: NotifyOptions) => push('warning', title, body, opts),
  info: (title: string, body?: string, opts?: NotifyOptions) => push('info', title, body, opts),
};

/**
 * Truncate a Solana address or transaction signature for display.
 * Used in notification details so signatures fit on one line.
 */
export function truncateMid(value: string, head = 4, tail = 4): string {
  if (!value || value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
