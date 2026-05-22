import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddressSync, getMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import {
  GovernoContext,
  Governo,
  Locker,
  Miner,
  RewarderContext,
  Pool,
} from "@stabbleorg/rewarder-sdk";
import { TreasuryBalance, LockerEntry, Snapshot, HolderEntry, HoldersSnapshot, PositionEntry, PositionsSnapshot, PoolAsset, PoolSnapshot } from "./types";

export const STB_MINT = "STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1";
const STB_DECIMALS = 9;

export const RPC_URL = process.env.RPC_URL ?? "";

export const KNOWN_WALLETS = [
  { source: "Multi Sig Treasury", address: "CqKDQSiJJ3sXv4BCUHHqbuScUAFQLvqfywe5b2NJJoVE", note: "Treasury" },
  { source: "Multi Sig Treasury", address: "STBuyENwJ1GP4yNZCjwavn92wYLEY3t5S1kVS5kwyS1", note: "Staking and Liquidity Mining" },
  { source: "Multi Sig Treasury", address: "SBQvwxMRJ8rLz8cQPDe6VJ3dboEec7Bgocw4F3c7vJJ", note: "Marketing Airdrops" },
  { source: "Stabble JBT Team allocation", address: "55Th9kAE3FW2ws3xfUu5dxa8Q5NjNrToezpDwW8NhrCB", note: "Team allocation" },
  { source: "Liquidity pool", address: "55Th9kAE3FW2ws3xfUu5dxa8Q5NjNrToezpDwW8NhrCB", note: "Buy back LP position" },
  { source: "Liquidity pool", address: "Gfdvs8KqEHjWEgZhW3nM2YHv2jXLWUVwgU9y3HArUT3g", note: "Buy back LP position" },
];

function makeProvider(connection: Connection): AnchorProvider {
  const dummyWallet = new Wallet(Keypair.generate());
  return new AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });
}

async function getStbBalance(connection: Connection, walletAddress: string): Promise<number> {
  try {
    const walletPubkey = new PublicKey(walletAddress);
    const mintPubkey = new PublicKey(STB_MINT);
    const ata = getAssociatedTokenAddressSync(mintPubkey, walletPubkey);
    const account = await getAccount(connection, ata);
    return Number(account.amount) / 10 ** STB_DECIMALS;
  } catch {
    return 0;
  }
}

async function fetchTreasuryBalances(connection: Connection): Promise<TreasuryBalance[]> {
  const results: TreasuryBalance[] = [];
  for (const wallet of KNOWN_WALLETS) {
    const tokenAmount = await getStbBalance(connection, wallet.address);
    results.push({ ...wallet, tokenAmount });
  }
  return results;
}

async function loadGoverno(
  connection: Connection
): Promise<{ context: GovernoContext; governo: Governo }> {
  const provider = makeProvider(connection);
  const context = new GovernoContext(provider);
  const allGovernos = await context.program.account.governo.all();
  const stbMint = STB_MINT.toLowerCase();
  const match = allGovernos.find(
    (g) => (g.account.govMint as PublicKey).toBase58().toLowerCase() === stbMint
  );
  if (!match) throw new Error(`No Governo account found for STB mint ${STB_MINT}`);
  const governo = new Governo(match.publicKey, match.account as never);
  return { context, governo };
}

async function fetchLockers(
  connection: Connection,
  governo: Governo,
  context: GovernoContext
): Promise<LockerEntry[]> {
  // loadLockers() defaults authorityAddress to the dummy wallet — query all directly
  const accounts = await context.program.account.locker.all([
    { memcmp: { offset: 8, bytes: governo.address.toBase58() } },
  ]);
  const lockers = accounts.map(
    ({ publicKey, account }) => new Locker(governo, publicKey, account as never)
  );
  return lockers.map((locker): LockerEntry => ({
    address: locker.address.toBase58(),
    ownerAddress: locker.ownerAddress.toBase58(),
    lockedAmount: locker.lockedAmount,
    votingWeight: locker.votingWeight,
    votingWeightUsed: locker.votingWeightUsed,
    lockedAt: locker.lockedAt.getTime() / 1000,
    unlocksAt: locker.unlocksAt.getTime() / 1000,
  }));
}

async function fetchTotalStaked(connection: Connection, rewarderAddress: PublicKey): Promise<number> {
  const dummyWallet = new Wallet(Keypair.generate());
  const provider = new AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });
  const rewarderContext = new RewarderContext(provider);
  const rewarder = await rewarderContext.loadRewarder(rewarderAddress);
  const pools: Pool[] = await rewarderContext.loadPoolsByRewarder(rewarder);
  const stbMint = STB_MINT.toLowerCase();
  return pools
    .filter((pool) => pool.mintAddress.toBase58().toLowerCase() === stbMint)
    .reduce((acc, pool) => acc + pool.totalAmount, 0);
}

async function fetchWalletHolders(connection: Connection): Promise<Map<string, number>> {
  const accounts = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
    filters: [
      { dataSize: 165 },
      { memcmp: { offset: 0, bytes: STB_MINT } },
    ],
    dataSlice: { offset: 32, length: 40 },
  });

  const result = new Map<string, number>();
  for (const { account } of accounts) {
    const data = account.data as Buffer;
    const owner = new PublicKey(data.slice(0, 32)).toBase58();
    const amount = Number(data.readBigUInt64LE(32)) / 10 ** STB_DECIMALS;
    if (amount > 0) {
      result.set(owner, (result.get(owner) ?? 0) + amount);
    }
  }
  return result;
}

export async function fetchPositions(): Promise<PositionsSnapshot> {
  const connection = new Connection(RPC_URL, "confirmed");
  const { governo, context: governoContext } = await loadGoverno(connection);

  const [lockerEntries, stakerMap] = await Promise.all([
    fetchLockers(connection, governo, governoContext),
    fetchStakerMap(connection, governo.rewarderAddress),
  ]);

  const byWallet = new Map<string, PositionEntry>();

  for (const [address, stakedAmount] of stakerMap) {
    byWallet.set(address, {
      address,
      stakedAmount,
      lockedAmount: 0,
      totalAmount: stakedAmount,
      categories: ["staker"],
    });
  }

  for (const locker of lockerEntries) {
    if (!locker.ownerAddress) continue;
    const existing = byWallet.get(locker.ownerAddress);
    if (existing) {
      existing.lockedAmount += locker.lockedAmount;
      existing.totalAmount += locker.lockedAmount;
      existing.unlocksAt = locker.unlocksAt;
      if (!existing.categories.includes("locker")) existing.categories.push("locker");
    } else {
      byWallet.set(locker.ownerAddress, {
        address: locker.ownerAddress,
        stakedAmount: 0,
        lockedAmount: locker.lockedAmount,
        totalAmount: locker.lockedAmount,
        unlocksAt: locker.unlocksAt,
        categories: ["locker"],
      });
    }
  }

  const entries = Array.from(byWallet.values()).sort(
    (a, b) => b.totalAmount - a.totalAmount
  );

  return { timestamp: Date.now(), entries };
}

async function fetchStakerMap(
  connection: Connection,
  rewarderAddress: PublicKey
): Promise<Map<string, number>> {
  const dummyWallet = new Wallet(Keypair.generate());
  const provider = new AnchorProvider(connection, dummyWallet, { commitment: "confirmed" });
  const rewarderContext = new RewarderContext(provider);
  const rewarder = await rewarderContext.loadRewarder(rewarderAddress);
  const allPools: Pool[] = await rewarderContext.loadPoolsByRewarder(rewarder);
  const stbMint = STB_MINT.toLowerCase();
  const stbPools = allPools.filter(
    (p) => p.mintAddress.toBase58().toLowerCase() === stbMint
  );
  if (stbPools.length === 0) return new Map();

  const poolsMap = new Map(stbPools.map((p) => [p.address.toBase58(), p]));

  // loadMiners() defaults beneficiaryAddress to the dummy wallet — query all directly
  const allMinerAccounts = await rewarderContext.program.account.miner.all();
  const miners = allMinerAccounts
    .filter(({ account }) => poolsMap.has((account.pool as PublicKey).toBase58()))
    .map(({ account }) => new Miner(poolsMap.get((account.pool as PublicKey).toBase58())!, account as never));

  const result = new Map<string, number>();
  for (const miner of miners) {
    if (miner.amount > 0) {
      const addr = miner.authorityAddress.toBase58();
      result.set(addr, (result.get(addr) ?? 0) + miner.amount);
    }
  }
  return result;
}

export async function fetchHolders(minBalance = 100_000): Promise<HoldersSnapshot> {
  const connection = new Connection(RPC_URL, "confirmed");
  const { governo, context: governoContext } = await loadGoverno(connection);

  const [walletMap, stakerMap, lockerEntries] = await Promise.all([
    fetchWalletHolders(connection),
    fetchStakerMap(connection, governo.rewarderAddress),
    fetchLockers(connection, governo, governoContext),
  ]);

  const lockerMap = new Map<string, number>();
  for (const l of lockerEntries) {
    if (l.ownerAddress) {
      lockerMap.set(l.ownerAddress, (lockerMap.get(l.ownerAddress) ?? 0) + l.lockedAmount);
    }
  }

  const allAddresses = new Set([
    ...walletMap.keys(),
    ...stakerMap.keys(),
    ...lockerMap.keys(),
  ]);

  const holders: HolderEntry[] = [];
  for (const address of allAddresses) {
    const walletBalance = walletMap.get(address) ?? 0;
    const stakedAmount = stakerMap.get(address) ?? 0;
    const lockedAmount = lockerMap.get(address) ?? 0;
    const totalBalance = walletBalance + stakedAmount + lockedAmount;
    if (totalBalance < minBalance) continue;

    const categories: HolderEntry['categories'] = [];
    if (walletBalance > 0) categories.push('holder');
    if (stakedAmount > 0) categories.push('staker');
    if (lockedAmount > 0) categories.push('locker');

    holders.push({ address, walletBalance, stakedAmount, lockedAmount, totalBalance, categories });
  }

  holders.sort((a, b) => b.totalBalance - a.totalBalance);
  return { timestamp: Date.now(), holders, minBalance };
}

async function fetchTotalSupply(connection: Connection): Promise<number> {
  const mint = await getMint(connection, new PublicKey(STB_MINT));
  return Number(mint.supply) / 10 ** STB_DECIMALS;
}

export async function fetchSnapshot(): Promise<Snapshot> {
  const connection = new Connection(RPC_URL, "confirmed");

  const { governo, context: governoContext } = await loadGoverno(connection);
  const [treasury, lockers, totalStaked, totalSupply] = await Promise.all([
    fetchTreasuryBalances(connection),
    fetchLockers(connection, governo, governoContext),
    fetchTotalStaked(connection, governo.rewarderAddress),
    fetchTotalSupply(connection),
  ]);

  const totalLocked = governo.totalLockedAmount;
  const totalInControl = treasury.reduce((s, t) => s + t.tokenAmount, 0);

  return {
    timestamp: Date.now(),
    treasury,
    lockers,
    totalLocked,
    totalStaked,
    totalInControl,
    totalSupply,
  };
}

const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const TOKEN_PROGRAM_STR = TOKEN_PROGRAM_ID.toBase58();
const TOKEN_2022_STR = TOKEN_2022_PROGRAM_ID.toBase58();

function isSplTokenAccount(info: { owner: PublicKey; data: Buffer }): boolean {
  const owner = info.owner.toBase58();
  if (owner === TOKEN_PROGRAM_STR && info.data.length === 165) return true;
  if (owner === TOKEN_2022_STR && info.data.length >= 165) return true;
  return false;
}

async function discoverPoolVaults(connection: Connection, poolAddress: string): Promise<string[]> {
  const poolPubkey = new PublicKey(poolAddress);

  // Primary strategy: read pool account raw bytes, scan for SPL token accounts,
  // identify the common vault authority, then fetch all its token accounts.
  // This is exact — unlike transaction frequency, it cannot hit shared protocol accounts.
  const poolInfo = await connection.getAccountInfo(poolPubkey).catch(() => null);
  if (poolInfo && poolInfo.data.length >= 72) {
    const data = Buffer.from(poolInfo.data);
    const zeroBuf = Buffer.alloc(32);
    const candidates: PublicKey[] = [];

    // Stride-1 scan after 8-byte Anchor discriminator — catches pubkeys at any alignment
    for (let i = 8; i + 32 <= data.length; i++) {
      const slice = data.subarray(i, i + 32);
      if (slice.equals(zeroBuf)) { i += 31; continue; }
      try { candidates.push(new PublicKey(slice)); } catch { /* skip */ }
    }

    if (candidates.length > 0) {
      const BATCH = 100;
      const authorityVaults = new Map<string, Set<string>>();

      for (let bi = 0; bi < candidates.length; bi += BATCH) {
        const batch = candidates.slice(bi, bi + BATCH);
        const infos = await connection.getMultipleAccountsInfo(batch).catch(() => null);
        if (!infos) continue;
        for (let j = 0; j < infos.length; j++) {
          const info = infos[j];
          if (!info || !isSplTokenAccount(info)) continue;
          // Token account layout: mint(32 bytes) | owner/authority(32 bytes) | ...
          const authority = new PublicKey(info.data.subarray(32, 64)).toBase58();
          const vaultAddr = candidates[bi + j].toBase58();
          if (!authorityVaults.has(authority)) authorityVaults.set(authority, new Set());
          authorityVaults.get(authority)!.add(vaultAddr);
        }
      }

      // Vault authority is the one that owns the most token accounts
      let bestAuth = "";
      let bestCount = 0;
      for (const [auth, vaults] of authorityVaults) {
        if (vaults.size > bestCount) { bestCount = vaults.size; bestAuth = auth; }
      }

      if (bestCount >= 2) {
        // Use getTokenAccountsByOwner to get the complete list (pool account scan may
        // not contain every vault address if some are stored in nested structures)
        const resp = await connection.getTokenAccountsByOwner(
          new PublicKey(bestAuth),
          { programId: TOKEN_PROGRAM_ID }
        ).catch(() => null);
        if (resp && resp.value.length >= 2) {
          return resp.value.map(({ pubkey }) => pubkey.toBase58());
        }
        return [...authorityVaults.get(bestAuth)!];
      }
    }
  }

  // Fallback: transaction frequency analysis (works when pool account parsing finds nothing)
  return discoverVaultsFromTransactions(connection, poolAddress);
}

async function discoverVaultsFromTransactions(connection: Connection, poolAddress: string): Promise<string[]> {
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
      // skip failed tx fetch
    }
  }

  const threshold = Math.max(2, Math.ceil(toProcess.length * 0.6));
  return [...txFreq.entries()]
    .filter(([, count]) => count >= threshold)
    .map(([addr]) => addr);
}

export async function fetchPool(poolAddress?: string): Promise<PoolSnapshot> {
  const addr = (poolAddress ?? process.env.POOL_ADDRESS ?? "").trim();
  if (!addr) return { timestamp: Date.now(), poolAddress: "", assets: [] };

  const connection = new Connection(RPC_URL, "confirmed");

  const vaultAddresses = await discoverPoolVaults(connection, addr);
  if (vaultAddresses.length === 0) {
    return { timestamp: Date.now(), poolAddress: addr, assets: [] };
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
      // vault unreachable — skip silently
    }
  }

  // Deduplicate by mint — some pools have multiple vaults for the same token
  const byMint = new Map<string, PoolAsset>();
  for (const asset of assets) {
    const existing = byMint.get(asset.mint);
    if (existing) existing.amount += asset.amount;
    else byMint.set(asset.mint, { ...asset });
  }

  return { timestamp: Date.now(), poolAddress: addr, assets: Array.from(byMint.values()) };
}
