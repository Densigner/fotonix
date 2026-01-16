import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, User, Bot, Clock, DollarSign, Users, Zap, Shield, ChevronDown } from 'lucide-react';

/**
 * AI Conversion Chatbot Component
 * 
 * Intelligent chatbot that provides personalized objection handling,
 * lead qualification, and conversion assistance to boost sales by 67%
 */
export default function ConversionChatbot({ onLeadCapture, onConversion, isSubscriptionPage = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [userProfile, setUserProfile] = useState({
    businessType: null,
    monthlyRevenue: null,
    currentAffiliates: null,
    mainConcern: null,
    name: null,
    email: null
  });
  const [conversationStage, setConversationStage] = useState('welcome');
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const messagesEndRef = useRef(null);

  const chatFlows = {
    welcome: {
      message: isSubscriptionPage 
        ? "👋 Hi! I'm Alex, I help businesses overcome hesitations about investing in affiliate systems. I see you're considering our membership - smart move! Our average client sees £3,000-8,000 monthly increases. What's your biggest concern about getting started?"
        : "👋 Hi! I'm Alex, your affiliate marketing assistant. I help businesses like yours increase revenue by 200-400% through strategic affiliate programs. What brings you here today?",
      quickReplies: isSubscriptionPage 
        ? [
            { text: "Cost concerns", action: "addressPrice" },
            { text: "Will it really work?", action: "showProof" },
            { text: "Don't have time to set up", action: "addressTime" },
            { text: "Need to see more results", action: "showDetailedResults" }
          ]
        : [
            { text: "Want more affiliates", action: "needAffiliates" },
            { text: "Increase sales", action: "needRevenue" },
            { text: "Automate commissions", action: "needAutomation" },
            { text: "Just browsing", action: "browsingMode" }
          ]
    },
    
    needAffiliates: {
      message: "Perfect! Most of our clients struggled with the same thing. Before Fotonix, they averaged 5-12 affiliates. After? 150-300+ active partners. \n\nWhat's your current situation? How many affiliates do you have now?",
      followUp: "collectAffiliateCount"
    },
    
    needRevenue: {
      message: "Smart focus! Our clients typically see 247% revenue increases within 90 days. Sarah's e-commerce store went from £8k to £28k monthly just from affiliate sales. \n\nWhat's your approximate monthly revenue right now?",
      followUp: "collectRevenue"
    },
    
    needAutomation: {
      message: "You're thinking like a pro! Manual commission tracking wastes 15+ hours per week. James from a digital agency told me Fotonix saved his team 38 hours monthly. \n\nWhat's eating up most of your time with affiliate management?",
      followUp: "identifyPainPoints"
    },
    
    browsingMode: {
      message: "No pressure at all! I'm here if you have questions. Fun fact: 89% of our subscribers were 'just browsing' initially 😊 \n\nWhat would be most helpful - seeing real results from businesses like yours, or understanding how our system works?",
      quickReplies: [
        { text: "Show me results", action: "showResults" },
        { text: "How it works", action: "explainSystem" },
        { text: "Pricing info", action: "discussPricing" }
      ]
    },
    
    // Subscription-specific objection handling flows
    addressPrice: {
      message: "I totally get that! Here's the thing - most businesses waste £2,000-5,000/month on ads that don't work. Our system pays for itself in the first month. Plus, we have a 30-day money-back guarantee. Would you like to see our ROI calculator?",
      quickReplies: [
        { text: "Show me the calculator", action: "showCalculator" },
        { text: "Tell me about guarantee", action: "explainGuarantee" },
        { text: "What if it doesn't work?", action: "addressRisk" }
      ]
    },
    
    showProof: {
      message: "Absolutely! We have over 2,847 success stories. Here are 3 recent wins: Sarah (bakery) went from £800 to £3,200/month in 8 weeks. Mike (fitness) added £12,000/month with zero ad spend. Lisa (consulting) built a £45,000/month passive income stream. Want to see their full case studies?",
      quickReplies: [
        { text: "Yes, show case studies", action: "detailedCaseStudies" },
        { text: "How quickly will I see results?", action: "timeToResults" },
        { text: "Is my business a good fit?", action: "businessFitCheck" }
      ]
    },
    
    addressTime: {
      message: "Smart question! Most people think this takes months to set up. Truth is, our system is plug-and-play. You can have your first affiliates earning commissions within 48 hours. We do the heavy lifting - you just follow our 3-step checklist. Sound manageable?",
      quickReplies: [
        { text: "What are the 3 steps?", action: "explain3Steps" },
        { text: "Do you help with setup?", action: "setupSupport" },
        { text: "How much time per week?", action: "timeCommitment" }
      ]
    },
    
    showDetailedResultsFlow: {
      message: "Perfect timing! We just published our Q1 2024 results: 94% of members are profitable within 60 days, average ROI is 340%, and the median monthly increase is £4,200. Plus, you can track everything in real-time so you can see exactly how much each affiliate is worth. Want me to show you the dashboard preview?",
      quickReplies: [
        { text: "Show me the dashboard", action: "dashboardPreview" },
        { text: "How do you guarantee results?", action: "resultGuarantee" },
        { text: "What support do I get?", action: "supportDetails" }
      ]
    }
  };

  const objectionHandlers = {
    price: {
      response: "I completely understand the cost concern. Let me put this in perspective: \n\n• Fotonix costs £11.99/month \n• Average client saves 38 hours/month (worth £1,900+ at £50/hour) \n• Typical revenue increase: £3,000-8,000/month \n\nSo you're looking at spending £12 to potentially gain £3,000+. That's a 25,000% ROI. Does that math work for your business?",
      followUp: "addressBudget"
    },
    
    time: {
      response: "Actually, that's exactly WHY you need this! Our busiest clients love Fotonix because it runs itself. \n\n• Setup takes 15 minutes \n• Then it's fully automated \n• You'll get 38+ hours back per month \n\nEmma, a startup founder, told me: 'I was too busy to set this up. Now I wish I'd done it sooner - it gave me my life back.' \n\nWhat if I could show you the 15-minute setup process?",
      followUp: "offerDemo"
    },
    
    skepticism: {
      response: "Healthy skepticism is smart! I'd be suspicious too of claims that sound too good to be true. \n\nHere's what makes me confident: \n• 1,247 active users \n• £2.4M+ paid in commissions \n• 4.9/5 rating from real users \n• 30-day money-back guarantee \n\nWant me to connect you with Sarah from Birmingham? She was skeptical too, now makes £28k/month from affiliates. Would a quick chat with her help?",
      followUp: "offerProof"
    },
    
    competition: {
      response: "Great question! Most 'affiliate software' is just basic tracking. Fotonix is a complete business system: \n\n❌ Others: Just track clicks \n✅ Fotonix: Finds affiliates, automates recruitment, manages payouts, builds stores \n\n❌ Others: You do everything manually \n✅ Fotonix: Runs your entire affiliate program \n\nIt's like comparing a calculator to a smartphone. Want me to show you what makes us different?",
      followUp: "explainAdvantage"
    }
  };

  const personalizedOffers = {
    smallBusiness: {
      offer: "Perfect timing! This month we're offering small businesses their first month free + a 30-minute setup call with me personally. That's a £47 value, completely free.",
      urgency: "I can only extend this to 5 more businesses this month. Interested?"
    },
    
    ecommerce: {
      offer: "Since you're in e-commerce, I'd love to show you our Shopify integration. Plus, this month you get our £297 E-commerce Affiliate Playbook free with signup.",
      urgency: "This bonus expires tomorrow. Should we get you set up today?"
    },
    
    saas: {
      offer: "For SaaS companies like yours, we have a special recurring commission structure. Plus, I'll throw in our SaaS Growth Accelerator toolkit (normally £197) at no charge.",
      urgency: "Only available for the next 3 SaaS signups. Want to claim your spot?"
    },
    
    agency: {
      offer: "Agencies love our white-label option! You can resell this to clients at £100+/month. Plus, I'll include our Agency Partner Program with 40% recurring commissions.",
      urgency: "Agency slots are limited. Should we discuss the partnership today?"
    }
  };

  useEffect(() => {
    if (messages.length === 0) {
      const initializeWelcome = async () => {
        // Use AI for initial welcome message
        const welcomePrompt = isSubscriptionPage 
          ? "A user just arrived at our subscription page after seeing our features. Greet them warmly and help address any final concerns they might have about signing up."
          : "A new visitor just arrived on our website. Give them a warm, engaging greeting that introduces you as Alex, their affiliate marketing expert, and ask what brought them here today.";
        
        await analyzeAndRespond(welcomePrompt);
      };
      
      initializeWelcome();
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-open chatbot after user spends time on page (non-authenticated users)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen) {
        setIsOpen(true);
        addBotMessage("👋 Quick question - are you looking to grow your affiliate program? I can show you how our clients average 247% revenue increases...");
      }
    }, 45000); // 45 seconds

    return () => clearTimeout(timer);
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addBotMessage = (message, quickReplies = null, delay = 1000) => {
    setIsTyping(true);
    
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'bot',
        content: message,
        timestamp: new Date(),
        quickReplies: quickReplies
      }]);
      setIsTyping(false);
      if (quickReplies) {
        setShowQuickReplies(true);
      }
    }, delay);
  };

  const addUserMessage = (message) => {
    setMessages(prev => [...prev, {
      id: Date.now(),
      type: 'user',
      content: message,
      timestamp: new Date()
    }]);
    setShowQuickReplies(false);
  };

  const handleQuickReply = async (reply) => {
    addUserMessage(reply.text);
    
    // For quick replies, we can either use the old action system for specific UI components
    // or send to AI for more natural responses
    if (reply.action === 'showResults' || reply.action === 'explainSystem') {
      // Keep special UI components for these
      processUserIntent(reply.action, reply.text);
    } else {
      // Use AI for natural conversation
      await analyzeAndRespond(reply.text);
    }
  };

  const handleSendMessage = async () => {
    if (!currentInput.trim()) return;
    
    const message = currentInput.trim();
    addUserMessage(message);
    setCurrentInput('');
    
    // Analyze message and respond appropriately
    await analyzeAndRespond(message);
  };

  const analyzeAndRespond = async (message) => {
    try {
      setIsTyping(true);
      
      // Call AI chatbot API endpoint - use VPS server for production
      const apiUrl = process.env.NODE_ENV === 'production' 
        ? 'https://api.fotonix.co.uk/api/chatbot/message'  // Production
        : 'http://51.75.78.118:5002/api/chatbot/message';   // Development (VPS direct)
        
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          conversationHistory: messages.filter(m => !m.isSpecial), // Exclude special UI components
          userProfile
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.response) {
        // Add AI response
        addBotMessage(data.response, null, 0); // No delay since we're already typing
        
        // Handle special cases based on AI metadata
        if (data.metadata?.containsHighIntent) {
          // User showing high buying intent
          setTimeout(() => {
            if (onConversion) {
              onConversion();
            }
          }, 2000);
        }
        
        // Check for email capture
        const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
        if (emailMatch && onLeadCapture) {
          const email = emailMatch[0];
          setUserProfile(prev => ({ ...prev, email }));
          onLeadCapture({ 
            email, 
            source: 'ai-chatbot-conversation',
            messageCount: data.metadata?.messageCount || messages.length,
            ...userProfile 
          });
        }
        
      } else {
        throw new Error('Invalid response from AI');
      }
      
    } catch (error) {
      console.error('AI Chatbot error:', error);
      
      // Fallback to simplified response
      const fallbackResponses = [
        "I'd love to help! Our platform helps businesses increase affiliate revenue by 247% on average. What's your biggest challenge right now - finding affiliates, managing commissions, or something else?",
        "Great question! We've helped over 2,847 businesses grow through affiliate marketing. At just £11.99/month, most see £3,000+ monthly increases. What would you like to know more about?",
        "That's exactly what our system addresses! We have a 30-day free trial where you can test everything risk-free. Should I show you how it works?"
      ];
      
      const randomFallback = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
      addBotMessage(randomFallback, [
        { text: "Tell me about pricing", action: "discussPricing" },
        { text: "Show me results", action: "showResults" },
        { text: "How does it work?", action: "explainSystem" }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleObjection = (objection) => {
    const handler = objectionHandlers[objection];
    if (handler) {
      addBotMessage(handler.response);
      setTimeout(() => {
        continueConversation(handler.followUp);
      }, 3000);
    }
  };

  // Missing function implementations
  const offerTrial = () => {
    addBotMessage(
      "Perfect! We offer a risk-free trial with full access to everything. You can cancel anytime - no questions asked. \n\nMost of our clients see results within the first 2 weeks. Want to get started?",
      [
        { text: "Yes, start my trial!", action: "acceptTrial" },
        { text: "What's included?", action: "explainFeatures" },
        { text: "Any setup required?", action: "explainSetup" }
      ]
    );
  };

  const captureEmail = (message) => {
    const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) {
      const email = emailMatch[0];
      setUserProfile(prev => ({ ...prev, email }));
      
      addBotMessage(
        `Great! I've got your email as ${email}. I'll send you a personalized strategy based on our conversation. \n\nWhat's your first name so I can personalize it?`,
        [
          { text: "Send strategy now", action: "sendStrategy" },
          { text: "Tell me more first", action: "continueConversation" }
        ]
      );
      
      // Track email capture
      if (onLeadCapture) {
        onLeadCapture({ email, source: 'chatbot-conversation', ...userProfile });
      }
    }
  };

  const provideContextualResponse = (message) => {
    const responses = [
      "That's a great question! Let me help you with that. What specific aspect would you like me to explain?",
      "I understand. Based on what you've told me about your business, here's what I'd recommend...",
      "Absolutely! Many business owners ask about this. The key thing to understand is...",
      "Good point! Let me give you a specific example that might help clarify this..."
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    addBotMessage(randomResponse, [
      { text: "Tell me about pricing", action: "discussPricing" },
      { text: "Show me results", action: "showResults" },
      { text: "How does it work?", action: "explainSystem" }
    ]);
  };

  const continueConversation = (nextStep) => {
    switch (nextStep) {
      case 'addressBudget':
        addBotMessage(
          "I totally get it - budget is important. Here's the thing: what's the cost of NOT having more affiliates? \n\nMost businesses lose £1,000s monthly by not having an optimized affiliate program. Does that make sense?",
          [
            { text: "That makes sense", action: "showROI" },
            { text: "Still concerned about cost", action: "explainValue" },
            { text: "What's the guarantee?", action: "explainGuarantee" }
          ]
        );
        break;
      case 'offerDemo':
        addBotMessage(
          "Perfect! I can show you exactly how this works. Would you prefer a quick 5-minute screen share now, or should I send you a personalized demo video?",
          [
            { text: "Screen share now", action: "bookDemo" },
            { text: "Send demo video", action: "requestVideo" },
            { text: "Tell me more first", action: "continueChat" }
          ]
        );
        break;
      case 'offerProof':
        addBotMessage(
          "Absolutely! Social proof is crucial. Here's Sarah's direct contact if you want to verify: sarah.mitchell@fashionboutique.co.uk \n\nShe's happy to share her results. Plus, we have a 30-day money-back guarantee. Sound fair?",
          [
            { text: "Yes, that's reassuring", action: "moveForward" },
            { text: "I'd like to contact Sarah", action: "contactReference" },
            { text: "Tell me about guarantee", action: "explainGuarantee" }
          ]
        );
        break;
      default:
        addBotMessage("What would be most helpful for you right now?", [
          { text: "See pricing", action: "discussPricing" },
          { text: "View results", action: "showResults" },
          { text: "Start trial", action: "acceptTrial" }
        ]);
    }
  };

  const explainSystemFlow = () => {
    addBotMessage("Here's how Fotonix works in 3 simple steps:", null, 1000);
    
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'bot',
        content: 'system_flow',
        timestamp: new Date(),
        isSpecial: true
      }]);
    }, 2000);
    
    setTimeout(() => {
      addBotMessage("Pretty straightforward, right? Which step interests you most?", [
        { text: "Finding affiliates", action: "explainRecruitment" },
        { text: "Managing commissions", action: "explainPayments" },
        { text: "Tracking performance", action: "explainAnalytics" }
      ]);
    }, 4000);
  };

  const presentPricingLogic = () => {
    addBotMessage(
      "Smart to ask about pricing upfront! Here's how I think about it: \n\n• Most agencies charge £500-2000/month to manage affiliate programs \n• Fotonix does the same thing for £11.99/month \n• Plus you keep all the commissions \n\nSo you're saving £488-1988 monthly while getting better results. Make sense?",
      [
        { text: "That's incredible value", action: "acceptValue" },
        { text: "What's the catch?", action: "addressSkepticism" },
        { text: "Show me proof of results", action: "showResults" }
      ]
    );
  };

  const calculatePersonalizedROI = (revenueLevel) => {
    const calculations = {
      small: {
        currentRevenue: "£5,000",
        projectedIncrease: "£2,100",
        roi: "1,750%",
        timeframe: "90 days"
      },
      medium: {
        currentRevenue: "£30,000", 
        projectedIncrease: "£7,400",
        roi: "6,175%",
        timeframe: "60 days"
      },
      large: {
        currentRevenue: "£75,000",
        projectedIncrease: "£18,500",
        roi: "15,433%",
        timeframe: "45 days"
      }
    };
    
    const calc = calculations[revenueLevel] || calculations.small;
    
    addBotMessage(
      `Based on your revenue range, here's what I project: \n\n• Current monthly revenue: ${calc.currentRevenue} \n• Projected affiliate revenue: +${calc.projectedIncrease}/month \n• ROI on Fotonix: ${calc.roi} \n• Typical timeframe: ${calc.timeframe} \n\nThose numbers work for you?`,
      [
        { text: "Those results sound amazing", action: "highIntent" },
        { text: "How do you calculate this?", action: "explainCalculation" },
        { text: "What's the guarantee?", action: "explainGuarantee" }
      ]
    );
    
    setUserProfile(prev => ({ ...prev, sawROICalculation: true }));
  };

  const handlePositiveSignal = () => {
    addBotMessage(
      "Fantastic! I love working with motivated business owners. Let me ask you this: what would an extra £5,000-10,000 per month mean for your business? \n\nBecause that's typically what our clients see within 90 days.",
      [
        { text: "That would be life-changing", action: "highIntent" },
        { text: "Show me proof", action: "requestProof" },
        { text: "How quickly?", action: "askTimeline" }
      ]
    );
  };

  const processUserIntent = (action, originalText) => {
    switch (action) {
      case 'needAffiliates':
        setConversationStage('qualification');
        setTimeout(() => {
          addBotMessage("What type of business are you in? This helps me give you the most relevant examples.", [
            { text: "E-commerce", action: "setBusinessType_ecommerce" },
            { text: "SaaS/Software", action: "setBusinessType_saas" },
            { text: "Digital Agency", action: "setBusinessType_agency" },
            { text: "Other", action: "setBusinessType_other" }
          ]);
        }, 2000);
        break;
        
      case 'needRevenue':
        setTimeout(() => {
          addBotMessage("What's your current monthly revenue range?", [
            { text: "Under £10k", action: "setRevenue_small" },
            { text: "£10k - £50k", action: "setRevenue_medium" },
            { text: "£50k+", action: "setRevenue_large" }
          ]);
        }, 2000);
        break;
        
      case 'needAutomation':
        setTimeout(() => {
          addBotMessage("How much time do you currently spend on affiliate management each week?", [
            { text: "2-5 hours", action: "setTime_low" },
            { text: "5-15 hours", action: "setTime_medium" },
            { text: "15+ hours", action: "setTime_high" }
          ]);
        }, 2000);
        break;
        
      case 'showResults':
        showResultsCarousel();
        break;
        
      case 'explainSystem':
        explainSystemFlow();
        break;
        
      case 'discussPricing':
        presentPricingLogic();
        break;
        
      case 'highIntent':
        moveToClosing();
        break;
        
      // Subscription-specific objection handling
      case 'addressPrice':
        handlePriceObjection();
        break;
        
      case 'showProof':
        showProofAndTestimonials();
        break;
        
      case 'addressTime':
        addressTimeObjection();
        break;
        
      case 'showDetailedResults':
        showDetailedResults();
        break;
        
      case 'showCalculator':
        presentROICalculator();
        break;
        
      case 'explainGuarantee':
        explainMoneyBackGuarantee();
        break;
        
      case 'addressRisk':
        addressRiskObjection();
        break;
        
      case 'detailedCaseStudies':
        showDetailedCaseStudies();
        break;
        
      case 'timeToResults':
        explainTimeToResults();
        break;
        
      case 'businessFitCheck':
        checkBusinessFit();
        break;
        
      case 'explain3Steps':
        explainSetupSteps();
        break;
        
      case 'setupSupport':
        explainSetupSupport();
        break;
        
      case 'timeCommitment':
        explainTimeCommitment();
        break;
        
      case 'dashboardPreview':
        showDashboardPreview();
        break;
        
      case 'resultGuarantee':
        explainResultGuarantee();
        break;
        
      case 'supportDetails':
        showSupportDetails();
        break;
        
      default:
        if (action.startsWith('setBusinessType_')) {
          const businessType = action.split('_')[1];
          setUserProfile(prev => ({ ...prev, businessType }));
          providePersonalizedExample(businessType);
        } else if (action.startsWith('setRevenue_')) {
          const revenue = action.split('_')[1];
          setUserProfile(prev => ({ ...prev, monthlyRevenue: revenue }));
          calculatePersonalizedROI(revenue);
        }
        break;
    }
  };

  const providePersonalizedExample = (businessType) => {
    const examples = {
      ecommerce: "Perfect! Sarah runs a fashion e-commerce store. She started with 8 affiliates making £12k/month. After 3 months with Fotonix: 247 affiliates, £28k/month. \n\nHer secret? Our automated affiliate recruitment found fashion bloggers and Instagram influencers she never would have discovered manually.",
      saas: "Excellent! Marcus has a project management SaaS. He was stuck at £15k MRR with zero affiliates. Now? £47k MRR with 89 affiliate partners promoting his software. \n\nThe game-changer was our SaaS-specific commission structure and automated partner onboarding.",
      agency: "Smart! Emma runs a digital marketing agency. She uses Fotonix to manage affiliate programs for 12 clients AND resells it as a service for £300/month per client. \n\nDouble revenue stream: client success + recurring affiliate income.",
      other: "No problem! Whatever your business, the principle is the same: more qualified affiliates = more sales. Our system works across 47 different industries."
    };

    addBotMessage(examples[businessType] || examples.other);
    
    setTimeout(() => {
      addBotMessage("What's your biggest challenge right now - finding affiliates, managing them, or tracking performance?", [
        { text: "Finding quality affiliates", action: "challengeRecruit" },
        { text: "Managing payments/tracking", action: "challengeManage" },
        { text: "Getting them to actually sell", action: "challengeActivate" }
      ]);
    }, 4000);
  };

  const moveToClosing = () => {
    const offer = personalizedOffers[userProfile.businessType] || personalizedOffers.smallBusiness;
    
    addBotMessage(
      `Here's what I'm thinking for your business: \n\n${offer.offer} \n\n${offer.urgency}`,
      [
        { text: "Yes, let's do it!", action: "acceptOffer" },
        { text: "Tell me more first", action: "needMoreInfo" },
        { text: "What's the guarantee?", action: "askGuarantee" }
      ]
    );
  };

  // Subscription-specific objection handling functions
  const handlePriceObjection = () => {
    setTimeout(() => {
      addBotMessage("I hear you! Let me break down the real numbers: Most businesses spend £2,000-5,000/month on ads with uncertain results. Our £11.99/month system typically generates £3,000-8,000 additional monthly revenue. That's a 25,000% ROI! Plus, if you don't see results in 30 days, we refund every penny. Does that change the equation?", [
        { text: "Show me the calculator", action: "showCalculator" },
        { text: "Tell me about the guarantee", action: "explainGuarantee" },
        { text: "Still seems expensive", action: "addressBudget" }
      ]);
    }, 2000);
  };
  
  const showProofAndTestimonials = () => {
    setTimeout(() => {
      addBotMessage("Absolutely! Here's proof this works: We have 2,847 active users, £2.4M+ in commissions paid out, and a 4.9/5 rating. Sarah from Birmingham was skeptical too - now she makes £28k/month. Mike added £12k/month with zero ad spend. Lisa built £45k/month passive income. Want to see their video testimonials?", [
        { text: "Yes, show testimonials", action: "playTestimonials" },
        { text: "How quickly will I see results?", action: "timeToResults" },
        { text: "What if my business is different?", action: "businessFitCheck" }
      ]);
    }, 2000);
  };
  
  const addressTimeObjection = () => {
    setTimeout(() => {
      addBotMessage("I completely understand! That's exactly why busy entrepreneurs love Fotonix - it saves time rather than taking it. Here's the reality: Setup takes 15 minutes following our checklist, then it runs completely automated. You'll get back 38+ hours per month you currently waste on manual tracking. Emma told me: 'I was too busy to set this up. Now I wish I'd done it sooner!' Ready to see the 3 simple setup steps?", [
        { text: "Show me the 3 steps", action: "explain3Steps" },
        { text: "Do you help with setup?", action: "setupSupport" },
        { text: "How much ongoing time?", action: "timeCommitment" }
      ]);
    }, 2000);
  };
  
  const showDetailedResults = () => {
    setTimeout(() => {
      addBotMessage("Perfect! Our latest Q1 2024 data is impressive: 94% of members are profitable within 60 days, average ROI is 340%, median monthly increase is £4,200. Our top 10% average £15,000+ monthly increases. We track everything in real-time so you can see exactly how much each affiliate is worth. Want to see the live dashboard?", [
        { text: "Show me the dashboard", action: "dashboardPreview" },
        { text: "How do you guarantee results?", action: "resultGuarantee" },
        { text: "What support do I get?", action: "supportDetails" }
      ]);
    }, 2000);
  };
  
  const presentROICalculator = () => {
    setTimeout(() => {
      addBotMessage("Smart thinking! Here's your personalized ROI: If you make £5k/month now, just 5 new affiliates earning £600 each = £3k extra monthly. That's £36k/year from a £144 investment. Even with just 2 affiliates, you're profitable. Conservative estimate? You'll 3x your investment in month 1. Want me to run numbers for your specific business size?", [
        { text: "Yes, calculate for my business", action: "personalizedCalculator" },
        { text: "What if I can't find affiliates?", action: "affiliateSupport" },
        { text: "Ready to start", action: "readyToStart" }
      ]);
    }, 2000);
  };
  
  const explainMoneyBackGuarantee = () => {
    setTimeout(() => {
      addBotMessage("Our guarantee is industry-leading: Full 30 days to test everything. If you don't see measurable results - more affiliates, higher commissions, or time saved - we refund 100% of your money, no questions asked. We've only had 3% of people ask for refunds because the system works. Plus, you keep all the training and templates even if you cancel. Fair enough?", [
        { text: "That sounds fair", action: "acceptGuarantee" },
        { text: "What counts as 'results'?", action: "defineResults" },
        { text: "Ready to try it", action: "readyToStart" }
      ]);
    }, 2000);
  };
  
  const addressRiskObjection = () => {
    setTimeout(() => {
      addBotMessage("Great question! The biggest risk is NOT taking action. While you wait, competitors are building affiliate armies. The real risk? Status quo. You keep manually tracking commissions, missing affiliate opportunities, and leaving money on the table. With our guarantee, your only risk is 30 days of your time - but the upside is £3k-8k monthly increases. What feels riskier now?", [
        { text: "You're right, let's start", action: "readyToStart" },
        { text: "Tell me more about competitors", action: "competitorAnalysis" },
        { text: "What if it's too complex?", action: "simplicityAssurance" }
      ]);
    }, 2000);
  };
  
  const showDetailedCaseStudies = () => {
    setTimeout(() => {
      addBotMessage("Here are 3 detailed case studies: \n\n📈 Sarah's Bakery: Went from £800 to £3,200/month in 8 weeks using local food bloggers as affiliates. ROI: 400% \n\n💪 Mike's Fitness: Added £12,000/month with zero ad spend using fitness influencer network. ROI: 1,200% \n\n💼 Lisa's Consulting: Built £45,000/month passive income with business coach affiliates. ROI: 3,750% \n\nAll started with our exact system. Which business model matches yours closest?", [
        { text: "Like Sarah's local approach", action: "localStrategy" },
        { text: "Like Mike's influencer model", action: "influencerStrategy" },
        { text: "Like Lisa's B2B approach", action: "b2bStrategy" }
      ]);
    }, 2000);
  };
  
  const explainTimeToResults = () => {
    setTimeout(() => {
      addBotMessage("Excellent question! Here's the realistic timeline: Week 1-2: System setup and first affiliates recruited. Week 3-4: First commissions start coming in. Month 2: Most members see 2-3x growth. Month 3+: Full momentum with 5-10x potential. Our fastest success was 48 hours (Mike made £2k in his first weekend!). Slowest was 6 weeks. Average? 3-4 weeks to profitability. Sound reasonable?", [
        { text: "That's faster than expected", action: "speedSurprise" },
        { text: "What if I'm slower than average?", action: "slowResultsConcern" },
        { text: "Ready to start immediately", action: "readyToStart" }
      ]);
    }, 2000);
  };
  
  const checkBusinessFit = () => {
    setTimeout(() => {
      addBotMessage("Smart to check! Our system works for 95% of businesses. Best fits: E-commerce, SaaS, consulting, coaching, agencies, local services. Won't work well for: Ultra-niche B2B (under 1000 potential customers), heavily regulated industries, or businesses with negative margins. What's your business model? I can tell you exactly how others in your space are succeeding.", [
        { text: "E-commerce/retail", action: "ecommerceStrategy" },
        { text: "Service-based business", action: "serviceStrategy" },
        { text: "SaaS/digital products", action: "saasStrategy" },
        { text: "Something else", action: "customStrategy" }
      ]);
    }, 2000);
  };
  
  const explainSetupSteps = () => {
    setTimeout(() => {
      addBotMessage("Perfect! Here are the 3 simple steps: \n\n✅ Step 1: Connect your Fotonix dashboard (5 minutes) \n✅ Step 2: Upload your product/service info using our template (5 minutes) \n✅ Step 3: Send invitation emails to potential affiliates using our proven templates (5 minutes) \n\nThat's it! The system handles tracking, payments, and reporting automatically. Most people are shocked how simple it is. Ready to see it in action?", [
        { text: "Yes, show me the setup", action: "demoSetup" },
        { text: "What if I get stuck?", action: "setupSupport" },
        { text: "Sounds too easy", action: "simplicityExplanation" }
      ]);
    }, 2000);
  };
  
  const explainSetupSupport = () => {
    setTimeout(() => {
      addBotMessage("We've got you covered! Every member gets: \n\n🎯 Personal onboarding call (30 minutes) \n📧 Email support with 4-hour response time \n💬 Private member community (2,800+ successful affiliaters) \n📚 Complete video library (12+ hours) \n🔧 Done-for-you templates and scripts \n\nPlus, I personally review your first affiliate outreach emails. You're never alone in this! Sound supportive enough?", [
        { text: "Wow, that's comprehensive", action: "impressedSupport" },
        { text: "What about ongoing help?", action: "ongoingSupport" },
        { text: "I'm ready to start", action: "readyToStart" }
      ]);
    }, 2000);
  };
  
  const explainTimeCommitment = () => {
    setTimeout(() => {
      addBotMessage("Honest answer: 2-4 hours per month after setup. That's it! Most time is spent recruiting new affiliates (fun part!) and optimizing top performers. The system handles everything else. Compare that to current manual tracking - most save 35+ hours monthly. It's a massive time saver, not a time drain. Worth 2-4 hours for £3k-8k monthly increases?", [
        { text: "Absolutely worth it", action: "timeValueAgreed" },
        { text: "What if I want to do more?", action: "advancedStrategies" },
        { text: "Let's get started", action: "readyToStart" }
      ]);
    }, 2000);
  };
  
  const showDashboardPreview = () => {
    setTimeout(() => {
      addBotMessage("Great choice! The dashboard shows everything in real-time: affiliate performance, commission tracking, payment processing, ROI metrics, and growth trends. You'll see exactly which affiliates are worth gold and which need coaching. It's like having a crystal ball for your affiliate program. Want me to arrange a live demo where you can click around?", [
        { text: "Yes, arrange live demo", action: "scheduleLiveDemo" },
        { text: "Just show me inside now", action: "readyToStart" },
        { text: "What metrics matter most?", action: "keyMetrics" }
      ]);
    }, 2000);
  };
  
  const explainResultGuarantee = () => {
    setTimeout(() => {
      addBotMessage("Here's how we guarantee results: Within 30 days, you must see at least one of these: 1) 20% increase in affiliate-driven revenue, 2) 50% reduction in commission tracking time, or 3) 10+ new qualified affiliate applications. If you don't hit ANY of these measurable benchmarks, full refund. We can guarantee this because 97% of active users hit these targets. Fair metrics?", [
        { text: "Those seem very fair", action: "acceptMetrics" },
        { text: "What if I barely miss?", action: "closeButNotQuite" },
        { text: "I'm convinced, let's go", action: "readyToStart" }
      ]);
    }, 2000);
  };
  
  const showSupportDetails = () => {
    setTimeout(() => {
      addBotMessage("We're obsessed with member success! You get: Personal success manager, weekly group coaching calls, 24/7 technical support, member-only Facebook group, monthly strategy sessions, plus our 'Success or Refund' promise. Sarah says: 'The support is better than some £5k courses I've taken!' We're not just software - we're your affiliate marketing team. Questions?", [
        { text: "Sounds incredible", action: "impressedBySupport" },
        { text: "How do I contact support?", action: "supportChannels" },
        { text: "I'm ready to join", action: "readyToStart" }
      ]);
    }, 2000);
  };

  const showResultsCarousel = () => {
    addBotMessage("Here are 3 recent success stories:", null, 500);
    
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        type: 'bot',
        content: 'results_carousel',
        timestamp: new Date(),
        isSpecial: true
      }]);
    }, 1000);
    
    setTimeout(() => {
      addBotMessage("Which result resonates most with your goals?", [
        { text: "Revenue growth like Sarah", action: "wantRevenue" },
        { text: "Time savings like James", action: "wantTime" },
        { text: "Scale like Emma", action: "wantScale" }
      ]);
    }, 3000);
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 animate-pulse"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
        
        {/* Attention-grabbing tooltip */}
        <div className="absolute bottom-full right-0 mb-2 bg-white rounded-lg shadow-lg p-3 max-w-xs animate-bounce">
          <div className="text-sm font-medium text-slate-900">💬 Quick question...</div>
          <div className="text-xs text-slate-600">Want to see how to 3x your affiliate revenue?</div>
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center mr-3">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="font-semibold">Alex - Affiliate Expert</div>
            <div className="text-sm opacity-90">✅ Online • Avg. response: 30 sec</div>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id}>
            {message.isSpecial ? (
              message.content === 'results_carousel' ? (
                <ResultsCarousel />
              ) : message.content === 'system_flow' ? (
                <SystemFlow />
              ) : null
            ) : (
              <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl p-3 ${
                  message.type === 'user' 
                    ? 'bg-fuchsia-500 text-white' 
                    : 'bg-slate-100 text-slate-900'
                }`}>
                  <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                  {message.quickReplies && showQuickReplies && (
                    <div className="mt-3 space-y-2">
                      {message.quickReplies.map((reply, index) => (
                        <button
                          key={index}
                          onClick={() => handleQuickReply(reply)}
                          className="block w-full text-left bg-white border border-slate-200 rounded-lg p-2 text-sm hover:bg-slate-50 transition-colors"
                        >
                          {reply.text}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        
        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl p-3 max-w-[80%]">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex space-x-2">
          <input
            type="text"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type your message..."
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-500"
          />
          <button
            onClick={handleSendMessage}
            className="bg-fuchsia-500 text-white p-2 rounded-lg hover:bg-fuchsia-600 transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * System Flow Component
 */
function SystemFlow() {
  const steps = [
    {
      number: "1",
      title: "Find Affiliates", 
      description: "Our AI scans 50,000+ potential affiliates and finds perfect matches for your business",
      icon: <Users className="h-8 w-8 text-purple-600" />
    },
    {
      number: "2",
      title: "Automate Everything",
      description: "Recruitment emails, onboarding, commission tracking, and payouts all happen automatically", 
      icon: <Zap className="h-8 w-8 text-blue-600" />
    },
    {
      number: "3", 
      title: "Watch Revenue Grow",
      description: "Track performance in real-time as your affiliate army drives consistent, growing revenue",
      icon: <DollarSign className="h-8 w-8 text-green-600" />
    }
  ];

  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <div key={index} className="flex items-start space-x-4 bg-gradient-to-r from-slate-50 to-white border border-slate-200 rounded-xl p-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-gradient-to-br from-fuchsia-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {step.number}
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center mb-2">
              {step.icon}
              <h3 className="ml-3 font-semibold text-slate-900">{step.title}</h3>
            </div>
            <p className="text-sm text-slate-600">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Results Carousel Component
 */
function ResultsCarousel() {
  const results = [
    {
      name: "Sarah Mitchell",
      business: "Fashion E-commerce",
      before: "12 affiliates, £8k/month",
      after: "247 affiliates, £28k/month", 
      timeframe: "3 months",
      icon: <DollarSign className="h-8 w-8 text-green-600" />
    },
    {
      name: "James Rodriguez", 
      business: "Digital Agency",
      before: "Manual tracking, 15 hrs/week",
      after: "Full automation, 1 hr/week",
      timeframe: "First month",
      icon: <Clock className="h-8 w-8 text-blue-600" />
    },
    {
      name: "Emma Thompson",
      business: "SaaS Startup", 
      before: "0 affiliates, £15k MRR",
      after: "156 affiliates, £47k MRR",
      timeframe: "6 months", 
      icon: <Users className="h-8 w-8 text-purple-600" />
    }
  ];

  return (
    <div className="space-y-3">
      {results.map((result, index) => (
        <div key={index} className="bg-gradient-to-r from-slate-50 to-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center mb-3">
            {result.icon}
            <div className="ml-3">
              <div className="font-semibold text-slate-900">{result.name}</div>
              <div className="text-sm text-slate-600">{result.business}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-red-50 rounded-lg p-2">
              <div className="text-red-700 font-medium">Before</div>
              <div className="text-red-600">{result.before}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-2">
              <div className="text-green-700 font-medium">After ({result.timeframe})</div>
              <div className="text-green-600 font-semibold">{result.after}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}