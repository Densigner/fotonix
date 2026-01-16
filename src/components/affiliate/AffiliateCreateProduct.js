import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Image as ImageIcon, UploadCloud, CheckCircle2, AlertTriangle, Tag, PoundSterling, Users, Package, Layers, Palette, Type, Image, Settings } from "lucide-react";

/**
 * ProductUploadModal — Enhanced Fotonix product creation flow
 *
 * Features:
 *  - Product templates (clothes, electronics, beauty, etc.)
 *  - Quantity multipliers (5x, 10x, etc.) with automatic pricing
 *  - Advanced customization options:
 *    * Color swatches with hex codes
 *    * Image pickers for visual selection
 *    * Radio buttons for single choice
 *    * Text inputs for personalization (engraving, names)
 *    * Dropdowns for multiple options
 *    * Conditional fields (show/hide based on selection)
 *    * Dynamic price changes per option
 *    * Size charts with custom pricing
 *    * File upload blocks (custom artwork)
 *    * Engraving/personalization fees
 *  - Bumper products (frequently bought together)
 *  - Multiple image uploads with main image selection
 *  - Affiliate assignment
 *  - Custom pricing and commission rates
 *  - Firebase Storage + Realtime Database integration
 */

export default function ProductUploadModal({
  isOpen,
  onClose,
  getCurrentUser,
}) {
  const user = getCurrentUser();

  // Product templates by category
  const PRODUCT_TEMPLATES = useMemo(
    () => ({
      fotonix: [
        { id: "lumina-mirror-user", label: "Lumina Mirror User Design", basePrice: 29.99, category: "fotonix" },
        { id: "lumina-mirror-affiliate", label: "Lumina Mirror Affiliate Design", basePrice: 29.99, category: "fotonix" },
        { id: "light-up-user", label: "Light Up User Design", basePrice: 19.99, category: "fotonix" },
        { id: "light-up-affiliate", label: "Light Up Affiliate Design", basePrice: 19.99, category: "fotonix" },
        { id: "lumina-cut-user", label: "Lumina Mirror Cut To Shape User Design", basePrice: 40.00, category: "fotonix" },
        { id: "lumina-cut-affiliate", label: "Lumina Mirror Cut To Shape Affiliate Design", basePrice: 40.00, category: "fotonix" },
      ],
      clothing: [
        { id: "tshirt", label: "T-Shirt", basePrice: 15.99, category: "clothing" },
        { id: "hoodie", label: "Hoodie", basePrice: 35.99, category: "clothing" },
        { id: "sweatshirt", label: "Sweatshirt", basePrice: 28.99, category: "clothing" },
        { id: "tank-top", label: "Tank Top", basePrice: 12.99, category: "clothing" },
        { id: "joggers", label: "Joggers", basePrice: 32.99, category: "clothing" },
      ],
      accessories: [
        { id: "hat", label: "Hat/Cap", basePrice: 18.99, category: "accessories" },
        { id: "bag", label: "Tote Bag", basePrice: 14.99, category: "accessories" },
        { id: "phone-case", label: "Phone Case", basePrice: 12.99, category: "accessories" },
        { id: "keychain", label: "Keychain", basePrice: 5.99, category: "accessories" },
        { id: "sticker", label: "Sticker Pack", basePrice: 4.99, category: "accessories" },
      ],
      beauty: [
        { id: "serum", label: "Face Serum", basePrice: 24.99, category: "beauty" },
        { id: "moisturizer", label: "Moisturizer", basePrice: 22.99, category: "beauty" },
        { id: "cleanser", label: "Cleanser", basePrice: 18.99, category: "beauty" },
        { id: "mask", label: "Face Mask", basePrice: 16.99, category: "beauty" },
      ],
      electronics: [
        { id: "phone-charger", label: "Phone Charger", basePrice: 15.99, category: "electronics" },
        { id: "earbuds", label: "Wireless Earbuds", basePrice: 45.99, category: "electronics" },
        { id: "power-bank", label: "Power Bank", basePrice: 29.99, category: "electronics" },
      ],
      other: [
        { id: "custom", label: "Custom Product", basePrice: 0, category: "other" },
      ]
    }),
    []
  );

  // Quantity multipliers
  const QUANTITY_OPTIONS = useMemo(
    () => [
      { value: 1, label: "1x", multiplier: 1 },
      { value: 2, label: "2x", multiplier: 2 },
      { value: 3, label: "3x", multiplier: 3 },
      { value: 5, label: "5x", multiplier: 4.5 }, // Slight discount for bulk
      { value: 10, label: "10x", multiplier: 9 }, // Better discount for larger bulk
      { value: 20, label: "20x", multiplier: 17 },
      { value: 50, label: "50x", multiplier: 40 },
    ],
    []
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("fotonix");
  const [templateId, setTemplateId] = useState("lumina-mirror-user");
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState(0);
  const [commissionRate, setCommissionRate] = useState(0.1);
  const [selectedAffiliate, setSelectedAffiliate] = useState(null);
  const [affiliates, setAffiliates] = useState([]);
  const [loadingAffiliates, setLoadingAffiliates] = useState(false);
  
  // Product variants (sizes, colors, etc.) with custom pricing
  const [variants, setVariants] = useState([]);
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantOptions, setNewVariantOptions] = useState([{ label: "", priceModifier: 0 }]);
  
  // Advanced customization options
  const [customizationBlocks, setCustomizationBlocks] = useState([]);
  const [showAddCustomization, setShowAddCustomization] = useState(false);
  const [newCustomization, setNewCustomization] = useState({
    type: 'text', // text, color-swatch, image-picker, radio, dropdown, file-upload, size-chart
    label: '',
    required: false,
    priceModifier: 0,
    options: [],
    conditionalDisplay: null, // {dependsOn: 'blockId', value: 'optionValue'}
    metadata: {} // Additional settings per type
  });
  
  // Bumper products with custom messaging
  const [availableProducts, setAvailableProducts] = useState([]);
  const [selectedBumpers, setSelectedBumpers] = useState([]);
  const [bumperMessage, setBumperMessage] = useState("Want to add this for 20% off?");
  const [bumperCTA, setBumperCTA] = useState("Add to cart");
  const [loadingProducts, setLoadingProducts] = useState(false);
  
  // Cross-sell widget blocks
  const [crossSellBlocks, setCrossSellBlocks] = useState([]);
  const [showAddCrossSell, setShowAddCrossSell] = useState(false);
  const [newCrossSell, setNewCrossSell] = useState({
    type: 'customers-bought',
    title: '',
    products: []
  });
  
  // Get selected template
  const allTemplates = Object.values(PRODUCT_TEMPLATES).flat();
  const selectedTemplate = allTemplates.find((t) => t.id === templateId) || allTemplates[0];
  
  // Calculate final price based on quantity and template
  const quantityOption = QUANTITY_OPTIONS.find(q => q.value === quantity) || QUANTITY_OPTIONS[0];
  const basePrice = templateId === "custom" ? customPrice : (selectedTemplate?.basePrice ?? 0);
  const finalPrice = basePrice * quantityOption.multiplier;

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

  // Load member's affiliates
  useEffect(() => {
    const loadAffiliates = async () => {
      if (!isOpen) return;
      
      setLoadingAffiliates(true);
      try {
        const memberId = localStorage.getItem('memberUID') || 'current-member-id';
        console.log('Loading affiliates for member:', memberId);
        
        const response = await fetch('/api/member/affiliates', {
          headers: {
            'x-member-uid': memberId,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Affiliate API response:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Affiliate API data:', data);
          console.log('Setting affiliates:', Array.isArray(data) ? data : []);
          setAffiliates(Array.isArray(data) ? data : []);
        } else {
          console.error('Failed to load affiliates:', response.status);
          const errorText = await response.text();
          console.error('Error response:', errorText);
          setAffiliates([]);
        }
      } catch (error) {
        console.error('Error loading affiliates:', error);
        setAffiliates([]);
      } finally {
        setLoadingAffiliates(false);
      }
    };
    
    loadAffiliates();
  }, [isOpen]);

  // Load existing products for bumper selection
  useEffect(() => {
    const loadProducts = async () => {
      if (!isOpen || !user) return;
      
      setLoadingProducts(true);
      try {
        const dbm = await import("firebase/database");
        const { getDatabase, ref: dbRef, get } = dbm;
        const db = getDatabase();
        const productsRef = dbRef(db, `products/${user.uid}`);
        const snapshot = await get(productsRef);
        
        if (snapshot.exists()) {
          const productsData = snapshot.val();
          const productsList = Object.values(productsData).map(p => ({
            id: p.id,
            title: p.title,
            price: p.price,
            mainImage: p.images?.[p.mainImageIndex || 0]?.url || null
          }));
          setAvailableProducts(productsList);
        } else {
          setAvailableProducts([]);
        }
      } catch (error) {
        console.error('Error loading products:', error);
        setAvailableProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };
    
    // Only load once when modal opens
    if (isOpen && availableProducts.length === 0 && !loadingProducts) {
      loadProducts();
    }
  }, [isOpen]);

  function showError(msg) { setToast({ ok: false, msg }); }
  function showOk(msg) { setToast({ ok: true, msg }); }

  // Add new variant (e.g., Size, Color, Material)
  function addVariant() {
    if (!newVariantName.trim()) {
      showError("Enter a variant name (e.g., Size, Color)");
      return;
    }
    
    const validOptions = newVariantOptions.filter(opt => opt.label.trim());
    if (validOptions.length === 0) {
      showError("Add at least one option for this variant");
      return;
    }
    
    const variant = {
      id: `variant_${Date.now()}`,
      name: newVariantName.trim(),
      options: validOptions.map((opt, i) => ({
        id: `opt_${Date.now()}_${i}`,
        label: opt.label.trim(),
        priceModifier: parseFloat(opt.priceModifier) || 0
      }))
    };
    
    setVariants([...variants, variant]);
    setNewVariantName("");
    setNewVariantOptions([{ label: "", priceModifier: 0 }]);
    setShowAddVariant(false);
  }

  function removeVariant(variantId) {
    setVariants(variants.filter(v => v.id !== variantId));
  }

  function addVariantOption() {
    setNewVariantOptions([...newVariantOptions, { label: "", priceModifier: 0 }]);
  }

  function updateVariantOption(index, field, value) {
    const updated = [...newVariantOptions];
    updated[index][field] = value;
    setNewVariantOptions(updated);
  }

  function removeVariantOption(index) {
    if (newVariantOptions.length > 1) {
      setNewVariantOptions(newVariantOptions.filter((_, i) => i !== index));
    }
  }

  // ========== CUSTOMIZATION BLOCK MANAGEMENT ==========
  
  const CUSTOMIZATION_TYPES = [
    { value: 'text', label: 'Text Input', icon: Type, description: 'For names, engraving, personalization' },
    { value: 'color-swatch', label: 'Color Swatches', icon: Palette, description: 'Visual color picker with hex codes' },
    { value: 'image-picker', label: 'Image Picker', icon: Image, description: 'Choose from preset images' },
    { value: 'radio', label: 'Radio Buttons', icon: CheckCircle2, description: 'Single choice selection' },
    { value: 'dropdown', label: 'Dropdown', icon: Layers, description: 'Dropdown menu for many options' },
    { value: 'file-upload', label: 'File Upload', icon: UploadCloud, description: 'Customer uploads custom artwork' },
    { value: 'size-chart', label: 'Size Chart', icon: Package, description: 'Size guide with measurements' },
  ];

  function addCustomizationBlock() {
    if (!newCustomization.label.trim()) {
      showError("Enter a label for this customization option");
      return;
    }

    // Validate based on type
    if (['color-swatch', 'image-picker', 'radio', 'dropdown'].includes(newCustomization.type)) {
      const validOptions = newCustomization.options.filter(opt => opt.label?.trim());
      if (validOptions.length === 0) {
        showError("Add at least one option");
        return;
      }
    }

    const block = {
      id: `custom_${Date.now()}`,
      type: newCustomization.type,
      label: newCustomization.label.trim(),
      required: newCustomization.required,
      priceModifier: parseFloat(newCustomization.priceModifier) || 0,
      options: newCustomization.options.map((opt, i) => ({
        id: `opt_${Date.now()}_${i}`,
        label: opt.label?.trim() || '',
        value: opt.value || opt.label?.trim().toLowerCase().replace(/\s+/g, '-') || '',
        priceModifier: parseFloat(opt.priceModifier) || 0,
        hexColor: opt.hexColor || null, // For color swatches
        imageUrl: opt.imageUrl || null, // For image pickers
      })),
      conditionalDisplay: newCustomization.conditionalDisplay,
      metadata: {
        ...newCustomization.metadata,
        maxLength: newCustomization.metadata.maxLength || 50, // For text inputs
        placeholder: newCustomization.metadata.placeholder || '',
        allowedFileTypes: newCustomization.metadata.allowedFileTypes || ['image/*'], // For file uploads
        maxFileSize: newCustomization.metadata.maxFileSize || 5, // MB
      }
    };

    setCustomizationBlocks([...customizationBlocks, block]);
    resetCustomizationForm();
    setShowAddCustomization(false);
  }

  function resetCustomizationForm() {
    setNewCustomization({
      type: 'text',
      label: '',
      required: false,
      priceModifier: 0,
      options: [],
      conditionalDisplay: null,
      metadata: {}
    });
  }

  function removeCustomizationBlock(blockId) {
    setCustomizationBlocks(customizationBlocks.filter(b => b.id !== blockId));
  }

  function addCustomizationOption() {
    setNewCustomization({
      ...newCustomization,
      options: [...newCustomization.options, { label: '', priceModifier: 0, hexColor: '#000000', imageUrl: '' }]
    });
  }

  function updateCustomizationOption(index, field, value) {
    const updated = [...newCustomization.options];
    updated[index][field] = value;
    setNewCustomization({ ...newCustomization, options: updated });
  }

  function removeCustomizationOption(index) {
    if (newCustomization.options.length > 1) {
      setNewCustomization({
        ...newCustomization,
        options: newCustomization.options.filter((_, i) => i !== index)
      });
    }
  }

  // ========== CROSS-SELL WIDGET MANAGEMENT ==========
  
  const CROSS_SELL_TEMPLATES = [
    { 
      value: 'customers-bought', 
      label: 'Customers Also Bought', 
      icon: Users,
      defaultTitle: 'Customers who bought this also bought...',
      description: 'Social proof widget showing popular combinations'
    },
    { 
      value: 'complete-look', 
      label: 'Complete the Look', 
      icon: Layers,
      defaultTitle: 'Complete the look',
      description: 'Style/outfit completion suggestions'
    },
    { 
      value: 'frequently-together', 
      label: 'Frequently Bought Together', 
      icon: Package,
      defaultTitle: 'Frequently bought together',
      description: 'Bundle suggestions with savings'
    },
    { 
      value: 'you-may-like', 
      label: 'You May Also Like', 
      icon: Tag,
      defaultTitle: 'You may also like...',
      description: 'Personalized recommendations'
    },
    { 
      value: 'trending', 
      label: 'Trending Now', 
      icon: AlertTriangle,
      defaultTitle: 'Trending now',
      description: 'Hot/popular products'
    },
  ];

  function addCrossSellBlock() {
    if (!newCrossSell.title.trim()) {
      const template = CROSS_SELL_TEMPLATES.find(t => t.value === newCrossSell.type);
      newCrossSell.title = template?.defaultTitle || 'Related Products';
    }
    
    if (newCrossSell.products.length === 0) {
      showError("Select at least one product for this widget");
      return;
    }

    const block = {
      id: `cross_${Date.now()}`,
      type: newCrossSell.type,
      title: newCrossSell.title.trim(),
      products: newCrossSell.products,
      createdAt: Date.now()
    };

    setCrossSellBlocks([...crossSellBlocks, block]);
    setNewCrossSell({ type: 'customers-bought', title: '', products: [] });
    setShowAddCrossSell(false);
  }

  function removeCrossSellBlock(blockId) {
    setCrossSellBlocks(crossSellBlocks.filter(b => b.id !== blockId));
  }

  function toggleCrossSellProduct(product) {
    const exists = newCrossSell.products.some(p => p.id === product.id);
    if (exists) {
      setNewCrossSell({
        ...newCrossSell,
        products: newCrossSell.products.filter(p => p.id !== product.id)
      });
    } else {
      setNewCrossSell({
        ...newCrossSell,
        products: [...newCrossSell.products, product]
      });
    }
  }

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
    if (!u) return showError("You must be signed in");
    if (!title.trim()) return showError("Add a product title");
    if (!templateId) return showError("Choose a product template");
    if (files.length === 0) return showError("Please upload at least one image");

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

      // Upload all images
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
          isMain: i === mainImageIndex
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
        basePrice,
        quantity,
        quantityMultiplier: quantityOption.multiplier,
        price: finalPrice,
        commissionRate,
        variants: variants.length > 0 ? variants : null, // Product variants (sizes, colors, etc.)
        customizationBlocks: customizationBlocks.length > 0 ? customizationBlocks : null, // Advanced customization options
        bumperMessage: bumperMessage.trim() || null,
        bumperCTA: bumperCTA.trim() || null,
        crossSellBlocks: crossSellBlocks.length > 0 ? crossSellBlocks : null,
        images: uploadedImages,
        mainImageIndex,
        affiliate: selectedAffiliate ? {
          id: selectedAffiliate.id,
          code: selectedAffiliate.affiliateCode,
          name: selectedAffiliate.displayName,
          email: selectedAffiliate.email
        } : null,
        bumperProducts: selectedBumpers.map(b => ({
          id: b.id,
          title: b.title,
          price: b.price
        })),
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
            meta: { origin: 'product-create', templateId, price: finalPrice, quantity, category: selectedTemplate.category }
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
      setQuantity(1);
      setCustomPrice(0);
      setVariants([]);
      setCustomizationBlocks([]);
      setBumperMessage("Want to add this for 20% off?");
      setBumperCTA("Add to cart");
      setCrossSellBlocks([]);
      setFiles([]);
      setPreviews([]);
      setMainImageIndex(0);
      setSelectedAffiliate(null);
      setSelectedBumpers([]);
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
              <p className="mt-1 text-xs/relaxed text-white/90">Choose a template, add variants, enable customization (engraving, colors, uploads), set pricing, and manage bumpers.</p>
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
                        const firstTemplate = PRODUCT_TEMPLATES[e.target.value][0];
                        setTemplateId(firstTemplate.id);
                      }}
                      className="w-full rounded-xl border border-zinc-200 bg-white py-2 px-3 outline-none focus:ring-2 focus:ring-fuchsia-400 text-black dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                    >
                      <option value="fotonix">🎨 Fotonix Products</option>
                      <option value="clothing">👕 Clothing</option>
                      <option value="accessories">💼 Accessories</option>
                      <option value="beauty">✨ Beauty</option>
                      <option value="electronics">📱 Electronics</option>
                      <option value="other">🔧 Custom/Other</option>
                    </select>

                    <label className="block text-xs text-zinc-600">Template</label>
                    <div className="relative">
                      <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <select 
                        value={templateId} 
                        onChange={(e) => setTemplateId(e.target.value)} 
                        className="w-full appearance-none rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 outline-none focus:ring-2 focus:ring-fuchsia-400 text-black dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      >
                        {PRODUCT_TEMPLATES[selectedCategory].map((t) => (
                          <option key={t.id} value={t.id} className="text-black">
                            {t.label} {t.basePrice > 0 ? `- £${t.basePrice.toFixed(2)}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
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

                {/* Quantity & Pricing */}
                <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 bg-gradient-to-br from-pink-50 to-violet-50 dark:from-pink-900/10 dark:to-violet-900/10">
                  <h3 className="text-sm font-semibold mb-3">Quantity & Pricing</h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <label className="block text-xs text-zinc-600 mb-1">Quantity</label>
                      <div className="grid grid-cols-4 gap-2">
                        {QUANTITY_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setQuantity(opt.value)}
                            className={`rounded-lg border-2 py-2 px-3 text-sm font-medium transition ${
                              quantity === opt.value
                                ? 'border-fuchsia-500 bg-fuchsia-500 text-white'
                                : 'border-zinc-200 bg-white text-black hover:border-fuchsia-300'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {templateId === "custom" ? (
                      <div>
                        <label className="block text-xs text-zinc-600 mb-1">Custom Base Price</label>
                        <div className="relative">
                          <PoundSterling className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={customPrice}
                            onChange={(e) => setCustomPrice(parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-fuchsia-400 text-black"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-zinc-800 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700">
                        <div className="flex items-center justify-between text-xs text-zinc-600 mb-1">
                          <span>Base Price:</span>
                          <span className="font-mono">£{basePrice.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-zinc-600 mb-1">
                          <span>Quantity:</span>
                          <span className="font-mono">{quantity}x (×{quantityOption.multiplier})</span>
                        </div>
                        <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-2"></div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">Final Price:</span>
                          <span className="text-lg font-bold text-fuchsia-600">£{finalPrice.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-xs text-zinc-600 mb-1">Commission Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={Number((commissionRate * 100).toFixed(1))}
                        onChange={(e) => setCommissionRate(Math.max(0, Math.min(100, Number(e.target.value || 0))) / 100)}
                        placeholder="e.g. 10"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-fuchsia-400 text-black"
                      />
                      <div className="text-[11px] mt-1 text-zinc-500">Commission paid to affiliates on each sale</div>
                    </div>
                  </div>
                </section>

                {/* Product Variants (Sizes, Colors, etc.) */}
                <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-indigo-500" />
                      <h3 className="text-sm font-semibold">Product Variants</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddVariant(!showAddVariant)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium"
                    >
                      {showAddVariant ? 'Cancel' : '+ Add Variant'}
                    </button>
                  </div>
                  
                  <p className="text-xs text-zinc-600 mb-3">Add dropdown options like Size, Color, Material with custom pricing</p>

                  {/* Existing Variants */}
                  {variants.length > 0 && (
                    <div className="space-y-3 mb-3">
                      {variants.map((variant) => (
                        <div key={variant.id} className="bg-white rounded-xl p-3 border border-indigo-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-indigo-700">{variant.name}</span>
                            <button
                              type="button"
                              onClick={() => removeVariant(variant.id)}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="space-y-1">
                            {variant.options.map((opt) => (
                              <div key={opt.id} className="flex items-center justify-between text-xs bg-indigo-50 rounded px-2 py-1">
                                <span className="font-medium">{opt.label}</span>
                                <span className="text-indigo-600">
                                  {opt.priceModifier > 0 ? `+£${opt.priceModifier.toFixed(2)}` : 
                                   opt.priceModifier < 0 ? `-£${Math.abs(opt.priceModifier).toFixed(2)}` : 
                                   'No change'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Variant Form */}
                  {showAddVariant && (
                    <div className="bg-white rounded-xl p-4 border border-indigo-300 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">Variant Name (e.g., Size, Color, Material)</label>
                        <input
                          type="text"
                          value={newVariantName}
                          onChange={(e) => setNewVariantName(e.target.value)}
                          placeholder="e.g., Size"
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-2">Options</label>
                        <div className="space-y-2">
                          {newVariantOptions.map((opt, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={opt.label}
                                onChange={(e) => updateVariantOption(index, 'label', e.target.value)}
                                placeholder="e.g., Small"
                                className="flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                              />
                              <div className="relative w-28">
                                <PoundSterling className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400" />
                                <input
                                  type="number"
                                  step="0.01"
                                  value={opt.priceModifier}
                                  onChange={(e) => updateVariantOption(index, 'priceModifier', e.target.value)}
                                  placeholder="0.00"
                                  className="w-full rounded-lg border border-zinc-300 pl-6 pr-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                                />
                              </div>
                              {newVariantOptions.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeVariantOption(index)}
                                  className="text-red-500 hover:text-red-700 px-2"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={addVariantOption}
                          className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          + Add Option
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={addVariant}
                        className="w-full rounded-lg bg-indigo-600 text-white py-2 text-sm font-semibold hover:bg-indigo-700"
                      >
                        Save Variant
                      </button>
                    </div>
                  )}

                  {variants.length === 0 && !showAddVariant && (
                    <div className="text-center py-4 text-zinc-500 text-xs">
                      No variants added. Click "Add Variant" to create options like sizes or colors.
                    </div>
                  )}
                </section>

                {/* Advanced Customization Options */}
                <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/10 dark:to-pink-900/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-purple-500" />
                      <h3 className="text-sm font-semibold">Advanced Customization</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddCustomization(!showAddCustomization)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-medium"
                    >
                      {showAddCustomization ? 'Cancel' : '+ Add Custom Field'}
                    </button>
                  </div>
                  
                  <p className="text-xs text-zinc-600 mb-3">Add personalization options like engraving, color pickers, file uploads, and more</p>

                  {/* Existing Customization Blocks */}
                  {customizationBlocks.length > 0 && (
                    <div className="space-y-3 mb-3">
                      {customizationBlocks.map((block) => (
                        <div key={block.id} className="bg-white rounded-xl p-3 border border-purple-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {React.createElement(CUSTOMIZATION_TYPES.find(t => t.value === block.type)?.icon || Settings, { className: "h-4 w-4 text-purple-600" })}
                              <span className="text-sm font-semibold text-purple-700">{block.label}</span>
                              {block.required && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Required</span>}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeCustomizationBlock(block.id)}
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-zinc-600 mb-2">
                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">
                              {CUSTOMIZATION_TYPES.find(t => t.value === block.type)?.label}
                            </span>
                            {block.priceModifier !== 0 && (
                              <span className={`px-2 py-0.5 rounded font-medium ${block.priceModifier > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {block.priceModifier > 0 ? '+' : ''}£{block.priceModifier.toFixed(2)}
                              </span>
                            )}
                          </div>

                          {/* Display options for relevant types */}
                          {['color-swatch', 'image-picker', 'radio', 'dropdown'].includes(block.type) && block.options.length > 0 && (
                            <div className="space-y-1 mt-2">
                              {block.type === 'color-swatch' ? (
                                <div className="flex flex-wrap gap-2">
                                  {block.options.map((opt) => (
                                    <div key={opt.id} className="flex items-center gap-1 bg-purple-50 rounded px-2 py-1">
                                      <div 
                                        className="w-4 h-4 rounded border border-zinc-300" 
                                        style={{ backgroundColor: opt.hexColor || '#000' }}
                                      />
                                      <span className="text-xs">{opt.label}</span>
                                      {opt.priceModifier !== 0 && (
                                        <span className="text-xs text-purple-600 ml-1">
                                          ({opt.priceModifier > 0 ? '+' : ''}£{opt.priceModifier.toFixed(2)})
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : block.type === 'image-picker' ? (
                                <div className="grid grid-cols-4 gap-2">
                                  {block.options.map((opt) => (
                                    <div key={opt.id} className="relative">
                                      {opt.imageUrl ? (
                                        <img src={opt.imageUrl} alt={opt.label} className="w-full h-16 object-cover rounded border border-purple-200" />
                                      ) : (
                                        <div className="w-full h-16 bg-purple-100 rounded border border-purple-200 flex items-center justify-center">
                                          <ImageIcon className="h-6 w-6 text-purple-400" />
                                        </div>
                                      )}
                                      <span className="text-xs absolute bottom-0 left-0 right-0 bg-black/60 text-white p-1 text-center rounded-b truncate">
                                        {opt.label}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {block.options.map((opt) => (
                                    <div key={opt.id} className="flex items-center justify-between text-xs bg-purple-50 rounded px-2 py-1">
                                      <span className="font-medium">{opt.label}</span>
                                      {opt.priceModifier !== 0 && (
                                        <span className="text-purple-600">
                                          {opt.priceModifier > 0 ? '+' : ''}£{opt.priceModifier.toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Display metadata for text/file upload types */}
                          {block.type === 'text' && block.metadata.maxLength && (
                            <div className="text-xs text-zinc-500 mt-1">Max {block.metadata.maxLength} characters</div>
                          )}
                          {block.type === 'file-upload' && (
                            <div className="text-xs text-zinc-500 mt-1">
                              Max {block.metadata.maxFileSize}MB • {block.metadata.allowedFileTypes?.join(', ')}
                            </div>
                          )}

                          {/* Conditional display indicator */}
                          {block.conditionalDisplay && (
                            <div className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded mt-2">
                              ⚡ Shows conditionally based on other selection
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add New Customization Form */}
                  {showAddCustomization && (
                    <div className="bg-white rounded-xl p-4 border border-purple-300 space-y-4">
                      {/* Customization Type Selection */}
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-2">Customization Type</label>
                        <div className="grid grid-cols-2 gap-2">
                          {CUSTOMIZATION_TYPES.map((type) => {
                            const Icon = type.icon;
                            return (
                              <button
                                key={type.value}
                                type="button"
                                onClick={() => setNewCustomization({ ...newCustomization, type: type.value, options: [] })}
                                className={`p-3 rounded-lg border-2 text-left transition ${
                                  newCustomization.type === type.value
                                    ? 'border-purple-500 bg-purple-50'
                                    : 'border-zinc-200 bg-white hover:border-purple-300'
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <Icon className="h-4 w-4 text-purple-600" />
                                  <span className="text-xs font-semibold">{type.label}</span>
                                </div>
                                <p className="text-[10px] text-zinc-500">{type.description}</p>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Basic Settings */}
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">Label (what customer sees)</label>
                        <input
                          type="text"
                          value={newCustomization.label}
                          onChange={(e) => setNewCustomization({ ...newCustomization, label: e.target.value })}
                          placeholder="e.g., Engraving Text, Choose Color, Upload Logo"
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400"
                        />
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newCustomization.required}
                            onChange={(e) => setNewCustomization({ ...newCustomization, required: e.target.checked })}
                            className="rounded border-zinc-300"
                          />
                          <span className="text-xs font-medium">Required field</span>
                        </label>

                        <div className="flex items-center gap-2 flex-1">
                          <label className="text-xs font-medium">Base Fee:</label>
                          <div className="relative flex-1">
                            <PoundSterling className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400" />
                            <input
                              type="number"
                              step="0.01"
                              value={newCustomization.priceModifier}
                              onChange={(e) => setNewCustomization({ ...newCustomization, priceModifier: e.target.value })}
                              placeholder="0.00"
                              className="w-full rounded-lg border border-zinc-300 pl-6 pr-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-purple-400"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Type-specific settings */}
                      {newCustomization.type === 'text' && (
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">Placeholder Text</label>
                          <input
                            type="text"
                            value={newCustomization.metadata.placeholder || ''}
                            onChange={(e) => setNewCustomization({ 
                              ...newCustomization, 
                              metadata: { ...newCustomization.metadata, placeholder: e.target.value }
                            })}
                            placeholder="e.g., Enter your name"
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400"
                          />
                          <label className="block text-xs font-medium text-zinc-700 mb-1 mt-2">Max Characters</label>
                          <input
                            type="number"
                            value={newCustomization.metadata.maxLength || 50}
                            onChange={(e) => setNewCustomization({ 
                              ...newCustomization, 
                              metadata: { ...newCustomization.metadata, maxLength: parseInt(e.target.value) || 50 }
                            })}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400"
                          />
                        </div>
                      )}

                      {newCustomization.type === 'file-upload' && (
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs font-medium text-zinc-700 mb-1">Max File Size (MB)</label>
                            <input
                              type="number"
                              value={newCustomization.metadata.maxFileSize || 5}
                              onChange={(e) => setNewCustomization({ 
                                ...newCustomization, 
                                metadata: { ...newCustomization.metadata, maxFileSize: parseInt(e.target.value) || 5 }
                              })}
                              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-700 mb-1">Allowed File Types</label>
                            <input
                              type="text"
                              value={newCustomization.metadata.allowedFileTypes?.join(', ') || 'image/*'}
                              onChange={(e) => setNewCustomization({ 
                                ...newCustomization, 
                                metadata: { ...newCustomization.metadata, allowedFileTypes: e.target.value.split(',').map(t => t.trim()) }
                              })}
                              placeholder="e.g., image/*, .pdf, .ai"
                              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-400"
                            />
                          </div>
                        </div>
                      )}

                      {/* Options for multi-choice types */}
                      {['color-swatch', 'image-picker', 'radio', 'dropdown'].includes(newCustomization.type) && (
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-2">Options</label>
                          <div className="space-y-2">
                            {newCustomization.options.map((opt, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={opt.label}
                                  onChange={(e) => updateCustomizationOption(index, 'label', e.target.value)}
                                  placeholder="e.g., Navy Blue"
                                  className="flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-purple-400"
                                />
                                
                                {newCustomization.type === 'color-swatch' && (
                                  <div className="relative">
                                    <input
                                      type="color"
                                      value={opt.hexColor || '#000000'}
                                      onChange={(e) => updateCustomizationOption(index, 'hexColor', e.target.value)}
                                      className="w-10 h-8 rounded border border-zinc-300 cursor-pointer"
                                    />
                                  </div>
                                )}

                                {newCustomization.type === 'image-picker' && (
                                  <input
                                    type="url"
                                    value={opt.imageUrl || ''}
                                    onChange={(e) => updateCustomizationOption(index, 'imageUrl', e.target.value)}
                                    placeholder="Image URL"
                                    className="w-32 rounded-lg border border-zinc-300 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-purple-400"
                                  />
                                )}

                                <div className="relative w-24">
                                  <PoundSterling className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400" />
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={opt.priceModifier}
                                    onChange={(e) => updateCustomizationOption(index, 'priceModifier', e.target.value)}
                                    placeholder="0.00"
                                    className="w-full rounded-lg border border-zinc-300 pl-6 pr-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-purple-400"
                                  />
                                </div>

                                {newCustomization.options.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeCustomizationOption(index)}
                                    className="text-red-500 hover:text-red-700 px-2"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={addCustomizationOption}
                            className="mt-2 text-xs text-purple-600 hover:text-purple-700 font-medium"
                          >
                            + Add Option
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={addCustomizationBlock}
                        className="w-full rounded-lg bg-purple-600 text-white py-2 text-sm font-semibold hover:bg-purple-700"
                      >
                        Save Customization
                      </button>
                    </div>
                  )}

                  {customizationBlocks.length === 0 && !showAddCustomization && (
                    <div className="text-center py-6 text-zinc-500 text-xs">
                      <Settings className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>No customization options added yet.</p>
                      <p className="mt-1">Add personalization fields, color pickers, file uploads, and more.</p>
                    </div>
                  )}
                </section>

                {/* Bumper Products */}
                <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-900/10 dark:to-purple-900/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="h-4 w-4 text-violet-500" />
                    <h3 className="text-sm font-semibold">Bumper Products (Checkout Upsell)</h3>
                  </div>
                  <p className="text-xs text-zinc-500 mb-3">Add products to suggest at checkout with custom messaging</p>
                  
                  {/* Custom Bumper Messaging */}
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">Bumper Message</label>
                      <input
                        type="text"
                        value={bumperMessage}
                        onChange={(e) => setBumperMessage(e.target.value)}
                        placeholder="e.g., Want to add this accessory for 20% off?"
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-400"
                      />
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <button type="button" onClick={() => setBumperMessage("Want to add this for 20% off?")} className="text-xs px-2 py-1 rounded bg-violet-100 text-violet-700 hover:bg-violet-200">20% off</button>
                        <button type="button" onClick={() => setBumperMessage("Complete your order with this!")} className="text-xs px-2 py-1 rounded bg-violet-100 text-violet-700 hover:bg-violet-200">Complete order</button>
                        <button type="button" onClick={() => setBumperMessage("Customers also bought this together")} className="text-xs px-2 py-1 rounded bg-violet-100 text-violet-700 hover:bg-violet-200">Social proof</button>
                        <button type="button" onClick={() => setBumperMessage("One-click add - Limited time offer!")} className="text-xs px-2 py-1 rounded bg-violet-100 text-violet-700 hover:bg-violet-200">Urgency</button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">Call-to-Action Button Text</label>
                      <input
                        type="text"
                        value={bumperCTA}
                        onChange={(e) => setBumperCTA(e.target.value)}
                        placeholder="e.g., Add to cart, Yes please!, Grab it now"
                        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-400"
                      />
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <button type="button" onClick={() => setBumperCTA("Add to cart")} className="text-xs px-2 py-1 rounded bg-violet-100 text-violet-700 hover:bg-violet-200">Add to cart</button>
                        <button type="button" onClick={() => setBumperCTA("Yes please!")} className="text-xs px-2 py-1 rounded bg-violet-100 text-violet-700 hover:bg-violet-200">Yes please!</button>
                        <button type="button" onClick={() => setBumperCTA("Grab it now")} className="text-xs px-2 py-1 rounded bg-violet-100 text-violet-700 hover:bg-violet-200">Grab it now</button>
                        <button type="button" onClick={() => setBumperCTA("One-click add")} className="text-xs px-2 py-1 rounded bg-violet-100 text-violet-700 hover:bg-violet-200">One-click add</button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Product Selection */}
                  <div className="border-t border-violet-200 pt-3">
                    <label className="block text-xs font-medium text-zinc-700 mb-2">Select Bumper Products</label>
                    {loadingProducts ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin h-4 w-4 border-2 border-fuchsia-400 border-t-transparent rounded-full"></div>
                    </div>
                    ) : availableProducts.length === 0 ? (
                    <div className="text-center py-4 text-zinc-500 text-xs">
                      No products available yet. Create your first product, then you can add bumpers to future products.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {availableProducts.map((product) => (
                        <label key={product.id} className="flex items-center gap-3 p-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedBumpers.some(b => b.id === product.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedBumpers([...selectedBumpers, product]);
                              } else {
                                setSelectedBumpers(selectedBumpers.filter(b => b.id !== product.id));
                              }
                            }}
                            className="rounded border-zinc-300"
                          />
                          {product.mainImage && (
                            <img src={product.mainImage} alt={product.title} className="w-10 h-10 rounded object-cover" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{product.title}</p>
                            <p className="text-xs text-zinc-500">£{product.price.toFixed(2)}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    )}
                    {selectedBumpers.length > 0 && (
                      <div className="mt-3 p-3 bg-gradient-to-r from-violet-100 to-purple-100 rounded-lg border border-violet-300">
                        <p className="text-xs font-semibold text-violet-800 mb-1">
                          ✓ {selectedBumpers.length} bumper product{selectedBumpers.length > 1 ? 's' : ''} selected
                        </p>
                        <p className="text-xs text-violet-700">Message: "{bumperMessage}"</p>
                        <p className="text-xs text-violet-700">CTA: "{bumperCTA}"</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* Cross-Sell Widgets */}
                <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-emerald-500" />
                      <h3 className="text-sm font-semibold">Cross-Sell Widgets</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddCrossSell(!showAddCrossSell)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium"
                    >
                      {showAddCrossSell ? 'Cancel' : '+ Add Widget'}
                    </button>
                  </div>
                  
                  <p className="text-xs text-zinc-600 mb-3">Add recommendation widgets displayed on the product page</p>

                  {/* Existing Cross-Sell Blocks */}
                  {crossSellBlocks.length > 0 && (
                    <div className="space-y-3 mb-3">
                      {crossSellBlocks.map((block) => {
                        const template = CROSS_SELL_TEMPLATES.find(t => t.value === block.type);
                        const Icon = template?.icon || Package;
                        return (
                          <div key={block.id} className="bg-white rounded-xl p-3 border border-emerald-200">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-emerald-600" />
                                <span className="text-sm font-semibold text-emerald-700">{block.title}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeCrossSellBlock(block.id)}
                                className="text-xs text-red-600 hover:text-red-700"
                              >
                                Remove
                              </button>
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs text-zinc-600 mb-2">
                              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-medium">
                                {template?.label}
                              </span>
                              <span className="text-zinc-500">{block.products.length} product{block.products.length > 1 ? 's' : ''}</span>
                            </div>

                            <div className="flex flex-wrap gap-2 mt-2">
                              {block.products.slice(0, 4).map((product) => (
                                <div key={product.id} className="flex items-center gap-1 bg-emerald-50 rounded px-2 py-1 text-xs">
                                  {product.mainImage && (
                                    <img src={product.mainImage} alt="" className="w-4 h-4 rounded object-cover" />
                                  )}
                                  <span className="font-medium truncate max-w-[100px]">{product.title}</span>
                                </div>
                              ))}
                              {block.products.length > 4 && (
                                <span className="text-xs text-zinc-500">+{block.products.length - 4} more</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add New Cross-Sell Widget Form */}
                  {showAddCrossSell && (
                    <div className="bg-white rounded-xl p-4 border border-emerald-300 space-y-4">
                      {/* Widget Type Selection */}
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-2">Widget Type</label>
                        <div className="grid grid-cols-1 gap-2">
                          {CROSS_SELL_TEMPLATES.map((template) => {
                            const Icon = template.icon;
                            return (
                              <button
                                key={template.value}
                                type="button"
                                onClick={() => setNewCrossSell({ ...newCrossSell, type: template.value, title: template.defaultTitle })}
                                className={`p-3 rounded-lg border-2 text-left transition flex items-start gap-3 ${
                                  newCrossSell.type === template.value
                                    ? 'border-emerald-500 bg-emerald-50'
                                    : 'border-zinc-200 bg-white hover:border-emerald-300'
                                }`}
                              >
                                <Icon className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <div className="text-sm font-semibold text-zinc-800">{template.label}</div>
                                  <p className="text-xs text-zinc-500 mt-0.5">{template.description}</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Widget Title */}
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-1">Widget Title (shown to customers)</label>
                        <input
                          type="text"
                          value={newCrossSell.title}
                          onChange={(e) => setNewCrossSell({ ...newCrossSell, title: e.target.value })}
                          placeholder={CROSS_SELL_TEMPLATES.find(t => t.value === newCrossSell.type)?.defaultTitle}
                          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                      </div>

                      {/* Product Selection */}
                      <div>
                        <label className="block text-xs font-medium text-zinc-700 mb-2">Select Products for Widget</label>
                        {availableProducts.length === 0 ? (
                          <div className="text-center py-4 text-zinc-500 text-xs">
                            No products available. Create products first.
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto border border-zinc-200 rounded-lg p-2">
                            {availableProducts.map((product) => (
                              <label key={product.id} className="flex items-center gap-3 p-2 rounded-lg border border-zinc-200 hover:bg-emerald-50 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={newCrossSell.products.some(p => p.id === product.id)}
                                  onChange={() => toggleCrossSellProduct(product)}
                                  className="rounded border-zinc-300"
                                />
                                {product.mainImage && (
                                  <img src={product.mainImage} alt={product.title} className="w-10 h-10 rounded object-cover" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">{product.title}</p>
                                  <p className="text-xs text-zinc-500">£{product.price.toFixed(2)}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                        {newCrossSell.products.length > 0 && (
                          <div className="mt-2 text-xs text-emerald-700 font-medium">
                            ✓ {newCrossSell.products.length} product{newCrossSell.products.length > 1 ? 's' : ''} selected
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={addCrossSellBlock}
                        className="w-full rounded-lg bg-emerald-600 text-white py-2 text-sm font-semibold hover:bg-emerald-700"
                      >
                        Add Widget
                      </button>
                    </div>
                  )}

                  {crossSellBlocks.length === 0 && !showAddCrossSell && (
                    <div className="text-center py-6 text-zinc-500 text-xs">
                      <Layers className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>No cross-sell widgets added yet.</p>
                      <p className="mt-1">Add "Customers also bought" or "Complete the look" sections to your product page.</p>
                    </div>
                  )}
                </section>

                {/* Affiliate Selection */}
                <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <h3 className="text-sm font-semibold mb-3">Affiliate Assignment</h3>
                  {loadingAffiliates ? (
                    <div className="flex items-center justify-center py-3 text-zinc-500">
                      <div className="animate-spin h-4 w-4 border-2 border-fuchsia-400 border-t-transparent rounded-full mr-2"></div>
                      Loading affiliates...
                    </div>
                  ) : affiliates.length === 0 ? (
                    <div className="text-center py-3 text-zinc-500">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No affiliates found</p>
                      <p className="text-xs">Create an affiliate first to associate with products</p>
                    </div>
                  ) : (
                    <>
                      <select
                        value={selectedAffiliate?.id || ''}
                        onChange={(e) => {
                          const affiliate = affiliates.find(a => a.id === e.target.value);
                          setSelectedAffiliate(affiliate || null);
                        }}
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-fuchsia-400 text-black dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                      >
                        <option value="">Select an affiliate (optional)</option>
                        {affiliates.map((affiliate) => (
                          <option key={affiliate.id} value={affiliate.id}>
                            {affiliate.displayName} ({affiliate.affiliateCode})
                          </option>
                        ))}
                      </select>
                      {selectedAffiliate && (
                        <div className="mt-2 p-2 bg-gradient-to-r from-pink-50 to-violet-50 dark:from-pink-900/20 dark:to-violet-900/20 rounded-lg border border-pink-200 dark:border-pink-800/50">
                          <p className="text-xs font-medium text-pink-700 dark:text-pink-300">Selected: {selectedAffiliate.displayName}</p>
                          <p className="text-xs text-pink-600 dark:text-pink-400">Code: {selectedAffiliate.affiliateCode}</p>
                          <p className="text-xs text-pink-600 dark:text-pink-400">Email: {selectedAffiliate.email}</p>
                        </div>
                      )}
                    </>
                  )}
                  <div className="text-[11px] mt-2 text-zinc-500">Choose which affiliate will receive commissions for this product.</div>
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
                  Final price: <span className="font-bold text-fuchsia-600">£{finalPrice.toFixed(2)}</span>
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
