import React, { useState, useRef, useEffect } from 'react';

// MailBuilderOnboarding.jsx — fixed, self-contained onboarding flow.
// Saves uploaded images to Firebase Storage and writes theme manifest
// to Realtime Database at /storefronts/<USER_ID>/theme using provided helpers.

import { uploadThemeAsset, saveThemeManifest } from './firebase/storageHelpers';
import { auth, db } from './firebase/init';

// Wrapper: gate rendering before any hooks run
export default function MailBuilderOnboarding({ open, ...rest }) {
  if (!open) return null;
  return <MailBuilderOnboardingInner {...rest} />;
}

// Inner component: all hooks live here and are unconditional
function MailBuilderOnboardingInner({ onFinish }) {
  const steps = ['Brand', 'Logos', 'Colours', 'Typography', 'Social', 'Footer', 'Finalize'];
  const FALLBACK_LOGO = '/images/examplecompany.png';
  const [step, setStep] = useState(0);
  const stepRefs = useRef([]);
  if (stepRefs.current.length === 0) stepRefs.current = steps.map(() => React.createRef());
  const [saving, setSaving] = useState(false);
  const [savedFormats, setSavedFormats] = useState([]);
  const [showInfo, setShowInfo] = useState(false);
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    brandName: '',
    tagline: '',
  logos: [], // { id, url, file, name }
  defaultLogoId: null,
  brandDisplay: 'name', // 'name' | 'image' - whether to show text brand or image logo in previews
  primaryColor: '',
  logoSize: 'medium',
    formatName: '',
    manifestId: null,
    secondaryColors: [],
    socialPlacement: 'center',
    logoPlacement: 'left',
    headingFont: 'system-ui, Arial, sans-serif',
    bodyFont: 'system-ui, Arial, sans-serif',
    headingSize: 24,
    bodySize: 16,
    headingBold: false,
    headingItalic: false,
    bodyBold: false,
    bodyItalic: false,
    socialLinks: [],
    unsubscribeText: 'If you no longer wish to receive these emails, unsubscribe.'
  });

  // NOTE: setField is the single, canonical updater for the shared `form` state
  // and must be used by inputs to keep the live preview in sync. Avoid keeping
  // duplicate local state for form fields that is aggressively re-synced from
  // `form` on every render — that pattern can overwrite user input and cause
  // the input to appear to accept only a single character. Prefer calling
  // setField(...) on each onChange so the `form` object remains the source of
  // truth.
  function setField(key, value) {
    // debug: log updates so we can confirm live preview receives changes
    try { console.debug && console.debug('[MailOnboard] setField', key, value); } catch(e) {}
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function getLogoPx() {
    if (form.logoSize === 'small') return 40;
    if (form.logoSize === 'large') return 96;
    return 64; // medium
  }

  function handleLogoFiles(files) {
    const arr = Array.from(files || []);
    // Filter to only image MIME types for safety
    const images = arr.filter(f => f && f.type && f.type.startsWith('image/'));
    const rejected = arr.length - images.length;
    if (rejected > 0) {
      window.alert('Only image files are accepted. Non-image files were ignored.');
    }
    const mapped = images.map(f => ({ id: Math.random().toString(36).slice(2,9), file: f, url: URL.createObjectURL(f), name: f.name }));
    setForm(prev => {
      const newLogos = [...prev.logos, ...mapped];
      return { ...prev, logos: newLogos, defaultLogoId: prev.defaultLogoId || (mapped[0]?.id || null) };
    });
  }
  function removeLogo(id) {
    setForm(prev => {
      const logos = prev.logos.filter(l => l.id !== id);
      let defaultLogoId = prev.defaultLogoId;
      if (prev.defaultLogoId === id) defaultLogoId = logos[0]?.id || null;
      return { ...prev, logos, defaultLogoId };
    });
  }

  function selectDefaultLogo(id) { setField('defaultLogoId', id); }

  function addSecondaryColor() { setForm(prev => ({ ...prev, secondaryColors: [...prev.secondaryColors, '#ffffff'] })); }
  function setSecondaryColor(i, value) { setForm(prev => { const copy = [...prev.secondaryColors]; copy[i] = value; return { ...prev, secondaryColors: copy }; }); }
  function removeSecondaryColor(i) { setForm(prev => ({ ...prev, secondaryColors: prev.secondaryColors.filter((_, idx) => idx !== i) })); }

  function addSocialLink() { setForm(prev => ({ ...prev, socialLinks: [...prev.socialLinks, { provider: 'YouTube', url: '' }] })); }
  function updateSocialLink(i, patch) { setForm(prev => ({ ...prev, socialLinks: prev.socialLinks.map((s, idx) => idx===i ? { ...s, ...patch } : s) })); }
  function removeSocialLink(i) { setForm(prev => ({ ...prev, socialLinks: prev.socialLinks.filter((_, idx) => idx!==i) })); }

  function validateStep(index) {
    switch(index) {
      case 0:
        if (!form.brandName.trim()) return 'Please enter a brand name';
        return null;
      case 1:
        if (form.logos.length === 0) return 'Please upload at least one logo';
        return null;
      default:
        return null;
    }
  }

  async function handleNext() {
    const err = validateStep(step);
    if (err) { window.alert(err); return; }
    if (step < steps.length - 1) {
      const ns = step + 1;
      setStep(ns);
      setTimeout(() => {
        const ref = stepRefs.current[ns];
        if (ref && ref.current && ref.current.scrollIntoView) {
          try { ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch(e) { window.scrollTo({ top: 0, behavior: 'smooth' }); }
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 60);
      return;
    }
    await handleSave();
  }

  function handleBack() { if (step === 0) return; setStep(s => s - 1); }

  async function handleSave() {
    setSaving(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.uid) throw new Error('You must be signed in to save your theme.');
      const userId = currentUser.uid;

      // Upload logos sequentially
      const uploadedLogos = [];
      for (const logo of form.logos) {
        if (logo.file) {
          const res = await uploadThemeAsset(logo.file, userId, 'logos');
          uploadedLogos.push({ name: logo.name, downloadURL: res.downloadURL, gsPath: res.gsPath, storagePath: res.storagePath });
        } else if (logo.url) {
          uploadedLogos.push({ name: logo.name || 'existing', downloadURL: logo.url, gsPath: null, storagePath: null });
        }
      }

      const manifest = {
        formatName: form.formatName,
        brandName: form.brandName,
        tagline: form.tagline,
        logos: uploadedLogos,
        logoSize: form.logoSize,
        primaryColor: form.primaryColor,
        secondaryColors: form.secondaryColors,
        headingFont: form.headingFont,
        bodyFont: form.bodyFont,
        headingSize: form.headingSize,
        bodySize: form.bodySize,
        headingBold: form.headingBold,
        headingItalic: form.headingItalic,
        bodyBold: form.bodyBold,
        bodyItalic: form.bodyItalic,
        socialLinks: form.socialLinks,
        socialPlacement: form.socialPlacement,
        unsubscribeText: form.unsubscribeText
      };

  const res = await saveThemeManifest(userId, manifest);
  // If saved to DB, capture returned key so user can re-select later
  if (res && res.key) setField('manifestId', res.key);
  // Refresh saved formats list after save
  try { await loadSavedFormats(); } catch (e) {}
      try { window?.dataLayer?.push?.({ event: 'brandkit_saved', userId }); } catch(e){}

  if (typeof onFinish === 'function') onFinish(); else { try { window.location.hash = 'mail-campaign'; } catch(e) { window.location.href = '/#mail-campaign'; } }
    } catch (err) {
      console.error('Save failed', err);
      window.alert('Save failed: ' + (err.message || 'unknown'));
    } finally { setSaving(false); }
  }

  async function loadSavedFormats() {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.uid) { setSavedFormats([]); return []; }
      // If realtime DB not configured, read localStorage demo entries
      if (!db) {
        const keyPrefix = `mailbuilder:theme:${currentUser.uid}`;
        const found = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(keyPrefix)) {
            try {
              const manifest = JSON.parse(localStorage.getItem(k));
              found.push({ key: k, manifest });
            } catch (e) {}
          }
        }
        setSavedFormats(found);
        return found;
      }

      const { ref, get } = await import('firebase/database');
      const baseRef = ref(db, `mailbuilder/themes/${currentUser.uid}`);
      const snap = await get(baseRef);
      const out = [];
      if (snap && snap.exists && snap.exists()) {
        snap.forEach(child => {
          out.push({ key: child.key, manifest: child.val() });
        });
      }
      setSavedFormats(out);
      return out;
    } catch (e) {
      console.warn('Could not load saved formats', e);
      setSavedFormats([]);
      return [];
    }
  }

  function loadSavedFormat(entry) {
    try {
      const manifest = entry && entry.manifest ? entry.manifest : null;
      if (!manifest) return window.alert('Invalid format selected');
      // Map manifest fields back into form where appropriate
      setForm(prev => ({
        ...prev,
        brandName: manifest.brandName || prev.brandName,
        tagline: manifest.tagline || prev.tagline,
        primaryColor: manifest.primaryColor || prev.primaryColor,
        secondaryColors: manifest.secondaryColors || prev.secondaryColors,
        headingFont: manifest.headingFont || prev.headingFont,
        bodyFont: manifest.bodyFont || prev.bodyFont,
        headingSize: manifest.headingSize || prev.headingSize,
        bodySize: manifest.bodySize || prev.bodySize,
        headingBold: manifest.headingBold || prev.headingBold,
        headingItalic: manifest.headingItalic || prev.headingItalic,
        bodyBold: manifest.bodyBold || prev.bodyBold,
        bodyItalic: manifest.bodyItalic || prev.bodyItalic,
        socialLinks: manifest.socialLinks || prev.socialLinks,
        socialPlacement: manifest.socialPlacement || prev.socialPlacement,
        unsubscribeText: manifest.unsubscribeText || prev.unsubscribeText,
        logoSize: manifest.logoSize || prev.logoSize,
        formatName: manifest.formatName || prev.formatName,
        manifestId: entry.key || prev.manifestId,
      }));
      // If manifest contains logos with downloadURL, map them into logos[]
      if (manifest.logos && Array.isArray(manifest.logos)) {
        const logos = manifest.logos.map((l, i) => ({ id: l.gsPath || ('saved-'+i+'-'+Math.random().toString(36).slice(2,6)), url: l.downloadURL || l.url || '', name: l.name || 'logo' }));
        setForm(prev => ({ ...prev, logos, defaultLogoId: logos[0]?.id || prev.defaultLogoId }));
      }
      window.alert('Format loaded');
    } catch (e) {
      console.error('Load format failed', e);
      window.alert('Could not load format: ' + (e.message || 'unknown'));
    }
  }

  // progress removed; onboarding now uses full-page sections without a top progress bar

  /* ---------------- subcomponents ---------------- */

  // Shared social icon renderer used by StepSocial and previews
  function getSocialIcon(provider, size = 20) {
    if (!provider) return null;
    switch((provider||'').toLowerCase()) {
      case 'youtube':
        return (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M23.5 6.2a3 3 0 0 0-2.12-2.12C19.7 3.5 12 3.5 12 3.5s-7.7 0-9.38.58A3 3 0 0 0 .5 6.2 31.7 31.7 0 0 0 0 12a31.7 31.7 0 0 0 .5 5.8 3 3 0 0 0 2.12 2.12C4.3 20.5 12 20.5 12 20.5s7.7 0 9.38-.58A3 3 0 0 0 23.5 17.8 31.7 31.7 0 0 0 24 12a31.7 31.7 0 0 0-.5-5.8z" fill="#FF0000"/><path d="M10 15l5-3-5-3v6z" fill="#fff"/></svg>);
      case 'tiktok': return (<img src="/images/hero/tiktok.png" style={{width:size, height:size, objectFit:'contain'}} alt="TikTok"/>);
      case 'instagram': return (<img src="/images/hero/instalogo.jpg" alt="Instagram" style={{width:size, height:size, objectFit:'contain'}} />);
      case 'twitter': return (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M23 4.5c-.7.3-1.5.6-2.3.7.8-.5 1.4-1.3 1.7-2.3-.8.5-1.7.8-2.6 1-1.5-1.6-4-1.6-5.5 0-1.1 1.1-1.5 2.7-1 4.1C8 8.8 4.6 6.9 2 4.1c-.9 1.6-.2 3.7 1.2 4.7-.6 0-1.2-.2-1.7-.5 0 2 1.4 3.8 3.5 4.2-.6.2-1.2.2-1.8.1.5 1.7 2 3 3.7 3-1.3 1-3 1.5-4.6 1.2 1.7 1.1 3.8 1.7 6 1.7 7.2 0 11.1-6 11.1-11.1v-.5c.8-.6 1.5-1.4 2-2.3-.7.3-1.5.5-2.3.6z" fill="#1DA1F2"/></svg>);
      case 'facebook': return (<img src="/images/hero/facebook.png" alt="Facebook" style={{width:size, height:size, objectFit:'contain'}} />);
      case 'linkedin': return (<img src="/images/hero/linkedin.png" alt="LinkedIn" style={{width:size, height:size, objectFit:'contain'}} />);
      case 'pinterest': return (<img src="/images/hero/pinterest.png" alt="Pinterest" style={{width:size, height:size, objectFit:'contain'}} />);
      default: return (<svg width={size} height={size} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ccc"/></svg>);
    }
  }

  function StepBrand() {
    const [localBrandName, setLocalBrandName] = useState(form.brandName || '');
    const [localTagline, setLocalTagline] = useState(form.tagline || '');

    // Keep locals in sync if form is loaded/changed externally
    useEffect(() => { setLocalBrandName(form.brandName || ''); }, [form.brandName]);
    useEffect(() => { setLocalTagline(form.tagline || ''); }, [form.tagline]);

    // Commit helpers
    const commitBrand = () => setField('brandName', localBrandName);
    const commitTagline = () => setField('tagline', localTagline);

    return (
      <div className="space-y-4">
        <div>
          <div className="text-sm font-medium">Brand display</div>
          <div className="mt-2 flex items-center gap-3">
            <label className={`px-2 py-1 border rounded ${form.brandDisplay==='name' ? 'bg-gray-100' : ''}`}><input type="radio" name="brandDisplay" checked={form.brandDisplay==='name'} onChange={()=>setField('brandDisplay','name')} /> Text</label>
            <label className={`px-2 py-1 border rounded ${form.brandDisplay==='image' ? 'bg-gray-100' : ''}`}><input type="radio" name="brandDisplay" checked={form.brandDisplay==='image'} onChange={()=>setField('brandDisplay','image')} /> Image (use default logo)</label>
          </div>
          {form.brandDisplay === 'image' && (
            <div className="mt-2 text-xs text-gray-600">Using image logo in previews. If you haven't uploaded a logo yet, add one in the Logos step.</div>
          )}
        </div>
        <label className="block">
          <div className="text-sm font-medium">Brand name</div>
          <input
            className="mt-1 w-full border px-3 py-2 bg-white text-black"
            value={localBrandName}
            onChange={(e) => setLocalBrandName(e.target.value)}
            onBlur={commitBrand}
          />
        </label>

        <label className="block">
          <div className="text-sm font-medium">Tagline (optional)</div>
          <input
            className="mt-1 w-full border px-3 py-2 bg-white text-black"
            value={localTagline}
            onChange={(e) => setLocalTagline(e.target.value)}
            onBlur={commitTagline}
          />
        </label>

        <div className="text-sm text-gray-600">
          Tip: Brand name appears in templates and prefilled sender fields.
        </div>
        
      </div>
    );
  }

  async function handleUnsubscribe(e) {
    e && e.preventDefault && e.preventDefault();
    if (!window.confirm('Are you sure you want to unsubscribe? This will remove your user data from our database.')) return;
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.uid) { window.alert('You must be signed in to unsubscribe.'); return; }
      if (!db) { window.alert('Realtime database is not configured in this environment.'); return; }
      const { ref, remove } = await import('firebase/database');
      await remove(ref(db, `users/${currentUser.uid}`));
      try { await auth.signOut?.(); } catch(e) {}
      window.alert('You have been unsubscribed and your user data removed.');
    } catch (err) {
      console.error('Unsubscribe failed', err);
      window.alert('Could not unsubscribe: ' + (err.message || 'unknown'));
    }
  }

  function StepLogos() {
    const [dragActive, setDragActive] = useState(false);

    const onDragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(true);
    };
    const onDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // keep overlay visible
      setDragActive(true);
    };
    const onDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
    };
    const onDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const files = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files : null;
      if (files && files.length) handleLogoFiles(files);
    };
    return (
      <div className="space-y-4">
        <div>
          <div className="text-sm font-medium">Upload logos</div>
          <div className="text-xs text-gray-500 mt-1">Drag & drop images here or click + to add. Supported: PNG, JPG, SVG.</div>
          <div className="mt-3 flex items-center gap-4">
            <div className="text-sm font-medium">Logo placement</div>
            <div className="flex items-center gap-2">
              <label className={`px-2 py-1 border rounded ${form.logoPlacement==='left' ? 'bg-gray-100' : ''}`}><input type="radio" name="logoPlacement" checked={form.logoPlacement==='left'} onChange={()=>setField('logoPlacement','left')} /> Left</label>
              <label className={`px-2 py-1 border rounded ${form.logoPlacement==='above' ? 'bg-gray-100' : ''}`}><input type="radio" name="logoPlacement" checked={form.logoPlacement==='above'} onChange={()=>setField('logoPlacement','above')} /> Above/Center</label>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <div className="text-sm font-medium">Logo size</div>
            <div className="flex items-center gap-2">
              <label className={`px-2 py-1 border rounded ${form.logoSize==='small' ? 'bg-gray-100' : ''}`}><input type="radio" name="logoSize" checked={form.logoSize==='small'} onChange={()=>setField('logoSize','small')} /> Small</label>
              <label className={`px-2 py-1 border rounded ${form.logoSize==='medium' ? 'bg-gray-100' : ''}`}><input type="radio" name="logoSize" checked={form.logoSize==='medium'} onChange={()=>setField('logoSize','medium')} /> Medium</label>
              <label className={`px-2 py-1 border rounded ${form.logoSize==='large' ? 'bg-gray-100' : ''}`}><input type="radio" name="logoSize" checked={form.logoSize==='large'} onChange={()=>setField('logoSize','large')} /> Large</label>
            </div>
          </div>
          <div className="mt-2">
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={e=>handleLogoFiles(e.target.files)} className="hidden" />
          </div>
          <div
            className="mt-3 grid grid-cols-3 gap-3 relative"
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={(e)=>{
              // intercept and only pass image files
              e.preventDefault(); e.stopPropagation();
              setDragActive(false);
              const files = e.dataTransfer && e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
              const images = files.filter(f => f && f.type && f.type.startsWith('image/'));
              const rejected = files.length - images.length;
              if (rejected > 0) window.alert('Only image files are accepted. Non-image files were ignored.');
              if (images.length) handleLogoFiles(images);
            }}
          >
            {dragActive && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 rounded">
                <img src="/images/dropHere.png" alt="drop here" style={{width:140, height:140, objectFit:'contain', marginBottom:12}} />
                <div className="p-6 bg-white/10 rounded text-white text-lg pointer-events-none">Drop files here to upload</div>
              </div>
            )}
            {form.logos.length === 0 && (
              <div key="example" className="relative p-2 bg-white rounded shadow-sm border" style={{borderColor: '#e5e7eb'}}>
                <div className="text-xs text-gray-500 mb-2">Example</div>
                <img src={FALLBACK_LOGO} alt="example" style={{width:'100%', height:80, objectFit:'contain'}} />
                <div className="mt-2 text-xs text-gray-500">This preview is an example company until you upload your own logo.</div>
              </div>
            )}

            {form.logos.map(l => (
              <div key={l.id} className="relative p-2 bg-white rounded shadow-sm border" style={{borderColor: form.defaultLogoId===l.id ? form.primaryColor : '#e5e7eb'}}>
                <button
                  onClick={() => selectDefaultLogo(l.id)}
                  title={form.defaultLogoId===l.id ? 'Default logo' : 'Use as default'}
                  className="absolute right-2 top-2 rounded-full p-1 flex items-center justify-center"
                  style={form.defaultLogoId===l.id ? { background: form.primaryColor, color: relativeTextColor(form.primaryColor), width:28, height:28, border: 'none' } : { background: '#fff', color: '#333', width:28, height:28, border: '1px solid #ddd' }}
                >
                  {form.defaultLogoId===l.id ? '✓' : '+'}
                </button>
                <img src={l.url} alt={l.name} style={{width:'100%', height:80, objectFit:'contain'}} />
                <div className="mt-2 flex justify-between items-center">
                  <div className="text-xs truncate" title={l.name}>{l.name}</div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>removeLogo(l.id)} className="text-xs text-rose-500">Remove</button>
                  </div>
                </div>
              </div>
            ))}

            {/* Add tile */}
            <div onClick={()=>fileRef.current?.click()} className="flex items-center justify-center p-4 border-2 border-dashed rounded text-gray-400 hover:bg-gray-50 cursor-pointer">
              <div className="text-2xl font-bold">+</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function StepColours() {
    const primaryRef = React.useRef(null);
    const secondaryRefs = React.useRef([]);
    return (
      <div className="space-y-4">
        <div>
          <div className="text-sm font-medium">Primary colour</div>
          <div className="mt-2 flex items-center gap-3">
            <div
              onClick={() => primaryRef.current?.click()}
              title={form.primaryColor ? form.primaryColor : 'Choose primary colour'}
              className="w-12 h-12 border rounded bg-white cursor-pointer flex items-center justify-center"
              style={{ background: form.primaryColor || '#fff', borderColor: form.primaryColor ? form.primaryColor : '#e5e7eb' }}
            >
              {!form.primaryColor && <div className="w-8 h-8 bg-white border rounded" />}
            </div>
            <input ref={primaryRef} type="color" value={form.primaryColor || '#ffffff'} onChange={e=>setField('primaryColor', e.target.value)} className="hidden" />
            <div className="text-sm text-gray-600">The main colour of your brand (used for things like buttons and links)</div>
          </div>
        </div>

        <div>
          <div className="text-sm font-medium">Secondary colours</div>
          <div className="text-xs text-gray-500 mt-1">Other colours you might associate with your brand</div>
          <div className="mt-3 grid grid-cols-6 gap-3 items-start">
            {form.secondaryColors.map((c,i) => (
              <div key={i} className="relative">
                <div
                  onClick={() => secondaryRefs.current[i]?.click()}
                  title={c || 'Choose colour'}
                  className="w-12 h-12 border rounded cursor-pointer flex items-center justify-center"
                  style={{ background: c || '#fff', borderColor: (c && isLightHex(c)) ? '#ddd' : (c || '#e5e7eb') }}
                />
                <input ref={el => secondaryRefs.current[i] = el} type="color" value={c} onChange={e=>setSecondaryColor(i, e.target.value)} className="hidden" />
                <button onClick={()=>removeSecondaryColor(i)} className="absolute -right-2 -top-2 text-xs bg-white rounded-full border px-1">×</button>
              </div>
            ))}

            {/* dashed add tile */}
            <button onClick={addSecondaryColor} className="flex items-center justify-center w-12 h-12 border-2 border-dashed rounded text-gray-400 hover:bg-gray-50">
              <div className="text-xl font-bold">+</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  function StepTypography() {
    const fontOptions = [
      { label: 'System UI', family: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial' },
      { label: 'Inter', family: 'Inter, system-ui, Arial, sans-serif' },
      { label: 'Arial', family: 'Arial, Helvetica, sans-serif' },
      { label: 'Helvetica', family: 'Helvetica, Arial, sans-serif' },
      { label: 'Georgia', family: 'Georgia, serif' },
      { label: 'Times New Roman', family: '"Times New Roman", Times, serif' },
      { label: 'Verdana', family: 'Verdana, Geneva, sans-serif' },
      { label: 'Tahoma', family: 'Tahoma, Geneva, sans-serif' },
      { label: 'Courier New', family: '"Courier New", Courier, monospace' }
    ];

    const [localHeadingFont, setLocalHeadingFont] = useState(form.headingFont || fontOptions[0].family);
    const [localHeadingSize, setLocalHeadingSize] = useState(form.headingSize || 24);
    const [localHeadingBold, setLocalHeadingBold] = useState(form.headingBold || false);
    const [localHeadingItalic, setLocalHeadingItalic] = useState(form.headingItalic || false);

    const [localBodyFont, setLocalBodyFont] = useState(form.bodyFont || fontOptions[0].family);
    const [localBodySize, setLocalBodySize] = useState(form.bodySize || 16);
    const [localBodyBold, setLocalBodyBold] = useState(form.bodyBold || false);
    const [localBodyItalic, setLocalBodyItalic] = useState(form.bodyItalic || false);

    useEffect(() => { setLocalHeadingFont(form.headingFont || fontOptions[0].family); }, [form.headingFont]);
    useEffect(() => { setLocalHeadingSize(form.headingSize || 24); }, [form.headingSize]);
    useEffect(() => { setLocalHeadingBold(form.headingBold || false); }, [form.headingBold]);
    useEffect(() => { setLocalHeadingItalic(form.headingItalic || false); }, [form.headingItalic]);

    useEffect(() => { setLocalBodyFont(form.bodyFont || fontOptions[0].family); }, [form.bodyFont]);
    useEffect(() => { setLocalBodySize(form.bodySize || 16); }, [form.bodySize]);
    useEffect(() => { setLocalBodyBold(form.bodyBold || false); }, [form.bodyBold]);
    useEffect(() => { setLocalBodyItalic(form.bodyItalic || false); }, [form.bodyItalic]);

    function commitHeading() {
      setField('headingFont', localHeadingFont);
      setField('headingSize', localHeadingSize);
      setField('headingBold', localHeadingBold);
      setField('headingItalic', localHeadingItalic);
    }
    function commitBody() {
      setField('bodyFont', localBodyFont);
      setField('bodySize', localBodySize);
      setField('bodyBold', localBodyBold);
      setField('bodyItalic', localBodyItalic);
    }

    return (
      <div className="space-y-4">
        <div>
          <div className="text-sm font-medium">Heading</div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs">Font</label>
              <select value={localHeadingFont} onChange={e=>{ setLocalHeadingFont(e.target.value); setField('headingFont', e.target.value); }} onBlur={commitHeading} className="w-full border px-2 py-2 bg-white text-black">
                {fontOptions.map(f => (
                  <option key={f.label} value={f.family} style={{ fontFamily: f.family }}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs">Size (px)</label>
              <input type="number" min={10} max={72} value={localHeadingSize} onChange={e=>{ const v = parseInt(e.target.value||'24',10); setLocalHeadingSize(v); setField('headingSize', v); }} onBlur={commitHeading} className="w-full border px-2 py-2 bg-white text-black" />
            </div>
          </div>

          <div className="flex gap-4 mt-2">
            <label className="flex items-center gap-2"><input type="checkbox" checked={localHeadingBold} onChange={e=>{ setLocalHeadingBold(e.target.checked); setField('headingBold', e.target.checked); }} onBlur={commitHeading} /> Bold</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={localHeadingItalic} onChange={e=>{ setLocalHeadingItalic(e.target.checked); setField('headingItalic', e.target.checked); }} onBlur={commitHeading} /> Italic</label>
          </div>

          <div className="mt-3 p-3 border rounded bg-white text-black">
            {/* Heading preview removed — live preview on the right is the canonical source */}
          </div>
        </div>

        <div>
          <div className="text-sm font-medium">Body</div>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs">Font</label>
              <select value={localBodyFont} onChange={e=>{ setLocalBodyFont(e.target.value); setField('bodyFont', e.target.value); }} onBlur={commitBody} className="w-full border px-2 py-2 bg-white text-black">
                {fontOptions.map(f => (
                  <option key={f.label} value={f.family} style={{ fontFamily: f.family }}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs">Size (px)</label>
              <input type="number" min={10} max={48} value={localBodySize} onChange={e=>{ const v = parseInt(e.target.value||'16',10); setLocalBodySize(v); setField('bodySize', v); }} onBlur={commitBody} className="w-full border px-2 py-2 bg-white text-black" />
            </div>
          </div>

          <div className="flex gap-4 mt-2">
            <label className="flex items-center gap-2"><input type="checkbox" checked={localBodyBold} onChange={e=>{ setLocalBodyBold(e.target.checked); setField('bodyBold', e.target.checked); }} onBlur={commitBody} /> Bold</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={localBodyItalic} onChange={e=>{ setLocalBodyItalic(e.target.checked); setField('bodyItalic', e.target.checked); }} onBlur={commitBody} /> Italic</label>
          </div>

          <div className="mt-3 p-3 border rounded bg-white text-black">
            {/* Body preview removed — live preview on the right is the canonical source */}
          </div>
        </div>

        <div className="text-sm text-gray-600">Tip: For email compatibility prefer system fonts (Arial, Georgia, Helvetica). Use the preview to check readability at different sizes.</div>
      </div>
    );
  }

  function StepSocial() {
    const PROVIDERS = ['YouTube','TikTok','Instagram','Twitter','Facebook','LinkedIn','Pinterest'];
    // Local copy to avoid aggressive re-synces while typing (prevents 1-char-only bug)
    const [locals, setLocals] = useState(form.socialLinks || []);
    useEffect(() => { setLocals(form.socialLinks || []); }, [form.socialLinks]);

    function handleLocalChange(i, patch) {
      setLocals(prev => prev.map((s, idx) => idx===i ? { ...s, ...patch } : s));
    }

    function handleAddLocal() {
      // add to form and local copy
      const item = { provider: 'YouTube', url: '' };
      addSocialLink();
      setLocals(prev => [...prev, item]);
    }

    function handleRemoveLocal(i) {
      removeSocialLink(i);
      setLocals(prev => prev.filter((_, idx) => idx !== i));
    }

    function getProviderIcon(name) {
      switch((name||'').toLowerCase()) {
        case 'youtube': return (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M23.5 6.2a3 3 0 0 0-2.12-2.12C19.7 3.5 12 3.5 12 3.5s-7.7 0-9.38.58A3 3 0 0 0 .5 6.2 31.7 31.7 0 0 0 0 12a31.7 31.7 0 0 0 .5 5.8 3 3 0 0 0 2.12 2.12C4.3 20.5 12 20.5 12 20.5s7.7 0 9.38-.58A3 3 0 0 0 23.5 17.8 31.7 31.7 0 0 0 24 12a31.7 31.7 0 0 0-.5-5.8z" fill="#FF0000"/><path d="M10 15l5-3-5-3v6z" fill="#fff"/></svg>);
        case 'tiktok': return (<img src="/images/hero/tiktok.png"style={{width:20, height:20, objectFit:'contain'}} />);
  case 'instagram': return (<img src="/images/hero/instalogo.jpg" alt="Instagram" style={{width:20, height:20, objectFit:'contain'}} />);
        case 'twitter': return (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M23 4.5c-.7.3-1.5.6-2.3.7.8-.5 1.4-1.3 1.7-2.3-.8.5-1.7.8-2.6 1-1.5-1.6-4-1.6-5.5 0-1.1 1.1-1.5 2.7-1 4.1C8 8.8 4.6 6.9 2 4.1c-.9 1.6-.2 3.7 1.2 4.7-.6 0-1.2-.2-1.7-.5 0 2 1.4 3.8 3.5 4.2-.6.2-1.2.2-1.8.1.5 1.7 2 3 3.7 3-1.3 1-3 1.5-4.6 1.2 1.7 1.1 3.8 1.7 6 1.7 7.2 0 11.1-6 11.1-11.1v-.5c.8-.6 1.5-1.4 2-2.3-.7.3-1.5.5-2.3.6z" fill="#1DA1F2"/></svg>);
  case 'facebook': return (<img src="/images/hero/facebook.png" alt="Facebook" style={{width:20, height:20, objectFit:'contain'}} />);
  case 'linkedin': return (<img src="/images/hero/linkedin.png" alt="LinkedIn" style={{width:20, height:20, objectFit:'contain'}} />);
  case 'pinterest': return (<img src="/images/hero/pinterest.png" alt="Pinterest" style={{width:20, height:20, objectFit:'contain'}} />);
      
        default: return (<svg width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ccc"/></svg>);
      }
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between"><div className="text-sm font-medium">Social links</div>
          <button onClick={handleAddLocal} className="px-2 py-1 border rounded bg-white text-black text-sm">Add</button></div>
        <div className="text-xs text-gray-500 mt-1">Add your social media links. These will appear in the footer of your emails. Placement can be configured in the Footer step.</div>
        <div className="space-y-2">
          {locals.map((s,i) => (
            <div key={i} className="p-3 border rounded bg-white text-black">
              <div className="flex gap-2 items-center">
                <div className="w-8 h-8 flex items-center justify-center">{getProviderIcon(s.provider)}</div>
                <select value={s.provider} onChange={e=>{ handleLocalChange(i, { provider: e.target.value }); updateSocialLink(i, { provider: e.target.value }); }} className="border px-2 py-1 bg-white text-black">
                  {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input value={s.url} onChange={e=>handleLocalChange(i, { url: e.target.value })} onBlur={() => updateSocialLink(i, { url: locals[i]?.url || '' })} placeholder="https://" className="flex-1 border px-2 py-1 bg-white text-black" />
                <button onClick={()=>handleRemoveLocal(i)} className="text-xs text-rose-500">Remove</button>
              </div>
              <div className="text-xs text-gray-600 mt-1">Default to thumbnail + follow/subscribe CTA for deliverability.</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function StepFooter() {
    const [localUnsubscribeText, setLocalUnsubscribeText] = useState(form.unsubscribeText || 'If you no longer wish to receive these emails, unsubscribe.');

    useEffect(() => { setLocalUnsubscribeText(form.unsubscribeText || 'If you no longer wish to receive these emails, unsubscribe.'); }, [form.unsubscribeText]);

    const commitUnsubscribe = () => setField('unsubscribeText', localUnsubscribeText);

    return (
      <div className="space-y-4">
        <div>
          <div className="text-sm font-medium">Footer compliance text</div>
          <div className="text-xs text-gray-500 mt-1">This text appears in the footer of all emails. The word "unsubscribe" will automatically become a working link.</div>
          <textarea
            className="mt-2 w-full border px-3 py-2 bg-white text-black rounded"
            rows={3}
            value={localUnsubscribeText}
            onChange={(e) => setLocalUnsubscribeText(e.target.value)}
            onBlur={commitUnsubscribe}
            placeholder="If you no longer wish to receive these emails, unsubscribe."
          />
        </div>

        <div className="flex items-center gap-3 mt-4">
          <div className="text-sm font-medium">Social links placement in footer</div>
          <div className="flex items-center gap-2">
            <label className={`px-2 py-1 border rounded ${form.socialPlacement==='left' ? 'bg-gray-100' : ''}`}><input type="radio" name="socialPlacement" checked={form.socialPlacement==='left'} onChange={()=>setField('socialPlacement','left')} /> Left</label>
            <label className={`px-2 py-1 border rounded ${form.socialPlacement==='center' ? 'bg-gray-100' : ''}`}><input type="radio" name="socialPlacement" checked={form.socialPlacement==='center'} onChange={()=>setField('socialPlacement','center')} /> Center</label>
            <label className={`px-2 py-1 border rounded ${form.socialPlacement==='right' ? 'bg-gray-100' : ''}`}><input type="radio" name="socialPlacement" checked={form.socialPlacement==='right'} onChange={()=>setField('socialPlacement','right')} /> Right</label>
          </div>
        </div>

        <div className="text-sm text-gray-600 mt-4">
          Tip: Footer settings apply to all email templates. Social links and unsubscribe text help with email deliverability and legal compliance.
        </div>
      </div>
    );
  }

  function StepFinalize() {
    const [localFormatName, setLocalFormatName] = useState(form.formatName || '');

    // Keep local in sync if form is loaded/changed externally
    useEffect(() => { setLocalFormatName(form.formatName || ''); }, [form.formatName]);

    // Commit helper
    const commitFormatName = () => setField('formatName', localFormatName);

    return (
      <div className="space-y-3">
        <div className="text-sm text-gray-600">
          Review your header and footer template. You can see the live preview on the right.
        </div>
        
        <div className="p-3 border rounded bg-white">
          <label className="block">
            <div className="text-xs font-medium">Format name</div>
            <input 
              className="mt-1 w-full border px-2 py-1 bg-white text-black" 
              value={localFormatName} 
              onChange={e => setLocalFormatName(e.target.value)} 
              onBlur={commitFormatName}
              placeholder="e.g. Newsletter - Promo" 
            />
          </label>

          {savedFormats && savedFormats.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-medium mb-1">Saved formats</div>
              <div className="space-y-2">
                {savedFormats.map((s, idx) => (
                  <div key={s.key || idx} className="p-2 border rounded bg-gray-50 flex items-center justify-between">
                    <div className="text-sm truncate" title={s.manifest?.formatName || s.manifest?.brandName || 'Format'}>{s.manifest?.formatName || s.manifest?.brandName || 'Format'}</div>
                    <div className="flex items-center gap-2">
                      <button onClick={()=>loadSavedFormat(s)} className="text-sm px-2 py-1 border rounded bg-white">Load</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end mt-2">
            <button onClick={handleSave} className="px-3 py-2 bg-black text-white rounded">{saving ? 'Saving...' : 'Save & Finish'}</button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- helpers ---------------- */
  function relativeTextColor(hex) {
    try {
      if (!hex) return '#000';
      const c = hex.replace('#','');
      const r = parseInt(c.substring(0,2),16);
      const g = parseInt(c.substring(2,4),16);
      const b = parseInt(c.substring(4,6),16);
      const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;
      return luminance > 0.55 ? '#000' : '#fff';
    } catch (e) { return '#000'; }
  }

  function isLightHex(hex) {
    try {
      if (!hex) return true;
      const c = hex.replace('#','');
      const r = parseInt(c.substring(0,2),16);
      const g = parseInt(c.substring(2,4),16);
      const b = parseInt(c.substring(4,6),16);
      const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;
      return luminance > 0.85; // very light
    } catch (e) { return true; }
  }

  /* ---------------- main render ---------------- */
  return (
    <div className="min-h-screen bg-white text-black p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div />
          <div className="relative">
            <button
              onClick={() => setShowInfo(s => !s)}
              onMouseEnter={() => setShowInfo(true)}
              onMouseLeave={() => setShowInfo(false)}
              aria-label="Info"
              className="w-8 h-8 rounded-full flex items-center justify-center border bg-white text-black"
              title="Create a general email format"
            >
              i
            </button>
            {showInfo && (
              <div style={{position:'fixed', top:88, right:32, width:320, zIndex:9999}} className="p-3 bg-white text-black border rounded shadow-lg text-sm" onMouseEnter={()=>setShowInfo(true)} onMouseLeave={()=>setShowInfo(false)}>
                <div className="font-semibold mb-1">Create a general email format</div>
                <div>You can create a general email format here. You can create more later for more precise categories of your emailing list.</div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white p-6 border rounded max-h-[75vh] overflow-auto">

              <section
                ref={stepRefs.current[0]}
                className={`mb-8 ${step===0 ? 'rounded border-2' : 'border-b'}`}
                style={step===0 ? { borderColor: form.primaryColor || '#e5e7eb' } : undefined}
              >
                <h3 className="text-md font-semibold mb-3">Brand</h3>
                <StepBrand />
                <div className="mt-3 flex justify-between">
 
                  <div className="flex gap-2">
                    
                  </div>
                </div>
              </section>

              <section
                ref={stepRefs.current[1]}
                className={`mb-8 ${step===1 ? 'rounded border-2' : 'border-b'}`}
                style={step===1 ? { borderColor: form.primaryColor || '#e5e7eb' } : undefined}
              >
                <h3 className="text-md font-semibold mb-3">Logos</h3>
                <StepLogos />
                <div className="mt-3 flex justify-between">
 
                </div>
              </section>

              <section
                ref={stepRefs.current[2]}
                className={`mb-8 ${step===2 ? 'rounded border-2' : 'border-b'}`}
                style={step===2 ? { borderColor: form.primaryColor || '#e5e7eb' } : undefined}
              >
                <h3 className="text-md font-semibold mb-3">Colours</h3>
                <StepColours />
                <div className="mt-3 flex justify-between">
 
                </div>
              </section>

              <section
                ref={stepRefs.current[3]}
                className={`mb-8 ${step===3 ? 'rounded border-2' : 'border-b'}`}
                style={step===3 ? { borderColor: form.primaryColor || '#e5e7eb' } : undefined}
              >
                <h3 className="text-md font-semibold mb-3">Typography</h3>
                <StepTypography />
                <div className="mt-3 flex justify-between">
        
                </div>
              </section>

              <section
                ref={stepRefs.current[4]}
                className={`mb-8 ${step===4 ? 'rounded border-2' : 'border-b'}`}
                style={step===4 ? { borderColor: form.primaryColor || '#e5e7eb' } : undefined}
              >
                <h3 className="text-md font-semibold mb-3">Social</h3>
                <StepSocial />
                <div className="mt-3 flex justify-between">
 
                </div>
              </section>

              <section
                ref={stepRefs.current[5]}
                className={`mb-8 ${step===5 ? 'rounded border-2' : 'border-b'}`}
                style={step===5 ? { borderColor: form.primaryColor || '#e5e7eb' } : undefined}
              >
                <h3 className="text-md font-semibold mb-3">Footer</h3>
                <StepFooter />
                <div className="mt-3 flex justify-between">
 
                </div>
              </section>

              <section
                ref={stepRefs.current[6]}
                className={`mb-8 ${step===6 ? 'rounded border-2' : 'border-b'}`}
                style={step===6 ? { borderColor: form.primaryColor || '#e5e7eb' } : undefined}
              >
                <h3 className="text-md font-semibold mb-3">Finalize</h3>
                <StepFinalize />
              </section>

            </div>
          </div>

          <aside className="lg:col-span-1">
            <div className="sticky top-6 space-y-4">
              <div className="p-4 border rounded bg-white">
                <div className="text-sm font-semibold mb-2">Live Preview</div>
                <div style={{maxWidth:320}}>
                  {/* HEADER SECTION */}
                  <div className="mb-2 text-xs font-semibold text-gray-500">HEADER</div>
                  <div className="p-4 border rounded bg-white text-black mb-4">
                    <div className={`${form.logoPlacement === 'above' ? 'flex flex-col items-center text-center' : 'flex items-center gap-3'}`}>
                      {(() => { const defaultLogo = form.logos.find(x => x.id === form.defaultLogoId) || form.logos[0]; const src = defaultLogo?.url || FALLBACK_LOGO; const px = getLogoPx(); return src ? <img src={src} alt="logo" style={{height:px,objectFit:'contain'}}/> : <div className="bg-gray-200" style={{width:px, height:px}}/> })()}
                      <div>
                        {form.brandDisplay === 'name' ? (
                          <div style={{fontFamily: form.headingFont, fontSize: form.headingSize, fontWeight: form.headingBold ? 700 : 400, fontStyle: form.headingItalic ? 'italic' : 'normal'}}>{form.brandName || 'Your brand'}</div>
                        ) : null}
                        <div className="text-sm text-gray-600" style={{fontFamily: form.bodyFont, fontSize: form.bodySize, fontWeight: form.bodyBold ? 700 : 400, fontStyle: form.bodyItalic ? 'italic' : 'normal'}}>{form.tagline}</div>
                      </div>
                    </div>
                  </div>

                  {/* EMAIL BODY PLACEHOLDER */}
                  <div className="p-4 bg-gray-50 text-center text-xs text-gray-400 italic">
                    Email content goes here...
                  </div>

                  {/* FOOTER SECTION */}
                  <div className="mt-4 mb-2 text-xs font-semibold text-gray-500">FOOTER</div>
                  <div className="p-4 border rounded bg-white text-black">
                    {form.socialLinks && form.socialLinks.length > 0 && (
                      <div className={`flex gap-3 items-center pb-3 border-b ${form.socialPlacement === 'left' ? 'justify-start' : form.socialPlacement === 'right' ? 'justify-end' : 'justify-center'}`}>
                        {form.socialLinks.map((s,i) => (
                          s.url ? (
                            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="inline-block" title={s.provider}>{getSocialIcon(s.provider, 18)}</a>
                          ) : (
                            <div key={i} className="inline-block opacity-60" title={s.provider}>{getSocialIcon(s.provider, 18)}</div>
                          )
                        ))}
                      </div>
                    )}
                    <div className="mt-3 text-xs text-gray-600 text-center">
                      {form.unsubscribeText.split('unsubscribe').map((part, i, arr) => (
                        i < arr.length - 1 ? (
                          <React.Fragment key={i}>
                            {part}
                            <a href="#" onClick={handleUnsubscribe} style={{color:'#1a73e8', textDecoration:'underline'}}>unsubscribe</a>
                          </React.Fragment>
                        ) : part
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-gray-400 text-center">{form.brandName || 'Your Company'} • Marketing emails</div>
                  </div>
                  <div className="mt-2 text-xs text-gray-400 italic">Preview is approximate — final rendering depends on email client.</div>
                </div>
              </div>

              {/* Inspector removed - controls moved into the Preview section on the left */}

            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}

