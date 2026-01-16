import React from "react";
import { getStorage, ref as stRef, listAll, getDownloadURL, uploadBytes } from "firebase/storage";

export default function MediaLibrary({ path = "uploads", isOpen, onClose, onPick }) {
  const storage = getStorage();
  const [items, setItems] = React.useState([]);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setBusy(true);
    const dir = stRef(storage, path);
    const res = await listAll(dir);
    const files = await Promise.all(res.items.map(async (i) => ({ path: i.fullPath, url: await getDownloadURL(i) })));
    setItems(files.reverse());
    setBusy(false);
  }, [storage, path]);

  React.useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const onUpload = async (file) => {
    if (!file) return;
    setBusy(true);
    const key = `${path}/img_${Date.now()}_${file.name}`;
    const r = stRef(storage, key);
    await uploadBytes(r, file);
    await load();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-16 w-[92%] max-w-3xl -translate-x-1/2 rounded-2xl bg-white p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Media library</h3>
          <div className="flex items-center gap-2">
            <input type="file" accept="image/*" onChange={(e) => onUpload(e.target.files?.[0])} />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {items.map((it) => (
            <button key={it.path} onClick={() => onPick?.(it.url)} className="rounded-lg overflow-hidden border p-1">
              <img src={it.url} alt="" className="w-full h-24 object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
