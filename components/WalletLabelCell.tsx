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

export default function WalletLabelCell({ address, label, onSave }: WalletLabelCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    onSave(address, draft);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") {
      setDraft(label ?? "");
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
        placeholder="Enter name / TG tag…"
        className="bg-[#0d1117] border border-[#58a6ff] rounded px-2 py-0.5 text-sm text-[#e6edf3] w-full outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(label ?? ""); setEditing(true); }}
      className="group text-left w-full"
      title={address}
    >
      {label ? (
        <span className="text-[#2dd4bf] font-medium">{label}</span>
      ) : (
        <span className="text-[#6e7681]">Unknown</span>
      )}
      <span className="ml-1.5 text-[#30363d] group-hover:text-[#8b949e] text-xs transition-colors">
        {shortAddr(address)}
      </span>
      <span className="ml-1 opacity-0 group-hover:opacity-100 text-[#8b949e] text-xs transition-opacity">✎</span>
    </button>
  );
}
