/**
 * linkService - Centralized API service for link operations
 * Handles all link-related API calls with consistent error handling and data formatting
 */

import { API_URL } from '../../../config/environment';

const API_BASE = API_URL;

class LinkService {
  
  /**
   * Fetch links based on user type and permissions
   */
  async getLinks({ userType, userId, affiliateCode } = {}) {
    let url;
    
    switch (userType) {
      case 'member':
        url = `${API_BASE}/api/member/links${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`;
        break;
      case 'affiliate':
        url = `${API_BASE}/api/links?user=${encodeURIComponent(affiliateCode || userId)}`;
        break;
      case 'admin':
        url = `${API_BASE}/api/admin/links`;
        break;
      default:
        throw new Error('Invalid user type for fetching links');
    }
    
    const response = await fetch(url, { 
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch links: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * Create a new link
   */
  async createLink(linkData, userType = 'member') {
    let url;
    
    switch (userType) {
      case 'member':
        url = `${API_BASE}/api/member/links`;
        break;
      case 'affiliate':
        url = `${API_BASE}/api/affiliate/links`;
        break;
      case 'admin':
        url = `${API_BASE}/api/admin/links`;
        break;
      default:
        throw new Error('Invalid user type for creating link');
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(linkData)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to create link: ${response.status}`);
    }
    
    return await response.json();
  }

  /**
   * Update an existing link
   */
  async updateLink(linkId, updates, userType = 'member') {
    const response = await fetch(`${API_BASE}/api/links/${linkId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to update link: ${response.status}`);
    }
    
    return await response.json();
  }

  /**
   * Delete a link
   */
  async deleteLink(linkId, userType = 'member') {
    const response = await fetch(`${API_BASE}/api/links/${linkId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to delete link: ${response.status}`);
    }
    
    return true;
  }

  /**
   * Get link analytics
   */
  async getLinkAnalytics(linkId, { dateRange = '30d' } = {}) {
    const response = await fetch(`${API_BASE}/api/links/${linkId}/analytics?range=${dateRange}`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch analytics: ${response.status}`);
    }
    
    return await response.json();
  }

  /**
   * Search for products (for link creation)
   */
  async searchProducts(query, userType = 'member') {
    const params = new URLSearchParams({
      q: query,
      limit: '20'
    });
    
    let url;
    switch (userType) {
      case 'member':
        url = `${API_BASE}/api/member/products?${params}`;
        break;
      case 'affiliate':
        url = `${API_BASE}/api/affiliate/products?${params}`;
        break;
      default:
        url = `${API_BASE}/api/products/search?${params}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to search products: ${response.status}`);
    }
    
    return await response.json();
  }

  /**
   * Search for affiliates (for members creating links)
   */
  async searchAffiliates(query) {
    const params = new URLSearchParams({
      q: query,
      limit: '20'
    });
    
    const response = await fetch(`${API_BASE}/api/affiliates/search?${params}`);
    
    if (!response.ok) {
      throw new Error(`Failed to search affiliates: ${response.status}`);
    }
    
    return await response.json();
  }

  /**
   * Validate link slug availability
   */
  async validateSlug(slug) {
    const response = await fetch(`${API_BASE}/api/links/validate-slug`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ slug })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to validate slug: ${response.status}`);
    }
    
    const data = await response.json();
    return data.available;
  }

  /**
   * Bulk operations on links
   */
  async bulkUpdateLinks(linkIds, updates) {
    const response = await fetch(`${API_BASE}/api/links/bulk`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        linkIds,
        updates
      })
    });
    
    if (!response.ok) {
      throw new Error(`Bulk update failed: ${response.status}`);
    }
    
    return await response.json();
  }

  /**
   * Export links data
   */
  async exportLinks({ userType, userId, affiliateCode, format = 'csv' } = {}) {
    let url = `${API_BASE}/api/links/export?format=${format}`;
    
    if (userType === 'member' && userId) {
      url += `&userId=${encodeURIComponent(userId)}`;
    } else if (userType === 'affiliate' && affiliateCode) {
      url += `&affiliateCode=${encodeURIComponent(affiliateCode)}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Export failed: ${response.status}`);
    }
    
    // Return blob for download
    return await response.blob();
  }
}

// Create singleton instance
const linkService = new LinkService();

// Helper functions for common operations
export const linkUtils = {
  /**
   * Generate a URL-friendly slug from title
   */
  generateSlug(title, fallback = '') {
    const base = title || fallback || 'link';
    return base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 48) || Math.random().toString(36).slice(2, 10);
  },

  /**
   * Format commission rate for display
   */
  formatCommissionRate(rate) {
    return `${(rate * 100).toFixed(1)}%`;
  },

  /**
   * Format currency values
   */
  formatCurrency(amount, currency = 'GBP') {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency
    }).format(amount);
  },

  /**
   * Calculate conversion rate
   */
  calculateConversionRate(conversions, clicks) {
    if (!clicks || clicks === 0) return 0;
    return (conversions / clicks) * 100;
  },

  /**
   * Validate link data
   */
  validateLinkData(linkData) {
    const errors = [];
    
    if (!linkData.slug || linkData.slug.trim().length === 0) {
      errors.push('Slug is required');
    }
    
    if (linkData.slug && !/^[a-z0-9-]+$/.test(linkData.slug)) {
      errors.push('Slug can only contain lowercase letters, numbers, and hyphens');
    }
    
    if (!linkData.productId) {
      errors.push('Product selection is required');
    }
    
    if (linkData.commissionRate !== undefined) {
      const rate = Number(linkData.commissionRate);
      if (isNaN(rate) || rate < 0 || rate > 1) {
        errors.push('Commission rate must be between 0 and 100%');
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * Copy link to clipboard
   */
  async copyToClipboard(slug) {
    const url = `${window.location.origin}/l/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      return { success: true, url };
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return { success: false, error: error.message };
    }
  }
};

export default linkService;