import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { 
  Search, Archive, Trash2, Tag, Forward, Reply, ReplyAll,
  MoreHorizontal, Clock, Send, Paperclip, Eye, EyeOff, Flag,
  ChevronDown, Filter, SortAsc, SortDesc, Settings, Plus,
  ArrowRight, ArrowLeft, Maximize2, Minimize2, X, Sun, Moon,
  ExternalLink, RotateCcw, User, Building, Phone, Mail, Globe,
  Image, Palette, Type, AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, Underline, Link, Save, Trash, Copy, Edit3,
  Upload, Camera
} from 'lucide-react';
import { storage } from '../../firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { API_URL } from '../../config/environment';

/**
 * CONFIG — point this at your deployed API + tenant
 */
const API_BASE = API_URL;
const TENANT_SLUG = process.env.REACT_APP_TENANT_SLUG || "fotonix-prod";

/**
 * Small helpers
 */
function clsx(...xs) { return xs.filter(Boolean).join(" "); }
function timeAgo(d) {
  const dt = typeof d === "string" ? new Date(d) : d;
  const s = Math.floor((Date.now() - dt.getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24); if (days < 7) return `${days}d`;
  return dt.toLocaleDateString();
}
function truncate(s, n = 120) { if (!s) return ""; return s.length > n ? s.slice(0, n - 1) + "…" : s; }

/**
 * Advanced Inbox Screen with world-class features
 */
export default function AdvancedInboxScreen() {
  // State management
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [isComposing, setIsComposing] = useState(false);
  const [replyMode, setReplyMode] = useState(null); // 'reply', 'reply-all', 'forward'
  const [showFilters, setShowFilters] = useState(false);
  const [currentFilter, setCurrentFilter] = useState('inbox');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [labels, setLabels] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [previewMode, setPreviewMode] = useState('right'); // 'right', 'bottom', 'off'
  const [emailPopup, setEmailPopup] = useState(null); // For popup window
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage for saved preference, default to dark
    const saved = localStorage.getItem('email-theme');
    return saved ? saved === 'dark' : true;
  });
  const [showSignatureBuilder, setShowSignatureBuilder] = useState(false);
  const [currentSignature, setCurrentSignature] = useState({
    id: null,
    name: '',
    fullName: '',
    title: '',
    company: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    profileImage: '',
    profileImageRef: null, // Firebase Storage reference for deletion
    socialLinks: {
      linkedin: '',
      twitter: '',
      facebook: '',
      instagram: ''
    },
    styling: {
      fontFamily: 'Arial, sans-serif',
      fontSize: 14,
      textColor: '#333333',
      linkColor: '#0066cc',
      backgroundColor: '#ffffff',
      alignment: 'left'
    },
    layout: 'modern', // 'modern', 'classic', 'minimal', 'creative'
    includeDisclaimer: false,
    disclaimer: ''
  });
  
  // Compose state
  const [composeData, setComposeData] = useState({
    to: '',
    cc: '',
    bcc: '',
    from: '',
    subject: '',
    body: '',
    signature: null,
    priority: 0,
    scheduleAt: null,
    attachments: [] // array of File objects, converted to base64 at send time
  });

  // Business emails state
  const [businessEmails, setBusinessEmails] = useState([]);
  const [mailingEligible, setMailingEligible] = useState(true); // Assume eligible initially

  const listRef = useRef(null);
  const composeRef = useRef(null);

  // Theme management
  const toggleTheme = useCallback(() => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('email-theme', newTheme ? 'dark' : 'light');
  }, [isDarkMode]);

  // Email popup management
  const openEmailPopup = useCallback(async (email) => {
    setEmailPopup({ ...email, loading: true });
    
    try {
      // Fetch full email details
      const memberUid = getAuth().currentUser?.uid;
      const detailParams = new URLSearchParams({ tenant: TENANT_SLUG });
      if (memberUid) detailParams.set("memberUid", memberUid);
      const res = await fetch(`${API_BASE}/api/email/messages/${email.id}?${detailParams.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fullEmail = await res.json();
      
      setEmailPopup({ ...fullEmail, loading: false });
    } catch (err) {
      console.error("Error fetching email details:", err);
      setEmailPopup({ ...email, loading: false, error: err.message });
    }
  }, []);

  const closeEmailPopup = useCallback(() => {
    setEmailPopup(null);
  }, []);

  // Signature management
  const openSignatureBuilder = useCallback((signature = null) => {
    if (signature) {
      setCurrentSignature(signature);
    } else {
      // Reset to default values for new signature
      setCurrentSignature({
        id: null,
        name: '',
        fullName: '',
        title: '',
        company: '',
        email: '',
        phone: '',
        website: '',
        address: '',
        profileImage: '',
        profileImageRef: null,
        socialLinks: {
          linkedin: '',
          twitter: '',
          facebook: '',
          instagram: ''
        },
        styling: {
          fontFamily: 'Arial, sans-serif',
          fontSize: 14,
          textColor: '#333333',
          linkColor: '#0066cc',
          backgroundColor: '#ffffff',
          alignment: 'left'
        },
        layout: 'modern',
        includeDisclaimer: false,
        disclaimer: ''
      });
    }
    setShowSignatureBuilder(true);
  }, []);

  const closeSignatureBuilder = useCallback(() => {
    setShowSignatureBuilder(false);
  }, []);

  const saveSignature = useCallback(async () => {
    try {
      const method = currentSignature.id ? 'PUT' : 'POST';
      const url = currentSignature.id 
        ? `${API_BASE}/api/email/signatures/${currentSignature.id}?tenant=${TENANT_SLUG}`
        : `${API_BASE}/api/email/signatures?tenant=${TENANT_SLUG}`;
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentSignature)
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      // Refresh signatures list
      const sigRes = await fetch(`${API_BASE}/api/email/signatures?tenant=${TENANT_SLUG}`);
      if (sigRes.ok) {
        const sigs = await sigRes.json();
        setSignatures(sigs);
      }
      
      setShowSignatureBuilder(false);
    } catch (err) {
      console.error("Error saving signature:", err);
    }
  }, [currentSignature]);

  const deleteSignature = useCallback(async (signatureId) => {
    try {
      const res = await fetch(`${API_BASE}/api/email/signatures/${signatureId}?tenant=${TENANT_SLUG}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      // Refresh signatures list
      const sigRes = await fetch(`${API_BASE}/api/email/signatures?tenant=${TENANT_SLUG}`);
      if (sigRes.ok) {
        const sigs = await sigRes.json();
        setSignatures(sigs);
      }
    } catch (err) {
      console.error("Error deleting signature:", err);
    }
  }, []);

  // Image upload for signatures
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleImageUpload = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be smaller than 2MB');
      return;
    }

    setImageUploading(true);

    try {
      // Create a unique filename
      const timestamp = Date.now();
      const filename = `signatures/${TENANT_SLUG}/${timestamp}_${file.name}`;
      const storageRef = ref(storage, filename);

      // Upload file
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Update signature with new image URL
      setCurrentSignature(prev => ({
        ...prev,
        profileImage: downloadURL,
        profileImageRef: filename // Store the reference for potential deletion
      }));

    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setImageUploading(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, []);

  const removeProfileImage = useCallback(async () => {
    if (currentSignature.profileImageRef) {
      try {
        // Delete from Firebase Storage
        const storageRef = ref(storage, currentSignature.profileImageRef);
        await deleteObject(storageRef);
      } catch (error) {
        console.error('Error deleting image from storage:', error);
        // Continue anyway - update the signature
      }
    }

    // Remove from signature
    setCurrentSignature(prev => ({
      ...prev,
      profileImage: '',
      profileImageRef: null
    }));
  }, [currentSignature.profileImageRef]);

  // Fetch messages with advanced filtering
  const fetchMessages = useCallback(async ({ reset = false } = {}) => {
    if (loading) return;
    if (!hasMore && !reset) return;
    setLoading(true);
    setError(null);

    // Get current user's memberUid
    const memberUid = getAuth().currentUser?.uid;

    const params = new URLSearchParams();
    params.set("tenant", TENANT_SLUG);
    params.set("limit", "25");
    
    // CRITICAL: Filter by user's business emails
    if (memberUid) {
      params.set("memberUid", memberUid);
    }
    
    // Advanced filtering
    if (currentFilter === 'inbox') {
      params.set("status", "received");
    } else if (currentFilter === 'sent') {
      params.set("status", "sent");
    } else if (currentFilter === 'drafts') {
      params.set("status", "draft");
    } else if (currentFilter === 'archive') {
      params.set("status", "archived");
    } else if (currentFilter === 'spam') {
      params.set("status", "spam");
    } else if (currentFilter === 'trash') {
      params.set("status", "deleted");
    } else if (currentFilter === 'unread') {
      params.set("filter", "unread");
    } else if (currentFilter.startsWith('label:')) {
      params.set("label", currentFilter.replace('label:', ''));
    }
    
    if (query) params.set("q", query);
    if (cursor && !reset) params.set("cursor", cursor);
    if (sortBy) params.set("sort", `${sortBy}:${sortOrder}`);

    try {
      const res = await fetch(`${API_BASE}/api/email/messages?` + params.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      let itemsArr = [];
      let nextCursor = null;
      if (Array.isArray(data)) {
        itemsArr = data;
      } else if (data && Array.isArray(data.items)) {
        itemsArr = data.items;
        nextCursor = data.next_cursor;
      }

      setItems(prevItems => {
        const newItems = reset ? itemsArr : [...(prevItems || []), ...itemsArr];
        return newItems;
      });
      setCursor(nextCursor);
      setHasMore(Boolean(nextCursor));
      
      if (reset && itemsArr.length && !activeId) {
        setActiveId(itemsArr[0].id);
      }
    } catch (e) {
      setError(e.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, cursor, currentFilter, query, sortBy, sortOrder, activeId]);

  // Load labels and signatures
  useEffect(() => {
    const loadLabels = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/email/labels?tenant=${TENANT_SLUG}`);
        if (res.ok) {
          const labelData = await res.json();
          setLabels(labelData);
        }
      } catch (e) {
        // Silently fail - labels endpoint not critical
        console.debug('Labels endpoint not available');
      }
    };

    const loadSignatures = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/email/signatures?tenant=${TENANT_SLUG}`);
        if (res.ok) {
          const sigData = await res.json();
          setSignatures(sigData);
          const defaultSig = sigData.find(s => s.is_default);
          if (defaultSig) {
            setComposeData(prev => ({ ...prev, signature: defaultSig.id }));
          }
        }
      } catch (e) {
        // Silently fail - signatures endpoint not critical
        console.debug('Signatures endpoint not available');
      }
    };

    loadLabels();
    loadSignatures();
  }, []);

  // Load business emails for compose functionality (UPDATED for normalized schema)
  useEffect(() => {
    const loadBusinessEmails = async (uid) => {
      try {
        // Mailing eligibility check removed - all users can send emails
        setMailingEligible(true);

        // Fetch business emails (now returns flat array with real IDs!)
        const emailRes = await fetch(`${API_BASE}/api/member/business-emails/${uid}`);
        if (!emailRes.ok) {
          console.error(`❌ Failed to fetch business emails: ${emailRes.status} ${emailRes.statusText}`);
          return;
        }

        const emailData = await emailRes.json();
        console.log('📧 Business emails response (normalized):', emailData);
        
        // The backend may return either:
        // - a flat array of email objects (new normalized API)
        // - OR an array of "group" objects like { businessName, emails: [...] }
        if (!Array.isArray(emailData)) {
          console.error('❌ Unexpected response shape - expected array, got:', typeof emailData);
          return;
        }

        // If the response is grouped (each item has an `emails` array), flatten it.
        let flatList = [];
        if (emailData.length && Array.isArray(emailData[0].emails)) {
          // Flatten grouped response: take every group's emails and attach businessName if present
          flatList = emailData.flatMap(group => (group.emails || []).map(em => ({
            // keep any business-level name for context
            businessName: group.businessName || group.business_name || em.businessName || em.business_name,
            // merge email entry fields (support different keys)
            id: em.id || em.email_id || null,
            email: em.email || em.address || em.email_address,
            type: em.type || em.email_type,
            displayName: em.displayName || em.display_name || em.name,
            description: em.description,
            isVerified: em.isVerified || em.is_verified || em.verified || false,
            dailyLimit: em.dailyLimit || em.daily_send_limit,
            dailyRemaining: em.dailyRemaining || em.daily_remaining
          })));
        } else {
          flatList = emailData.map(emailObj => ({
            id: emailObj.id || emailObj.email_id || null,
            email: emailObj.email || emailObj.address || emailObj.email_address,
            type: emailObj.type || emailObj.email_type,
            displayName: emailObj.displayName || emailObj.display_name || emailObj.name,
            description: emailObj.description,
            businessName: emailObj.businessName || emailObj.business_name,
            isVerified: emailObj.isVerified || emailObj.is_verified || emailObj.verified || false,
            dailyLimit: emailObj.dailyLimit || emailObj.daily_send_limit,
            dailyRemaining: emailObj.dailyRemaining || emailObj.daily_remaining
          }));
        }

        // Normalize and filter out entries without an email address
        const processedEmails = (flatList || []).map(e => ({
          id: e.id,
          email: e.email,
          type: e.type,
          displayName: e.displayName,
          description: e.description,
          businessName: e.businessName,
          isVerified: e.isVerified,
          dailyLimit: e.dailyLimit,
          dailyRemaining: e.dailyRemaining
        })).filter(e => e && e.email);

        console.log(`✅ Loaded ${processedEmails.length} business emails (flattened):`,
          processedEmails.map(e => `${e.id || '(no-id)'}:${e.email}`));

        setBusinessEmails(processedEmails);

        // Set default from email if available and not already set
        if (processedEmails.length > 0 && !composeData.from) {
          setComposeData(prev => ({ 
            ...prev, 
            from: processedEmails[0].email,
            fromEmailId: processedEmails[0].id || null
          }));
        }
      } catch (e) {
        console.debug('Business emails not available:', e.message);
        setBusinessEmails([]); // Set empty array on error
      }
    };

    // Firebase's session restore is async — on a fresh load, getAuth().currentUser
    // can still be null the instant this component mounts, and this effect never
    // re-ran to retry (empty deps), so business emails silently never loaded for
    // the rest of the session. Subscribe instead so it fires as soon as auth
    // state actually resolves (immediately if already available).
    const unsubscribe = onAuthStateChanged(getAuth(), (user) => {
      if (user) {
        loadBusinessEmails(user.uid);
      } else {
        setBusinessEmails([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Initial + whenever dependencies change
  useEffect(() => {
    fetchMessages({ reset: true });
  }, [currentFilter, query, sortBy, sortOrder]);

  // Load message detail when selection changes
  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!activeId) { setDetail(null); return; }
      setDetailLoading(true);
      try {
        const memberUid = getAuth().currentUser?.uid;
        const detailParams = new URLSearchParams({ tenant: TENANT_SLUG });
        if (memberUid) detailParams.set("memberUid", memberUid);
        const res = await fetch(`${API_BASE}/api/email/messages/${activeId}?${detailParams.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!ignore) {
          setDetail(data);
          // Mark as read
          if (!data.is_read) {
            markAsRead([activeId]);
          }
        }
      } catch (e) {
        if (!ignore) setDetail({ error: e.message || "Failed to load message" });
      } finally {
        if (!ignore) setDetailLoading(false);
      }
    }
    run();
    return () => { ignore = true; };
  }, [activeId]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e) {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      // These are bare single-letter shortcuts (Gmail-style). Without this
      // guard, e.key is still 'c'/'r'/'a'/'f'/'s'/'x' even when Ctrl/Cmd is
      // held, so Ctrl+C, Ctrl+R, Ctrl+A, Ctrl+F, Ctrl+S, Ctrl+X were all
      // being hijacked (copy/refresh/select-all/find/save/cut) instead of
      // reaching the browser.
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const selectedCount = selectedItems.size;
      const currentIndex = items.findIndex(m => m.id === activeId);
      
      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          if (currentIndex < items.length - 1) {
            setActiveId(items[currentIndex + 1]?.id);
          }
          break;
          
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          if (currentIndex > 0) {
            setActiveId(items[currentIndex - 1]?.id);
          }
          break;
          
        case 'r':
          e.preventDefault();
          if (detail && !isComposing) {
            startReply('reply');
          }
          break;
          
        case 'a':
          e.preventDefault();
          if (detail && !isComposing) {
            startReply('reply-all');
          }
          break;
          
        case 'f':
          e.preventDefault();
          if (detail && !isComposing) {
            startReply('forward');
          }
          break;
          
        case 'e':
        case 'y':
          e.preventDefault();
          if (selectedCount > 0) {
            archiveMessages([...selectedItems]);
          } else if (activeId) {
            archiveMessages([activeId]);
          }
          break;
          
        case '#':
        case 'Delete':
          e.preventDefault();
          if (selectedCount > 0) {
            deleteMessages([...selectedItems]);
          } else if (activeId) {
            deleteMessages([activeId]);
          }
          break;
          
        case 'c':
          e.preventDefault();
          if (!isComposing) {
            startCompose();
          }
          break;
          
        case 'Escape':
          e.preventDefault();
          if (isComposing) {
            setIsComposing(false);
            setReplyMode(null);
          }
          if (selectedItems.size > 0) {
            setSelectedItems(new Set());
          }
          break;
          
        case 'x':
          e.preventDefault();
          if (activeId) {
            toggleSelection(activeId);
          }
          break;
          
        case '*':
          e.preventDefault();
          if (e.shiftKey) { // Select all
            if (selectedItems.size === items.length) {
              setSelectedItems(new Set());
            } else {
              setSelectedItems(new Set(items.map(item => item.id)));
            }
          }
          break;
      }
    }
    
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, activeId, detail, isComposing, selectedItems, signatures]);

  // Message actions
  const markAsRead = async (ids) => {
    try {
      const res = await fetch(`${API_BASE}/api/email/messages/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant: TENANT_SLUG, message_ids: ids, read: true })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setItems(prev => prev.map(item =>
        ids.includes(item.id) ? { ...item, is_read: true } : item
      ));
    } catch (e) {
      console.error('Failed to mark as read:', e);
      setError('Failed to mark as read — please try again');
    }
  };

  const archiveMessages = async (ids) => {
    try {
      const res = await fetch(`${API_BASE}/api/email/messages/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant: TENANT_SLUG, message_ids: ids })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setItems(prev => prev.filter(item => !ids.includes(item.id)));
      setSelectedItems(new Set());
      if (ids.includes(activeId)) {
        setActiveId(null);
        setDetail(null);
      }
    } catch (e) {
      console.error('Failed to archive:', e);
      setError('Failed to archive — please try again');
    }
  };

  const deleteMessages = async (ids) => {
    try {
      const res = await fetch(`${API_BASE}/api/email/messages/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant: TENANT_SLUG, message_ids: ids })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setItems(prev => prev.filter(item => !ids.includes(item.id)));
      setSelectedItems(new Set());
      if (ids.includes(activeId)) {
        setActiveId(null);
        setDetail(null);
      }
    } catch (e) {
      console.error('Failed to delete:', e);
      setError('Failed to delete — please try again');
    }
  };

  const toggleSelection = (id) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Reply/compose functions
  const startCompose = () => {
    setReplyMode(null);
    setIsComposing(true);

    // Reset compose data to blank state. Keep `from`/`fromEmailId` defaulted
    // to the first loaded business email — omitting them here previously
    // wiped out whatever the business-emails-loaded effect had auto-set,
    // leaving composeData.from empty (Send disabled, "Missing: From") even
    // though the dropdown displayed the address (a bare <select> just falls
    // back to showing its first <option> when its value matches nothing).
    setComposeData({
      from: businessEmails[0]?.email || '',
      fromEmailId: businessEmails[0]?.id || null,
      to: '',
      cc: '',
      bcc: '',
      subject: '',
      body: '',
      signature: null,
      priority: 0,
      scheduleAt: null,
      originalMessageId: null,
      attachments: []
    });

    // Focus compose area
    setTimeout(() => {
      if (composeRef.current) {
        const textarea = composeRef.current.querySelector('textarea');
        if (textarea) {
          textarea.focus();
        }
      }
    }, 100);
  };

  const startReply = (mode) => {
    if (!detail) return;
    
    const isForward = mode === 'forward';
    const isReplyAll = mode === 'reply-all';
    
    let to = '';
    let cc = '';
    let subject = detail.subject || '';
    
    if (isForward) {
      subject = subject.startsWith('Fwd:') ? subject : `Fwd: ${subject}`;
    } else {
      const originalFrom = detail.from?.[0]?.address || detail.from_address;
      to = originalFrom;
      
      if (isReplyAll && detail.to && detail.to.length > 1) {
        const otherRecipients = detail.to.filter(addr => 
          addr.address !== originalFrom && 
          !addr.address.includes('@fotonix.co.uk') // Don't CC ourselves
        );
        cc = otherRecipients.map(addr => addr.address).join(', ');
      }
      
      subject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
    }
    
    setReplyMode(mode);
    setIsComposing(true);
    
    // Prepare email body based on mode
    let bodyContent = '';
    if (isForward) {
      bodyContent = `\n\n--- Forwarded message ---\nFrom: ${detail.from_address || detail.from?.[0]?.address}\nDate: ${new Date(detail.created_at).toLocaleString()}\nSubject: ${detail.subject}\n\n${detail.text || detail.html?.replace(/<[^>]*>/g, '') || ''}`;
    } else {
      // For replies, add the original message as quoted text at the bottom
      const originalSender = detail.from_address || detail.from?.[0]?.address || 'Unknown';
      const originalDate = new Date(detail.created_at).toLocaleString();
      const originalText = detail.text || detail.html?.replace(/<[^>]*>/g, '') || '';

      bodyContent = `[Type your reply here]\n\n\n\n--- Original Message ---\nFrom: ${originalSender}\nDate: ${originalDate}\nSubject: ${detail.subject || '(no subject)'}\n\n${originalText.split('\n').map(line => `> ${line}`).join('\n')}`;
    }
    
    setComposeData(prev => ({
      ...prev,
      to,
      cc,
      subject,
      body: bodyContent,
      originalMessageId: detail.id
    }));
    
    // Focus compose area and position cursor
    setTimeout(() => {
      if (composeRef.current) {
        const textarea = composeRef.current.querySelector('textarea');
        if (textarea) {
          textarea.focus();
          // For replies, select the placeholder text so user can immediately type
          if (!isForward) {
            const placeholderText = '[Type your reply here]';
            const startPos = textarea.value.indexOf(placeholderText);
            if (startPos !== -1) {
              textarea.setSelectionRange(startPos, startPos + placeholderText.length);
            } else {
              textarea.setSelectionRange(0, 0);
            }
            textarea.scrollTop = 0;
          }
        }
      }
    }, 150);
  };

  // Read a File as base64 (without the data: URL prefix) for JSON transport.
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const sendMessage = async () => {
    try {
      // Find the business email object for the selected from address
      const selectedBusinessEmail = businessEmails.find(be => be.email === composeData.from);

      const attachments = await Promise.all(
        (composeData.attachments || []).map(async (file) => ({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          dataBase64: await fileToBase64(file)
        }))
      );

      const payload = {
        tenant_slug: TENANT_SLUG,
        from: composeData.from,
        businessEmailId: selectedBusinessEmail?.id || composeData.fromEmailId, // ✅ Pass business email ID
        to: composeData.to,
        cc: composeData.cc || undefined,
        bcc: composeData.bcc || undefined,
        subject: composeData.subject,
        text: composeData.body,
        html: composeData.body.replace(/\n/g, '<br/>'),
        priority: composeData.priority,
        schedule_at: composeData.scheduleAt,
        signature_id: composeData.signature,
        attachments,
        in_reply_to_id: replyMode && replyMode !== 'forward' ? composeData.originalMessageId : undefined
      };

      console.log('📤 Sending email with payload:', { 
        from: payload.from, 
        to: payload.to, 
        businessEmailId: payload.businessEmailId,
        subject: payload.subject 
      });

      const res = await fetch(`${API_BASE}/api/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(`Send failed: ${res.status} ${error}`);
      }

      const result = await res.json();
      console.log('✅ Email sent successfully:', result);

      // Success
      setIsComposing(false);
      setReplyMode(null);
      setComposeData({
        from: selectedBusinessEmail?.email || businessEmails[0]?.email || '',
        fromEmailId: selectedBusinessEmail?.id || businessEmails[0]?.id || null,
        to: '',
        cc: '',
        bcc: '',
        subject: '',
        body: '',
        signature: signatures.find(s => s.is_default)?.id || null,
        priority: 0,
        scheduleAt: null,
        attachments: []
      });

      // Show success message
      alert('Message sent successfully! ✅');
      
      // Refresh inbox
      fetchMessages({ reset: true });
    } catch (e) {
      console.error('❌ Send error:', e);
      alert(`Failed to send: ${e.message}`);
    }
  };

  const activeItem = useMemo(
    () => items.find(m => m.id === activeId) || null,
    [items, activeId]
  );

  return (
    <div className={clsx(
      // Not h-screen: this renders inside the normal page flow (site Header
      // above, site Footer below), not as a standalone full-viewport page.
      // h-screen with no overflow-hidden let the overflowing message list
      // visually spill past this box into the Footer below, since the
      // Footer's document position is based on this box's declared height,
      // not where the spilling content actually renders.
      "w-full transition-colors duration-200",
      isDarkMode
        ? "bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100"
        : "bg-gradient-to-b from-gray-50 via-white to-gray-50 text-gray-900"
    )}>
      {/* Top toolbar */}
      <header className={clsx(
        "sticky top-0 z-20 border-b backdrop-blur transition-colors",
        isDarkMode 
          ? "border-white/10 bg-white/5" 
          : "border-gray-200 bg-white/80"
      )}>
        <div className="mx-auto flex max-w-full items-center gap-3 px-4 py-3">
          {/* Logo/Title */}
          <div className="flex items-center gap-2">
            <div className={clsx(
              "text-sm rounded-full px-2 py-1 border",
              isDarkMode 
                ? "border-white/10 bg-white/5" 
                : "border-gray-200 bg-gray-50"
            )}>
              Advanced Inbox
            </div>
            <div className="text-sm font-medium">{TENANT_SLUG}</div>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className={clsx(
                "absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4",
                isDarkMode ? "text-slate-400" : "text-gray-500"
              )} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search emails..."
                className={clsx(
                  "w-full pl-10 pr-4 py-2 rounded-xl text-sm outline-none border transition-colors",
                  isDarkMode 
                    ? "bg-white/5 border-white/10 focus:border-white/20 placeholder-slate-400" 
                    : "bg-gray-50 border-gray-200 focus:border-gray-300 placeholder-gray-500"
                )}
              />
            </div>
          </div>

          {/* Toolbar actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={startCompose}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-indigo-500/20 border border-indigo-400/40 rounded-xl hover:bg-indigo-500/30 text-indigo-300"
            >
              <Plus className="w-4 h-4" />
              Compose
            </button>
            
            <button
              onClick={() => fetchMessages({ reset: true })}
              className={clsx(
                "p-2 rounded-xl border transition-colors",
                isDarkMode 
                  ? "border-white/10 bg-white/5 hover:bg-white/10" 
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              )}
              title="Refresh"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={clsx(
                "p-2 rounded-xl border hover:bg-opacity-10 transition-colors",
                isDarkMode 
                  ? "border-white/10 bg-white/5 hover:bg-white/10" 
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              )}
              title="Filters"
            >
              <Filter className="w-4 h-4" />
            </button>

            <button
              onClick={toggleTheme}
              className={clsx(
                "p-2 rounded-xl border hover:bg-opacity-10 transition-colors",
                isDarkMode 
                  ? "border-white/10 bg-white/5 hover:bg-white/10" 
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              )}
              title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => openSignatureBuilder()}
              className={clsx(
                "flex items-center gap-2 px-3 py-2 text-sm border rounded-xl transition-colors",
                isDarkMode 
                  ? "border-white/10 bg-white/5 hover:bg-white/10" 
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              )}
              title="Signature Builder"
            >
              <Edit3 className="w-4 h-4" />
              Signatures
            </button>

            <button
              className={clsx(
                "p-2 rounded-xl border hover:bg-opacity-10 transition-colors",
                isDarkMode 
                  ? "border-white/10 bg-white/5 hover:bg-white/10" 
                  : "border-gray-200 bg-gray-50 hover:bg-gray-100"
              )}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters bar */}
        {showFilters && (
          <div className={clsx(
            "border-t px-4 py-2",
            isDarkMode ? "border-white/10" : "border-gray-200"
          )}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={clsx(
                "text-xs",
                isDarkMode ? "text-slate-400" : "text-gray-500"
              )}>Filter:</span>
              {['inbox', 'unread', 'sent', 'archive'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setCurrentFilter(filter)}
                  className={clsx(
                    "px-2 py-1 text-xs rounded-lg capitalize transition-colors",
                    currentFilter === filter 
                      ? "bg-indigo-500/20 border border-indigo-400/40 text-indigo-300"
                      : isDarkMode 
                        ? "bg-white/5 border border-white/10 hover:bg-white/10"
                        : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                  )}
                >
                  {filter}
                </button>
              ))}
              
              <div className="ml-4 flex items-center gap-2">
                <span className={clsx(
                  "text-xs",
                  isDarkMode ? "text-slate-400" : "text-gray-500"
                )}>Sort:</span>
                <select
                  value={`${sortBy}:${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split(':');
                    setSortBy(field);
                    setSortOrder(order);
                  }}
                  className={clsx(
                    "text-xs border rounded px-2 py-1 transition-colors",
                    isDarkMode 
                      ? "bg-white/5 border-white/10" 
                      : "bg-gray-50 border-gray-200"
                  )}
                >
                  <option value="date:desc">Newest first</option>
                  <option value="date:asc">Oldest first</option>
                  <option value="from:asc">Sender A-Z</option>
                  <option value="subject:asc">Subject A-Z</option>
                  <option value="priority:desc">Priority</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main layout */}
      {/* Not min-h/max-h off 100vh — this screen renders inside the normal page
          flow (site Header above, site Footer below), not as a standalone
          full-viewport page, so sizing off 100vh overflowed past the page's
          real footer. Fixed height keeps the internal lists' overflow-auto
          scrolling contained instead. */}
      {/* overflow-hidden here + min-h-0 on the scrollable children below: flex
          children default to min-height:auto, which lets their natural content
          size override a bounded flex parent's height — the overflow-auto on
          the list/detail panes below was silently defeated by this, so a long
          list grew past its box instead of scrolling inside it (only visible
          with enough items to exceed the box — hence it never reproduced with
          a short local list). */}
      <div className="flex h-[720px] max-h-[75vh] overflow-hidden">
        {/* Sidebar */}
        <div className={clsx(
          "w-64 border-r p-4",
          isDarkMode 
            ? "border-white/10 bg-white/5" 
            : "border-gray-200 bg-gray-50"
        )}>
          <div className="space-y-2">
            <div className={clsx(
              "text-xs font-semibold uppercase tracking-wide mb-2",
              isDarkMode ? "text-slate-400" : "text-gray-500"
            )}>
              Folders
            </div>
            {['inbox', 'sent', 'drafts', 'archive', 'spam', 'trash'].map(folder => (
              <button
                key={folder}
                onClick={() => setCurrentFilter(folder)}
                className={clsx(
                  "w-full text-left px-3 py-2 text-sm rounded-lg capitalize flex items-center gap-2 transition-colors",
                  currentFilter === folder 
                    ? "bg-indigo-500/20 text-indigo-300"
                    : isDarkMode 
                      ? "hover:bg-white/5"
                      : "hover:bg-gray-100"
                )}
              >
                {folder === 'inbox' && '📥'}
                {folder === 'sent' && '📤'}
                {folder === 'drafts' && '📝'}
                {folder === 'archive' && '📦'}
                {folder === 'spam' && '🚫'}
                {folder === 'trash' && '🗑️'}
                {folder}
              </button>
            ))}
            
            {labels.length > 0 && (
              <>
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 mt-4">
                  Labels
                </div>
                {labels.filter(l => !l.is_system).map(label => (
                  <button
                    key={label.id}
                    onClick={() => setCurrentFilter(`label:${label.name}`)}
                    className={clsx(
                      "w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-2",
                      currentFilter === `label:${label.name}` 
                        ? "bg-indigo-500/20 text-indigo-300"
                        : "hover:bg-white/5"
                    )}
                  >
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: label.color }}
                    />
                    {label.name}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Email list */}
        <div className="flex-1 flex min-h-0">
          <div className={clsx(
            // Was a plain block div — the inner list's flex-1/min-h-0/overflow-auto
            // had no effect at all without a flex column parent to size against,
            // which is why the list never actually became scrollable.
            "w-96 border-r flex flex-col min-h-0",
            isDarkMode
              ? "border-white/10 bg-white/5"
              : "border-gray-200 bg-gray-50"
          )}>
            {/* Bulk actions */}
            {selectedItems.size > 0 && (
              <div className={clsx(
                "border-b px-4 py-2 bg-indigo-500/10",
                isDarkMode ? "border-white/10" : "border-gray-200"
              )}>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{selectedItems.size} selected</span>
                  <button
                    onClick={() => markAsRead([...selectedItems])}
                    className="p-1 rounded hover:bg-white/10"
                    title="Mark as read"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => archiveMessages([...selectedItems])}
                    className="p-1 rounded hover:bg-white/10"
                    title="Archive"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteMessages([...selectedItems])}
                    className="p-1 rounded hover:bg-white/10"
                    title="Delete"  
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedItems(new Set())}
                    className="ml-auto p-1 rounded hover:bg-white/10"
                    title="Clear selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Message list */}
            <style>{`
              .inbox-message-list::-webkit-scrollbar { width: 8px; }
              .inbox-message-list::-webkit-scrollbar-track { background: transparent; }
              .inbox-message-list::-webkit-scrollbar-thumb {
                background: ${isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'};
                border-radius: 4px;
              }
              .inbox-message-list::-webkit-scrollbar-thumb:hover {
                background: ${isDarkMode ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'};
              }
              .inbox-message-list {
                scrollbar-width: thin;
                scrollbar-color: ${isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} transparent;
              }
            `}</style>
            <div ref={listRef} className="inbox-message-list flex-1 min-h-0 overflow-auto">
              {items.map((message, idx) => (
                <div
                  key={`${message.id}-${idx}`}
                  className={clsx(
                    "border-b cursor-pointer transition-colors",
                    isDarkMode 
                      ? "border-white/5 hover:bg-white/5" 
                      : "border-gray-100 hover:bg-gray-50",
                    activeId === message.id && (isDarkMode ? "bg-white/10" : "bg-gray-100"),
                    selectedItems.has(message.id) && "bg-indigo-500/10"
                  )}
                >
                  <div 
                    className="p-4"
                    onClick={() => setActiveId(message.id)}
                    onDoubleClick={() => openEmailPopup(message)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Selection checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedItems.has(message.id)}
                        onChange={() => toggleSelection(message.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 rounded"
                      />
                      
                      {/* Message content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={clsx(
                            "font-medium truncate",
                            !message.is_read && "font-bold"
                          )}>
                            {message.from_name || message.from_address || message.from || "Unknown"}
                          </div>
                          
                          <div className="flex items-center gap-1 ml-auto">
                            {message.priority > 1 && <Flag className="w-3 h-3 text-red-400" />}
                            {Array.isArray(message.attachments) && message.attachments.length > 0 && <Paperclip className={clsx(
                              "w-3 h-3",
                              isDarkMode ? "text-slate-400" : "text-gray-500"
                            )} />}
                            <div className={clsx(
                              "text-xs",
                              isDarkMode ? "text-slate-400" : "text-gray-500"
                            )}>
                              {timeAgo(message.created_at || message.date)}
                            </div>
                          </div>
                        </div>
                        
                        <div className={clsx(
                          "text-sm mb-1 truncate",
                          !message.is_read 
                            ? "font-semibold" 
                            : isDarkMode 
                              ? "text-slate-300" 
                              : "text-gray-600"
                        )}>
                          {message.subject || "(no subject)"}
                        </div>
                        
                        <div className="text-xs text-slate-400 truncate">
                          {message.snippet || message.preview || ""}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="px-4 py-3 text-sm text-slate-400">Loading...</div>
              )}
              {error && (
                <div className="px-4 py-3 text-sm text-rose-300">Error: {error}</div>
              )}
              {!loading && !items.length && !error && (
                <div className="px-4 py-6 text-sm text-slate-400">No messages found.</div>
              )}
            </div>
          </div>

          {/* Message detail pane */}
          <div className="flex-1 flex flex-col min-h-0">
            {!activeItem ? (
              <div className={clsx(
                "flex-1 flex items-center justify-center",
                isDarkMode ? "text-slate-400" : "text-gray-500"
              )}>
                Select a message to view
              </div>
            ) : (
              <>
                {/* Message header */}
                <div className={clsx(
                  "border-b p-4",
                  isDarkMode 
                    ? "border-white/10 bg-white/5" 
                    : "border-gray-200 bg-gray-50"
                )}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="text-lg font-semibold mb-1">
                        {detail?.subject || activeItem.subject || "(no subject)"}
                      </div>
                      <div className={clsx(
                        "text-sm space-y-1",
                        isDarkMode ? "text-slate-300" : "text-gray-700"
                      )}>
                        <div>
                          <span className={isDarkMode ? "text-slate-400" : "text-gray-500"}>From:</span>{" "}
                          {detail?.from?.[0]?.name || detail?.from?.[0]?.address || activeItem.from_address}
                        </div>
                        <div>
                          <span className={isDarkMode ? "text-slate-400" : "text-gray-500"}>To:</span>{" "}
                          {detail?.to?.map(t => t.address).join(", ") || activeItem.to_address}
                        </div>
                        <div>
                          <span className={isDarkMode ? "text-slate-400" : "text-gray-500"}>Date:</span>{" "}
                          {new Date(activeItem.created_at || activeItem.date).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    
                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startReply('reply')}
                        className={clsx(
                          "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl border transition-colors",
                          isDarkMode
                            ? "border-white/10 bg-white/5 hover:bg-white/10"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                        )}
                        title="Reply (R)"
                      >
                        <Reply className="w-4 h-4" />
                        <span className="text-[9px] leading-none">Reply</span>
                      </button>
                      <button
                        onClick={() => startReply('reply-all')}
                        className={clsx(
                          "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl border transition-colors",
                          isDarkMode
                            ? "border-white/10 bg-white/5 hover:bg-white/10"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                        )}
                        title="Reply All (A)"
                      >
                        <ReplyAll className="w-4 h-4" />
                        <span className="text-[9px] leading-none">Reply All</span>
                      </button>
                      <button
                        onClick={() => startReply('forward')}
                        className={clsx(
                          "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl border transition-colors",
                          isDarkMode
                            ? "border-white/10 bg-white/5 hover:bg-white/10"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                        )}
                        title="Forward (F)"
                      >
                        <Forward className="w-4 h-4" />
                        <span className="text-[9px] leading-none">Forward</span>
                      </button>
                      <button
                        onClick={() => archiveMessages([activeId])}
                        className={clsx(
                          "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl border transition-colors",
                          isDarkMode
                            ? "border-white/10 bg-white/5 hover:bg-white/10"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                        )}
                        title="Archive (E)"
                      >
                        <Archive className="w-4 h-4" />
                        <span className="text-[9px] leading-none">Archive</span>
                      </button>
                      <button
                        onClick={() => deleteMessages([activeId])}
                        className={clsx(
                          "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl border transition-colors",
                          isDarkMode
                            ? "border-white/10 bg-white/5 hover:bg-white/10"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                        )}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-[9px] leading-none">Delete</span>
                      </button>
                      <button
                        title="More options"
                        className={clsx(
                          "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl border transition-colors",
                          isDarkMode
                            ? "border-white/10 bg-white/5 hover:bg-white/10"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                        )}>
                        <MoreHorizontal className="w-4 h-4" />
                        <span className="text-[9px] leading-none">More</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Message body */}
                <div className="flex-1 min-h-0 overflow-auto p-4">
                  {detailLoading ? (
                    <div className={clsx(
                      "text-sm",
                      isDarkMode ? "text-slate-400" : "text-gray-500"
                    )}>Loading message...</div>
                  ) : detail?.error ? (
                    <div className={clsx(
                      "text-sm",
                      isDarkMode ? "text-rose-300" : "text-red-600"
                    )}>Error: {detail.error}</div>
                  ) : (
                    <>
                      <MessageBody html={detail?.html} text={detail?.text} isDarkMode={isDarkMode} />
                      {Array.isArray(detail?.attachments) && detail.attachments.length > 0 && (
                        <div className={clsx(
                          "mt-4 pt-4 border-t space-y-2",
                          isDarkMode ? "border-white/10" : "border-gray-200"
                        )}>
                          <div className={clsx(
                            "text-xs font-semibold uppercase tracking-wide",
                            isDarkMode ? "text-slate-400" : "text-gray-500"
                          )}>
                            {detail.attachments.length} Attachment{detail.attachments.length > 1 ? 's' : ''}
                          </div>
                          {detail.attachments.map((att, idx) => (
                            <a
                              key={idx}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              download={att.filename}
                              className={clsx(
                                "flex items-center gap-2 text-sm px-3 py-2 rounded-lg border w-fit transition-colors",
                                isDarkMode
                                  ? "border-white/10 bg-white/5 hover:bg-white/10"
                                  : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                              )}
                            >
                              <Paperclip className="w-4 h-4 shrink-0" />
                              <span className="truncate max-w-[240px]">{att.filename}</span>
                              {att.size != null && (
                                <span className={isDarkMode ? "text-slate-500" : "text-gray-400"}>
                                  {(att.size / 1024).toFixed(0)}KB
                                </span>
                              )}
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Compose modal */}
      {isComposing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div 
            ref={composeRef}
            className={clsx(
              "border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden",
              isDarkMode 
                ? "bg-slate-900 border-white/10" 
                : "bg-white border-gray-200"
            )}
          >
            {/* Compose header */}
            <div className={clsx(
              "border-b p-4 flex items-center justify-between",
              isDarkMode ? "border-white/10" : "border-gray-200"
            )}>
              <div className="font-semibold">
                {replyMode === 'reply' && 'Reply'}
                {replyMode === 'reply-all' && 'Reply All'}
                {replyMode === 'forward' && 'Forward'}
                {!replyMode && 'New Message'}
              </div>
              <button
                onClick={() => setIsComposing(false)}
                className={clsx(
                  "p-1 rounded transition-colors",
                  isDarkMode ? "hover:bg-white/10" : "hover:bg-gray-100"
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Compose form */}
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                <label className={clsx(
                  "text-sm",
                  isDarkMode ? "text-slate-400" : "text-gray-600"
                )}>From:</label>
                <select
                  value={composeData.from || ''}
                  onChange={(e) => {
                    const newFrom = e.target.value;
                    const selected = businessEmails.find(be => be.email === newFrom);
                    setComposeData(prev => ({ 
                      ...prev, 
                      from: newFrom,
                      fromEmailId: selected ? selected.id || null : null
                    }));
                  }}
                  className={clsx(
                    "border rounded px-3 py-2 text-sm transition-colors",
                    isDarkMode 
                      ? "bg-white/5 border-white/10 focus:border-white/20 text-white" 
                      : "bg-gray-50 border-gray-200 focus:border-gray-300 text-black"
                  )}
                  style={{ color: isDarkMode ? 'white' : 'black' }}
                >
                  {businessEmails.length === 0 ? (
                    <option value="" style={{ color: isDarkMode ? 'white' : 'black' }}>No business emails available</option>
                  ) : (
                    businessEmails.map(email => (
                      <option key={email.id} value={email.email} style={{ color: 'black' }}>{email.email}</option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                <label className={clsx(
                  "text-sm",
                  isDarkMode ? "text-slate-400" : "text-gray-600"
                )}>To:</label>
                <input
                  type="email"
                  value={composeData.to}
                  onChange={(e) => setComposeData(prev => ({ ...prev, to: e.target.value }))}
                  className={clsx(
                    "border rounded px-3 py-2 text-sm transition-colors",
                    isDarkMode 
                      ? "bg-white/5 border-white/10 focus:border-white/20" 
                      : "bg-gray-50 border-gray-200 focus:border-gray-300"
                  )}
                  placeholder="recipient@example.com"
                />
              </div>

              <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                <label className={clsx(
                  "text-sm",
                  isDarkMode ? "text-slate-400" : "text-gray-600"
                )}>CC:</label>
                <input
                  type="email"
                  value={composeData.cc}
                  onChange={(e) => setComposeData(prev => ({ ...prev, cc: e.target.value }))}
                  className={clsx(
                    "border rounded px-3 py-2 text-sm transition-colors",
                    isDarkMode 
                      ? "bg-white/5 border-white/10 focus:border-white/20" 
                      : "bg-gray-50 border-gray-200 focus:border-gray-300"
                  )}
                  placeholder="cc@example.com"
                />
              </div>

              <div className="grid grid-cols-[80px_1fr] gap-2 items-center">
                <label className={clsx(
                  "text-sm",
                  isDarkMode ? "text-slate-400" : "text-gray-600"
                )}>Subject:</label>
                <input
                  type="text"
                  value={composeData.subject}
                  onChange={(e) => setComposeData(prev => ({ ...prev, subject: e.target.value }))}
                  className={clsx(
                    "border rounded px-3 py-2 text-sm transition-colors",
                    isDarkMode 
                      ? "bg-white/5 border-white/10 focus:border-white/20" 
                      : "bg-gray-50 border-gray-200 focus:border-gray-300"
                  )}
                  placeholder="Subject"
                />
              </div>

              <div className="space-y-2">
                <label className={clsx(
                  "text-sm",
                  isDarkMode ? "text-slate-400" : "text-gray-600"
                )}>Message:</label>
                <textarea
                  value={composeData.body}
                  onChange={(e) => setComposeData(prev => ({ ...prev, body: e.target.value }))}
                  className={clsx(
                    "w-full h-64 border rounded px-3 py-2 text-sm resize-none transition-colors",
                    isDarkMode 
                      ? "bg-white/5 border-white/10 focus:border-white/20" 
                      : "bg-gray-50 border-gray-200 focus:border-gray-300"
                  )}
                  placeholder="Write your message..."
                />
              </div>

              <div className="space-y-2">
                <label className={clsx(
                  "text-sm flex items-center gap-2 cursor-pointer w-fit",
                  isDarkMode ? "text-slate-400 hover:text-slate-200" : "text-gray-600 hover:text-gray-900"
                )}>
                  <Paperclip className="w-4 h-4" />
                  Attach files
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const newFiles = Array.from(e.target.files || []);
                      setComposeData(prev => ({ ...prev, attachments: [...(prev.attachments || []), ...newFiles] }));
                      e.target.value = '';
                    }}
                  />
                </label>
                {composeData.attachments && composeData.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {composeData.attachments.map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        className={clsx(
                          "flex items-center gap-2 text-xs px-2 py-1 rounded-lg border",
                          isDarkMode ? "border-white/10 bg-white/5" : "border-gray-200 bg-gray-50"
                        )}
                      >
                        <span className="truncate max-w-[160px]">{file.name}</span>
                        <span className={isDarkMode ? "text-slate-500" : "text-gray-400"}>
                          {(file.size / 1024).toFixed(0)}KB
                        </span>
                        <button
                          type="button"
                          onClick={() => setComposeData(prev => ({
                            ...prev,
                            attachments: prev.attachments.filter((_, i) => i !== idx)
                          }))}
                          className="hover:text-red-400"
                          title="Remove"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Compose actions */}
              <div className={clsx(
                "flex items-center justify-between pt-4 border-t",
                isDarkMode ? "border-white/10" : "border-gray-200"
              )}>
                <div className="flex items-center gap-4">
                  <select
                    value={composeData.priority}
                    onChange={(e) => setComposeData(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                    className={clsx(
                      "text-sm border rounded px-2 py-1 transition-colors",
                      isDarkMode 
                        ? "bg-white/5 border-white/10" 
                        : "bg-gray-50 border-gray-200"
                    )}
                  >
                    <option value={0}>Normal priority</option>
                    <option value={1}>Low priority</option>
                    <option value={2}>High priority</option>
                    <option value={3}>Urgent</option>
                  </select>

                  <select
                    value={composeData.signature || ''}
                    onChange={(e) => setComposeData(prev => ({ ...prev, signature: e.target.value || null }))}
                    className={clsx(
                      "text-sm border rounded px-2 py-1 transition-colors",
                      isDarkMode 
                        ? "bg-white/5 border-white/10" 
                        : "bg-gray-50 border-gray-200"
                    )}
                  >
                    <option value="">No signature</option>
                    {signatures.map(sig => (
                      <option key={sig.id} value={sig.id}>{sig.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  {(() => {
                    const missing = [
                      !composeData.from && 'From',
                      !composeData.to && 'To',
                      !composeData.subject && 'Subject'
                    ].filter(Boolean);
                    if (missing.length === 0) return null;
                    return (
                      <span className={clsx("text-xs", isDarkMode ? "text-amber-400" : "text-amber-600")}>
                        Missing: {missing.join(', ')}
                      </span>
                    );
                  })()}
                  <button
                    onClick={() => setIsComposing(false)}
                    className={clsx(
                      "px-4 py-2 text-sm border rounded-xl transition-colors",
                      isDarkMode
                        ? "border-white/10 hover:bg-white/5"
                        : "border-gray-200 hover:bg-gray-50"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendMessage}
                    disabled={!composeData.from || !composeData.to || !composeData.subject}
                    className="px-4 py-2 text-sm bg-indigo-500 border border-indigo-400 rounded-xl hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-white"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signature Builder Modal */}
      {showSignatureBuilder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeSignatureBuilder}
          />
          
          {/* Modal */}
          <div className={clsx(
            "relative w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden",
            isDarkMode 
              ? "bg-slate-900 border border-white/10"
              : "bg-white border border-gray-200"
          )}>
            {/* Header */}
            <div className={clsx(
              "flex items-center justify-between px-6 py-4 border-b",
              isDarkMode ? "border-white/10" : "border-gray-200"
            )}>
              <div className="flex items-center gap-3">
                <Edit3 className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-semibold">
                  {currentSignature.id ? 'Edit Signature' : 'Create Signature'}
                </h2>
              </div>
              
              <button
                onClick={closeSignatureBuilder}
                className={clsx(
                  "p-2 rounded-lg transition-colors",
                  isDarkMode 
                    ? "hover:bg-white/10 text-slate-300" 
                    : "hover:bg-gray-100 text-gray-600"
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex h-[calc(90vh-120px)]">
              {/* Left Panel - Form */}
              <div className="w-1/2 overflow-y-auto p-6 space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-md font-semibold flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Basic Information
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={clsx(
                        "block text-sm font-medium mb-1",
                        isDarkMode ? "text-slate-300" : "text-gray-700"
                      )}>
                        Signature Name
                      </label>
                      <input
                        type="text"
                        value={currentSignature.name}
                        onChange={(e) => setCurrentSignature(prev => ({ ...prev, name: e.target.value }))}
                        className={clsx(
                          "w-full px-3 py-2 border rounded-lg text-sm transition-colors",
                          isDarkMode 
                            ? "bg-white/5 border-white/10 focus:border-white/20" 
                            : "bg-gray-50 border-gray-200 focus:border-gray-300"
                        )}
                        placeholder="e.g., Work Signature"
                      />
                    </div>
                    
                    <div>
                      <label className={clsx(
                        "block text-sm font-medium mb-1",
                        isDarkMode ? "text-slate-300" : "text-gray-700"
                      )}>
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={currentSignature.fullName}
                        onChange={(e) => setCurrentSignature(prev => ({ ...prev, fullName: e.target.value }))}
                        className={clsx(
                          "w-full px-3 py-2 border rounded-lg text-sm transition-colors",
                          isDarkMode 
                            ? "bg-white/5 border-white/10 focus:border-white/20" 
                            : "bg-gray-50 border-gray-200 focus:border-gray-300"
                        )}
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={clsx(
                        "block text-sm font-medium mb-1",
                        isDarkMode ? "text-slate-300" : "text-gray-700"
                      )}>
                        Job Title
                      </label>
                      <input
                        type="text"
                        value={currentSignature.title}
                        onChange={(e) => setCurrentSignature(prev => ({ ...prev, title: e.target.value }))}
                        className={clsx(
                          "w-full px-3 py-2 border rounded-lg text-sm transition-colors",
                          isDarkMode 
                            ? "bg-white/5 border-white/10 focus:border-white/20" 
                            : "bg-gray-50 border-gray-200 focus:border-gray-300"
                        )}
                        placeholder="Senior Developer"
                      />
                    </div>
                    
                    <div>
                      <label className={clsx(
                        "block text-sm font-medium mb-1",
                        isDarkMode ? "text-slate-300" : "text-gray-700"
                      )}>
                        Company
                      </label>
                      <input
                        type="text"
                        value={currentSignature.company}
                        onChange={(e) => setCurrentSignature(prev => ({ ...prev, company: e.target.value }))}
                        className={clsx(
                          "w-full px-3 py-2 border rounded-lg text-sm transition-colors",
                          isDarkMode 
                            ? "bg-white/5 border-white/10 focus:border-white/20" 
                            : "bg-gray-50 border-gray-200 focus:border-gray-300"
                        )}
                        placeholder="Fotonix Ltd"
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-4">
                  <h3 className="text-md font-semibold flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Contact Information
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={clsx(
                        "block text-sm font-medium mb-1",
                        isDarkMode ? "text-slate-300" : "text-gray-700"
                      )}>
                        Email
                      </label>
                      <input
                        type="email"
                        value={currentSignature.email}
                        onChange={(e) => setCurrentSignature(prev => ({ ...prev, email: e.target.value }))}
                        className={clsx(
                          "w-full px-3 py-2 border rounded-lg text-sm transition-colors",
                          isDarkMode 
                            ? "bg-white/5 border-white/10 focus:border-white/20" 
                            : "bg-gray-50 border-gray-200 focus:border-gray-300"
                        )}
                        placeholder="john@fotonix.co.uk"
                      />
                    </div>
                    
                    <div>
                      <label className={clsx(
                        "block text-sm font-medium mb-1",
                        isDarkMode ? "text-slate-300" : "text-gray-700"
                      )}>
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={currentSignature.phone}
                        onChange={(e) => setCurrentSignature(prev => ({ ...prev, phone: e.target.value }))}
                        className={clsx(
                          "w-full px-3 py-2 border rounded-lg text-sm transition-colors",
                          isDarkMode 
                            ? "bg-white/5 border-white/10 focus:border-white/20" 
                            : "bg-gray-50 border-gray-200 focus:border-gray-300"
                        )}
                        placeholder="+44 20 1234 5678"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={clsx(
                        "block text-sm font-medium mb-1",
                        isDarkMode ? "text-slate-300" : "text-gray-700"
                      )}>
                        Website
                      </label>
                      <input
                        type="url"
                        value={currentSignature.website}
                        onChange={(e) => setCurrentSignature(prev => ({ ...prev, website: e.target.value }))}
                        className={clsx(
                          "w-full px-3 py-2 border rounded-lg text-sm transition-colors",
                          isDarkMode 
                            ? "bg-white/5 border-white/10 focus:border-white/20" 
                            : "bg-gray-50 border-gray-200 focus:border-gray-300"
                        )}
                        placeholder="https://fotonix.co.uk"
                      />
                    </div>
                    
                    <div>
                      <label className={clsx(
                        "block text-sm font-medium mb-1",
                        isDarkMode ? "text-slate-300" : "text-gray-700"
                      )}>
                        Profile Image
                      </label>
                      
                      {/* Hidden file input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      
                      {/* Image preview or upload area */}
                      <div className={clsx(
                        "border rounded-lg p-3 transition-colors",
                        isDarkMode 
                          ? "border-white/10 bg-white/5" 
                          : "border-gray-200 bg-gray-50"
                      )}>
                        {currentSignature.profileImage ? (
                          <div className="flex items-center gap-3">
                            <img 
                              src={currentSignature.profileImage} 
                              alt="Profile preview" 
                              className="w-12 h-12 rounded-full object-cover border-2 border-indigo-400"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium">Profile image uploaded</p>
                              <p className={clsx(
                                "text-xs",
                                isDarkMode ? "text-slate-400" : "text-gray-500"
                              )}>
                                Click to change or remove
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={imageUploading}
                                className={clsx(
                                  "p-2 rounded-lg border transition-colors",
                                  isDarkMode 
                                    ? "border-white/10 hover:bg-white/10" 
                                    : "border-gray-200 hover:bg-gray-100",
                                  imageUploading && "opacity-50 cursor-not-allowed"
                                )}
                                title="Change image"
                              >
                                <Camera className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={removeProfileImage}
                                disabled={imageUploading}
                                className={clsx(
                                  "p-2 rounded-lg border transition-colors text-red-500",
                                  isDarkMode 
                                    ? "border-white/10 hover:bg-red-500/10" 
                                    : "border-gray-200 hover:bg-red-50",
                                  imageUploading && "opacity-50 cursor-not-allowed"
                                )}
                                title="Remove image"
                              >
                                <Trash className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={imageUploading}
                            className={clsx(
                              "w-full flex flex-col items-center justify-center py-6 border-2 border-dashed rounded-lg transition-colors",
                              isDarkMode 
                                ? "border-white/20 hover:border-white/30 hover:bg-white/5" 
                                : "border-gray-300 hover:border-gray-400 hover:bg-gray-100",
                              imageUploading && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            {imageUploading ? (
                              <>
                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-400 border-t-transparent mb-2"></div>
                                <p className="text-sm">Uploading...</p>
                              </>
                            ) : (
                              <>
                                <Upload className="w-8 h-8 mb-2 text-indigo-400" />
                                <p className="text-sm font-medium">Upload Profile Image</p>
                                <p className={clsx(
                                  "text-xs mt-1",
                                  isDarkMode ? "text-slate-400" : "text-gray-500"
                                )}>
                                  PNG, JPG up to 2MB
                                </p>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className={clsx(
                      "block text-sm font-medium mb-1",
                      isDarkMode ? "text-slate-300" : "text-gray-700"
                    )}>
                      Address
                    </label>
                    <textarea
                      value={currentSignature.address}
                      onChange={(e) => setCurrentSignature(prev => ({ ...prev, address: e.target.value }))}
                      className={clsx(
                        "w-full px-3 py-2 border rounded-lg text-sm transition-colors h-20 resize-none",
                        isDarkMode 
                          ? "bg-white/5 border-white/10 focus:border-white/20" 
                          : "bg-gray-50 border-gray-200 focus:border-gray-300"
                      )}
                      placeholder="Shropshire Gardens, St Helens, England"
                    />
                  </div>
                </div>

                {/* Social Links */}
                <div className="space-y-4">
                  <h3 className="text-md font-semibold flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Social Links
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={clsx(
                        "block text-sm font-medium mb-1",
                        isDarkMode ? "text-slate-300" : "text-gray-700"
                      )}>
                        LinkedIn
                      </label>
                      <input
                        type="url"
                        value={currentSignature.socialLinks.linkedin}
                        onChange={(e) => setCurrentSignature(prev => ({ 
                          ...prev, 
                          socialLinks: { ...prev.socialLinks, linkedin: e.target.value }
                        }))}
                        className={clsx(
                          "w-full px-3 py-2 border rounded-lg text-sm transition-colors",
                          isDarkMode 
                            ? "bg-white/5 border-white/10 focus:border-white/20" 
                            : "bg-gray-50 border-gray-200 focus:border-gray-300"
                        )}
                        placeholder="https://linkedin.com/in/johndoe"
                      />
                    </div>
                    
                    <div>
                      <label className={clsx(
                        "block text-sm font-medium mb-1",
                        isDarkMode ? "text-slate-300" : "text-gray-700"
                      )}>
                        Twitter
                      </label>
                      <input
                        type="url"
                        value={currentSignature.socialLinks.twitter}
                        onChange={(e) => setCurrentSignature(prev => ({ 
                          ...prev, 
                          socialLinks: { ...prev.socialLinks, twitter: e.target.value }
                        }))}
                        className={clsx(
                          "w-full px-3 py-2 border rounded-lg text-sm transition-colors",
                          isDarkMode 
                            ? "bg-white/5 border-white/10 focus:border-white/20" 
                            : "bg-gray-50 border-gray-200 focus:border-gray-300"
                        )}
                        placeholder="https://twitter.com/johndoe"
                      />
                    </div>
                  </div>
                </div>

                {/* Styling Options */}
                <div className="space-y-4">
                  <h3 className="text-md font-semibold flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Styling
                  </h3>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className={clsx(
                        "block text-sm font-medium mb-1",
                        isDarkMode ? "text-slate-300" : "text-gray-700"
                      )}>
                        Font Family
                      </label>
                      <select
                        value={currentSignature.styling.fontFamily}
                        onChange={(e) => setCurrentSignature(prev => ({ 
                          ...prev, 
                          styling: { ...prev.styling, fontFamily: e.target.value }
                        }))}
                        className={clsx(
                          "w-full px-3 py-2 border rounded-lg text-sm transition-colors",
                          isDarkMode 
                            ? "bg-white/5 border-white/10 focus:border-white/20" 
                            : "bg-gray-50 border-gray-200 focus:border-gray-300"
                        )}
                      >
                        <option value="Arial, sans-serif">Arial</option>
                        <option value="Helvetica, sans-serif">Helvetica</option>
                        <option value="Georgia, serif">Georgia</option>
                        <option value="Times New Roman, serif">Times New Roman</option>
                        <option value="Verdana, sans-serif">Verdana</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className={clsx(
                        "block text-sm font-medium mb-1",
                        isDarkMode ? "text-slate-300" : "text-gray-700"
                      )}>
                        Font Size
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="24"
                        value={currentSignature.styling.fontSize}
                        onChange={(e) => setCurrentSignature(prev => ({ 
                          ...prev, 
                          styling: { ...prev.styling, fontSize: parseInt(e.target.value) }
                        }))}
                        className={clsx(
                          "w-full px-3 py-2 border rounded-lg text-sm transition-colors",
                          isDarkMode 
                            ? "bg-white/5 border-white/10 focus:border-white/20" 
                            : "bg-gray-50 border-gray-200 focus:border-gray-300"
                        )}
                      />
                    </div>
                    
                    <div>
                      <label className={clsx(
                        "block text-sm font-medium mb-1",
                        isDarkMode ? "text-slate-300" : "text-gray-700"
                      )}>
                        Layout
                      </label>
                      <select
                        value={currentSignature.layout}
                        onChange={(e) => setCurrentSignature(prev => ({ ...prev, layout: e.target.value }))}
                        className={clsx(
                          "w-full px-3 py-2 border rounded-lg text-sm transition-colors",
                          isDarkMode 
                            ? "bg-white/5 border-white/10 focus:border-white/20" 
                            : "bg-gray-50 border-gray-200 focus:border-gray-300"
                        )}
                      >
                        <option value="modern">Modern</option>
                        <option value="classic">Classic</option>
                        <option value="minimal">Minimal</option>
                        <option value="creative">Creative</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={clsx(
                        "block text-sm font-medium mb-1",
                        isDarkMode ? "text-slate-300" : "text-gray-700"
                      )}>
                        Text Color
                      </label>
                      <input
                        type="color"
                        value={currentSignature.styling.textColor}
                        onChange={(e) => setCurrentSignature(prev => ({ 
                          ...prev, 
                          styling: { ...prev.styling, textColor: e.target.value }
                        }))}
                        className="w-full h-10 border rounded-lg"
                      />
                    </div>
                    
                    <div>
                      <label className={clsx(
                        "block text-sm font-medium mb-1",
                        isDarkMode ? "text-slate-300" : "text-gray-700"
                      )}>
                        Link Color
                      </label>
                      <input
                        type="color"
                        value={currentSignature.styling.linkColor}
                        onChange={(e) => setCurrentSignature(prev => ({ 
                          ...prev, 
                          styling: { ...prev.styling, linkColor: e.target.value }
                        }))}
                        className="w-full h-10 border rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={currentSignature.includeDisclaimer}
                        onChange={(e) => setCurrentSignature(prev => ({ 
                          ...prev, 
                          includeDisclaimer: e.target.checked 
                        }))}
                      />
                      Include disclaimer
                    </label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={closeSignatureBuilder}
                      className={clsx(
                        "px-4 py-2 text-sm border rounded-xl transition-colors",
                        isDarkMode 
                          ? "border-white/10 hover:bg-white/5" 
                          : "border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveSignature}
                      className="px-4 py-2 text-sm bg-indigo-500 border border-indigo-400 rounded-xl hover:bg-indigo-600 text-white flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save Signature
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Panel - Preview */}
              <div className={clsx(
                "w-1/2 border-l p-6",
                isDarkMode ? "border-white/10" : "border-gray-200"
              )}>
                <h3 className="text-md font-semibold mb-4">Preview</h3>
                <div className={clsx(
                  "border rounded-lg p-4 min-h-[400px]",
                  isDarkMode ? "border-white/10 bg-white/5" : "border-gray-200 bg-gray-50"
                )}>
                  <SignaturePreview signature={currentSignature} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Popup Modal */}
      {emailPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeEmailPopup}
          />
          
          {/* Modal */}
          <div className={clsx(
            "relative w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden",
            isDarkMode 
              ? "bg-slate-900 border border-white/10"
              : "bg-white border border-gray-200"
          )}>
            {/* Header */}
            <div className={clsx(
              "flex items-center justify-between px-6 py-4 border-b",
              isDarkMode ? "border-white/10" : "border-gray-200"
            )}>
              <div className="flex items-center gap-3">
                <ExternalLink className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-semibold">
                  {emailPopup.loading ? "Loading..." : emailPopup.subject || "No Subject"}
                </h2>
              </div>
              
              <div className="flex items-center gap-2">
                {!emailPopup.loading && (
                  <>
                    <button
                      onClick={() => {
                        setReplyMode('reply');
                        setComposeData(prev => ({
                          ...prev,
                          to: emailPopup.from_address,
                          subject: emailPopup.subject?.startsWith('Re:') ? emailPopup.subject : `Re: ${emailPopup.subject || ''}`,
                          body: `\n\n--- Reply to message from ${emailPopup.from_address} ---\n${emailPopup.text || ''}`
                        }));
                        setIsComposing(true);
                        closeEmailPopup();
                      }}
                      className={clsx(
                        "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
                        isDarkMode 
                          ? "hover:bg-white/10 text-slate-300" 
                          : "hover:bg-gray-100 text-gray-600"
                      )}
                      title="Reply"
                    >
                      <Reply className="w-4 h-4" />
                      <span className="text-xs">Reply</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setReplyMode('forward');
                        setComposeData(prev => ({
                          ...prev,
                          to: '',
                          subject: emailPopup.subject?.startsWith('Fwd:') ? emailPopup.subject : `Fwd: ${emailPopup.subject || ''}`,
                          body: `\n\n--- Forwarded message ---\nFrom: ${emailPopup.from_address}\nDate: ${new Date(emailPopup.created_at).toLocaleString()}\nSubject: ${emailPopup.subject}\n\n${emailPopup.text || ''}`
                        }));
                        setIsComposing(true);
                        closeEmailPopup();
                      }}
                      className={clsx(
                        "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
                        isDarkMode 
                          ? "hover:bg-white/10 text-slate-300" 
                          : "hover:bg-gray-100 text-gray-600"
                      )}
                      title="Forward"
                    >
                      <Forward className="w-4 h-4" />
                      <span className="text-xs">Forward</span>
                    </button>
                  </>
                )}
                
                <button
                  onClick={closeEmailPopup}
                  className={clsx(
                    "p-2 rounded-lg transition-colors",
                    isDarkMode 
                      ? "hover:bg-white/10 text-slate-300" 
                      : "hover:bg-gray-100 text-gray-600"
                  )}
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
              {emailPopup.loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-400 border-t-transparent"></div>
                </div>
              ) : emailPopup.error ? (
                <div className={clsx(
                  "p-6 text-center",
                  isDarkMode ? "text-red-400" : "text-red-600"
                )}>
                  <p>Error loading email: {emailPopup.error}</p>
                </div>
              ) : (
                <div className="p-6">
                  {/* Email metadata */}
                  <div className={clsx(
                    "mb-6 p-4 rounded-lg border",
                    isDarkMode 
                      ? "bg-white/5 border-white/10" 
                      : "bg-gray-50 border-gray-200"
                  )}>
                    <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                      <span className={isDarkMode ? "text-slate-400" : "text-gray-500"}>From:</span>
                      <span className="font-medium">{emailPopup.from_address}</span>
                      
                      <span className={isDarkMode ? "text-slate-400" : "text-gray-500"}>To:</span>
                      <span>{emailPopup.to_address}</span>
                      
                      <span className={isDarkMode ? "text-slate-400" : "text-gray-500"}>Date:</span>
                      <span>{new Date(emailPopup.created_at).toLocaleString()}</span>
                      
                      {emailPopup.priority > 0 && (
                        <>
                          <span className={isDarkMode ? "text-slate-400" : "text-gray-500"}>Priority:</span>
                          <span className={clsx(
                            "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
                            emailPopup.priority === 3 
                              ? "bg-red-500/20 text-red-400"
                              : emailPopup.priority === 2
                              ? "bg-orange-500/20 text-orange-400"
                              : "bg-blue-500/20 text-blue-400"
                          )}>
                            <Flag className="w-3 h-3" />
                            {emailPopup.priority === 3 ? 'Urgent' : emailPopup.priority === 2 ? 'High' : 'Low'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Email content */}
                  <div className={clsx(
                    "prose max-w-none",
                    isDarkMode 
                      ? "prose-invert prose-a:text-indigo-400" 
                      : "prose-gray prose-a:text-indigo-600"
                  )}>
                    <MessageBody html={emailPopup.html} text={emailPopup.text} isDarkMode={isDarkMode} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * MessageBody component for rendering email content
 */
function MessageBody({ html, text, isDarkMode = true }) {
  if (html) {
    return (
      <div
        className={clsx(
          "prose max-w-none prose-a:underline",
          isDarkMode 
            ? "prose-invert prose-a:decoration-indigo-400/60" 
            : "prose-gray prose-a:decoration-indigo-600/60"
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  if (text) {
    return (
      <pre className={clsx(
        "whitespace-pre-wrap text-sm font-sans",
        isDarkMode ? "text-slate-200" : "text-gray-700"
      )}>{text}</pre>
    );
  }
  return (
    <div className={clsx(
      "text-sm",
      isDarkMode ? "text-slate-400" : "text-gray-500"
    )}>
      No content.
    </div>
  );
}

/**
 * SignaturePreview component for rendering signature preview
 */
function SignaturePreview({ signature }) {
  const generateSignatureHTML = () => {
    const { fullName, title, company, email, phone, website, address, profileImage, socialLinks, styling, layout } = signature;
    
    if (!fullName && !title && !company && !email && !phone) {
      return '<div style="color: #999; font-style: italic;">Fill in the form to see your signature preview</div>';
    }

    const baseStyles = `
      font-family: ${styling.fontFamily};
      font-size: ${styling.fontSize}px;
      color: ${styling.textColor};
      line-height: 1.4;
    `;

    const linkStyles = `color: ${styling.linkColor}; text-decoration: none;`;
    const imageStyle = profileImage ? `border-radius: 50%; width: 60px; height: 60px; object-fit: cover; margin-right: 15px;` : '';

    let signatureHTML = '';

    if (layout === 'modern') {
      signatureHTML = `
        <div style="${baseStyles}">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              ${profileImage ? `<td style="vertical-align: top; padding-right: 15px;"><img src="${profileImage}" style="${imageStyle}" alt="${fullName}" /></td>` : ''}
              <td style="vertical-align: top;">
                ${fullName ? `<div style="font-weight: bold; font-size: ${styling.fontSize + 2}px; margin-bottom: 5px;">${fullName}</div>` : ''}
                ${title ? `<div style="color: ${styling.linkColor}; font-weight: 500; margin-bottom: 3px;">${title}</div>` : ''}
                ${company ? `<div style="margin-bottom: 10px;">${company}</div>` : ''}
                <div style="border-top: 2px solid ${styling.linkColor}; padding-top: 10px; margin-top: 10px;">
                  ${email ? `<div style="margin-bottom: 3px;"><a href="mailto:${email}" style="${linkStyles}">📧 ${email}</a></div>` : ''}
                  ${phone ? `<div style="margin-bottom: 3px;"><a href="tel:${phone}" style="${linkStyles}">📞 ${phone}</a></div>` : ''}
                  ${website ? `<div style="margin-bottom: 3px;"><a href="${website}" style="${linkStyles}">🌐 ${website}</a></div>` : ''}
                  ${address ? `<div style="margin-bottom: 5px; color: #666; font-size: ${styling.fontSize - 1}px;">${address}</div>` : ''}
                </div>
                ${socialLinks.linkedin || socialLinks.twitter ? `
                  <div style="margin-top: 10px;">
                    ${socialLinks.linkedin ? `<a href="${socialLinks.linkedin}" style="${linkStyles} margin-right: 10px;">LinkedIn</a>` : ''}
                    ${socialLinks.twitter ? `<a href="${socialLinks.twitter}" style="${linkStyles}">Twitter</a>` : ''}
                  </div>
                ` : ''}
              </td>
            </tr>
          </table>
        </div>
      `;
    } else if (layout === 'classic') {
      signatureHTML = `
        <div style="${baseStyles}">
          ${fullName ? `<div style="font-weight: bold; margin-bottom: 5px;">${fullName}</div>` : ''}
          ${title ? `<div style="font-style: italic; margin-bottom: 3px;">${title}</div>` : ''}
          ${company ? `<div style="font-weight: 500; margin-bottom: 8px;">${company}</div>` : ''}
          <div style="font-size: ${styling.fontSize - 1}px;">
            ${email ? `<div>Email: <a href="mailto:${email}" style="${linkStyles}">${email}</a></div>` : ''}
            ${phone ? `<div>Phone: <a href="tel:${phone}" style="${linkStyles}">${phone}</a></div>` : ''}
            ${website ? `<div>Web: <a href="${website}" style="${linkStyles}">${website}</a></div>` : ''}
            ${address ? `<div style="margin-top: 5px; color: #666;">${address}</div>` : ''}
          </div>
        </div>
      `;
    } else if (layout === 'minimal') {
      signatureHTML = `
        <div style="${baseStyles}">
          ${fullName ? `<strong>${fullName}</strong>` : ''}${title ? ` | ${title}` : ''}${company ? ` | ${company}` : ''}
          <br/>
          ${email ? `<a href="mailto:${email}" style="${linkStyles}">${email}</a>` : ''}${phone ? ` | <a href="tel:${phone}" style="${linkStyles}">${phone}</a>` : ''}
        </div>
      `;
    } else if (layout === 'creative') {
      signatureHTML = `
        <div style="${baseStyles}">
          <table cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(90deg, ${styling.linkColor}22 0%, transparent 100%); border-radius: 8px; padding: 15px;">
            <tr>
              ${profileImage ? `<td style="vertical-align: top; padding-right: 20px;"><img src="${profileImage}" style="${imageStyle} border: 3px solid ${styling.linkColor};" alt="${fullName}" /></td>` : ''}
              <td style="vertical-align: top;">
                ${fullName ? `<div style="font-weight: bold; font-size: ${styling.fontSize + 4}px; margin-bottom: 5px; color: ${styling.linkColor};">${fullName}</div>` : ''}
                ${title ? `<div style="margin-bottom: 3px; text-transform: uppercase; font-size: ${styling.fontSize - 1}px; letter-spacing: 1px;">${title}</div>` : ''}
                ${company ? `<div style="margin-bottom: 15px; font-weight: 500;">${company}</div>` : ''}
                <div style="display: flex; flex-wrap: wrap; gap: 15px; align-items: center;">
                  ${email ? `<a href="mailto:${email}" style="${linkStyles} background: ${styling.linkColor}; padding: 5px 10px; border-radius: 15px; color: white; font-size: ${styling.fontSize - 1}px;">✉ ${email}</a>` : ''}
                  ${phone ? `<a href="tel:${phone}" style="${linkStyles} background: ${styling.linkColor}; padding: 5px 10px; border-radius: 15px; color: white; font-size: ${styling.fontSize - 1}px;">📱 ${phone}</a>` : ''}
                </div>
              </td>
            </tr>
          </table>
        </div>
      `;
    }

    return signatureHTML;
  };

  return (
    <div 
      dangerouslySetInnerHTML={{ __html: generateSignatureHTML() }}
      style={{ fontFamily: 'inherit' }}
    />
  );
}