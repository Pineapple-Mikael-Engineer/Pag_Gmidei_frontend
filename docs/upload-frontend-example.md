# Upload frontend seguro (sin STORAGE_URL/STORAGE_KEY en cliente)

## Opción Axios (recomendada si ya usas `lib/api.ts`)

```ts
// lib/api.ts
export const uploadApi = {
  send: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
```

```tsx
// Ejemplo React
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [url, setUrl] = useState('');

async function onFileSelected(file: File) {
  setLoading(true);
  setError('');
  setUrl('');
  try {
    const res = await uploadApi.send(file);
    const uploadedUrl = res.data?.url || res.data?.data?.url;
    if (!uploadedUrl) throw new Error('Sin URL en respuesta backend');
    setUrl(uploadedUrl);
  } catch (e: any) {
    setError(e.response?.data?.error || e.message || 'Error subiendo archivo');
  } finally {
    setLoading(false);
  }
}
```

## Opción Fetch (sin axios)

```ts
async function uploadFileWithFetch(file: File, baseUrl: string, token?: string) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Upload failed');

  const url = data?.url || data?.data?.url;
  if (!url) throw new Error('Backend response without url');
  return url as string;
}
```

## Input y render de URL

```tsx
<input
  type="file"
  onChange={(e) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
  }}
/>

{loading && <p>Subiendo...</p>}
{error && <p style={{ color: 'red' }}>{error}</p>}
{url && (
  <a href={url} target="_blank" rel="noreferrer">
    {url}
  </a>
)}
```
