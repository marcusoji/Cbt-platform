// api/_middleware.js - Shared Middleware for Vercel Functions
const jwt = require('jsonwebtoken');
const { supabase, JWT_SECRET, errorResponse } = require('./_config');

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Authenticate user
 */
async function authenticateUser(req, res) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return { authenticated: false, error: 'No token provided' };
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return { authenticated: false, error: 'Invalid or expired token' };
  }

  return { 
    authenticated: true, 
    userId: decoded.userId, 
    email: decoded.email,
    role: decoded.role 
  };
}

/**
 * Require authentication
 */
async function requireAuth(req, res, next) {
  const auth = await authenticateUser(req, res);
  
  if (!auth.authenticated) {
    return errorResponse(res, 401, auth.error);
  }

  req.user = auth;
  if (next) next();
  return auth;
}

/**
 * Require admin role
 */
async function requireAdmin(req, res, next) {
  const auth = await requireAuth(req, res);
  
  if (!auth.authenticated) {
    return false;
  }

  if (auth.role !== 'admin') {
    return errorResponse(res, 403, 'Admin access required');
  }

  if (next) next();
  return true;
}

/**
 * Check premium access
 */
async function checkPremiumAccess(req, res) {
  const auth = await authenticateUser(req, res);
  
  if (!auth.authenticated) {
    return { hasAccess: false, error: 'Not authenticated' };
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', auth.userId)
      .single();

    if (error || !user) {
      return { hasAccess: false, error: 'User not found' };
    }

    // Check trial (3 days from registration)
    const trialEndDate = new Date(user.registration_date);
    trialEndDate.setDate(trialEndDate.getDate() + 3);
    const isTrialActive = new Date() < trialEndDate;

    // Check premium
    const isPremiumActive = user.is_premium && 
                           user.premium_expires_at && 
                           new Date(user.premium_expires_at) > new Date();

    if (isTrialActive || isPremiumActive) {
      return {
        hasAccess: true,
        accessType: isPremiumActive ? 'premium' : 'trial',
        expiresAt: isPremiumActive ? user.premium_expires_at : trialEndDate
      };
    }

    return { 
      hasAccess: false, 
      requiresPayment: true,
      message: 'Your trial has expired. Please unlock premium access.' 
    };
  } catch (error) {
    return { hasAccess: false, error: error.message };
  }
}

module.exports = {
  verifyToken,
  authenticateUser,
  requireAuth,
  requireAdmin,
  checkPremiumAccess
};