import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Image as ImageIcon, CheckCircle2, AlertTriangle, Tag, Package, Layers, ExternalLink, RefreshCcw } from "lucide-react";
import { DEFAULT_DESK_ACRYLIC_SIZE_KEY, DEFAULT_WALL_ACRYLIC_SIZE_KEY, MIRROR_PRICE_MULTIPLIER } from "../../data/acrylicSizes";

// Every real designer an affiliate can save a design from -- each opens in a
// new tab so this modal (and whatever's already typed into the fields below)
// stays open. Kept as one list so a fourth product line only means adding an
// entry here, not touching the JSX below.
//
// The ?size= has to sit BEFORE the #hash, not after: AffiliateProductPage-
// CleanAccryl.js's resolveAcrylicSize() reads window.location.search (the
// real query string), which only exists ahead of the fragment -- anything
// appended after #affiliate-product-accryl becomes part of the hash instead
// and is silently ignored, always falling back to the wall default.
const DESIGNER_LINKS = [
  { label: "Design a mirror", href: "/#product" },
  { label: "Design a desk sign", href: `/?size=${DEFAULT_DESK_ACRYLIC_SIZE_KEY}#affiliate-product-accryl` },
  { label: "Design a wall panel", href: `/?size=${DEFAULT_WALL_ACRYLIC_SIZE_KEY}#affiliate-product-accryl` },
  { label: "Design a custom mirror", href: `/?size=${DEFAULT_DESK_ACRYLIC_SIZE_KEY}&material=mirror#affiliate-product-accryl` },
];

/**
 * ProductUploadModal — Fotonix product creation flow
 *
 * Features:
 *  - Product templates (fixed pricing per template)
 *  - Multiple image uploads with main image selection
 *  - Firebase Storage + Realtime Database integration
 */

export default function ProductUploadModal({
  isOpen,
  onClose,
  getCurrentUser,
}) {
  // Product templates by category
  const PRODUCT_TEMPLATES = useMemo(
    () => ({
      // The "-affiliate" variants that used to sit here (lumina-mirror-affiliate,
      // light-up-affiliate, lumina-cut-affiliate) were a manual-photo-upload
      // path with no connection to the real designer -- nothing structured
      // ever got saved, unlike "My Saved Designs" below, which stores the
      // actual editable canvas (see StandardMirrorDesigner.js's saveDesign())
      // gated to affiliate accounts. Removed in favor of that real mechanism
      // rather than keeping two inconsistent ways to do the same thing.
      fotonix: [
        { id: "lumina-mirror-user", label: "Lumina Mirror User Design", basePrice: 29.99, category: "fotonix" },
        { id: "light-up-user", label: "Light Up User Design", basePrice: 19.99, category: "fotonix" },
        { id: "lumina-cut-user", label: "Lumina Mirror Cut To Shape User Design", basePrice: 40.00, category: "fotonix" },
        // Same cut-to-shape line as lumina-cut-user, mirror material instead
        // of acrylic -- routes to the same designer with &material=mirror
        // (see resolveProductClick in StoreCanvasBuilder.jsx). Mirror costs
        // more than acrylic at the same size, same MIRROR_PRICE_MULTIPLIER
        // the real designer page applies via priceForMaterial().
        { id: "lumina-cut-mirror-user", label: "Custom Shape Mirror (Back-Lit)", basePrice: Number((40.00 * MIRROR_PRICE_MULTIPLIER).toFixed(2)), category: "fotonix" },
      ]
    }),
    []
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("fotonix");
  const [templateId, setTemplateId] = useState("lumina-mirror-user");

  // Affiliate's own saved designs (from the mirror/pattern designers), selectable
  // alongside the fixed Fotonix templates
  const [savedDesigns, setSavedDesigns] = useState([]);
  const [loadingDesigns, setLoadingDesigns] = useState(false);

  // Template groups: fixed Fotonix templates + the affiliate's own saved designs
  const TEMPLATE_GROUPS = { ...PRODUCT_TEMPLATES, "my-designs": savedDesigns };

  // Get selected template
  const allTemplates = Object.values(TEMPLATE_GROUPS).flat();
  const selectedTemplate = allTemplates.find((t) => t.id === templateId) || allTemplates[0];
  const price = selectedTemplate?.basePrice ?? 0;

  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
      // Cleanup object URLs on unmount
      previews.forEach(preview => URL.revokeObjectURL(preview));
    };
  }, [isOpen, previews]);

  // Load the affiliate's own saved designs (from the mirror/pattern designers).
  // Pulled out of the effect so the "Refresh" button below can re-run it
  // on demand too -- an affiliate with none saved yet needs to jump to the
  // designer in a new tab, save one there, then come back to *this* still-
  // open modal and pick it up without losing whatever they've already
  // typed into the title/description fields here.
  const loadDesigns = async () => {
    const u = getCurrentUser();
    if (!isOpen || !u) return;

    setLoadingDesigns(true);
    try {
      const dbm = await import("firebase/database");
      const { getDatabase, ref: dbRef, get } = dbm;
      const db = getDatabase();
      const snapshot = await get(dbRef(db, `designs/${u.uid}`));

      if (snapshot.exists()) {
        const designsData = snapshot.val();
        const designsList = Object.entries(designsData).map(([id, d]) => ({
          id: `design_${id}`,
          label: d.title || 'Untitled design',
          basePrice: d.basePrice ?? 0,
          category: "my-designs",
          sourceDesignId: id,
          thumbnailUrl: d.thumbnailUrl || null,
        }));
        setSavedDesigns(designsList);
      } else {
        setSavedDesigns([]);
      }
    } catch (error) {
      console.error('Error loading saved designs:', error);
      setSavedDesigns([]);
    } finally {
      setLoadingDesigns(false);
    }
  };

  useEffect(() => {
    loadDesigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function showError(msg) { setToast({ ok: false, msg }); }
  function showOk(msg) { setToast({ ok: true, msg }); }

  function onPickFiles(selectedFiles) {
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    const validFiles = [];
    const validPreviews = [];
    
    for (let f of selectedFiles) {
      if (!/^image\//.test(f.type)) {
        showError("Please choose image files only");
        return;
      }
      if (f.size > 8 * 1024 * 1024) {
        showError("Each image must be under 8 MB");
        return;
      }
      validFiles.push(f);
      validPreviews.push(URL.createObjectURL(f));
    }
    
    setFiles(prev => [...prev, ...validFiles]);
    setPreviews(prev => [...prev, ...validPreviews]);
    
    // If this is the first upload, set the first image as main
    if (files.length === 0 && validFiles.length > 0) {
      setMainImageIndex(0);
    }
  }

  function removeImage(index) {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => {
      // Revoke the object URL to prevent memory leaks
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    
    // Adjust main image index if necessary
    if (mainImageIndex === index) {
      setMainImageIndex(0);
    } else if (mainImageIndex > index) {
      setMainImageIndex(prev => prev - 1);
    }
  }

  async function saveProduct() {
    const u = getCurrentUser();
    const usingSavedDesign = !!(selectedTemplate?.sourceDesignId && selectedTemplate.thumbnailUrl);
    if (!u) return showError("You must be signed in");
    if (!title.trim()) return showError("Add a product title");
    if (!templateId) return showError("Choose a product template");
    if (files.length === 0 && !usingSavedDesign) return showError("Please upload at least one image");

    try {
      setBusy(true);
      const productId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // Lazy import Firebase modules (keeps this file light)
      const dbm = await import("firebase/database");
      const { getDatabase, ref: dbRef, set } = dbm;

      const stm = await import("firebase/storage");
      const { getStorage, ref: stRef, uploadBytes, getDownloadURL } = stm;

      const storage = getStorage();
      const uploadedImages = [];

      // If a saved design was chosen, its thumbnail becomes the main product image
      if (usingSavedDesign) {
        uploadedImages.push({
          url: selectedTemplate.thumbnailUrl,
          storagePath: null,
          isMain: true,
          sourceDesignId: selectedTemplate.sourceDesignId,
        });
      }

      // Upload any additionally selected images
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop() || "jpg";
        const objectPath = `products/${u.uid}/${productId}/image_${i}.${ext}`;
        const objRef = stRef(storage, objectPath);
        await uploadBytes(objRef, file);
        const imageUrl = await getDownloadURL(objRef);
        uploadedImages.push({
          url: imageUrl,
          storagePath: objectPath,
          isMain: !usingSavedDesign && i === mainImageIndex
        });
      }

      const db = getDatabase();
      const productRef = dbRef(db, `products/${u.uid}/${productId}`);
      const payload = {
        id: productId,
        ownerId: u.uid,
        title: title.trim(),
        description: description.trim() || null,
        templateId,
        templateLabel: selectedTemplate.label,
        category: selectedTemplate.category,
        price,
        images: uploadedImages,
        mainImageIndex: Math.max(0, uploadedImages.findIndex((img) => img.isMain)),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await set(productRef, payload);

      showOk("Product saved");
      // --- Create per-channel tracked links (non-blocking) ---
      (async () => {
        try {
          const channels = ['twitter','facebook','instagram','tiktok','email'];
          const productPublicUrl = `${process.env.REACT_APP_PUBLIC_PRODUCT_BASE || window.location.origin + '/products'}/${productId}`;

          async function createTrackedLink(body) {
            const res = await fetch(`${process.env.REACT_APP_API_BASE || ''}/api/links`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => null);
              throw new Error(err?.error || res.statusText);
            }
            return await res.json();
          }

          const promises = channels.map((ch) => createTrackedLink({
            user_id: u.uid,
            destination_url: productPublicUrl,
            title: `${title.trim()} (${ch})`,
            product_id: productId,
            channel: ch,
            meta: { origin: 'product-create', templateId, price, category: selectedTemplate.category }
          }).then(r => ({ ok: true, r })).catch(e => ({ ok: false, err: String(e) })));

          const results = await Promise.all(promises);
          const successes = results.filter(x => x.ok).length;
          const failures = results.length - successes;
          if (successes > 0) showOk(`${successes} tracking links created${failures ? ` (${failures} failed)` : ''}`);
          else if (failures) showError('Failed to create tracking links (check server/migration)');
        } catch (e) {
          console.warn('Links creation step failed', e);
          // don't surface a blocking error — product is already saved
        }
      })();
      // reset all fields
      setTitle("");
      setDescription("");
      setFiles([]);
      setPreviews([]);
      setMainImageIndex(0);
      // close the modal after successful save
      try { if (typeof onClose === 'function') onClose(); } catch (e) { console.warn('onClose failed', e && e.message); }
    } catch (e) {
      showError(e?.message || "Couldn't save product");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-[200] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div role="dialog" aria-modal="true" className="relative w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}>
            {/* Header */}
            <div className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 p-5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  <h2 className="text-lg font-semibold">Create Product</h2>
                </div>
                <button aria-label="Close" onClick={onClose} className="rounded-full p-1.5 transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"><X className="h-5 w-5" /></button>
              </div>
              <p className="mt-1 text-xs/relaxed text-white/90">Choose a template and add your product photos.</p>
            </div>

            {/* Body - Scrollable */}
            <div className="bg-white p-4 dark:bg-zinc-900 max-h-[75vh] overflow-y-auto">
              <div className="space-y-4">
                {/* Product Template Selection */}
                <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="h-4 w-4 text-fuchsia-500" />
                    <h3 className="text-sm font-semibold">Product Template</h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <label className="block text-xs text-zinc-600">Category</label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => {
                        setSelectedCategory(e.target.value);
                        const firstTemplate = TEMPLATE_GROUPS[e.target.value][0];
                        if (firstTemplate) setTemplateId(firstTemplate.id);
                      }}
                      className="w-full rounded-xl border border-zinc-200 bg-white py-2 px-3 outline-none focus:ring-2 focus:ring-fuchsia-400 text-black dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                    >
                      <option value="fotonix">🎨 Fotonix Products</option>
                      <option value="my-designs">✏️ My Saved Designs</option>
                    </select>

                    <div className="flex items-center justify-between">
                      <label className="block text-xs text-zinc-600">Template</label>
                      {selectedCategory === "my-designs" && (
                        <button
                          type="button"
                          onClick={loadDesigns}
                          disabled={loadingDesigns}
                          className="inline-flex items-center gap-1 text-xs text-fuchsia-600 hover:text-fuchsia-700 disabled:opacity-50"
                        >
                          <RefreshCcw className={`h-3 w-3 ${loadingDesigns ? "animate-spin" : ""}`} /> Refresh
                        </button>
                      )}
                    </div>
                    {selectedCategory === "my-designs" && loadingDesigns ? (
                      <div className="flex items-center gap-2 py-2 text-sm text-zinc-500">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-fuchsia-400 border-t-transparent"></div>
                        Loading your designs…
                      </div>
                    ) : selectedCategory === "my-designs" && savedDesigns.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-zinc-300 p-3 text-xs text-zinc-500 dark:border-zinc-700">
                        <p className="mb-2">No saved designs yet. Design something and save it first, then it'll show up here.</p>
                        {/* Each opens in a new tab -- this modal (and whatever's already
                            typed into the fields below) stays open and untouched, so the
                            affiliate just designs, saves, comes back to this tab, and hits
                            Refresh above. */}
                        <div className="flex flex-wrap gap-2">
                          {DESIGNER_LINKS.map((d) => (
                            <a
                              key={d.href}
                              href={d.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-fuchsia-50 px-3 py-1.5 font-medium text-fuchsia-700 hover:bg-fuchsia-100 dark:bg-fuchsia-950/30 dark:text-fuchsia-300"
                            >
                              {d.label} <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <select
                          value={templateId}
                          onChange={(e) => setTemplateId(e.target.value)}
                          className="w-full appearance-none rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 outline-none focus:ring-2 focus:ring-fuchsia-400 text-black dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                        >
                          {TEMPLATE_GROUPS[selectedCategory].map((t) => (
                            <option key={t.id} value={t.id} className="text-black">
                              {t.label} {t.basePrice > 0 ? `- £${t.basePrice.toFixed(2)}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {selectedTemplate?.sourceDesignId && selectedTemplate.thumbnailUrl && (
                      <div className="flex items-center gap-2 rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
                        <img src={selectedTemplate.thumbnailUrl} alt={selectedTemplate.label} className="h-12 w-12 rounded-lg object-cover" />
                        <p className="text-xs text-zinc-500">This design's image will be used as your main product photo automatically.</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Product Details */}
                <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <h3 className="text-sm font-semibold mb-3">Product Details</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <label className="block text-xs text-zinc-600 mb-1">Title</label>
                      <input 
                        value={title} 
                        onChange={(e) => setTitle(e.target.value.slice(0, 120))} 
                        placeholder="e.g. Premium Cotton T-Shirt" 
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-fuchsia-400 text-black dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" 
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-600 mb-1">Description (optional)</label>
                      <textarea 
                        value={description} 
                        onChange={(e) => setDescription(e.target.value.slice(0, 600))} 
                        placeholder="Tell buyers about the product…" 
                        className="h-24 w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-fuchsia-400 text-black dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" 
                      />
                    </div>
                  </div>
                </section>

                {/* Images */}
                <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <h3 className="text-sm font-semibold mb-3">Product Images</h3>
                  <div className="space-y-3">
                    <label className="block text-xs text-zinc-600">Upload images (JPG/PNG/WebP, &lt; 8 MB each)</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      onChange={(e) => onPickFiles(e.target.files)}
                      className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-fuchsia-50 file:text-fuchsia-700 hover:file:bg-fuchsia-100"
                    />
                    
                    {previews.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs text-zinc-600">Click an image to set as main</p>
                        <div className="grid grid-cols-3 gap-2">
                          {previews.map((preview, index) => (
                            <div key={index} className="relative">
                              <img 
                                src={preview} 
                                alt={`Preview ${index + 1}`} 
                                className={`w-full h-24 object-cover rounded-lg cursor-pointer border-2 ${
                                  index === mainImageIndex 
                                    ? 'border-fuchsia-500 ring-2 ring-fuchsia-300' 
                                    : 'border-zinc-300 hover:border-zinc-400'
                                }`}
                                onClick={() => setMainImageIndex(index)}
                              />
                              {index === mainImageIndex && (
                                <div className="absolute top-1 left-1 bg-fuchsia-500 text-white text-xs px-2 py-0.5 rounded font-semibold">
                                  Main
                                </div>
                              )}
                              <button
                                onClick={() => removeImage(index)}
                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-600 shadow-lg"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-32 w-full items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 text-zinc-400 dark:border-zinc-700 bg-zinc-50">
                        <div className="flex flex-col items-center gap-2">
                          <ImageIcon className="h-8 w-8" />
                          <span className="text-xs">No images selected</span>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              {/* Footer Actions */}
              <div className="sticky bottom-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 p-4 mt-4 flex items-center justify-between">
                <div className="text-sm text-zinc-600">
                  {previews.length > 0 && (
                    <span>{previews.length} image{previews.length > 1 ? 's' : ''} • </span>
                  )}
                  Price: <span className="font-bold text-fuchsia-600">£{price.toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={onClose} className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm text-black hover:bg-zinc-50">Cancel</button>
                  <button onClick={saveProduct} disabled={busy} className="rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:shadow-lg transition">
                    {busy ? "Saving…" : "Create Product"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Toast */}
          <AnimatePresence>
            {toast && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className={`fixed bottom-6 left-1/2 z-[210] w-[92%] max-w-md -translate-x-1/2 rounded-2xl border p-4 text-sm shadow-xl ${toast.ok ? "border-emerald-200 bg-white text-zinc-800 dark:border-emerald-900/30 dark:bg-zinc-900 dark:text-zinc-100" : "border-red-200 bg-white text-zinc-800 dark:border-red-900/30 dark:bg-zinc-900 dark:text-zinc-100"}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full ${toast.ok ? "bg-emerald-500" : "bg-red-500"} text-white`}>{toast.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}</div>
                  <div className="flex-1"><p className="font-medium">{toast.ok ? "Saved" : "Error"}</p><p className="mt-0.5 text-xs opacity-80">{toast.msg}</p></div>
                  <button onClick={() => setToast(null)} className="rounded-full p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800" aria-label="Dismiss"><X className="h-4 w-4" /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
