import { useCallback, useEffect, useState } from 'react';
import { analyzeVideo } from './api';

export function useVideoFeedback() {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState(null);
  const [educationalResources, setEducationalResources] = useState([]);
  const [nextSteps, setNextSteps] = useState([]);

  const analyze = useCallback(async (file) => {
    setError(null);
    setItems([]);
    setMeta(null);
    if (previewUrl) {
      try { URL.revokeObjectURL(previewUrl); } catch (e) {}
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setLoading(true);
    try {
  const data = await analyzeVideo(file);
  setItems(data.items || []);
  setMeta(data.meta || null);
  setEducationalResources(data.educationalResources || []);
  setNextSteps(data.nextSteps || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [previewUrl]);

  // cleanup previewUrl on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        try { URL.revokeObjectURL(previewUrl); } catch (e) {}
      }
    };
  }, [previewUrl]);

  return { previewUrl, loading, error, items, meta, educationalResources, nextSteps, analyze };
}

export default useVideoFeedback;
