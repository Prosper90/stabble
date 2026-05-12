import mongoose, { Schema, Document } from "mongoose";

export interface IPool extends Document {
  address: string;
  addedAt: Date;
}

export interface ISnapshot extends Document {
  poolAddress: string;
  timestamp: number;
  createdAt: Date;
  assets: { vault: string; mint: string; amount: number; decimals: number }[];
}

const PoolSchema = new Schema<IPool>({
  address: { type: String, required: true, unique: true },
  addedAt: { type: Date, default: Date.now },
});

const SnapshotSchema = new Schema<ISnapshot>({
  poolAddress: { type: String, required: true, index: true },
  timestamp: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now, expires: 30 * 24 * 60 * 60 }, // 30-day TTL
  assets: [
    {
      vault: String,
      mint: String,
      amount: Number,
      decimals: Number,
    },
  ],
});

SnapshotSchema.index({ poolAddress: 1, timestamp: -1 });

export const Pool = mongoose.model<IPool>("Pool", PoolSchema);
export const Snapshot = mongoose.model<ISnapshot>("Snapshot", SnapshotSchema);

export async function connectDB(uri: string): Promise<void> {
  await mongoose.connect(uri);
  console.log("MongoDB connected");
}
