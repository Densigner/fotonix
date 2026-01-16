import React, { useMemo, useState } from "react";
import '../../../MailComposerDesign.css';
import TemplateEditor from './TemplateEditor';

// Demo templates — replace with API results as needed
// Use images that already exist in public/images to avoid missing-file errors
const DEMO_TEMPLATES = [
  { id: "empty", name: "Empty", screenshotUrl: "/images/hero/empty.png" },
  { id: "announce", name: "Announce", screenshotUrl: "/uploads/annouceTemplate.png" },
  { id: "birthday", name: "Birthday", screenshotUrl: "/images/hero/birthday.png" },
  { id: "explore", name: "Explore", screenshotUrl: "/images/hero/explore_template_clean.png" },
  { id: "share", name: "Share", screenshotUrl: "/images/hero/sharee.png" },
  { id: "update", name: "Update", screenshotUrl: "/images/hero/updatee.png" },
  { id: "welcome", name: "Welcome", screenshotUrl: "/images/hero/welcomee.png" },
];

function Avatar() {
  return (
    <div className="avatar" style={{ height: 40, width: 40 }}>
      <span className="avatar-initials" style={{ fontSize: 16 }}>J</span>
      <img
        src="//www.gravatar.com/avatar/62c4f1dada82555054da9e85bc584337?s=80&d=blank"
        height={40}
        width={40}
        title="Profile image"
        alt="Profile"
      />
    </div>
  );
}

function Header({ onMobileToggle }) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    // Header intentionally removed per UX request (logo, nav, profile and toggle menu hidden)
    null
  );
}

function MobileNav({ open }) {
  // Mobile nav intentionally removed per UX request
  return null;
}

function PageSteps() {
  return (
    <div className="page-top__steps">
      <div className="dashboard-panel-steps">
        <a className="panel-step visited" href="/campaigns/ID/setup" tabIndex={0}>
          <div className="panel-step-check"><i className="fas fa-check" /></div>
          <span className="panel-step-text">Setup</span>
        </a>
        <div className="panel-step current">
          <div className="panel-step-check" />
          <span className="panel-step-text">Design</span>
        </div>
        <div className="panel-step">
          <div className="panel-step-check" />
          <span className="panel-step-text">Content</span>
        </div>
        <div className="panel-step">
          <div className="panel-step-check" />
          <span className="panel-step-text">Send</span>
        </div>
      </div>
    </div>
  );
}

function FilterBar({ sort, onSort }) {
  const [dirAsc, setDirAsc] = useState(true);
  const [open, setOpen] = useState(false);

  return (
    <div className="filter-bar row align-items-stretch justify-content-between mx-0 position-relative transition-all">
      <div className="entity-search-bar-element d-flex">
        <div className="focus-within:shadow border border-radius d-flex flex-fill px-2 transition-box-shadow">
          <label htmlFor="search" className="h-100 pr-2 d-flex align-items-center cursor-text">
            <i className="fas fa-search fa-fw" />
          </label>
          <input type="search" id="search" placeholder="Search" maxLength={255} className="form-control form-control-sm shadow-none bg-transparent border-0 pl-0" />
        </div>
      </div>
      <div className="entity-search-element d-flex align-items-stretch my-2 my-md-0 justify-content-start">
        <div className="my-auto mx-3 text-sm">Sort by</div>
        <div className={`dropdown mr-2 d-flex ${open ? "show" : ""}`}>
          <button className="btn btn-sm btn-tertiary" type="button" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {sort}
          </button>
          <div className={`dropdown-menu animate slide-in ${open ? "show" : ""}`}>
            <button className="btn dropdown-item" onClick={() => { onSort("Name"); setOpen(false); }}>Name</button>
          </div>
        </div>
        <button className="btn btn-sm btn-tertiary square-button" type="button" onClick={() => setDirAsc((v) => !v)}>
          <i className={`fa-solid fa-fw ${dirAsc ? "fa-arrow-up" : "fa-arrow-down"}`} />
        </button>
      </div>
      <div className="index-pager-wrap entity-search-pagination-element mt-1 mt-md-0 justify-content-center justify-content-sm-end">
        <div className="index-pager-box">
          <button type="button" className="disabled border-0 bg-transparent small index-pager-arrow index-pager-left" disabled><i className="fas fa-chevron-left" /></button>
          <span className="index-pager-text">1 to 6 of 6</span>
          <button type="button" className="disabled border-0 bg-transparent small index-pager-arrow index-pager-right" disabled><i className="fas fa-chevron-right" /></button>
        </div>
      </div>
    </div>
  );
}

function TemplateGrid({ templates, onPreview, onChooseTemplate }) {
  return (
    <div className="entity-search-result-set mt-5 mb-3">
      <div className="template-choices">
        {templates.map((t) => (
          <div className="template-choice" key={t.id}>
            {/* Make the whole box behave like a button so clicking anywhere selects the template */}
            <div
              className="box"
              tabIndex={0}
              role="button"
              style={{ cursor: "pointer" }}
              onClick={() => { if (typeof onChooseTemplate === 'function') onChooseTemplate(t); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (typeof onChooseTemplate === 'function') onChooseTemplate(t);
                }
              }}
            >
              <div className="_skeleton-wrapper_dzj8e_1 _thumbnail_g3c9y_1 _medium_g3c9y_15 screenshot">
                <span className="_skeleton-loader_dzj8e_10" />
                <span className="_masked_dzj8e_52">
                  <img width={200} height={200} alt="" src={t.screenshotUrl} onError={(e)=>{ if(e && e.target) { if(!e.target.dataset.fallback) { e.target.dataset.fallback = '1'; e.target.src = (t.screenshotUrl.includes('explore_template_clean') ? '/images/hero/exploree.png' : '/images/hero/exploree.png'); } } }} />
                </span>
              </div>
              <div className="buttons top right">
                <a
                  href="#"
                  className="btn btn-primary btn-sm preview-template"
                  title="Preview"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPreview(t); }}
                >
                  <i className="fas fa-eye" />
                </a>
                <a
                  href="#"
                  className="btn btn-secondary btn-sm choose-template"
                  title="Use this template"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (typeof onChooseTemplate === 'function') onChooseTemplate(t); }}
                >
                  <i className="fas fa-edit" />
                </a>
              </div>
            </div>
            <div className="mt-3">
              <p className="name">{t.name}</p>
            </div>
          </div>
        ))}
        <div className="template-choice-filler" />
        <div className="template-choice-filler" />
        <div className="template-choice-filler" />
        <div className="template-choice-filler" />
      </div>
    </div>
  );
}

function PreviewModal({ open, onClose, template }) {
  if (!open) return null;
  return (
    <div id="preview">
      <div className="preview-modal">
        <div className="inner">
          <h2 className="text-center mb-3">{template?.name ?? ""}</h2>
          <a href="#" onClick={(e) => { e.preventDefault(); onClose(); }}>
            <i className="fal fa-times dismiss" title="Close" />
          </a>
          <div className="iframe-wrapper position-relative">
            <iframe src="about:blank" sandbox="allow-scripts" className="position-absolute" title="Template preview" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MailComposerDesign(props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sort, setSort] = useState("Name");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(undefined);
  const [showEditor, setShowEditor] = useState(false);
  const [titleEdit, setTitleEdit] = useState(false);
  const [title, setTitle] = useState(props.title || "Untitled");

  const templates = useMemo(() => DEMO_TEMPLATES, []);

  // If parent passed composerState we can display some basic info
  const composerState = props.composerState || {};

  return (
    <div className="wrapper">
      <div className="main">
        <Header onMobileToggle={() => setMobileOpen((v) => !v)} />
        <MobileNav open={mobileOpen} />

        <div id="app" className="">
          <div className="container-fluid px-0">
            <div className="content pt-0">
              <form name="email_template" method="post" onSubmit={(e) => e.preventDefault()}>
                <div className="page-top page-top--bg">
                  <div className="container">
                    <div className="page-top__title">
                      <div className="dashboard-top-left editable-title" data-v-pre="">
                        <div className="title-wrapper">
                          {!titleEdit ? (
                            <>
                              <h1 className="long toggle-tooltip" title={title} data-untitled="Untitled" data-toggle="tooltip">{title}</h1>
                              <button
                                type="button"
                                className="edit base-button icon icon-only tertiary medium toggle-tooltip"
                                title="Edit"
                                onClick={() => setTitleEdit(true)}
                              >
                                <i className="fa-solid fa-pen-to-square" />
                              </button>
                            </>
                          ) : (
                            <div className="input-wrapper">
                              <input
                                type="text"
                                id="email_template_name"
                                name="email_template[name]"
                                className="form-control"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                onBlur={() => setTitleEdit(false)}
                                autoFocus
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="page-top__controls">
                      <PageSteps />

                      <div className="page-top__actions">
                        <div>
                          <a className="back btn btn-link" href="#" onClick={(e) => { e.preventDefault(); if (typeof props.onBack === 'function') props.onBack(); }}>
                            <i className="fas fa-chevron-left mr-1" />
                            <span>Back</span>
                          </a>
                          <button type="button" id="email_template_next" name="email_template[next]" className="btn-primary btn" onClick={() => { if (typeof props.onNext === 'function') props.onNext(composerState); }}>
                            Save & next
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </form>

              <div className="container">
                <div className="row">
                  <div id="template_create" className="w-100">
                    <div className="container">
                      <div className="row mt-4">
                        <div className="col-12 col-xl-2 mb-3 mb-xl-0">
                          <nav className="entity-search-sidebar">
                            <div className="entity-search-sidebar-block">
                              <div className="px-2 entity-search-sidebar-title"><span><strong>Templates</strong></span></div>
                              <a href="#" className="disabled px-2 entity-search-sidebar-item"><span>Yours</span></a>
                              <a href="#" className="active px-2 entity-search-sidebar-item"><span>Branded</span></a>
                              <a href="#" className="px-2 entity-search-sidebar-item"><span>Inspirational</span></a>
                            </div>
                          </nav>
                        </div>

                        <div className="col-xl-10">
                          <div>
                            <FilterBar sort={sort} onSort={setSort} />
                          </div>
                          {showEditor ? (
                            // Full-screen editor overlay
                            <div
                              role="dialog"
                              aria-modal="true"
                              aria-label="Template editor"
                              style={{
                                position: 'fixed',
                                inset: 0,
                                zIndex: 2000,
                                background: '#ffffff',
                                overflow: 'auto',
                                WebkitOverflowScrolling: 'touch'
                              }}
                            >
                              <div className="container-fluid px-3 py-2 border-bottom d-flex align-items-center justify-content-between">
                                <div>
                                  <strong style={{ fontSize: 18 }}>{selectedTemplate?.name || title || 'Template Editor'}</strong>
                                </div>
                                <div>
                                  <button className="btn btn-secondary mr-2" onClick={() => setShowEditor(false)}>Close</button>
                                </div>
                              </div>

                              <div style={{ padding: 16 }}>
                                <TemplateEditor template={selectedTemplate} composerState={composerState} />
                              </div>
                            </div>
                          ) : (
                            <TemplateGrid
                              templates={templates}
                              onPreview={(t) => { setSelectedTemplate(t); setPreviewOpen(true); }}
                              onChooseTemplate={(t) => { setSelectedTemplate(t); setShowEditor(true); if (typeof props.onTemplateChosen === 'function') props.onTemplateChosen(t); }}
                            />
                          )}
                          <div className="row align-items-stretch justify-content-between mx-0 position-relative transition-all">
                            <div className="index-pager-wrap entity-search-pagination-element justify-content-center justify-content-sm-end">
                              <div className="index-pager-box">
                                <button type="button" className="disabled border-0 bg-transparent small index-pager-arrow index-pager-left" disabled>
                                  <i className="fas fa-chevron-left" />
                                </button>
                                <span className="index-pager-text">1 to 6 of 6</span>
                                <button type="button" className="disabled border-0 bg-transparent small index-pager-arrow index-pager-right" disabled>
                                  <i className="fas fa-chevron-right" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <PreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} template={selectedTemplate} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
