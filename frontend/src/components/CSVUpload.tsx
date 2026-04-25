'use client';
import { useState, useRef } from 'react';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface CSVUploadProps {
  title: string;
  columns: string[];
  sampleData: string[][];
  onUpload: (file: File) => Promise<any>;
  icon?: string;
}

export default function CSVUpload({ title, columns, sampleData, onUpload, icon = '📄' }: CSVUploadProps) {
  const [show, setShow] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true); setError(''); setResult(null);
    try {
      const res = await onUpload(file);
      setResult(res);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    }
    finally { setUploading(false); }
  };

  const downloadSample = () => {
    const header = columns.join(',');
    const rows = sampleData.map(r => r.join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '_')}_sample.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!show) {
    return (
      <button className="ds-btn ds-btn-outline" onClick={() => setShow(true)} style={{ gap: 6 }}>
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: 16, height: 16 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
        Upload CSV
      </button>
    );
  }

  return (
    <div className="ds-card ds-fade-in" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(249,115,22,0.02), rgba(124,58,237,0.02))', border: '1px solid rgba(249,115,22,0.12)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, color: '#1c0a00', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon} Bulk Import {title} via CSV
        </h3>
        <button className="ds-btn ds-btn-ghost" style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }} onClick={() => { setShow(false); setResult(null); setError(''); }}>✕ Close</button>
      </div>

      {/* Sample format */}
      <div style={{ marginBottom: '1rem', padding: '0.7rem', background: 'rgba(37,99,235,0.03)', border: '1px solid rgba(37,99,235,0.08)', borderRadius: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.04em' }}>📋 Expected CSV Format</span>
          <button className="ds-btn ds-btn-ghost" style={{ padding: '0.2rem 0.5rem', fontSize: '0.68rem', color: '#2563eb' }} onClick={downloadSample}>
            ⬇️ Download Sample
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.7rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col} style={{ padding: '0.3rem 0.5rem', borderBottom: '1px solid rgba(37,99,235,0.1)', fontWeight: 700, color: '#1c0a00', textAlign: 'left', whiteSpace: 'nowrap' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sampleData.slice(0, 2).map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ padding: '0.25rem 0.5rem', color: '#7c5a4a', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload area */}
      <div
        style={{ border: '2px dashed rgba(249,115,22,0.2)', borderRadius: 14, padding: '1.5rem', textAlign: 'center', background: file ? 'rgba(22,163,74,0.03)' : 'rgba(249,115,22,0.02)', cursor: 'pointer', transition: 'all 0.2s' }}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f && f.name.endsWith('.csv')) setFile(f); }}
      >
        <input ref={fileRef} type="file" accept=".csv" hidden onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
        {file ? (
          <div>
            <span style={{ fontSize: '1.5rem' }}>✅</span>
            <div style={{ fontWeight: 600, color: '#16a34a', marginTop: '0.3rem', fontSize: '0.85rem' }}>{file.name}</div>
            <div style={{ fontSize: '0.72rem', color: '#9a7b6a' }}>{(file.size / 1024).toFixed(1)} KB — Click to change</div>
          </div>
        ) : (
          <div>
            <span style={{ fontSize: '1.5rem' }}>📄</span>
            <div style={{ fontWeight: 600, color: '#7c5a4a', marginTop: '0.3rem', fontSize: '0.85rem' }}>Click or drag CSV file here</div>
            <div style={{ fontSize: '0.72rem', color: '#b89070' }}>Maximum file size: 5 MB</div>
          </div>
        )}
      </div>

      {/* Upload button */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <button className="ds-btn ds-btn-primary" disabled={!file || uploading} onClick={handleUpload} style={{ flex: 1, justifyContent: 'center' }}>
          {uploading ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 14, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin .7s linear infinite', display: 'inline-block' }} />
              Importing...
            </span>
          ) : `📤 Import ${title}`}
        </button>
        <button className="ds-btn ds-btn-ghost" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}>Clear</button>
      </div>

      {/* Results */}
      {error && <div className="ds-alert ds-alert-error" style={{ marginTop: '0.8rem' }}>{error}</div>}
      {result && (
        <div className="ds-fade-in" style={{ marginTop: '0.8rem' }}>
          <div className={`ds-alert ${result.results?.failed?.length > 0 ? 'ds-alert-info' : 'ds-alert-success'}`}>
            <span style={{ flex: 1 }}>{result.message}</span>
          </div>

          {/* Success list */}
          {result.results?.created?.length > 0 && (
            <div style={{ marginTop: '0.5rem', maxHeight: 180, overflowY: 'auto' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', marginBottom: '0.3rem' }}>✅ Successfully imported ({result.results.created.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                {result.results.created.map((r: any, i: number) => (
                  <div key={i} style={{ padding: '0.3rem 0.5rem', background: 'rgba(22,163,74,0.04)', borderRadius: 6, fontSize: '0.72rem', color: '#4a3020', display: 'flex', gap: 8 }}>
                    <span style={{ color: '#9a7b6a' }}>Row {r.row}</span>
                    <span style={{ fontWeight: 600 }}>{r.fullName || r.name || r.userId || ''}</span>
                    {r.email && <span style={{ color: '#9a7b6a' }}>{r.email}</span>}
                    {r.userId && <span className="ds-badge ds-badge-green" style={{ fontSize: '0.6rem' }}>{r.userId}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Failed list */}
          {result.results?.failed?.length > 0 && (
            <div style={{ marginTop: '0.5rem', maxHeight: 180, overflowY: 'auto' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626', marginBottom: '0.3rem' }}>❌ Failed ({result.results.failed.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                {result.results.failed.map((r: any, i: number) => (
                  <div key={i} style={{ padding: '0.3rem 0.5rem', background: 'rgba(220,38,38,0.04)', borderRadius: 6, fontSize: '0.72rem', color: '#4a3020', display: 'flex', gap: 8 }}>
                    <span style={{ color: '#9a7b6a' }}>Row {r.row}</span>
                    <span style={{ color: '#dc2626' }}>{r.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
