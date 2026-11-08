'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function publicPhotoUrl(bucket: string, path: string | null) {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

/** Uploads an image to a public bucket, then saves the path through a server action. */
export function PhotoUpload({
  bucket,
  folder,
  current,
  onSaved,
  label = 'Photo',
}: {
  bucket: string;
  folder: string;
  current: string | null;
  onSaved: (path: string | null) => Promise<{ error?: string } | null | undefined | void>;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = publicPhotoUrl(bucket, current);

  async function upload(file: File) {
    setError(null);
    if (file.size > 2 * 1024 * 1024) return setError('Max 2 MB');
    setBusy(true);
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await createClient().storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (upErr) {
      setBusy(false);
      return setError(upErr.message);
    }
    const res = await onSaved(path);
    setBusy(false);
    if (res && 'error' in res && res.error) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-canvas">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      </div>
      <label className="btn-ghost cursor-pointer text-xs">
        {busy ? 'Uploading…' : url ? `Change ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = '';
          }}
        />
      </label>
      {error && <span className="text-xs text-bad">{error}</span>}
    </div>
  );
}
