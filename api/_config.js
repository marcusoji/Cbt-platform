// api/_config.js - Shared Configuration for Vercel Serverless Functions
const { createClient } = require('@supabase/supabase-js');

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials. Please set environment variables.');
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret-change-in-production';

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// Handle CORS preflight
function handleCORS(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

// Error response helper
function errorResponse(res, status, message) {
  return res.status(status).json({ error: message });
}

// Success response helper
function successResponse(res, data, status = 200) {
  return res.status(status).json(data);
}

module.exports = {
  supabase,
  JWT_SECRET,
  corsHeaders,
  handleCORS,
  errorResponse,
  successResponse
};