import React, { useMemo, useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Search,
  UploadCloud,
  Download,
  Wand2,
  Filter,
  MoreHorizontal,
  ChevronRight,
  Star,
  Heart,
  Trash2,
  CheckCircle2,
  ArrowUpRight,
  Settings,
  UserRound,
  MessageCircle
} from "lucide-react";
import { useAuth } from '../../contexts/AuthContext';
import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import 'firebase/compat/storage';
import { hexGridToPng } from '../../utils/hexGridToPng';
import CreatePattern from '../designers/CreatePattern';
import CommentModal from '../shared/CommentModal';

// --- Utility styles for brand look ---
const gradientBtn =
  "bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 text-white hover:brightness-110 active:brightness-95 transition-all shadow-lg shadow-pink-500/20";
const neonAccent = "text-[#ff2d95]"; // neon pink accent for highlights
const cardBase =
  "bg-neutral-50/80 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800 rounded-2xl shadow-sm backdrop-blur";

// --- Mock data (replace with your API) ---
const sampleItems = [
  {
    id: "u1",
    type: "pattern",
    title: "Aurora Ripple",
    colorway: "Teal → Magenta",
    downloads: 243,
    likes: 61,
    comments: 5,
    updatedAt: "2025-08-02",
    preview: "linear-gradient(90deg, #00f5d4, #7b2cbf)"
  },
  {
    id: "u2",
    type: "mirror",
    title: "Neon Grid",
    colorway: "Neon Pink",
    downloads: 511,
    likes: 120,
    comments: 12,
    updatedAt: "2025-07-21",
    preview: "repeating-linear-gradient(45deg, #ff2d95, #ff2d95 10px, #111 10px, #111 20px)"
  },
  {
    id: "u3",
    type: "pattern",
    title: "Midnight Pulse",
    colorway: "Purple → Indigo",
    downloads: 98,
    likes: 22,
    comments: 3,
    updatedAt: "2025-06-10",
    preview: "linear-gradient(135deg, #7c3aed, #4f46e5)"
  }
];

const sampleDownloads = [
  {
    id: "d1",
    title: "Community Pack · Top 20",
    size: "12.4 MB",
    items: 20,
    author: "Fotonix Community",
    preview: "linear-gradient(90deg, #ff80b5, #9089fc)"
  },
  {
    id: "d2",
    title: "Festival Colors · 2025",
    size: "7.9 MB",
    items: 12,
    author: "@LightSmith",
    preview: "linear-gradient(90deg, #00f5d4, #f15bb5)"
  },
  {
    id: "d3",
    title: "Minimal Waves",
    size: "3.1 MB",
    items: 6,
    author: "@Iris",
    preview: "linear-gradient(90deg, #a1a1aa, #f472b6)"
  }
];

export default function AccountPage() {
  const { currentUser, userProfile, fetchUserProfile, isLoading } = useAuth();
  const [tab, setTab] = useState("uploads");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [uploads, setUploads] = useState(sampleItems);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingPattern, setPendingPattern] = useState(null);
  const [downloads] = useState(sampleDownloads);
  const fileRef = useRef(null);
  const justSavedRef = useRef(false);
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [selectedItemForComments, setSelectedItemForComments] = useState(null);
  function setModalVisible(v) {
    setShowCreateModal(v);
  }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(userProfile || null);

  const filteredUploads = useMemo(() => {
    let list = uploads.filter((i) =>
      i.title.toLowerCase().includes(query.toLowerCase())
    );
    if (filter !== "all") list = list.filter((i) => i.type === filter);
    if (sort === "recent")
      list = list.sort(
        (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)
      );
    if (sort === "popular") list = list.sort((a, b) => b.downloads - a.downloads);
    if (sort === "liked") list = list.sort((a, b) => b.likes - a.likes);
    return list;
  }, [uploads, query, filter, sort]);

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const id = Math.random().toString(36).slice(2, 9);
    const newItem = {
      id,
      type: "pattern",
      title: file.name.replace(/\.[^.]+$/, ""),
      colorway: "Auto",
      downloads: 0,
      likes: 0,
      comments: 0,
      updatedAt: new Date().toISOString().slice(0, 10),
      preview: "linear-gradient(135deg, #ff2d95, #7c3aed)"
    };
    setUploads((u) => [newItem, ...u]);
  };

  // Load profile and listen for uploads from Realtime Database
  useEffect(() => {
    let cancelled = false;
    // If not loading and there's no authenticated user, redirect to the login flow
    if (!isLoading && !currentUser) {
      window.location.hash = 'login';
      return;
    }

    const load = async () => {
      if (!currentUser) return;
      setLoading(true);
      try {
        // ensure profile via AuthContext
        try {
          const p = await fetchUserProfile(currentUser.uid);
          if (!cancelled && p) setProfile(p);
        } catch (e) {
          // ignore profile fetch errors
        }

        // Attach a realtime listener to uploads/{uid} so the UI reflects DB state
        const db = firebase.database();
        const uploadsRef = db.ref(`uploads/${currentUser.uid}`);
        const onVal = (snap) => {
          if (!snap.exists()) {
            setUploads(sampleItems);
            return;
          }
          const raw = snap.val();
          const arr = typeof raw === 'object' && !Array.isArray(raw)
            ? Object.keys(raw).map(k => ({ id: k, ...raw[k] }))
            : Array.isArray(raw) ? raw.filter(Boolean) : [];
          const normalized = arr.map((it) => ({
            id: it.id || it.key || Math.random().toString(36).slice(2,9),
            type: it.type || 'pattern',
            title: it.title || it.name || it.filename || 'Untitled',
            colorway: it.colorway || it.color || '',
            downloads: it.downloads || 0,
            likes: it.likes || it.favorites || 0,
            comments: it.comments || 0,
            updatedAt: it.updatedAt || it.updated || (it.createdAt ? new Date(it.createdAt).toISOString().slice(0,10) : ''),
            preview: it.preview || it.thumbnail || 'linear-gradient(135deg, #ff2d95, #7c3aed)',
            metadata: it.metadata || it
          }));
          setUploads(normalized.reverse());
        };
        uploadsRef.on('value', onVal);

        // detach listener on cleanup
        return () => {
          try { uploadsRef.off('value', onVal); } catch (e) {}
        };
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (currentUser) load();
    return () => { cancelled = true; };
  }, [currentUser, fetchUserProfile]);

  // Save pattern handler: generate PNG, upload to Firebase Storage, then add to uploads
  // Helper: wrap a promise with a timeout to avoid hanging on network writes
  function promiseWithTimeout(promise, ms = 8000, label = '') {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        const err = new Error(`promiseWithTimeout: timed out after ${ms}ms ${label ? `(${label})` : ''}`);
        console.warn(err.message);
        reject(err);
      }, ms);
      promise.then((res) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(res);
      }).catch((err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  async function handleSavePattern() {
    if (!currentUser) {
      // should not happen (modal gated behind auth), but guard
  setModalVisible(false);
      setPendingPattern(null);
      // ensure we clear the loading state so the Save button doesn't stay stuck
      setLoading(false);
      return;
    }

    setSaving(true);
    // safety timeout: log if operation takes too long (don't auto-clear saving anymore)
    const safetyTimeout = setTimeout(() => {
      console.warn('handleSavePattern: safety timeout fired (long op) — not auto-clearing saving state');
    }, 30000);
    const id = Math.random().toString(36).slice(2,9);
    const p = pendingPattern || { vars: Array.from({ length: 25 }, () => 0), brightness: 80, speed: 1.0, style: 'default', title: '' };

    const newItem = {
      id,
      type: 'pattern',
      title: p.title && p.title.trim() ? p.title.trim() : `Pattern ${id}`,
      colorway: 'Custom',
      downloads: 0,
      likes: 0,
      comments: 0,
      updatedAt: new Date().toISOString().slice(0,10),
      preview: 'linear-gradient(135deg, #ff2d95, #7c3aed)',
      metadata: { colors: p.colors, title: p.title, brightness: p.brightness, speed: p.speed }
    };

    try {
      // generate PNG from colors (fallback to white cells if absent)
      const colors = Array.isArray(p.colors) && p.colors.length ? p.colors : Array.from({ length: 25 }, () => '#ffffff');
      const { blob, dataUrl } = await hexGridToPng(colors, { cols: 5, cell: 64, gap: 2, padding: 8, bg: '#0b0b0b' });

      // Upload to Firebase Storage at uploads/{uid}/{id}.png
      const storageRef = firebase.storage().ref(`uploads/${currentUser.uid}/${id}.png`);
      const snapshot = await storageRef.put(blob || dataUrlToBlob(dataUrl));
      const downloadURL = await snapshot.ref.getDownloadURL();
      newItem.preview = downloadURL;
      // Optimistic UX: close the modal now so the UI feels responsive even if DB writes/read stall
      try {
        justSavedRef.current = true;
        setModalVisible(false);
        setPendingPattern(null);
        setTimeout(() => { justSavedRef.current = false; }, 700);
      } catch (e) {}
      // persist metadata to Realtime DB so the listener picks it up
      try {
        // Use a timed wrapper so DB write can't hang the UI forever
        await promiseWithTimeout(firebase.database().ref(`uploads/${currentUser.uid}/${id}`).set(newItem), 8000, 'db.set');
        // Close modal immediately on successful persist so the UI feels responsive
        try { setModalVisible(false); setPendingPattern(null); } catch (e) { console.warn('handleSavePattern: modal close error (success path)', e); }
      } catch (dbErr) {
        console.warn('handleSavePattern: failed to persist upload to Realtime DB', dbErr);
      }
    } catch (err) {
      console.warn('Pattern image generation/upload failed, falling back to inline preview', err);
      // fallback to data URL if generation succeeded partially
      try {
        if (typeof window !== 'undefined' && window.document) {
          const colors = Array.isArray(p.colors) && p.colors.length ? p.colors : Array.from({ length: 25 }, () => '#ffffff');
          const { dataUrl } = await hexGridToPng(colors, { cols: 5, cell: 64, gap: 2, padding: 8, bg: '#0b0b0b' });
          newItem.preview = dataUrl;
          // Close modal on fallback too — we have a preview to show
          try { setModalVisible(false); setPendingPattern(null); } catch (e) { console.warn('handleSavePattern: modal close error (fallback path)', e); }
        }
      } catch (e) {
        // keep default preview
        console.warn('handleSavePattern: fallback dataUrl generation failed', e);
      }
    } finally {
      clearTimeout(safetyTimeout);
      // briefly mark that we've just saved to avoid accidental immediate re-open
      try {
        justSavedRef.current = true;
        setTimeout(() => { justSavedRef.current = false; }, 700);
      } catch (e) {}
      // If no realtime listener is active, update local state immediately for responsiveness
      // else the DB listener will update the uploads list
      try {
        // Guard reads with a timeout as well in case the DB URL/region mismatch causes stalls
        const snapTest = await promiseWithTimeout(firebase.database().ref(`uploads/${currentUser.uid}`).once('value'), 8000, 'db.once');
        if (!snapTest.exists()) {
          setUploads(u => [newItem, ...u]);
        }
      } catch (e) {
        console.warn('handleSavePattern: DB read failed in finally, updating local state as fallback', e);
        setUploads(u => [newItem, ...u]);
      }
      try { setModalVisible(false); setPendingPattern(null); } catch (e) { console.warn('handleSavePattern: modal close error (finally)', e); }
      try { setSaving(false); } catch (e) { console.warn('handleSavePattern: setSaving(false) error', e); }
    }
  }

  // helper: convert dataUrl to Blob if needed
  function dataUrlToBlob(dataUrl) {
    const arr = dataUrl.split(','), mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  }

  return (
    <div className="min-h-[80vh] px-4 sm:px-6 lg:px-8 py-6">
      {/* Top: Profile + Quick stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <motion.div
          layout
          className={`${cardBase} p-5 flex items-center gap-4`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="size-12 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center text-white">
            <UserRound className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">Your Account</h2>
            <p className="text-sm text-neutral-500 truncate">
              Welcome back to <span className="font-medium">Fotonix</span>
            </p>
          </div>
          <button
            className={`ml-auto px-4 py-2 rounded-xl text-sm font-medium ${gradientBtn}`}
          >
            <Settings className="w-4 h-4 mr-1 inline-block" /> Account Settings
          </button>
        </motion.div>

        <motion.div
          layout
          className={`${cardBase} p-5 flex items-center justify-between`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <p className="text-xs uppercase tracking-widest text-neutral-500">
              Total Uploads
            </p>
            <p className="text-2xl font-bold">{uploads.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-neutral-500">
              Community Downloads
            </p>
            <p className="text-2xl font-bold">
              {uploads.reduce((a, b) => a + b.downloads, 0)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-neutral-500">
              Likes
            </p>
            <p className="text-2xl font-bold">{uploads.reduce((a, b) => a + b.likes, 0)}</p>
          </div>
        </motion.div>

        <motion.div
          layout
          className={`${cardBase} p-5 flex items-center gap-3`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Wand2 className={`w-5 h-5 ${neonAccent}`} />
          <div className="text-sm">
            <p className="font-medium">Design with AI</p>
            <p className="text-neutral-500">Generate new mirror patterns in a tap.</p>
          </div>
          <button className={`ml-auto px-3 py-2 rounded-xl text-sm ${gradientBtn}`}>
            Try it
            <ArrowUpRight className="inline w-4 h-4 ml-1" />
          </button>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className={`${cardBase} p-3 mb-4`}> 
        <div className="flex gap-2 overflow-x-auto">
          {[
            { key: "uploads", label: "Your Uploads" },
            { key: "downloads", label: "Available Downloads" },
            { key: "favorites", label: "Favourites" },
            { key: "settings", label: "Settings" }
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                tab === t.key
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar (changes by tab) */}
      {tab === "uploads" && (
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mb-4">
          <div className={`${cardBase} flex items-center px-3`}> 
            <Search className="w-5 h-5 text-neutral-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your designs"
              className="w-full bg-transparent px-2 py-2 outline-none"
            />
          </div>
          <div className="flex gap-3">
            <div className={`${cardBase} px-3 py-2 flex items-center gap-2`}> 
              <Filter className="w-4 h-4 text-neutral-500" />
              <select
                className="bg-transparent outline-none"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All types</option>
                <option value="pattern">Patterns</option>
                <option value="mirror">Mirrors</option>
              </select>
            </div>
            <div className={`${cardBase} px-3 py-2`}> 
              <select
                className="bg-transparent outline-none"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="recent">Most recent</option>
                <option value="popular">Most downloaded</option>
                <option value="liked">Most liked</option>
              </select>
            </div>
          </div>
          <input
            type="file"
            accept=".fotonix,.json,.pat,.zip,.png,.jpg"
            hidden
            ref={fileRef}
            onChange={handleUpload}
          />
          <button
                    onClick={() => { if (justSavedRef.current || saving) return; setModalVisible(true); }}
            className={`w-full sm:w-auto px-4 py-2 rounded-xl font-medium flex items-center justify-center gap-2 ${gradientBtn} ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <UploadCloud className="w-5 h-5" /> Create new design
          </button>
        </div>
      )}

      {tab === "downloads" && (
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mb-4">
          <div className={`${cardBase} flex items-center px-3`}> 
            <Search className="w-5 h-5 text-neutral-500" />
            <input
              placeholder="Search community packs"
              className="w-full bg-transparent px-2 py-2 outline-none"
            />
          </div>
        </div>
      )}

      {/* Content grids */}
      {tab === "uploads" && (
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {filteredUploads.length === 0 ? (
            <div className={`${cardBase} p-8 text-center`}> 
              <p className="text-neutral-500 mb-2">No uploads found.</p>
              <button
                onClick={() => { if (justSavedRef.current) return; setModalVisible(true); }}
                className={`px-4 py-2 rounded-xl font-medium ${gradientBtn}`}
              >
                Create your first design
              </button>
            </div>
          ) : (
            filteredUploads.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${cardBase} overflow-hidden`}
              >
                <div
                  className="h-36 w-full"
                  style={
                    item.preview && /^(https?:\/\/|data:image\/)/.test(item.preview)
                      ? { backgroundImage: `url("${item.preview}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : { background: item.preview }
                  }
                />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold leading-tight">{item.title}</h3>
                      <p className="text-sm text-neutral-500">by {userProfile?.username || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Unknown'}</p>
                    </div>
                    <button className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800">
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
                    <span className="flex items-center gap-1">
                      <Download className="w-4 h-4" /> {item.downloads}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-4 h-4" /> {item.likes}
                    </span>
                    <span className="flex items-center gap-1 cursor-pointer hover:text-neutral-800 dark:hover:text-neutral-200" onClick={() => {
                      setSelectedItemForComments(item);
                      setCommentModalOpen(true);
                    }}>
                      <MessageCircle className="w-4 h-4" /> {item.comments || 0}
                    </span>
                    <span className="ml-auto text-xs">Updated {item.updatedAt}</span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button className={`px-3 py-2 rounded-xl text-sm ${gradientBtn}`}>
                      Send to App
                    </button>
                    <button className="px-3 py-2 rounded-xl text-sm bg-neutral-100 dark:bg-neutral-800">
                      <Star className="w-4 h-4 inline mr-1" /> Favourite
                    </button>
                    <button className="px-3 py-2 rounded-xl text-sm bg-neutral-100 dark:bg-neutral-800">
                      <Trash2 className="w-4 h-4 inline mr-1" /> Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </motion.div>
      )}

      {tab === "downloads" && (
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {downloads.map((pack) => (
            <motion.div key={pack.id} layout className={`${cardBase} overflow-hidden`}>
              <div
                className="h-36 w-full"
                style={
                  pack.preview && /^(https?:\/\/|data:image\/)/.test(pack.preview)
                    ? { backgroundImage: `url("${pack.preview}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
                    : { background: pack.preview }
                }
              />
              <div className="p-4">
                <h3 className="font-semibold leading-tight">{pack.title}</h3>
                <p className="text-sm text-neutral-500">
                  {pack.items} items · {pack.size} · by {pack.author}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <button className={`px-3 py-2 rounded-xl text-sm ${gradientBtn}`}>
                    <Download className="w-4 h-4 inline mr-1" /> Download to App
                  </button>
                  <button className="px-3 py-2 rounded-xl text-sm bg-neutral-100 dark:bg-neutral-800">
                    <ChevronRight className="w-4 h-4 inline mr-1" /> Details
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {tab === "favorites" && (
        <div className={`${cardBase} p-10 text-center`}> 
          <p className="text-neutral-500 mb-3">No favourites yet.</p>
          <p className="text-sm text-neutral-500">
            Tap <span className="font-medium">Favourite</span> on any design to save it here.
          </p>
        </div>
      )}

      {tab === "settings" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className={`${cardBase} p-6`}> 
            <h3 className="font-semibold mb-4">Account</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Email</span>
                <span className="text-neutral-500">user@fotonix.app</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Plan</span>
                <span className="text-neutral-500">Free</span>
              </div>
              <button className={`mt-2 px-4 py-2 rounded-xl text-sm ${gradientBtn}`}>
                Upgrade
              </button>
            </div>
          </div>
          <div className={`${cardBase} p-6`}> 
            <h3 className="font-semibold mb-4">App Connections</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Linked Device</span>
                <span className="text-neutral-500">Mirror #A3F-29</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Sync Status</span>
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="w-4 h-4" /> Up to date
                </span>
              </div>
              <button className={`mt-2 px-4 py-2 rounded-xl text-sm ${gradientBtn}`}>
                Manage Devices
              </button>
            </div>
          </div>
        </div>
      )}
    {/* Create Pattern Modal */}
    {showCreateModal && (
      <div data-debug-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl shadow-lg w-full max-w-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Create New Design</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => { setModalVisible(false); setPendingPattern(null); }} className="px-3 py-1 rounded-md border" disabled={saving}>Cancel</button>
              <button onClick={handleSavePattern} disabled={saving} className={`px-3 py-1 rounded-md ${gradientBtn} ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}>
                {saving ? 'Saving…' : 'Save Pattern'}
              </button>
            </div>
          </div>
          <div className="relative">
            <CreatePattern initial={pendingPattern || undefined} onChange={(val) => setPendingPattern(val)} />
            {saving && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-2xl">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-violet-600"></div>
                  <div className="text-sm text-neutral-700">Saving — uploading image…</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    <CommentModal
      isOpen={commentModalOpen}
      onClose={() => setCommentModalOpen(false)}
      currentUserId={currentUser?.uid}
      creatorUserId={selectedItemForComments?.creatorId || currentUser?.uid}
      patternId={selectedItemForComments?.id}
      onSubmitComment={async (text) => {
        if (!selectedItemForComments || !currentUser) return;

        const db = firebase.database();

        // Get username from user profile
        let username = 'Anonymous';
        try {
          const userSnap = await db.ref(`users/${currentUser.uid}`).once('value');
          const userData = userSnap.val();
          username = userData?.username || currentUser.displayName || 'Anonymous';
        } catch (error) {
          console.warn('Error fetching username for comment submission:', error);
          username = currentUser.displayName || 'Anonymous';
        }

        const commentId = Math.random().toString(36).slice(2, 9);
        const commentData = {
          id: commentId,
          userId: currentUser.uid,
          displayName: username, // Keep displayName for backward compatibility but use username
          text: text,
          createdAt: Date.now()
        };

        // Save comment to comments/{patternId}/{commentId}
        await db.ref(`comments/${selectedItemForComments.id}/${commentId}`).set(commentData);

        // Update comment count by counting actual comments
        const commentsRef = db.ref(`comments/${selectedItemForComments.id}`);
        const commentsSnapshot = await commentsRef.once('value');
        const commentCount = commentsSnapshot.exists() ? Object.keys(commentsSnapshot.val()).length : 0;

        // Update the pattern's comment count
        const patternRef = db.ref(`uploads/${currentUser.uid}/${selectedItemForComments.id}/comments`);
        await patternRef.set(commentCount);
      }}
    />

    </div>
  );
}
