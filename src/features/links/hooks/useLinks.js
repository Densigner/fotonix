import { useState, useEffect, useMemo } from 'react';

/**
 * useLinks - Unified hook for link data management
 * Supports both member and affiliate use cases with role-based filtering
 * 
 * @param {Object} config - Configuration object
 * @param {string} config.userType - 'member' | 'affiliate' | 'admin'
 * @param {string} config.userId - Current user's ID
 * @param {string} config.affiliateCode - Affiliate code (for affiliate users)
 * @param {string} config.apiBase - API base URL
 * @returns {Object} Link data and management functions
 */
export function useLinks({ 
  userType = 'affiliate', 
  userId, 
  affiliateCode, 
  apiBase = '' 
} = {}) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI state
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [query, setQuery] = useState('');

  // Fetch links based on user type
  useEffect(() => {
    let mounted = true;
    
    async function fetchLinks() {
      setLoading(true);
      setError(null);
      
      try {
        let url;
        
        // Build API URL based on user type
        switch (userType) {
          case 'member':
            url = `${apiBase}/api/member/links${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`;
            break;
          case 'affiliate':
            url = `${apiBase}/api/links?user=${encodeURIComponent(affiliateCode || userId)}`;
            break;
          case 'admin':
            url = `${apiBase}/api/admin/links`;
            break;
          default:
            throw new Error('Invalid user type');
        }
        
        const response = await fetch(url, { cache: 'no-store' });
        
        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!mounted) return;
        
        // Normalize data format
        let normalizedLinks = [];
        if (Array.isArray(data)) {
          normalizedLinks = data.map(normalizeLink);
        } else if (data && Array.isArray(data.links)) {
          normalizedLinks = data.links.map(normalizeLink);
        } else {
          normalizedLinks = [];
        }
        
        setLinks(normalizedLinks);
        
      } catch (err) {
        console.warn('Links API error:', err.message);
        if (mounted) {
          setError(err.message);
          // Fallback to mock data for development
          if (process.env.NODE_ENV === 'development') {
            setLinks(generateMockLinks(12).map(normalizeLink));
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    
    fetchLinks();
    return () => { mounted = false; };
  }, [userType, userId, affiliateCode, apiBase]);

  // Normalize link data to consistent format
  function normalizeLink(link) {
    return {
      id: link.id || link.slug || Math.random().toString(36).slice(2),
      slug: link.slug,
      url: link.url || `${window.location.origin}/l/${link.slug}`,
      destination: link.destination || link.target || link.productUrl || '',
      
      // Product/Affiliate info
      productId: link.productId,
      affiliateId: link.affiliateId,
      createdById: link.createdById || link.memberId,
      createdByType: link.createdByType || userType,
      
      // Commission settings
      commissionRate: link.commissionRate || link.linkCustomRatePct / 100 || 0.1,
      customRate: link.customRate || Boolean(link.linkCustomRatePct),
      
      // Analytics
      clicks: Number(link.clicks || link.clicks_count || 0),
      conversions: Number(link.conversions || 0),
      revenue: Number(link.revenue || 0),
      uniqueVisitors: Number(link.unique_visitors || link.uniqueVisitors || 0),
      
      // Metadata
      title: link.title,
      description: link.description,
      status: link.status || 'active',
      createdAt: link.created_at || link.createdAt || new Date().toISOString(),
      updatedAt: link.updated_at || link.updatedAt,
      lastClickAt: link.last_click || link.lastClickAt || link.lastClick
    };
  }

  // Filter links based on search query
  const filteredLinks = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return links;
    
    return links.filter(link => {
      return (
        (link.slug || '').toLowerCase().includes(q) ||
        (link.destination || '').toLowerCase().includes(q) ||
        (link.title || '').toLowerCase().includes(q) ||
        (link.description || '').toLowerCase().includes(q)
      );
    });
  }, [links, query]);

  // Sort links
  const sortedLinks = useMemo(() => {
    const sorted = [...filteredLinks];
    
    sorted.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      
      // Handle date fields
      if (sortKey === 'createdAt' || sortKey === 'updatedAt' || sortKey === 'lastClickAt') {
        const aTime = aVal ? new Date(aVal).getTime() : 0;
        const bTime = bVal ? new Date(bVal).getTime() : 0;
        return sortDir === 'asc' ? aTime - bTime : bTime - aTime;
      }
      
      // Handle numeric fields
      if (typeof aVal === 'number' || typeof bVal === 'number') {
        return sortDir === 'asc' ? (aVal || 0) - (bVal || 0) : (bVal || 0) - (aVal || 0);
      }
      
      // Handle string fields
      const aStr = (aVal || '').toString().toLowerCase();
      const bStr = (bVal || '').toString().toLowerCase();
      
      if (aStr < bStr) return sortDir === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [filteredLinks, sortKey, sortDir]);

  // Sorting functions
  const toggleSort = (key) => {
    if (key === sortKey) {
      setSortDir(dir => dir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // CRUD operations
  const createLink = async (linkData) => {
    try {
      const response = await fetch(`${apiBase}/api/member/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(linkData)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create link: ${response.status}`);
      }
      
      const newLink = await response.json();
      const normalized = normalizeLink(newLink);
      setLinks(prev => [normalized, ...prev]);
      return normalized;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  const updateLink = async (linkId, updates) => {
    try {
      const response = await fetch(`${apiBase}/api/links/${linkId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update link: ${response.status}`);
      }
      
      const updatedLink = await response.json();
      const normalized = normalizeLink(updatedLink);
      setLinks(prev => prev.map(link => link.id === linkId ? normalized : link));
      return normalized;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  const deleteLink = async (linkId) => {
    try {
      const response = await fetch(`${apiBase}/api/links/${linkId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete link: ${response.status}`);
      }
      
      setLinks(prev => prev.filter(link => link.id !== linkId));
      return true;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };

  // Utility functions
  const copyLinkToClipboard = async (slug) => {
    const url = `${window.location.origin}/l/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch (error) {
      console.error('Failed to copy link:', error);
      return false;
    }
  };

  return {
    // Data
    links: sortedLinks,
    filteredLinks,
    loading,
    error,
    
    // Search & sorting
    query,
    setQuery,
    sortKey,
    sortDir,
    toggleSort,
    
    // CRUD operations
    createLink,
    updateLink,
    deleteLink,
    
    // Utilities
    copyLinkToClipboard,
    
    // Refresh
    refresh: () => {
      setLoading(true);
      // This will trigger the useEffect to refetch
    }
  };
}

// Mock data generator for development/fallback
function generateMockLinks(count = 12) {
  const mockLinks = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    const createdAt = new Date(now - i * 1000 * 60 * 60 * 24).toISOString();
    mockLinks.push({
      id: `link-${i}`,
      slug: `promo-${100 + i}`,
      destination: `https://example.com/product/${100 + i}`,
      title: `Promo Link ${100 + i}`,
      clicks: Math.floor(Math.random() * 500),
      conversions: Math.floor(Math.random() * 50),
      revenue: Math.floor(Math.random() * 1000),
      unique_visitors: Math.floor(Math.random() * 400),
      commissionRate: 0.1 + (Math.random() * 0.2), // 10-30%
      created_at: createdAt,
      last_click: i % 3 === 0 ? new Date(now - i * 1000 * 60 * 60).toISOString() : null,
      status: ['active', 'paused'][Math.floor(Math.random() * 2)]
    });
  }
  
  return mockLinks;
}

export default useLinks;