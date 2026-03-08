import type { Connection } from '@solana/web3.js';

export interface RpcHealthSnapshot {
  endpoint: string;
  ok: boolean;
  version?: string;
  slot?: number;
  blockhash?: string;
  latencyMs?: number;
  error?: string;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function runRpcHealthCheck(
  endpoints: string[],
  connections: Connection[],
  timeoutMs = 7000,
): Promise<RpcHealthSnapshot[]> {
  const results: RpcHealthSnapshot[] = [];

  for (let i = 0; i < connections.length; i++) {
    const conn = connections[i];
    const endpoint = endpoints[i];
    const startedAt = Date.now();

    try {
      const [version, slot, blockhash] = await Promise.all([
        withTimeout(conn.getVersion(), timeoutMs),
        withTimeout(conn.getSlot('confirmed'), timeoutMs),
        withTimeout(conn.getLatestBlockhash('confirmed'), timeoutMs),
      ]);

      results.push({
        endpoint,
        ok: true,
        version: version['solana-core'],
        slot,
        blockhash: blockhash.blockhash,
        latencyMs: Date.now() - startedAt,
      });
    } catch (err: any) {
      results.push({
        endpoint,
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: err?.message ?? String(err),
      });
    }
  }

  return results;
}
