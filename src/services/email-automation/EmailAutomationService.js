import { database } from '../../firebase';
import { ref, set, get, update, push, onValue } from 'firebase/database';

/**
 * EmailAutomationService
 * 
 * Connects revenue tools from Store Builder to VPS mail client
 * Handles all 7 email campaign types automatically
 */
class EmailAutomationService {
  constructor() {
    this.campaignTypes = {
      POST_PURCHASE: 'post_purchase_journey',
      WIN_BACK: 'win_back_campaign',
      ABANDONED_CART: 'abandoned_cart_recovery',
      ONE_CLICK_UPSELL: 'one_click_upsell',
      PERSONALIZED_RECOMMENDATION: 'personalized_recommendation',
      PRODUCT_FOLLOW_UP: 'product_follow_up',
      ANNIVERSARY: 'anniversary_memory_lane'
    };
  }

  /**
   * Initialize automation for a store based on revenue tools selection
   */
  async initializeStoreAutomation(storeId, selectedCampaigns) {
    try {
      const automationRef = ref(database, `stores/${storeId}/emailAutomation`);
      
      const automationConfig = {
        enabled: true,
        campaigns: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Map each selected campaign to configuration
      selectedCampaigns.forEach(campaign => {
        automationConfig.campaigns[campaign] = this.getDefaultCampaignConfig(campaign);
      });

      await set(automationRef, automationConfig);
      
      console.log(`✅ Email automation initialized for store ${storeId}`);
      return { success: true, config: automationConfig };
    } catch (error) {
      console.error('Error initializing store automation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get default configuration for each campaign type
   */
  getDefaultCampaignConfig(campaignType) {
    const configs = {
      [this.campaignTypes.POST_PURCHASE]: {
        enabled: true,
        sequence: [
          { delay: 0, template: 'thank_you', subject: 'Thank you for your order!' },
          { delay: 24, template: 'usage_guide', subject: 'Getting started with your {{product_name}}' },
          { delay: 72, template: 'recommended_addon', subject: 'Complete your collection' },
          { delay: 168, template: 'request_review', subject: 'How are you enjoying your {{product_name}}?' },
          { delay: 336, template: 'vip_discount', subject: 'VIP discount just for you!' }
        ]
      },
      [this.campaignTypes.WIN_BACK]: {
        enabled: true,
        sequence: [
          { delay: 720, template: 'we_miss_you', subject: 'We miss you!' }, // 30 days
          { delay: 1440, template: 'product_suggestion', subject: 'New products you might love' }, // 60 days
          { delay: 2160, template: 'personalized_offer', subject: 'Special offer just for you' } // 90 days
        ]
      },
      [this.campaignTypes.ABANDONED_CART]: {
        enabled: true,
        sequence: [
          { delay: 1, template: 'cart_reminder', subject: 'You left something behind...' },
          { delay: 24, template: 'need_help', subject: 'Need help completing your order?' },
          { delay: 72, template: 'cart_discount', subject: 'Here\'s 10% off to complete your order' }
        ]
      },
      [this.campaignTypes.ONE_CLICK_UPSELL]: {
        enabled: true,
        sequence: [
          { delay: 1, template: 'deluxe_upgrade', subject: 'Upgrade to the deluxe version?' },
          { delay: 24, template: 'accessory_offer', subject: 'Add this accessory at 20% off' },
          { delay: 72, template: 'customers_also_bought', subject: 'Customers also bought...' }
        ]
      },
      [this.campaignTypes.PERSONALIZED_RECOMMENDATION]: {
        enabled: true,
        aiEnabled: true,
        triggers: ['past_purchases', 'browsing_history', 'style_matching'],
        frequency: 168 // Weekly
      },
      [this.campaignTypes.PRODUCT_FOLLOW_UP]: {
        enabled: true,
        sequence: [
          { delay: 168, template: 'check_in_7day', subject: 'How\'s it going?' }, // 7 days
          { delay: 336, template: 'photo_incentive', subject: 'Share a photo & get 10% off!' }, // 14 days
          { delay: 720, template: 'cross_sell_30day', subject: 'Want a matching piece?' } // 30 days
        ]
      },
      [this.campaignTypes.ANNIVERSARY]: {
        enabled: true,
        sequence: [
          { template: 'anniversary_reminder', subject: 'This time last year...' },
          { template: 'upgrade_offer', subject: 'Here\'s an upgraded version' },
          { template: 'matching_products', subject: 'Complete your collection' }
        ]
      }
    };

    return configs[campaignType] || { enabled: false };
  }

  /**
   * Trigger post-purchase email journey
   */
  async triggerPostPurchase(orderId, orderData) {
    try {
      const { storeId, customerId, products } = orderData;
      
      // Check if store has post-purchase automation enabled
      const automationRef = ref(database, `stores/${storeId}/emailAutomation/campaigns/${this.campaignTypes.POST_PURCHASE}`);
      const snapshot = await get(automationRef);
      
      if (!snapshot.exists() || !snapshot.val().enabled) {
        console.log('Post-purchase automation not enabled for this store');
        return { success: false, reason: 'not_enabled' };
      }

      const config = snapshot.val();
      
      // Schedule each email in the sequence
      const scheduledEmails = [];
      for (const email of config.sequence) {
        const scheduledEmail = await this.scheduleEmail({
          storeId,
          customerId,
          orderId,
          template: email.template,
          subject: email.subject,
          delay: email.delay,
          data: {
            products,
            orderDate: orderData.createdAt
          }
        });
        scheduledEmails.push(scheduledEmail);
      }

      console.log(`✅ Post-purchase journey scheduled for order ${orderId}`);
      return { success: true, scheduled: scheduledEmails };
    } catch (error) {
      console.error('Error triggering post-purchase journey:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Trigger abandoned cart recovery
   */
  async triggerAbandonedCart(cartId, cartData) {
    try {
      const { storeId, customerId, items, createdAt } = cartData;
      
      const automationRef = ref(database, `stores/${storeId}/emailAutomation/campaigns/${this.campaignTypes.ABANDONED_CART}`);
      const snapshot = await get(automationRef);
      
      if (!snapshot.exists() || !snapshot.val().enabled) {
        return { success: false, reason: 'not_enabled' };
      }

      const config = snapshot.val();
      const scheduledEmails = [];
      
      for (const email of config.sequence) {
        const scheduledEmail = await this.scheduleEmail({
          storeId,
          customerId,
          cartId,
          template: email.template,
          subject: email.subject,
          delay: email.delay,
          data: {
            items,
            cartValue: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            abandonedAt: createdAt
          }
        });
        scheduledEmails.push(scheduledEmail);
      }

      console.log(`✅ Abandoned cart recovery scheduled for cart ${cartId}`);
      return { success: true, scheduled: scheduledEmails };
    } catch (error) {
      console.error('Error triggering abandoned cart:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Trigger win-back campaign
   */
  async triggerWinBack(customerId, customerData) {
    try {
      const { storeId, lastPurchaseDate } = customerData;
      const daysSinceLastPurchase = Math.floor((Date.now() - lastPurchaseDate) / (1000 * 60 * 60 * 24));
      
      const automationRef = ref(database, `stores/${storeId}/emailAutomation/campaigns/${this.campaignTypes.WIN_BACK}`);
      const snapshot = await get(automationRef);
      
      if (!snapshot.exists() || !snapshot.val().enabled) {
        return { success: false, reason: 'not_enabled' };
      }

      const config = snapshot.val();
      
      // Determine which email to send based on days since last purchase
      let emailToSend = null;
      if (daysSinceLastPurchase >= 90) {
        emailToSend = config.sequence[2]; // 90-day personalized offer
      } else if (daysSinceLastPurchase >= 60) {
        emailToSend = config.sequence[1]; // 60-day product suggestion
      } else if (daysSinceLastPurchase >= 30) {
        emailToSend = config.sequence[0]; // 30-day "we miss you"
      }

      if (!emailToSend) {
        return { success: false, reason: 'too_soon' };
      }

      const scheduledEmail = await this.scheduleEmail({
        storeId,
        customerId,
        template: emailToSend.template,
        subject: emailToSend.subject,
        delay: 0, // Send immediately
        data: {
          daysSinceLastPurchase,
          lastPurchaseDate: customerData.lastPurchaseDate
        }
      });

      console.log(`✅ Win-back campaign triggered for customer ${customerId}`);
      return { success: true, scheduled: [scheduledEmail] };
    } catch (error) {
      console.error('Error triggering win-back campaign:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Schedule an email to be sent via VPS mail client
   */
  async scheduleEmail(emailData) {
    try {
      const { storeId, customerId, template, subject, delay, data } = emailData;
      
      const scheduledEmailRef = push(ref(database, 'emailQueue'));
      const emailId = scheduledEmailRef.key;
      
      const emailJob = {
        id: emailId,
        storeId,
        customerId,
        template,
        subject,
        scheduledFor: Date.now() + (delay * 60 * 60 * 1000), // Convert hours to milliseconds
        status: 'scheduled',
        data,
        createdAt: Date.now()
      };

      await set(scheduledEmailRef, emailJob);
      
      return { success: true, emailId, scheduledFor: emailJob.scheduledFor };
    } catch (error) {
      console.error('Error scheduling email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get store's automation configuration
   */
  async getStoreAutomationConfig(storeId) {
    try {
      const automationRef = ref(database, `stores/${storeId}/emailAutomation`);
      const snapshot = await get(automationRef);
      
      if (!snapshot.exists()) {
        return { success: false, reason: 'not_configured' };
      }

      return { success: true, config: snapshot.val() };
    } catch (error) {
      console.error('Error getting automation config:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update campaign settings
   */
  async updateCampaignSettings(storeId, campaignType, settings) {
    try {
      const campaignRef = ref(database, `stores/${storeId}/emailAutomation/campaigns/${campaignType}`);
      
      await update(campaignRef, {
        ...settings,
        updatedAt: Date.now()
      });

      console.log(`✅ Campaign settings updated for ${campaignType}`);
      return { success: true };
    } catch (error) {
      console.error('Error updating campaign settings:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enable/disable specific campaign
   */
  async toggleCampaign(storeId, campaignType, enabled) {
    try {
      const campaignRef = ref(database, `stores/${storeId}/emailAutomation/campaigns/${campaignType}/enabled`);
      await set(campaignRef, enabled);

      console.log(`✅ Campaign ${campaignType} ${enabled ? 'enabled' : 'disabled'}`);
      return { success: true };
    } catch (error) {
      console.error('Error toggling campaign:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get analytics for email campaigns
   */
  async getCampaignAnalytics(storeId, campaignType, dateRange) {
    try {
      const analyticsRef = ref(database, `stores/${storeId}/emailAnalytics/${campaignType}`);
      const snapshot = await get(analyticsRef);
      
      if (!snapshot.exists()) {
        return { success: true, data: { sent: 0, opened: 0, clicked: 0, converted: 0 } };
      }

      return { success: true, data: snapshot.val() };
    } catch (error) {
      console.error('Error getting campaign analytics:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export const emailAutomationService = new EmailAutomationService();
export default EmailAutomationService;
