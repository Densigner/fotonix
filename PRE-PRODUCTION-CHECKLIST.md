# Pre-Production Deployment Checklist

## 🗃️ Database Migration
- [ ] **Run Products Table Setup**
  ```bash
  node setup-products-table.js
  ```
- [ ] **Verify PostgreSQL Connection**
  - Confirm DATABASE_URL is correct for production
  - Test connection from production server

## 🔧 Environment Configuration  
- [ ] **Update Environment Variables**
  - [ ] Set `REACT_APP_ENVIRONMENT=production`
  - [ ] Configure production `DATABASE_URL`
  - [ ] Set secure `COOKIE_SECRET`
  - [ ] Configure production Firebase credentials
  - [ ] Set production PayPal credentials

- [ ] **API URLs Configuration**
  - [ ] Development: `http://localhost:4000`
  - [ ] Staging: `https://staging-api.fotonix.co.uk`
  - [ ] Production: `https://api.fotonix.co.uk`

## 🔐 Security Checklist
- [ ] **Secure Cookie Configuration**
  - [ ] Generate new COOKIE_SECRET for production
  - [ ] Enable secure cookies (HTTPS only)
  - [ ] Set proper CORS origins

- [ ] **Database Security**
  - [ ] Use SSL connection for production database
  - [ ] Create dedicated database user with limited permissions
  - [ ] Enable connection pooling

## 🌐 Domain & DNS Setup
- [ ] **API Domain Configuration**
  - [ ] Set up `api.fotonix.co.uk` subdomain
  - [ ] Configure SSL certificates
  - [ ] Test API endpoints

- [ ] **Client Domain Configuration**
  - [ ] Configure `fotonix.co.uk` main domain
  - [ ] Set up CDN if needed
  - [ ] Test all routes

## 📦 Build & Deployment
- [ ] **React Build Process**
  ```bash
  npm run build
  ```
  - [ ] Verify build completes without errors
  - [ ] Test built application locally
  - [ ] Check bundle size and performance

- [ ] **Server Deployment**
  - [ ] Deploy Node.js server to production
  - [ ] Configure process manager (PM2, etc.)
  - [ ] Set up health checks
  - [ ] Configure logging

## 🧪 Testing Before Go-Live
- [ ] **Database Operations**
  - [ ] Test product creation
  - [ ] Test product listing
  - [ ] Test product updates
  - [ ] Test product deletion

- [ ] **API Endpoints** 
  - [ ] Test `/api/member/products` GET
  - [ ] Test `/api/member/products` POST
  - [ ] Test `/api/member/products/:id` PUT
  - [ ] Test `/api/member/products/:id` DELETE

- [ ] **Firebase Storage**
  - [ ] Test image uploads
  - [ ] Test image URL generation
  - [ ] Verify image serving from CDN

- [ ] **Store Builder**
  - [ ] Test product grid loading
  - [ ] Test store preview
  - [ ] Test store saving

## 🔄 Migration from File System
- [ ] **Data Migration Script**
  ```bash
  # Run this to migrate existing products.json to PostgreSQL
  node migrate-products-to-db.js
  ```
- [ ] **Backup Old Data**
  - [ ] Backup `server/data/products.json`
  - [ ] Backup any other JSON data files

## 📊 Monitoring & Analytics
- [ ] **Error Tracking**
  - [ ] Set up error logging (Sentry, etc.)
  - [ ] Configure alerts for API errors
  - [ ] Monitor database performance

- [ ] **Performance Monitoring**
  - [ ] Set up application performance monitoring
  - [ ] Monitor API response times
  - [ ] Track database query performance

## 🚀 Go-Live Steps
1. **Deploy API Server**
2. **Deploy React Application** 
3. **Update DNS records**
4. **Test all functionality**
5. **Monitor for issues**

## 📋 Post-Deployment Verification
- [ ] **Functionality Tests**
  - [ ] User can create products
  - [ ] Products appear in store builder
  - [ ] Images upload successfully
  - [ ] Store preview works
  - [ ] Store saving works

- [ ] **Performance Checks**
  - [ ] API response times < 500ms
  - [ ] Image loading is fast
  - [ ] Database queries are optimized

## 🔄 Rollback Plan
- [ ] **Database Rollback**
  - [ ] Keep backup of old products.json system
  - [ ] Document rollback steps
  
- [ ] **Code Rollback**
  - [ ] Tag current version before deployment
  - [ ] Prepare quick rollback script

---

## Quick Commands Reference

```bash
# Setup database
node setup-products-table.js

# Build for production
npm run build

# Test API locally
curl -X GET http://localhost:4000/api/member/products

# Check environment
echo $REACT_APP_ENVIRONMENT
```