import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./db";
import { startCron } from "./cron";
import router from "./routes";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", router);

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT ?? 3001;
const MONGO_URI = process.env.MONGO_URI ?? "";

if (!MONGO_URI) {
  console.error("MONGO_URI is not set. Exiting.");
  process.exit(1);
}

connectDB(MONGO_URI).then(() => {
  startCron();
  app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
});
