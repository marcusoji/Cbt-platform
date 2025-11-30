// api/index.js - Main API Router (Optional)
// This file is optional - Vercel automatically routes to individual files
// But you can use it as a health check or API documentation endpoint

const { corsHeaders, handleCORS, successResponse } = require('./_config');

module.exports = async (req, res) => {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle CORS preflight
  if (handleCORS(req, res)) return;

  const { method } = req;

  // GET /api - API Health Check & Documentation
  if (method === 'GET') {
    return successResponse(res, {
      name: 'CBT Platform API',
      version: '1.0.0',
      status: 'operational',
      timestamp: new Date().toISOString(),
      endpoints: {
        auth: {
          register: '/api/auth?action=register',
          login: '/api/auth?action=login',
          profile: '/api/auth?action=profile',
          unlock: '/api/auth?action=unlock'
        },
        exams: {
          types: '/api/exams?action=types',
          subjects: '/api/exams?action=subjects&examType=JAMB',
          years: '/api/exams?action=years&examType=JAMB&subject=Mathematics',
          start: '/api/exams?action=start',
          submitAnswer: '/api/exams?action=submit-answer',
          complete: '/api/exams?action=complete'
        },
        admin: {
          generateCodes: '/api/admin?action=generate-codes',
          getCodes: '/api/admin?action=get-codes',
          uploadQuestions: '/api/admin?action=upload-questions',
          getUsers: '/api/admin?action=get-users',
          statistics: '/api/admin?action=statistics',
          recentActivity: '/api/admin?action=recent-activity'
        }
      },
      documentation: 'https://github.com/marcusoji/cbt-platform#api-documentation',
      support: 'marcuoji@gmail.com'
    });
  }

  // Health check endpoint
  if (method === 'GET' && req.url.includes('/health')) {
    return successResponse(res, {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  }

  return successResponse(res, {
    message: 'CBT Platform API',
    version: '1.0.0',
    status: 'Use specific endpoints for functionality'
  });
};