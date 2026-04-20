interface DeltaBadgeProps {
  value: number | null;
}

function fmt(n: number) {
  const sign = n > 0 ? "+" : "";
  return sign + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DeltaBadge({ value }: DeltaBadgeProps) {
  if (value === null || value === undefined) {
    return <span className="text-[#6e7681] text-sm">—</span>;
  }
  const positive = value >= 0;
  return (
    <span className={`text-sm font-medium tabular-nums ${positive ? "text-[#3fb950]" : "text-[#f85149]"}`}>
      {fmt(value)}
    </span>
  );
}
