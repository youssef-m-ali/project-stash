'use client';

import { useRef, useState } from 'react';
import type { Account } from '@/lib/types';
import { AccountSelector } from './AccountSelector';
import { Button } from '@/components/ui/Button';

export interface FileEntry {
  file: File;
  accountId: string;
}

interface Props {
  accounts: Account[];
  onPreview: (entries: FileEntry[]) => void;
  loading: boolean;
}

export function FileDropZone({ accounts, onPreview, loading }: Props) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const newEntries: FileEntry[] = Array.from(files)
      .filter((f) => f.name.endsWith('.csv'))
      .map((f) => ({ file: f, accountId: '' }));
    setEntries((prev) => {
      const existing = new Set(prev.map((e) => e.file.name));
      return [...prev, ...newEntries.filter((e) => !existing.has(e.file.name))];
    });
  }

  function setAccount(index: number, accountId: string) {
    setEntries((prev) => prev.map((e, i) => i === index ? { ...e, accountId } : e));
  }

  function remove(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  const allAssigned = entries.length > 0 && entries.every((e) => e.accountId !== '');
  const accountsUsed = new Set(entries.map((e) => e.accountId).filter(Boolean));
  const hasDuplicateAccount = accountsUsed.size < entries.filter((e) => e.accountId).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-zinc-600 rounded-xl p-8 text-center cursor-pointer hover:border-zinc-400 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
      >
        <p className="text-zinc-400 text-sm">
          Drop CSV files here, or <span className="text-zinc-200 underline">click to browse</span>
        </p>
        <p className="text-zinc-600 text-xs mt-1">One file per account · .csv only</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {entries.length > 0 && (
        <div className="flex flex-col gap-2">
          {entries.map((entry, i) => (
            <div key={entry.file.name} className="flex items-center gap-3 bg-zinc-800 rounded-lg px-3 py-2">
              <span className="text-sm text-zinc-300 flex-1 truncate">{entry.file.name}</span>
              <div className="w-64 shrink-0">
                <AccountSelector
                  accounts={accounts}
                  value={entry.accountId}
                  onChange={(id) => setAccount(i, id)}
                />
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-zinc-500 hover:text-red-400 transition-colors text-lg leading-none"
                aria-label="Remove file"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {hasDuplicateAccount && (
        <p className="text-sm text-amber-400">Two files are assigned to the same account.</p>
      )}

      {accounts.length === 0 && (
        <p className="text-sm text-amber-400">
          No accounts configured. Go to Settings → Edit questionnaire → Accounts to add your accounts first.
        </p>
      )}

      <Button
        disabled={!allAssigned || hasDuplicateAccount || loading}
        onClick={() => onPreview(entries)}
        className="self-start"
      >
        {loading ? 'Parsing…' : 'Preview transactions'}
      </Button>
    </div>
  );
}
