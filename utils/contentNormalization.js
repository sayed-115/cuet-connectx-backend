const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

const hasMeaningfulValue = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

const pickFirst = (...values) => {
  for (const value of values) {
    if (hasMeaningfulValue(value)) return value;
  }
  return undefined;
};

const hasAnyField = (body, fields) => fields.some((field) => hasOwn(body, field));

const cleanString = (value, maxLength = 5000) =>
  String(value || '')
    .trim()
    .slice(0, maxLength);

const normalizeTextField = (body, fields, maxLength, { partial = false } = {}) => {
  if (partial && !hasAnyField(body, fields)) return undefined;
  const rawValue = pickFirst(...fields.map((field) => body[field]));
  if (!hasMeaningfulValue(rawValue)) return '';
  return cleanString(rawValue, maxLength);
};

const splitListText = (value) =>
  String(value || '')
    .split(/\r?\n|,|;|\u2022|\u25CF/)
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeArrayField = (
  body,
  fields,
  { partial = false, maxItems = 20, maxItemLength = 200 } = {}
) => {
  if (partial && !hasAnyField(body, fields)) return undefined;

  const rawValue = pickFirst(...fields.map((field) => body[field]));
  if (!hasMeaningfulValue(rawValue)) return [];

  const items = Array.isArray(rawValue)
    ? rawValue
    : typeof rawValue === 'string'
      ? splitListText(rawValue)
      : [rawValue];

  return items
    .map((item) => cleanString(item, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
};

const normalizeSalary = (body, { partial = false } = {}) => {
  const salaryFields = [
    'salary',
    'salaryMin',
    'salaryMax',
    'minSalary',
    'maxSalary',
    'salaryCurrency',
    'currency',
  ];

  if (partial && !hasAnyField(body, salaryFields)) return undefined;

  const salaryObject =
    typeof body.salary === 'object' && body.salary !== null ? body.salary : {};

  const minRaw = pickFirst(
    salaryObject.min,
    body.salaryMin,
    body.minSalary,
    body.minimumSalary
  );
  const maxRaw = pickFirst(
    salaryObject.max,
    body.salaryMax,
    body.maxSalary,
    body.maximumSalary
  );
  const currencyRaw = pickFirst(
    salaryObject.currency,
    body.salaryCurrency,
    body.currency,
    'BDT'
  );

  const min = Number(minRaw);
  const max = Number(maxRaw);

  const normalized = {};
  if (Number.isFinite(min) && min >= 0) normalized.min = min;
  if (Number.isFinite(max) && max >= 0) normalized.max = max;

  const currency = cleanString(currencyRaw || 'BDT', 10).toUpperCase();
  if (currency) normalized.currency = currency;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const parseDateField = (value) => {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || String(value).trim() === '') return { ok: true, value: null };

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { ok: false, value: null };

  return { ok: true, value: parsed };
};

const isValidHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_err) {
    return false;
  }
};

const normalizeJobPayload = (body = {}, { partial = false } = {}) => {
  const normalized = {
    title: normalizeTextField(body, ['title', 'jobTitle', 'position'], 200, { partial }),
    company: normalizeTextField(body, ['company', 'companyName', 'organization'], 100, { partial }),
    location: normalizeTextField(body, ['location', 'jobLocation', 'workLocation'], 100, { partial }),
    type: normalizeTextField(body, ['type', 'jobType'], 40, { partial }),
    workMode: normalizeTextField(body, ['workMode', 'mode', 'workType'], 40, { partial }),
    description: normalizeTextField(body, ['description', 'details'], 5000, { partial }),
    shortDescription: normalizeTextField(body, ['shortDescription', 'summary'], 220, { partial }),
    requirements: normalizeArrayField(body, ['requirements', 'requirement', 'eligibility', 'eligibilityCriteria'], {
      partial,
      maxItems: 20,
      maxItemLength: 240,
    }),
    responsibilities: normalizeArrayField(body, ['responsibilities', 'duties'], {
      partial,
      maxItems: 20,
      maxItemLength: 240,
    }),
    skills: normalizeArrayField(body, ['skills', 'requiredSkills', 'skillSet', 'techStack'], {
      partial,
      maxItems: 15,
      maxItemLength: 80,
    }),
    experience: normalizeTextField(body, ['experience', 'experienceLevel', 'level'], 100, { partial }),
    applyLink: normalizeTextField(body, ['applyLink', 'applicationLink', 'jobLink', 'link'], 500, { partial }),
    applyEmail: normalizeTextField(body, ['applyEmail', 'applicationEmail'], 120, { partial }),
    jobImage: normalizeTextField(body, ['jobImage'], 500, { partial }),
    salary: normalizeSalary(body, { partial }),
  };

  const deadlineFieldPresent = hasAnyField(body, ['applicationDeadline', 'deadline', 'lastDate']);
  if (!partial || deadlineFieldPresent) {
    normalized.applicationDeadline = pickFirst(
      body.applicationDeadline,
      body.deadline,
      body.lastDate
    );
  }

  return normalized;
};

const normalizeScholarshipPayload = (body = {}, { partial = false } = {}) => {
  const normalized = {
    title: normalizeTextField(body, ['title', 'scholarshipName', 'name'], 200, { partial }),
    organization: normalizeTextField(body, ['organization', 'provider', 'institution', 'company'], 100, {
      partial,
    }),
    amount: normalizeTextField(body, ['amount', 'fundingAmount', 'fundingDetails', 'stipend'], 120, {
      partial,
    }),
    eligibility: normalizeTextField(body, ['eligibility', 'eligibilityCriteria', 'criteria', 'requirements'], 1000, {
      partial,
    }),
    description: normalizeTextField(body, ['description', 'details', 'summary'], 5000, { partial }),
    link: normalizeTextField(body, ['link', 'scholarshipLink', 'applicationLink', 'applyLink'], 500, {
      partial,
    }),
    scholarshipImage: normalizeTextField(body, ['scholarshipImage'], 500, { partial }),
  };

  const deadlineFieldPresent = hasAnyField(body, ['deadline', 'applicationDeadline', 'lastDate']);
  if (!partial || deadlineFieldPresent) {
    normalized.deadline = pickFirst(body.deadline, body.applicationDeadline, body.lastDate);
  }

  return normalized;
};

module.exports = {
  normalizeJobPayload,
  normalizeScholarshipPayload,
  parseDateField,
  isValidHttpUrl,
};
