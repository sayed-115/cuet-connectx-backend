const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Job = require('../models/Job');
const User = require('../models/User');

const jobsData = [
  {
    title: 'Senior Software Engineer',
    company: 'Grameenphone IT Ltd',
    location: 'Dhaka, Bangladesh',
    type: 'Full-time',
    salary: { min: 120000, max: 180000, currency: 'BDT' },
    description: 'We are looking for an experienced Software Engineer to join our digital transformation team. You will work on large-scale telecom systems serving millions of users.',
    requirements: ['5+ years of experience', 'Strong Java/Spring background', 'Microservices architecture experience'],
    responsibilities: ['Design and develop scalable backend services', 'Lead technical discussions', 'Mentor junior developers'],
    skills: ['Java', 'Spring Boot', 'Microservices', 'PostgreSQL', 'Docker'],
    experience: 'Senior Level',
    applicationDeadline: new Date('2026-06-15'),
    applyLink: 'https://gpitltd.com/careers',
  },
  {
    title: 'Frontend Developer (React)',
    company: 'Pathao Ltd',
    location: 'Dhaka, Bangladesh',
    type: 'Full-time',
    salary: { min: 80000, max: 120000, currency: 'BDT' },
    description: 'Join the fastest growing tech startup in Bangladesh! Build amazing user experiences for our ride-sharing and delivery apps used by millions.',
    requirements: ['3+ years React experience', 'Strong TypeScript skills', 'Experience with React Native is a plus'],
    responsibilities: ['Build responsive web applications', 'Collaborate with designers', 'Optimize performance'],
    skills: ['React', 'TypeScript', 'Redux', 'CSS', 'REST APIs'],
    experience: 'Mid Level',
    applicationDeadline: new Date('2026-05-28'),
    applyLink: 'https://pathao.com/careers',
  },
  {
    title: 'Machine Learning Engineer Intern',
    company: 'Samsung R&D Bangladesh',
    location: 'Dhaka, Bangladesh',
    type: 'Internship',
    salary: { min: 25000, max: 35000, currency: 'BDT' },
    description: 'Exciting opportunity for students to work on cutting-edge AI/ML projects. Work with world-class researchers on computer vision and NLP problems.',
    requirements: ['Currently pursuing CS/EE degree', 'Strong Python skills', 'Familiarity with PyTorch or TensorFlow'],
    responsibilities: ['Assist in ML model development', 'Data preprocessing and analysis', 'Documentation'],
    skills: ['Python', 'PyTorch', 'Machine Learning', 'Deep Learning', 'NumPy'],
    experience: 'Entry Level',
    applicationDeadline: new Date('2026-05-20'),
    applyLink: 'https://research.samsung.com/srbd',
  },
  {
    title: 'DevOps Engineer',
    company: 'bKash Limited',
    location: 'Dhaka, Bangladesh',
    type: 'Full-time',
    salary: { min: 100000, max: 150000, currency: 'BDT' },
    description: 'Help us scale the largest mobile financial service in Bangladesh! Manage infrastructure serving 60+ million users.',
    requirements: ['4+ years DevOps experience', 'Strong Linux skills', 'Cloud experience (AWS/GCP)'],
    responsibilities: ['Manage CI/CD pipelines', 'Infrastructure automation', 'Security implementation'],
    skills: ['Kubernetes', 'Docker', 'AWS', 'Terraform', 'Jenkins'],
    experience: 'Senior Level',
    applicationDeadline: new Date('2026-06-01'),
    applyLink: 'https://bkash.com/careers',
  },
  {
    title: 'Junior Embedded Systems Developer',
    company: 'Walton Hi-Tech Industries',
    location: 'Gazipur, Bangladesh',
    type: 'Full-time',
    salary: { min: 45000, max: 65000, currency: 'BDT' },
    description: 'Join our R&D team developing IoT solutions for smart home appliances. Great opportunity for EEE/ECE graduates.',
    requirements: ['Fresh graduate or 1 year experience', 'Embedded C knowledge', 'Basic circuit design'],
    responsibilities: ['Develop firmware for IoT devices', 'Testing and debugging', 'PCB design support'],
    skills: ['Embedded C', 'Arduino', 'ESP32', 'PCB Design', 'IoT'],
    experience: 'Entry Level',
    applicationDeadline: new Date('2026-05-25'),
    applyLink: 'https://waltonbd.com/careers',
  },
  {
    title: 'Backend Engineer (Node.js)',
    company: 'Chaldal.com',
    location: 'Dhaka, Bangladesh',
    type: 'Full-time',
    salary: { min: 70000, max: 110000, currency: 'BDT' },
    description: 'Build scalable backend services for one of Bangladesh\'s leading e-commerce platforms. Work on real-time order management and logistics systems.',
    requirements: ['2+ years Node.js experience', 'MongoDB or PostgreSQL', 'REST/GraphQL API design'],
    responsibilities: ['Design and implement APIs', 'Database optimization', 'Write unit and integration tests'],
    skills: ['Node.js', 'Express', 'MongoDB', 'Redis', 'GraphQL'],
    experience: 'Mid Level',
    applicationDeadline: new Date('2026-06-10'),
    applyLink: 'https://chaldal.com/careers',
  },
  {
    title: 'Data Analyst',
    company: 'Robi Axiata Limited',
    location: 'Dhaka, Bangladesh',
    type: 'Full-time',
    salary: { min: 60000, max: 90000, currency: 'BDT' },
    description: 'Analyze subscriber behavior data to drive business decisions. Work with big data tools to generate actionable insights for marketing campaigns.',
    requirements: ['Strong SQL skills', 'Python or R proficiency', 'Experience with data visualization tools'],
    responsibilities: ['Create dashboards and reports', 'Statistical analysis', 'Collaborate with marketing team'],
    skills: ['SQL', 'Python', 'Tableau', 'Excel', 'Statistics'],
    experience: 'Entry Level',
    applicationDeadline: new Date('2026-05-15'),
    applyLink: 'https://robi.com.bd/careers',
  },
  {
    title: 'UI/UX Designer',
    company: 'Kaz Software',
    location: 'Dhaka, Bangladesh',
    type: 'Full-time',
    salary: { min: 55000, max: 85000, currency: 'BDT' },
    description: 'Design beautiful and intuitive interfaces for web and mobile applications for global clients. Join a creative team that values design thinking.',
    requirements: ['2+ years UI/UX experience', 'Figma/Sketch proficiency', 'Understanding of design systems'],
    responsibilities: ['Create wireframes and prototypes', 'Conduct user research', 'Design responsive interfaces'],
    skills: ['Figma', 'Adobe XD', 'Prototyping', 'User Research', 'CSS'],
    experience: 'Mid Level',
    applicationDeadline: new Date('2026-06-05'),
    applyLink: 'https://kaz.com.bd/careers',
  },
  {
    title: 'Cybersecurity Analyst',
    company: 'Bangladesh Bank',
    location: 'Dhaka, Bangladesh',
    type: 'Full-time',
    salary: { min: 90000, max: 140000, currency: 'BDT' },
    description: 'Protect critical financial infrastructure. Conduct security assessments, incident response, and implement security policies for the central bank.',
    requirements: ['3+ years cybersecurity experience', 'CISSP or CEH certification preferred', 'Network security knowledge'],
    responsibilities: ['Security monitoring and incident response', 'Vulnerability assessments', 'Security policy development'],
    skills: ['Network Security', 'SIEM', 'Penetration Testing', 'Firewall', 'Python'],
    experience: 'Senior Level',
    applicationDeadline: new Date('2026-07-01'),
    applyLink: 'https://bb.org.bd/careers',
  },
  {
    title: 'Mobile App Developer (Flutter)',
    company: 'Nagad Limited',
    location: 'Dhaka, Bangladesh',
    type: 'Full-time',
    salary: { min: 75000, max: 120000, currency: 'BDT' },
    description: 'Build and maintain cross-platform mobile applications for 40M+ users. Work on payment features, user experience, and app performance.',
    requirements: ['2+ years Flutter experience', 'Dart programming', 'Published app on Play Store/App Store'],
    responsibilities: ['Develop cross-platform mobile apps', 'Integrate payment APIs', 'Performance optimization'],
    skills: ['Flutter', 'Dart', 'Firebase', 'REST APIs', 'Git'],
    experience: 'Mid Level',
    applicationDeadline: new Date('2026-06-20'),
    applyLink: 'https://nagad.com.bd/careers',
  },
];

async function seedJobs() {
  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI is missing in backend .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find an admin or first user to use as postedBy
    const admin = await User.findOne({ role: 'admin' });
    const fallbackUser = admin || await User.findOne({});

    if (!fallbackUser) {
      console.error('No users found. Please run adminSeeder.js or seed.js first.');
      process.exit(1);
    }

    let inserted = 0;
    let skipped = 0;

    for (const jobData of jobsData) {
      const existing = await Job.findOne({ title: jobData.title, company: jobData.company });
      if (existing) {
        console.log(`⏭️  "${jobData.title}" at ${jobData.company} already exists`);
        skipped++;
        continue;
      }

      const job = new Job({ ...jobData, postedBy: fallbackUser._id });
      await job.save();
      console.log(`💼 Created: ${jobData.title} at ${jobData.company}`);
      inserted++;
    }

    console.log(`\n✅ Jobs seed complete — ${inserted} inserted, ${skipped} skipped`);
    console.log(`   Total jobs in DB: ${await Job.countDocuments()}`);
  } catch (error) {
    console.error('Seed error:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedJobs();
