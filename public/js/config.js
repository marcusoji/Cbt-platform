// public/js/config.js - Frontend Configuration

// API URL Configuration
// For Vercel deployment, API is at /api
// For local development, use localhost:5000/api
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000/api' 
  : '/api';

// Export for use in other files
window.API_CONFIG = {
  API_URL,
  
  // API Endpoints
  endpoints: {
    // Auth
    register: `${API_URL}/auth?action=register`,
    login: `${API_URL}/auth?action=login`,
    profile: `${API_URL}/auth?action=profile`,
    unlock: `${API_URL}/auth?action=unlock`,
    
    // Exams
    examTypes: `${API_URL}/exams?action=types`,
    subjects: (examType) => `${API_URL}/exams?action=subjects&examType=${examType}`,
    years: (examType, subject) => `${API_URL}/exams?action=years&examType=${examType}&subject=${subject}`,
    startExam: `${API_URL}/exams?action=start`,
    submitAnswer: `${API_URL}/exams?action=submit-answer`,
    completeExam: `${API_URL}/exams?action=complete`,
    
    // Admin
    generateCodes: `${API_URL}/admin?action=generate-codes`,
    getCodes: `${API_URL}/admin?action=get-codes`,
    uploadQuestions: `${API_URL}/admin?action=upload-questions`,
    getUsers: `${API_URL}/admin?action=get-users`,
    getStatistics: `${API_URL}/admin?action=statistics`
  }
};

console.log('🔧 API Configuration loaded:', window.API_CONFIG.API_URL);