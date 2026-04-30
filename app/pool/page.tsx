import PoolDashboard from "@/components/PoolDashboard";

export default function PoolPage() {
  const defaultPool = process.env.POOL_ADDRESS ?? "";
  return <PoolDashboard defaultPool={defaultPool} />;
}
