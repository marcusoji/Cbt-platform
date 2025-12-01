// js/exam.js - Exam Management Functions

const API_URL = '/api';

/**
 * Get available exam types
 */
async function getExamTypes() {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_URL}/exams?action=types`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, examTypes: data.examTypes };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

/**
 * Get subjects for exam type
 */
async function getSubjects(examType) {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_URL}/exams?action=${examType}&subjects`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, subjects: data.subjects };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

/**
 * Get years for exam type and subject
 */
async function getYears(examType, subject) {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_URL}/exams?action=${examType}&${subject}&years`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, years: data.years };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

/**
 * Start new exam session
 */
async function startExam(examType, subject, year, numberOfQuestions) {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_URL}/exam?action=start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        examType,
        subject,
        year: year || null,
        numberOfQuestions: numberOfQuestions || 40
      })
    });

    const data = await response.json();

    if (response.ok) {
      // Save session to localStorage
      localStorage.setItem('currentSession', JSON.stringify(data));
      return { success: true, session: data };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

/**
 * Submit answer for a question
 */
async function submitAnswer(sessionId, questionId, selectedAnswer, markedForReview = false) {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_URL}/exam?action=submit-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        sessionId,
        questionId,
        selectedAnswer,
        markedForReview
      })
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, isCorrect: data.isCorrect };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

/**
 * Complete exam and get results
 */
async function completeExam(sessionId) {
  try {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_URL}/exams?action=complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ sessionId })
    });

    const data = await response.json();

    if (response.ok) {
      // Save results to localStorage
      localStorage.setItem('examResults', JSON.stringify(data));
      // Clear current session
      localStorage.removeItem('currentSession');
      return { success: true, results: data };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

/**
 * Get current session from localStorage
 */
function getCurrentSession() {
  const sessionStr = localStorage.getItem('currentSession');
  return sessionStr ? JSON.parse(sessionStr) : null;
}

/**
 * Get exam results from localStorage
 */
function getExamResults() {
  const resultsStr = localStorage.getItem('examResults');
  return resultsStr ? JSON.parse(resultsStr) : null;
}

/**
 * Calculate time remaining
 */
function getTimeRemaining(startTime, durationMinutes) {
  const start = new Date(startTime);
  const now = new Date();
  const elapsed = Math.floor((now - start) / 1000); // seconds
  const total = durationMinutes * 60; // convert to seconds
  const remaining = total - elapsed;

  return {
    total: remaining,
    hours: Math.floor(remaining / 3600),
    minutes: Math.floor((remaining % 3600) / 60),
    seconds: remaining % 60
  };
}

/**
 * Format time for display
 */
function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Calculate percentage score
 */
function calculatePercentage(score, total) {
  if (total === 0) return 0;
  return Math.round((score / total) * 100);
}

/**
 * Get grade based on percentage
 */
function getGrade(percentage) {
  if (percentage >= 90) return { grade: 'A+', color: '#10b981', message: 'Outstanding!' };
  if (percentage >= 80) return { grade: 'A', color: '#10b981', message: 'Excellent!' };
  if (percentage >= 70) return { grade: 'B', color: '#3b82f6', message: 'Very Good!' };
  if (percentage >= 60) return { grade: 'C', color: '#f59e0b', message: 'Good!' };
  if (percentage >= 50) return { grade: 'D', color: '#ef4444', message: 'Fair' };
  return { grade: 'F', color: '#991b1b', message: 'Keep Practicing' };
}

/**
 * Shuffle array (for randomizing questions)
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Validate exam configuration
 */
function validateExamConfig(examType, subject, numberOfQuestions) {
  const errors = [];

  if (!examType) {
    errors.push('Please select an exam type');
  }

  if (!subject) {
    errors.push('Please select a subject');
  }

  if (!numberOfQuestions || numberOfQuestions < 1) {
    errors.push('Please select number of questions');
  }

  if (numberOfQuestions > 100) {
    errors.push('Maximum 100 questions allowed');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getExamTypes,
    getSubjects,
    getYears,
    startExam,
    submitAnswer,
    completeExam,
    getCurrentSession,
    getExamResults,
    getTimeRemaining,
    formatTime,
    calculatePercentage,
    getGrade,
    shuffleArray,
    validateExamConfig
  };
}