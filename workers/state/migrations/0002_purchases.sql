-- Purchase ledger. Source of truth for premium tier and shop ownership.
-- Chain memos remain the immutable audit log but this table is what the
-- client reads on connect because it's fast and reliable.
--
-- Rows are append-only; we never delete (chain is forever, so this should
-- be forever too). De-duplication is handled at write time via UNIQUE on
-- (wallet, signature) — repeated POSTs with the same sig are idempotent.

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet TEXT NOT NULL,
  -- Type: 'premium' | 'shop' | 'mint'. Matches the memo type field for
  -- consistency with the existing client-side parsing logic.
  kind TEXT NOT NULL,
  -- For premium: 'plus' | 'pro'. For shop: shop item id. For mint: the
  -- minted NFT address. Free-form so we don't have to migrate the schema
  -- every time we add a tier or item.
  payload TEXT NOT NULL,
  -- On-chain transaction signature. UNIQUE so the same tx can't be
  -- recorded twice even if the client retries.
  signature TEXT NOT NULL UNIQUE,
  -- Currency the user paid with: 'SOL' | 'SKR' | 'coins'. Useful for
  -- analytics and for the client to render the right Solscan link.
  currency TEXT NOT NULL,
  -- Amount paid in the user's chosen currency. Lamports for SOL, raw
  -- units for SKR, integer count for coins.
  amount REAL NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchases_wallet ON purchases (wallet);
CREATE INDEX IF NOT EXISTS idx_purchases_wallet_kind ON purchases (wallet, kind);
