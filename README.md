# STB Tracker

A real-time on-chain analytics dashboard for the **Stabble (STB)** token on Solana. Tracks token distribution, staking positions, vote-locked positions, large holders, and liquidity pool composition — with historical time-series snapshots for delta analysis.

## Pages

| Route | Description |
|---|---|
| `/` | Main dashboard — total supply, locked/staked totals, vote-locked positions table, treasury wallets |
| `/positions` | All wallets with active STB staking or vote-lock positions, with 1d/7d deltas |
| `/holders` | All wallets holding ≥ 100,000 STB (across wallet balance, staked, and locked), sortable |
| `/analytics` | Historical trends — circulating supply %, locker count, and aggregate deltas over time |
| `/pool` | Stabble liquidity pool tracker — per-asset vault balances with 1d/7d/30d deltas |

## Stack

- **Next.js** (App Router) + **TypeScript** + **Tailwind CSS**
- **@solana/web3.js** + **@solana/spl-token** — on-chain RPC queries
- **@coral-xyz/anchor** + **@stabbleorg/rewarder-sdk** — Governo (vote-lock) and Rewarder (staking) program interactions
- **Netlify** — deployment target

## How it works

All data is fetched server-side from Solana mainnet via a paid Helius RPC endpoint. API routes cache responses for 5 minutes; a `?force=true` query parameter bypasses the cache. Each successful fetch is persisted as a JSON snapshot in `data/` (or `/tmp/stb-data` on Netlify's read-only filesystem), keeping the last 30 days of history for delta calculations.

### Key data sources

- **Vote-locked positions** — fetched directly from the Governo program (`locker` accounts filtered by the STB Governo address)
- **Staking positions** — fetched from the Rewarder program (`miner` accounts filtered by STB staking pools)
- **Token holders** — `getProgramAccounts` on the SPL Token program filtered by the STB mint
- **Treasury wallets** — hardcoded known addresses queried for their STB ATA balance
- **Pool vaults** — SPL token accounts (vault addresses configured via env vars)

## Environment variables

```
RPC_URL=<helius-or-other-paid-rpc-endpoint>

# Pool tracker — fill in once the Stabble pool is live
POOL_ADDRESS=<pool on-chain address>
POOL_VAULTS=<comma-separated vault token account addresses>
```

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On first load the holders and positions pages take 30–60 seconds while the RPC fetches all program accounts. Subsequent loads are served from the 5-minute cache.

## Deployment

Deployed on Netlify. The `netlify.toml` sets a 26-second server function timeout and uses `@netlify/plugin-nextjs` for Next.js compatibility. Persistent data is written to `/tmp/stb-data` on Netlify (ephemeral between deploys — history resets on each deploy).
