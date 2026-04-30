'use client';

import { useEffect, useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { FileDropZone, type FileEntry } from '@/components/import/FileDropZone';
import { PreviewTable } from '@/components/import/PreviewTable';
import { ImportSummaryBanner } from '@/components/import/ImportSummaryBanner';
import type { ParsedTransaction, Bucket } from '@/lib/types';

type Stage = 'upload' | 'preview' | 'done';
interface PreviewTx extends ParsedTransaction { id: string }
interface ImportResult { inserted: number; skipped: number }

export default function ImportPage() {
  const { config } = useAppContext();
  const [stage, setStage] = useState<Stage>('upload');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewTx[]>([]);
  const [previewBuckets, setPreviewBuckets] = useState<Bucket[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep buckets up-to-date even if config hasn't reloaded
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  useEffect(() => {
    fetch('/api/buckets')
      .then(r => r.json())
      .then(d => setBuckets(d.buckets ?? []));
  }, []);

  if (!config) return null;

  async function handlePreview(entries: FileEntry[]) {
    setLoading(true);
    setError(null);
    try {
      const files = await Promise.all(
        entries.map(async e => ({ accountId: e.accountId, csvText: await e.file.text() })),
      );
      const res = await fetch('/api/transactions/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      const data = await res.json() as { transactions: PreviewTx[]; buckets: Bucket[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Preview failed');
      setPreview(data.transactions);
      setPreviewBuckets(data.buckets ?? buckets);
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
      const res = await fetch('/api/transactions/import', {
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

      {stage === 'upload' && (
        <FileDropZone
          accounts={config.accounts}
          onPreview={handlePreview}
          loading={loading}
        />
      )}

      {stage === 'preview' && (
        <PreviewTable
          transactions={preview}
          accounts={config.accounts}
          buckets={previewBuckets}
          currency={config.currency}
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
