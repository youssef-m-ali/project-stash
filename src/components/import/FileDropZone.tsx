'use client';

import { useRef } from 'react';
import type { Account } from '@/lib/types';
import { AccountSelector } from './AccountSelector';

export interface FileEntry {
  file: File;
  accountId: string;
}

interface Props {
  accounts: Account[];
  entries: FileEntry[];
  onEntriesChange: (entries: FileEntry[]) => void;
}

export function FileDropZone({ accounts, entries, onEntriesChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const newEntries: FileEntry[] = Array.from(files)
      .filter((f) => f.name.endsWith('.csv'))
      .map((f) => ({ file: f, accountId: '' }));
    const existing = new Set(entries.map((e) => e.file.name));
    onEntriesChange([...entries, ...newEntries.filter((e) => !existing.has(e.file.name))]);
  }

  function setAccount(index: number, accountId: string) {
    onEntriesChange(entries.map((e, i) => i === index ? { ...e, accountId } : e));
  }

  function remove(index: number) {
    onEntriesChange(entries.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Drop zone */}
      <div
        className="flex-1 border-2 border-dashed border-zinc-600 rounded-xl p-8 text-center cursor-pointer hover:border-zinc-400 transition-colors flex flex-col items-center justify-center"
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

    </div>
  );
}
