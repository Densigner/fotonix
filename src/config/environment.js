// Environment configuration for different deployment stages
const config = {
  development: {
    apiUrl: 'http://localhost:4000',
    clientUrl: 'http://localhost:3001',
    environment: 'development'
  },
  staging: {
    apiUrl: 'https://staging-api.fotonix.co.uk',
    clientUrl: 'https://staging.fotonix.co.uk',
    environment: 'staging'
  },
  production: {
    apiUrl: 'https://api.fotonix.co.uk',
    clientUrl: 'https://fotonix.co.uk',
    environment: 'production'
  }
};

// Determine current environment
const getEnvironment = () => {
  // Check if we're in a build environment
  if (process.env.NODE_ENV === 'production') {
    // Check if it's staging based on hostname or environment variable
    if (process.env.REACT_APP_ENVIRONMENT === 'staging' || 
        window?.location?.hostname?.includes('staging')) {
      return 'staging';
    }
    return 'production';
  }
  return 'development';
};

const currentEnv = getEnvironment();
const currentConfig = config[currentEnv];

// Export the configuration
export const API_URL = currentConfig.apiUrl;
export const CLIENT_URL = currentConfig.clientUrl;
export const ENVIRONMENT = currentConfig.environment;
export const IS_DEVELOPMENT = currentEnv === 'development';
export const IS_STAGING = currentEnv === 'staging';
export const IS_PRODUCTION = currentEnv === 'production';

// API helper function
export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_URL}${endpoint}`;
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
    ...options,
  };

  try {
    const response = await fetch(url, defaultOptions);
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }
    
    return response;
  } catch (error) {
    console.error(`API call to ${endpoint} failed:`, error);
    throw error;
  }
};

// Debug logging in development
if (IS_DEVELOPMENT) {
  console.log('🔧 Environment Configuration:', {
    environment: ENVIRONMENT,
    apiUrl: API_URL,
    clientUrl: CLIENT_URL
  });
}

export default currentConfig;