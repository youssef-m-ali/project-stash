'use client';

import { useEffect, useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { FileDropZone, type FileEntry } from '@/components/import/FileDropZone';
import { Button } from '@/components/ui/Button';
import { ColumnMappingStep, type MappingEntry } from '@/components/import/ColumnMappingStep';
import { PreviewTable } from '@/components/import/PreviewTable';
import { ImportSummaryBanner } from '@/components/import/ImportSummaryBanner';
import { splitRows, splitCols } from '@/lib/import/parseUtils';
import type { ParsedTransaction, CsvMapping } from '@/lib/types';

type Stage = 'upload' | 'mapping' | 'preview' | 'done';
interface PreviewTx extends ParsedTransaction { id: string }
interface ImportResult { inserted: number; skipped: number }

export default function ImportPage() {
  const { config } = useAppContext();
  const [stage, setStage] = useState<Stage>('upload');
  const [loading, setLoading] = useState(false);
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [mappingEntries, setMappingEntries] = useState<MappingEntry[]>([]);
  const [preview, setPreview] = useState<PreviewTx[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [lastTxDate, setLastTxDate] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    fetch('/api/accounts/last-import')
      .then(r => r.json())
      .then(d => setLastTxDate(d.lastTxDate ?? {}));
  }, []);

  if (!config) return null;

  // Upload → Mapping: read headers from each file and pre-populate from saved mappings
  async function handleProceedToMapping(entries: FileEntry[]) {
    setLoading(true);
    setError(null);
    const accounts = config!.accounts;
    try {
      const results: MappingEntry[] = await Promise.all(
        entries.map(async entry => {
          const csvText = await entry.file.text();
          const headers = splitCols(splitRows(csvText)[0] ?? '');

          const res  = await fetch(`/api/accounts/${entry.accountId}/csv-mapping`);
          const data = await res.json() as { mapping: CsvMapping | null };

          let mapping: CsvMapping;
          if (data.mapping) {
            mapping = data.mapping;
          } else {
            // Auto-detect from headers as a best-guess starting point
            const lower = headers.map(h => h.toLowerCase().trim());
            const dateCol   = lower.findIndex(h => h.includes('date'));
            const descCol   = lower.findIndex(h => h.includes('description') || h.includes('name') || h.includes('memo'));
            const amountCol = lower.findIndex(h => h.includes('amount') || h.includes('cad'));
            mapping = {
              dateCol:   dateCol   >= 0 ? dateCol   : null,
              descCol:   descCol   >= 0 ? descCol   : null,
              amountCol: amountCol >= 0 ? amountCol : null,
              flipSign:  false,
            };
          }

          const account = accounts.find(a => a.id === entry.accountId);
          return {
            file:         entry.file,
            accountId:    entry.accountId,
            accountLabel: account?.label ?? entry.accountId,
            headers,
            mapping,
          };
        }),
      );
      setMappingEntries(results);
      setStage('mapping');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  // Mapping → Preview: save mappings then run preview API
  async function handleConfirmMappings(confirmed: MappingEntry[]) {
    setLoading(true);
    setError(null);
    try {
      // Persist mappings per account
      await Promise.all(
        confirmed.map(e =>
          fetch(`/api/accounts/${e.accountId}/csv-mapping`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mapping: e.mapping }),
          }),
        ),
      );

      // Build preview payload with confirmed mappings
      const files = await Promise.all(
        confirmed.map(async e => ({
          accountId: e.accountId,
          csvText:   await e.file.text(),
          mapping:   e.mapping,
        })),
      );

      const res  = await fetch('/api/transactions/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      const data = await res.json() as { transactions: PreviewTx[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Preview failed');

      setPreview(data.transactions);
      setStage('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(txs: PreviewTx[]) {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/transactions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: txs }),
      });
      const data = await res.json() as ImportResult & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Import failed');
      setResult({ inserted: data.inserted, skipped: data.skipped });
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStage('upload');
    setFileEntries([]);
    setMappingEntries([]);
    setPreview([]);
    setResult(null);
    setError(null);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Import transactions</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Upload CSV exports from your bank accounts. New transactions go into the Review queue.
        </p>
      </div>

      {error && (
        <div className="bg-red-900/25 border border-red-700 rounded-lg px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {stage === 'upload' && (() => {
        const accountsUsed = new Set(fileEntries.map(e => e.accountId).filter(Boolean));
        const hasDuplicate = accountsUsed.size < fileEntries.filter(e => e.accountId).length;
        const canSubmit = fileEntries.length > 0 && fileEntries.every(e => e.accountId !== '') && !hasDuplicate;
        return (
          <div className="flex flex-col gap-4">
            <div className="flex gap-4 items-stretch">
              <div className="flex-1 min-w-0">
                <FileDropZone
                  accounts={config.accounts}
                  entries={fileEntries}
                  onEntriesChange={setFileEntries}
                />
              </div>

              {config.accounts.length > 0 && (
                <div className="w-64 shrink-0 rounded-xl border border-zinc-700 bg-zinc-800/40 overflow-hidden">
                  {config.accounts.map((a, i) => (
                    <div
                      key={a.id}
                      className={`flex flex-col gap-0.5 px-4 py-3 ${i < config.accounts.length - 1 ? 'border-b border-zinc-700/50' : ''}`}
                    >
                      <span className="text-sm text-zinc-300">{a.label}</span>
                      <span className="text-xs tabular-nums text-zinc-500">
                        {lastTxDate[a.id]
                          ? <>up to <span className="text-zinc-400">{lastTxDate[a.id]}</span></>
                          : 'no transactions yet'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {hasDuplicate && (
              <p className="text-sm text-amber-400">Two files are assigned to the same account.</p>
            )}
            {config.accounts.length === 0 && (
              <p className="text-sm text-amber-400">No accounts configured. Go to Settings to add accounts first.</p>
            )}

            <Button
              disabled={!canSubmit || loading}
              onClick={() => handleProceedToMapping(fileEntries)}
              className="self-start"
            >
              {loading ? 'Loading…' : 'Continue'}
            </Button>
          </div>
        );
      })()}

      {stage === 'mapping' && (
        <ColumnMappingStep
          entries={mappingEntries}
          onConfirm={handleConfirmMappings}
          onBack={() => setStage('upload')}
          loading={loading}
        />
      )}

      {stage === 'preview' && (
        <PreviewTable
          transactions={preview}
          onConfirm={handleConfirm}
          loading={loading}
        />
      )}

      {stage === 'done' && result && (
        <ImportSummaryBanner
          inserted={result.inserted}
          skipped={result.skipped}
          months={[]}
          onImportMore={reset}
        />
      )}
    </div>
  );
}
