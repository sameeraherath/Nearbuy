import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

type Handlers = Record<string, (payload: Record<string, unknown>) => void>;

/**
 * Subscribes to a private broadcast topic (e.g. `order:<id>`, `rider:<id>`).
 * `onChange` runs on `order_changed`; `extra` maps other event names to handlers.
 */
export function useOrderBroadcast(topic: string | null, onChange: () => void, extra: Handlers = {}) {
  const latest = useRef({ onChange, extra });
  latest.current = { onChange, extra };
  const events = Object.keys(extra).sort().join(',');

  useEffect(() => {
    if (!topic) return;
    let cancelled = false;
    const channel = supabase.channel(topic, { config: { private: true } });
    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel.on('broadcast', { event: 'order_changed' }, () => latest.current.onChange());
      for (const name of events ? events.split(',') : []) {
        channel.on('broadcast', { event: name }, (msg) =>
          latest.current.extra[name]?.((msg.payload ?? {}) as Record<string, unknown>),
        );
      }
      channel.subscribe();
    })();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [topic, events]);
}
