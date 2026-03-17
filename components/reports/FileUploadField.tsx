'use client';

import { useState } from 'react';
import { uploadApi } from '../../lib/api';

type Props = {
  onUploadedUrl?: (url: string) => void;
};

export default function FileUploadField({ onUploadedUrl }: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [error, setError] = useState('');

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadedUrl('');
    setError('');

    try {
      // Frontend solo envía el archivo al backend.
      // Backend resuelve storage y responde la URL pública/remota.
      const res = await uploadApi.send(file);
      const url = res.data?.url || res.data?.data?.url || '';

      if (!url) {
        setError('El backend respondió sin URL de archivo.');
        return;
      }

      setUploadedUrl(url);
      onUploadedUrl?.(url);
    } catch (err: any) {
      const backendMessage = err.response?.data?.error || err.response?.data?.message;

      if (err.response?.status === 503) {
        setError(backendMessage || 'Storage no disponible temporalmente (503).');
      } else {
        setError(backendMessage || 'No se pudo subir el archivo.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="editor-section space-y-2">
      <label className="editor-label">Subir archivo al backend</label>

      <input
        type="file"
        className="input"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.currentTarget.value = '';
        }}
      />

      {uploading && <p className="text-xs text-slate-500">Subiendo archivo...</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      {uploadedUrl && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
          <p className="text-xs text-emerald-800 mb-1">URL devuelta por backend:</p>
          <a href={uploadedUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 underline break-all">
            {uploadedUrl}
          </a>
        </div>
      )}
    </div>
  );
}
