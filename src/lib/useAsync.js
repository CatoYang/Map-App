import { useCallback, useEffect, useState } from 'react';

/**
 * Run an async function when `deps` change and track its result.
 *
 *   const { data, error, loading, reload } = useAsync(() => getCampaign(id), [id]);
 */
export function useAsync(fn, deps) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState(s => ({ ...s, loading: true, error: null }));
    fn().then(
      data  => { if (!cancelled) setState({ data, error: null, loading: false }); },
      error => { if (!cancelled) setState({ data: undefined, error, loading: false }); },
    );
    return () => { cancelled = true; };
  }, [...deps, version]);

  const reload = useCallback(() => setVersion(v => v + 1), []);
  return { ...state, reload };
}
