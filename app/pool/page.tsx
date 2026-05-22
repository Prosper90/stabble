import PoolDashboard from "@/components/PoolDashboard";

const POOL_ADDRESS = "41GRMsYsBGmC67e37kcuCgTCmCRqN51dmCz4aQrzPLoP";

export default function PoolPage() {
  return <PoolDashboard defaultPool={POOL_ADDRESS} locked />;
}
