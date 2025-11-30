// api/admin.js - Admin Management Endpoints for Vercel
const { supabase, corsHeaders, handleCORS, errorResponse, successResponse } = require('./_config');
const { requireAuth, requireAdmin } = require('./_middleware');

module.exports = async (req, res) => {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle CORS preflight
  if (handleCORS(req, res)) return;

  const { method } = req;
  const action = req.query.action;

  try {
    // Verify admin access for all admin endpoints
    const auth = await requireAuth(req, res);
    if (!auth.authenticated) return;

    const isAdmin = await requireAdmin(req, res);
    if (!isAdmin) return;

    // POST /api/admin?action=generate-codes
    if (method === 'POST' && action === 'generate-codes') {
      const { duration = 9, quantity = 1 } = req.body;

      if (quantity > 100) {
        return errorResponse(res, 400, 'Maximum 100 codes at once');
      }

      const codes = [];
      for (let i = 0; i < quantity; i++) {
        const code = `CBT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        
        const { error } = await supabase
          .from('unlock_codes')
          .insert([{
            code: code,
            duration: duration,
            is_used: false,
            generated_by: auth.userId,
            generated_at: new Date().toISOString()
          }]);

        if (error) throw error;
        codes.push(code);

        // Small delay to ensure unique timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      return successResponse(res, { 
        message: 'Codes generated successfully', 
        codes 
      }, 201);
    }

    // GET /api/admin?action=get-codes
    if (method === 'GET' && action === 'get-codes') {
      const { data, error } = await supabase
        .from('unlock_codes')
        .select(`
          *,
          users!unlock_codes_used_by_fkey(full_name, email)
        `)
        .order('generated_at', { ascending: false });

      if (error) throw error;

      return successResponse(res, { codes: data });
    }

    // DELETE /api/admin?action=delete-code&codeId=xxx
    if (method === 'DELETE' && action === 'delete-code') {
      const { codeId } = req.query;

      if (!codeId) {
        return errorResponse(res, 400, 'codeId is required');
      }

      const { error } = await supabase
        .from('unlock_codes')
        .delete()
        .eq('id', codeId)
        .eq('is_used', false); // Only allow deleting unused codes

      if (error) throw error;

      return successResponse(res, { message: 'Code deleted successfully' });
    }

    // POST /api/admin?action=upload-questions
    if (method === 'POST' && action === 'upload-questions') {
      const { questions } = req.body;

      if (!questions || !Array.isArray(questions)) {
        return errorResponse(res, 400, 'Invalid questions array');
      }

      // Transform to snake_case for database
      const dbQuestions = questions.map(q => ({
        exam_type: q.examType,
        subject: q.subject,
        year: q.year,
        topic: q.topic || null,
        question_type: q.questionType || 'multiple-choice',
        question_text: q.questionText,
        question_image: q.questionImage || null,
        options: q.options, // PostgreSQL JSONB
        correct_answer: q.correctAnswer,
        explanation: q.explanation || null,
        difficulty: q.difficulty || 'medium'
      }));

      const { data, error } = await supabase
        .from('questions')
        .insert(dbQuestions)
        .select();

      if (error) throw error;

      return successResponse(res, { 
        message: 'Questions uploaded successfully', 
        count: data.length 
      }, 201);
    }

    // DELETE /api/admin?action=delete-question&questionId=xxx
    if (method === 'DELETE' && action === 'delete-question') {
      const { questionId } = req.query;

      if (!questionId) {
        return errorResponse(res, 400, 'questionId is required');
      }

      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;

      return successResponse(res, { message: 'Question deleted successfully' });
    }

    // GET /api/admin?action=get-users
    if (method === 'GET' && action === 'get-users') {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, phone, role, is_premium, registration_date, premium_expires_at, trial_ends_at, used_unlock_code')
        .order('registration_date', { ascending: false });

      if (error) throw error;

      return successResponse(res, { users: data });
    }

    // POST /api/admin?action=grant-premium&userId=xxx
    if (method === 'POST' && action === 'grant-premium') {
      const { userId, months = 9 } = req.body;

      if (!userId) {
        return errorResponse(res, 400, 'userId is required');
      }

      const premiumExpiresAt = new Date();
      premiumExpiresAt.setMonth(premiumExpiresAt.getMonth() + months);

      const { error } = await supabase
        .from('users')
        .update({
          is_premium: true,
          premium_expires_at: premiumExpiresAt.toISOString()
        })
        .eq('id', userId);

      if (error) throw error;

      return successResponse(res, { 
        message: 'Premium access granted',
        expiresAt: premiumExpiresAt.toISOString()
      });
    }

    // DELETE /api/admin?action=revoke-premium&userId=xxx
    if (method === 'DELETE' && action === 'revoke-premium') {
      const { userId } = req.query;

      if (!userId) {
        return errorResponse(res, 400, 'userId is required');
      }

      const { error } = await supabase
        .from('users')
        .update({
          is_premium: false,
          premium_expires_at: null
        })
        .eq('id', userId);

      if (error) throw error;

      return successResponse(res, { message: 'Premium access revoked' });
    }

    // GET /api/admin?action=statistics
    if (method === 'GET' && action === 'statistics') {
      const [users, questions, sessions, codes] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('questions').select('*', { count: 'exact', head: true }),
        supabase.from('exam_sessions').select('*', { count: 'exact', head: true }),
        supabase.from('unlock_codes').select('*', { count: 'exact', head: true })
      ]);

      const { data: premiumUsersData } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('is_premium', true);

      const { data: activeCodesData } = await supabase
        .from('unlock_codes')
        .select('*', { count: 'exact', head: true })
        .eq('is_used', false);

      return successResponse(res, {
        totalUsers: users.count || 0,
        premiumUsers: premiumUsersData?.count || 0,
        trialUsers: (users.count || 0) - (premiumUsersData?.count || 0),
        totalQuestions: questions.count || 0,
        totalSessions: sessions.count || 0,
        totalCodes: codes.count || 0,
        activeCodes: activeCodesData?.count || 0
      });
    }

    // GET /api/admin?action=recent-activity
    if (method === 'GET' && action === 'recent-activity') {
      const { data: recentSessions, error } = await supabase
        .from('exam_sessions')
        .select(`
          *,
          users!exam_sessions_user_id_fkey(full_name, email)
        `)
        .order('start_time', { ascending: false })
        .limit(10);

      if (error) throw error;

      return successResponse(res, { sessions: recentSessions });
    }

    return errorResponse(res, 400, 'Invalid action');

  } catch (error) {
    console.error('Admin API Error:', error);
    return errorResponse(res, 500, error.message);
  }
};