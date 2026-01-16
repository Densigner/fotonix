/**
 * Email Capture Service
 * 
 * Handles email submissions from exit-intent popup and other lead magnets
 * Stores leads in database and triggers email automation
 */

import { API_URL } from '../config/environment';

const API_BASE_URL = `${API_URL}/api`;

export class EmailCaptureService {
  
  /**
   * Submit email for lead magnet download
   */
  static async submitLeadMagnet(email, source = 'exit-intent-popup') {
    try {
      const response = await fetch(`${API_BASE_URL}/leads/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          source,
          leadMagnet: 'affiliate-revenue-playbook',
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          referrer: document.referrer || 'direct'
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Track successful conversion
      this.trackConversion(email, source);
      
      return data;
    } catch (error) {
      console.error('Error submitting lead magnet email:', error);
      
      // Fallback: store locally if server is down
      this.storeLeadLocally(email, source);
      
      throw error;
    }
  }

  /**
   * Track conversion event for analytics
   */
  static trackConversion(email, source) {
    try {
      // Google Analytics (if available)
      if (window.gtag) {
        window.gtag('event', 'lead_capture', {
          event_category: 'conversion',
          event_label: source,
          custom_parameter_1: email
        });
      }

      // Facebook Pixel (if available)
      if (window.fbq) {
        window.fbq('track', 'Lead', {
          content_name: 'Affiliate Revenue Playbook',
          source: source
        });
      }

      // Local tracking for dashboard
      const conversions = JSON.parse(localStorage.getItem('conversions') || '[]');
      conversions.push({
        email,
        source,
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('conversions', JSON.stringify(conversions));
      
    } catch (error) {
      console.error('Error tracking conversion:', error);
    }
  }

  /**
   * Store lead locally as fallback
   */
  static storeLeadLocally(email, source) {
    try {
      const leads = JSON.parse(localStorage.getItem('offline_leads') || '[]');
      leads.push({
        email,
        source,
        timestamp: new Date().toISOString(),
        synced: false
      });
      localStorage.setItem('offline_leads', JSON.stringify(leads));
      
      // Try to sync later
      setTimeout(() => this.syncOfflineLeads(), 5000);
    } catch (error) {
      console.error('Error storing lead locally:', error);
    }
  }

  /**
   * Sync offline leads when connection is restored
   */
  static async syncOfflineLeads() {
    try {
      const leads = JSON.parse(localStorage.getItem('offline_leads') || '[]');
      const unsynced = leads.filter(lead => !lead.synced);
      
      for (const lead of unsynced) {
        try {
          await this.submitLeadMagnet(lead.email, lead.source + '_offline_sync');
          lead.synced = true;
        } catch (error) {
          console.error('Failed to sync lead:', lead.email, error);
        }
      }
      
      // Update local storage with sync status
      localStorage.setItem('offline_leads', JSON.stringify(leads));
      
    } catch (error) {
      console.error('Error syncing offline leads:', error);
    }
  }

  /**
   * Get lead magnet download link
   */
  static async getDownloadLink(email) {
    try {
      const response = await fetch(`${API_BASE_URL}/leads/download-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting download link:', error);
      
      // Return fallback download link
      return {
        downloadUrl: '/assets/affiliate-revenue-playbook.pdf',
        message: 'Your playbook is ready for download!'
      };
    }
  }

  /**
   * Check if email has already been captured
   */
  static hasEmailBeenCaptured(email) {
    try {
      // Check localStorage for recent submissions
      const recent = JSON.parse(localStorage.getItem('recent_captures') || '[]');
      const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      
      return recent.some(capture => 
        capture.email === email && 
        new Date(capture.timestamp).getTime() > cutoff
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Mark email as recently captured
   */
  static markEmailCaptured(email) {
    try {
      const recent = JSON.parse(localStorage.getItem('recent_captures') || '[]');
      recent.push({
        email,
        timestamp: new Date().toISOString()
      });
      
      // Keep only last 100 entries
      if (recent.length > 100) {
        recent.splice(0, recent.length - 100);
      }
      
      localStorage.setItem('recent_captures', JSON.stringify(recent));
    } catch (error) {
      console.error('Error marking email as captured:', error);
    }
  }

  /**
   * Validate email format
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get conversion stats for dashboard
   */
  static getConversionStats() {
    try {
      const conversions = JSON.parse(localStorage.getItem('conversions') || '[]');
      const today = new Date().toDateString();
      
      const todayConversions = conversions.filter(c => 
        new Date(c.timestamp).toDateString() === today
      );

      const sourceBreakdown = conversions.reduce((acc, conversion) => {
        acc[conversion.source] = (acc[conversion.source] || 0) + 1;
        return acc;
      }, {});

      return {
        total: conversions.length,
        today: todayConversions.length,
        sources: sourceBreakdown,
        recent: conversions.slice(-10).reverse()
      };
    } catch (error) {
      console.error('Error getting conversion stats:', error);
      return { total: 0, today: 0, sources: {}, recent: [] };
    }
  }
}