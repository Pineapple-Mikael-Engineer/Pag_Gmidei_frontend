'use client';

import { useState } from 'react';
import { uploadApi } from '../../lib/api';

type Props = {
  onUploadedUrl?: (url: string) => void;
};

export default function FileUploadField({ onUploadedUrl }: Props) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleUpload = async (file: File) => {
    setUploading(true);
    setMessage('');
    try {
      const res = await uploadApi.send(file);
      const url = res.data?.url || res.data?.data?.url;
      if (url) {
        onUploadedUrl?.(url);
        setMessage('Archivo subido. URL agregada a evidencia.');
      } else {
        setMessage('Subida completada sin URL retornada.');
      }
    } catch (err: any) {
      if (err.response?.status === 503) {
        setMessage('Storage temporalmente no disponible (503).');
      } else {
        setMessage(err.response?.data?.error || 'No se pudo subir el archivo.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="editor-section space-y-2">
      <label className="editor-label">Subida de archivo (storage)</label>
      <input
        type="file"
        className="input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.currentTarget.value = '';
        }}
        disabled={uploading}
      />
      {message && <p className="text-xs text-slate-500">{message}</p>}
    </div>
  );
}
