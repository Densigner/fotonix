import { useEffect, useState } from 'react';
import { getLinkStats } from './api';

export default function useLinkStats(slug) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    getLinkStats(slug)
      .then((res) => {
        if (!mounted) return;
        setStats(res);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => { mounted = false; };
  }, [slug]);

  return { stats, loading, error };
}
