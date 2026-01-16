/**
 * AI Chatbot Service
 * 
 * Handles conversation logic, lead scoring, and conversion optimization
 * for the intelligent conversion chatbot
 */

import { API_URL } from '../config/environment';

const API_BASE_URL = `${API_URL}/api`;

export class ChatbotService {
  
  /**
   * Submit qualified lead from chatbot conversation
   */
  static async submitQualifiedLead(leadData) {
    try {
      const response = await fetch(`${API_BASE_URL}/chatbot/lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...leadData,
          source: 'ai-chatbot',
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          sessionId: this.getSessionId()
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Track chatbot conversion
      this.trackChatbotEvent('qualified_lead', leadData);
      
      return data;
    } catch (error) {
      console.error('Error submitting qualified lead:', error);
      
      // Fallback: store locally if server is down
      this.storeLeadLocally(leadData);
      
      throw error;
    }
  }

  /**
   * Track chatbot interaction events
   */
  static trackChatbotEvent(eventType, data = {}) {
    try {
      // Google Analytics (if available)
      if (window.gtag) {
        window.gtag('event', 'chatbot_interaction', {
          event_category: 'chatbot',
          event_label: eventType,
          custom_parameter_1: data.businessType || 'unknown',
          custom_parameter_2: data.conversationStage || 'unknown'
        });
      }

      // Facebook Pixel (if available)
      if (window.fbq) {
        window.fbq('track', 'Lead', {
          content_name: 'AI Chatbot Interaction',
          source: 'chatbot',
          event_type: eventType
        });
      }

      // Local tracking for analytics
      const events = JSON.parse(localStorage.getItem('chatbot_events') || '[]');
      events.push({
        eventType,
        data,
        timestamp: new Date().toISOString(),
        sessionId: this.getSessionId()
      });
      
      // Keep last 100 events
      if (events.length > 100) {
        events.splice(0, events.length - 100);
      }
      
      localStorage.setItem('chatbot_events', JSON.stringify(events));
      
    } catch (error) {
      console.error('Error tracking chatbot event:', error);
    }
  }

  /**
   * Calculate lead score based on conversation data
   */
  static calculateLeadScore(profile) {
    let score = 0;
    
    // Business type scoring
    const businessTypeScores = {
      'ecommerce': 85,
      'saas': 90,
      'agency': 80,
      'other': 60
    };
    score += businessTypeScores[profile.businessType] || 50;

    // Revenue scoring
    const revenueScores = {
      'small': 60,    // Under £10k
      'medium': 80,   // £10k-£50k  
      'large': 95     // £50k+
    };
    score += revenueScores[profile.monthlyRevenue] || 40;

    // Engagement scoring (based on conversation depth)
    if (profile.askedQuestions > 3) score += 20;
    if (profile.viewedResults) score += 15;
    if (profile.usedROICalculator) score += 25;
    if (profile.requestedDemo) score += 30;

    // Intent signals
    if (profile.expressedInterest) score += 25;
    if (profile.discussedBudget) score += 20;
    if (profile.mentionedTimeline) score += 15;

    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Get personalized messaging based on profile
   */
  static getPersonalizedMessage(profile, messageType) {
    const messages = {
      welcome: {
        ecommerce: "Hi! I help e-commerce stores like yours grow affiliate revenue by 200-400%. What's your biggest affiliate challenge?",
        saas: "Welcome! I specialize in helping SaaS companies build profitable affiliate programs. Ready to see some amazing results?",
        agency: "Hey there! I work with agencies to create white-label affiliate solutions for clients. Interested in adding this to your service stack?",
        default: "👋 Hi! I help businesses grow through strategic affiliate marketing. What brings you here today?"
      },
      
      objection_price: {
        small: "I understand budget is tight. Here's the thing - at £11.99/month, Fotonix typically pays for itself in the first week through increased affiliate sales.",
        medium: "Smart to consider ROI! Most businesses your size see £3,000-8,000 monthly increases. That's 250-650x return on the £11.99 investment.",
        large: "With your revenue level, the time savings alone justify the cost. You'll save 38+ hours monthly - worth £1,900+ at £50/hour."
      },
      
      closing: {
        high_score: "Based on our conversation, Fotonix is perfect for your business. I'm confident you'll see results in 30 days or less. Ready to get started?",
        medium_score: "You seem like an ideal fit for our system! Want to start with our risk-free trial? No commitment, cancel anytime.",
        low_score: "I think Fotonix could help, but let me answer any remaining questions first. What's holding you back?"
      }
    };

    const category = messages[messageType];
    if (!category) return "How can I help you today?";

    return category[profile.businessType] || 
           category[profile.monthlyRevenue] || 
           category[this.getScoreTier(profile)] ||
           category.default ||
           Object.values(category)[0];
  }

  /**
   * Get conversation recommendations based on user behavior
   */
  static getConversationRecommendations(profile) {
    const recommendations = [];
    
    // High intent signals - move to closing
    if (profile.leadScore > 80) {
      recommendations.push({
        priority: 'high',
        action: 'close',
        message: 'Strong buying signals detected - present offer'
      });
    }
    
    // Address specific concerns
    if (profile.mentionedPrice && !profile.understoodValue) {
      recommendations.push({
        priority: 'medium', 
        action: 'show_roi',
        message: 'Price concern detected - show ROI calculator'
      });
    }
    
    if (profile.businessType && !profile.sawRelevantCase) {
      recommendations.push({
        priority: 'medium',
        action: 'show_case_study', 
        message: `Show ${profile.businessType} case study`
      });
    }

    // Build trust for skeptical users
    if (profile.expressedSkepticism) {
      recommendations.push({
        priority: 'high',
        action: 'build_trust',
        message: 'Address skepticism with social proof and guarantee'
      });
    }

    return recommendations;
  }

  /**
   * Store lead locally if server unavailable
   */
  static storeLeadLocally(leadData) {
    try {
      const leads = JSON.parse(localStorage.getItem('offline_chatbot_leads') || '[]');
      leads.push({
        ...leadData,
        timestamp: new Date().toISOString(),
        synced: false
      });
      localStorage.setItem('offline_chatbot_leads', JSON.stringify(leads));
    } catch (error) {
      console.error('Error storing chatbot lead locally:', error);
    }
  }

  /**
   * Get or create session ID
   */
  static getSessionId() {
    let sessionId = sessionStorage.getItem('chatbot_session_id');
    if (!sessionId) {
      sessionId = 'chatbot_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('chatbot_session_id', sessionId);
    }
    return sessionId;
  }

  /**
   * Get lead score tier for messaging
   */
  static getScoreTier(profile) {
    const score = this.calculateLeadScore(profile);
    if (score >= 80) return 'high_score';
    if (score >= 60) return 'medium_score';
    return 'low_score';
  }

  /**
   * Check if user should see chatbot based on behavior
   */
  static shouldShowChatbot() {
    // Don't show if user already converted
    if (localStorage.getItem('user_converted')) return false;
    
    // Don't show if dismissed recently (within 24 hours)
    const lastDismissed = localStorage.getItem('chatbot_dismissed');
    if (lastDismissed) {
      const dismissedTime = new Date(lastDismissed);
      const now = new Date();
      const hoursSinceDismiss = (now - dismissedTime) / (1000 * 60 * 60);
      if (hoursSinceDismiss < 24) return false;
    }
    
    // Show based on page engagement signals
    const timeOnSite = this.getTimeOnSite();
    const pageViews = this.getPageViewCount();
    
    return timeOnSite > 30000 || pageViews > 2; // 30 seconds or 2+ pages
  }

  /**
   * Get time spent on site
   */
  static getTimeOnSite() {
    const startTime = sessionStorage.getItem('site_start_time');
    if (!startTime) {
      sessionStorage.setItem('site_start_time', Date.now().toString());
      return 0;
    }
    return Date.now() - parseInt(startTime);
  }

  /**
   * Get page view count
   */
  static getPageViewCount() {
    const count = sessionStorage.getItem('page_view_count') || '0';
    const newCount = parseInt(count) + 1;
    sessionStorage.setItem('page_view_count', newCount.toString());
    return newCount;
  }

  /**
   * Mark chatbot as dismissed
   */
  static markChatbotDismissed() {
    localStorage.setItem('chatbot_dismissed', new Date().toISOString());
  }

  /**
   * Get conversation analytics for optimization
   */
  static getConversationAnalytics() {
    try {
      const events = JSON.parse(localStorage.getItem('chatbot_events') || '[]');
      
      const analytics = {
        totalConversations: new Set(events.map(e => e.sessionId)).size,
        totalInteractions: events.length,
        conversionRate: 0,
        commonDropOffPoints: {},
        averageConversationLength: 0,
        topIntents: {}
      };

      // Calculate conversion rate
      const conversions = events.filter(e => e.eventType === 'conversion').length;
      analytics.conversionRate = analytics.totalConversations > 0 
        ? (conversions / analytics.totalConversations * 100).toFixed(2)
        : 0;

      // Calculate average conversation length  
      const conversationLengths = {};
      events.forEach(event => {
        if (!conversationLengths[event.sessionId]) {
          conversationLengths[event.sessionId] = 0;
        }
        conversationLengths[event.sessionId]++;
      });
      
      const lengths = Object.values(conversationLengths);
      analytics.averageConversationLength = lengths.length > 0
        ? (lengths.reduce((a, b) => a + b, 0) / lengths.length).toFixed(1)
        : 0;

      return analytics;
    } catch (error) {
      console.error('Error getting conversation analytics:', error);
      return {};
    }
  }
}