const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Scholarship = require('../models/Scholarship');
const User = require('../models/User');

const scholarshipsData = [
  {
    title: 'Erasmus Mundus Joint Master Scholarship',
    organization: 'European Union',
    amount: 'Full tuition + €1,400/month stipend',
    eligibility: 'Bachelor\'s degree holders from any discipline. Must have graduated within last 5 years. Strong academic record required.',
    description: 'Study for a joint master\'s degree in Europe! The Erasmus Mundus scholarship covers tuition fees, travel costs, and provides a monthly allowance. Choose from 100+ programs across EU universities.',
    deadline: new Date('2026-06-01'),
    link: 'https://erasmus-plus.ec.europa.eu',
  },
  {
    title: 'Commonwealth Scholarship for Master\'s Study',
    organization: 'Commonwealth Scholarship Commission',
    amount: 'Full funding including airfare',
    eligibility: 'Bangladeshi citizens with at least upper second-class honors degree. Under 35 years of age.',
    description: 'Fully funded master\'s study in UK universities. Covers tuition, living expenses, airfare, thesis grant, and warm clothing allowance. Must return to Bangladesh after completing studies.',
    deadline: new Date('2026-05-15'),
    link: 'https://cscuk.fcdo.gov.uk',
  },
  {
    title: 'Japanese MEXT Scholarship 2026',
    organization: 'Ministry of Education, Japan',
    amount: '¥143,000/month + tuition waiver',
    eligibility: 'Under 35 years for research students. Must be willing to learn Japanese. Strong academic record required.',
    description: 'Study in Japan\'s top universities! MEXT scholarship covers tuition, monthly allowance, and round-trip airfare. Programs available for undergraduate, master\'s, PhD, and research students.',
    deadline: new Date('2026-07-15'),
    link: 'https://www.studyinjapan.go.jp/en/smap_stopj-applications_scholarship.html',
  },
  {
    title: 'Google PhD Fellowship Program',
    organization: 'Google Research',
    amount: '$50,000 USD annually for 3 years',
    eligibility: 'Must be enrolled in PhD program at an accredited university. Research in CS, ML, or related fields.',
    description: 'Prestigious fellowship for exceptional PhD students doing cutting-edge research. Covers tuition and stipend, plus a Google Research mentor and internship opportunity.',
    deadline: new Date('2026-07-01'),
    link: 'https://research.google/outreach/phd-fellowship/',
  },
  {
    title: 'DAAD Scholarship for Master\'s in Germany',
    organization: 'German Academic Exchange Service',
    amount: '€934/month + travel + insurance',
    eligibility: 'Bachelor\'s degree with excellent grades. Relevant work experience preferred. Good English or German proficiency.',
    description: 'Study master\'s degree in Germany for free! DAAD covers monthly stipend, health insurance, travel allowance, and study allowance. No tuition fees at German public universities.',
    deadline: new Date('2026-06-15'),
    link: 'https://www.daad.de/en/',
  },
  {
    title: 'Chevening Scholarship (UK)',
    organization: 'UK Government',
    amount: 'Full funding — tuition, living, flights',
    eligibility: 'Bangladeshi citizens with 2+ years work experience. Must return to home country for 2 years after studies.',
    description: 'UK government\'s global scholarship programme funded by the Foreign, Commonwealth and Development Office. Study any master\'s degree at any UK university for one year, fully funded.',
    deadline: new Date('2026-11-01'),
    link: 'https://www.chevening.org/',
  },
  {
    title: 'Fulbright Foreign Student Program (USA)',
    organization: 'US Department of State',
    amount: 'Full tuition + living + travel',
    eligibility: 'Bangladeshi citizens with bachelor\'s degree. English proficiency required. Must have no prior US degree.',
    description: 'One of the most prestigious scholarships in the world. Fully funded master\'s or PhD study in the USA. Covers tuition, living stipend, airfare, and health insurance.',
    deadline: new Date('2026-05-31'),
    link: 'https://foreign.fulbrightonline.org/',
  },
  {
    title: 'ADB–Japan Scholarship Program',
    organization: 'Asian Development Bank',
    amount: 'Full tuition + monthly allowance + travel',
    eligibility: 'Citizens of ADB member countries (including Bangladesh). Must have 2+ years of professional experience.',
    description: 'Study master\'s degree at selected universities in Asia-Pacific. Covers full tuition, monthly subsistence, housing, books, medical insurance, and travel expenses.',
    deadline: new Date('2026-08-15'),
    link: 'https://www.adb.org/work-with-us/careers/japan-scholarship-program',
  },
  {
    title: 'Korean Government Scholarship (KGSP)',
    organization: 'National Institute for International Education, Korea',
    amount: 'Full tuition + ₩900,000/month + airfare',
    eligibility: 'Under 40 years of age. Bachelor\'s or master\'s degree holders. GPA 2.64/4.0 or 2.80/4.0 minimum.',
    description: 'Study master\'s or PhD in South Korea, fully funded. Includes Korean language training for one year, tuition, monthly living allowance, round-trip airfare, and medical insurance.',
    deadline: new Date('2026-09-01'),
    link: 'https://www.studyinkorea.go.kr/en/sub/gks/allnew_invite.do',
  },
  {
    title: 'Australia Awards Scholarships',
    organization: 'Australian Government (DFAT)',
    amount: 'Full tuition + living allowance + OSHC',
    eligibility: 'Bangladeshi citizens. Minimum 2 years work experience. IELTS 6.5+ required.',
    description: 'Study master\'s degree at participating Australian universities. Covers full tuition fees, return air travel, living allowance, introductory academic program, and health insurance.',
    deadline: new Date('2026-04-30'),
    link: 'https://www.dfat.gov.au/people-to-people/australia-awards',
  },
];

async function seedScholarships() {
  if (!process.env.MONGODB_URI) {
    console.error('Error: MONGODB_URI is missing in backend .env');
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const admin = await User.findOne({ role: 'admin' });
    const fallbackUser = admin || await User.findOne({});

    if (!fallbackUser) {
      console.error('No users found. Please run adminSeeder.js or seed.js first.');
      process.exit(1);
    }

    let inserted = 0;
    let skipped = 0;

    for (const data of scholarshipsData) {
      const existing = await Scholarship.findOne({ title: data.title });
      if (existing) {
        console.log(`⏭️  "${data.title}" already exists`);
        skipped++;
        continue;
      }

      const scholarship = new Scholarship({ ...data, postedBy: fallbackUser._id });
      await scholarship.save();
      console.log(`🎓 Created: ${data.title}`);
      inserted++;
    }

    console.log(`\n✅ Scholarships seed complete — ${inserted} inserted, ${skipped} skipped`);
    console.log(`   Total scholarships in DB: ${await Scholarship.countDocuments()}`);
  } catch (error) {
    console.error('Seed error:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedScholarships();
