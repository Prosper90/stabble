"use client";

import { useState, useMemo } from "react";
import { ReactNode } from "react";

export interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  render?: (row: T) => ReactNode;
  value?: (row: T) => number | string | null;
}

interface SortableTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
}

type SortDir = "asc" | "desc";

function ChevronUp() {
  return <svg className="w-3 h-3 inline" viewBox="0 0 12 12" fill="currentColor"><path d="M6 3l4 5H2z"/></svg>;
}
function ChevronDown() {
  return <svg className="w-3 h-3 inline" viewBox="0 0 12 12" fill="currentColor"><path d="M6 9L2 4h8z"/></svg>;
}

export default function SortableTable<T>({ columns, data, rowKey, emptyMessage }: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return data;

    return [...data].sort((a, b) => {
      const av = col.value ? col.value(a) : (a as Record<string, unknown>)[sortKey];
      const bv = col.value ? col.value(b) : (b as Record<string, unknown>)[sortKey];

      const an = typeof av === "number" ? av : Number(av ?? -Infinity);
      const bn = typeof bv === "number" ? bv : Number(bv ?? -Infinity);

      if (Number.isNaN(an) || Number.isNaN(bn)) {
        const as_ = String(av ?? "");
        const bs_ = String(bv ?? "");
        return sortDir === "asc" ? as_.localeCompare(bs_) : bs_.localeCompare(as_);
      }
      return sortDir === "asc" ? an - bn : bn - an;
    });
  }, [data, sortKey, sortDir, columns]);

  return (
    <div className="overflow-x-auto rounded-lg border border-[#30363d]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#30363d]">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
                className={[
                  "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#8b949e]",
                  col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                  col.sortable ? "cursor-pointer select-none hover:text-[#e6edf3] transition-colors" : "",
                  sortKey === col.key ? "text-[#58a6ff]" : "",
                ].join(" ")}
              >
                {col.header}
                {col.sortable && (
                  <span className="ml-1">
                    {sortKey === col.key ? (
                      sortDir === "asc" ? <ChevronUp /> : <ChevronDown />
                    ) : (
                      <span className="opacity-30"><ChevronDown /></span>
                    )}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-10 text-[#6e7681]">
                {emptyMessage ?? "No data"}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-[#21262d] hover:bg-[#161b22] transition-colors last:border-0"
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={[
                      "px-4 py-3 text-[#e6edf3]",
                      col.align === "right" ? "text-right tabular-nums" : col.align === "center" ? "text-center" : "",
                    ].join(" ")}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[String(col.key)] ?? "—")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
