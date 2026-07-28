
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import { Sun, Moon, Mail, Clock, Edit3, CheckCircle2 } from 'lucide-react';
import ActualEditor from './ActualEditor';
import MailBuilderOnboarding from './MailOnboard';
import InboxScreen from '../InboxScreen';
import DeluxeEmailClient from '../DeluxeEmailClient';
import AdvancedInboxScreen from '../AdvancedInboxScreen';
import ContactManagement from '../ContactManagement';
import { auth, db } from './firebase/init';
import { ref, get, set, update } from 'firebase/database';
import { API_URL } from '../../../config/environment';

/**
 * MailBuilderDashboard.jsx
 * Dashboard starter with integrated Composer Modal.

 * Tailwind required for styling. Swap mock api functions with real calls.
 */

/* ----------------------------- Mock API Layer ----------------------------- */
const mockDelay = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const mockInitial = (() => {
  // Minimal initial data: empty lists and neutral settings so dashboard shows empty states
  return {
    assets: [],
    contacts: [],
    automations: [],
    settings: { primaryColor: "", accentColor: "", defaultFont: "system-ui, Arial, sans-serif", fromEmail: "" },
  };
})();


const api = {
  // Check subscription status and account age - TEMPORARILY DISABLED FOR TESTING
  /* checkMailingEligibility: async (memberUid) => {
    try {
      const response = await fetch(`${API_URL}/api/member/mailing-eligibility/${memberUid}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to check mailing eligibility');
      }

      return await response.json();
    } catch (err) {
      console.error('Error checking mailing eligibility:', err);
      throw err;
    }
  }, */

  // Create the three standard business emails for a member
  createStandardBusinessEmails: async (memberUid, storeName) => {
    try {
      const response = await fetch(`${API_URL}/api/member/business-email/create-standard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ memberUid, storeName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create standard business emails');
      }

      return await response.json();
    } catch (err) {
      console.error('Error creating standard business emails:', err);
      throw err;
    }
  },

  // Send individual email through VPS
  sendEmail: async (tenantId, { to, from, subject, html, text, templateName, templateData }) => {
    try {
      const response = await fetch(`${API_URL}/api/email/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId || '1',
        },
        credentials: 'include',
        body: JSON.stringify({ to, from, subject, html, text, templateName, templateData }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send email');
      }

      return await response.json();
    } catch (err) {
      console.error('Email send error:', err);
      throw err;
    }
  },

  // Send bulk emails through VPS
  sendBulkEmails: async (tenantId, { recipients, subject, html, text, templateName, templateData, campaignId }) => {
    try {
      const response = await fetch(`${API_URL}/api/email/send-bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': tenantId || '1',
        },
        credentials: 'include',
        body: JSON.stringify({ recipients, subject, html, text, templateName, templateData, campaignId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send bulk emails');
      }

      return await response.json();
    } catch (err) {
      console.error('Bulk email send error:', err);
      throw err;
    }
  },

  // Fetch business emails for the member (for selection)
  fetchBusinessEmails: async (memberUid) => {
    try {
      const response = await fetch(`${API_URL}/api/member/business-emails/${memberUid}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch business emails');
      }

      const data = await response.json();
      return data.emails || [];
    } catch (err) {
      console.error('Error fetching business emails:', err);
      return [];
    }
  },

  // Mock functions (kept for backward compatibility where needed)
  fetchTenantData: async () => { await mockDelay(150); return JSON.parse(JSON.stringify(mockInitial)); },
  createCampaign: async (tid, payload) => { await mockDelay(200); return { id: "c_" + Math.floor(Math.random() * 100000), ...payload, status: "Scheduled" }; },
  sendTest: async (tid, campaignId, to) => { await mockDelay(300); return { ok: true, message: `Test sent to ${to}` }; },
  uploadAsset: async (tid, file) => { await mockDelay(300); return { id: "a_" + Math.floor(Math.random() * 100000), url: URL.createObjectURL(file), name: file.name, size: file.size }; },
  importContactsCSV: async (tid, file) => { await mockDelay(500); return { imported: 42, errors: 0 }; },
  exportTemplateJSON: async (tid, template) => { await mockDelay(100); return JSON.stringify(template, null, 2); },
  saveTemplate: async (tid, template) => { await mockDelay(200); return { ...template, savedAt: new Date().toISOString() }; },
};

/* ------------------------------- Utilities ------------------------------- */
function formatDate(iso) { if (!iso) return "-"; const d = new Date(iso); return d.toLocaleString(); }
function classNames(...xs) { return xs.filter(Boolean).join(" "); }

/* ------------------------------ Composer Modal --------------------------- */
/**
 * ComposerModal: simple template composer
 * Props:
 *  - open: boolean
 *  - template: object | null (if null, composer is in "new template" mode)
 *  - onClose(): close
 *  - onSave(template): called with updated template
 *  - onSaveAsNew(template): export as new template
 */
function ComposerModal({ open, template, onClose, onSave, onSaveAsNew }) {
  const [local, setLocal] = useState(template ? { ...template } : { id: null, name: "Untitled Template", html: "<div style='padding:20px'>Edit me</div>", thumbnail: "" });
  const iframeRef = useRef();

  useEffect(() => {
    setLocal(template ? { ...template } : { id: null, name: "Untitled Template", html: "<div style='padding:20px'>Edit me</div>", thumbnail: "" });
  }, [template, open]);

  if (!open) return null;

  const updateHtml = (h) => setLocal((p) => ({ ...p, html: h }));
  const updateField = (k, v) => setLocal((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    // run server-side save in real app; we call onSave to update parent state
    const saved = await api.saveTemplate("t_001", local);
    onSave(saved);
  };

  const handleSaveAsNew = async () => {
    // create a new template id & save as new
    const newTpl = { ...local, id: "tpl_" + Math.floor(Math.random() * 100000), createdAt: new Date().toISOString() };
    onSaveAsNew(newTpl);
  };

  const handleExport = async () => {
    const json = await api.exportTemplateJSON("t_001", local);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template-${local.name.replace(/\s+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleThumbnailUpload = (file) => {
    const url = URL.createObjectURL(file);
    updateField("thumbnail", url);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-[#071421] border border-slate-800 w-[95%] max-w-[1100px] h-[80vh] rounded-lg p-4 overflow-hidden">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-sm text-slate-400">Template Composer</div>
            <input className="mt-1 bg-transparent border border-slate-700 px-3 py-2 rounded-md text-white w-[420px]" value={local.name} onChange={(e) => updateField("name", e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer bg-transparent border border-slate-700 px-3 py-2 rounded text-sm text-slate-200">
              Upload Thumb
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleThumbnailUpload(e.target.files[0])} />
            </label>
            <button onClick={handleExport} className="bg-transparent border border-slate-700 px-3 py-2 rounded text-sm">Export JSON</button>
            <button onClick={handleSaveAsNew} className="bg-slate-800 text-slate-200 px-3 py-2 rounded text-sm">Save As New</button>
            <button onClick={handleSave} className="bg-pink-500 text-black px-4 py-2 rounded font-semibold">Save</button>
            <button onClick={onClose} className="px-3 py-2 rounded border border-slate-700 text-sm">Close</button>
          </div>
        </div>
      </div>

        <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Left: HTML editor area */}
          <div className="h-full flex flex-col gap-2">
            <div className="text-xs text-slate-400">HTML Editor</div>
            <textarea
              value={local.html}
              onChange={(e) => updateHtml(e.target.value)}
              className="flex-1 bg-[#081725] border border-slate-800 rounded p-3 text-sm text-slate-100 font-mono"
            />
          </div>

          {/* Right: Live preview and metadata */}
          <div className="h-full flex flex-col gap-2">
            <div className="text-xs text-slate-400">Live Preview</div>
            <div className="flex-1 border border-slate-800 rounded overflow-hidden bg-black">
              <iframe
                ref={iframeRef}
                title="template-preview"
                srcDoc={local.html}
                sandbox="allow-scripts allow-same-origin"
                style={{ width: "100%", height: "100%", border: "none", background: "#071421" }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="text-xs text-slate-400">Thumbnail</div>
              <div className="flex items-center gap-2">
                {local.thumbnail ? <img src={local.thumbnail} alt="thumb" className="h-10 rounded" /> : <div className="h-10 w-16 bg-slate-800 rounded flex items-center justify-center text-xs text-slate-500">No thumb</div>}
                <div className="text-xs text-slate-500">Created: {local.createdAt ? new Date(local.createdAt).toLocaleDateString() : "—"}</div>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
// ...existing code ends here

/* ------------------------------ Dashboard Bits --------------------------- */
function IconSparkline({ data = [], color = "#FF66B2", className = "", height = 30 }) {
  const w = Math.max(64, data.length * 6);
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${height - (v / max) * height}`).join(" ");
  return (
    <svg className={className} width={w} height={height} viewBox={`0 0 ${w} ${height}`} aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Topbar({ tenantName, onNewCampaign, newLabel = 'New Campaign', isDarkMode, onToggleTheme }) {
  return (
    <header className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center font-bold text-black">F</div>
        <div>
          <div className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>Tenant</div>
          <div className={`font-semibold text-lg ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{tenantName}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {/* Theme Toggle Buttons */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-gray-200 dark:bg-slate-700">
          <button
            onClick={() => onToggleTheme(false)}
            className={`p-2 rounded-md transition-all duration-200 ${
              !isDarkMode 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-400 hover:text-gray-300'
            }`}
            title="Light Mode"
          >
            <Sun className="w-4 h-4" />
          </button>
          <button
            onClick={() => onToggleTheme(true)}
            className={`p-2 rounded-md transition-all duration-200 ${
              isDarkMode 
                ? 'bg-slate-600 text-white shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
            title="Dark Mode"
          >
            <Moon className="w-4 h-4" />
          </button>
        </div>
        <button onClick={onNewCampaign} className="bg-pink-500 text-black px-4 py-2 rounded-md font-semibold hover:brightness-105">{newLabel}</button>
      </div>
    </header>
  );
}

function Sidebar({ active, setActive, isDarkMode, isAdmin }) {
  const items = [
    { key: "overview", label: "Overview" },
    { key: "inbox", label: "Inbox" },
    { key: "campaigns", label: "Campaigns" },
    { key: "templates", label: "Header & Footer" },
    { key: "contacts", label: "Contacts" },
    { key: "assets", label: "Assets" },
    ...(isAdmin ? [{ key: "automations", label: "Automations" }] : []),
    { key: "settings", label: "Settings" },
  ];
  return (
    <nav className={`lg:col-span-1 rounded-xl p-4 border transition-colors duration-200 ${
      isDarkMode 
        ? 'bg-[#071421] border-slate-800' 
        : 'bg-white border-gray-200'
    }`}>
      <ul className="space-y-3 text-sm">
        {items.map((it) => (
          <li key={it.key}>
            <button
              onClick={() => setActive(it.key)}
              className={classNames(
                "w-full text-left py-2 px-3 rounded-md flex items-center gap-3 transition-colors duration-200",
                active === it.key 
                  ? "bg-gradient-to-r from-pink-500 to-violet-600 text-black font-medium" 
                  : isDarkMode 
                    ? "hover:bg-slate-800 text-slate-300" 
                    : "hover:bg-gray-100 text-gray-700"
              )}
            >
              <span className={`w-2 h-2 rounded-full ${
                active === it.key 
                  ? "bg-black/30" 
                  : isDarkMode 
                    ? "bg-slate-500" 
                    : "bg-gray-400"
              }`} aria-hidden />
              <span>{it.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* KPI, CampaignsTable, TemplateLibrary, AssetManager, ContactsManager, Automations, SettingsPanel, CampaignDrawer, TestSendModal
   are the same implementations as in the previous file, lightly adapted for composer integration.
   For brevity we implement them inline again here (kept concise). */

function KPICard({ kpi, isDarkMode = true }) {
  return (
    <div className={`rounded-xl p-4 border transition-colors duration-200 ${
      isDarkMode 
        ? 'bg-[#0c1724] border-slate-800' 
        : 'bg-white border-gray-200'
    }`}>
      <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>{kpi.label}</div>
      <div className="mt-2 flex items-center justify-between gap-4">
        <div>
          <div className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{kpi.value}</div>
          <div className={`text-sm mt-1 ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`}>{kpi.delta}</div>
        </div>
        <IconSparkline data={kpi.spark || [10, 20, 15, 30]} color="#FF66B2" />
      </div>
    </div>
  );
}

function CampaignsTable({ campaigns, onView, onDuplicate, onSendNow, onDelete, onOpenInbox, isDarkMode = true }) {
  const [q, setQ] = useState("");
  const filtered = campaigns.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className={`rounded-xl p-4 border transition-colors duration-200 ${
      isDarkMode 
        ? 'bg-[#0c1724] border-slate-800' 
        : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Campaigns</h3>
        <input 
          value={q} 
          onChange={(e) => setQ(e.target.value)} 
          placeholder="Search campaigns" 
          className={`border rounded px-3 py-1 text-sm transition-colors duration-200 ${
            isDarkMode 
              ? 'bg-[#071421] border-slate-700 text-slate-200 placeholder-slate-400' 
              : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-500'
          }`} 
        />
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className={`text-xs border-b transition-colors duration-200 ${
            isDarkMode 
              ? 'text-slate-400 border-slate-700' 
              : 'text-gray-600 border-gray-200'
          }`}>
            <th className="py-2">Name</th><th>Recipients</th><th>Opens</th><th>Clicks</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className={`py-6 text-center ${isDarkMode ? 'text-slate-500' : 'text-gray-500'}`}>
                No campaigns
              </td>
            </tr>
          )}
          {filtered.map((c, idx) => (
            <tr key={`${c.id || 'campaign'}-${idx}`} className={`border-b transition-colors duration-200 ${
              isDarkMode ? 'border-slate-800' : 'border-gray-200'
            }`}>
              <td className={`py-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{c.name}</td>
              <td className={isDarkMode ? 'text-slate-300' : 'text-gray-600'}>{c.recipients}</td>
              <td className={isDarkMode ? 'text-slate-300' : 'text-gray-600'}>{c.opens}</td>
              <td className={isDarkMode ? 'text-slate-300' : 'text-gray-600'}>{c.clicks}</td>
              <td><span className={classNames("px-2 py-1 rounded text-xs", c.status==='Sent'?'bg-emerald-500 text-black':c.status==='Scheduled'?'bg-yellow-500 text-black':'bg-slate-700 text-slate-200')}>{c.status}</span></td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => onView(c)} className={`transition-colors duration-200 ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'}`}>View</button>
                  <button onClick={() => onDuplicate(c)} className={`transition-colors duration-200 ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'}`}>Duplicate</button>
                  <button onClick={() => onSendNow(c)} className={`transition-colors duration-200 ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'}`}>Send Now</button>
                  <button onClick={() => onOpenInbox && onOpenInbox()} className={`transition-colors duration-200 ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700'}`}>Open Inbox</button>
                  <button onClick={() => onDelete(c)} className="text-rose-400 hover:text-rose-300">Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Template Library - wired to composer via onEdit */
function TemplateLibrary({ templates, onEdit, onExport, onImport, isDarkMode = true }) {
  const [file, setFile] = useState(null);
  return (
    <div className={`rounded-xl p-4 border transition-colors duration-200 ${
      isDarkMode 
        ? 'bg-[#0c1724] border-slate-800' 
        : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Templates</h3>
        <div className="flex items-center gap-2">
          <input onChange={(e) => setFile(e.target.files?.[0] || null)} type="file" accept=".json" className="hidden" id="tpl-import" />
          <label htmlFor="tpl-import" className="cursor-pointer bg-pink-500 text-black px-3 py-1 rounded text-sm font-medium">Import</label>
          <button 
            onClick={() => onImport && onImport(file)} 
            disabled={!file} 
            className={`bg-transparent border px-3 py-1 rounded text-sm transition-colors duration-200 ${
              isDarkMode 
                ? 'border-slate-700 text-slate-300' 
                : 'border-gray-300 text-gray-600'
            }`}
          >
            Upload
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t, idx) => (
          <div key={`${t.id || 'tpl'}-${idx}`} className={`p-3 rounded-md border transition-colors duration-200 ${
            isDarkMode 
              ? 'bg-[#071421] border-slate-800' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="h-36 bg-black/40 rounded overflow-hidden flex items-center justify-center">
              <img src={t.thumbnail} alt={t.name} className="max-h-full object-contain" />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{t.name}</div>
                <div className="text-xs text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onEdit(t)} className="text-slate-400 hover:text-slate-200">Edit</button>
                <button onClick={() => onExport(t)} className="text-slate-400 hover:text-slate-200">Export</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* AssetManager, ContactsManager, Automations, SettingsPanel are similar to previous file
   For brevity we include concise versions */

function AssetManager({ assets, onUpload, onDelete, isDarkMode = true }) {
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);
  const choose = () => inputRef.current?.click();
  const handleFile = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    const res = await api.uploadAsset("t_001", f);
    setUploading(false);
    onUpload(res);
  };
  return (
    <div className={`rounded-xl p-4 border transition-colors duration-200 ${
      isDarkMode 
        ? 'bg-[#0c1724] border-slate-800' 
        : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Assets</h3>
        <div>
          <input ref={inputRef} onChange={handleFile} type="file" accept="image/*" className="hidden" />
          <button onClick={choose} className="bg-pink-500 text-black px-3 py-1 rounded text-sm">Upload</button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {assets.map((a, idx) => (
          <div key={`${a.id || 'asset'}-${idx}`} className={`rounded-md p-2 text-xs border transition-colors duration-200 ${
            isDarkMode 
              ? 'bg-[#071421] border-slate-800 text-slate-300' 
              : 'bg-gray-50 border-gray-200 text-gray-700'
          }`}>
            <div className={`h-20 rounded overflow-hidden flex items-center justify-center mb-2 ${
              isDarkMode ? 'bg-black/30' : 'bg-gray-100'
            }`}>
              <img src={a.url} alt={a.name} className="max-h-full object-contain" />
            </div>
            <div className="flex items-center justify-between">
              <div className="truncate">{a.name}</div>
              <div className="flex gap-1">
                <button onClick={() => navigator.clipboard?.writeText(a.url)} className={`${
                  isDarkMode 
                    ? 'text-slate-400 hover:text-slate-200' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}>Copy</button>
                <button onClick={() => onDelete(a)} className="text-rose-400 hover:text-rose-300">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {uploading && <div className={`mt-2 text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Uploading...</div>}
    </div>
  );
}

function ContactsManager({ contacts, onImportCSV, isDarkMode = true }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const doImport = async () => {
    if (!file) return;
    setLoading(true);
    await api.importContactsCSV("t_001", file);
    setLoading(false);
    onImportCSV && onImportCSV();
  };
  return (
    <div className={`rounded-xl p-4 border transition-colors duration-200 ${
      isDarkMode 
        ? 'bg-[#0c1724] border-slate-800' 
        : 'bg-white border-gray-200'
    }`}>
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Contacts</h3>
        <div className="flex items-center gap-2">
          <input onChange={(e) => setFile(e.target.files?.[0] || null)} type="file" accept=".csv" className={`text-sm ${
            isDarkMode ? 'text-slate-200' : 'text-gray-700'
          }`} />
          <button onClick={doImport} className="bg-pink-500 px-3 py-1 rounded text-black text-sm" disabled={!file}>Import CSV</button>
        </div>
      </div>
      <div className={`mt-4 space-y-2 text-xs ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
        {contacts.slice(0, 5).map((c, idx) => (
          <div key={`${c.id || 'contact'}-${idx}`} className="flex items-center justify-between">
            <div><div className="font-medium">{c.email}</div><div className={`text-xs ${
              isDarkMode ? 'text-slate-500' : 'text-gray-500'
            }`}>{c.firstName} {c.lastName}</div></div>
            <button className={`text-xs ${
              isDarkMode 
                ? 'text-slate-400 hover:text-slate-200' 
                : 'text-gray-500 hover:text-gray-700'
            }`}>View</button>
          </div>
        ))}
      </div>
      {loading && <div className={`mt-2 text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Importing…</div>}
    </div>
  );
}

function Automations({ automations, onCreate, isDarkMode = true, currentUserId }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedEmails, setExpandedEmails] = useState({});
  const [emailStats, setEmailStats] = useState({});
  const navigate = useNavigate();

  // Campaign Types Configuration
  const CAMPAIGN_TYPES = [
    {
      id: 'post-purchase',
      name: 'Post-Purchase Journey',
      icon: '🎉',
      color: 'purple',
      description: 'Automated emails sent after each purchase',
      emails: [
        { id: 'thank-you', name: 'Thank You Email', delay: '0 hours' },
        { id: 'usage-guide', name: 'Usage Guide', delay: '24 hours' },
        { id: 'recommended-addon', name: 'Recommended Add-on', delay: '3 days' },
        { id: 'request-review', name: 'Request Review', delay: '7 days' },
        { id: 'vip-discount', name: 'VIP Discount', delay: '14 days' }
      ]
    },
    {
      id: 'win-back',
      name: 'Win-Back Campaigns',
      icon: '💜',
      color: 'pink',
      description: 'Re-engage inactive customers',
      emails: [
        { id: 'we-miss-you', name: 'We Miss You', delay: '30 days' },
        { id: 'product-suggestion', name: 'Product Suggestion', delay: '60 days' },
        { id: 'personalized-offer', name: 'Personalized Offer', delay: '90 days' }
      ]
    },
    {
      id: 'abandoned-cart',
      name: 'Abandoned Cart Recovery',
      icon: '🛒',
      color: 'orange',
      description: 'Recover lost sales',
      emails: [
        { id: 'cart-reminder', name: 'Cart Reminder', delay: '1 hour' },
        { id: 'need-help', name: 'Need Help?', delay: '24 hours' },
        { id: 'discount-offer', name: 'Discount Offer', delay: '3 days' }
      ]
    },
    {
      id: 'one-click-upsell',
      name: 'One-Click Upsells',
      icon: '⚡',
      color: 'yellow',
      description: 'Increase order value',
      emails: [
        { id: 'deluxe-upgrade', name: 'Deluxe Upgrade', delay: '1 hour' },
        { id: 'accessory-offer', name: 'Accessory Offer', delay: '24 hours' },
        { id: 'customers-bought', name: 'Customers Also Bought', delay: '3 days' }
      ]
    },
    {
      id: 'anniversary-emails',
      name: 'Anniversary Emails',
      icon: '🎂',
      color: 'indigo',
      description: 'Reactivation strategy',
      emails: [
        { id: 'anniversary', name: 'Anniversary', delay: '1 year' },
        { id: 'upgrade-offer', name: 'Upgrade Offer', delay: '1 year' },
        { id: 'matching-products', name: 'Matching Products', delay: '1 year' }
      ]
    }
  ];

  useEffect(() => {
    if (currentUserId) {
      loadCampaigns();
      loadEmailStats();
    }
  }, [currentUserId]);

  async function loadCampaigns() {
    try {
      setLoading(true);
      const campaignsRef = ref(db, `stores/${currentUserId}/emailAutomation/campaigns`);
      const snapshot = await get(campaignsRef);
      
      if (snapshot.exists()) {
        setCampaigns(snapshot.val());
      }
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadEmailStats() {
    try {
      const statsRef = ref(db, `stores/${currentUserId}/emailAutomation/stats`);
      const snapshot = await get(statsRef);
      if (snapshot.exists()) {
        setEmailStats(snapshot.val());
      }
    } catch (error) {
      console.error('Error loading email stats:', error);
    }
  }

  function toggleEmailExpansion(campaignId, emailId) {
    const key = `${campaignId}-${emailId}`;
    setExpandedEmails(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }

  function getEmailStats(campaignId, emailId) {
    const stats = emailStats[campaignId]?.[emailId];
    if (!stats) {
      return {
        sent: 0,
        opened: 0,
        clicked: 0,
        openRate: 0,
        clickRate: 0
      };
    }
    
    const openRate = stats.sent > 0 ? ((stats.opened / stats.sent) * 100).toFixed(1) : 0;
    const clickRate = stats.opened > 0 ? ((stats.clicked / stats.opened) * 100).toFixed(1) : 0;
    
    return {
      sent: stats.sent || 0,
      opened: stats.opened || 0,
      clicked: stats.clicked || 0,
      openRate,
      clickRate
    };
  }

  function openTemplateEditor(campaign, email) {
    // Navigate to template editor with campaign and email data
    navigate('/automationscomposer', {
      state: {
        campaignType: campaign.id,
        emailType: email.id,
        emailName: email.name,
        campaignName: campaign.name
      }
    });
  }

  const getColorClasses = (color) => {
    const colors = {
      purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
      pink: 'from-pink-500/20 to-pink-600/20 border-pink-500/30',
      orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30',
      yellow: 'from-yellow-500/20 to-yellow-600/20 border-yellow-500/30',
      blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
      green: 'from-green-500/20 to-green-600/20 border-green-500/30',
      indigo: 'from-indigo-500/20 to-indigo-600/20 border-indigo-500/30'
    };
    return colors[color] || colors.purple;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-purple-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className={`rounded-xl p-6 border transition-colors duration-200 ${
      isDarkMode 
        ? 'bg-[#0c1724] border-slate-800' 
        : 'bg-white border-gray-200'
    }`}>
      <div className="mb-6">
        <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          Email Automation Campaigns
        </h3>
        <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
          Automated email sequences to boost revenue and retention
        </p>
      </div>

      <div className="space-y-6">
        {CAMPAIGN_TYPES.map((campaign) => (
          <div
            key={campaign.id}
            className={`rounded-xl border overflow-hidden transition-all ${
              isDarkMode ? 'bg-[#071421] border-slate-800' : 'bg-gray-50 border-gray-200'
            }`}
          >
            {/* Campaign Header */}
            <div className={`p-4 bg-gradient-to-r ${getColorClasses(campaign.color)} border-b ${
              isDarkMode ? 'border-slate-800' : 'border-gray-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{campaign.icon}</div>
                  <div>
                    <h4 className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {campaign.name}
                    </h4>
                    <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-600'}`}>
                      {campaign.description}
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={campaigns[campaign.id]?.enabled || false}
                    onChange={async (e) => {
                      const updatedCampaigns = {
                        ...campaigns,
                        [campaign.id]: {
                          ...campaigns[campaign.id],
                          enabled: e.target.checked
                        }
                      };
                      setCampaigns(updatedCampaigns);
                      
                      const campaignRef = ref(db, `stores/${currentUserId}/emailAutomation/campaigns/${campaign.id}/enabled`);
                      await set(campaignRef, e.target.checked);
                    }}
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>
            </div>

            {/* Email List */}
            <div className="p-4">
              <div className="space-y-2">
                {campaign.emails.map((email, idx) => {
                  const emailKey = `${campaign.id}-${email.id}`;
                  const isExpanded = expandedEmails[emailKey];
                  const stats = getEmailStats(campaign.id, email.id);
                  
                  return (
                    <div key={email.id} className="overflow-hidden">
                      <div
                        className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                          isDarkMode 
                            ? 'bg-[#0c1724] hover:bg-slate-800/50' 
                            : 'bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            isDarkMode ? 'bg-slate-800 text-white' : 'bg-gray-200 text-gray-700'
                          }`}>
                            {idx + 1}
                          </div>
                          <div>
                            <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {email.name}
                            </div>
                            <div className={`text-xs flex items-center gap-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                              <Clock className="h-3 w-3" />
                              {email.delay}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleEmailExpansion(campaign.id, email.id)}
                            className={`px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${
                              isDarkMode
                                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }`}
                          >
                            <Mail className="h-4 w-4" />
                            {isExpanded ? 'Hide Stats' : 'View Stats'}
                          </button>
                          <button
                            onClick={() => openTemplateEditor(campaign, email)}
                            className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${
                              isDarkMode
                                ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                : 'bg-purple-100 hover:bg-purple-200 text-purple-700'
                            }`}
                          >
                            <Edit3 className="h-4 w-4" />
                            Edit Template
                          </button>
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className={`mt-2 p-4 rounded-lg ${
                          isDarkMode ? 'bg-[#0c1724]' : 'bg-gray-50'
                        }`}>
                          <div className="grid grid-cols-3 gap-4 mb-4">
                            <div>
                              <div className={`text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                                Sent
                              </div>
                              <div className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                {stats.sent.toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <div className={`text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                                Opened
                              </div>
                              <div className="text-2xl font-bold text-blue-500">
                                {stats.opened.toLocaleString()}
                              </div>
                              <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                                {stats.openRate}% open rate
                              </div>
                            </div>
                            <div>
                              <div className={`text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                                Clicked
                              </div>
                              <div className="text-2xl font-bold text-green-500">
                                {stats.clicked.toLocaleString()}
                              </div>
                              <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                                {stats.clickRate}% click rate
                              </div>
                            </div>
                          </div>
                          
                          {stats.sent > 0 && (
                            <div className={`pt-4 border-t ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                              <div className={`text-xs mb-2 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                                Performance
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className={isDarkMode ? 'text-slate-300' : 'text-gray-700'}>
                                      Open Rate
                                    </span>
                                    <span className="font-medium text-blue-500">
                                      {stats.openRate}%
                                    </span>
                                  </div>
                                  <div className={`w-full rounded-full h-2 ${
                                    isDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                                  }`}>
                                    <div 
                                      className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                                      style={{ width: `${Math.min(stats.openRate, 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                                <div>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className={isDarkMode ? 'text-slate-300' : 'text-gray-700'}>
                                      Click-Through Rate
                                    </span>
                                    <span className="font-medium text-green-500">
                                      {stats.clickRate}%
                                    </span>
                                  </div>
                                  <div className={`w-full rounded-full h-2 ${
                                    isDarkMode ? 'bg-slate-700' : 'bg-gray-200'
                                  }`}>
                                    <div 
                                      className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                                      style={{ width: `${Math.min(stats.clickRate, 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPanel({ settings, onSave, isDarkMode = true }) {
  const [local, setLocal] = useState(settings);
  useEffect(()=>setLocal(settings),[settings]);
  return (
    <div className={`rounded-xl p-4 border transition-colors duration-200 ${
      isDarkMode 
        ? 'bg-[#0c1724] border-slate-800' 
        : 'bg-white border-gray-200'
    }`}>
      <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Settings</h3>
      <div className={`mt-3 space-y-2 text-sm ${isDarkMode ? 'text-slate-300' : 'text-gray-700'}`}>
        <div>
          <label className={`text-xs block mb-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>Primary color</label>
          <input value={local.primaryColor} onChange={(e)=>setLocal({...local, primaryColor:e.target.value})} className={`bg-transparent border px-2 py-1 rounded transition-colors duration-200 ${
            isDarkMode 
              ? 'border-slate-700 text-white' 
              : 'border-gray-300 text-gray-900'
          }`} />
        </div>
        <div>
          <label className={`text-xs block mb-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>From email</label>
          <input value={local.fromEmail} onChange={(e)=>setLocal({...local, fromEmail:e.target.value})} className={`bg-transparent border px-2 py-1 rounded transition-colors duration-200 ${
            isDarkMode 
              ? 'border-slate-700 text-white' 
              : 'border-gray-300 text-gray-900'
          }`} />
        </div>
        <div className="flex gap-2">
          <button onClick={()=>onSave(local)} className="bg-pink-500 text-black px-3 py-1 rounded">Save</button>
        </div>
      </div>
    </div>
  );
}

function CampaignDrawer({ campaign, onClose, onSendTest }) {
  if (!campaign) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-grow" onClick={onClose} />
      <aside className="w-[520px] bg-[#071421] border-l border-slate-800 p-6 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <div><div className="text-lg font-semibold">{campaign.name}</div><div className="text-xs text-slate-400">{campaign.subject}</div></div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">Close</button>
        </div>
        <div className="space-y-3 text-sm text-slate-300">
          <div><strong>Sent at:</strong> {formatDate(campaign.sentAt)}</div>
          <div><strong>Recipients:</strong> {campaign.recipients}</div>
          <div><strong>Opens:</strong> {campaign.opens}</div>
          <div><strong>Clicks:</strong> {campaign.clicks}</div>
          <div className="mt-4"><h4 className="font-medium">Timeline</h4><div className="mt-2 text-xs text-slate-400">Sample timeline (mock)</div><div className="mt-2 border rounded p-2 bg-[#0b1220]"><div className="text-xs">0–1h: 12 opens</div><div className="text-xs">1–6h: 78 opens</div></div></div>
          <div className="mt-4"><button className="bg-pink-500 text-black px-3 py-2 rounded mr-2" onClick={() => onSendTest(campaign.id, "you@example.com")}>Send Test</button><button className="bg-transparent border border-slate-700 px-3 py-2 rounded">Export CSV</button></div>
        </div>
      </aside>
    </div>
  );
}

function TestSendModal({ open, onClose, onSend, businessEmails = [], currentUserUid }) {
  // Filter to show only the 3 standard business emails
  const standardEmails = useMemo(() => businessEmails.filter(email => {
    if (!email.email) return false;
    const emailPart = email.email.split('@')[0];
    return emailPart.startsWith('no_reply.') || 
           emailPart.includes('.choice') ||
           emailPart.startsWith('contact.');
  }), [businessEmails]);

  const [to, setTo] = useState("");
  const [fromEmail, setFromEmail] = useState(standardEmails[0]?.email || "");
  const [sending, setSending] = useState(false);
  
  useEffect(()=>{ 
    if (!open) {
      setTo(""); 
      setSending(false);
    } else if (standardEmails.length > 0) {
      setFromEmail(standardEmails[0]?.email || "");
    }
  }, [open, standardEmails]);

  if (!open) return null;

  const handleSend = async () => {
    if (!to || !fromEmail) {
      alert("Please select a from email and enter a recipient");
      return;
    }
    setSending(true);
    try {
      await onSend(to, fromEmail);
    } finally {
      setSending(false);
    }
  };

  const getEmailDescription = (email) => {
    const emailPart = email.split('@')[0];
    if (emailPart.startsWith('no_reply.')) {
      return 'No Reply';
    } else if (emailPart.includes('.choice')) {
      return 'Custom Choice';
    } else if (emailPart.startsWith('contact.')) {
      return 'Contact';
    }
    return '';
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-[#071421] border border-slate-800 p-6 rounded w-[420px]">
        <h3 className="font-semibold mb-3">Send Test Email</h3>
        
        {/* From Email Selection - Standard 3 emails only */}
        <div className="mb-3">
          <label className="text-xs text-slate-400 block mb-1">From Email</label>
          <select 
            value={fromEmail} 
            onChange={(e) => setFromEmail(e.target.value)} 
            className="w-full bg-transparent border border-slate-700 px-3 py-2 rounded text-sm mb-3 text-white"
          >
            <option value="">Select an email...</option>
            {standardEmails.map((email) => (
              <option key={email.id} value={email.email}>
                {email.email} - {getEmailDescription(email.email)}
              </option>
            ))}
          </select>
          {standardEmails.length === 0 && (
            <div className="text-xs text-slate-500 mb-3">No standard business emails available. Please complete setup first.</div>
          )}
        </div>

        {/* To Email Input */}
        <input 
          value={to} 
          onChange={(e)=>setTo(e.target.value)} 
          placeholder="Recipient email" 
          className="w-full bg-transparent border border-slate-700 px-3 py-2 rounded text-sm mb-3 text-white" 
        />
        
        <div className="flex justify-end gap-2">
          <button 
            onClick={onClose} 
            disabled={sending}
            className="px-3 py-2 rounded border border-slate-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleSend} 
            disabled={sending || standardEmails.length === 0}
            className="bg-pink-500 px-3 py-2 rounded text-black disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

// New Campaign Creation Modal with Email Selection
function CampaignCreationModal({ open, onClose, onCreate, businessEmails = [] }) {
  // Filter to show only the 3 standard business emails
  const standardEmails = useMemo(() => businessEmails.filter(email => {
    if (!email.email) return false;
    const emailPart = email.email.split('@')[0];
    return emailPart.startsWith('no_reply.') || 
           emailPart.includes('.choice') ||
           emailPart.startsWith('contact.');
  }), [businessEmails]);

  const [campaignData, setCampaignData] = useState({
    name: "",
    subject: "",
    fromEmail: standardEmails[0]?.email || "",
    html: "<p>Your campaign content here...</p>",
    text: "Your campaign content here...",
    recipients: []
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      setCampaignData({
        name: "",
        subject: "",
        fromEmail: standardEmails[0]?.email || "",
        html: "<p>Your campaign content here...</p>",
        text: "Your campaign content here...",
        recipients: []
      });
      setCreating(false);
    } else if (standardEmails.length > 0) {
      setCampaignData(prev => ({
        ...prev,
        fromEmail: standardEmails[0]?.email || ""
      }));
    }
  }, [open, standardEmails]);

  if (!open) return null;

  const handleCreate = async () => {
    if (!campaignData.name || !campaignData.subject || !campaignData.fromEmail) {
      alert("Please fill in campaign name, subject, and select a from email");
      return;
    }
    setCreating(true);
    try {
      await onCreate(campaignData);
    } finally {
      setCreating(false);
    }
  };

  const getEmailDescription = (email) => {
    const emailPart = email.split('@')[0];
    if (emailPart.startsWith('no_reply.')) {
      return 'No Reply - For newsletters and announcements';
    } else if (emailPart.includes('.choice')) {
      return 'Custom Choice - Your personalized business email';
    } else if (emailPart.startsWith('contact.')) {
      return 'Contact - For customer support and inquiries';
    }
    return '';
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-[#071421] border border-slate-800 p-6 rounded w-[600px] max-h-[80vh] overflow-y-auto">
        <h3 className="font-semibold mb-4 text-white">Create New Campaign</h3>
        
        <div className="space-y-4">
          {/* Campaign Name */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Campaign Name</label>
            <input 
              value={campaignData.name}
              onChange={(e) => setCampaignData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter campaign name"
              className="w-full bg-transparent border border-slate-700 px-3 py-2 rounded text-sm text-white"
            />
          </div>

          {/* Subject Line */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Subject Line</label>
            <input 
              value={campaignData.subject}
              onChange={(e) => setCampaignData(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="Enter email subject"
              className="w-full bg-transparent border border-slate-700 px-3 py-2 rounded text-sm text-white"
            />
          </div>

          {/* From Email Selection - Standard 3 emails only */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">From Email</label>
            <select 
              value={campaignData.fromEmail} 
              onChange={(e) => setCampaignData(prev => ({ ...prev, fromEmail: e.target.value }))}
              className="w-full bg-transparent border border-slate-700 px-3 py-2 rounded text-sm text-white"
            >
              <option value="">Select a business email...</option>
              {standardEmails.map((email) => (
                <option key={email.id} value={email.email}>
                  {email.email} - {getEmailDescription(email.email)}
                </option>
              ))}
            </select>
            {standardEmails.length === 0 && (
              <div className="text-xs text-slate-500 mt-1">No standard business emails available. Please complete the setup process first.</div>
            )}
          </div>

          {/* HTML Content */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">HTML Content</label>
            <textarea 
              value={campaignData.html}
              onChange={(e) => setCampaignData(prev => ({ ...prev, html: e.target.value }))}
              rows={6}
              className="w-full bg-transparent border border-slate-700 px-3 py-2 rounded text-sm text-white font-mono"
            />
          </div>

          {/* Text Content */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Text Content (fallback)</label>
            <textarea 
              value={campaignData.text}
              onChange={(e) => setCampaignData(prev => ({ ...prev, text: e.target.value }))}
              rows={3}
              className="w-full bg-transparent border border-slate-700 px-3 py-2 rounded text-sm text-white"
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <button 
            onClick={onClose} 
            disabled={creating}
            className="px-4 py-2 rounded border border-slate-700 disabled:opacity-50 text-white"
          >
            Cancel
          </button>
          <button 
            onClick={handleCreate} 
            disabled={creating || standardEmails.length === 0}
            className="bg-pink-500 px-4 py-2 rounded text-black disabled:opacity-50 font-semibold"
          >
            {creating ? "Creating..." : "Create Campaign"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Main --------------------------------- */
export default function MailBuilderDashboardWithComposer() {
  const [data, setData] = useState(null);
  // Onboarding modal state - DISABLED (not needed)
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [active, setActive] = useState("overview");
  const [drawerCampaign, setDrawerCampaign] = useState(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [campaignCreateModalOpen, setCampaignCreateModalOpen] = useState(false);
  const [businessEmails, setBusinessEmails] = useState([]);
  const [mailingEligible, setMailingEligible] = useState(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Initialize from localStorage or default to dark mode
    const saved = localStorage.getItem('mailbuilder-theme');
    return saved ? JSON.parse(saved) : true;
  });
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get current user for contact management
  const currentUser = auth.currentUser;
  // Email Automation is admin-only, not for affiliates — same hardcoded
  // platform-owner check src/components/shared/Header.js's `isMember` uses.
  // The underlying feature is dead anyway (see Bible), but this keeps it out
  // of the affiliate-facing Mail Campaign dashboard regardless.
  const isAdminUser = currentUser?.email === 'joshmarsden28@gmail.com';

  // Check mailing eligibility and handle business email setup
  const checkMailingEligibilityAndSetup = async () => {
    if (!currentUser || !currentUser.uid) {
      alert("Please log in to access mail campaigns");
      return false;
    }

    setCheckingEligibility(true);
    try {
      // TEMPORARILY DISABLED FOR TESTING - Skip eligibility check
      // const eligibility = await api.checkMailingEligibility(currentUser.uid);
      const eligibility = { eligible: true }; // Mock eligible response for testing
      setMailingEligible(eligibility);

      /* if (!eligibility.eligible) {
        if (eligibility.reason === 'account_too_new') {
          alert("Your account must be at least one month old to send mail campaigns. This helps us prevent spam and protect our server reputation.");
          return false;
        } else if (eligibility.reason === 'no_active_subscription') {
          alert("You need an active subscription (not just the free trial) to send mail campaigns. This helps us prevent spam and protect our server reputation.");
          return false;
        }
        return false;
      } */

      // TEMPORARILY DISABLED: Business email creation check
      // User already has business emails from onboarding, skip this check
      /* if (!hasChoiceEmail) {
        const storeName = prompt("Please enter your store name for creating business emails...");
        if (!storeName || storeName.trim() === '') {
          alert("Store name is required to create business emails");
          return false;
        }
        try {
          await api.createStandardBusinessEmails(currentUser.uid, storeName.trim());
          const emails = await api.fetchBusinessEmails(currentUser.uid);
          setBusinessEmails(emails);
          alert("Standard business emails created successfully!");
        } catch (err) {
          alert(`Failed to create business emails: ${err.message}`);
          return false;
        }
      } */

      return true;
    } catch (err) {
      alert(`Failed to check mailing eligibility: ${err.message}`);
      return false;
    } finally {
      setCheckingEligibility(false);
    }
  };

  // Theme toggle handler
  const handleToggleTheme = (darkMode) => {
    setIsDarkMode(darkMode);
    localStorage.setItem('mailbuilder-theme', JSON.stringify(darkMode));
  };

  useEffect(() => {
    (async () => {
      const d = await api.fetchTenantData();
      setData(d);

      // Fetch business emails for the current user
      if (currentUser && currentUser.uid) {
        try {
          const emails = await api.fetchBusinessEmails(currentUser.uid);
          setBusinessEmails(emails);
        } catch (err) {
          console.warn('Could not fetch business emails:', err);
        }
      }

      try {
        const saved = await loadSavedFormatsForDashboard();
        if (saved && saved.length) {
          setData((p) => ({ ...p, templates: [...saved, ...(p.templates || [])] }));
        }
      } catch (e) {
        console.warn('Could not load saved formats for dashboard', e);
      }
      // Auto-onboarding removed - users can access Header & Footer builder via sidebar tab
    })();
  }, [currentUser?.uid]); // Only depend on the UID string, not the full currentUser object

  async function loadSavedFormatsForDashboard() {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.uid) return [];
      const uid = currentUser.uid;
      if (!db) {
        // localStorage fallback: look for keys starting with prefix
        const prefix = `mailbuilder:theme:${uid}`;
        const out = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(prefix)) {
            try {
              const m = JSON.parse(localStorage.getItem(k));
              const tpl = {
                id: k,
                name: m.formatName || m.brandName || 'Saved format',
                thumbnail: (m.logos && m.logos[0] && (m.logos[0].downloadURL || m.logos[0].url)) || '',
                createdAt: m.createdAt || Date.now(),
                manifest: m,
              };
              out.push(tpl);
            } catch (e) { }
          }
        }
        return out;
      }

      const { ref, get } = await import('firebase/database');
      const baseRef = ref(db, `mailbuilder/themes/${uid}`);
      const snap = await get(baseRef);
      const out = [];
      if (snap && snap.exists && snap.exists()) {
        snap.forEach(child => {
          const m = child.val();
          out.push({ id: child.key, name: m.formatName || m.brandName || 'Saved format', thumbnail: (m.logos && m.logos[0] && (m.logos[0].downloadURL || m.logos[0].url)) || '', createdAt: m.createdAt || Date.now(), manifest: m });
        });
      }
      return out;
    } catch (e) {
      console.warn('loadSavedFormatsForDashboard failed', e);
      return [];
    }
  }

  // Composer is a separate page at /mailbuilder/composer; we no longer open it in-dashboard.

  if (!data) return <div className="min-h-screen bg-[#071021] text-slate-100 p-6">Loading...</div>;

// Open the composer for new campaigns (with eligibility check)
const handleNewCampaign = async () => {
  const eligible = await checkMailingEligibilityAndSetup();
  if (eligible) {
    navigate('/automationscomposer', { state: { intent: 'new-campaign' } });
  }
};

const handleNewTemplate = () => navigate('/automationscomposer');

// When the user is viewing the Campaigns tab, the New button should check eligibility first
const handleNewCampaignContextual = async () => {
  if (active === 'campaigns') {
    // Check eligibility before opening composer for new campaign
    const eligible = await checkMailingEligibilityAndSetup();
    if (eligible) {
      navigate('/automationscomposer', { state: { intent: 'new-campaign' } });
    }
  } else if (active === 'templates') {
    // Open the Header & Footer template builder (MailOnboard)
    setShowOnboarding(true);
  } else {
    // Default to campaign creation with eligibility check
    const eligible = await checkMailingEligibilityAndSetup();
    if (eligible) {
      navigate('/automationscomposer', { state: { intent: 'new-campaign' } });
    }
  }
};

// Handle campaign creation from modal
const handleCreateCampaign = async (campaignData) => {
  try {
    // Create campaign object
    const newCampaign = {
      id: "c_" + Math.floor(Math.random() * 100000),
      ...campaignData,
      status: "Draft",
      recipients: 0,
      opens: 0,
      clicks: 0,
      createdAt: new Date().toISOString()
    };

    // Add to campaigns list
    setData((p) => ({ 
      ...p, 
      campaigns: [newCampaign, ...(p.campaigns || [])] 
    }));
    
    setCampaignCreateModalOpen(false);
    alert(`Campaign "${campaignData.name}" created successfully!`);
  } catch (err) {
    alert(`Failed to create campaign: ${err.message}`);
  }
};

/* Composer integration: navigate to composer page, passing optional template data */
const openComposer = (template = null) => {
  navigate('/automationscomposer', { state: { template, templates: data.templates, tenant: data.tenant } });
};

  const onSaveTemplate = (saved) => {
    // if template id exists in list update, else insert
    setData((p) => {
      const exists = p.templates.some((t) => t.id === saved.id);
      return {
        ...p,
        templates: exists ? p.templates.map((t) => (t.id === saved.id ? saved : t)) : [saved, ...p.templates],
      };
    });
    // Composer is a separate page; it can navigate back itself after saving.
  };

  const onSaveTemplateAsNew = (tpl) => {
    setData((p) => ({ ...p, templates: [tpl, ...p.templates] }));
    // Composer is a separate page; no in-dashboard close action required.
  };

  const handleViewCampaign = (c) => { setDrawerCampaign(c); setActive("campaigns"); };
  const handleDuplicate = (c) => { const copy = { ...c, id: "c_" + Math.floor(Math.random() * 100000), name: c.name + " (copy)", status: "Draft" }; setData((p) => ({ ...p, campaigns: [copy, ...p.campaigns] })); };
  
  const handleSendNow = async (c) => { 
    if (businessEmails.length === 0) {
      alert("Please create a business email first");
      return;
    }
    setTestModalOpen(true);
    setDrawerCampaign(c);
  };
  
  const handleDelete = (c) => { if (!window.confirm("Delete campaign?")) return; setData((p) => ({ ...p, campaigns: p.campaigns.filter((x) => x.id !== c.id) })); };

  const handleTestEmailSend = async (to, fromEmail) => {
    if (!drawerCampaign) return;
    try {
      const result = await api.sendEmail(data.tenant?.id || '1', {
        to,
        from: fromEmail,
        subject: drawerCampaign.subject || "Test Email",
        html: drawerCampaign.html || "<div>Test email</div>",
      });
      alert(`Email sent successfully to ${to}`);
      setTestModalOpen(false);
      // Update campaign status
      setData((p) => ({ 
        ...p, 
        campaigns: p.campaigns.map((x) => 
          (x.id === drawerCampaign.id ? { ...x, status: "Sent", sentAt: new Date().toISOString() } : x)
        ) 
      }));
    } catch (err) {
      alert(`Failed to send email: ${err.message}`);
    }
  };

  const handleUploadAsset = (a) => setData((p) => ({ ...p, assets: [a, ...(p.assets || [])] }));
  const handleDeleteAsset = (a) => setData((p) => ({ ...p, assets: p.assets.filter((x) => x.id !== a.id) }));
  const handleImportContacts = () => alert("Contacts import complete (mock)");
  const handleCreateAutomation = (a) => setData((p) => ({ ...p, automations: [a, ...(p.automations || [])] }));
  const handleSaveSettings = (s) => { setData((p) => ({ ...p, settings: s })); alert("Settings saved (mock)."); };

  const handleExportTemplate = async (t) => { const json = await api.exportTemplateJSON(data.tenant.id, t); const blob = new Blob([json], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `template-${t.name}.json`; a.click(); URL.revokeObjectURL(url); };

  const handleSendTestModal = (campaignId) => { setTestModalOpen(true); setDrawerCampaign(data.campaigns.find((c) => c.id === campaignId) || null); };

  // Defensive: fallback for tenant and all dashboard arrays
  const tenant = data.tenant || { name: "Tenant" };
  const kpis = data.kpis || [];
  const campaigns = data.campaigns || [];
  const templates = data.templates || [];
  const assets = data.assets || [];
  const automations = data.automations || [];
  return (
    <div className={`min-h-screen p-6 transition-colors duration-200 ${
      isDarkMode 
        ? 'bg-[#071021] text-slate-100' 
        : 'bg-gray-50 text-gray-900'
    }`}>
  {/* Header & Footer Template Builder (MailOnboard) */}
  {showOnboarding && (
    <MailBuilderOnboarding
      open={showOnboarding}
      onFinish={() => {
        // Close the onboarding modal after saving and return to mail dashboard
        setShowOnboarding(false);
      }}
    />
  )}
  <Topbar
    tenantName={tenant.name}
    onNewCampaign={handleNewCampaignContextual}
    newLabel={ active === 'templates' ? 'Create a Header and Footer template' : 'New Campaign' }
    isDarkMode={isDarkMode}
    onToggleTheme={handleToggleTheme}
  />
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
        <Sidebar active={active} setActive={setActive} isDarkMode={isDarkMode} isAdmin={isAdminUser} />

        <main className="lg:col-span-5 space-y-6">
          {active === "overview" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {kpis.map((k, idx) => <KPICard key={`${k.label || 'kpi'}-${idx}`} kpi={k} isDarkMode={isDarkMode} />)}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <CampaignsTable campaigns={campaigns} onView={handleViewCampaign} onDuplicate={handleDuplicate} onSendNow={handleSendNow} onDelete={handleDelete} onOpenInbox={() => { try { window.location.hash = 'inbox'; } catch(e){} }} isDarkMode={isDarkMode} />
                </div>

                <div className="space-y-4">
                  <TemplateLibrary templates={templates} onEdit={(t) => openComposer(t)} onExport={handleExportTemplate} onImport={(f) => alert("Import (mock)")} isDarkMode={isDarkMode} />
                  <AssetManager assets={assets} onUpload={handleUploadAsset} onDelete={handleDeleteAsset} isDarkMode={isDarkMode} />
                </div>
              </div>
            </>
          )}

          {active === "campaigns" && <CampaignsTable campaigns={campaigns} onView={handleViewCampaign} onDuplicate={handleDuplicate} onSendNow={handleSendNow} onDelete={handleDelete} onOpenInbox={() => { try { window.location.hash = 'inbox'; } catch(e){} }} isDarkMode={isDarkMode} />}

          {active === "inbox" && <AdvancedInboxScreen />}

          {active === "templates" && <TemplateLibrary templates={templates} onEdit={(t) => openComposer(t)} onExport={handleExportTemplate} onImport={(f) => alert("Import (mock)")} isDarkMode={isDarkMode} />}

          {active === "contacts" && <ContactManagement memberUid={currentUser?.uid} isDarkMode={isDarkMode} />}

          {active === "assets" && <AssetManager assets={assets} onUpload={handleUploadAsset} onDelete={handleDeleteAsset} isDarkMode={isDarkMode} />}

          {active === "automations" && isAdminUser && <Automations automations={automations} onCreate={handleCreateAutomation} isDarkMode={isDarkMode} currentUserId={currentUser?.uid} />}

          {active === "settings" && <SettingsPanel settings={data.settings} onSave={handleSaveSettings} isDarkMode={isDarkMode} />}
        </main>
      </div>

      {/* Composer is now a standalone page at /mailbuilder/composer */}
      <CampaignDrawer campaign={drawerCampaign} onClose={() => setDrawerCampaign(null)} onSendTest={(cid, to) => handleSendTestModal(cid)} />
      
      <CampaignCreationModal
        open={campaignCreateModalOpen}
        onClose={() => setCampaignCreateModalOpen(false)}
        onCreate={handleCreateCampaign}
        businessEmails={businessEmails}
      />
      
      <TestSendModal 
        open={testModalOpen} 
        onClose={() => setTestModalOpen(false)} 
        businessEmails={businessEmails}
        currentUserUid={currentUser?.uid}
        onSend={async (to, fromEmail) => { 
          if (!drawerCampaign) return; 
          try {
            const result = await api.sendEmail(data.tenant?.id || '1', {
              to,
              from: fromEmail,
              subject: `Test: ${drawerCampaign.subject || drawerCampaign.name}`,
              html: drawerCampaign.html || `<p>Test email for campaign: ${drawerCampaign.name}</p>`,
              text: drawerCampaign.text || `Test email for campaign: ${drawerCampaign.name}`
            });
            alert(`Test email sent successfully! Message ID: ${result.messageId}`); 
            setTestModalOpen(false); 
          } catch (err) {
            alert(`Failed to send test email: ${err.message}`);
          }
        }} 
      />

  <footer className="max-w-5xl mx-auto mt-8 text-xs text-slate-500 text-center">© {new Date().getFullYear()} {tenant.name} • Mail Builder feature</footer>
    </div>
  );
}
