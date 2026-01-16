# Fotonix Platform Architecture

**Last Updated:** November 4, 2025  
**Version:** 2.0 (Post AI Integration & Free Trial Implementation)

## Overview

Fotonix is a comprehensive business growth platform focused on affiliate marketing, providing email campaigns, funnel building, link tracking, and AI-powered conversion optimization.

## Core Features

### 🤖 **AI Chatbot Integration**
- **Model:** OpenAI GPT-4o-mini
- **Purpose:** Business-focused conversion chatbot with intelligent objection handling
- **Restrictions:** Ultra-restrictive prompts prevent off-topic discussions (no medical, historical, or general knowledge responses)
- **Business Context:** Complete knowledge of Fotonix features, pricing (£11.99/month), success stories, and ROI calculations
- **Filtering:** Pre-filters obvious off-topic queries before OpenAI API calls to save costs

### 🆓 **Free Trial System**
- **Duration:** 30-day full access trial
- **Registration:** Frictionless 3-field signup (email, name, business type)
- **Session Management:** Cookie-based user sessions with trial tracking
- **Access Control:** SubscriptionGate component manages trial vs. expired access
- **Welcome Flow:** Automated welcome email (currently disabled for debugging)

### ✅ **Honest Marketing Approach**
- **Removed:** All fake social proof indicators (fake user counts, simulated notifications)
- **Replaced:** Authentic messaging focusing on real value propositions
- **Trust Building:** Transparent 30-day guarantee and honest trial terms

## Technical Stack

### Frontend (React)
- **Framework:** React 19.1.0 with Create React App
- **Styling:** Tailwind CSS with custom components
- **Routing:** Hash-based routing (`window.location.hash`)
- **State Management:** Component-level useState hooks
- **Dev Server:** Port 3001 with proxy to API server

### Backend (Node.js/Express)
- **Runtime:** Node.js with Express 5.1.0
- **API Server:** Port 5002 (configurable via PORT env)
- **Session Management:** HTTP-only cookies for trial user sessions
- **CORS:** Configured for localhost:3001 development
- **Logging:** Morgan for HTTP request logging

### AI Integration
- **Provider:** OpenAI API
- **Model:** gpt-4o-mini (configurable via OPENAI_MODEL env)
- **API Key:** Stored in OPENAI_API_KEY environment variable
- **Endpoints:** `/api/chatbot/message` for conversation handling
- **Cost Optimization:** Pre-filtering to avoid unnecessary API calls

### Database

#### Membership System Database
- **Primary:** PostgreSQL for production data
- **Development:** File-based fallbacks for local development
- **ORM:** Custom query wrapper in `src/db/client.js`
- **Migrations:** Available via `npm run migrate`

#### Link Management Database (Completely Separate)
- **Setup Script:** `setup-database.js` creates tracking tables
- **Performance:** Optimized indexes for high-volume click tracking
- **Indexes:**
  - `idx_tracked_links_slug` - Fast slug lookups for redirects
  - `idx_tracked_links_user_id` - Affiliate-specific link filtering
  - `idx_link_clicks_link_id` - Click aggregation and analytics
  - `idx_link_clicks_visitor_id` - Unique visitor tracking

## Key Components

### Membership & Conversion Funnel

#### `App.js`
- **Purpose:** Main application orchestration and routing
- **Current State:** Clean landing page without conversion components
- **Routes:** Hash-based navigation between home, member-dashboard, etc.
- **Recent Changes:** Removed FeaturesShowcase from landing page per user requirements

#### `SubscriptionGate.jsx`
- **Purpose:** Access control and conversion funnel for unauthorized users
- **Features:** Trial status checking, conversion components, AI chatbot integration
- **Logic:** Allows access for active trial users, shows conversion flow for expired/no subscription
- **Enhanced:** Now includes FeaturesShowcase, ValueTestimonials, and ConversionChatbot

#### `FreeTrialSignup.jsx`
- **Purpose:** Frictionless trial registration modal
- **Fields:** Email, first name, business type selection
- **Validation:** Real-time form validation with error handling
- **API Integration:** Direct calls to `/api/signup/trial` (bypassing proxy for reliability)
- **Success Flow:** User creation → session storage → dashboard redirect

#### `ConversionChatbot.jsx`
- **Purpose:** AI-powered conversion optimization chatbot
- **Integration:** OpenAI API with business-specific prompts
- **Features:** Conversation history, objection handling, lead capture
- **Recent Changes:** Replaced rule-based responses with AI-generated content

### Link Management & Affiliate System

#### Database Schema
**`tracked_links` table:**
- `id` (Primary Key), `user_id` (Affiliate identifier)
- `slug` (Unique short code), `destination_url` (Target URL)
- `title`, `product_id`, `channel`, `meta` (JSONB)
- `created_at` timestamp with proper indexing

**`link_clicks` table:**
- `id` (Primary Key), `link_id` (Foreign key to tracked_links)
- `channel`, `ip_address`, `user_agent`, `referrer`, `visitor_id`
- `created_at` timestamp for analytics

#### Link Management Components

#### `AffiliateDashboard.js`
- **Purpose:** Complete affiliate control center and analytics hub
- **Features:** KPI metrics, conversion tracking, commission management
- **Tools Integration:** Shop Builder, Products, Mail Campaign, Funnel Builder
- **Analytics:** Real-time click tracking, revenue attribution, time-series charts
- **Commission System:** Pending/approved commission tracking with filtering

#### `AffiliateLinkDashboard.js`
- **Purpose:** Dedicated link management interface
- **Features:** Sortable link table with search/pagination functionality
- **Metrics:** Click counts, unique visitors, creation dates per link
- **Actions:** Copy links, view stats, open destination URLs
- **Mock Fallback:** Graceful degradation when API unavailable

#### `AffiliateDashboardclick.jsx`
- **Purpose:** Advanced analytics visualizations for link performance
- **Charts:** Line charts (clicks over time), bar charts (channel performance), pie charts (referrer sources)
- **Data Sources:** Multi-dimensional reporting (time, channel, referrer breakdown)
- **Styling:** Dark theme with gradient visualizations

#### `AffiliateClickCard.jsx`
- **Purpose:** Navigation component for accessing click analytics
- **Functionality:** Hash-based routing to affiliate-clicks section
- **Display:** Image card or placeholder for clicks & conversions

#### `AffiliateSignupPage.js`
- **Purpose:** Affiliate program onboarding and registration
- **Features:** Email/password signup with affiliate code generation
- **Integration:** Firebase auth + Realtime Database affiliate records
- **Email Verification:** Automatic verification email sending
- **Approval Process:** Manual affiliate approval system

### Backend API Endpoints

#### Authentication & User Management
- `GET /api/subscriptions/status` - Check trial/subscription status
- `POST /api/signup/trial` - Create new trial user account
- `GET /api/user/current` - Get current authenticated user info

#### AI Integration
- `POST /api/chatbot/message` - Handle AI chatbot conversations with OpenAI

#### Link Management System (Separate from Membership)
- `POST /api/links` - Create new tracked links with slug generation
- `GET /api/links?user={affiliateCode}` - List all links for specific affiliate
- `GET /api/links/:slug/stats` - Detailed analytics for specific link
- `GET /l/:slug` - Link resolution and click tracking redirect

#### Affiliate Analytics & Tracking
- `GET /api/affiliate/stats?user={code}` - Comprehensive affiliate performance data
  - Summary: Total clicks, unique visitors, revenue
  - Daily: Time series data for charts
  - Channels: Performance by traffic source
  - Top Links: Best performing links breakdown
  - Referrers: Traffic source analysis

#### Business Features (Membership Related)
- `POST /api/email/send` - Email campaign system (welcome emails, etc.)
- PayPal integration and other subscription features

## Environment Configuration

### Required Environment Variables
```bash
# OpenAI Integration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini

# Database
DATABASE_URL=postgres://username:password@localhost:5432/database_name

# Server Configuration
PORT=5002
NODE_ENV=development

# Security
COOKIE_SECRET=your_cookie_secret_here

# Optional: Frontend URL for emails
FRONTEND_URL=http://localhost:3001
```

## Development Workflow

### Starting the Application
```bash
# Install dependencies
npm install

# Start API server (Terminal 1)
npm run start:server

# Start React development server (Terminal 2)  
npm start
```

### Architecture Decisions Made

#### 1. **AI Chatbot Restrictions** (Nov 3, 2025)
- **Problem:** AI was answering off-topic questions (medical, historical, general knowledge)
- **Solution:** Multi-layer filtering system with aggressive business-only prompts
- **Implementation:** Pre-filtering keywords + ultra-restrictive system prompts

#### 2. **Free Trial Implementation** (Nov 3, 2025)
- **Problem:** "Start Free Trial" buttons led nowhere
- **Solution:** Complete signup flow with cookie-based sessions
- **Implementation:** Modal signup → API endpoint → session creation → dashboard access

#### 3. **Honest Marketing Pivot** (Nov 3, 2025)
- **Problem:** Fake social proof undermined trust
- **Solution:** Removed all simulated metrics and notifications
- **Implementation:** Cleaned SocialProofWidgets.jsx of fake counters and notifications

#### 4. **Direct API Calls** (Nov 4, 2025)
- **Problem:** Proxy issues causing "Unexpected token '<'" JSON errors
- **Solution:** Direct API calls to localhost:5002 with CORS credentials
- **Implementation:** Updated FreeTrialSignup to bypass React proxy

## Security Considerations

### Session Management
- HTTP-only cookies prevent XSS attacks
- 30-day cookie expiration matches trial period
- Secure flag enabled in production

### AI Safety
- Business-only responses prevent misuse as general AI service
- Pre-filtering reduces OpenAI API costs and exposure
- User input validation prevents prompt injection

### Data Protection
- Email validation prevents malformed addresses
- Input sanitization on all form fields
- Error handling prevents information leakage

## Monitoring & Debugging

### Logging Strategy
- **Server:** Morgan HTTP logging + custom endpoint logging
- **AI Requests:** Full conversation logging for debugging
- **Errors:** Comprehensive error handling with user-friendly messages
- **Development:** Console logging for signup flow debugging

### Performance Optimization
- AI pre-filtering reduces API costs
- Cookie-based sessions avoid database lookups
- Componentized React architecture for efficient rendering

## Future Considerations

### Scalability
- Database connection pooling for production
- Redis session storage for multi-instance deployments
- CDN integration for static assets

### Enhanced AI Features
- Conversation analytics and optimization
- A/B testing of AI prompts
- Integration with business metrics

### Membership System Growth
- Payment gateway integration for subscription upgrades
- Multi-tenant architecture for white-label solutions
- Enhanced trial-to-paid conversion optimization

### Link Management System Growth
- **Current Status:** Already has enterprise-grade click tracking with real-time analytics
- Advanced attribution modeling for multi-touch campaigns
- API rate limiting and enterprise affiliate management
- Custom domain support for branded short links
- White-label link management for reseller partners

---

**Note:** This architecture reflects the current state after significant refactoring in November 2025, focusing on honest marketing, AI integration, and frictionless user onboarding.