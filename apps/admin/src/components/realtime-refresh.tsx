'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Refreshes the current server-rendered page when an order changes (admin:orders broadcast). */
export function RealtimeRefresh({ topic = 'admin:orders' }: { topic?: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const channel = supabase.channel(topic, { config: { private: true } });

    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel
        .on('broadcast', { event: 'order_changed' }, () => {
          clearTimeout(timer);
          timer = setTimeout(() => router.refresh(), 400);
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router, topic]);
  return null;
}
