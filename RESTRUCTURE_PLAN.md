# 🏗️ Project Restructure & Link Management Unification Plan

## 🎯 Goals
1. **Unify Link Management** - Single coherent system for creating, managing, and tracking affiliate links
2. **Organize Components** - Group related functionality into logical folders
3. **Eliminate Duplication** - Remove redundant components and consolidate functionality
4. **Clear Separation** - Distinguish between Member tools vs Affiliate tools vs Admin tools

## 📁 Proposed New Structure

```
src/
├── components/                    # Shared/Common Components
│   ├── ui/                       # Basic UI components (buttons, inputs, etc.)
│   ├── layout/                   # Layout components (Header, Footer, etc.)
│   ├── auth/                     # Authentication components
│   └── shared/                   # Shared business components
│
├── features/                     # Feature-based organization
│   ├── affiliate/                # Affiliate-related features
│   │   ├── components/          # Affiliate-specific components
│   │   │   ├── AffiliateDashboard.jsx
│   │   │   ├── AffiliateSignup.jsx
│   │   │   └── AffiliateStats.jsx
│   │   ├── hooks/               # Affiliate-specific hooks
│   │   └── services/            # Affiliate API services
│   │
│   ├── members/                 # Member/Merchant features
│   │   ├── components/          # Member-specific components
│   │   │   ├── MembersDashboard.jsx
│   │   │   ├── ProductManagement.jsx
│   │   │   └── AffiliateManagement.jsx
│   │   ├── hooks/               # Member-specific hooks
│   │   └── services/            # Member API services
│   │
│   ├── links/                   # **UNIFIED Link Management System**
│   │   ├── components/          
│   │   │   ├── LinkDashboard.jsx        # Universal link dashboard
│   │   │   ├── LinkCreator.jsx          # Link creation form
│   │   │   ├── LinkStats.jsx            # Link analytics
│   │   │   └── LinkManager.jsx          # Link CRUD operations
│   │   ├── hooks/
│   │   │   ├── useLinks.js              # Link data management
│   │   │   ├── useLinkStats.js          # Link analytics
│   │   │   └── useLinkCreation.js       # Link creation logic
│   │   └── services/
│   │       └── linkService.js           # Link API calls
│   │
│   ├── products/                # Product management
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   │
│   ├── campaigns/               # Marketing campaigns (email, etc.)
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   │
│   └── admin/                   # Admin features
│       ├── components/
│       ├── hooks/
│       └── services/
│
├── hooks/                       # Global shared hooks
├── services/                    # Global API services
├── utils/                       # Utility functions
├── contexts/                    # React contexts
└── pages/                       # Page-level components
```

## 🔗 Unified Link Management System

### Current Problems:
1. **Duplicate Components**: Two different `AffiliateLinkDashboard` files with similar functionality
2. **Confusing Separation**: Members and affiliates have different interfaces for essentially the same data
3. **Inconsistent APIs**: Different endpoints and data formats across components
4. **No Central State Management**: Each component manages its own link state

### Proposed Solution: **Universal Link System**

#### Core Concept:
- **ONE** unified link management system that works for both Members and Affiliates
- **Role-based views** of the same underlying data
- **Centralized state management** with shared hooks
- **Consistent API layer** with standardized data formats

#### Key Components:

1. **LinkDashboard.jsx** - Universal dashboard that adapts based on user role:
   ```jsx
   <LinkDashboard 
     userType="member|affiliate|admin"
     userId={currentUser.id}
     capabilities={['create', 'view', 'edit', 'delete']}
   />
   ```

2. **LinkCreator.jsx** - Unified link creation:
   - Members: Create links for their products → affiliates
   - Affiliates: Create links for available products
   - Admins: Create any links

3. **LinkManager.jsx** - CRUD operations with role-based permissions:
   - View permissions: What links can this user see?
   - Edit permissions: What can they modify?
   - Analytics: What stats can they access?

### Data Flow:
```
User Action → LinkManager → linkService.js → Unified API → Database
     ↓
LinkDashboard ← useLinks() ← Centralized State ← API Response
```

## 🚀 Migration Plan

### Phase 1: Consolidate Link Components
1. Create new `src/features/links/` structure
2. Merge functionality from duplicate `AffiliateLinkDashboard` files
3. Extract common logic into shared hooks
4. Build unified `LinkDashboard` component

### Phase 2: Update Member Dashboard
1. Replace `MemberAffiliateLinker` with new unified system
2. Update "Manage Affiliates" button to point to new LinkDashboard
3. Ensure member-specific capabilities are properly configured

### Phase 3: Update Affiliate Dashboard
1. Replace existing affiliate link management with unified system
2. Ensure affiliate-specific views and permissions
3. Test affiliate workflow end-to-end

### Phase 4: Clean Up & Organize
1. Move remaining components into feature folders
2. Remove duplicate/obsolete files
3. Update import paths across the application
4. Update documentation

## 🔧 Implementation Details

### Unified Link Data Model:
```javascript
{
  id: string,
  slug: string,
  url: string,              // Full URL: https://site.com/l/{slug}
  productId: string,
  affiliateId: string,
  createdById: string,      // Who created this link
  createdByType: 'member|affiliate|admin',
  
  // Commission settings
  commissionRate: number,   // Decimal (0.15 = 15%)
  customRate: boolean,      // Is this a custom rate override?
  
  // Analytics
  clicks: number,
  conversions: number,
  revenue: number,
  
  // Metadata
  title?: string,
  description?: string,
  status: 'active|paused|disabled',
  createdAt: Date,
  updatedAt: Date,
  lastClickAt?: Date
}
```

### Role-Based Capabilities:
```javascript
const CAPABILITIES = {
  member: ['create', 'view_own', 'edit_own', 'delete_own', 'analytics_own'],
  affiliate: ['view_assigned', 'analytics_assigned', 'create_referral'],
  admin: ['view_all', 'edit_all', 'delete_all', 'analytics_all', 'manage_settings']
};
```

### Unified API Endpoints:
```
GET    /api/links                 # List links (filtered by user permissions)
POST   /api/links                 # Create new link
GET    /api/links/:id             # Get specific link
PUT    /api/links/:id             # Update link
DELETE /api/links/:id             # Delete link
GET    /api/links/:id/analytics   # Link analytics
POST   /api/links/bulk            # Bulk operations
```

## 📋 Benefits of This Approach

1. **Reduced Complexity**: One system instead of multiple overlapping ones
2. **Consistent UX**: Same interface patterns across user types
3. **Maintainable Code**: Centralized logic, easier to update and debug
4. **Scalable Architecture**: Easy to add new user types or capabilities
5. **Better Testing**: Concentrated functionality is easier to test
6. **Clear Ownership**: Each feature has a dedicated folder and responsibility

## 🎯 Next Steps

1. **Review & Approve**: Review this plan and make adjustments
2. **Start Phase 1**: Begin with link component consolidation
3. **Iterative Implementation**: Implement in phases to avoid breaking changes
4. **Testing**: Test each phase thoroughly before moving to the next
5. **Documentation**: Update documentation as we restructure

This approach will give us a much more maintainable and user-friendly link management system while organizing the entire codebase for future growth.