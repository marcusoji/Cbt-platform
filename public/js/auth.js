// js/auth.js - Authentication Helper Functions

const API_URL = '/api';

/**
 * Register a new user
 */
async function register(fullName, email, phone, password) {
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fullName, email, phone, password })
    });

    const data = await response.json();

    if (response.ok) {
      // Save token and user info
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      return { success: true, data };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: 'Network error. Please check your connection.' };
  }
}

/**
 * Login user
 */
async function login(email, password) {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      return { success: true, data };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: 'Network error. Please check your connection.' };
  }
}

/**
 * Logout user
 */
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('currentSession');
  localStorage.removeItem('examResults');
  window.location.href = '/login.html';
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  const token = localStorage.getItem('token');
  return !!token;
}

/**
 * Get current user
 */
function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * Get auth token
 */
function getAuthToken() {
  return localStorage.getItem('token');
}

/**
 * Get user profile
 */
async function getProfile() {
  try {
    const token = getAuthToken();
    
    const response = await fetch(`${API_URL}/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      // Update local storage
      localStorage.setItem('user', JSON.stringify(data.user));
      return { success: true, data };
    } else {
      if (response.status === 401 || response.status === 403) {
        logout();
      }
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

/**
 * Check premium access
 */
async function checkAccess() {
  const result = await getProfile();
  
  if (result.success) {
    return result.data.access;
  }
  
  return { hasAccess: false, type: 'expired' };
}

/**
 * Unlock premium with code
 */
async function unlockPremium(code) {
  try {
    const token = getAuthToken();
    
    const response = await fetch(`${API_URL}/auth/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ code })
    });

    const data = await response.json();

    if (response.ok) {
      // Refresh profile
      await getProfile();
      return { success: true, data };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

/**
 * Protect page (redirect if not authenticated)
 */
function protectPage() {
  if (!isAuthenticated()) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

/**
 * Require admin access
 */
function requireAdmin() {
  if (!isAuthenticated()) {
    window.location.href = '/login.html';
    return false;
  }

  const user = getCurrentUser();
  if (!user || user.role !== 'admin') {
    alert('Admin access required');
    window.location.href = '/dashboard.html';
    return false;
  }

  return true;
}

/**
 * Format user name
 */
function getDisplayName() {
  const user = getCurrentUser();
  if (!user) return 'User';
  
  const firstName = user.fullName ? user.fullName.split(' ')[0] : 'User';
  return firstName;
}

/**
 * Check if trial is expired
 */
function isTrialExpired() {
  const user = getCurrentUser();
  if (!user) return true;

  if (user.isPremium && user.premiumExpiresAt) {
    return new Date(user.premiumExpiresAt) < new Date();
  }

  if (user.trialEndsAt) {
    return new Date(user.trialEndsAt) < new Date();
  }

  // Calculate trial end (3 days from registration)
  if (user.registrationDate) {
    const trialEnd = new Date(user.registrationDate);
    trialEnd.setDate(trialEnd.getDate() + 3);
    return new Date() > trialEnd;
  }

  return true;
}

/**
 * Get days remaining
 */
function getDaysRemaining() {
  const user = getCurrentUser();
  if (!user) return 0;

  let expiryDate;

  if (user.isPremium && user.premiumExpiresAt) {
    expiryDate = new Date(user.premiumExpiresAt);
  } else if (user.trialEndsAt) {
    expiryDate = new Date(user.trialEndsAt);
  } else {
    return 0;
  }

  const now = new Date();
  const diff = expiryDate - now;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  return days > 0 ? days : 0;
}

// Export for use in other files (if using modules)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    register,
    login,
    logout,
    isAuthenticated,
    getCurrentUser,
    getAuthToken,
    getProfile,
    checkAccess,
    unlockPremium,
    protectPage,
    requireAdmin,
    getDisplayName,
    isTrialExpired,
    getDaysRemaining
  };
}