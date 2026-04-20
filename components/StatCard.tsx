interface StatCardProps {
  title: string;
  value: string;
  delta?: number | null;
  sub?: string;
}

function fmt(n: number) {
  const sign = n >= 0 ? "+" : "";
  return sign + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function StatCard({ title, value, delta, sub }: StatCardProps) {
  const hasData = delta !== null && delta !== undefined;
  const positive = hasData && delta! >= 0;

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 flex flex-col gap-1">
      <span className="text-xs font-medium text-[#8b949e] uppercase tracking-wider">{title}</span>
      <span className="text-2xl font-bold text-[#e6edf3] tabular-nums">{value}</span>
      {hasData && (
        <span className={`text-sm font-medium tabular-nums ${positive ? "text-[#3fb950]" : "text-[#f85149]"}`}>
          {fmt(delta!)} 1d
        </span>
      )}
      {sub && <span className="text-xs text-[#6e7681]">{sub}</span>}
    </div>
  );
}
