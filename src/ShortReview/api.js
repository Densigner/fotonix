export async function analyzeVideo(file) {
  const fd = new FormData();
  fd.append('video', file);

  const res = await fetch('/api/shortreview/analyze', { method: 'POST', body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Analyze failed: ${res.status}`);
  }
  return res.json();
}
