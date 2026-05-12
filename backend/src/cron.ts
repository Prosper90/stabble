import cron from "node-cron";
import { Pool, Snapshot } from "./db";
import { fetchPool } from "./solana";

export function startCron(): void {
  cron.schedule("* * * * *", async () => {
    const pools = await Pool.find();
    if (pools.length === 0) return;

    console.log(`[cron] Fetching ${pools.length} pool(s)...`);

    for (const pool of pools) {
      try {
        const snapshot = await fetchPool(pool.address);
        if (snapshot.assets.length > 0) {
          await Snapshot.create({
            poolAddress: pool.address,
            timestamp: snapshot.timestamp,
            assets: snapshot.assets,
          });
        }
        console.log(`[cron] ${pool.address.slice(0, 8)}… — ${snapshot.assets.length} assets`);
      } catch (e) {
        console.error(`[cron] Failed to fetch ${pool.address.slice(0, 8)}…:`, e);
      }
    }
  });

  console.log("Cron job started (every minute)");
}
