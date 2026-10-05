// ============================================================
// TRUTH LOCK VERIFIER — 100% Deterministic, Zero LLM calls
// ============================================================

const ALIAS_DICT = {
  js: "javascript",
  ts: "typescript",
  ml: "machine learning",
  ai: "artificial intelligence",
  dl: "deep learning",
  nlp: "natural language processing",
  cv: "computer vision",
  react: "reactjs",
  vue: "vuejs",
  node: "nodejs",
  py: "python",
  sql: "structured query language",
  nosql: "no-sql",
  k8s: "kubernetes",
  tf: "tensorflow",
  ci: "continuous integration",
  cd: "continuous deployment",
  oop: "object-oriented programming",
  dsa: "data structures and algorithms",
  api: "application programming interface",
  rest: "restful",
  aws: "amazon web services",
  gcp: "google cloud platform",
  az: "microsoft azure",
  html: "hypertext markup language",
  css: "cascading style sheets",
  db: "database",
  fe: "frontend",
  be: "backend",
  fullstack: "full stack",
  "full-stack": "full stack",
  devops: "development operations",
  ux: "user experience",
  ui: "user interface",
  sde: "software development engineer",
  swe: "software engineer",
  pm: "project management"
};

const WEAK_ACTION_VERBS = [
  "helped", "assisted", "worked on", "was responsible for", "involved in",
  "contributed to", "did", "made", "tried", "attempted", "participated",
  "was part of", "responsible for", "used", "utilized", "handled",
  "managed tasks", "performed", "carried out"
];

const STRONG_ACTION_VERBS = [
  "built", "developed", "engineered", "architected", "designed", "implemented",
  "launched", "shipped", "deployed", "optimized", "reduced", "increased",
  "improved", "scaled", "led", "drove", "delivered", "created", "established",
  "automated", "streamlined", "accelerated", "generated", "achieved", "exceeded",
  "collaborated", "mentored", "refactored", "migrated", "integrated"
];

/**
 * Extract numbers and percentages from a string
 */
function extractNumbers(text) {
  const patterns = [
    /\b\d+\.?\d*%/g,                    // percentages: 25%, 99.9%
    /\b\d{1,3}(,\d{3})+\b/g,            // formatted numbers: 1,000,000
    /\b\d+[kmb]\+?\b/gi,                // abbreviated: 10k, 5M, 2B
    /\b\d+\+\b/g,                        // 100+
    /\b\d{4}\b/g,                        // years: 2022, 2023
    /\b\d+\.\d+\b/g,                     // decimals: 3.5
    /\b[1-9]\d*\b/g,                     // plain numbers > 0
  ];
  
  const found = new Set();
  patterns.forEach(pat => {
    const matches = text.match(pat) || [];
    matches.forEach(m => found.add(m.toLowerCase().replace(/,/g, '')));
  });
  return [...found];
}

/**
 * Check if a value exists in the combined input corpus
 */
function existsInInput(value, inputCorpus) {
  const corpus = inputCorpus.toLowerCase().replace(/,/g, '');
  const val = value.toLowerCase().replace(/,/g, '');
  return corpus.includes(val);
}

/**
 * Truth Lock Verifier — deterministic bullet verification
 * Returns bullets[] with `verified` and `status` fields
 */
function verifyBullets(bullets, rawInputText, userAnswers = {}) {
  // Build the full input corpus (raw resume + all user answers)
  const answerText = Object.values(userAnswers).join(" ");
  const fullCorpus = `${rawInputText} ${answerText}`.toLowerCase();

  return bullets.map(bullet => {
    const { text, source_quote, section } = bullet;

    // Check 1: source_quote must exist in corpus
    let sourceVerified = false;
    if (source_quote && source_quote.trim().length > 3) {
      const normalized = source_quote.toLowerCase().trim();
      // Allow for fuzzy token matching (all significant words present)
      const words = normalized.split(/\s+/).filter(w => w.length > 3);
      const wordMatchCount = words.filter(w => fullCorpus.includes(w)).length;
      sourceVerified = words.length === 0 || (wordMatchCount / words.length) >= 0.7;
    } else {
      // No source quote provided — treat as unverified
      sourceVerified = false;
    }

    // Check 2: All numbers in the bullet text must exist in corpus
    const numbersInBullet = extractNumbers(text);
    const unverifiedNumbers = numbersInBullet.filter(num => {
      // Years 2015-2026 are generally valid (dates)
      if (/^20\d{2}$/.test(num) || /^19\d{2}$/.test(num)) return false;
      return !existsInInput(num, fullCorpus);
    });

    const status = sourceVerified && unverifiedNumbers.length === 0
      ? "verified"
      : "needs_confirmation";

    return {
      ...bullet,
      verified: status === "verified",
      status,
      unverifiedNumbers,
      sourceVerified
    };
  });
}

/**
 * Re-validate a single bullet after inline edit
 */
function revalidateBullet(bullet, rawInputText, userAnswers = {}) {
  const result = verifyBullets([bullet], rawInputText, userAnswers);
  return result[0];
}

// ============================================================
// ATS KEYWORD SCORER — Deterministic alias-aware matcher
// ============================================================

function normalizeWithAliases(text) {
  let normalized = text.toLowerCase();
  Object.entries(ALIAS_DICT).forEach(([alias, full]) => {
    const regex = new RegExp(`\\b${alias}\\b`, 'gi');
    normalized = normalized.replace(regex, full);
  });
  return normalized;
}

/**
 * Score resume text against a keyword list
 * Returns { score, matched, missing }
 */
function scoreKeywords(resumeText, keywords) {
  const normalizedResume = normalizeWithAliases(resumeText);
  
  const matched = [];
  const missing = [];
  
  keywords.forEach(kw => {
    const normalizedKW = normalizeWithAliases(kw);
    // Check both exact and alias-expanded form
    if (
      normalizedResume.includes(normalizedKW) ||
      normalizedResume.includes(kw.toLowerCase())
    ) {
      matched.push(kw);
    } else {
      missing.push(kw);
    }
  });
  
  const score = keywords.length > 0
    ? Math.round((matched.length / keywords.length) * 100)
    : 0;
  
  return { score, matched, missing };
}

/**
 * Audit raw input for weak verbs and missing metrics
 */
function auditInput(rawText) {
  const issues = [];
  const text = rawText.toLowerCase();
  
  // Check for weak verbs
  const foundWeak = WEAK_ACTION_VERBS.filter(v => text.includes(v.toLowerCase()));
  if (foundWeak.length > 0) {
    issues.push(`Weak action verbs detected: "${foundWeak.slice(0, 3).join('", "')}". Replace with impact-driven verbs.`);
  }
  
  // Check for numbers/metrics
  const nums = extractNumbers(rawText);
  if (nums.length < 2) {
    issues.push("Very few measurable metrics found. Add quantified achievements (%, users, time saved).");
  }
  
  // Check for missing sections
  const sectionKeywords = {
    experience: ["experience", "worked at", "company", "employer", "job"],
    projects: ["project", "built", "developed", "created", "github"],
    education: ["university", "college", "degree", "b.tech", "b.sc", "bachelor", "master", "cgpa", "gpa"],
    skills: ["skills", "technologies", "proficient", "familiar"]
  };
  
  Object.entries(sectionKeywords).forEach(([section, keywords]) => {
    const hasSection = keywords.some(k => text.includes(k));
    if (!hasSection) {
      issues.push(`Missing "${section}" section — add relevant details.`);
    }
  });
  
  return issues;
}

/**
 * Convert resume object to plain text for ATS parsing
 */
function resumeToPlainText(resume) {
  if (!resume) return "";
  
  const lines = [];
  
  // Header
  if (resume.header) {
    const h = resume.header;
    lines.push(h.name || "");
    if (h.email) lines.push(h.email);
    if (h.phone) lines.push(h.phone);
    if (h.linkedin) lines.push(h.linkedin);
    if (h.github) lines.push(h.github);
    lines.push("");
  }
  
  // Summary
  if (resume.summary) {
    lines.push("SUMMARY");
    lines.push(resume.summary);
    lines.push("");
  }
  
  // Skills
  if (resume.skills) {
    lines.push("SKILLS");
    if (Array.isArray(resume.skills)) {
      lines.push(resume.skills.join(", "));
    } else if (typeof resume.skills === "object") {
      Object.entries(resume.skills).forEach(([cat, items]) => {
        lines.push(`${cat}: ${Array.isArray(items) ? items.join(", ") : items}`);
      });
    }
    lines.push("");
  }
  
  // Experience
  if (resume.experience?.length) {
    lines.push("EXPERIENCE");
    resume.experience.forEach(exp => {
      lines.push(`${exp.title || exp.role} at ${exp.company}`);
      if (exp.duration || exp.period) lines.push(exp.duration || exp.period);
      (exp.bullets || exp.achievements || []).forEach(b => lines.push(`- ${b}`));
      lines.push("");
    });
  }
  
  // Education
  if (resume.education?.length) {
    lines.push("EDUCATION");
    resume.education.forEach(edu => {
      lines.push(`${edu.degree} - ${edu.institution || edu.school}`);
      if (edu.year || edu.graduationYear) lines.push(edu.year || edu.graduationYear);
      if (edu.gpa || edu.cgpa) lines.push(`GPA: ${edu.gpa || edu.cgpa}`);
      lines.push("");
    });
  }
  
  // Projects
  if (resume.projects?.length) {
    lines.push("PROJECTS");
    resume.projects.forEach(proj => {
      lines.push(proj.name || proj.title);
      if (proj.description) lines.push(proj.description);
      (proj.bullets || []).forEach(b => lines.push(`- ${b}`));
      lines.push("");
    });
  }
  
  // Certifications
  if (resume.certifications?.length) {
    lines.push("CERTIFICATIONS");
    resume.certifications.forEach(cert => {
      lines.push(typeof cert === "string" ? cert : `${cert.name} - ${cert.issuer || ""}`);
    });
    lines.push("");
  }
  
  return lines.join("\n");
}

module.exports = {
  verifyBullets,
  revalidateBullet,
  scoreKeywords,
  auditInput,
  resumeToPlainText,
  extractNumbers,
  ALIAS_DICT,
  WEAK_ACTION_VERBS,
  STRONG_ACTION_VERBS
};
