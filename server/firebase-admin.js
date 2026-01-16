const admin = require('firebase-admin');

// Initialize Firebase Admin SDK (only once)
if (!admin.apps.length) {
  // Try to use service account from environment or file
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  
  if (serviceAccountPath) {
    // Use service account file path from environment
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: 'https://fotonix-97544-default-rtdb.europe-west1.firebasedatabase.app'
    });
    console.log('✅ Firebase Admin initialized with service account file');
  } else {
    // Try to initialize with default credentials (works on Google Cloud, Firebase Hosting, etc.)
    // Or use a local service account JSON if it exists
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Check for common service account file locations
      const possiblePaths = [
        path.join(__dirname, 'serviceAccountKey.json'),
        path.join(__dirname, '..', 'serviceAccountKey.json'),
        path.join(__dirname, 'firebase-service-account.json'),
        path.join(__dirname, '..', 'firebase-service-account.json'),
      ];
      
      let serviceAccount = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          serviceAccount = require(p);
          console.log(`✅ Found service account at: ${p}`);
          break;
        }
      }
      
      if (serviceAccount) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: 'https://fotonix-97544-default-rtdb.europe-west1.firebasedatabase.app'
        });
        console.log('✅ Firebase Admin initialized with local service account');
      } else {
        // Last resort: try application default credentials
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          databaseURL: 'https://fotonix-97544-default-rtdb.europe-west1.firebasedatabase.app'
        });
        console.log('✅ Firebase Admin initialized with application default credentials');
      }
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Admin:', error.message);
      console.error('   Please set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccountKey.json in the server directory');
      
      // Initialize without credentials - will fail on database operations but won't crash on import
      admin.initializeApp({
        databaseURL: 'https://fotonix-97544-default-rtdb.europe-west1.firebasedatabase.app'
      });
      console.warn('⚠️  Firebase Admin initialized without credentials - database operations will fail');
    }
  }
}

module.exports = admin;
