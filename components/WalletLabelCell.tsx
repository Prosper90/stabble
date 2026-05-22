"use client";

import { useState, useRef, useEffect } from "react";

interface WalletLabelCellProps {
  address: string;
  label: string | undefined;
  onSave: (address: string, name: string) => void;
}

function shortAddr(addr: string) {
  return addr.slice(0, 4) + "…" + addr.slice(-4);
}

function IconCopy() {
  return (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
      <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
      <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
    </svg>
  );
}

function IconEdit() {
  return (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
      <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61Zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 0 0-.064.108l-.558 1.953 1.953-.558a.253.253 0 0 0 .108-.064Zm1.238-3.763a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354Z" />
    </svg>
  );
}

function IconExternal() {
  return (
    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor">
      <path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1Z" />
    </svg>
  );
}

export default function WalletLabelCell({ address, label, onSave }: WalletLabelCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label ?? "");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => { setDraft(label ?? ""); }, [label]);

  function commit() {
    setEditing(false);
    onSave(address, draft);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") { setDraft(label ?? ""); setEditing(false); }
  }

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(label ?? "");
    setEditing(true);
  }

  function handleSolscan(e: React.MouseEvent) {
    e.stopPropagation();
    window.open(`https://solscan.io/account/${address}`, "_blank", "noopener,noreferrer");
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        placeholder="Label…"
        className="bg-[#0d1117] border border-[#58a6ff] rounded px-2 py-0.5 text-xs text-[#e6edf3] w-full outline-none"
      />
    );
  }

  return (
    <div className="flex items-center gap-1.5 group">
      {label && <span className="text-xs text-[#2dd4bf] font-medium">{label}</span>}
      <span className="text-xs font-mono text-[#6e7681]">{shortAddr(address)}</span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          title={copied ? "Copied!" : "Copy address"}
          className={`${copied ? "text-[#3fb950]" : "text-[#6e7681] hover:text-[#e6edf3]"} transition-colors`}
        >
          {copied ? <span className="text-[10px] font-bold">✓</span> : <IconCopy />}
        </button>
        <button
          onClick={handleEdit}
          title="Add label"
          className="text-[#6e7681] hover:text-[#e6edf3] transition-colors"
        >
          <IconEdit />
        </button>
        <button
          onClick={handleSolscan}
          title="View on Solscan"
          className="text-[#6e7681] hover:text-[#58a6ff] transition-colors"
        >
          <IconExternal />
        </button>
      </div>
    </div>
  );
}
