import express from 'express';

const router = express.Router();

// Get consultant categories
router.get('/', (req, res) => {
  const categories = [
    {
      type: 'CAREER_GUIDANCE',
      title: 'Career Guidance',
      description: 'Professional career counseling and guidance to help you choose the right career path based on your interests, skills, and market trends.'
    },
    {
      type: 'COLLEGE_COURSE',
      title: 'College Course Selection',
      description: 'Expert advice on selecting the right college and course that aligns with your career goals and academic performance.'
    },
    {
      type: 'EXAM_PREPARATION',
      title: 'Exam Preparation',
      description: 'Comprehensive preparation strategies and study plans for various competitive exams and entrance tests.'
    },
    {
      type: 'STUDY_ABROAD',
      title: 'Study Abroad',
      description: 'Complete guidance for studying abroad including university selection, application process, visa assistance, and scholarship opportunities.'
    },
    {
      type: 'SKILL_MENTORSHIP',
      title: 'Skill Mentorship',
      description: 'Personalized mentorship to develop industry-relevant skills and enhance your professional capabilities.'
    },
    {
      type: 'JOB_PLACEMENT',
      title: 'Job Placement',
      description: 'Career placement assistance including resume building, interview preparation, and job search strategies.'
    },
    {
      type: 'GOVERNMENT_JOBS',
      title: 'Government Jobs',
      description: 'Specialized guidance for government job preparation including exam strategies, application process, and interview techniques.'
    },
    {
      type: 'PERSONAL_GROWTH',
      title: 'Personal Growth',
      description: 'Personal development coaching to enhance soft skills, confidence, and overall personality development.'
    },
    {
      type: 'ALTERNATIVE_CAREERS',
      title: 'Alternative Careers',
      description: 'Explore unconventional career paths and emerging opportunities in various industries and sectors.'
    }
  ];

  res.json({
    success: true,
    message: 'Categories retrieved successfully',
    data: { categories }
  });
});

export default router;
