import { useEffect, useRef } from "react";

// simple debounced autosave hook: calls save(payload) after delay when value changes
export function useAutosave(value, save, delay = 800) {
  const t = useRef(null);
  useEffect(() => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => {
      try { save(value); } catch (e) { console.error(e); }
    }, delay);
    return () => clearTimeout(t.current);
  }, [value, save, delay]);
}

export default useAutosave;