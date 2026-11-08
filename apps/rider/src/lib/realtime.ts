import { useEffect } from 'react';
import { supabase } from './supabase';

/** Calls `onChange` when the server broadcasts `order_changed` on a private topic. */
export function useOrderBroadcast(topic: string | null, onChange: () => void) {
  useEffect(() => {
    if (!topic) return;
    let cancelled = false;
    const channel = supabase.channel(topic, { config: { private: true } });
    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel.on('broadcast', { event: 'order_changed' }, () => onChange()).subscribe();
    })();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);
}
