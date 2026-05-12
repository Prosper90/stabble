import { Connection, PublicKey } from "@solana/web3.js";
import { getAccount, getMint } from "@solana/spl-token";

export interface PoolAsset {
  vault: string;
  mint: string;
  amount: number;
  decimals: number;
}

export interface PoolSnapshot {
  timestamp: number;
  poolAddress: string;
  assets: PoolAsset[];
}

function getRpcUrl(): string {
  const url = process.env.RPC_URL ?? "";
  if (!url) throw new Error("RPC_URL env var is not set");
  return url;
}

async function discoverPoolVaults(connection: Connection, poolAddress: string): Promise<string[]> {
  const sigs = await connection.getSignaturesForAddress(new PublicKey(poolAddress), { limit: 10 });
  if (sigs.length === 0) return [];

  const txFreq = new Map<string, number>();
  const toProcess = sigs.slice(0, 8);

  for (const { signature } of toProcess) {
    try {
      const tx = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });
      const keys = tx?.transaction.message.accountKeys ?? [];
      const balances = [
        ...(tx?.meta?.preTokenBalances ?? []),
        ...(tx?.meta?.postTokenBalances ?? []),
      ];
      const seenInTx = new Set<string>();
      for (const b of balances) {
        const addr = keys[b.accountIndex]?.pubkey.toBase58();
        if (addr && !seenInTx.has(addr)) {
          seenInTx.add(addr);
          txFreq.set(addr, (txFreq.get(addr) ?? 0) + 1);
        }
      }
    } catch {
      // skip failed tx
    }
  }

  const threshold = Math.max(2, Math.ceil(toProcess.length * 0.6));
  return [...txFreq.entries()]
    .filter(([, count]) => count >= threshold)
    .map(([addr]) => addr);
}

export async function fetchPool(poolAddress: string): Promise<PoolSnapshot> {
  const connection = new Connection(getRpcUrl(), "confirmed");

  const vaultAddresses = await discoverPoolVaults(connection, poolAddress);
  if (vaultAddresses.length === 0) {
    return { timestamp: Date.now(), poolAddress, assets: [] };
  }

  const assets: PoolAsset[] = [];
  for (const vaultAddr of vaultAddresses) {
    try {
      const tokenAccount = await getAccount(connection, new PublicKey(vaultAddr));
      const mint = await getMint(connection, tokenAccount.mint);
      const amount = Number(tokenAccount.amount) / 10 ** mint.decimals;
      assets.push({
        vault: vaultAddr,
        mint: tokenAccount.mint.toBase58(),
        amount,
        decimals: mint.decimals,
      });
    } catch {
      // vault unreachable
    }
  }

  return { timestamp: Date.now(), poolAddress, assets };
}
