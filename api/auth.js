// api/auth.js - Authentication Endpoints for Vercel
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase, JWT_SECRET, corsHeaders, handleCORS, errorResponse, successResponse } = require('./_config');
const { requireAuth } = require('./_middleware');

module.exports = async (req, res) => {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle CORS preflight
  if (handleCORS(req, res)) return;

  const { method } = req;
  const path = req.url.split('?')[0];

  try {
    // POST /api/auth?action=register
    if (method === 'POST' && req.query.action === 'register') {
      const { fullName, email, phone, password } = req.body;

      // Check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        return errorResponse(res, 400, 'Email already registered');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Calculate trial end date
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 3);

      // Insert user
      const { data: user, error } = await supabase
        .from('users')
        .insert([{
          full_name: fullName,
          email: email,
          phone: phone,
          password: hashedPassword,
          role: 'student',
          registration_date: new Date().toISOString(),
          trial_ends_at: trialEndsAt.toISOString(),
          is_premium: false
        }])
        .select()
        .single();

      if (error) throw error;

      // Generate JWT
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      return successResponse(res, {
        message: 'Registration successful! You have 3 days free trial.',
        token,
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          trialEndsAt: user.trial_ends_at
        }
      }, 201);
    }

    // POST /api/auth?action=login
    if (method === 'POST' && req.query.action === 'login') {
      const { email, password } = req.body;

      // Get user
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !user) {
        return errorResponse(res, 400, 'Invalid email or password');
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return errorResponse(res, 400, 'Invalid email or password');
      }

      // Generate JWT
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      return successResponse(res, {
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          role: user.role,
          isPremium: user.is_premium,
          premiumExpiresAt: user.premium_expires_at,
          trialEndsAt: user.trial_ends_at
        }
      });
    }

    // GET /api/auth?action=profile
    if (method === 'GET' && req.query.action === 'profile') {
      const auth = await requireAuth(req, res);
      if (!auth.authenticated) return;

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', auth.userId)
        .single();

      if (error) throw error;

      const trialEndDate = new Date(user.registration_date);
      trialEndDate.setDate(trialEndDate.getDate() + 3);
      const isTrialActive = new Date() < trialEndDate;
      const isPremiumActive = user.is_premium && 
                             user.premium_expires_at && 
                             new Date(user.premium_expires_at) > new Date();

      // Remove password from response
      delete user.password;

      return successResponse(res, {
        user,
        access: {
          hasAccess: isTrialActive || isPremiumActive,
          type: isPremiumActive ? 'premium' : isTrialActive ? 'trial' : 'expired',
          expiresAt: isPremiumActive ? user.premium_expires_at : trialEndDate
        }
      });
    }

    // POST /api/auth?action=unlock
    if (method === 'POST' && req.query.action === 'unlock') {
      const auth = await requireAuth(req, res);
      if (!auth.authenticated) return;

      const { code } = req.body;

      // Check if code exists and is unused
      const { data: unlockCode, error: codeError } = await supabase
        .from('unlock_codes')
        .select('*')
        .eq('code', code)
        .eq('is_used', false)
        .single();

      if (codeError || !unlockCode) {
        return errorResponse(res, 400, 'Invalid or already used unlock code');
      }

      // Calculate expiry date
      const premiumExpiresAt = new Date();
      premiumExpiresAt.setMonth(premiumExpiresAt.getMonth() + unlockCode.duration);

      // Update user
      const { error: updateError } = await supabase
        .from('users')
        .update({
          is_premium: true,
          premium_expires_at: premiumExpiresAt.toISOString(),
          used_unlock_code: code
        })
        .eq('id', auth.userId);

      if (updateError) throw updateError;

      // Mark code as used
      await supabase
        .from('unlock_codes')
        .update({
          is_used: true,
          used_by: auth.userId,
          used_at: new Date().toISOString()
        })
        .eq('code', code);

      return successResponse(res, {
        message: 'Premium access unlocked successfully!',
        premiumExpiresAt: premiumExpiresAt.toISOString()
      });
    }

    return errorResponse(res, 400, 'Invalid action');

  } catch (error) {
    console.error('Auth API Error:', error);
    return errorResponse(res, 500, error.message);
  }
};