// Gemini AI Integration — 3 LLM Calls
const { GoogleGenerativeAI } = require("@google/generative-ai");

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
  return JSON.parse(cleaned);
}

function getModel(modelName = "gemini-1.5-flash") {
  if (!genAI) throw new Error("NO_API_KEY");
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.3,
    }
  });
}

// ── CALL 1: Understand ─────────────────────────────────────────────────────
// Parses resume/text and drafts smart questions
async function callUnderstand(rawText, targetCompany, targetRole) {
  const model = getModel();
  const prompt = `
You are a senior technical recruiter and resume analyst. Parse this resume/profile text and extract structured data.

RAW INPUT:
"""
${rawText}
"""

Target Company: ${targetCompany}
Target Role: ${targetRole || "Software Engineer"}

Return ONLY valid JSON matching this exact schema:
{
  "profile": {
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
        "months": number,
        "isInternship": boolean,
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
  },
  "mode": "fresher OR experienced",
  "audit": ["string — specific issues found in the resume"],
  "questions": ["string — max 3 smart questions to gather missing data"]
}

Mode detection rules:
- "fresher" if experience array is empty OR all entries are internships < 3 months
- "experienced" if ANY non-internship role OR internship >= 3 months exists

PROJECT EXTRACTION RULES:
- Extract projects as single objects. Do not split bullet points into separate project names.
- The 'Project Name' must be the overarching title.
- 'Tech Stack' (tech) must be an array of technologies used. Ignore raw bullet descriptions in this array.

Audit rules: flag weak verbs, missing metrics, thin sections, generic descriptions.
Questions: ask only about missing quantifiable data or key projects. Max 3 questions.
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return cleanAndParseJSON(text);
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

  const words = s.split(/\s+/).filter(Boolean);
  if (words.length > 4) {
    s = words.slice(0, 3).join(" ");
  }

  return s || "Software Project";
}

function parseResumeText(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  const rawLines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return null;

  // 1. Header & Contacts
  const name = rawLines[0].replace(/^(curriculum vitae|resume|cv)/i, '').trim() || "Candidate Name";
  const emailMatch = rawText.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : "";
  const phoneMatch = rawText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d{10,12}/);
  const phone = phoneMatch ? phoneMatch[0] : "";
  const linkedinMatch = rawText.match(/(?:linkedin\.com\/in\/[\w-]+|[a-zA-Z0-9-]+\.linkedin\.com)/i);
  const linkedin = linkedinMatch ? linkedinMatch[0] : "";
  const githubMatch = rawText.match(/(?:github\.com\/[\w-]+)/i);
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
    const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(?:^|[^a-zA-Z0-9_])${escaped}(?:$|[^a-zA-Z0-9_])`, 'i').test(rawText)) {
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
    sections.skills.join(" ").split(/[,|/•\-\*\n]/).forEach(item => {
      const cleaned = item.replace(/^(technical\s+skills|skills|languages|frameworks|tools|databases|cloud):?/i, '').trim();
      if (cleaned && cleaned.length > 1 && cleaned.length < 30) {
        foundSkillsSet.add(cleaned);
      }
    });
  }

  // Summary
  const summaryText = sections.summary
    .filter(l => !l.includes(email) && !l.includes(name))
    .join(" ").trim() || "Software developer with technical experience.";

  // Experience
  const expItems = [];
  let currentExp = null;

  const expSource = sections.experience.length > 0
    ? sections.experience
    : rawLines.filter(l => !l.includes('@') && /engineer|developer|intern|analyst|manager|consultant|associate|lead/i.test(l));

  expSource.forEach(line => {
    const isHeader = /engineer|developer|intern|analyst|manager|consultant|associate|lead|at\s+[A-Z]|(?:20\d\d|19\d\d)/i.test(line) && !line.startsWith('-') && !line.startsWith('•') && !line.startsWith('*');
    if (isHeader) {
      if (currentExp) expItems.push(currentExp);
      const parts = line.split(/\sat\s|\s-\s|\s\|\s/i);
      currentExp = {
        title: parts[0]?.trim() || line,
        company: parts[1]?.trim() || "Company",
        duration: line.match(/(?:20\d\d|19\d\d|\bPresent\b|\bCurrent\b).*/i)?.[0] || "Present",
        bullets: []
      };
    } else if (currentExp) {
      const cleanBullet = line.replace(/^[•\-\*]\s*/, '').trim();
      if (cleanBullet) currentExp.bullets.push(cleanBullet);
    }
  });
  if (currentExp) expItems.push(currentExp);

  // Projects
  const projItems = [];
  let currentProj = null;

  const ACTION_VERBS_REGEX = /^(built|developed|created|implemented|designed|used|managed|led|added|worked|integrated|engineered|crafted|wrote|spearheaded|architected|configured|automated|deployed|optimized|maintained|analyzed|refactored|established)\b/i;

  sections.projects.forEach(line => {
    const cleanLine = line.trim();
    if (!cleanLine || /^projects|^personal\s+projects|^academic\s+projects/i.test(cleanLine)) return;

    const isBulletLine = /^[•\-\*\d+\.]/.test(cleanLine) || ACTION_VERBS_REGEX.test(cleanLine);
    const isProjHeader = !isBulletLine && cleanLine.length < 80;

    if (isProjHeader) {
      if (currentProj) projItems.push(currentProj);

      const title = cleanRepoOrProjectName(cleanLine);
      const projTech = Array.from(foundSkillsSet).filter(tech =>
        new RegExp(`\\b${tech.replace('+', '\\+')}\\b`, 'i').test(cleanLine)
      );

      currentProj = {
        name: title,
        description: cleanLine,
        tech: projTech.length > 0 ? projTech : Array.from(foundSkillsSet).slice(0, 4),
        link: cleanLine.match(/github\.com\/[\w-]+|https?:\/\/[\w.-]+/i)?.[0] || "",
        bullets: []
      };
    } else if (currentProj) {
      const cleanBullet = cleanLine.replace(/^[•\-\*\d+\.]\s*/, '').trim();
      if (cleanBullet) {
        currentProj.bullets.push(cleanBullet);
        TECH_KEYWORDS.forEach(tech => {
          if (new RegExp(`\\b${tech.replace('+', '\\+')}\\b`, 'i').test(cleanBullet)) {
            if (!currentProj.tech.includes(tech)) currentProj.tech.push(tech);
          }
        });
      }
    }
  });

  if (currentProj) projItems.push(currentProj);

  // Education
  const eduItems = [];
  const eduSource = sections.education.length > 0
    ? sections.education
    : rawLines.filter(l => /b\.tech|b\.e|b\.s|m\.tech|m\.s|bachelor|master|degree|university|college|institute|gpa/i.test(l));

  eduSource.forEach(line => {
    if (/b\.tech|b\.e|b\.s|m\.tech|m\.s|bachelor|master|degree|diploma|phd|high school/i.test(line) || eduItems.length === 0) {
      eduItems.push({
        degree: line,
        institution: line.includes("at") ? line.split("at")[1].trim() : "University",
        year: line.match(/20\d\d|19\d\d/)?.[0] || "2024",
        gpa: line.match(/gpa:?\s*[\d.]+/i)?.[0] || ""
      });
    }
  });

  return {
    name,
    email,
    phone,
    linkedin,
    github,
    location: "",
    summary: summaryText,
    skills: Array.from(foundSkillsSet),
    experience: expItems.length > 0 ? expItems : [{
      title: "Software Engineer",
      company: "Company",
      duration: "Present",
      bullets: rawLines.filter(l => /^[•\-\*]/.test(l)).map(l => l.replace(/^[•\-\*]\s*/, '')).slice(0, 4)
    }],
    education: eduItems.length > 0 ? eduItems : [{
      degree: "Bachelor of Technology",
      institution: "University",
      year: "2024",
      gpa: ""
    }],
    projects: projItems.length > 0 ? projItems : [{
      name: "Software Application",
      description: "Built software application",
      tech: Array.from(foundSkillsSet).slice(0, 4),
      link: "",
      bullets: rawLines.filter(l => /^[•\-\*]/.test(l)).map(l => l.replace(/^[•\-\*]\s*/, '')).slice(0, 3)
    }],
    certifications: sections.certifications.map(l => l.replace(/^[•\-\*]\s*/, '')),
    activities: sections.activities.map(l => l.replace(/^[•\-\*]\s*/, '')),
    github_repos: projItems.map(p => p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  };
}

// ── MOCK FALLBACK ENGINE ───────────────────────────────────────────────────
// Used when no API key is provided or as fallback — returns parsed user data or realistic demo data

function mockUnderstand(rawText, targetCompany, mode) {
  // If user provided raw text and didn't request a fixed demo preset, parse their actual resume!
  if (rawText && rawText.trim() && mode !== "fresher" && mode !== "experienced") {
    const parsed = parseResumeText(rawText);
    if (parsed) {
      const isFresher = (parsed.experience || []).length === 0;
      return {
        profile: parsed,
        mode: isFresher ? "fresher" : "experienced",
        audit: [
          "Action verbs need strengthening — add metrics to bullet points",
          "Ensure top technical skills are highlighted near the top",
          "Tailor your summary to match the target company's hiring priorities"
        ],
        questions: [
          "What quantifiable metrics or numbers can you add to your main projects/roles?",
          "What key tools or frameworks did you use in your most recent project?",
          "What specific impact or business result did your work achieve?"
        ]
      };
    }
  }

  const isFresher = mode === "fresher" || (rawText || "").toLowerCase().includes("student") || (rawText || "").toLowerCase().includes("fresher");
  
  if (isFresher) {
    return {
      profile: {
        name: "Priya Sharma",
        email: "priya.sharma@gmail.com",
        phone: "+91-9876543210",
        linkedin: "linkedin.com/in/priyasharma",
        github: "github.com/priyasharma",
        location: "Chennai, Tamil Nadu",
        summary: "Computer Science student with interest in web development and software engineering.",
        skills: ["Python", "Java", "HTML", "CSS", "JavaScript", "MySQL", "Git"],
        experience: [],
        education: [{
          degree: "B.Tech Computer Science",
          institution: "SRM Institute of Science and Technology",
          year: "2024",
          gpa: "8.2/10",
          coursework: ["Data Structures", "Algorithms", "DBMS", "Operating Systems"]
        }],
        projects: [{
          name: "Library Management System",
          description: "Built a CRUD web application for managing library books using Python and MySQL",
          tech: ["Python", "Flask", "MySQL", "HTML", "CSS"],
          link: "github.com/priyasharma/library-mgmt",
          bullets: ["Built backend with Flask handling 200+ book records", "Designed MySQL schema with 5 normalized tables"]
        }],
        certifications: ["Python for Everybody — Coursera"],
        activities: ["Coding Club Member", "Participated in college hackathon"],
        github_repos: ["library-mgmt", "portfolio-website", "todo-app"]
      },
      mode: "fresher",
      audit: [
        "Action verbs are weak — 'built' and 'designed' are fine but add impact numbers",
        "Missing metrics: How many users used your library system? Time saved?",
        "Projects section is thin — add 1-2 more substantial projects",
        "Summary is too generic — tailor it to Zoho's product-builder culture"
      ],
      questions: [
        "How many total users/records does your Library Management System handle?",
        "Did you deploy any project live? If yes, what was the traffic/usage?",
        "Have you participated in any hackathons or coding competitions? What was the result?"
      ]
    };
  } else {
    return {
      profile: {
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
      },
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
      ]
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
  callAnalyze,
  callBuild,
  mockUnderstand,
  mockAnalyze,
  mockBuild
};
