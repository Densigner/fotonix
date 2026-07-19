import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { Search, ArrowRight, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import productsData from '../../data/productsData';

const gradientBtn =
  "bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 text-white hover:brightness-110 active:brightness-95 transition-all shadow-lg shadow-pink-500/20 rounded-xl";

// Helper function to navigate to hash-based routes from any page
const navigateToHash = (page) => {
  // Always navigate to root with hash to avoid /my-orders#member-dashboard issues
  window.location.href = `/#${page}`;
};

function Header({ currentPage, onShowLogin, onNavigate, onLogoClick, onSearch, onProductSelect, onClearSearch }) {
  const { isAuthenticated, logout, currentUser, userProfile } = useAuth();
  const isMember = currentUser?.email === 'joshmarsden28@gmail.com';
  const isAffiliate = !!userProfile?.affiliateCode;
  const [open, setOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false); // Track if user has searched
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);
  const mobileSearchInputRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // Calculate dropdown position when results change or search is performed
  useEffect(() => {
    console.log('searchResults changed:', searchResults, 'hasSearched:', hasSearched);
    if (hasSearched && searchContainerRef.current) {
      const rect = searchContainerRef.current.getBoundingClientRect();
      console.log('Setting dropdown position:', rect);
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width
      });
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  }, [searchResults, hasSearched]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (event) => {
      // Check if click is outside both the search container and any dropdown item
      const isOutsideSearch = searchContainerRef.current && !searchContainerRef.current.contains(event.target);
      const isDropdownClick = event.target.closest('[data-search-dropdown]');
      if (isOutsideSearch && !isDropdownClick) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Handle selecting a search result
  const handleResultSelect = (result) => {
    setShowDropdown(false);
    setSearchResults([]);
    setHasSearched(false);
    // Clear both inputs
    if (searchInputRef.current) searchInputRef.current.value = '';
    if (mobileSearchInputRef.current) mobileSearchInputRef.current.value = '';
    if (onProductSelect) onProductSelect(result);
    // Navigate based on the product link
    if (result.link === 'stencil-generator') {
      window.location.href = '/tools/stencil-generator';
    } else if (result.link === 'affiliate-product-accryl') {
      navigateToHash('affiliate-product-accryl');
    } else {
      navigateToHash('product');
    }
  };

  // Handle Go button click - search entirely within Header
  const handleGoClick = () => {
    const query = searchInputRef.current?.value || mobileSearchInputRef.current?.value || '';
    const q = query.trim().toLowerCase();
    
    console.log('productsData:', productsData);
    console.log('Query:', q);
    
    if (!q) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }
    
    // Search directly using imported productsData
    const results = (productsData || []).filter(p => {
      const nameMatch = (p.name || '').toLowerCase().includes(q);
      const descMatch = (p.description || '').toLowerCase().includes(q);
      console.log('Checking product:', p.name, 'nameMatch:', nameMatch, 'descMatch:', descMatch);
      return nameMatch || descMatch;
    });
    
    console.log('Search results:', results);
    setSearchResults(results);
    setHasSearched(true); // Mark that a search was performed
  };

  // Handle Enter key in search input
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleGoClick();
    }
  };

  const baseDesktopStyle = {
    background: 'linear-gradient(90deg, rgba(219,39,119,0.08), rgba(168,85,247,0.08), rgba(99,102,241,0.08)), #18132a',
    border: '2px solid #a855f7',
    outline: '2px solid #a855f7',
    outlineOffset: '0px',
    boxShadow: '0 0 0 2px #a855f7, 0 8px 24px rgba(2,6,23,0.6)'
  };

  const focusedDesktopExtras = searchFocused
    ? { border: '1px solid rgba(168,85,247,0.18)', boxShadow: '0 8px 30px rgba(99,102,241,0.12), 0 0 0 6px rgba(168,85,247,0.05)' }
    : {};

  const baseMobileStyle = {
    background: 'linear-gradient(90deg, rgba(219,39,119,0.08), rgba(168,85,247,0.08), rgba(99,102,241,0.08)), #18132a',
    border: '2px solid #a855f7',
    outline: '2px solid #a855f7',
    outlineOffset: '0px',
    boxShadow: '0 0 0 2px #a855f7'
  };

  const focusedMobileExtras = searchFocused
    ? { border: '1px solid rgba(168,85,247,0.16)', boxShadow: '0 6px 20px rgba(99,102,241,0.10)' }
    : {};

  return (
    <>
  <header style={{ zIndex: 11001 }} className="sticky top-0 z-50 w-full bg-neutral-950/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/60 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
        {/* Logo */}
        <a href="/" onClick={(e) => { e.preventDefault(); if (onLogoClick) { onLogoClick(); } else { window.location.href = '/'; } }} className="flex items-center gap-2 shrink-0">
          <img
            src="/images/finaleditlogo.png"
            alt="Fotonix"
            className="h-8 w-auto drop-shadow-[0_0_10px_rgba(168,85,247,0.7)]"
          />
        </a>

        {/* Desktop Nav - always show on product page to avoid logo-only collapse */}
  <nav className="hidden md:flex items-center gap-6 ml-2">
          {/* Products, Community, Store Builder, Members, Support, Affiliates, Advanced Inbox hidden for launch */}
          {isAuthenticated && isAffiliate ? (
            <button
              onClick={() => onNavigate ? onNavigate('affiliates') : navigateToHash('affiliates')}
              className="text-sm text-neutral-200 hover:text-white"
            >
              Affiliate Dashboard
            </button>
          ) : (
            <a href="/my-orders" className="text-sm text-neutral-200 hover:text-white">My Orders</a>
          )}
          <a href="/tools/stencil-generator" className="text-sm bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent font-semibold hover:from-purple-400 hover:to-pink-400">Stencil Generator</a>
          <a href="/tools/paint-by-numbers" className="text-sm bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent font-semibold hover:from-amber-300 hover:to-orange-400">PaintYourPhoto</a>
        </nav>

  {/* Desktop Search */}
  <div ref={searchContainerRef} className="hidden md:flex items-center gap-2 ml-4 relative">
          <div
            className="flex items-center rounded-xl px-3 py-1.5 transition w-full max-w-[28rem]"
            style={{ ...baseDesktopStyle, ...focusedDesktopExtras }}
          >
            <Search className="w-4 h-4 text-neutral-300" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search stencils, acrylic signs…"
              onKeyDown={handleKeyDown}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full bg-transparent outline-none placeholder-neutral-400 text-sm px-2 text-white caret-white"
              style={{ color: '#fff', caretColor: '#fff' }}
            />
            <button
              onClick={handleGoClick}
              className="px-3 py-1 text-xs font-medium bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 text-white hover:brightness-110 active:brightness-95 transition-all shadow-lg shadow-pink-500/20 rounded-xl flex items-center gap-1"
            >
              Go <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

  {/* Desktop Actions */}
  <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => onNavigate ? onNavigate('download') : navigateToHash('download')}
            className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 text-white hover:brightness-110 active:brightness-95 transition-all shadow-lg shadow-pink-500/20 rounded-xl px-4 py-2 text-sm font-semibold"
          >
            Download App
          </button>
          {isAuthenticated && isMember && (
            <button
              onClick={() => onNavigate ? onNavigate('member-dashboard') : navigateToHash('member-dashboard')}
              className="px-3 py-2 rounded-xl text-sm font-medium text-neutral-200 hover:text-white hover:bg-white/10 transition"
            >
              Member Dashboard
            </button>
          )}
          {isAuthenticated ? (
            <button
              onClick={() => onNavigate ? onNavigate('account') : navigateToHash('account')}
              className="px-3 py-2 rounded-xl text-sm font-medium text-neutral-200 hover:text-white hover:bg-white/10 transition flex items-center justify-center"
              aria-label="Account"
            >
              <User className="w-6 h-6" />
            </button>
          ) : (
            <button
              onClick={() => { if (onShowLogin) onShowLogin(); else navigateToHash('login'); }}
              className="px-3 py-2 rounded-xl text-sm font-medium text-neutral-200 hover:text-white hover:bg-white/10 transition"
            >
              Log in
            </button>
          )}
          {isAuthenticated ? (
            <button
              onClick={async () => {
                try {
                  await logout();
                  // Navigate back to home after logout
                  if (onNavigate) onNavigate('home');
                  else navigateToHash('home');
                } catch (error) {
                  console.error('Logout failed:', error);
                }
              }}
              className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 text-white hover:brightness-110 active:brightness-95 transition-all shadow-lg shadow-pink-500/20 rounded-xl px-4 py-2 text-sm font-semibold"
            >
              Sign Out
            </button>
          ) : (
            <button
              onClick={() => onNavigate ? onNavigate('signup') : navigateToHash('signup')}
              className="bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 text-white hover:brightness-110 active:brightness-95 transition-all shadow-lg shadow-pink-500/20 rounded-xl px-4 py-2 text-sm font-semibold"
            >
              Sign up
            </button>
          )}
        </div>

        {/* Mobile: search icon + hamburger */}
        <div className="md:hidden ml-auto flex items-center gap-1">
          <button
            aria-label="Search"
            className="p-2 rounded-xl text-neutral-200 hover:bg-white/10"
            onClick={() => setOpen((o) => (o ? o : true))}
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" />
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
            className="inline-flex items-center justify-center rounded-xl p-2 text-neutral-200 hover:bg-white/10 transition"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18" />
              )}
            </svg>
          </button>
        </div>

      </div>

      {/* Mobile panel */}
      {open && (
        <div className="md:hidden border-t border-white/10 bg-neutral-950/95 backdrop-blur">
          {/* Mobile search */}
          <div className="px-4 pt-3">
            <div
              className="flex items-center rounded-xl px-3 py-2 mb-2"
              style={{ ...baseMobileStyle, ...focusedMobileExtras }}
            >
              <svg className="w-5 h-5 text-neutral-300" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="2" />
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                ref={mobileSearchInputRef}
                type="text"
                placeholder="Search designs, creators, packs…"
                className="w-full bg-transparent outline-none placeholder-neutral-400 text-sm px-2 text-white caret-white"
                onKeyDown={handleKeyDown}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                style={{ color: '#fff', caretColor: '#fff' }}
              />
            </div>
          </div>

          {/* Mobile nav */}
          <nav className="px-4 py-2 space-y-1">
            {/* Products, Community, Store Builder, Members, Support, Affiliates, Advanced Inbox hidden for launch */}
            {isMember && (
              <button
                onClick={() => { setOpen(false); onNavigate ? onNavigate('member-dashboard') : navigateToHash('member-dashboard'); }}
                className="block w-full text-left px-2 py-2 rounded-lg text-fuchsia-300 hover:bg-white/10 font-medium"
              >
                ⚙️ Member Dashboard
              </button>
            )}
            {isAuthenticated && isAffiliate ? (
              <button
                onClick={() => { setOpen(false); onNavigate ? onNavigate('affiliates') : navigateToHash('affiliates'); }}
                className="block w-full text-left px-2 py-2 rounded-lg text-neutral-200 hover:bg-white/10"
              >
                📈 Affiliate Dashboard
              </button>
            ) : (
              <a href="/my-orders" className="block px-2 py-2 rounded-lg text-neutral-200 hover:bg-white/10">📦 My Orders</a>
            )}
            <a href="/tools/stencil-generator" className="block px-2 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold hover:from-purple-600 hover:to-pink-600">🎨 Stencil Generator</a>
            <a href="/tools/paint-by-numbers" className="block px-2 py-2 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold hover:from-amber-500 hover:to-orange-600">🖌️ PaintYourPhoto</a>
          </nav>

          {/* Mobile actions */}
          <div className="px-4 pb-4 flex items-center gap-3">
            <button onClick={() => onNavigate ? onNavigate('download') : navigateToHash('download')} className={`flex-1 text-center px-4 py-2 text-sm font-semibold bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 text-white hover:brightness-110 active:brightness-95 transition-all shadow-lg shadow-pink-500/20 rounded-xl`}>Download App</button>
            {isAuthenticated ? (
              <>
                <button onClick={() => onNavigate ? onNavigate('account') : navigateToHash('account')} className="flex-1 text-center px-4 py-2 rounded-xl text-sm font-medium text-neutral-200 hover:text-white hover:bg-white/10 transition">Account</button>
                <button 
                  onClick={async () => {
                    try {
                      await logout();
                      setOpen(false); // Close mobile menu
                      if (onNavigate) onNavigate('home');
                      else navigateToHash('home');
                    } catch (error) {
                      console.error('Logout failed:', error);
                    }
                  }}
                  className={`flex-1 text-center px-4 py-2 text-sm font-semibold bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 text-white hover:brightness-110 active:brightness-95 transition-all shadow-lg shadow-pink-500/20 rounded-xl`}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { if (onShowLogin) onShowLogin(); else navigateToHash('login'); }} className="flex-1 text-center px-4 py-2 rounded-xl text-sm font-medium text-neutral-200 hover:text-white hover:bg-white/10 transition">Log in</button>
                <button onClick={() => onNavigate ? onNavigate('signup') : navigateToHash('signup')} className={`flex-1 text-center px-4 py-2 text-sm font-semibold bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 text-white hover:brightness-110 active:brightness-95 transition-all shadow-lg shadow-pink-500/20 rounded-xl`}>Sign up</button>
              </>
            )}
          </div>
        </div>
      )}
      </header>

      {/* Search dropdown rendered via portal to escape sticky header clipping */}
      {(() => {
        console.log('Portal check - showDropdown:', showDropdown, 'searchResults:', searchResults, 'length:', searchResults?.length, 'hasSearched:', hasSearched);
        return null;
      })()}
      {showDropdown && hasSearched && ReactDOM.createPortal(
        <div 
          data-search-dropdown="true"
          style={{ 
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 999999
          }}
          className="bg-neutral-900 border border-fuchsia-700 rounded-xl shadow-2xl"
        >
          {searchResults && searchResults.length > 0 ? (
            searchResults.map((r) => (
              <div 
                key={r.id} 
                className="px-4 py-3 cursor-pointer hover:bg-fuchsia-900/40 first:rounded-t-xl last:rounded-b-xl" 
                onClick={() => handleResultSelect(r)}
              >
                <div className="font-semibold text-white">{r.name}</div>
                <div className="text-neutral-400 text-xs truncate">{r.description}</div>
              </div>
            ))
          ) : (
            <div className="px-4 py-4 text-center">
              <div className="text-neutral-400 text-sm">No results found</div>
              <div className="text-neutral-500 text-xs mt-1">Try searching for "stencil", "LED", or "acrylic"</div>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

export default React.memo(Header);