import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

const consultantCategories = [
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

async function main() {
  console.log('🌱 Starting database seeding...');

  try {
    // Create admin user
    const adminEmail = 'admin@carrierhub.com';
    const adminPassword = 'Admin@123456'; // Change this in production

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: adminEmail }
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, SALT_ROUNDS);
      
      const admin = await prisma.admin.create({
        data: {
          name: 'CarrierHub Admin',
          email: adminEmail,
          password: hashedPassword
        }
      });

      console.log('✅ Admin user created:', {
        id: admin.id,
        name: admin.name,
        email: admin.email
      });
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    // Create sample student for testing
    const studentEmail = 'student@carrierhub.com';
    const studentPassword = 'Student@123456'; // Change this in production

    const existingStudent = await prisma.student.findUnique({
      where: { email: studentEmail }
    });

    if (!existingStudent) {
      const hashedPassword = await bcrypt.hash(studentPassword, SALT_ROUNDS);
      
      const student = await prisma.student.create({
        data: {
          name: 'Test Student',
          email: studentEmail,
          phone: '9876543210',
          password: hashedPassword
        }
      });

      console.log('✅ Test student created:', {
        id: student.id,
        name: student.name,
        email: student.email,
        phone: student.phone
      });
    } else {
      console.log('ℹ️  Test student already exists');
    }

    // Create sample bookings for testing
    const testStudent = await prisma.student.findUnique({
      where: { email: studentEmail }
    });

    if (testStudent) {
      // Check if sample bookings already exist
      const existingBookings = await prisma.booking.findMany({
        where: { studentId: testStudent.id }
      });

      if (existingBookings.length === 0) {
        const sampleBookings = [
          {
            studentId: testStudent.id,
            consultantType: 'CAREER_GUIDANCE',
            details: 'I need guidance on choosing between software engineering and data science careers. I have a background in computer science and am interested in both fields.',
            amount: 150000, // ₹1500
            status: 'SUCCESS'
          },
          {
            studentId: testStudent.id,
            consultantType: 'STUDY_ABROAD',
            details: 'Looking for guidance on applying to universities in Canada for MS in Computer Science. Need help with application process and visa requirements.',
            amount: 200000, // ₹2000
            status: 'PENDING'
          },
          {
            studentId: testStudent.id,
            consultantType: 'EXAM_PREPARATION',
            details: 'Need preparation strategy for GATE exam. I have 6 months to prepare and want to focus on computer science subjects.',
            amount: 100000, // ₹1000
            status: 'COMPLETED'
          }
        ];

        for (const bookingData of sampleBookings) {
          const booking = await prisma.booking.create({
            data: bookingData
          });

          // Create payment record for successful bookings
          if (bookingData.status === 'SUCCESS') {
            await prisma.payment.create({
              data: {
                bookingId: booking.id,
                razorpayPaymentId: `pay_test_${Date.now()}`,
                razorpayOrderId: `order_test_${Date.now()}`,
                razorpaySignature: `sig_test_${Date.now()}`,
                amount: bookingData.amount,
                currency: 'INR',
                status: 'SUCCESS'
              }
            });
          }
        }

        console.log('✅ Sample bookings created');
      } else {
        console.log('ℹ️  Sample bookings already exist');
      }
    }

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('Admin:', {
      email: adminEmail,
      password: adminPassword
    });
    console.log('Student:', {
      email: studentEmail,
      password: studentPassword
    });
    console.log('\n📚 Available Consultant Categories:');
    consultantCategories.forEach(category => {
      console.log(`- ${category.title} (${category.type})`);
    });

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
main()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
