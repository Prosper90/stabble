import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { RPC_URL } from "@/lib/solana";

export async function GET(req: NextRequest) {
  const address = (req.nextUrl.searchParams.get("address") ?? "").trim();
  if (!address) return NextResponse.json({ error: "address param required" }, { status: 400 });

  const connection = new Connection(RPC_URL, "confirmed");

  const sigs = await connection.getSignaturesForAddress(new PublicKey(address), { limit: 10 });
  if (sigs.length === 0) {
    return NextResponse.json({ address, sigCount: 0, message: "No transactions found for this address" });
  }

  type TxResult =
    | { signature: string; accounts: string[]; tokenAccountOwners: { phase: string; accountIndex: number; account: string; mint: string; owner: string | undefined; amount: string | undefined | null }[] }
    | { signature: string; error: string };
  const txDetails: TxResult[] = [];

  for (const { signature } of sigs.slice(0, 5)) {
    try {
      const tx = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });
      if (!tx) continue;

      const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
      const tokenBalances = [
        ...(tx.meta?.preTokenBalances ?? []).map((b) => ({ ...b, phase: "pre" })),
        ...(tx.meta?.postTokenBalances ?? []).map((b) => ({ ...b, phase: "post" })),
      ].map((b) => ({
        phase: b.phase,
        accountIndex: b.accountIndex,
        account: keys[b.accountIndex],
        mint: b.mint,
        owner: b.owner,
        amount: b.uiTokenAmount?.uiAmountString,
      }));

      // Deduplicate by account
      const seen = new Set<string>();
      const uniqueTokenAccounts = tokenBalances.filter((b) => {
        if (seen.has(b.account)) return false;
        seen.add(b.account);
        return true;
      });

      txDetails.push({
        signature,
        accounts: keys,
        tokenAccountOwners: uniqueTokenAccounts,
      });
    } catch (e) {
      txDetails.push({ signature, error: String(e) });
    }
  }

  // Tally all unique owners seen across all transactions
  const ownerFreq = new Map<string, number>();
  for (const tx of txDetails) {
    if ("tokenAccountOwners" in tx) {
      for (const b of tx.tokenAccountOwners) {
        if (b.owner) ownerFreq.set(b.owner, (ownerFreq.get(b.owner) ?? 0) + 1);
      }
    }
  }

  return NextResponse.json({
    address,
    sigCount: sigs.length,
    txDetails,
    ownerFrequency: Object.fromEntries([...ownerFreq.entries()].sort((a, b) => b[1] - a[1])),
  });
}
