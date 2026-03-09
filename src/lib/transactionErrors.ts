/**
 * Parses raw Solana/wallet transaction errors into user-friendly messages.
 * Used across MintScreen, ShopScreen, PremiumCard, and anywhere Phantom is involved.
 */

export interface ParsedTxError {
  title: string;
  message: string;
  type: 'insufficient_funds' | 'cancelled' | 'network' | 'timeout' | 'simulation' | 'generic';
}

export function parseTxError(error: any): ParsedTxError {
  const raw = String(error?.message ?? error ?? '').toLowerCase();
  const fullStr = String(error?.message ?? error ?? '');

  // User rejected / cancelled in wallet
  if (
    raw.includes('user rejected') ||
    raw.includes('declined') ||
    raw.includes('cancelled') ||
    raw.includes('canceled') ||
    raw.includes('user denied')
  ) {
    return {
      title: 'Transaction Cancelled',
      message: 'You cancelled the transaction in your wallet. No charges were made.',
      type: 'cancelled',
    };
  }

  // Insufficient funds / balance
  if (
    raw.includes('insufficient lamports') ||
    raw.includes('insufficient funds') ||
    raw.includes('insufficient balance') ||
    raw.includes('0x1') // custom program error for insufficient funds
  ) {
    // Try to extract required amount from error
    const needMatch = fullStr.match(/need\s+(\d+)/);
    const haveMatch = fullStr.match(/insufficient lamports\s+(\d+)/);
    let extra = '';
    if (needMatch) {
      const needSol = (parseInt(needMatch[1], 10) / 1e9).toFixed(4);
      extra = ` You need at least ~${needSol} SOL to complete this transaction.`;
    }
    return {
      title: 'Not Enough SOL',
      message: `Your wallet doesn't have enough SOL to cover this transaction and network fees.${extra} Please add more SOL and try again.`,
      type: 'insufficient_funds',
    };
  }

  // Simulation failed (often wraps other errors, but catch separately)
  if (raw.includes('simulation failed') || raw.includes('simulate')) {
    // Check if it's actually an insufficient funds wrapped in simulation
    if (raw.includes('insufficient lamports') || raw.includes('0x1')) {
      const needMatch = fullStr.match(/need\s+(\d+)/);
      let extra = '';
      if (needMatch) {
        const needSol = (parseInt(needMatch[1], 10) / 1e9).toFixed(4);
        extra = ` You need at least ~${needSol} SOL.`;
      }
      return {
        title: 'Not Enough SOL',
        message: `Your wallet doesn't have enough SOL for this transaction.${extra} Please top up and try again.`,
        type: 'insufficient_funds',
      };
    }
    return {
      title: 'Transaction Failed',
      message: 'The transaction couldn\'t be processed. This usually means something changed on-chain. Please try again.',
      type: 'simulation',
    };
  }

  // Network / connectivity errors
  if (
    raw.includes('network request failed') ||
    raw.includes('fetch failed') ||
    raw.includes('failed to fetch') ||
    raw.includes('xhr') ||
    raw.includes('econnreset') ||
    raw.includes('enotfound') ||
    raw.includes('socket hang up')
  ) {
    return {
      title: 'Connection Error',
      message: 'Couldn\'t reach the Solana network. Please check your internet connection and try again.',
      type: 'network',
    };
  }

  // Timeout
  if (raw.includes('timed out') || raw.includes('timeout') || raw.includes('expired')) {
    return {
      title: 'Transaction Timed Out',
      message: 'The transaction took too long to confirm. It may still go through — check your wallet in a minute. If not, try again.',
      type: 'timeout',
    };
  }

  // Blockhash expired
  if (raw.includes('blockhash') && (raw.includes('not found') || raw.includes('expired') || raw.includes('no longer valid'))) {
    return {
      title: 'Transaction Expired',
      message: 'The transaction expired before it could be confirmed. This happens sometimes — please try again.',
      type: 'timeout',
    };
  }

  // Account already in use (e.g. already minted)
  if (raw.includes('already in use') || raw.includes('already initialized')) {
    return {
      title: 'Already Exists',
      message: 'This action was already completed. If you think this is wrong, please restart the app.',
      type: 'generic',
    };
  }

  // Generic fallback — keep it short and friendly
  return {
    title: 'Something Went Wrong',
    message: 'The transaction couldn\'t be completed. Please try again. If this keeps happening, check your wallet and internet connection.',
    type: 'generic',
  };
}

/** Shorthand: returns just the user-friendly message string */
export function friendlyTxError(error: any): string {
  const parsed = parseTxError(error);
  return parsed.message;
}
