// Photo cutouts (in-browser background removal, WASM/ONNX, free) + image compression + voice notes.

const toImg = (src: string) => new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });
const readUrl = (b: Blob) => new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.readAsDataURL(b); });

/** downscale to max px, webp keeps transparency; small enough for a Firestore doc */
export async function shrink(src: Blob | string, max = 360, q = 0.8): Promise<string> {
  const img = await toImg(typeof src === 'string' ? src : await readUrl(src));
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/webp', q);
}

/** strip background → transparent cutout dataURL. The ISNet model + ONNX runtime ship inside the APK (public/imgly), so this runs 100% offline. */
export async function makeCutout(file: Blob, onProgress?: (p: string) => void): Promise<string> {
  const small = await shrink(file, 720, 0.92);
  const { removeBackground } = await import('@imgly/background-removal');
  const out = await removeBackground(small, {
    model: 'isnet_quint8',
    publicPath: new URL(`${import.meta.env.BASE_URL}imgly/`, location.href).href,
    output: { format: 'image/png' },
    progress: (key: string, cur: number, total: number) => onProgress?.(key.startsWith('fetch') ? `Loading magic ${Math.round((cur / Math.max(total, 1)) * 100)}%` : 'Cutting out…'),
  });
  return shrink(out, 360, 0.85);
}

/** hold-to-record voice note; returns stop() → dataURL (opus/webm, low bitrate, ≤30s) */
export async function startRecording(): Promise<() => Promise<string | null>> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream, { audioBitsPerSecond: 24000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => chunks.push(e.data);
  rec.start();
  const cap = setTimeout(() => rec.state === 'recording' && rec.stop(), 30000);
  return () => new Promise((ok) => {
    rec.onstop = async () => {
      clearTimeout(cap); stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      ok(blob.size > 1500 ? await readUrl(blob) : null);
    };
    rec.state === 'recording' ? rec.stop() : rec.onstop!(new Event('stop'));
  });
}
