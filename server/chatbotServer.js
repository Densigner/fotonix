/**
 * Chatbot Server for VPS
 * 
 * Standalone server that handles AI chatbot conversations using OpenAI.
 * Deploy this to VPS to provide chatbot API for all Fotonix services.
 * 
 * Port: 5002
 * Endpoints:
 *   POST /api/chatbot/message - Main AI conversation endpoint
 *   GET /health - Health check
 */

// Load .env from current directory first, then try parent
require('dotenv').config();
if (!process.env.OPENAI_API_KEY) {
  require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
}

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.CHATBOT_PORT || 5002;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

console.log('OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    timestamp: Date.now(),
    openaiConfigured: !!process.env.OPENAI_API_KEY 
  });
});

/**
 * POST /api/chatbot/message
 * Main AI conversation endpoint
 */
app.post('/api/chatbot/message', async (req, res) => {
  try {
    const { message, conversationHistory = [], userProfile = {} } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured, using fallback response');
      return res.json({
        success: true,
        response: "I'd love to help! Our platform helps businesses increase affiliate revenue by 247% on average. What's your biggest challenge right now - finding affiliates, managing commissions, or something else?",
        metadata: { fallback: true, reason: 'no_api_key' }
      });
    }

    // Aggressive pre-filter for off-topic questions to save OpenAI costs
    const offTopicKeywords = /\b(world war|history|recipe|weather|movie|book|celebrity|sports|politics|religion|programming|coding|math|science|geography|animal|car|music|game|medical|health|doctor|cure|treatment|disease|symptom|medicine|drug|pain|injury|cancer|covid|virus|bacteria|infection|therapy|surgery|hospital|clinic|hemorrhoid|hermeroids|diet|fitness|exercise|vitamin|supplement|prescription)\b/i;
    const businessKeywords = /\b(business|marketing|affiliate|sales|revenue|growth|platform|fotonix|commission|conversion|funnel|email|campaign|lead|customer|profit|roi|subscription|pricing|trial)\b/i;
    
    // If message contains off-topic keywords AND doesn't contain business keywords, filter it
    if (offTopicKeywords.test(message) && !businessKeywords.test(message)) {
      return res.json({
        success: true,
        response: "I'm here specifically to help with Fotonix and growing your business through affiliate marketing. What questions do you have about our platform or affiliate marketing strategies?",
        metadata: { 
          filtered: true,
          reason: 'off-topic'
        }
      });
    }

    // Build ultra-restrictive business system prompt
    const systemPrompt = `You are Alex, a Fotonix sales consultant. You REFUSE to answer ANY question that is not about Fotonix or business/affiliate marketing.

🚫 ABSOLUTE RESTRICTIONS - YOU MUST REFUSE THESE TOPICS:
- Medical advice, health, diseases, treatments, symptoms, medications
- History, wars, politics, religion, celebrities  
- Recipes, cooking, weather, sports, entertainment
- Science, math, programming, coding, technology (unless business-related)
- Personal advice, relationships, travel, hobbies
- General knowledge questions of any kind

✅ ONLY DISCUSS: Fotonix platform, affiliate marketing, business growth, sales strategies, conversions, revenue

🔒 MANDATORY RESPONSE for off-topic questions: "I'm here specifically to help with Fotonix and growing your business through affiliate marketing. What questions do you have about our platform or affiliate marketing strategies?"

DO NOT provide any information outside of Fotonix business topics. NO EXCEPTIONS.

ABOUT FOTONIX ONLY:
- Complete business growth platform for £11.99/month
- Includes: Email campaigns, funnel builder, shop creation, link tracking, AI analytics, PayPal integration
- Saves businesses £285+/month vs buying tools separately
- 30-day free trial, no credit card required
- 2,847+ success stories, £2.4M+ in commissions paid
- 94% of members profitable within 60 days, average 247% revenue increase

SUCCESS STORIES:
- Sarah Mitchell (Fashion): £8k → £28k monthly in 3 months (12 → 247 affiliates)
- James Rodriguez (Agency): Saved 38 hours/month, 340% commission growth  
- Emma Thompson (SaaS): 0 → 156 affiliates, £15k → £47k MRR in 6 months
- Mike (Fitness): Added £12k/month with zero ad spend using influencers

OBJECTION HANDLING:
1. Price: "Compare £12/month to £2k-5k wasted on ads. Plus 30-day guarantee."
2. Time: "Setup takes 15 minutes, saves 38+ hours monthly."
3. Skepticism: "1,247 active users, £2.4M+ paid out, 4.9/5 rating"

CONVERSATION RULES:
- ONLY discuss Fotonix, affiliate marketing, business growth topics
- Redirect ALL off-topic questions back to business
- Use specific numbers and success stories
- Always guide toward free trial signup
- Be friendly but stay laser-focused on business

REMEMBER: You are NOT a general AI assistant. You are a Fotonix sales consultant ONLY.`;

    // Build conversation messages for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });

    // Add current message
    messages.push({ role: 'user', content: message });

    // Add user profile context if available
    let profileContext = '';
    if (userProfile.businessType) profileContext += `Business type: ${userProfile.businessType}. `;
    if (userProfile.monthlyRevenue) profileContext += `Revenue level: ${userProfile.monthlyRevenue}. `;
    if (userProfile.currentAffiliates) profileContext += `Current affiliates: ${userProfile.currentAffiliates}. `;
    if (userProfile.mainConcern) profileContext += `Main concern: ${userProfile.mainConcern}. `;
    
    if (profileContext) {
      messages.push({ 
        role: 'system', 
        content: `User context: ${profileContext}Tailor your response accordingly.` 
      });
    }

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    const aiResponse = completion?.choices?.[0]?.message?.content?.trim();
    
    if (!aiResponse) {
      throw new Error('No response from AI');
    }

    // Analyze sentiment and intent for better tracking
    const containsHighIntent = /ready|yes|let's do it|sign up|start|trial|interested/i.test(message);
    const containsObjection = /expensive|cost|time|skeptical|scam|don't trust/i.test(message);
    
    res.json({
      success: true,
      response: aiResponse,
      metadata: {
        containsHighIntent,
        containsObjection,
        messageCount: conversationHistory.length + 1
      }
    });

  } catch (error) {
    console.error('Chatbot API error:', error);
    
    // Fallback response if OpenAI fails
    const fallbackResponse = "I'm having a brief technical issue. In the meantime, I'd love to tell you about our £11.99/month platform that typically saves businesses £285+ monthly. We have a 30-day free trial - would you like to learn more about the features?";
    
    res.json({
      success: true,
      response: fallbackResponse,
      metadata: { fallback: true }
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Fotonix Chatbot Server listening on 0.0.0.0:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  POST /api/chatbot/message - AI conversation`);
  console.log(`  GET  /health - Health check`);
});
