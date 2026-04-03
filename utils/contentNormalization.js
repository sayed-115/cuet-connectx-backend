const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Remote'];

const hasMeaningfulValue = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
};

const pickFirstValue = (payload, keys = []) => {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) continue;
    const value = payload[key];
    if (hasMeaningfulValue(value)) return value;
  }
  return undefined;
};

const sanitizeString = (value, maxLength = 500) => {
  if (!hasMeaningfulValue(value)) return undefined;
  return String(value).trim().slice(0, maxLength);
};

const sanitizeStringArray = (value, maxItems = 20, maxItemLength = 300) => {
  if (value === undefined || value === null) return undefined;

  let rawItems = [];
  if (Array.isArray(value)) {
    rawItems = value;
  } else if (typeof value === 'string') {
    rawItems = value.split(/\r?\n|,/);
  } else {
    return undefined;
  }

  return rawItems
    .map((entry) => sanitizeString(entry, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
};

const sanitizeDate = (value) => {
  if (!hasMeaningfulValue(value)) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const sanitizeNumber = (value) => {
  if (!hasMeaningfulValue(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeSalary = (payload) => {
  const salaryObject = payload.salary && typeof payload.salary === 'object' ? payload.salary : {};
  const minValue = salaryObject.min ?? pickFirstValue(payload, ['salaryMin', 'minSalary']);
  const maxValue = salaryObject.max ?? pickFirstValue(payload, ['salaryMax', 'maxSalary']);
  const currencyValue = salaryObject.currency ?? pickFirstValue(payload, ['salaryCurrency', 'currency']);

  const normalized = {};
  const min = sanitizeNumber(minValue);
  const max = sanitizeNumber(maxValue);
  const currency = sanitizeString(currencyValue, 10);

  if (min !== undefined) normalized.min = min;
  if (max !== undefined) normalized.max = max;
  if (currency) normalized.currency = currency;

  if (Object.keys(normalized).length === 0) return undefined;
  if (!normalized.currency) normalized.currency = 'BDT';
  return normalized;
};

const normalizeJobPayload = (payload = {}) => {
  const normalized = {
    title: sanitizeString(pickFirstValue(payload, ['title', 'jobTitle', 'position', 'name']), 200),
    company: sanitizeString(pickFirstValue(payload, ['company', 'organization', 'companyName']), 100),
    location: sanitizeString(pickFirstValue(payload, ['location', 'jobLocation', 'workLocation']), 100),
    type: sanitizeString(pickFirstValue(payload, ['type', 'jobType', 'employmentType']), 20),
    description: sanitizeString(pickFirstValue(payload, ['description', 'jobDescription', 'details', 'summary', 'responsibilities']), 5000),
    requirements: sanitizeStringArray(pickFirstValue(payload, ['requirements', 'requiredSkills', 'skills']), 30, 400),
    responsibilities: sanitizeStringArray(pickFirstValue(payload, ['responsibilities', 'jobResponsibilities', 'duties']), 30, 400),
    skills: sanitizeStringArray(pickFirstValue(payload, ['skills', 'keySkills']), 40, 100),
    experience: sanitizeString(pickFirstValue(payload, ['experience', 'experienceLevel', 'level']), 100),
    applicationDeadline: sanitizeDate(pickFirstValue(payload, ['applicationDeadline', 'deadline', 'applyDeadline'])),
    applyLink: sanitizeString(pickFirstValue(payload, ['applyLink', 'applicationLink', 'jobLink', 'link', 'applyUrl']), 500),
    applyEmail: sanitizeString(pickFirstValue(payload, ['applyEmail', 'applicationEmail']), 254),
    jobImage: sanitizeString(pickFirstValue(payload, ['jobImage', 'image', 'imageUrl']), 500),
    salary: normalizeSalary(payload),
  };

  if (normalized.type && !JOB_TYPES.includes(normalized.type)) {
    normalized.type = 'Full-time';
  }

  return normalized;
};

const normalizeScholarshipPayload = (payload = {}) => ({
  title: sanitizeString(pickFirstValue(payload, ['title', 'scholarshipName', 'name']), 200),
  organization: sanitizeString(pickFirstValue(payload, ['organization', 'institution', 'provider', 'company']), 100),
  amount: sanitizeString(pickFirstValue(payload, ['amount', 'fundingDetails', 'fundingAmount', 'funding', 'benefits']), 300),
  eligibility: sanitizeString(pickFirstValue(payload, ['eligibility', 'eligibilityCriteria', 'criteria']), 1000),
  description: sanitizeString(pickFirstValue(payload, ['description', 'details', 'about']), 5000),
  deadline: sanitizeDate(pickFirstValue(payload, ['deadline', 'applicationDeadline'])),
  link: sanitizeString(pickFirstValue(payload, ['link', 'scholarshipLink', 'applicationLink', 'applyLink']), 500),
  scholarshipImage: sanitizeString(pickFirstValue(payload, ['scholarshipImage', 'image', 'imageUrl']), 500),
  level: sanitizeString(pickFirstValue(payload, ['level']), 100),
  location: sanitizeString(pickFirstValue(payload, ['location']), 120),
  fundingType: sanitizeString(pickFirstValue(payload, ['fundingType', 'type']), 120),
  duration: sanitizeString(pickFirstValue(payload, ['duration']), 120),
  benefits: sanitizeString(pickFirstValue(payload, ['benefits']), 1200),
});

module.exports = {
  JOB_TYPES,
  normalizeJobPayload,
  normalizeScholarshipPayload,
};
