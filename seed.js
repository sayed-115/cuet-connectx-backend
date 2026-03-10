const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI is missing in .env file');
  process.exit(1);
}

// Safety guard — prevent accidental seeding against production
if (process.env.NODE_ENV === 'production') {
  console.error('Error: Cannot run seed script in production environment');
  process.exit(1);
}

// Import models
const User = require('./models/User');
const Job = require('./models/Job');
const Post = require('./models/Post');
const Scholarship = require('./models/Scholarship');

async function seedDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // ============== SAMPLE USERS ==============
    const sampleUsers = [
      {
        fullName: 'Rafiq Ahmed Khan',
        email: 'rafiq.khan@example.com',
        studentId: '1904001',
        password: 'demo1234',
        bio: 'Senior Software Engineer at Google. CUET CSE Alumni, Batch 2019. Passionate about AI/ML and distributed systems.',
        currentPosition: 'Senior Software Engineer',
        company: 'Google',
        location: 'Mountain View, CA, USA',
        linkedIn: 'https://linkedin.com/in/rafiqkhan',
        skills: ['Python', 'TensorFlow', 'Distributed Systems', 'Go', 'Kubernetes']
      },
      {
        fullName: 'Fatima Akter Mitu',
        email: 'fatima.mitu@example.com',
        studentId: '2004023',
        password: 'demo1234',
        bio: 'Full-stack Developer at Samsung R&D. Love building scalable web applications and mentoring juniors.',
        currentPosition: 'Full-stack Developer',
        company: 'Samsung R&D Bangladesh',
        location: 'Dhaka, Bangladesh',
        linkedIn: 'https://linkedin.com/in/fatimamitu',
        skills: ['React', 'Node.js', 'MongoDB', 'TypeScript', 'AWS']
      },
      {
        fullName: 'Kamal Hossain Niloy',
        email: 'kamal.niloy@example.com',
        studentId: '2102045',
        password: 'demo1234',
        bio: 'EEE graduate working as an Embedded Systems Engineer. Building IoT solutions for smart cities.',
        currentPosition: 'Embedded Systems Engineer',
        company: 'Walton Hi-Tech Industries',
        location: 'Gazipur, Bangladesh',
        linkedIn: 'https://linkedin.com/in/kamalniloy',
        skills: ['Embedded C', 'Arduino', 'Raspberry Pi', 'PCB Design', 'IoT']
      },
      {
        fullName: 'Nusrat Jahan Priya',
        email: 'nusrat.priya@example.com',
        studentId: '2203015',
        password: 'demo1234',
        bio: 'Final year CSE student interested in Machine Learning and Data Science. Currently interning at Brain Station 23.',
        currentPosition: 'ML Intern',
        company: 'Brain Station 23',
        location: 'Dhaka, Bangladesh',
        linkedIn: 'https://linkedin.com/in/nusratpriya',
        skills: ['Python', 'Machine Learning', 'Data Analysis', 'SQL', 'Pandas']
      },
      {
        fullName: 'Tanvir Rahman Shuvo',
        email: 'tanvir.shuvo@example.com',
        studentId: '2006078',
        password: 'demo1234',
        bio: 'Urban Planner at Rajuk. Working on sustainable city development projects in Dhaka.',
        currentPosition: 'Urban Planner',
        company: 'RAJUK',
        location: 'Dhaka, Bangladesh',
        linkedIn: 'https://linkedin.com/in/tanvirshuvo',
        skills: ['AutoCAD', 'GIS', 'Urban Design', 'Project Management', 'SketchUp']
      }
    ];

    const createdUsers = [];
    for (const userData of sampleUsers) {
      // Check if user already exists
      const existing = await User.findOne({ studentId: userData.studentId });
      if (existing) {
        console.log(`⏭️  User ${userData.studentId} already exists, skipping...`);
        createdUsers.push(existing);
        continue;
      }
      const user = new User(userData);
      await user.save();
      createdUsers.push(user);
      console.log(`👤 Created user: ${userData.fullName} (${userData.studentId})`);
    }

    // ============== SAMPLE JOBS ==============
    const sampleJobs = [
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
        applicationDeadline: new Date('2026-03-15'),
        applyLink: 'https://gpitltd.com/careers',
        postedBy: createdUsers[0]._id,
        status: 'active'
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
        applicationDeadline: new Date('2026-02-28'),
        applyLink: 'https://pathao.com/careers',
        postedBy: createdUsers[1]._id,
        status: 'active'
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
        applicationDeadline: new Date('2026-02-20'),
        applyLink: 'https://research.samsung.com/srbd',
        postedBy: createdUsers[3]._id,
        status: 'active'
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
        applicationDeadline: new Date('2026-03-01'),
        applyLink: 'https://bkash.com/careers',
        postedBy: createdUsers[0]._id,
        status: 'active'
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
        applicationDeadline: new Date('2026-02-25'),
        applyLink: 'https://waltonbd.com/careers',
        postedBy: createdUsers[2]._id,
        status: 'active'
      }
    ];

    for (const jobData of sampleJobs) {
      const existing = await Job.findOne({ title: jobData.title, company: jobData.company });
      if (existing) {
        console.log(`⏭️  Job "${jobData.title}" at ${jobData.company} already exists, skipping...`);
        continue;
      }
      const job = new Job(jobData);
      await job.save();
      console.log(`💼 Created job: ${jobData.title} at ${jobData.company}`);
    }

    // ============== SAMPLE POSTS ==============
    const samplePosts = [
      {
        author: createdUsers[0]._id,
        content: `🎉 Excited to share that I just got promoted to Senior Software Engineer at Google! 

It's been an incredible 3-year journey since graduating from CUET CSE. The foundation we got at CUET, especially in DSA and system design, really helped me crack the interviews.

Tips for juniors:
1. Focus on fundamentals - DSA is crucial
2. Build projects that solve real problems
3. Practice system design early
4. Never stop learning

Feel free to reach out if you need any guidance! #CUETAlumni #GoogleLife #SoftwareEngineering`,
        likes: [createdUsers[1]._id, createdUsers[3]._id],
        comments: [
          { user: createdUsers[1]._id, text: 'Congratulations Rafiq bhai! You\'re an inspiration! 🙌' },
          { user: createdUsers[3]._id, text: 'This is so motivating! Can I DM you for some career advice?' }
        ],
        createdAt: new Date('2026-01-28')
      },
      {
        author: createdUsers[1]._id,
        content: `Looking for CUET CSE students for summer internship positions at Samsung R&D Bangladesh! 🚀

Requirements:
- 3rd or 4th year CSE/EEE/ECE students
- Good coding skills in any language
- Enthusiasm to learn

We're working on exciting projects in:
• Mobile development
• AI/ML
• IoT and embedded systems

DM me or apply through the official portal. Happy to refer if you're from CUET!

#Internship #SamsungRnD #Hiring #CUET`,
        likes: [createdUsers[2]._id, createdUsers[3]._id, createdUsers[4]._id],
        comments: [
          { user: createdUsers[3]._id, text: 'Thanks for sharing apu! Just applied 🙏' }
        ],
        createdAt: new Date('2026-01-25')
      },
      {
        author: createdUsers[3]._id,
        content: `Finally completed my first ML project! 🤖

Built a Bengali sentiment analysis model using BERT for analyzing social media posts. Achieved 89% accuracy on the test set!

Key learnings:
- Data preprocessing for Bengali text is challenging
- Transfer learning is incredibly powerful
- GPU access is essential (thanks Google Colab!)

Project is open source on my GitHub. Would love feedback from seniors!

#MachineLearning #NLP #BengaliNLP #OpenSource`,
        likes: [createdUsers[0]._id, createdUsers[1]._id],
        comments: [
          { user: createdUsers[0]._id, text: 'Excellent work! Bengali NLP is really needed. Have you tried using it for fake news detection?' },
          { user: createdUsers[1]._id, text: 'Great project! This would be useful for our team at Samsung. Let\'s connect!' }
        ],
        createdAt: new Date('2026-01-20')
      },
      {
        author: createdUsers[4]._id,
        content: `Just completed the Detailed Area Plan (DAP) for Purbachal New Town! 🏙️

Proud to be part of a team designing a smart, sustainable city for 10 lakh+ residents. 

Key features we're implementing:
• Integrated public transport network
• 30% green space allocation
• Smart traffic management
• Flood resilient drainage system

URP graduates, our field has amazing opportunities now! Don't underestimate city planning - we're literally shaping the future.

#UrbanPlanning #SmartCity #CUET #URP`,
        likes: [createdUsers[0]._id, createdUsers[2]._id],
        comments: [],
        createdAt: new Date('2026-01-15')
      },
      {
        author: createdUsers[2]._id,
        content: `CUET Alumni Meetup Chittagong 2026! 🎊

Date: February 15, 2026
Venue: Radisson Blu, Chittagong
Time: 6:00 PM onwards

All CUET alumni from any department are welcome! Great opportunity to network and reconnect with batchmates.

Registration link in comments. Limited seats - register fast!

Tag your CUET friends! 👇

#CUETAlumni #Reunion #Chittagong #Networking`,
        likes: [createdUsers[0]._id, createdUsers[1]._id, createdUsers[3]._id, createdUsers[4]._id],
        comments: [
          { user: createdUsers[0]._id, text: 'Will try to fly in from California for this! 🛫' },
          { user: createdUsers[1]._id, text: 'Count me in! Can\'t wait to see everyone!' }
        ],
        createdAt: new Date('2026-01-10')
      }
    ];

    for (const postData of samplePosts) {
      const existing = await Post.findOne({ 
        author: postData.author, 
        content: { $regex: postData.content.substring(0, 50) } 
      });
      if (existing) {
        console.log(`⏭️  Post already exists, skipping...`);
        continue;
      }
      const post = new Post(postData);
      await post.save();
      console.log(`📝 Created post by ${(await User.findById(postData.author)).fullName}`);
    }

    // ============== SAMPLE SCHOLARSHIPS ==============
    const sampleScholarships = [
      {
        title: 'Erasmus Mundus Joint Master Scholarship',
        organization: 'European Union',
        amount: 'Full tuition + €1,400/month stipend',
        eligibility: 'Bachelor\'s degree holders from any discipline. Must have graduated within last 5 years. Strong academic record required.',
        description: 'Study for a joint master\'s degree in Europe! The Erasmus Mundus scholarship covers tuition fees, travel costs, and provides a monthly allowance. Choose from 100+ programs across EU universities.',
        deadline: new Date('2026-03-01'),
        link: 'https://erasmus-plus.ec.europa.eu',
        postedBy: createdUsers[0]._id,
        createdAt: new Date('2026-01-20')
      },
      {
        title: 'Commonwealth Scholarship for Master\'s Study',
        organization: 'Commonwealth Scholarship Commission',
        amount: 'Full funding including airfare',
        eligibility: 'Bangladeshi citizens with at least upper second-class honors degree. Under 35 years of age.',
        description: 'Fully funded master\'s study in UK universities. Covers tuition, living expenses, airfare, thesis grant, and warm clothing allowance. Must return to Bangladesh after completing studies.',
        deadline: new Date('2026-02-15'),
        link: 'https://cscuk.fcdo.gov.uk',
        postedBy: createdUsers[1]._id,
        createdAt: new Date('2026-01-18')
      },
      {
        title: 'Japanese MEXT Scholarship 2026',
        organization: 'Ministry of Education, Japan',
        amount: '¥143,000/month + tuition waiver',
        eligibility: 'Under 35 years for research students. Must be willing to learn Japanese. Strong academic record required.',
        description: 'Study in Japan\'s top universities! MEXT scholarship covers tuition, monthly allowance, and round-trip airfare. Programs available for undergraduate, master\'s, PhD, and research students.',
        deadline: new Date('2026-04-15'),
        link: 'https://www.studyinjapan.go.jp/en/smap_stopj-applications_scholarship.html',
        postedBy: createdUsers[3]._id,
        createdAt: new Date('2026-01-15')
      },
      {
        title: 'Google PhD Fellowship Program',
        organization: 'Google Research',
        amount: '$50,000 USD annually for 3 years',
        eligibility: 'Must be enrolled in PhD program at an accredited university. Research in CS, ML, or related fields.',
        description: 'Prestigious fellowship for exceptional PhD students doing cutting-edge research. Covers tuition and stipend, plus a Google Research mentor and internship opportunity.',
        deadline: new Date('2026-04-01'),
        link: 'https://research.google/outreach/phd-fellowship/',
        postedBy: createdUsers[0]._id,
        createdAt: new Date('2026-01-12')
      },
      {
        title: 'DAAD Scholarship for Master\'s in Germany',
        organization: 'German Academic Exchange Service',
        amount: '€934/month + travel + insurance',
        eligibility: 'Bachelor\'s degree with excellent grades. Relevant work experience preferred. Good English or German proficiency.',
        description: 'Study master\'s degree in Germany for free! DAAD covers monthly stipend, health insurance, travel allowance, and study allowance. No tuition fees at German public universities.',
        deadline: new Date('2026-03-15'),
        link: 'https://www.daad.de/en/',
        postedBy: createdUsers[1]._id,
        createdAt: new Date('2026-01-08')
      }
    ];

    for (const scholarshipData of sampleScholarships) {
      const existing = await Scholarship.findOne({ title: scholarshipData.title });
      if (existing) {
        console.log(`⏭️  Scholarship "${scholarshipData.title}" already exists, skipping...`);
        continue;
      }
      const scholarship = new Scholarship(scholarshipData);
      await scholarship.save();
      console.log(`🎓 Created scholarship: ${scholarshipData.title}`);
    }

    // Print summary
    console.log('\n========================================');
    console.log('📊 DATABASE SEED COMPLETE!');
    console.log('========================================');
    console.log(`👥 Users: ${await User.countDocuments()}`);
    console.log(`💼 Jobs: ${await Job.countDocuments()}`);
    console.log(`📝 Posts: ${await Post.countDocuments()}`);
    console.log(`🎓 Scholarships: ${await Scholarship.countDocuments()}`);
    console.log('========================================');
    console.log('\n🔐 Test credentials for all new users:');
    console.log('   Password: demo1234');
    console.log('   Student IDs: 1904001, 2004023, 2102045, 2203015, 2006078');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

seedDatabase();
