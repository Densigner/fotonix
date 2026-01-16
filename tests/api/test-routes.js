const express = require('express');
const memberBusinessEmail = require('./server/routes/member-business-email');

const app = express();

console.log('Testing route mounting...');

// Test mounting
app.use('/api/member', memberBusinessEmail);

// List all routes
function listRoutes(router) {
  const routes = [];
  router.stack.forEach((middleware) => {
    if (middleware.route) {
      // Single route
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router' && middleware.regexp) {
      // Router middleware
      const prefix = middleware.regexp.source.replace(/\$|\^|\?\(/g, '').replace(/\).*/, '');
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push({
            path: prefix.replace(/\\/g, '') + handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  return routes;
}

const routes = listRoutes(app);
console.log('\n📋 Available routes:');
routes.forEach(route => {
  console.log(`${route.methods.join(',').toUpperCase()} ${route.path}`);
});

console.log('\n✅ Route mounting test complete');