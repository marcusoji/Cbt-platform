// api/exams.js - Exam Management Endpoints for Vercel
const { supabase, corsHeaders, handleCORS, errorResponse, successResponse } = require('./_config');
const { requireAuth, checkPremiumAccess } = require('./_middleware');

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
    // GET /api/exams?action=types
    if (method === 'GET' && action === 'types') {
      const auth = await requireAuth(req, res);
      if (!auth.authenticated) return;

      const access = await checkPremiumAccess(req, res);
      if (!access.hasAccess) {
        return errorResponse(res, 403, access.message || 'Access denied');
      }

      const { data, error } = await supabase
        .from('questions')
        .select('exam_type');

      if (error) throw error;

      const types = [...new Set(data.map(q => q.exam_type))];
      return successResponse(res, { examTypes: types });
    }

    // GET /api/exams?action=subjects&examType=JAMB
    if (method === 'GET' && action === 'subjects') {
      const auth = await requireAuth(req, res);
      if (!auth.authenticated) return;

      const access = await checkPremiumAccess(req, res);
      if (!access.hasAccess) {
        return errorResponse(res, 403, access.message || 'Access denied');
      }

      const { examType } = req.query;
      if (!examType) {
        return errorResponse(res, 400, 'examType is required');
      }

      const { data, error } = await supabase
        .from('questions')
        .select('subject')
        .eq('exam_type', examType);

      if (error) throw error;

      const subjects = [...new Set(data.map(q => q.subject))];
      return successResponse(res, { subjects });
    }

    // GET /api/exams?action=years&examType=JAMB&subject=Mathematics
    if (method === 'GET' && action === 'years') {
      const auth = await requireAuth(req, res);
      if (!auth.authenticated) return;

      const access = await checkPremiumAccess(req, res);
      if (!access.hasAccess) {
        return errorResponse(res, 403, access.message || 'Access denied');
      }

      const { examType, subject } = req.query;
      if (!examType || !subject) {
        return errorResponse(res, 400, 'examType and subject are required');
      }

      const { data, error } = await supabase
        .from('questions')
        .select('year')
        .eq('exam_type', examType)
        .eq('subject', subject);

      if (error) throw error;

      const years = [...new Set(data.map(q => q.year))].sort((a, b) => b - a);
      return successResponse(res, { years });
    }

    // POST /api/exams?action=start
    if (method === 'POST' && action === 'start') {
      const auth = await requireAuth(req, res);
      if (!auth.authenticated) return;

      const access = await checkPremiumAccess(req, res);
      if (!access.hasAccess) {
        return errorResponse(res, 403, access.message || 'Access denied');
      }

      const { examType, subject, year, numberOfQuestions } = req.body;

      if (!examType || !subject) {
        return errorResponse(res, 400, 'examType and subject are required');
      }

      // Build query
      let query = supabase
        .from('questions')
        .select('*')
        .eq('exam_type', examType)
        .eq('subject', subject);

      if (year) {
        query = query.eq('year', year);
      }

      const { data: allQuestions, error } = await query;
      if (error) throw error;

      if (allQuestions.length === 0) {
        return errorResponse(res, 404, 'No questions found for this selection');
      }

      // Random selection
      const shuffled = allQuestions.sort(() => 0.5 - Math.random());
      const questions = shuffled.slice(0, numberOfQuestions || 40);

      // Create session
      const duration = examType === 'JAMB' ? 120 : 180;
      const { data: session, error: sessionError } = await supabase
        .from('exam_sessions')
        .insert([{
          user_id: auth.userId,
          exam_type: examType,
          subject: subject,
          year: year || null,
          start_time: new Date().toISOString(),
          duration: duration,
          total_questions: questions.length
        }])
        .select()
        .single();

      if (sessionError) throw sessionError;

      return successResponse(res, {
        sessionId: session.id,
        questions: questions.map(q => ({
          id: q.id,
          questionText: q.question_text,
          questionImage: q.question_image,
          options: q.options,
          topic: q.topic
        })),
        duration,
        examType,
        subject
      });
    }

    // POST /api/exams?action=submit-answer
    if (method === 'POST' && action === 'submit-answer') {
      const auth = await requireAuth(req, res);
      if (!auth.authenticated) return;

      const { sessionId, questionId, selectedAnswer, markedForReview } = req.body;

      if (!sessionId || !questionId || !selectedAnswer) {
        return errorResponse(res, 400, 'sessionId, questionId, and selectedAnswer are required');
      }

      // Get question to check answer
      const { data: question } = await supabase
        .from('questions')
        .select('correct_answer')
        .eq('id', questionId)
        .single();

      const isCorrect = question?.correct_answer === selectedAnswer;

      // Check if answer exists
      const { data: existingAnswer } = await supabase
        .from('exam_answers')
        .select('id')
        .eq('session_id', sessionId)
        .eq('question_id', questionId)
        .single();

      if (existingAnswer) {
        // Update existing answer
        await supabase
          .from('exam_answers')
          .update({
            selected_answer: selectedAnswer,
            is_correct: isCorrect,
            marked_for_review: markedForReview || false
          })
          .eq('id', existingAnswer.id);
      } else {
        // Insert new answer
        await supabase
          .from('exam_answers')
          .insert([{
            session_id: sessionId,
            question_id: questionId,
            selected_answer: selectedAnswer,
            is_correct: isCorrect,
            marked_for_review: markedForReview || false
          }]);
      }

      return successResponse(res, { message: 'Answer submitted', isCorrect });
    }

    // POST /api/exams?action=complete
    if (method === 'POST' && action === 'complete') {
      const auth = await requireAuth(req, res);
      if (!auth.authenticated) return;

      const { sessionId } = req.body;

      if (!sessionId) {
        return errorResponse(res, 400, 'sessionId is required');
      }

      // Get all answers with questions
      const { data: answers, error } = await supabase
        .from('exam_answers')
        .select(`
          *,
          questions (
            question_text,
            options,
            correct_answer,
            explanation
          )
        `)
        .eq('session_id', sessionId);

      if (error) throw error;

      const score = answers.filter(a => a.is_correct).length;

      // Update session
      await supabase
        .from('exam_sessions')
        .update({
          end_time: new Date().toISOString(),
          is_completed: true,
          score: score
        })
        .eq('id', sessionId);

      const results = answers.map(answer => ({
        questionText: answer.questions.question_text,
        selectedAnswer: answer.selected_answer,
        correctAnswer: answer.questions.correct_answer,
        isCorrect: answer.is_correct,
        explanation: answer.questions.explanation,
        options: answer.questions.options
      }));

      return successResponse(res, {
        score,
        totalQuestions: answers.length,
        percentage: ((score / answers.length) * 100).toFixed(2),
        results
      });
    }

    return errorResponse(res, 400, 'Invalid action');

  } catch (error) {
    console.error('Exams API Error:', error);
    return errorResponse(res, 500, error.message);
  }
};