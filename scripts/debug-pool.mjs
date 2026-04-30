// Run: node scripts/debug-pool.mjs <pool-address>
import { Connection, PublicKey } from "@solana/web3.js";

const RPC_URL = "https://mainnet.helius-rpc.com/?api-key=4fae2b26-bc83-4c9f-84ea-76d2fbb04c9d";
const address = process.argv[2];

if (!address) {
  console.error("Usage: node scripts/debug-pool.mjs <pool-address>");
  process.exit(1);
}

const connection = new Connection(RPC_URL, "confirmed");

console.log(`\nFetching signatures for: ${address}\n`);
const sigs = await connection.getSignaturesForAddress(new PublicKey(address), { limit: 10 });
console.log(`Found ${sigs.length} signatures\n`);

if (sigs.length === 0) {
  console.log("No transactions found. This address may not be a pool, or it has no history.");
  process.exit(0);
}

const ownerFreq = new Map();
const accountFreq = new Map();

for (const { signature } of sigs.slice(0, 5)) {
  process.stdout.write(`Fetching tx ${signature.slice(0, 20)}...`);
  try {
    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    if (!tx) { console.log(" null"); continue; }

    const keys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
    const balances = [
      ...(tx.meta?.preTokenBalances ?? []),
      ...(tx.meta?.postTokenBalances ?? []),
    ];

    const seen = new Set();
    for (const b of balances) {
      const acct = keys[b.accountIndex];
      const owner = b.owner;
      if (acct && !seen.has(acct)) {
        seen.add(acct);
        accountFreq.set(acct, (accountFreq.get(acct) ?? 0) + 1);
        if (owner) ownerFreq.set(owner, (ownerFreq.get(owner) ?? 0) + 1);
      }
    }
    console.log(` OK (${balances.length} token balance entries)`);
  } catch (e) {
    console.log(` ERROR: ${e.message}`);
  }
}

console.log("\n── Token account owners (sorted by frequency) ──");
const sorted = [...ownerFreq.entries()].sort((a, b) => b[1] - a[1]);
if (sorted.length === 0) {
  console.log("  None found — transactions may have no token balance metadata");
} else {
  for (const [owner, count] of sorted) {
    console.log(`  ${count}x  ${owner}`);
  }
}

console.log("\n── Token accounts seen (sorted by frequency) ──");
const acctSorted = [...accountFreq.entries()].sort((a, b) => b[1] - a[1]);
for (const [acct, count] of acctSorted) {
  console.log(`  ${count}x  ${acct}`);
}
