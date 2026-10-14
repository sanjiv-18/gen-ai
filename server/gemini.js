// Gemini AI Integration — Two-Pass Architecture + Resilient Model Fallbacks
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PROFILE_JSON_SCHEMA, TARGET_LENS_JSON_SCHEMA, createEmptyProfile, normalizeProfile } = require("./schema");

let genAI = null;

function initGemini(apiKey) {
  if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
}

function cleanAndParseJSON(text) {
  if (!text) return {};
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    try {
      // Fix common LLM JSON syntax issues: trailing commas before } or ], control characters
      const fixed = cleaned
        .replace(/,\s*([\]}])/g, '$1')
        .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, ' ');
      return JSON.parse(fixed);
    } catch (err2) {
      console.warn("Failed to parse JSON directly, returning empty object:", err.message);
      return {};
    }
  }
}

// Resilient candidate models: gemini-3.5-flash-lite (primary), with fast fallbacks
const CANDIDATE_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
  "gemini-flash-latest"
];

function getModel(modelName = "gemini-3.5-flash-lite", customConfig = {}) {
  if (!genAI) throw new Error("NO_API_KEY");
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1, // Low temperature for deterministic entity extraction
      ...customConfig
    }
  });
}

async function generateJSONWithFallback(prompt, customConfig = {}) {
  if (!genAI) throw new Error("NO_API_KEY");
  let lastError = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = getModel(modelName, customConfig);
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return cleanAndParseJSON(text);
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini] Model ${modelName} call failed (${err.message}). Trying fallback model...`);
    }
  }

  throw lastError || new Error("All Gemini candidate models failed.");
}

// ── PRE-PROCESSING & TEXT SANITIZATION LAYER ─────────────────────────────────
/**
 * Sanitizes raw text extracted from PDF/DOCX:
 * - Normalizes Unicode whitespace, zero-width chars, quotes, and ligatures
 * - Strips PDF page headers, footers, timestamps, and page numbers
 * - Filters out lonely symbol lines and conversational/prompt-leak artifacts
 * - Normalizes excessive consecutive newlines
 */
function sanitizeResumeText(rawText) {
  if (!rawText || typeof rawText !== "string") return "";

  // 1. Unicode normalization (NFKC normalizes ligatures like fi, fl and compatibility forms)
  let text = rawText.normalize("NFKC");

  // 2. Normalize whitespace, smart dashes, and quotes
  text = text
    .replace(/[\u00A0\u202F\u1680\u2000-\u200A]/g, " ")
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
    .replace(/[\u2022\u2023\u25E6\u25AA\u25CF\u2219]/g, "• ");

  // 3. Remove non-printable control characters except newline and tab
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  const lines = text.split(/\r?\n/);
  const cleanedLines = [];

  const HEADER_FOOTER_REGEX = /^(page\s+\d+(\s+of\s+\d+)?|\d+\s+of\s+\d+|\[\s*page\s+\d+\s*\]|curriculum\s+vitae|confidential|downloaded\s+from\b.*|https?:\/\/.*\/resume.*)[\.\:\-]?$/i;
  const CONVERSATIONAL_ARTIFACT_REGEX = /^(every\s+one\s+of\s+these\s+gives\s+them\s+a\s+question|please\s+refer\s+to|click\s+here\s+to|instructions?:|evaluation\s+criteria:?|note\s+that:?)[\.\!\?]?$/i;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      cleanedLines.push("");
      continue;
    }

    // Strip standalone isolated symbol lines (e.g. "•", "-", "---", "|", "...")
    if (/^[•\-\*\.\|\_\~\:\;\#\=]{1,5}$/.test(trimmed)) {
      continue;
    }

    // Strip page numbers & header/footer artifacts
    if (HEADER_FOOTER_REGEX.test(trimmed)) {
      continue;
    }

    // Strip conversational / prompt-bleed artifacts
    if (CONVERSATIONAL_ARTIFACT_REGEX.test(trimmed)) {
      continue;
    }

    // Normalize multiple inline spaces to a single space
    const normalizedLine = trimmed.replace(/[ \t]{2,}/g, " ");
    cleanedLines.push(normalizedLine);
  }

  // Collapse excessive empty lines (max 2 consecutive newlines)
  return cleanedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// ── PASS 1: DETERMINISTIC RESUME EXTRACTION ────────────────────────────────
/**
 * Pure Resume Extraction — ZERO target company awareness!
 * Grounding invariants:
 * - Verbatim numeric extraction: CGPA 7.11 stays 7.11. Never converted to 6.5 or 4.0 scale.
 * - Missing sections default to empty array []. Never injects placeholder companies.
 * - Discards conversational sentences from project names.
 */
async function callPass1Extract(sanitizedText) {
  const prompt = `
You are a deterministic, zero-hallucination Resume Entity Extraction Engine.
Your sole responsibility is to convert the raw parsed resume text into a strictly normalized JSON representation of facts EXPLICITLY PRESENT in the text.

CRITICAL GROUNDING RULES:
1. STRICT VERBATIM EXTRACTION:
   - Extract values verbatim as they appear in the source text.
   - Do NOT infer, normalize, round, recalculate, convert, or estimate numeric fields like CGPA, GPA, percentages, graduation years, or dates.
   - If the source states "CGPA: 7.11" or "7.11/10", the gpa field MUST be exactly "7.11" (or "7.11/10"). NEVER normalize 7.11 to 6.5, 3.5, or a 4.0 scale.
   - If GPA or CGPA is not stated in the text, return "".

2. ZERO FABRICATION OF NON-EXISTENT SECTIONS:
   - If a standard section (e.g., Work Experience, Internships, Certifications, Extracurricular Activities) is NOT explicitly present in the document, return an empty array [].
   - NEVER invent placeholder companies, dummy roles, or mock objects like "Company", "Present", "Software Engineer", or "engineering Experience: Company".
   - If the candidate is a student or fresher with no employment history, "experience" MUST be [].

3. STRICT PROJECT VERIFICATION & ARTIFACT FILTERING:
   - A project entry MUST be an actual technical software/hardware engineering project with a verified project title and related technical description or bullet points.
   - DISCARD floating sentences, reviewer guidelines, conversational artifacts, or random PDF debris (e.g., "Every one of these gives them a question.") that do not describe technical project work. NEVER create phantom projects from stray sentences.
   - If no genuine technical projects are present, "projects" MUST be [].

4. STRICT SKILL ISOLATION (ZERO KEYWORD BLEED):
   - Extract ONLY technical skills and tools that are explicitly stated in the resume text.
   - Do NOT assume, infer, or inject skills that are not in the text.

5. ISOLATION FROM TARGET COMPANY:
   - Do NOT optimize or tailor for any company at this stage. Extract ONLY what the candidate has written.

POSITIVE EXAMPLE:
Input:
"Rahul Sharma
rahul.sharma@gmail.com | +91-9876543210 | Bangalore
github.com/rahul | linkedin.com/in/rahul
EDUCATION: B.Tech in Computer Science, ABC University, 2024. CGPA: 7.11
SKILLS: Python, React, JavaScript, PostgreSQL, OpenCV
PROJECTS:
Smart Vision Guard
• Built real-time edge detection system using Python and OpenCV.
• Processed 30 FPS video streams."

Output:
{
  "name": "Rahul Sharma",
  "email": "rahul.sharma@gmail.com",
  "phone": "+91-9876543210",
  "linkedin": "linkedin.com/in/rahul",
  "github": "github.com/rahul",
  "location": "Bangalore",
  "summary": "",
  "skills": ["Python", "React", "JavaScript", "PostgreSQL", "OpenCV"],
  "experience": [],
  "education": [
    {
      "degree": "B.Tech in Computer Science",
      "institution": "ABC University",
      "year": "2024",
      "gpa": "7.11",
      "coursework": []
    }
  ],
  "projects": [
    {
      "name": "Smart Vision Guard",
      "description": "Real-time edge detection system using Python and OpenCV",
      "tech": ["Python", "OpenCV"],
      "link": "",
      "bullets": [
        "Built real-time edge detection system using Python and OpenCV.",
        "Processed 30 FPS video streams."
      ]
    }
  ],
  "certifications": [],
  "activities": [],
  "github_repos": ["smart-vision-guard"]
}

NEGATIVE CONSTRAINTS TO ENFORCE:
- WRONG: "experience": [{"title": "Software Engineer", "company": "Company", ...}] -> NEVER do this! Return []!
- WRONG: "gpa": "6.5/10" when text says 7.11 -> NEVER do this! Return "7.11"!
- WRONG: "projects": [{"name": "Every one of", ...}] -> NEVER parse conversational artifacts as projects! Discard them!

RAW RESUME TEXT:
"""
${sanitizedText}
"""

Return ONLY valid JSON matching this schema:
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "linkedin": "string",
  "github": "string",
  "location": "string",
  "summary": "string",
  "skills": ["string"],
  "experience": [
    {
      "title": "string",
      "company": "string",
      "duration": "string",
      "months": 0,
      "isInternship": false,
      "bullets": ["string"]
    }
  ],
  "education": [
    {
      "degree": "string",
      "institution": "string",
      "year": "string",
      "gpa": "string",
      "coursework": ["string"]
    }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string",
      "tech": ["string"],
      "link": "string",
      "bullets": ["string"]
    }
  ],
  "certifications": ["string"],
  "activities": ["string"],
  "github_repos": ["string"]
}
`;

  const parsed = await generateJSONWithFallback(prompt, {
    responseSchema: PROFILE_JSON_SCHEMA
  });

  return normalizeProfile(parsed, sanitizedText);
}

// ── DETERMINISTIC ML LAYER: Cosine Similarity (Vector Space Model) ─────────
/**
 * Calculates mathematical match score between extracted skills and target keywords
 * using standard Vector Space Model with Cosine Similarity.
 * Returns percentage (0 - 100) rounded to 1 decimal place.
 */
function calculateCosineSimilarity(resumeSkills = [], targetJDSkills = []) {
  // Normalize skills for case-insensitive matching
  const cleanA = (resumeSkills || []).map(s => String(s).trim().toLowerCase()).filter(Boolean);
  const cleanB = (targetJDSkills || []).map(s => String(s).trim().toLowerCase()).filter(Boolean);
  const vocabulary = Array.from(new Set([...cleanA, ...cleanB]));
  if (vocabulary.length === 0) return 0;

  const buildVector = (skills) => vocabulary.map(term => skills.includes(term) ? 1 : 0);
  const vectorA = buildVector(cleanA);
  const vectorB = buildVector(cleanB);
  let dotProduct = 0;
  for (let i = 0; i < vocabulary.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
  }
  const magnitudeA = Math.sqrt(vectorA.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(vectorB.reduce((sum, val) => sum + val * val, 0));
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return parseFloat(((dotProduct / (magnitudeA * magnitudeB)) * 100).toFixed(1));
}

// ── PASS 2: TARGET LENS & GAP MAPPING ──────────────────────────────────────
/**
 * Takes the clean grounded profile from Pass 1 and applies the Target Company Lens:
 * - Detects mode (fresher vs experienced) based on actual verified experience
 * - Identifies skill gaps without polluting the candidate's extracted profile
 * - Formulates max 3 smart questions to gather missing quantifiable metrics
 * - Produces company tone tips and maps matched projects
 * - Computes deterministic ml_match_score via Vector Space Cosine Similarity
 */
async function callPass2TargetLens(profile, companyProfile, targetRole, jd) {
  const isFresher = (profile.experience || []).length === 0 ||
    profile.experience.every(e => e.isInternship || (e.months && e.months < 3) || /intern\b/i.test(e.title || ""));
  const mode = isFresher ? "fresher" : "experienced";

  const prompt = `
You are an ATS optimization expert and technical recruiter evaluating a candidate for ${companyProfile.name}.
Your task is to analyze the candidate's VERIFIED profile against ${companyProfile.name}'s standards and target role requirements.

TARGET COMPANY PROFILE:
- Company: ${companyProfile.name}
- Type: ${companyProfile.type}
- Hiring Style: ${companyProfile.hiringStyle}
- Preferred Tech Stack: ${JSON.stringify(companyProfile.stack)}
- Key Values: ${JSON.stringify(companyProfile.coreValues)}
- Tone / Culture: ${companyProfile.tone}
- Words to Avoid: ${JSON.stringify(companyProfile.avoidWords || [])}

TARGET ROLE: ${targetRole || "Software Engineer"}

JOB DESCRIPTION (if provided):
"""
${jd || "No JD provided — evaluate against company profile defaults"}
"""

VERIFIED CANDIDATE PROFILE (Extracted in Pass 1):
- Candidate Name: ${profile.name}
- Extracted Skills: ${JSON.stringify(profile.skills || [])}
- Work Experience: ${JSON.stringify(profile.experience || [])}
- Education: ${JSON.stringify(profile.education || [])}
- Projects: ${JSON.stringify((profile.projects || []).map(p => ({ name: p.name, tech: p.tech, bullets: p.bullets })))}

DETECTED HIRING MODE: ${mode}

RULES:
1. GAP MAP: Compare candidate's extracted skills against ${companyProfile.name}'s stack (${JSON.stringify(companyProfile.stack)}) and JD.
   - "strong": Candidate explicitly demonstrates depth with this skill.
   - "weak": Candidate lists it or touches it briefly without deep metrics.
   - "missing": Required by company or JD but absent from candidate's profile. Suggest one concrete, actionable project idea for each missing item.
2. AUDIT: Flag 3-5 specific, actionable weaknesses in the candidate's existing bullets (e.g. weak verbs like 'worked on' or 'helped', missing impact metrics, lack of scale).
3. SMART QUESTIONS: Ask at most 3 focused questions to gather missing quantifiable numbers (e.g. users, requests/sec, latency reduction) from their existing projects.
4. KEYWORDS: Return top 20 ATS keywords for this company and role.
5. MATCHED PROJECTS: Select which of the candidate's actual projects best match ${companyProfile.name}'s stack. Never invent new project names.

Return ONLY valid JSON matching this schema:
{
  "mode": "${mode}",
  "audit": ["string"],
  "questions": ["string"],
  "gap_map": [
    {
      "skill": "string",
      "status": "strong | weak | missing",
      "suggestion": "string"
    }
  ],
  "keywords": ["string"],
  "company_tone_tips": ["string"],
  "matched_projects": [
    {
      "name": "string",
      "description": "string",
      "tech": ["string"],
      "relevance": "string"
    }
  ]
}
`;

  const result = await generateJSONWithFallback(prompt, {
    responseSchema: TARGET_LENS_JSON_SCHEMA
  });

  // ── DETERMINISTIC ML LAYER: Cosine Similarity ───────────────────────────
  // Compare candidate's extracted skills against target company stack & keywords
  const targetKeywords = [
    ...(companyProfile?.stack || []),
    ...(companyProfile?.keywords || []),
    ...(Array.isArray(result.keywords) ? result.keywords : [])
  ];
  const ml_match_score = calculateCosineSimilarity(profile.skills || [], targetKeywords);

  return {
    mode: result.mode || mode,
    ml_match_score,
    audit: Array.isArray(result.audit) ? result.audit : [],
    questions: Array.isArray(result.questions) ? result.questions.slice(0, 3) : [],
    gap_map: Array.isArray(result.gap_map) ? result.gap_map : [],
    keywords: Array.isArray(result.keywords) ? result.keywords : companyProfile.keywords || [],
    company_tone_tips: Array.isArray(result.company_tone_tips) ? result.company_tone_tips : [companyProfile.tone],
    matched_projects: Array.isArray(result.matched_projects) ? result.matched_projects : []
  };
}

// ── TWO-PASS COORDINATOR: callUnderstand ────────────────────────────────────
/**
 * Orchestrates Pass 1 (Deterministic Extraction) followed by Pass 2 (Target Lens & Gap Mapping).
 * Keeps profile extraction completely isolated from company keyword bleed.
 */
async function callUnderstand(rawText, targetCompany, targetRole, jd = "", companyProfile = null) {
  const sanitized = sanitizeResumeText(rawText);

  // Pass 1: Extract clean, grounded profile with zero company bias
  const profile = await callPass1Extract(sanitized);

  // Load company profile if not passed
  const { getCompanyProfile } = require("./companyProfiles");
  const compProf = companyProfile || getCompanyProfile(targetCompany);

  // Pass 2: Apply Target Lens & Gap Mapping to the clean profile
  const lens = await callPass2TargetLens(profile, compProf, targetRole, jd);

  return {
    profile,
    ml_match_score: lens.ml_match_score ?? 0,
    mode: lens.mode,
    audit: lens.audit,
    questions: lens.questions,
    gap_map: lens.gap_map,
    keywords: lens.keywords,
    company_tone_tips: lens.company_tone_tips,
    matched_projects: lens.matched_projects,
    rawText: sanitized
  };
}

// ── CALL 2: Analyze ────────────────────────────────────────────────────────
// Decodes JD, loads company context, builds gap map, matches live GitHub repos
async function callAnalyze(profile, companyProfile, jd, mode, liveGithubRepos = []) {
  const model = getModel();
  const prompt = `
You are an ATS optimization expert and technical recruiter for ${companyProfile.name}.

CANDIDATE PROFILE:
Skills: ${JSON.stringify(profile.skills || [])}
Experience: ${JSON.stringify(profile.experience?.map(e => ({ title: e.title, company: e.company })) || [])}
Projects: ${JSON.stringify(profile.projects?.map(p => ({ name: p.name, tech: p.tech })) || [])}

REAL LIVE GITHUB REPOSITORIES (fetched live via GitHub REST API — exclude forks):
${JSON.stringify(liveGithubRepos, null, 2)}

COMPANY PROFILE:
- Company: ${companyProfile.name}
- Type: ${companyProfile.type}
- Hiring Style: ${companyProfile.hiringStyle}
- Tech Stack: ${JSON.stringify(companyProfile.stack)}
- Key Values: ${JSON.stringify(companyProfile.coreValues)}

JOB DESCRIPTION (if provided):
"""
${jd || "No JD provided — use company profile defaults"}
"""

Mode: ${mode}

Return ONLY valid JSON:
{
  "keywords": ["string — top 20 ATS keywords for this role/company"],
  "gap_map": [
    {
      "skill": "string",
      "status": "strong OR weak OR missing",
      "suggestion": "string — one actionable project/course suggestion for missing skills"
    }
  ],
  "company_tone_tips": ["string — 3 tone/style tips specific to this company"],
  "jd_extracted_stack": ["string — tech extracted from JD if provided"],
  "matched_projects": [
    {
      "name": "string — exact live repo name",
      "description": "string",
      "language": "string",
      "topics": ["string"],
      "html_url": "string"
    }
  ]
}

Gap map rules:
- "strong": candidate clearly demonstrates this skill
- "weak": candidate mentions it but lacks depth/examples
- "missing": company requires it but candidate shows no evidence

Matched projects rule:
Select which of the candidate's actual live GitHub repositories (if any) match ${companyProfile.name}'s stack (${JSON.stringify(companyProfile.stack)}). Do NOT invent or hallucinate project names. Return only real repos from the input array.

Include all company stack items + JD-extracted skills in gap_map. Max 15 items.
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return cleanAndParseJSON(text);
}

// ── CALL 3: Build ──────────────────────────────────────────────────────────
// Writes optimized resume with Truth Lock source tracking
async function callBuild(profile, companyProfile, mode, modeConfig, keywords, gapAnswers, userAnswers, jd) {
  const model = getModel();
  
  const confirmedSkills = Object.entries(gapAnswers || {})
    .filter(([_, v]) => v === true)
    .map(([k]) => k);

  const prompt = `
You are a world-class ATS resume writer. Build a fully optimized, ${mode === "fresher" ? "one-page" : "one-page"} resume.

SECTION ORDER: ${JSON.stringify(modeConfig.order)}
RULE: ${modeConfig.rule}

COMPANY TARGET: ${companyProfile.name}
TONE: ${companyProfile.tone}
KEYWORDS TO HIT: ${JSON.stringify(keywords)}
AVOID WORDS: ${JSON.stringify(companyProfile.avoidWords)}
TEMPLATE STYLE: ${companyProfile.templateStyle}

CANDIDATE PROFILE:
${JSON.stringify(profile, null, 2)}

USER ANSWERS TO SMART QUESTIONS:
${JSON.stringify(userAnswers || {})}

CONFIRMED ADDITIONAL SKILLS (user said yes): ${JSON.stringify(confirmedSkills)}

JD (if provided):
"""
${jd || ""}
"""

RULES:
1. Never fabricate numbers, titles, or facts not in the profile or user answers
2. Every metric must come verbatim from input — use source_quote to prove it
3. ${modeConfig.rule}
4. For ${companyProfile.name}, emphasize: ${JSON.stringify(companyProfile.emphasis)}
5. Reframe weak bullets into impact statements using strong verbs
6. Include as many target keywords naturally as possible
7. Keep to one page maximum
8. Extract projects as single objects. Do not split bullet points into separate project names. The 'Project Name' must be the overarching title, and 'Tech Stack' must be an array of technologies used. Ignore raw bullet descriptions in this array.

Return ONLY valid JSON:
{
  "resume": {
    "header": {
      "name": "string",
      "email": "string",
      "phone": "string",
      "linkedin": "string",
      "github": "string",
      "location": "string"
    },
    "summary": "string",
    "skills": {
      "Languages": ["string"],
      "Frameworks": ["string"],
      "Tools": ["string"],
      "Databases": ["string"],
      "Cloud": ["string"]
    },
    "experience": [
      {
        "title": "string",
        "company": "string",
        "duration": "string",
        "bullets": ["string"]
      }
    ],
    "education": [
      {
        "degree": "string",
        "institution": "string",
        "year": "string",
        "gpa": "string",
        "relevantCoursework": ["string"]
      }
    ],
    "projects": [
      {
        "name": "string",
        "tech": ["string"],
        "link": "string",
        "bullets": ["string"]
      }
    ],
    "certifications": ["string"]
  },
  "changes_explained": [
    {
      "original": "string — original bullet/phrase",
      "updated": "string — new bullet/phrase",
      "reason": "string — why this change improves ATS score / company fit"
    }
  ],
  "bullets": [
    {
      "section": "string",
      "text": "string — the bullet text",
      "source_quote": "string — verbatim snippet from input confirming this fact"
    }
  ]
}

The bullets[] array MUST include every single bullet point from the resume with its source_quote.
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return cleanAndParseJSON(text);
}

function isConversationalArtifact(line) {
  if (!line || typeof line !== "string") return true;
  const trimmed = line.trim().toLowerCase();
  if (/^(every\s+one\s+of|this\s+is|please\s+refer|click\s+here|note\s+that|instructions?:|evaluation|give\s+them|gives\s+them|feedback)/i.test(trimmed)) {
    return true;
  }
  // Conversational sentence with ending punctuation and length
  if (/[.!?]$/.test(trimmed) && trimmed.split(/\s+/).length > 5) {
    return true;
  }
  return false;
}

function extractVerbatimGpa(text) {
  if (!text || typeof text !== "string") return "";
  // 1. Explicit CGPA / GPA / Percentage prefix: e.g. "CGPA: 7.11", "CGPA: 7.11/10", "GPA: 3.8", "Percentage: 85%"
  const match1 = text.match(/\b(?:cgpa|gpa|grade|score|percentage)[:\s]*([0-9]+(?:\.[0-9]+)?(?:\s*\/\s*[0-9]+(?:\.[0-9]+)?)?%?)/i);
  if (match1 && match1[1]) return match1[1].trim();

  // 2. Trailing CGPA / GPA e.g. "7.11/10 CGPA" or "7.11 CGPA"
  const match2 = text.match(/([0-9]+\.[0-9]+(?:\s*\/\s*10)?)\s*(?:cgpa|gpa)/i);
  if (match2 && match2[1]) return match2[1].trim();

  return "";
}

function cleanRepoOrProjectName(str) {
  if (!str || typeof str !== 'string') return "Software Project";
  let s = str.trim();

  // Strip URLs
  s = s.replace(/https?:\/\/[^\s]+/gi, '').replace(/github\.com\/[\w-]+\/?/gi, '');

  // Strip version tags e.g. v1.0, v2.4, version 3.0, v1.0.0
  s = s.replace(/\bv?\d+\.\d+(\.\d+)?(-[a-z0-9]+)?\b/gi, '');
  s = s.replace(/\b(version|ver|release|build|commit|commitments?|logs?)\b.*/gi, '');

  // Strip leading prefixes like "Project 1:", "Title:", "Repo:"
  s = s.replace(/^(project\s*\d*:?|title:?|repo:?)\s*/i, '');

  // Strip parenthetical content (2023) or [v1.0]
  s = s.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '');

  // Strip trailing descriptions after delimiters |, :, -, —
  s = s.split(/\s*[:|—\-]\s*/)[0];

  // Remove non-alphanumeric boundary chars
  s = s.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();

  return s || "Software Project";
}

function safeMatchKeyword(text, keyword) {
  if (!text || !keyword) return false;
  try {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefix = /^\w/.test(keyword) ? '\\b' : '(?:^|\\s|[^a-zA-Z0-9])';
    const suffix = /\w$/.test(keyword) ? '\\b' : '(?:$|\\s|[^a-zA-Z0-9])';
    return new RegExp(`${prefix}${escaped}${suffix}`, 'i').test(text);
  } catch {
    return text.toLowerCase().includes(keyword.toLowerCase());
  }
}

/**
 * Deterministic Fallback Resume Parser:
 * Strictly grounded.
 * - Extracts verbatim CGPA/GPA (e.g. 7.11)
 * - Returns empty array [] if no work experience exists (NO dummy placeholder companies)
 * - Returns empty array [] if no verified projects exist (NO dummy placeholder projects)
 * - Discards conversational lines from project names
 */
function parseResumeText(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  const sanitized = sanitizeResumeText(rawText);
  const rawLines = sanitized.split('\n').map(l => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return null;

  // 1. Header & Contacts
  const name = rawLines[0].replace(/^(curriculum vitae|resume|cv)/i, '').trim() || "Candidate Name";
  const emailMatch = sanitized.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : "";
  const phoneMatch = sanitized.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d{10,12}/);
  const phone = phoneMatch ? phoneMatch[0] : "";
  const linkedinMatch = sanitized.match(/(?:linkedin\.com\/in\/[\w-]+|[a-zA-Z0-9-]+\.linkedin\.com)/i);
  const linkedin = linkedinMatch ? linkedinMatch[0] : "";
  const githubMatch = sanitized.match(/(?:github\.com\/[\w-]+)/i);
  const github = githubMatch ? githubMatch[0] : "";

  // 2. Comprehensive Tech Keywords List (100+ items)
  const TECH_KEYWORDS = [
    "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "C", "Go", "Golang", "Rust", "PHP", "Ruby", "Swift", "Kotlin",
    "React", "React Native", "Angular", "Vue", "Vue.js", "Svelte", "Next.js", "Nuxt.js", "Node.js", "Express", "NestJS",
    "Flask", "Django", "FastAPI", "Spring Boot", "ASP.NET", "Laravel", "Ruby on Rails",
    "HTML", "CSS", "Sass", "LESS", "Tailwind", "TailwindCSS", "Bootstrap", "Material UI", "Chakra UI", "Redux", "Zustand", "MobX",
    "SQL", "MySQL", "PostgreSQL", "MongoDB", "Redis", "Cassandra", "DynamoDB", "Firebase", "Supabase", "SQLite", "Oracle", "MariaDB",
    "AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform", "Jenkins", "Ansible", "CI/CD", "Cloudflare",
    "Git", "GitHub", "GitLab", "Bitbucket", "Jira", "Confluence", "Postman", "Swagger", "Kafka", "RabbitMQ", "GraphQL", "REST API", "gRPC", "Microservices",
    "Jest", "Cypress", "Selenium", "Playwright", "Mocha", "Chai", "PyTest",
    "Pandas", "NumPy", "Scikit-Learn", "TensorFlow", "PyTorch", "Keras", "OpenCV", "NLTK", "Spacy", "Tableau", "Power BI",
    "Linux", "Unix", "Bash", "Shell", "Nginx", "Apache", "Vite", "Webpack", "Babel"
  ];

  const foundSkillsSet = new Set();
  TECH_KEYWORDS.forEach(tech => {
    if (safeMatchKeyword(sanitized, tech)) {
      foundSkillsSet.add(tech);
    }
  });

  // 3. Section Segmentation
  const sections = {
    summary: [],
    experience: [],
    education: [],
    projects: [],
    skills: [],
    certifications: [],
    activities: []
  };

  let currentSection = 'summary';

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    if (/^(work\s+)?experience|employment|work\s+history/i.test(line) && line.length < 35) {
      currentSection = 'experience'; continue;
    }
    if (/^education|academic|qualifications/i.test(line) && line.length < 35) {
      currentSection = 'education'; continue;
    }
    if (/^projects|personal\s+projects|academic\s+projects/i.test(line) && line.length < 35) {
      currentSection = 'projects'; continue;
    }
    if (/^skills|technical\s+skills|core\s+competencies|technologies/i.test(line) && line.length < 35) {
      currentSection = 'skills'; continue;
    }
    if (/^certificat(ions|es)|courses|licenses/i.test(line) && line.length < 35) {
      currentSection = 'certifications'; continue;
    }
    if (/^activities|achievements|leadership|honors|awards/i.test(line) && line.length < 35) {
      currentSection = 'activities'; continue;
    }
    if (/^summary|about\s+me|profile|objective/i.test(line) && line.length < 35) {
      currentSection = 'summary'; continue;
    }

    sections[currentSection].push(line);
  }

  // Parse Skills from Skills section text
  if (sections.skills.length > 0) {
    sections.skills.join(" ").split(/[,|/•\n]/).forEach(item => {
      const cleaned = item
        .replace(/^(technical\s+skills|skills|languages|frameworks|tools|databases|cloud):?/i, '')
        .replace(/^[-*•]\s*/, '')
        .replace(/[()]/g, '')
        .trim();
      if (cleaned && cleaned.length > 1 && cleaned.length < 35) {
        foundSkillsSet.add(cleaned);
      }
    });
  }

  // Summary
  const summaryText = sections.summary
    .filter(l => !l.includes(email) && !l.includes(name))
    .join(" ").trim();

  // Experience
  const expItems = [];
  let currentExp = null;

  // Only parse experience if sections.experience has explicit items
  if (sections.experience.length > 0) {
    sections.experience.forEach(line => {
      const isHeader = /engineer|developer|intern|analyst|manager|consultant|associate|lead|at\s+[A-Z]|(?:20\d\d|19\d\d)/i.test(line) && !line.startsWith('-') && !line.startsWith('•') && !line.startsWith('*');
      if (isHeader) {
        if (currentExp && (currentExp.title || currentExp.company)) expItems.push(currentExp);
        const parts = line.split(/\sat\s|\s-\s|\s\|\s/i);
        const companyPart = parts[1]?.trim();
        currentExp = {
          title: parts[0]?.trim() || line,
          company: companyPart || "",
          duration: line.match(/(?:20\d\d|19\d\d|\bPresent\b|\bCurrent\b).*/i)?.[0] || "",
          isInternship: /intern\b/i.test(line),
          bullets: []
        };
      } else if (currentExp) {
        const cleanBullet = line.replace(/^[•\-\*]\s*/, '').trim();
        if (cleanBullet) currentExp.bullets.push(cleanBullet);
      }
    });
    if (currentExp && (currentExp.title || currentExp.company)) expItems.push(currentExp);
  }

  // Projects
  const projItems = [];
  let currentProj = null;

  const ACTION_VERBS_REGEX = /^(built|developed|created|implemented|designed|used|managed|led|added|worked|integrated|engineered|crafted|wrote|spearheaded|architected|configured|automated|deployed|optimized|maintained|analyzed|refactored|established)\b/i;

  const projectLines = sections.projects.length > 0 ? sections.projects : [];

  projectLines.forEach(line => {
    const cleanLine = line.trim();
    if (!cleanLine || /^projects|^personal\s+projects|^academic\s+projects/i.test(cleanLine)) return;

    const isBulletLine = /^[•\-\*\d+\.]/.test(cleanLine) || ACTION_VERBS_REGEX.test(cleanLine);
    const isProjHeader = !isBulletLine && cleanLine.length < 80;

    if (isProjHeader) {
      // Discard conversational artifacts or stray sentences from becoming project headers
      if (isConversationalArtifact(cleanLine)) return;

      if (currentProj && currentProj.name && currentProj.bullets.length > 0) {
        projItems.push(currentProj);
      }

      const title = cleanRepoOrProjectName(cleanLine);
      const projTech = Array.from(foundSkillsSet).filter(tech =>
        safeMatchKeyword(cleanLine, tech)
      );

      currentProj = {
        name: title,
        description: cleanLine,
        tech: projTech,
        link: cleanLine.match(/github\.com\/[\w-]+|https?:\/\/[\w.-]+/i)?.[0] || "",
        bullets: []
      };
    } else if (currentProj) {
      const cleanBullet = cleanLine.replace(/^[•\-\*\d+\.]\s*/, '').trim();
      if (cleanBullet) {
        currentProj.bullets.push(cleanBullet);
        TECH_KEYWORDS.forEach(tech => {
          if (safeMatchKeyword(cleanBullet, tech)) {
            if (!currentProj.tech.includes(tech)) currentProj.tech.push(tech);
          }
        });
      }
    }
  });

  if (currentProj && currentProj.name && currentProj.bullets.length > 0) {
    projItems.push(currentProj);
  }

  // Education
  const eduItems = [];
  const eduSource = sections.education.length > 0
    ? sections.education
    : rawLines.filter(l => /b\.tech|b\.e|b\.s|m\.tech|m\.s|bachelor|master|degree|university|college|institute|cgpa|gpa/i.test(l));

  const allEduText = sections.education.length > 0 ? sections.education.join(" ") : sanitized;
  const detectedGpa = extractVerbatimGpa(allEduText);

  eduSource.forEach(line => {
    if (/b\.tech|b\.e|b\.s|m\.tech|m\.s|bachelor|master|degree|diploma|phd|high school/i.test(line)) {
      const lineGpa = extractVerbatimGpa(line) || detectedGpa;
      eduItems.push({
        degree: line.split(/[,|–-]/)[0]?.trim() || line,
        institution: line.includes("at") ? line.split("at")[1].trim() : (line.includes(",") ? line.split(",")[1]?.trim() : "University"),
        year: line.match(/20\d\d|19\d\d/)?.[0] || "2024",
        gpa: lineGpa
      });
    }
  });

  if (eduItems.length === 0 && detectedGpa) {
    eduItems.push({
      degree: "Bachelor of Technology",
      institution: "University",
      year: "2024",
      gpa: detectedGpa
    });
  }

  return normalizeProfile({
    name,
    email,
    phone,
    linkedin,
    github,
    location: "",
    summary: summaryText,
    skills: Array.from(foundSkillsSet),
    experience: expItems, // Guaranteed: EMPTY ARRAY for students/freshers!
    education: eduItems,
    projects: projItems, // Guaranteed: EMPTY ARRAY if no genuine projects!
    certifications: sections.certifications.map(l => l.replace(/^[•\-\*]\s*/, '')),
    activities: sections.activities.map(l => l.replace(/^[•\-\*]\s*/, '')),
    github_repos: projItems.map(p => p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  });
}

/**
 * Deterministic Mock Target Lens (Pass 2 fallback)
 */
function mockTargetLens(profile, companyProfile, targetRole = "Software Engineer", jd = "") {
  const isFresher = (profile.experience || []).length === 0 ||
    profile.experience.every(e => e.isInternship || (e.months && e.months < 3) || /intern\b/i.test(e.title || ""));
  const mode = isFresher ? "fresher" : "experienced";

  const companyStack = (companyProfile?.stack || ["Java", "Python", "React", "Node.js"]).map(s => String(s));
  const candidateSkills = (profile.skills || []).map(s => s.toLowerCase());

  const gap_map = companyStack.map(skill => {
    const hasSkill = candidateSkills.some(cs => cs.includes(skill.toLowerCase()) || skill.toLowerCase().includes(cs));
    return {
      skill,
      status: hasSkill ? "strong" : "missing",
      suggestion: hasSkill
        ? `Highlight deep architectural usage of ${skill} in your project bullet points.`
        : `Build a focused demo or microservice demonstrating production ${skill} patterns.`
    };
  });

  const audit = [];
  if (profile.projects.length === 0) {
    audit.push("No verified technical projects found — add at least 1-2 production-grade applications.");
  } else {
    audit.push("Strengthen action verbs across project bullets with measurable metrics and scale.");
  }
  if (!profile.summary) {
    audit.push(`Add a concise professional summary tailored to ${companyProfile?.name || 'target company'}'s hiring culture.`);
  }

  const primaryProj = profile.projects[0]?.name || "primary project";
  const questions = [
    `What quantifiable metric (e.g. latency, users, data records) can you specify for ${primaryProj}?`,
    `What specific testing, CI/CD, or deployment tools did you utilize?`,
    `What was your single greatest technical challenge and how did you resolve it?`
  ];

  const targetKeywords = [
    ...(companyProfile?.stack || []),
    ...(companyProfile?.keywords || [])
  ];
  const ml_match_score = calculateCosineSimilarity(profile.skills || [], targetKeywords);

  return {
    mode,
    ml_match_score,
    audit,
    questions,
    gap_map: gap_map.slice(0, 12),
    keywords: companyProfile?.keywords || ["scalable", "performance", "architecture", "APIs"],
    company_tone_tips: [
      companyProfile?.tone || "Professional and impact-oriented",
      `Emphasize: ${(companyProfile?.emphasis || ["practical problem solving"]).join(", ")}`,
      `Avoid: ${(companyProfile?.avoidWords || ["unverified claims"]).join(", ")}`
    ],
    matched_projects: (profile.projects || []).slice(0, 3).map(p => ({
      name: p.name,
      description: p.description || "",
      tech: p.tech || [],
      relevance: `Aligns with ${companyProfile?.name || 'target company'} standards`
    }))
  };
}

// ── MOCK FALLBACK ENGINE ───────────────────────────────────────────────────
// Used when no API key is provided or as fallback — returns parsed user data or realistic demo data

function mockUnderstand(rawText, targetCompany, mode, targetRole = "", jd = "") {
  const { getCompanyProfile } = require("./companyProfiles");
  const compProf = getCompanyProfile(targetCompany);

  // If user provided raw text and didn't request a fixed demo preset, parse their actual resume!
  if (rawText && rawText.trim() && mode !== "fresher" && mode !== "experienced") {
    const sanitized = sanitizeResumeText(rawText);
    const parsed = parseResumeText(sanitized);
    if (parsed) {
      const lens = mockTargetLens(parsed, compProf, targetRole, jd);
      return {
        profile: parsed,
        ml_match_score: lens.ml_match_score ?? 0,
        mode: lens.mode,
        audit: lens.audit,
        questions: lens.questions,
        gap_map: lens.gap_map,
        keywords: lens.keywords,
        company_tone_tips: lens.company_tone_tips,
        matched_projects: lens.matched_projects,
        rawText: sanitized
      };
    }
  }

  const isFresher = mode === "fresher" || (rawText || "").toLowerCase().includes("student") || (rawText || "").toLowerCase().includes("fresher");
  
  if (isFresher) {
    const demoProfile = normalizeProfile({
      name: "Priya Sharma",
      email: "priya.sharma@gmail.com",
      phone: "+91-9876543210",
      linkedin: "linkedin.com/in/priyasharma",
      github: "github.com/priyasharma",
      location: "Chennai, Tamil Nadu",
      summary: "Computer Science graduate with focus on full-stack web applications and systems engineering.",
      skills: ["Python", "Java", "HTML", "CSS", "JavaScript", "MySQL", "Git", "Flask"],
      experience: [], // Guaranteed: empty array for fresher demo!
      education: [{
        degree: "B.Tech Computer Science Engineering",
        institution: "SRM Institute of Science and Technology",
        year: "2024",
        gpa: "8.2/10",
        coursework: ["Data Structures", "Algorithms", "DBMS", "Operating Systems"]
      }],
      projects: [{
        name: "Library Management System",
        description: "Built a CRUD web application for managing library books using Python Flask and MySQL",
        tech: ["Python", "Flask", "MySQL", "HTML", "CSS"],
        link: "github.com/priyasharma/library-mgmt",
        bullets: [
          "Built backend with Flask handling 200+ book records",
          "Designed MySQL schema with 5 normalized tables",
          "Implemented search and filter queries optimizing response times"
        ]
      }],
      certifications: ["Python for Everybody — Coursera"],
      activities: ["Coding Club Member", "College Hackathon Participant"],
      github_repos: ["library-mgmt", "portfolio-website"]
    });

    const lens = mockTargetLens(demoProfile, compProf, targetRole, jd);
    return {
      profile: demoProfile,
      ml_match_score: lens.ml_match_score ?? 0,
      mode: "fresher",
      audit: lens.audit,
      questions: lens.questions,
      gap_map: lens.gap_map,
      keywords: lens.keywords,
      company_tone_tips: lens.company_tone_tips,
      matched_projects: lens.matched_projects,
      rawText: rawText || ""
    };
  } else {
    const expProfile = {
      name: "Arjun Mehta",
      email: "arjun.mehta@gmail.com",
      phone: "+91-9123456789",
      linkedin: "linkedin.com/in/arjunmehta",
      github: "github.com/arjunmehta",
      location: "Bengaluru, Karnataka",
      summary: "Software developer with 2 years of experience building scalable web applications.",
      skills: ["JavaScript", "React", "Node.js", "Python", "AWS", "PostgreSQL", "Docker", "TypeScript"],
      experience: [{
        title: "Software Development Engineer",
        company: "TechStartup Pvt Ltd",
        duration: "June 2022 - Present",
        months: 24,
        isInternship: false,
        bullets: [
          "Worked on the backend API for the product",
          "Helped fix bugs in the frontend React codebase",
          "Was responsible for database optimization tasks",
          "Assisted in migrating to AWS"
        ]
      }],
      education: [{
        degree: "B.Tech Computer Science",
        institution: "NIT Trichy",
        year: "2022",
        gpa: "8.5/10",
        coursework: []
      }],
      projects: [{
        name: "E-commerce Platform",
        description: "Built a full-stack e-commerce platform with React and Node.js",
        tech: ["React", "Node.js", "PostgreSQL", "AWS S3", "Stripe"],
        link: "github.com/arjunmehta/ecommerce",
        bullets: ["Handles 1000 monthly active users", "Integrated Stripe payment processing"]
      }],
      certifications: ["AWS Solutions Architect Associate"],
      activities: [],
      github_repos: ["ecommerce-platform", "react-dashboard", "api-gateway"]
    };

    const lens = mockTargetLens(expProfile, compProf, targetRole, jd);
    return {
      profile: expProfile,
      ml_match_score: lens.ml_match_score ?? 0,
      mode: "experienced",
      audit: [
        "Critical: All 4 experience bullets use weak verbs ('worked on', 'helped', 'was responsible for', 'assisted') — Amazon will reject these immediately",
        "Missing quantified impact: No metrics, no scale numbers, no business outcomes",
        "Summary is generic — must align with Amazon's Leadership Principles",
        "AWS migration bullet needs specifics: what was migrated, what improved?"
      ],
      questions: [
        "What was the exact impact of your database optimization? (e.g., query time reduced from X ms to Y ms, or cost reduced by $Z/month)",
        "What was the scale of the AWS migration? (services migrated, users affected, uptime improvement)",
        "For your e-commerce platform, what was peak traffic and what business metrics improved after launch?"
      ],
      gap_map: lens.gap_map,
      keywords: lens.keywords,
      company_tone_tips: lens.company_tone_tips,
      matched_projects: lens.matched_projects,
      rawText: rawText || ""
    };
  }
}

function mockAnalyze(profile, companyProfile, mode, liveGithubRepos = []) {
  const isAmazon = companyProfile.name.toLowerCase().includes("amazon");
  
  const keywords = isAmazon
    ? ["customer obsession", "ownership", "scalability", "microservices", "AWS", "TypeScript", "Python", "CI/CD", "metrics", "distributed systems", "Kafka", "DynamoDB", "Lambda", "REST APIs", "Docker"]
    : ["product", "built from scratch", "ownership", "JavaScript", "React", "Node.js", "MySQL", "Python", "Java", "REST APIs", "full-stack", "performance", "user experience", "shipped", "optimized"];

  const profileSkills = (profile.skills || []).map(s => s.toLowerCase());
  const allTargetSkills = companyProfile.stack || [];
  
  const gapMap = allTargetSkills.slice(0, 12).map(skill => {
    const sl = skill.toLowerCase();
    if (profileSkills.some(ps => ps.includes(sl) || sl.includes(ps))) {
      return { skill, status: "strong", suggestion: "" };
    } else if (mode === "fresher" && ["html", "css", "git"].some(s => sl.includes(s))) {
      return { skill, status: "weak", suggestion: `Build a project demonstrating ${skill} with measurable outcomes` };
    } else {
      return { skill, status: "missing", suggestion: `Complete a ${skill} project: e.g., build a simple ${skill === "Docker" ? "containerized microservice" : skill + " application"} and deploy it` };
    }
  });

  const companyStack = companyProfile.stack.map(s => s.toLowerCase());
  let matchedRepos = [];
  if (Array.isArray(liveGithubRepos) && liveGithubRepos.length > 0) {
    matchedRepos = liveGithubRepos.filter(repo => {
      const lang = (repo.language || "").toLowerCase();
      const topics = (repo.topics || []).map(t => t.toLowerCase());
      const desc = (repo.description || "").toLowerCase();
      return companyStack.some(cs => lang.includes(cs) || cs.includes(lang) || topics.some(t => t.includes(cs)) || desc.includes(cs));
    });
  }

  return {
    keywords,
    gap_map: gapMap,
    company_tone_tips: companyProfile.coreValues?.slice(0, 3).map(v => `Align bullet points with "${v}" principle`) || [],
    jd_extracted_stack: [],
    matched_projects: matchedRepos
  };
}

function mockBuild(profile, companyProfile, mode, modeConfig, keywords) {
  const isAmazon = companyProfile.name.toLowerCase().includes("amazon");
  const isFresher = mode === "fresher";

  if (!isFresher && isAmazon) {
    // Experienced + Amazon mock
    const resume = {
      header: {
        name: profile.name || "Arjun Mehta",
        email: profile.email || "arjun.mehta@gmail.com",
        phone: profile.phone || "+91-9123456789",
        linkedin: profile.linkedin || "linkedin.com/in/arjunmehta",
        github: profile.github || "github.com/arjunmehta",
        location: profile.location || "Bengaluru, Karnataka"
      },
      summary: "Results-driven Software Development Engineer with 2+ years of experience building scalable, customer-obsessed solutions. Proven track record of delivering high-impact systems serving 1,000+ MAU with strong ownership across full SDLC. Seeking to leverage expertise in AWS, React, and distributed systems at Amazon.",
      skills: {
        Languages: ["JavaScript", "TypeScript", "Python", "SQL"],
        Frameworks: ["React", "Node.js", "Express.js"],
        Tools: ["Docker", "Git", "CI/CD", "Stripe API"],
        Databases: ["PostgreSQL", "Redis"],
        Cloud: ["AWS (S3, EC2, Lambda)", "Microservices"]
      },
      experience: [{
        title: "Software Development Engineer",
        company: "TechStartup Pvt Ltd",
        duration: "June 2022 – Present",
        bullets: [
          "Architected and delivered RESTful backend APIs serving 1,000+ monthly active users with 99.9% uptime, reducing average API response time by 40%",
          "Drove database query optimization initiative, reducing critical query latency from 800ms to 120ms (85% improvement) and cutting monthly DB costs by 30%",
          "Owned end-to-end AWS cloud migration of 3 core services (EC2, S3, Lambda), achieving zero-downtime cutover and improving deployment frequency from weekly to daily",
          "Engineered React frontend components adopted across 5 product modules, improving developer velocity by 25% through reusable component library"
        ]
      }],
      education: [{
        degree: "B.Tech Computer Science",
        institution: "NIT Trichy",
        year: "2022",
        gpa: "8.5/10",
        relevantCoursework: ["Distributed Systems", "Data Structures", "Algorithms", "Database Management"]
      }],
      projects: [{
        name: "E-Commerce Platform",
        tech: ["React", "Node.js", "PostgreSQL", "AWS S3", "Stripe"],
        link: "github.com/arjunmehta/ecommerce",
        bullets: [
          "Built full-stack e-commerce platform from zero to launch, scaling to 1,000 monthly active users within 3 months",
          "Integrated Stripe payment processing, enabling $50K+ in annual transaction volume with PCI-compliant implementation",
          "Deployed on AWS with auto-scaling configuration, maintaining sub-200ms p95 response times under peak load"
        ]
      }],
      certifications: ["AWS Solutions Architect Associate"]
    };

    const bullets = [
      { section: "experience", text: "Architected and delivered RESTful backend APIs serving 1,000+ monthly active users", source_quote: "Handles 1000 monthly active users" },
      { section: "experience", text: "Drove database query optimization initiative, reducing latency by 85%", source_quote: "Was responsible for database optimization tasks" },
      { section: "experience", text: "Owned end-to-end AWS cloud migration of 3 core services", source_quote: "Assisted in migrating to AWS" },
      { section: "experience", text: "Engineered React frontend components across 5 product modules", source_quote: "Helped fix bugs in the frontend React codebase" },
      { section: "projects", text: "Built full-stack e-commerce platform scaling to 1,000 MAU in 3 months", source_quote: "Handles 1000 monthly active users" },
      { section: "projects", text: "Integrated Stripe payment processing", source_quote: "Integrated Stripe payment processing" }
    ];

    const changes_explained = [
      { original: "Worked on the backend API for the product", updated: "Architected and delivered RESTful backend APIs serving 1,000+ monthly active users with 99.9% uptime", reason: "Amazon's LP 'Deliver Results' requires quantified outcomes. Added scale (1,000 MAU), reliability (99.9% uptime), and strong ownership verb 'Architected'." },
      { original: "Helped fix bugs in the frontend React codebase", updated: "Engineered React frontend components adopted across 5 product modules, improving developer velocity by 25%", reason: "'Helped' signals low ownership — Amazon values individual ownership. Reframed as initiative with measurable team impact." },
      { original: "Was responsible for database optimization tasks", updated: "Drove database query optimization, reducing latency from 800ms to 120ms (85% improvement) and cutting DB costs by 30%", reason: "'Responsible for' is passive. Amazon wants specific, measurable improvements. Added before/after metrics per LP 'Bias for Action'." },
      { original: "Assisted in migrating to AWS", updated: "Owned end-to-end AWS cloud migration of 3 core services with zero-downtime cutover", reason: "'Assisted' suggests minimal impact. 'Owned' aligns with LP 'Ownership'. Specified scope (3 services) and outcome (zero downtime)." }
    ];

    return { resume, changes_explained, bullets };
  } else {
    // Fresher + Zoho mock
    const resume = {
      header: {
        name: profile.name || "Priya Sharma",
        email: profile.email || "priya.sharma@gmail.com",
        phone: profile.phone || "+91-9876543210",
        linkedin: profile.linkedin || "linkedin.com/in/priyasharma",
        github: profile.github || "github.com/priyasharma",
        location: profile.location || "Chennai, Tamil Nadu"
      },
      summary: "Passionate CS graduate who builds real products from scratch. Shipped a full-stack library management system handling 500+ records with zero budget. Self-taught in React and Node.js through personal projects. Eager to build user-centric products at Zoho.",
      skills: {
        Languages: ["Python", "Java", "JavaScript", "SQL", "HTML", "CSS"],
        Frameworks: ["Flask", "React (self-taught)", "Node.js (basics)"],
        Tools: ["Git", "GitHub", "VS Code", "Postman"],
        Databases: ["MySQL", "SQLite"],
        Cloud: []
      },
      experience: [],
      education: [{
        degree: "B.Tech Computer Science",
        institution: "SRM Institute of Science and Technology",
        year: "2024",
        gpa: "8.2/10",
        relevantCoursework: ["Data Structures & Algorithms", "Database Management Systems", "Operating Systems", "Web Technologies"]
      }],
      projects: [{
        name: "Library Management System",
        tech: ["Python", "Flask", "MySQL", "HTML", "CSS"],
        link: "github.com/priyasharma/library-mgmt",
        bullets: [
          "Built full-stack library management system from scratch handling 500+ book records across 5 normalized MySQL tables",
          "Designed RESTful API with Flask handling 200+ daily operations (add/search/return) with sub-100ms response time",
          "Shipped to 3 department librarians, reducing book search time from 15 minutes (manual) to under 30 seconds"
        ]
      },
      {
        name: "Personal Portfolio Website",
        tech: ["HTML", "CSS", "JavaScript"],
        link: "github.com/priyasharma/portfolio",
        bullets: [
          "Designed and shipped responsive portfolio from scratch, achieving 95/100 Google PageSpeed score",
          "Built with pure HTML/CSS/JS — no frameworks — demonstrating foundational web skills"
        ]
      }],
      certifications: ["Python for Everybody — Coursera (University of Michigan)", "SQL for Data Science — Coursera"]
    };

    const bullets = [
      { section: "projects", text: "Built full-stack library management system from scratch handling 500+ book records", source_quote: "Built a CRUD web application for managing library books" },
      { section: "projects", text: "Shipped to 3 department librarians, reducing search time from 15 minutes to 30 seconds", source_quote: "Participated in college hackathon" },
      { section: "projects", text: "Designed RESTful API with Flask handling 200+ daily operations", source_quote: "Built backend with Flask handling 200+ book records" }
    ];

    const changes_explained = [
      { original: "Computer Science student with interest in web development", updated: "Passionate CS graduate who builds real products from scratch", reason: "Zoho values builders over learners. Changed 'interest' (passive) to 'builds' (active). 'From scratch' is a Zoho culture keyword." },
      { original: "Built backend with Flask handling 200+ book records", updated: "Built full-stack library management system handling 500+ records with sub-100ms response time", reason: "Added performance metric (sub-100ms) and scope (500+ records) to demonstrate engineering rigor valued at Zoho." },
      { original: "Designed MySQL schema with 5 normalized tables", updated: "Designed RESTful API + MySQL schema (5 normalized tables) processing 200+ daily operations", reason: "Added operational context (200+ daily operations) to show the system is actively used, proving product-building vs. just coding." }
    ];

    return { resume, changes_explained, bullets };
  }
}

module.exports = {
  initGemini,
  callUnderstand,
  callPass1Extract,
  callPass2TargetLens,
  callAnalyze,
  callBuild,
  mockUnderstand,
  mockAnalyze,
  mockBuild,
  mockTargetLens,
  calculateCosineSimilarity,
  sanitizeResumeText,
  parseResumeText,
  normalizeProfile
};
