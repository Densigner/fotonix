import { useCallback, useRef, useState } from "react";

export function useHistory(initial) {
  const [present, setPresent] = useState(initial);
  const past = useRef([]);
  const future = useRef([]);

  const set = useCallback((next) => {
    past.current.push(present);
    setPresent(next);
    future.current = [];
  }, [present]);

  const undo = useCallback(() => {
    if (!past.current.length) return;
    const prev = past.current.pop();
    future.current.push(present);
    setPresent(prev);
  }, [present]);

  const redo = useCallback(() => {
    if (!future.current.length) return;
    const nxt = future.current.pop();
    past.current.push(present);
    setPresent(nxt);
  }, [present]);

  const canUndo = past.current.length > 0;
  const canRedo = future.current.length > 0;

  return { state: present, set, undo, redo, canUndo, canRedo };
}

export default useHistory;
