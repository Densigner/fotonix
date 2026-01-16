// BAD: setBlocks(blocks.map(...))  // uses closed-over snapshot
// GOOD: setBlocks(prev => prev.map(b => b.id === id ? { ...b, meta:{ ...b.meta, content: newValue } } : b));
import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from './firebase/init';
import { ColorChooser, getContrastingText } from './ColorChooser';
import SubscribeButtonBuilder from './SubscribeButtonBuilder';
import MailBuilderOnboarding from './MailOnboard';
import MailComposerDesign from './MailComposerDesign';

// SideLitSignLanding.jsx — Email Builder with per-tenant defaults
//
// Changes:
// - Adds tenant management (switch tenant, tenant defaults)
// - Templates belong to tenants and can be shared with specific users
// - Composer picks up tenant default styles when opened
// - Simple mock users and persistence to localStorage for demo purposes
//
// FIXES in this revision:
// - Inspector fields are now controlled and update the live preview immediately
// - Added "Save Template" button in the Composer to persist the current design
//   into localStorage for the current tenant (demo). The landing page will
//   reflect saved templates after a refresh.

export default function EmailBuilderPage(props = {}) {
  // Allow the composer page wrapper to pass in tenants/templates/currentUser/initialTemplate/intent/onClose
  // Props: tenants, templates, currentUser, initialTemplate, intent, onClose, setTemplates
  // Mock data: in production these come from your backend (fall back to localStorage)
  const [tenants, setTenants] = useState(() => {
    if (props.tenants && props.tenants.length) {
      // Ensure all tenants have members array
      return props.tenants.map(t => ({
        ...t,
        members: t.members || []
      }));
    }
    const s = localStorage.getItem('email.tenants');
    if (s) {
      try { 
        const parsedTenants = JSON.parse(s);
        // Ensure all tenants have members array
        return parsedTenants.map(t => ({
          ...t,
          members: t.members || []
        }));
      } catch (e) {}
    }
    // default tenant
    const defaultTenants = [
      { id: 't1', name: 'Fotonix', defaults: { brandColor: '#000000', font: "'Helvetica Neue', Arial, sans-serif", contentWidth: 600 }, members: [{ email: 'alice@fotonix.test' }, { email: 'bob@fotonix.test' }] }
    ];
    localStorage.setItem('email.tenants', JSON.stringify(defaultTenants));
    return defaultTenants;
  });

  // Mock templates stored per tenant; allow parent to supply templates
  const [templates, setTemplatesLocal] = useState(() => {
    if (props.templates && props.templates.length) return props.templates;
    const s = localStorage.getItem('email.templates');
    if (s) try { return JSON.parse(s); } catch (e) {}
    const t = [
      { id: 'tpl_hero', title: 'Clear Hero', src: '/uploads/annouceTemplate.png', tenantId: 't1', owner: 'alice@fotonix.test', sharedWith: { users: [] }, createdAt: new Date().toISOString() },
      { id: 'tpl_promo', title: 'Promo Strip', src: '/images/customDesign.png', tenantId: 't1', owner: 'bob@fotonix.test', sharedWith: { users: [] }, createdAt: new Date().toISOString() }
    ];
    localStorage.setItem('email.templates', JSON.stringify(t));
    return t;
  });

  // Expose a setTemplates that updates parent if provided
  const setTemplates = (updater) => {
    if (typeof props.setTemplates === 'function') {
      // mirror into parent
      props.setTemplates((prev) => {
        const next = typeof updater === 'function' ? updater(prev || []) : updater;
        return Array.isArray(next) ? next : (prev || []);
      });
    }
    // also update local copy
    setTemplatesLocal((prev) => {
      const next = typeof updater === 'function' ? updater(prev || []) : updater;
      return Array.isArray(next) ? next : (prev || []);
    });
  };

  // Current user (mock) - in real app this is from auth; prefer prop
  const [currentUser, setCurrentUser] = useState(() => {
    if (props.currentUser) return props.currentUser;
    const s = localStorage.getItem('email.currentUser');
    if (s) try { return JSON.parse(s); } catch (e) {}
    const u = { email: 'bob@fotonix.test', tenantId: 't1' };
    localStorage.setItem('email.currentUser', JSON.stringify(u));
    return u;
  });

  const [currentTenantId, setCurrentTenantId] = useState(() => (props.currentUser && props.currentUser.tenantId) || (props.initialTemplate && props.initialTemplate.tenantId) || (currentUser && currentUser.tenantId) || (tenants[0] && tenants[0].id));

  // UI debug: expose a small status string for firebase presence
  const [fbStatus, setFbStatus] = useState(() => ({ db: !!db, authUser: auth && auth.currentUser ? (auth.currentUser.uid || auth.currentUser.email) : null, message: null }));
  const [showOnboard, setShowOnboard] = useState(false);


  useEffect(() => { localStorage.setItem('email.tenants', JSON.stringify(tenants)); }, [tenants]);
  useEffect(() => { localStorage.setItem('email.templates', JSON.stringify(templates)); }, [templates]);
  useEffect(() => { localStorage.setItem('email.currentUser', JSON.stringify(currentUser)); }, [currentUser]);

  // Load templates from Firebase (onboarding saves templates under mailbuilder/themes/{uid})
  useEffect(() => {
    let cancelled = false;
    let unsubAuth = null;

    console.debug('MailBuilder: firebase templates effect starting', { authPresent: !!auth, dbPresent: !!db, authCurrentUser: auth && auth.currentUser });

    async function doFetch(uid) {
      try {
        if (!db || !uid) {
          const msg = `doFetch aborted - missing db or uid (db=${!!db}, uid=${uid})`;
          console.debug('MailBuilder: ' + msg, { db: !!db, uid });
          try { setFbStatus(s => ({ ...s, db: !!db, authUser: uid, message: msg })); } catch(e) {}
          return;
        }
        // Use realtime listener so new onboarding saves appear immediately
        const { ref, onValue } = await import('firebase/database');
        const baseRef = ref(db, `mailbuilder/themes/${uid}`);
        try {
          // Log the exact path and current auth state before attaching listener
          try { console.log('MailBuilder: attaching listener to', baseRef && baseRef.toString ? baseRef.toString() : `mailbuilder/themes/${uid}`, ' auth.currentUser=', auth && auth.currentUser ? auth.currentUser : null); } catch(e) {}
        } catch(e) {}
        const listener = onValue(baseRef, (snap) => {
          console.debug('MailBuilder: realtime snapshot for', uid, { exists: snap && typeof snap.exists === 'function' ? snap.exists() : !!(snap && snap.exists), snapVal: snap && snap.val ? snap.val() : null });
          try { console.log('MailBuilder: realtime snapVal:', JSON.stringify(snap && snap.val ? snap.val() : null, null, 2)); } catch(e) {}
          try { setFbStatus(s => ({ ...s, db: true, authUser: uid, message: 'realtime snapshot' })); } catch(e) {}
          if (!snap || !snap.exists || cancelled) {
            // Fallback to localStorage-stored manifests (demo mode where DB isn't used)
            try {
              const keyPrefix = `mailbuilder:theme:${uid}`;
              const found = [];
              if (typeof window !== 'undefined' && window.localStorage) {
                for (let i = 0; i < localStorage.length; i++) {
                  const k = localStorage.key(i);
                  if (k && k.startsWith(keyPrefix)) {
                    try {
                      const manifest = JSON.parse(localStorage.getItem(k));
                      found.push({ key: k, manifest });
                    } catch (e) {}
                  }
                }
              }
              if (found.length) {
                const out = found.map(f => ({ id: f.key, title: f.manifest.formatName || f.manifest.brandName || f.manifest.name || f.key, src: (f.manifest.logos && Array.isArray(f.manifest.logos) && f.manifest.logos[0] && (f.manifest.logos[0].downloadURL || f.manifest.logos[0].url)) || '/uploads/annouceTemplate.png', tenantId: uid, owner: uid, sharedWith: { users: [] }, createdAt: f.manifest.createdAt || Date.now(), manifest: f.manifest }));
                // Replace templates with localStorage fallback results
                setTemplates(out);
                try { setFbStatus(s => ({ ...s, db: false, message: 'used localStorage fallback' })); } catch(e) {}
                return;
              }
            } catch (e) {}
            return;
          }
          const out = [];
          snap.forEach(child => {
            const m = child.val();
            console.debug('MailBuilder: child key', child.key, 'val', m);
            // Prefer assigning fetched templates to the current tenant so they are visible
            // in the tenant's Templates list. Fall back to the user key if tenant isn't set.
            const assignedTenant = typeof currentTenantId !== 'undefined' && currentTenantId ? currentTenantId : uid;
            const ownerEmail = (currentUser && currentUser.email) || (auth && auth.currentUser && (auth.currentUser.email || auth.currentUser.uid)) || uid;
            out.push({
              id: child.key,
              title: m.formatName || m.brandName || m.name || `Template ${child.key}`,
              src: (m.logos && Array.isArray(m.logos) && m.logos[0] && (m.logos[0].downloadURL || m.logos[0].url)) || m.thumbnail || (m.manifest && m.manifest.image) || '/uploads/annouceTemplate.png',
              tenantId: assignedTenant,
              owner: ownerEmail,
              sharedWith: { users: [] },
              createdAt: m.createdAt || Date.now(),
              manifest: m,
            });
          });
          if (out.length) {
            // Replace templates with fetched results (remove demo/filler templates)
            setTemplates(out);
          }
        });
        // remember listener for cleanup
        // store it on the outer scope via unsubAuth variable reuse pattern
        unsubAuth = () => { try { listener(); } catch (e) {} };

        // Fallback: if we didn't find templates for the current uid, try fetching all themes
        try {
          // fallback: listen for all themes realtime as well
          const { ref: refAll, onValue: onValueAll } = await import('firebase/database');
          const allRef = refAll(db, `mailbuilder/themes`);
          try { console.log('MailBuilder: attaching all-themes listener to', allRef && allRef.toString ? allRef.toString() : 'mailbuilder/themes', ' auth.currentUser=', auth && auth.currentUser ? auth.currentUser : null); } catch(e) {}
          const allListener = onValueAll(allRef, (allSnap) => {
            console.debug('MailBuilder: realtime all themes snapshot', { exists: allSnap && typeof allSnap.exists === 'function' ? allSnap.exists() : !!(allSnap && allSnap.exists), snapVal: allSnap && allSnap.val ? allSnap.val() : null });
            try { console.log('MailBuilder: allThemes snapVal:', JSON.stringify(allSnap && allSnap.val ? allSnap.val() : null, null, 2)); } catch(e) {}
            const allOut = [];
            if (allSnap && allSnap.exists && allSnap.exists()) {
              allSnap.forEach(userNode => {
                userNode.forEach(child => {
                  const m = child.val();
                  console.debug('MailBuilder: allThemes child', { user: userNode.key, key: child.key, val: m });
                  allOut.push({ id: child.key, title: m.formatName || m.brandName || m.name || `Template ${child.key}`, src: (m.logos && Array.isArray(m.logos) && m.logos[0] && (m.logos[0].downloadURL || m.logos[0].url)) || m.thumbnail || (m.manifest && m.manifest.image) || '/uploads/annouceTemplate.png', tenantId: userNode.key, owner: userNode.key, sharedWith: { users: [] }, createdAt: m.createdAt || Date.now(), manifest: m });
                });
              });
            }
            if (allOut.length) {
              // Assign these results to the current tenant when possible so they are visible
              const normalized = allOut.map(t => ({ ...t, tenantId: currentTenantId || t.tenantId, owner: (currentUser && currentUser.email) || t.owner || t.tenantId }));
              // Replace templates with all-themes results
              setTemplates(normalized);
              try { setFbStatus(s => ({ ...s, db: true, message: 'fetched all themes' })); } catch(e) {}
            }
            else {
              // try localStorage scan for any mailbuilder:theme:* entries
              try {
                const found = [];
                if (typeof window !== 'undefined' && window.localStorage) {
                  for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('mailbuilder:theme:')) {
                      try {
                        const manifest = JSON.parse(localStorage.getItem(k));
                        const userKey = k.split(':')[2] || 'local';
                        found.push({ key: k, manifest, userKey });
                      } catch (e) {}
                    }
                  }
                }
                if (found.length) {
                  const out2 = found.map(f => ({ id: f.key, title: f.manifest.formatName || f.manifest.brandName || f.manifest.name || f.key, src: (f.manifest.logos && Array.isArray(f.manifest.logos) && f.manifest.logos[0] && (f.manifest.logos[0].downloadURL || f.manifest.logos[0].url)) || '/uploads/annouceTemplate.png', tenantId: currentTenantId || f.userKey, owner: (currentUser && currentUser.email) || f.userKey, sharedWith: { users: [] }, createdAt: f.manifest.createdAt || Date.now(), manifest: f.manifest }));
                  // Replace templates with localStorage all-themes fallback results
                  setTemplates(out2);
                  try { setFbStatus(s => ({ ...s, db: false, message: 'used localStorage all-themes fallback' })); } catch(e) {}
                }
              } catch (e) {}
            }
          });
          // chain cleanup to existing unsubAuth if present
          const prevUnsub = unsubAuth;
          unsubAuth = () => { try { allListener(); } catch(e) {} ; if (typeof prevUnsub === 'function') try { prevUnsub(); } catch(e) {} };
        } catch (e) {
          // ignore
        }
      } catch (e) {
        // ignore firebase errors — fall back to local templates
        console.warn('Failed to load firebase templates for composer', e);
        try { setFbStatus(s => ({ ...s, db: !!db, message: 'fetch error: ' + (e && e.message) })); } catch(e) {}
      }
    }

    (async () => {
      const current = auth && auth.currentUser;
      const uid = current && (current.uid || current.userId || current.id);
      if (uid) {
        await doFetch(uid);
      } else if (auth) {
        // wait for auth state to become available
        try {
          const { onAuthStateChanged } = await import('firebase/auth');
          unsubAuth = onAuthStateChanged(auth, async (user) => {
            if (user && user.uid) {
              console.debug('MailBuilder: onAuthStateChanged fired, uid=', user.uid);
              try { setFbStatus(s => ({ ...s, authUser: user.uid, message: 'auth state changed' })); } catch(e) {}
              await doFetch(user.uid);
            }
          });
        } catch (e) {
          console.debug('MailBuilder: failed to subscribe to onAuthStateChanged', e);
        }
      } else {
        console.debug('MailBuilder: no auth object available to wait for user');
      }
    })();

    return () => { cancelled = true; if (typeof unsubAuth === 'function') try { unsubAuth(); } catch (e) {} };
  }, [currentTenantId, currentUser]);

  // Start on the landing view (Tenant Defaults + Members) by default
  // Previously this honored props.intent to auto-open the composer; that caused
  // the page to land inside the composer and required users to press Back.
  // Force the initial view to 'landing' so the Tenant Defaults / Members pane is shown.
  // EXCEPTION: If initialTemplate is provided (e.g., from automation), open composer directly
  const [view, setView] = useState(() => {
    if (props.initialTemplate && props.intent === 'automation-email') {
      return 'composer';
    }
    return 'landing';
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState(props.initialTemplate ? (props.initialTemplate.id || null) : null);
  // composerState holds the snapshot passed from ComposerPage when Save & next is clicked
  const [composerState, setComposerState] = useState(null);
  
  // Add automation template to templates list if provided
  useEffect(() => {
    if (props.initialTemplate && props.intent === 'automation-email') {
      // Check if template already exists
      const exists = templates.find(t => t.id === props.initialTemplate.id);
      if (!exists) {
        setTemplates(prev => [props.initialTemplate, ...prev]);
      }
    }
  }, [props.initialTemplate, props.intent]);

  // helper: find tenant
  function getTenant(id) { 
    const tenant = tenants.find(t => t.id === id);
    if (!tenant) return null;
    // Ensure tenant has members array
    return {
      ...tenant,
      members: tenant.members || []
    };
  }

  // No permission checks: all template actions are allowed in this simplified model
  function canEditTemplate(/*tpl*/) { return true; }
  function canViewTemplate(/*tpl*/) { return true; }

  // Template share UI helpers (no-op in simplified model)
  function updateTemplateShare(/*templateId, { users = null }*/) {
    // sharing is not enforced in this simplified build
    return;
  }

  function createTemplateFromTenantDefaults(title) {
    const tenant = getTenant(currentTenantId);
    if (!tenant) return;
    // create a minimal template that points to a sample image
  const tpl = { id: `tpl_${Math.random().toString(36).slice(2,9)}`, title: title || 'New Template', src: '/uploads/annouceTemplate.png', tenantId: tenant.id, owner: currentUser.email, sharedWith: { users: [] }, createdAt: new Date().toISOString() };
    setTemplates(t => [tpl, ...t]);
    return tpl;
  }

  // Manage tenants: update defaults
  function updateTenantDefaults(tenantId, defaults) {
    setTenants(ts => ts.map(t => t.id === tenantId ? { ...t, defaults: { ...t.defaults, ...defaults } } : t));
    // If current tenant changed defaults and user is on composer, we might apply them later
  }

  // UI lists
  const tenantTemplates = templates.filter(t => t.tenantId === currentTenantId || (t.sharedWith && t.sharedWith.users && t.sharedWith.users.includes(currentUser.email)));

  return (
    <div className="min-h-screen bg-white text-black p-6">
      <header className="max-w-6xl mx-auto mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full w-10 h-10 bg-black/10 flex items-center justify-center font-bold">F</div>
          <div>
            <div className="text-xs text-slate-600">Tenant</div>
            <div className="font-semibold text-lg">Fotonix — Email Builder</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Header actions intentionally simplified (buttons and debug status removed) */}
        </div>
      </header>

      <main className="max-w-6xl mx-auto">
        {view === 'landing' && (
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2">
              <div className="rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div className="font-semibold">Templates for {getTenant(currentTenantId)?.name}</div>
                  <div>
                    <button onClick={()=>{ setView('composer'); }} className="bg-white border px-3 py-2 rounded">Open Composer</button>
                  </div>
                </div>

                <div className="mb-2 text-xs text-slate-500">Templates loaded: {templates.length} (visible to tenant: {tenantTemplates.length})</div>
                <div className="space-y-3">
                  {tenantTemplates.map(t => (
                      <div key={t.id} className="p-3 border rounded flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={t.src} alt={(t.manifest && (t.manifest.formatName || t.manifest.brandName)) || t.title} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 6 }} />
                          <div>
                            <div className="font-medium">{(t.manifest && (t.manifest.formatName || t.manifest.brandName)) || t.title}</div>
                            <div className="text-sm text-slate-600">{t.manifest && t.manifest.tagline ? t.manifest.tagline : ''}</div>
                            <div className="text-xs text-slate-500 mt-1">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''} • Owner: {t.owner}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setSelectedTemplateId(t.id); setView('composer'); }} className="px-2 py-1 border rounded text-sm">Use / Edit</button>
                          <button onClick={() => { setTemplates(ts => ts.filter(x=>x.id!==t.id)); }} className="px-2 py-1 border rounded text-sm text-rose-600">Delete</button>
                        </div>
                      </div>
                  ))}
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-xl border border-slate-200 p-4 shadow-sm">
                <h3 className="text-sm font-semibold">Tenant Defaults</h3>
                <TenantDefaultsEditor tenant={getTenant(currentTenantId)} onSave={(d)=>updateTenantDefaults(currentTenantId, d)} currentUser={currentUser} />
              </div>

              <div className="rounded-xl border border-slate-200 p-4 shadow-sm">
                <h3 className="text-sm font-semibold">Members</h3>
                <TenantMembers 
                  tenant={getTenant(currentTenantId)} 
                  onInvite={(email) => { 
                    setTenants(ts => ts.map(t => 
                      t.id === currentTenantId 
                        ? { ...t, members: [...(t.members || []), { email }] } 
                        : t
                    )); 
                  }} 
                  currentUser={currentUser} 
                />
              </div>
            </aside>

          </section>
        )}

        {view === 'composer' && (
          <ComposerPage
            onBack={() => setView('landing')}
            templates={templates}
            setTemplates={setTemplates}
            selectedTemplateId={selectedTemplateId}
            currentTenant={getTenant(currentTenantId)}
            currentUser={currentUser}
            onNext={(state) => {
              // capture composer snapshot and navigate to Design step
              try { setComposerState(state || {}); } catch (e) { console.debug('Failed to set composerState', e); }
              setView('design');
            }}
          />
        )}

        {view === 'design' && (
          <MailComposerDesign
            onBack={() => setView('composer')}
            onNext={() => { /* future navigation to Content step */ }}
            composerState={composerState}
            title={composerState && composerState.subject ? composerState.subject : undefined}
            onChooseTemplate={(tpl) => {
              try {
                // tpl may be an object; prefer tpl.id
                const id = tpl && (tpl.id || tpl.key || tpl.templateId) || null;
                if (id) setSelectedTemplateId(id);
                // navigate to composer so the template can be used/edited
                setView('composer');
              } catch (e) { console.debug('onChooseTemplate failed', e); }
            }}
          />
        )}

      </main>

  {/* Onboarding modal/fullflow */}
  <MailBuilderOnboarding open={showOnboard} onFinish={() => { setShowOnboard(false); try { setFbStatus(s => ({ ...s, message: 'onboarding finished' })); } catch(e) {} }} />

      <footer className="max-w-6xl mx-auto mt-8 text-xs text-slate-500 text-center">© {new Date().getFullYear()} Fotonix • Email Builder</footer>
    </div>
  );
}

/* ---------------------------- Template Share Control ---------------------------- */
function TemplateShareControl({ template, onUpdate, tenants, currentUser }) {
  // local form state
  const [usersText, setUsersText] = useState((template.sharedWith && template.sharedWith.users ? template.sharedWith.users : []).join(', '));

  function apply() {
    const users = usersText.split(',').map(u=>u.trim()).filter(Boolean);
    onUpdate({ users });
    alert('Sharing updated');
  }

  return (
    <div className="mt-2">
  <div className="text-xs text-slate-600 mt-2">Users (emails, comma separated):</div>
  <input value={usersText} onChange={(e)=>setUsersText(e.target.value)} className="w-full border p-1 rounded text-sm mt-1 bg-white text-black" />
      <div className="mt-2 flex gap-2">
        <button onClick={apply} className="px-2 py-1 border rounded text-sm">Apply</button>
        <button onClick={() => { setUsersText((template.sharedWith && template.sharedWith.users ? template.sharedWith.users : []).join(', ')); }} className="px-2 py-1 border rounded text-sm">Reset</button>
      </div>
    </div>
  );
}

/* ---------------------------- Tenant Defaults Editor ---------------------------- */
function TenantDefaultsEditor({ tenant, onSave, currentUser }) {
  const [brandColor, setBrandColor] = useState(tenant?.defaults?.brandColor || '#000000');
  const [font, setFont] = useState(tenant?.defaults?.font || "'Helvetica Neue', Arial, sans-serif");
  const [contentWidth, setContentWidth] = useState(tenant?.defaults?.contentWidth || 600);
  const [companyAddress, setCompanyAddress] = useState(tenant?.defaults?.companyAddress || '123 Business St, City, Country');
  const [companyName, setCompanyName] = useState(tenant?.defaults?.companyName || tenant?.name || 'Your Company');

  useEffect(() => { 
    setBrandColor(tenant?.defaults?.brandColor || '#000000'); 
    setFont(tenant?.defaults?.font || "'Helvetica Neue', Arial, sans-serif"); 
    setContentWidth(tenant?.defaults?.contentWidth || 600);
    setCompanyAddress(tenant?.defaults?.companyAddress || '123 Business St, City, Country');
    setCompanyName(tenant?.defaults?.companyName || tenant?.name || 'Your Company');
  }, [tenant]);

  // Only members of the tenant may change defaults in this simplified model
  const canSave = currentUser.tenantId === tenant?.id;

  return (
    <div>
      <div className="text-xs text-slate-600">Brand color</div>
      <input type="color" value={brandColor} onChange={(e)=>setBrandColor(e.target.value)} className="w-24 h-8 p-0 border rounded mt-1" />

      <div className="text-xs text-slate-600 mt-2">Font stack</div>
      <input value={font} onChange={(e)=>setFont(e.target.value)} className="w-full border p-1 rounded text-sm mt-1 bg-white text-black" />

      <div className="text-xs text-slate-600 mt-2">Content width</div>
      <input type="number" value={contentWidth} onChange={(e)=>setContentWidth(parseInt(e.target.value||'600',10))} className="w-32 border p-1 rounded text-sm mt-1" />

      <div className="text-xs text-slate-600 mt-2">Company Name (for legal footer)</div>
      <input value={companyName} onChange={(e)=>setCompanyName(e.target.value)} className="w-full border p-1 rounded text-sm mt-1 bg-white text-black" />

      <div className="text-xs text-slate-600 mt-2">Company Address (for legal footer)</div>
      <textarea value={companyAddress} onChange={(e)=>setCompanyAddress(e.target.value)} className="w-full border p-1 rounded text-sm mt-1 bg-white text-black" rows={3} />

      <div className="mt-3">
  <button onClick={() => { if (!canSave) return alert('Only members of this tenant can update defaults'); onSave({ brandColor, font, contentWidth, companyAddress, companyName }); alert('Tenant defaults saved'); }} className={`px-3 py-2 rounded ${canSave ? 'bg-black text-white' : 'bg-gray-100 text-slate-500'}`}>Save Defaults</button>
      </div>
    </div>
  );
}

/* ---------------------------- Merge Tags Helper ---------------------------- */
function MergeTagHelper({ onInsert }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const mergeTags = [
    { tag: '{{first_name}}', label: 'First Name', example: 'Sarah' },
    { tag: '{{last_name}}', label: 'Last Name', example: 'Johnson' },
    { tag: '{{full_name}}', label: 'Full Name', example: 'Sarah Johnson' },
    { tag: '{{email}}', label: 'Email Address', example: 'sarah@example.com' },
    { tag: '{{company}}', label: 'Company', example: 'Fotonix Ltd' },
    { tag: '{{city}}', label: 'City', example: 'London' },
    { tag: '{{country}}', label: 'Country', example: 'United Kingdom' },
    { tag: '{{date}}', label: 'Current Date', example: 'November 6, 2025' },
    { tag: '{{sender_name}}', label: 'Sender Name', example: 'Fotonix Team' },
    { tag: '{{unsubscribe_url}}', label: 'Unsubscribe Link', example: 'https://...' }
  ];

  const handleInsert = (tag) => {
    onInsert(tag);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-1 rounded border border-indigo-200"
      >
        + Merge Tags
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-6 z-20 w-72 bg-white border border-slate-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
            <div className="p-3 border-b border-slate-200">
              <div className="text-sm font-semibold text-slate-900">Insert Merge Tag</div>
              <div className="text-xs text-slate-500 mt-1">Click to insert personalization</div>
            </div>
            <div className="p-2">
              {mergeTags.map((item) => (
                <button
                  key={item.tag}
                  onClick={() => handleInsert(item.tag)}
                  className="w-full text-left p-2 hover:bg-slate-50 rounded text-xs border-b border-slate-100 last:border-b-0"
                >
                  <div className="font-medium text-slate-900">{item.label}</div>
                  <div className="text-indigo-600 font-mono text-xs mt-0.5">{item.tag}</div>
                  <div className="text-slate-500 text-xs mt-0.5">Example: {item.example}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Function to render merge tag preview with sample data
function renderMergeTagPreview(text) {
  if (!text) return 'No content';
  
  const sampleData = {
    '{{first_name}}': 'Sarah',
    '{{last_name}}': 'Johnson', 
    '{{full_name}}': 'Sarah Johnson',
    '{{email}}': 'sarah@example.com',
    '{{company}}': 'Fotonix Ltd',
    '{{city}}': 'London',
    '{{country}}': 'United Kingdom',
    '{{date}}': new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    '{{sender_name}}': 'Fotonix Team',
    '{{unsubscribe_url}}': '[Unsubscribe Link]'
  };

  let preview = text;
  Object.entries(sampleData).forEach(([tag, value]) => {
    preview = preview.replace(new RegExp(tag.replace(/[{}]/g, '\\$&'), 'g'), value);
  });

  return preview || 'No content';
}

// Function to process merge tags with actual subscriber data (for email sending)
function processMergeTags(text, subscriberData = {}) {
  if (!text) return text;
  
  const defaultValues = {
    first_name: subscriberData.first_name || subscriberData.firstName || 'Friend',
    last_name: subscriberData.last_name || subscriberData.lastName || '',
    full_name: `${subscriberData.first_name || subscriberData.firstName || 'Friend'} ${subscriberData.last_name || subscriberData.lastName || ''}`.trim(),
    email: subscriberData.email || '',
    company: subscriberData.company || '',
    city: subscriberData.city || '',
    country: subscriberData.country || '',
    date: new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }),
    sender_name: subscriberData.sender_name || 'Fotonix Team',
    unsubscribe_url: subscriberData.unsubscribe_url || '#unsubscribe'
  };

  let processed = text;
  Object.entries(defaultValues).forEach(([key, value]) => {
    const tag = `{{${key}}}`;
    processed = processed.replace(new RegExp(tag.replace(/[{}]/g, '\\$&'), 'g'), value);
  });

  return processed;
}

/* ---------------------------- Tenant Members ---------------------------- */
function TenantMembers({ tenant, onInvite, currentUser }) {
  const [email, setEmail] = useState('');

  // Add safety checks for tenant and tenant.members
  if (!tenant) {
    return (
      <div>
        <div className="text-sm font-medium text-slate-500">Members</div>
        <div className="mt-2 text-xs text-slate-400">No tenant selected</div>
      </div>
    );
  }

  const members = tenant.members || [];
  const canInvite = currentUser?.tenantId === tenant?.id;

  return (
    <div>
      <div className="text-sm font-medium">Members</div>
      <div className="mt-2 space-y-2 text-sm">
        {members.length > 0 ? (
          members.map(m => (
            <div key={m.email} className="flex items-center justify-between">
              <div>{m.email}</div>
            </div>
          ))
        ) : (
          <div className="text-xs text-slate-400">No members yet</div>
        )}
      </div>

      <div className="mt-3 text-xs text-slate-600">Invite</div>
      <div className="flex gap-2 mt-1">
        <input 
          value={email} 
          onChange={(e)=>setEmail(e.target.value)} 
          className="border p-1 rounded text-sm bg-white text-black" 
          placeholder="email" 
        />
        <button 
          onClick={() => { 
            if (!canInvite) return alert('Only tenant members can invite'); 
            if (!email) return alert('Enter email'); 
            onInvite(email); 
            setEmail(''); 
            alert('Invited'); 
          }} 
          className={`px-2 py-1 rounded ${canInvite ? 'bg-black text-white' : 'bg-gray-100 text-slate-500'}`}
        >
          Invite
        </button>
      </div>
    </div>
  );
}

/* ---------------------------- Composer Page ---------------------------- */
function uid(prefix = 'id') { return `${prefix}_${Math.random().toString(36).slice(2,9)}`; }
const BLOCK_TYPES = ['text','image','button','divider','columns','spacer','video','youtube-subscribe'];
function defaultBlock(type) {
  switch (type) {
    case 'text': return { id: uid('b'), type: 'text', meta: { content: 'Editable headingWrite your message here', align: 'left', fontSize: 18 } };
  case 'image': return { id: uid('b'), type: 'image', meta: { src: '/uploads/annouceTemplate.png', alt: 'image', width: '100%', align: 'center' } };
  case 'button': return { id: uid('b'), type: 'button', meta: { label: 'Call to Action', url: '#', style: 'solid', placement: 'center' } };
  case 'youtube-subscribe': return { id: uid('b'), type: 'youtube-subscribe', meta: { label: '▶ Subscribe on YouTube', channel: '', channelHandleOrId: '', url: '', utm_source: 'newsletter', utm_medium: 'email', utm_campaign: '', background: '#FF0000', color: '#FFFFFF', placement: 'center' } };
    case 'divider': return { id: uid('b'), type: 'divider', meta: { height: 1, color: '#e6e6e6' } };
    case 'columns': return { id: uid('b'), type: 'columns', meta: { columns: 2, widths: [50,50], blocks: [[],[]] } };
  case 'spacer': return { id: uid('b'), type: 'spacer', meta: { height: 20 } };
  case 'video': return { id: uid('b'), type: 'video', meta: { src: '', provider: '', title: '', thumbnail: '' } };
    default: return { id: uid('b'), type: 'text', meta: { content: 'Empty' } };
  }
}

function ComposerPage({ onBack, onNext, templates = [], setTemplates = null, selectedTemplateId = null, currentTenant, currentUser }) {
  // Start with an empty canvas — user will add blocks explicitly
  const [blocks, setBlocks] = useState(() => {
    // If we have a selectedTemplateId, try to load that template's blocks
    if (selectedTemplateId && templates.length > 0) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template && template.blocks && Array.isArray(template.blocks)) {
        console.log('Loading template blocks:', template.title, template.blocks.length);
        return template.blocks;
      }
    }
    return [];
  });
  
  // Load template blocks when selectedTemplateId changes
  useEffect(() => {
    if (selectedTemplateId && templates.length > 0) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template && template.blocks && Array.isArray(template.blocks)) {
        console.log('Loading template blocks from useEffect:', template.title, template.blocks.length);
        setBlocks(template.blocks);
        
        // Also load subject and preheader if available
        if (template.metadata) {
          if (template.metadata.subject) setSubject(template.metadata.subject);
          if (template.metadata.preheader) setPreviewText(template.metadata.preheader);
        }
      }
    }
  }, [selectedTemplateId, templates]);
  // Modal state for builders (e.g. SubscribeButtonBuilder)
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  // Debug helper: use dbgSetBlocks in place of setBlocks to trace updates and content
  function dbgSetBlocks(next) {
    if (typeof next === 'function') {
      setBlocks(prev => {
        const result = next(prev);
        console.groupCollapsed('dbgSetBlocks (functional)');
        console.trace();
        console.log('prev contents:', prev.map(b => b.meta?.content?.slice?.(0,60) || b.type));
        console.log('next contents:', result.map(b => b.meta?.content?.slice?.(0,60) || b.type));
        console.groupEnd();
        return result;
      });
    } else {
      console.groupCollapsed('dbgSetBlocks (direct)');
      console.trace('setBlocks from ActualEditor.js:dbgSetBlocks(direct)');
      console.log('direct next contents:', (next||[]).map(b => b.meta?.content?.slice?.(0,60) || b.type));
      console.groupEnd();
      // Use functional update to avoid closed-over `blocks` race conditions
      setBlocks(() => {
        return Array.isArray(next) ? next.map(b => ({ ...b })) : (next || []);
      });
    }
  }
  const [selection, setSelection] = useState(null);
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [sendTargetInfo, setSendTargetInfo] = useState('Matches 1 subscribed contact');
  const [selectedSendTarget, setSelectedSendTarget] = useState('all');

  // Load saved composer data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('fotonix.composer.state');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.subject) setSubject(parsed.subject);
        if (parsed.previewText) setPreviewText(parsed.previewText);
        if (parsed.sendTargetInfo) setSendTargetInfo(parsed.sendTargetInfo);
        if (parsed.selectedSendTarget) setSelectedSendTarget(parsed.selectedSendTarget);
        console.log('Loaded composer data from localStorage:', parsed);
      } catch (e) {
        console.warn('Failed to parse saved composer data:', e);
      }
    }
  }, []);

  // Save to localStorage whenever key fields change
  useEffect(() => {
    const dataToSave = {
      subject,
      previewText,
      sendTargetInfo,
      selectedSendTarget,
      timestamp: Date.now()
    };
    localStorage.setItem('fotonix.composer.state', JSON.stringify(dataToSave));
  }, [subject, previewText, sendTargetInfo, selectedSendTarget]);

  const fileRef = useRef();

  // Advanced settings state: default to true so user has to unselect
    // advanced toggles (persisted)
    const [openTracking, setOpenTracking] = useState(true)
    const [clickTracking, setClickTracking] = useState(true)
  const [gaTracking, setGaTracking] = useState(true)
    const [personalisedTo, setPersonalisedTo] = useState(true)

    // persist advanced settings to localStorage so they survive reloads
    const advSettingsKey = useRef(null)
    useEffect(() => {
      const ownerKey = (currentTenant && currentTenant.id) || (currentUser && currentUser.uid) || 'anon'
      advSettingsKey.current = `mailbuilder.advanced:${ownerKey}`

      try {
        const raw = localStorage.getItem(advSettingsKey.current)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (typeof parsed.openTracking === 'boolean') setOpenTracking(parsed.openTracking)
          if (typeof parsed.clickTracking === 'boolean') setClickTracking(parsed.clickTracking)
          if (typeof parsed.gaTracking === 'boolean') setGaTracking(parsed.gaTracking)
          if (typeof parsed.personalisedTo === 'boolean') setPersonalisedTo(parsed.personalisedTo)
        }
      } catch (err) {
        console.debug('Could not read advanced settings from localStorage', err)
      }
    }, [currentTenant, currentUser])

    // Simple segments model: load per-tenant/user from localStorage and allow quick create
    const segmentsKey = useRef(null)
    const [segments, setSegments] = useState([])
    const [selectedSegmentId, setSelectedSegmentId] = useState(null)

    // Simple tags model: per-tenant/user localStorage
    const tagsKey = useRef(null)
    const [tags, setTags] = useState([])
    const [selectedTagId, setSelectedTagId] = useState(null)

    useEffect(() => {
      const ownerKey = (currentTenant && currentTenant.id) || (currentUser && currentUser.uid) || 'anon'
      segmentsKey.current = `mailbuilder.segments:${ownerKey}`
      try {
        const raw = localStorage.getItem(segmentsKey.current)
        if (raw) setSegments(JSON.parse(raw) || [])
      } catch (e) { console.debug('Failed to read segments', e) }
    }, [currentTenant, currentUser])

    useEffect(() => {
      if (!segmentsKey.current) return
      try { localStorage.setItem(segmentsKey.current, JSON.stringify(segments || [])) } catch (e) { console.debug('Failed to save segments', e) }
    }, [segments])

    useEffect(() => {
      const ownerKey = (currentTenant && currentTenant.id) || (currentUser && currentUser.uid) || 'anon'
      tagsKey.current = `mailbuilder.tags:${ownerKey}`
      try {
        const raw = localStorage.getItem(tagsKey.current)
        if (raw) setTags(JSON.parse(raw) || [])
      } catch (e) { console.debug('Failed to read tags', e) }
    }, [currentTenant, currentUser])

    useEffect(() => {
      if (!tagsKey.current) return
      try { localStorage.setItem(tagsKey.current, JSON.stringify(tags || [])) } catch (e) { console.debug('Failed to save tags', e) }
    }, [tags])

    function createDemoTag() {
      const name = window.prompt('Tag name (e.g. VIP)')
      if (!name) return
      const t = { id: uid('tag'), name, count: Math.floor(Math.random()*20)+1, createdAt: Date.now() }
      setTags(prev => [t, ...(prev||[])])
      setSelectedTagId(t.id)
      setSendTargetInfo(`Matches ${t.count} contacts (demo)`)
      setSelectedSendTarget('tag')
    }

    function createDemoSegment() {
      const name = window.prompt('Segment name (e.g. Paying customers)')
      if (!name) return
      const seg = { id: uid('seg'), name, description: 'Demo segment created locally', count: Math.floor(Math.random()*50)+1, createdAt: Date.now() }
      setSegments(s => [seg, ...(s||[])])
      setSelectedSegmentId(seg.id)
      setSendTargetInfo(`Matches ${seg.count} contacts (demo)`)
      setSelectedSendTarget('segment')
    }

    // Save whenever any advanced toggle changes
    useEffect(() => {
      if (!advSettingsKey.current) return
      const toSave = {
        openTracking, clickTracking, gaTracking, personalisedTo
      }
      try {
        localStorage.setItem(advSettingsKey.current, JSON.stringify(toSave))
      } catch (err) {
        console.debug('Could not save advanced settings to localStorage', err)
      }
    }, [openTracking, clickTracking, gaTracking, personalisedTo])

  // Apply tenant defaults when composer mounts or tenant changes
  useEffect(() => {
    if (currentTenant && currentTenant.defaults) {
      // In a fuller implementation we'd apply tenant defaults to the editor's style settings.
    }
  }, [currentTenant]);

  // Removed auto-insert of template image — user may Insert template blocks manually

  function addBlock(type) {
    if (type === 'video') {
      const url = window.prompt('Paste social video URL (YouTube, TikTok, Vimeo, Instagram Reels):');
      if (!url) return;
      const provider = detectVideoProvider(url);
      if (!provider) return alert('URL not recognised — supported: YouTube, TikTok, Vimeo, Instagram Reels.');
      const newBlock = { id: uid('b'), type: 'video', meta: { src: url, provider, title: '', thumbnail: getVideoThumbnail(url) || '' } };
      setBlocks(b => [...b, newBlock]);
      return;
    }
    setBlocks(b => [...b, defaultBlock(type)]);
  }
  function removeBlock(id) { setBlocks(b => b.filter(x => x.id !== id)); if (selection === id) setSelection(null); }
  function moveBlock(id, dir) { setBlocks(b => { const i = b.findIndex(x=>x.id===id); if (i<0) return b; const ni = i + dir; if (ni<0||ni>=b.length) return b; const nb=[...b]; const [item]=nb.splice(i,1); nb.splice(ni,0,item); return nb; }); }
  function updateBlock(id, patch) { setBlocks(b => b.map(x => x.id===id ? { ...x, meta: { ...x.meta, ...patch } } : x)); }

  function exportJSON() { const payload = { subject, blocks }; const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); downloadBlob(blob, `email-template-${Date.now()}.json`); }

  function exportHTML() {
    // Use tenant defaults where appropriate for inline styles
    const brandColor = currentTenant?.defaults?.brandColor || '#000';
    const font = currentTenant?.defaults?.font || "'Helvetica Neue', Arial, sans-serif";
    const contentWidth = currentTenant?.defaults?.contentWidth || 600;

    const html = blocks.map(b => {
      switch(b.type) {
        case 'text': return `<div style="text-align:${b.meta.align};font-size:${b.meta.fontSize}px;color:#000;white-space:pre-wrap">${escapeHtml(b.meta.content)}</div>`;
        case 'image': return `<div><img src="${b.meta.src}" alt="${escapeHtml(b.meta.alt || '')}" style="max-width:100%;height:auto"/></div>`;
        case 'button': return `<div style="text-align:center"><a href="${b.meta.url}" style="display:inline-block;padding:8px 12px;background:${brandColor};color:#fff;border-radius:6px;text-decoration:none">${escapeHtml(b.meta.label)}</a></div>`;
        case 'divider': return `<div style="height:${b.meta.height}px;background:${b.meta.color};width:100%"></div>`;
        case 'spacer': return `<div style="height:${b.meta.height}px"></div>`;
        case 'columns': return `<div style="display:flex;gap:12px">${b.meta.blocks.map((col,ci)=>`<div style=\"flex:${b.meta.widths?b.meta.widths[ci]:1}\">${col.map(cb=>renderBlockHtml(cb)).join('')}</div>`).join('')}</div>`;
        default: return '';
      }
    }).join('');

    // Automatically append legal compliance footer
    const companyName = currentTenant?.defaults?.companyName || currentTenant?.name || 'Our Company';
    const companyAddress = currentTenant?.defaults?.companyAddress || '123 Business St, City, Country';
    
    const legalFooter = `
      <div style="margin-top:40px;padding-top:20px;border-top:1px solid #e6e6e6;text-align:center;font-size:12px;color:#666;line-height:1.4;">
        <p style="margin:0 0 10px 0;">You received this email because you subscribed to our list.</p>
        <p style="margin:0 0 15px 0;">
          You can <a href="{{UnsubscribeURL}}" style="color:#007cba;text-decoration:underline;" target="_blank" rel="noopener">unsubscribe</a> at any time.
        </p>
        <p style="margin:0;font-size:11px;color:#999;">
          ${escapeHtml(companyName)}<br>
          ${escapeHtml(companyAddress)}<br>
          This email was sent by ${escapeHtml(companyName)} to {{RecipientEmail}}
        </p>
      </div>
    `;
    
    const htmlWithFooter = html + legalFooter;

    const wrapper = `<!doctype html><html><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/><title>${escapeHtml(subject)}</title></head><body style=\"font-family:${font};background:#f5f5f5;margin:0;padding:0\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" role=\"presentation\"><tr><td align=\"center\"><table width=\"${contentWidth}\" cellpadding=\"0\" cellspacing=\"0\" role=\"presentation\" style=\"background:#fff;border-collapse:collapse\"><tr><td style=\"padding:20px\">${htmlWithFooter}</td></tr></table></td></tr></table></body></html>`;
    const blob = new Blob([wrapper], { type: 'text/html' }); downloadBlob(blob, `email-${Date.now()}.html`);
  }

  // Save current composition as a tenant template (demo: updates localStorage & optionally parent state)
  function saveTemplate() {
    if (!currentTenant) return alert('No tenant selected');
    const tpl = {
      id: `tpl_${Math.random().toString(36).slice(2,9)}`,
      title: subject ? subject.slice(0,40) : `Saved Template ${new Date().toLocaleString()}`,
  src: (blocks.find(b=>b.type==='image') || { meta: {} }).meta.src || '/uploads/annouceTemplate.png',
      tenantId: currentTenant.id,
  owner: currentUser.email,
  sharedWith: { users: [] },
      createdAt: new Date().toISOString()
    };

    // update localStorage-backed templates
    try {
      const all = JSON.parse(localStorage.getItem('email.templates') || '[]');
      all.unshift(tpl);
      localStorage.setItem('email.templates', JSON.stringify(all));
      // if parent passed setTemplates we can also update app state so the landing list updates immediately
      if (typeof setTemplates === 'function') {
        setTemplates(prev => [tpl, ...prev]);
      }
      alert('Template saved to tenant library');
    } catch (e) {
      alert('Failed to save template');
    }
  }

  return (
    <div className="min-h-screen bg-white text-black p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <button onClick={onBack} className="text-sm text-slate-700 hover:text-slate-900">← Back to Dashboard</button>
            <h1 className="text-2xl font-semibold mt-2">📧 New Email Campaign</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Export and Save buttons removed per UX request */}
          </div>
        </div>

        {/* Campaign Progress Steps */}
        <div className="mb-6 flex items-center justify-center">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-6 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold text-sm">1</div>
              <span className="font-medium text-slate-900">Setup</span>
            </div>
            <div className="w-12 h-px bg-slate-300 mx-1"></div>
            <div className="flex items-center gap-2 opacity-40">
              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-semibold text-sm">2</div>
              <span className="text-slate-600">Design</span>
            </div>
            <div className="w-12 h-px bg-slate-300 mx-1"></div>
            <div className="flex items-center gap-2 opacity-40">
              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-semibold text-sm">3</div>
              <span className="text-slate-600">Content</span>
            </div>
            <div className="w-12 h-px bg-slate-300 mx-1"></div>
            <div className="flex items-center gap-2 opacity-40">
              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-semibold text-sm">4</div>
              <span className="text-slate-600">Send</span>
            </div>
          </div>
        </div>

          {/* add-block toolbar intentionally removed (buttons were causing UI clutter) */}
          {/* Compact block chips moved to header for quick access */}
          <div className="mt-2 flex gap-2 items-center overflow-x-auto">
            {blocks.map(b => (
              <div key={`chip_${b.id}`} className="flex items-center gap-3 px-3 py-2 bg-white border rounded text-sm whitespace-nowrap">
                <div className="min-w-24">
                  <div className="font-medium">{b.type}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{b.type === 'text' ? (b.meta?.content ? (b.meta.content.length > 40 ? b.meta.content.slice(0,40) + '…' : b.meta.content) : '') : (b.type === 'image' ? (b.meta?.src ? b.meta.src.split('/').pop() : '') : '')}</div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <button onClick={() => moveBlock(b.id, -1)} className="text-xs px-1">↑</button>
                  <button onClick={() => moveBlock(b.id, 1)} className="text-xs px-1">↓</button>
                  <button onClick={() => setSelection(b.id)} className="text-xs px-1">Edit</button>
                  <button onClick={() => removeBlock(b.id)} className="text-xs px-1 text-rose-500">Delete</button>
                </div>
              </div>
            ))}
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 min-w-0">
            <div className="border border-slate-200 rounded p-3 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
                <div>
                  <h2 className="text-lg font-semibold">Campaign Setup</h2>
                  <p className="text-sm text-slate-600">Configure your email campaign details</p>
                </div>
                <button onClick={(e) => {
                    e.preventDefault();
                    const composerData = {
                      subject,
                      previewText,
                      blocks,
                      selectedTemplateId,
                      advanced: { openTracking, clickTracking, gaTracking, personalisedTo },
                      sendTarget: { selectedSendTarget, selectedSegmentId, selectedTagId },
                    };
                    console.log('=== COMPOSER SAVE & CONTINUE ===');
                    console.log('Subject:', subject);
                    console.log('PreviewText:', previewText);
                    console.log('Full composer data:', composerData);
                    
                    if (typeof onNext === 'function') return onNext(composerData);
                    // fallback: if onNext isn't provided, call onBack when available
                    if (typeof onBack === 'function') onBack();
                  }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md font-semibold transition-colors">Save &amp; Continue</button>
              </div>
              {/* Subject, preview text and selected template preview */}
              <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-600">Subject</div>
                    <MergeTagHelper onInsert={(tag) => setSubject(prev => prev + tag)} />
                  </div>
                  <input 
                    value={subject} 
                    onChange={(e)=>setSubject(e.target.value)} 
                    className="w-full border border-slate-200 rounded px-3 py-2 mt-1 bg-white text-black" 
                    placeholder="e.g. Hi {{first_name}}, your order is ready!" 
                  />
                  <div className="text-xs text-slate-400 mt-1">
                    Preview: {renderMergeTagPreview(subject)}
                  </div>
                  
                  <div className="flex items-center justify-between mt-3">
                    <div className="text-xs text-slate-600">Preview text</div>
                    <MergeTagHelper onInsert={(tag) => setPreviewText(prev => prev + tag)} />
                  </div>
                  <input 
                    value={previewText} 
                    onChange={(e)=>setPreviewText(e.target.value)} 
                    className="w-full border border-slate-200 rounded px-3 py-2 mt-1 bg-white text-slate-700" 
                    placeholder="e.g. {{first_name}}, don't miss this special offer..." 
                  />
                  <div className="text-xs text-slate-400 mt-1">
                    Preview: {renderMergeTagPreview(previewText)}
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  {(() => {
                    const sel = templates.find(t => t.id === selectedTemplateId);
                    return sel ? (
                      <div className="text-center">
                        <div className="text-xs text-slate-500 mb-2">Selected template preview</div>
                        <img src={sel.src} alt={sel.title} style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 6 }} />
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">No template selected</div>
                    );
                  })()}
                </div>
              </div>

              {/* Sending control moved to bottom of left column (below blocks & add toolbar) */}

              {/* Preview-only rendering of blocks (controls moved to header) */}
              <div className="space-y-3">
                {blocks.map(b => (
                  <div key={`preview_${b.id}`} className="p-3 bg-white border border-slate-100 rounded">
                    {b.type === 'text' ? (
                      <div className="text-sm text-slate-400">Text block — edit content in the Inspector</div>
                    ) : (
                      renderBlockPreviewEmail(b)
                    )}
                  </div>
                ))}
                
                {/* Legal compliance footer preview */}
                <div className="p-3 bg-gray-50 border border-gray-200 rounded">
                  <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                    <span>⚖️</span>
                    <span>Legal Footer (Auto-added)</span>
                  </div>
                  <div className="text-center text-xs text-gray-600 leading-relaxed">
                    <p className="mb-2">You received this email because you subscribed to our list.</p>
                    <p className="mb-3">
                      You can <span className="text-blue-600 underline">unsubscribe</span> at any time.
                    </p>
                    <p className="text-gray-500 text-xs">
                      {currentTenant?.defaults?.companyName || currentTenant?.name || 'Our Company'}<br/>
                      {currentTenant?.defaults?.companyAddress || '123 Business St, City, Country'}<br/>
                      This email was sent by {currentTenant?.defaults?.companyName || currentTenant?.name || 'Our Company'} to [recipient@email.com]
                    </p>
                  </div>
                </div>
              </div>

              {/* add-block toolbar moved to the composer header */}

              {/* Sending control moved here: bottom of left column */}
              <div className="mt-4">
                <div className="text-xs text-slate-600 mb-2">Sending to</div>
                <div className="inline-flex rounded-md bg-slate-100 p-1">
                  <button onClick={() => { setSendTargetInfo('Matches 1 subscribed contact but we will update later'); setSelectedSendTarget('all'); }} className={`px-4 py-2 rounded-md text-sm font-medium ${selectedSendTarget === 'all' ? 'bg-white shadow-sm' : 'bg-transparent text-slate-700'}`}>All subscribers</button>
                  <button onClick={() => { setSendTargetInfo('Segment (preview)'); setSelectedSendTarget('segment'); }} className={`px-4 py-2 rounded-md text-sm font-medium ${selectedSendTarget === 'segment' ? 'bg-white shadow-sm' : 'bg-transparent text-slate-700'}`}>Segment</button>
                  <button onClick={() => { setSendTargetInfo('Tag (preview)'); setSelectedSendTarget('tag'); }} className={`px-4 py-2 rounded-md text-sm font-medium ${selectedSendTarget === 'tag' ? 'bg-white shadow-sm' : 'bg-transparent text-slate-700'}`}>Tag</button>
                  <button onClick={() => { setSendTargetInfo('Advanced (preview)'); setSelectedSendTarget('advanced'); }} className={`px-4 py-2 rounded-md text-sm font-medium ${selectedSendTarget === 'advanced' ? 'bg-white shadow-sm' : 'bg-transparent text-slate-700'}`}>Advanced</button>
                </div>
                <div className="mt-2 text-xs text-slate-500">{sendTargetInfo}</div>
              </div>
                {selectedSendTarget === 'segment' && (
                  <div className="mt-3 p-3 bg-white border border-slate-100 rounded">
                    <div className="text-sm font-medium mb-2">Choose a segment</div>
                    {segments && segments.length ? (
                      <div className="flex items-center gap-2">
                        <select value={selectedSegmentId || ''} onChange={(e) => { setSelectedSegmentId(e.target.value); const s = segments.find(x=>x.id === e.target.value); if (s) setSendTargetInfo(`Matches ${s.count} contacts (demo)`); }} className="border p-2 rounded bg-white text-sm">
                          <option value="">-- select segment --</option>
                          {segments.map(s => <option key={s.id} value={s.id}>{s.name} — {s.count} contacts</option>)}
                        </select>
                        <button onClick={() => createDemoSegment()} className="px-3 py-1 border rounded text-sm">Create segment</button>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">You don't have any segments yet. <button onClick={() => createDemoSegment()} className="underline ml-2">Create a segment</button></div>
                    )}
                  </div>
                )}
                {selectedSendTarget === 'tag' && (
                  <div className="mt-3 p-3 bg-white border border-slate-100 rounded">
                    <div className="text-sm font-medium mb-2">Choose a tag</div>
                    {tags && tags.length ? (
                      <div className="flex items-center gap-2">
                        <select value={selectedTagId || ''} onChange={(e) => { setSelectedTagId(e.target.value); const t = tags.find(x=>x.id === e.target.value); if (t) setSendTargetInfo(`Matches ${t.count} contacts (demo)`); }} className="border p-2 rounded bg-white text-sm">
                          <option value="">-- select tag --</option>
                          {tags.map(t => <option key={t.id} value={t.id}>{t.name} — {t.count} contacts</option>)}
                        </select>
                        <button onClick={() => createDemoTag()} className="px-3 py-1 border rounded text-sm">Create tag</button>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">You don't have any tags yet. <button onClick={() => createDemoTag()} className="underline ml-2">Create a tag</button></div>
                    )}
                  </div>
                )}
            </div>
          </div>

          <aside className="space-y-4 min-w-0 max-w-full overflow-hidden">
            {/* Block Inspector Panel */}
            {selection && (
              <div className="border border-slate-200 rounded p-3">
                <div className="text-sm font-semibold mb-2">Block Inspector</div>
                <div className="text-xs text-slate-600 mb-3">Edit the selected block</div>
                <div className="max-w-full overflow-hidden">
                  <InspectorEmail 
                    block={findBlockById(blocks, selection)} 
                    onUpdate={(changes) => {
                      setBlocks(prev => prev.map(b => 
                        b.id === selection 
                          ? { ...b, meta: { ...b.meta, ...changes } } 
                          : b
                      ));
                    }} 
                  />
                </div>
                <button 
                  onClick={() => setSelection(null)}
                  className="mt-3 text-xs text-slate-500 hover:text-slate-700 underline"
                >
                  Close Inspector
                </button>
              </div>
            )}

            <div className="border border-slate-200 rounded p-3">
              <div className="text-sm font-semibold">Advanced Settings</div>
              <div className="text-xs text-slate-600 mt-2">Configure campaign-level options</div>
              <div className="mt-3 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">Open tracking</div>
                    <div className="text-xs text-slate-500">Discover who opened your campaign, and when they opened it</div>
                  </div>
                  <div className="flex-shrink-0">
                    <button onClick={() => setOpenTracking(v => !v)} className={`w-11 h-6 rounded-full flex items-center justify-center ${openTracking ? 'bg-indigo-600' : 'bg-gray-200'}`} aria-pressed={openTracking}>
                      {openTracking ? <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M16 6L8.5 13.5L5 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> : null}
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">Click tracking</div>
                    <div className="text-xs text-slate-500">Discover who clicked the links in your campaign, which links were clicked, and when they were clicked</div>
                  </div>
                  <div className="flex-shrink-0">
                    <button onClick={() => setClickTracking(v => !v)} className={`w-11 h-6 rounded-full flex items-center justify-center ${clickTracking ? 'bg-indigo-600' : 'bg-gray-200'}`} aria-pressed={clickTracking}>
                      {clickTracking ? <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M16 6L8.5 13.5L5 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> : null}
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">Google Analytics link tracking</div>
                    <div className="text-xs text-slate-500">Add UTM parameters to your campaign's links so they can be tracked in Google Analytics</div>
                  </div>
                  <div className="flex-shrink-0">
                    <button onClick={() => setGaTracking(v => !v)} className={`w-11 h-6 rounded-full flex items-center justify-center ${gaTracking ? 'bg-indigo-600' : 'bg-gray-200'}`} aria-pressed={gaTracking}>
                      {gaTracking ? <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M16 6L8.5 13.5L5 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> : null}
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">Personalised "to" field</div>
                    <div className="text-xs text-slate-500">Show the subscriber's name in their email client, rather than just their email address</div>
                  </div>
                  <div className="flex-shrink-0">
                    <button onClick={() => setPersonalisedTo(v => !v)} className={`w-11 h-6 rounded-full flex items-center justify-center ${personalisedTo ? 'bg-indigo-600' : 'bg-gray-200'}`} aria-pressed={personalisedTo}>
                      {personalisedTo ? <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M16 6L8.5 13.5L5 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> : null}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
        
        {/* Subscribe builder modal */}
        {showSubscribeModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
            <div style={{ width: 'min(720px, 96%)', background: '#fff', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottom: '1px solid #eee' }}>
                <div style={{ fontWeight: 600 }}>YouTube Subscribe</div>
                <button onClick={() => setShowSubscribeModal(false)} style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ padding: 12 }}>
                <SubscribeButtonBuilder onInsert={(html, opts) => {
                  // Insert a youtube-subscribe block with metadata derived from opts
                  const meta = {
                    label: opts?.ctaText || '▶ Subscribe on YouTube',
                    channel: opts?.channelLink || '',
                    url: opts?.channelLink || '',
                    utm_source: opts?.utmSource || 'newsletter',
                    utm_medium: opts?.utmMedium || 'email',
                    utm_campaign: opts?.utmCampaign || '',
                    background: opts?.buttonBg || '#FF0000',
                    color: opts?.buttonText || '#FFFFFF',
                    placement: opts?.align || 'center',
                    thumbnail: ''
                  };
                  setBlocks(b => [...b, { id: uid('b'), type: 'youtube-subscribe', meta }]);
                  setShowSubscribeModal(false);
                }} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------- Inspector & helpers -------------------------- */
function updateBlock(blocks, setBlocks, id, patch) {
  setBlocks(b => b.map(x => x.id === id ? { ...x, meta: { ...x.meta, ...patch } } : x));
}
// updateBlockById.js — drop-in helper (functional, immutable, supports nested columns)
function updateBlockById(setBlocks, id, patch) {
  // Use functional update to avoid races with other setters
  setBlocks(prev => {
    let changed = false;
    // recursive walker for arrays of blocks (for columns)
    function walkArray(arr) {
      return arr.map(b => {
        if (b.id === id) {
          changed = true;
          return { ...b, meta: { ...b.meta, ...patch } };
        }
        if (b.type === 'columns' && Array.isArray(b.meta?.blocks)) {
          // deep-clone only the columns that change
          const newCols = b.meta.blocks.map(col => {
            const newCol = walkArray(col);
            if (newCol !== col) changed = true;
            return newCol;
          });
          if (newCols.some((nc, i) => nc !== b.meta.blocks[i])) {
            return { ...b, meta: { ...b.meta, blocks: newCols } };
          }
          return b;
        }
        return b;
      });
    }

    const next = walkArray(prev);
    return changed ? next : prev;
  });
}

// Temporary debug wrapper — create dbgSetBlocks to trace updates
function makeDbgSetBlocks(realSetBlocks) {
  return function(next) {
    if (typeof next === 'function') {
      realSetBlocks(prev => {
        const result = next(prev);
        console.groupCollapsed('dbgSetBlocks (functional)');
        console.trace('dbgSetBlocks trace');
        console.log('prev snapshot:', prev.map(b => ({ id: b.id, text: (b.meta && b.meta.content && b.meta.content.slice(0,50)) || b.type })));
        console.log('next snapshot:', result.map(b => ({ id: b.id, text: (b.meta && b.meta.content && b.meta.content.slice(0,50)) || b.type })));
        console.groupEnd();
        return result;
      });
    } else {
      console.groupCollapsed('dbgSetBlocks (direct)');
      console.trace('dbgSetBlocks trace');
      console.log('direct next snapshot:', (next || []).map(b => ({ id: b.id, text: (b.meta && b.meta.content && b.meta.content.slice(0,50)) || b.type })));
      console.groupEnd();
      realSetBlocks(next);
    }
  };
}
function findBlockById(blocks, id) {
  return blocks.find(b => b.id === id) || null;
}

function InspectorEmail({ block, onUpdate }) {
  if (!block) return null;

  let inspectorContent = null;

  switch (block.type) {
    case 'text':
      inspectorContent = (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs block mb-1">Content</label>
            <MergeTagHelper onInsert={(tag) => {
              const currentContent = block.meta.content || '';
              onUpdate({ content: currentContent + tag });
            }} />
          </div>
          <textarea 
            value={block.meta.content} 
            onChange={(evt) => { 
              onUpdate({ content: evt.target.value }); 
            }} 
            className="w-full max-w-full min-w-0 border border-slate-200 rounded p-2 bg-white text-black text-sm resize-none" 
            rows={4} 
            style={{ maxWidth: '100%', wordWrap: 'break-word' }}
            placeholder="e.g. Hi {{first_name}}, thanks for joining!"
          />
          <div className="text-xs text-slate-400">
            Preview: {renderMergeTagPreview(block.meta.content)}
          </div>
          <label className="text-xs block mb-1">Align</label>
          <select 
            value={block.meta.align} 
            onChange={(e) => onUpdate({ align: e.target.value })} 
            className="w-full max-w-full border border-slate-200 rounded p-2 bg-white text-black text-sm"
          >
            <option value="left">left</option>
            <option value="center">center</option>
            <option value="right">right</option>
          </select>
          <label className="text-xs block mb-1">Font size</label>
          <input 
            type="number" 
            value={block.meta.fontSize} 
            onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value || '16', 10) })} 
            className="w-full max-w-full border border-slate-200 rounded p-2 bg-white text-black text-sm" 
            min="8" 
            max="72"
          />
        </div>
      );
      break;
    case 'image':
      inspectorContent = (
        <div className="space-y-2">
          <label className="text-xs block mb-1">Src</label>
          <input 
            value={block.meta.src} 
            onChange={(e) => onUpdate({ src: e.target.value })} 
            className="w-full max-w-full min-w-0 border border-slate-200 rounded p-2 bg-white text-black text-sm" 
            placeholder="Image URL"
            style={{ maxWidth: '100%' }}
          />
          <label className="text-xs block mb-1">Alt</label>
          <input 
            value={block.meta.alt} 
            onChange={(e) => onUpdate({ alt: e.target.value })} 
            className="w-full max-w-full min-w-0 border border-slate-200 rounded p-2 bg-white text-black text-sm" 
            placeholder="Alt text"
            style={{ maxWidth: '100%' }}
          />
          <label className="text-xs block mb-1">Align</label>
          <select 
            value={block.meta.align || 'center'} 
            onChange={(e) => onUpdate({ align: e.target.value })} 
            className="w-full max-w-full border border-slate-200 rounded p-2 bg-white text-black text-sm"
          >
            <option value="left">left</option>
            <option value="center">center</option>
            <option value="right">right</option>
          </select>
        </div>
      );
      break;
    case 'button':
      inspectorContent = (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs block mb-1">Label</label>
            <MergeTagHelper onInsert={(tag) => {
              const currentLabel = block.meta.label || '';
              onUpdate({ label: currentLabel + tag });
            }} />
          </div>
          <input 
            value={block.meta.label} 
            onChange={(e) => onUpdate({ label: e.target.value })} 
            className="w-full max-w-full min-w-0 border border-slate-200 rounded p-2 bg-white text-black text-sm" 
            placeholder="e.g. Hi {{first_name}}, click here!"
            style={{ maxWidth: '100%' }}
          />
          <div className="text-xs text-slate-400">
            Preview: {renderMergeTagPreview(block.meta.label)}
          </div>
          <label className="text-xs block mb-1">URL</label>
          <input 
            value={block.meta.url} 
            onChange={(e) => onUpdate({ url: e.target.value })} 
            className="w-full max-w-full min-w-0 border border-slate-200 rounded p-2 bg-white text-black text-sm" 
            placeholder="https://example.com"
            style={{ maxWidth: '100%' }}
          />
          <label className="text-xs block mb-1">Style</label>
          <select 
            value={block.meta.style} 
            onChange={(e) => onUpdate({ style: e.target.value })} 
            className="w-full max-w-full border border-slate-200 rounded p-2 bg-white text-black text-sm"
          >
            <option value="solid">Solid</option>
            <option value="outline">Outline</option>
          </select>

          <div className="max-w-full overflow-hidden">
            <ColorChooser
              value={block.meta.background || '#FF66B2'}
              onChange={(bg) => {
                const autoText = getContrastingText(bg);
                onUpdate({ background: bg, color: block.meta.color || autoText });
              }}
              textColor={block.meta.color}
              onTextColorChange={(col) => onUpdate({ color: col })}
            />
          </div>
          <label className="text-xs block mb-1">Placement</label>
          <select 
            value={block.meta.placement || 'center'} 
            onChange={(e) => onUpdate({ placement: e.target.value })} 
            className="w-full max-w-full border border-slate-200 rounded p-2 bg-white text-black text-sm"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      );
      break;
    case 'youtube-subscribe':
      inspectorContent = (
        <div className="space-y-2">
          <label className="text-xs block mb-1">Channel handle or ID</label>
          <input 
            value={block.meta.channel || block.meta.channelHandleOrId || ''} 
            onChange={(e) => onUpdate({ channel: e.target.value, channelHandleOrId: e.target.value })} 
            className="w-full max-w-full min-w-0 border border-slate-200 rounded p-2 bg-white text-black text-sm" 
            placeholder="e.g. SomeChannel or UC..."
            style={{ maxWidth: '100%' }}
          />

          <label className="text-xs block mb-1">Fallback video URL</label>
          <input 
            value={block.meta.url || ''} 
            onChange={(e) => onUpdate({ url: e.target.value })} 
            className="w-full max-w-full min-w-0 border border-slate-200 rounded p-2 bg-white text-black text-sm" 
            placeholder="https://www.youtube.com/watch?v=..."
            style={{ maxWidth: '100%' }}
          />

          <label className="text-xs block mb-1">Thumbnail URL (optional)</label>
          <input 
            value={block.meta.thumbnail || ''} 
            onChange={(e) => onUpdate({ thumbnail: e.target.value })} 
            className="w-full max-w-full min-w-0 border border-slate-200 rounded p-2 bg-white text-black text-sm"
            placeholder="https://..."
            style={{ maxWidth: '100%' }}
          />

          <label className="text-xs block mb-1">Button text</label>
          <input 
            value={block.meta.label || '▶ Subscribe on YouTube'} 
            onChange={(e) => onUpdate({ label: e.target.value })} 
            className="w-full max-w-full min-w-0 border border-slate-200 rounded p-2 bg-white text-black text-sm"
            style={{ maxWidth: '100%' }}
          />

          <div className="text-xs mb-2">UTM parameters</div>
          <div className="space-y-2">
            <input 
              value={block.meta.utm_source || 'newsletter'} 
              onChange={(e) => onUpdate({ utm_source: e.target.value })} 
              className="w-full max-w-full border border-slate-200 rounded p-2 bg-white text-black text-xs" 
              placeholder="utm_source"
              style={{ maxWidth: '100%' }}
            />
            <input 
              value={block.meta.utm_medium || 'email'} 
              onChange={(e) => onUpdate({ utm_medium: e.target.value })} 
              className="w-full max-w-full border border-slate-200 rounded p-2 bg-white text-black text-xs" 
              placeholder="utm_medium"
              style={{ maxWidth: '100%' }}
            />
            <input 
              value={block.meta.utm_campaign || ''} 
              onChange={(e) => onUpdate({ utm_campaign: e.target.value })} 
              className="w-full max-w-full border border-slate-200 rounded p-2 bg-white text-black text-xs" 
              placeholder="utm_campaign"
              style={{ maxWidth: '100%' }}
            />
          </div>

          <ColorChooser
            value={block.meta.background || '#FF0000'}
            onChange={(bg) => {
              const autoText = getContrastingText(bg);
              onUpdate({ background: bg, color: block.meta.color || autoText });
            }}
            textColor={block.meta.color}
            onTextColorChange={(col) => onUpdate({ color: col })}
          />
          <label className="text-xs">Placement</label>
          <select value={block.meta.placement || 'center'} onChange={(e) => onUpdate({ placement: e.target.value })} className="w-full border border-slate-200 rounded p-2 bg-white text-black">
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      );
      break;
    case 'divider':
      inspectorContent = (
        <div className="space-y-2">
          <label className="text-xs">Thickness</label>
          <input type="number" value={block.meta.height} onChange={(e) => onUpdate({ height: parseInt(e.target.value || '1', 10) })} className="w-full border border-slate-200 rounded p-2 bg-white text-black" />
          <label className="text-xs">Color</label>
          <input value={block.meta.color} onChange={(e) => onUpdate({ color: e.target.value })} className="w-full border border-slate-200 rounded p-2 bg-white text-black" />
        </div>
      );
      break;
    case 'spacer':
      inspectorContent = (
        <div className="space-y-2">
          <label className="text-xs">Height</label>
          <input type="number" value={block.meta.height} onChange={(e) => onUpdate({ height: parseInt(e.target.value || '20', 10) })} className="w-full border border-slate-200 rounded p-2 bg-white text-black" />
        </div>
      );
      break;
    default:
      inspectorContent = <div className="text-sm text-slate-500">No inspector available</div>;
  }

  // NOTE: The SubscribeButtonBuilder was previously embedded in the inspector.
  // It has been removed from the inspector UI and is now surfaced from the
  // toolbar via a modal when the user clicks + Subscribe (YouTube).

  return (
    <div>
      {inspectorContent}
    </div>
  );
}

/* ---------- Social-video helpers (YouTube, TikTok, Vimeo, Instagram Reels) ---------- */
function detectVideoProvider(url) {
  if (!url) return '';
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/tiktok\.com/.test(url)) return 'tiktok';
  if (/vimeo\.com/.test(url)) return 'vimeo';
  if (/instagram\.com\/reel|instagram\.com\/p|instagr\.am\/p|instagr\.am\/reel/.test(url)) return 'instagram';
  return '';
}

function getYouTubeId(url) {
  if (!url) return null;
  const m = url.match(/[?&]v=([^&]+)|youtu\.be\/([^?&/]+)/) || url.match(/youtube\.com\/embed\/([^?&/]+)/);
  return m ? (m[1] || m[2]) : null;
}

function getVideoThumbnail(url) {
  if (!url) return null;
  const provider = detectVideoProvider(url);
  if (provider === 'youtube') {
    const id = getYouTubeId(url);
    if (!id) return null;
    return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }
  return null;
}

// small helper to darken a hex color by percent (0-100)
function darkenHex(hex, percent) {
  try {
    const h = (hex || '#ff0000').replace('#','');
    const r = Math.max(0, Math.min(255, Math.round(parseInt(h.substr(0,2),16) * (1 - percent/100))));
    const g = Math.max(0, Math.min(255, Math.round(parseInt(h.substr(2,2),16) * (1 - percent/100))));
    const b = Math.max(0, Math.min(255, Math.round(parseInt(h.substr(4,2),16) * (1 - percent/100))));
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  } catch (e) {
    return hex;
  }
}

function extractTikTokEmbedSrc(url) {
  try {
    const m = url.match(/tiktok\.com\/(?:@[^/]+\/video\/)?(\d+)/);
    if (m && m[1]) return `https://www.tiktok.com/embed/v2/${m[1]}`;
  } catch (e) {}
  return null;
}

function extractInstagramEmbedSrc(url) {
  try {
    const m = url.match(/instagram\.com\/(?:reel|p)\/([^/?#]+)/);
    if (m && m[1]) return `https://www.instagram.com/reel/${m[1]}/embed/`;
  } catch (e) {}
  return null;
}

/* AddVideoControls was removed — videos are now added via the toolbar +video button */

/* ---------- VideoBlockPreview (editor preview of embeds) ---------- */
export function VideoBlockPreview({ block, style }) {
  const src = block?.meta?.src || '';
  const provider = block?.meta?.provider || detectVideoProvider(src);

  if (!src) {
    return <div style={{ padding: 12, borderRadius: 6, background: '#f2f2f2', color: '#333' }}>No video source</div>;
  }

  if (provider === 'youtube') {
    const id = getYouTubeId(src);
    if (id) {
      return <div style={{ position: 'relative', paddingTop: '56.25%', ...style }}><iframe title={block.meta.title || 'YouTube video'} src={`https://www.youtube.com/embed/${id}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }} allowFullScreen /></div>;
    }
  }

  if (provider === 'tiktok') {
    const embed = extractTikTokEmbedSrc(src);
    if (embed) {
      return <div style={{ position: 'relative', paddingTop: '56.25%', ...style }}><iframe title={block.meta.title || 'TikTok video'} src={embed} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }} allowFullScreen /></div>;
    }
  }

  if (provider === 'vimeo') {
    try {
      const m = src.match(/vimeo\.com\/(\d+)/);
      if (m && m[1]) return <div style={{ position: 'relative', paddingTop: '56.25%', ...style }}><iframe title={block.meta.title || 'Vimeo video'} src={`https://player.vimeo.com/video/${m[1]}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }} allowFullScreen /></div>;
    } catch (e) {}
  }

  if (provider === 'instagram') {
    const embed = extractInstagramEmbedSrc(src);
    if (embed) {
      return <div style={{ position: 'relative', paddingTop: '56.25%', ...style }}><iframe title={block.meta.title || 'Instagram Reel'} src={embed} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }} allowFullScreen /></div>;
    }
  }

  const thumb = block?.meta?.thumbnail || getVideoThumbnail(src) || '/images/video-placeholder.png';
  return (
    <div style={{ textAlign: 'center' }}>
      <a href={src} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
        <img src={thumb} alt={block?.meta?.title || 'Video'} style={{ maxWidth: '100%', height: 'auto', borderRadius: 6 }} />
        <div style={{ marginTop: 8, fontSize: 14 }}>▶ Open video</div>
      </a>
    </div>
  );
}

/* ---------- VideoInspector (URL-only editing) ---------- */
export function VideoInspector({ block, onUpdate }) {
  if (!block) return null;
  return (
    <div className="space-y-2">
      <label className="text-xs">Video URL (YouTube, TikTok, Vimeo, Instagram Reels)</label>
      <input
        value={block.meta.src || ''}
        onChange={(e) => {
          const val = e.target.value;
          const provider = detectVideoProvider(val);
          const thumb = getVideoThumbnail(val);
          onUpdate({ src: val, provider, thumbnail: thumb || block.meta.thumbnail });
        }}
        className="w-full border border-slate-200 rounded p-2 bg-white text-black"
        placeholder="https://youtube.com/watch?v=..., https://www.tiktok.com/..."
      />

      <label className="text-xs">Title</label>
      <input value={block.meta.title || ''} onChange={(e) => onUpdate({ title: e.target.value })} className="w-full border border-slate-200 rounded p-2 bg-white text-black" />

      <label className="text-xs">Thumbnail URL (optional)</label>
      <input value={block.meta.thumbnail || ''} onChange={(e) => onUpdate({ thumbnail: e.target.value })} className="w-full border border-slate-200 rounded p-2 bg-white text-black" />

      <div className="text-xs text-slate-400">Note: exported email HTML should use a clickable thumbnail that links to the video URL for maximum compatibility.</div>
    </div>
  );
}

function renderBlockPreviewEmail(b) {
  switch(b.type) {
    case 'video': return <div style={{ textAlign: 'center' }}><VideoBlockPreview block={b} /></div>;
    case 'text': return <div style={{ textAlign: b.meta.align, fontSize: b.meta.fontSize, whiteSpace: 'pre-wrap' }}>{b.meta.content}</div>;
    case 'image': return <div style={{ textAlign: (b.meta && b.meta.align) || 'center' }}><img src={b.meta.src} alt={b.meta.alt} style={{ maxWidth: '100%', height: 'auto', borderRadius: 6 }} /></div>;
    case 'button': {
      const placement = b.meta.placement || 'center';
      const bg = b.meta.background ?? (b.meta.style === 'solid' ? '#000' : 'transparent');
      const color = b.meta.color ?? (b.meta.style === 'solid' ? '#fff' : '#000');
      const border = b.meta.style === 'outline' ? `1px solid ${b.meta.color ?? '#000'}` : 'none';
      return <div style={{ textAlign: placement }}><a href={b.meta.url} style={{ display:'inline-block', padding:'8px 12px', background: bg, color, borderRadius:6, border }}>{b.meta.label}</a></div>;
    }
    case 'youtube-subscribe': {
      const chan = b.meta.channel || b.meta.channelHandleOrId || '';
      let target = b.meta.url || '';
      if (chan) {
        if (chan.startsWith('UC') || /^\w{24,}$/.test(chan)) {
          target = `https://www.youtube.com/channel/${encodeURIComponent(chan)}?sub_confirmation=1`;
        } else {
          target = `https://www.youtube.com/@${encodeURIComponent(chan)}?sub_confirmation=1`;
        }
      }
      const utm = `utm_source=${encodeURIComponent(b.meta.utm_source||'newsletter')}&utm_medium=${encodeURIComponent(b.meta.utm_medium||'email')}&utm_campaign=${encodeURIComponent(b.meta.utm_campaign||'')}`;
      const sep = target.includes('?') ? '&' : '?';
      const finalUrl = `${target}${sep}${utm}`;
      const thumb = b.meta.thumbnail || (b.meta.url ? getVideoThumbnail(b.meta.url) : '') || '';
      const bg = b.meta.background || '#FF0000';
      const color = b.meta.color || '#ffffff';
      const placement = b.meta.placement || 'center';
      const buttonHtml = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 auto"><tr><td align="center" bgcolor="${bg}" style="background:${bg};border-radius:6px;padding:0"><a href="${finalUrl}" style="display:inline-block;padding:12px 20px;font-family:Arial, Helvetica, sans-serif;font-size:16px;line-height:20px;color:${color};text-decoration:none;border-radius:6px">${escapeHtml(b.meta.label || '▶ Subscribe on YouTube')}</a></td></tr></table>`;
      const imgHtml = thumb ? `<div style="text-align:${placement}"><a href="${finalUrl}"><img src="${thumb}" alt="${escapeHtml(b.meta.label || 'Subscribe')}" style="max-width:100%;height:auto;border-radius:6px" /></a></div>` : '';
      return `<div style="text-align:${placement}">${imgHtml}${buttonHtml}</div>`;
    }
    case 'youtube-subscribe': {
      // Editor preview: render a YouTube-style subscribe button (visual only)
      const chan = b.meta.channel || b.meta.channelHandleOrId || '';
      let target = b.meta.url || '';
      if (chan) {
        if (chan.startsWith('UC') || /^\w{24,}$/.test(chan)) {
          target = `https://www.youtube.com/channel/${encodeURIComponent(chan)}?sub_confirmation=1`;
        } else {
          target = `https://www.youtube.com/@${encodeURIComponent(chan)}?sub_confirmation=1`;
        }
      }
      const utm = `utm_source=${encodeURIComponent(b.meta.utm_source||'newsletter')}&utm_medium=${encodeURIComponent(b.meta.utm_medium||'email')}&utm_campaign=${encodeURIComponent(b.meta.utm_campaign||'')}`;
      const sep = target.includes('?') ? '&' : '?';
      const finalUrl = `${target}${sep}${utm}`;

  // Visual styles for editor preview: derive gradient from meta.background and meta.color
  const baseBg = (b.meta.background || '#ff3b2f').toLowerCase();
  const dark = darkenHex(baseBg, 12);
  const gradient = `linear-gradient(${baseBg},${dark})`;
  const label = b.meta.label || 'Subscribe';
  const textColor = b.meta.color || '#ffffff';

      const placement = b.meta.placement || 'center';
      return (
        <div style={{ textAlign: placement }}>
          {/* Thumbnail (if provided) */}
          { (b.meta.thumbnail || getVideoThumbnail(b.meta.url)) && (
            <a href={finalUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none', display:'inline-block', outline:'none', border:'none' }}>
              <img src={b.meta.thumbnail || getVideoThumbnail(b.meta.url)} alt={b.meta.label || 'Subscribe'} style={{ maxWidth: '100%', height: 'auto', borderRadius:6, display:'block', margin:'0 auto' }} />
            </a>
          ) }

          <div style={{ height:12 }} />

          <div style={{ textAlign: placement }}>
          <a
            href={finalUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Subscribe on YouTube"
            style={{
              display:'inline-flex',alignItems:'center',gap:10,padding:'8px 14px',borderRadius:20,fontWeight:700,fontFamily:'Arial, Helvetica, sans-serif',textDecoration:'none',lineHeight:1,color:textColor,background:gradient,boxShadow:'0 1px 0 rgba(0,0,0,0.15)'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" style={{flex:'0 0 18px',display:'block'}}>
              <path d="M10 8.5v7l6-3.5-6-3.5z" fill="currentColor" />
            </svg>
            <span style={{display:'inline-block',fontSize:14}}>{label}</span>
          </a>
          </div>
        </div>
      );
    }
    case 'divider': return <div style={{ height: b.meta.height, background: b.meta.color, width: '100%' }} />;
    case 'spacer': return <div style={{ height: b.meta.height }} />;
    default: return null;
  }
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(s, n) { return s && s.length > n ? s.slice(0,n-1) + '…' : s || ''; }

/* helper to render nested column blocks (simple) */
function renderBlockHtml(b) {
  switch(b.type) {
    case 'text': return `<div style="text-align:${b.meta.align};font-size:${b.meta.fontSize}px;color:#000;white-space:pre-wrap">${escapeHtml(b.meta.content)}</div>`;
    case 'image': return `<div><img src="${b.meta.src}" alt="${escapeHtml(b.meta.alt || '')}" style="max-width:100%;height:auto"/></div>`;
    case 'button': {
      const bg = b.meta.background || (b.meta.style === 'solid' ? '#000' : 'transparent');
      const color = b.meta.color || (b.meta.style === 'solid' ? '#fff' : '#000');
      const border = b.meta.style === 'outline' ? `border:1px solid ${b.meta.color || '#000'};` : '';
      return `<div><a href="${b.meta.url}" style="display:inline-block;padding:8px 12px;background:${bg};color:${color};border-radius:6px;text-decoration:none;${border}">${escapeHtml(b.meta.label)}</a></div>`;
    }
    case 'divider': return `<div style="height:${b.meta.height}px;background:${b.meta.color};width:100%"></div>`;
    case 'spacer': return `<div style="height:${b.meta.height}px"></div>`;
    default: return '';
  }
}

// download helper
function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
