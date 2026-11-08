import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { Tables } from '@nearbuy/shared';
import { supabase } from './supabase';

export type PublicSettings = Tables<'public_settings'>;

/** Loads data whenever the screen is focused; `reload` for pull-to-refresh. */
export function useFocusedQuery<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(async () => {
    try {
      setError(null);
      setData(await load());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, deps);

  useFocusEffect(
    useCallback(() => {
      run();
    }, [run]),
  );

  return { data, error, loading, reload: run };
}

export async function fetchSettings(): Promise<PublicSettings | null> {
  const { data, error } = await supabase.from('public_settings').select('*').maybeSingle();
  if (error) throw error;
  return data;
}
