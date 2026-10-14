/**
 * CareerLens Schema Definitions — Strict Structured Outputs & Entity Grounding
 *
 * This module defines the formal TypeScript / JSDoc interfaces and JSON Schemas
 * for Pass 1 (Deterministic Resume Extraction) and Pass 2 (Target Lens & Gap Mapping).
 *
 * Grounding Invariants:
 * 1. Optional sections (experience, certifications, activities) MUST default to [] if absent.
 * 2. Numeric fields like CGPA/GPA must be extracted verbatim (never normalized or estimated).
 * 3. Conversational / instruction artifacts must never be parsed as project names.
 */

/**
 * @typedef {Object} WorkExperience
 * @property {string} title - Job or internship title (e.g., "Frontend Developer Intern").
 * @property {string} company - Organization or company name.
 * @property {string} [duration] - Period of employment as stated (e.g., "Jun 2023 - Aug 2023").
 * @property {number} [months] - Estimated duration in months.
 * @property {boolean} [isInternship] - True if explicitly an internship role.
 * @property {string[]} bullets - Verbatim bullet points describing achievements and responsibilities.
 */

/**
 * @typedef {Object} Education
 * @property {string} degree - Degree or certification title (e.g., "B.Tech in Information Technology").
 * @property {string} institution - College, university, or institute name.
 * @property {string} [year] - Year of graduation or range (e.g., "2024").
 * @property {string} [gpa] - Verbatim CGPA or GPA exactly as written (e.g., "7.11", "7.11/10", "3.8/4.0"). NEVER ESTIMATED OR ROUNDED.
 * @property {string[]} [coursework] - Relevant coursework explicitly mentioned.
 */

/**
 * @typedef {Object} Project
 * @property {string} name - Verified technical project title. Discards conversational noise.
 * @property {string} [description] - One-line overview of the technical work.
 * @property {string[]} tech - Array of technical skills, languages, or tools explicitly used in this project.
 * @property {string} [link] - URL or GitHub repo link if explicitly mentioned.
 * @property {string[]} bullets - Verified technical bullet points detailing implementation and metrics.
 */

/**
 * @typedef {Object} ExtractedProfile
 * @property {string} name - Candidate full name.
 * @property {string} email - Email address.
 * @property {string} phone - Contact telephone number.
 * @property {string} linkedin - LinkedIn profile URL or handle.
 * @property {string} github - GitHub profile URL or username.
 * @property {string} location - City / State / Country if stated.
 * @property {string} summary - Professional summary if present; empty string otherwise.
 * @property {string[]} skills - Array of technical skills explicitly listed in the resume.
 * @property {WorkExperience[]} experience - Work experience array. MUST BE [] FOR FRESHERS / STUDENTS.
 * @property {Education[]} education - Verified education array.
 * @property {Project[]} projects - Verified technical projects. MUST BE [] IF NO TECHNICAL PROJECTS EXIST.
 * @property {string[]} certifications - Certifications array. Defaults to [].
 * @property {string[]} activities - Extracurriculars, hackathons, or awards. Defaults to [].
 * @property {string[]} github_repos - Repository slugs derived from verified projects.
 */

/**
 * @typedef {Object} GapMapItem
 * @property {string} skill - Technology or competency evaluated.
 * @property {"strong"|"weak"|"missing"} status - Depth of candidate evidence.
 * @property {string} suggestion - Actionable guidance or project concept for bridging the gap.
 */

/**
 * @typedef {Object} TargetLensOutput
 * @property {"fresher"|"experienced"} mode - Automatically detected hiring mode.
 * @property {string[]} audit - Specific actionable issues detected in candidate's existing bullets.
 * @property {string[]} questions - Max 3 high-impact questions to gather missing quantifiable metrics.
 * @property {GapMapItem[]} gap_map - Detailed skill comparison against company stack and JD.
 * @property {string[]} keywords - Top ATS keywords for target company and role.
 * @property {string[]} company_tone_tips - 3 company-specific culture and presentation guidelines.
 * @property {Array<{name: string, description?: string, language?: string, tech?: string[], html_url?: string}>} matched_projects - Real candidate projects matching company stack.
 */

// ── Pass 1 JSON Schema (Gemini Structured Output) ──────────────────────────
const PROFILE_JSON_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    linkedin: { type: "string" },
    github: { type: "string" },
    location: { type: "string" },
    summary: { type: "string" },
    skills: {
      type: "array",
      items: { type: "string" }
    },
    experience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          company: { type: "string" },
          duration: { type: "string" },
          months: { type: "integer" },
          isInternship: { type: "boolean" },
          bullets: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["title", "company", "bullets"]
      }
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          degree: { type: "string" },
          institution: { type: "string" },
          year: { type: "string" },
          gpa: { type: "string" },
          coursework: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["degree", "institution"]
      }
    },
    projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          tech: {
            type: "array",
            items: { type: "string" }
          },
          link: { type: "string" },
          bullets: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["name", "bullets"]
      }
    },
    certifications: {
      type: "array",
      items: { type: "string" }
    },
    activities: {
      type: "array",
      items: { type: "string" }
    },
    github_repos: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["name", "skills", "experience", "education", "projects", "certifications", "activities"]
};

// ── Pass 2 JSON Schema (Gemini Structured Output) ──────────────────────────
const TARGET_LENS_JSON_SCHEMA = {
  type: "object",
  properties: {
    mode: { type: "string", enum: ["fresher", "experienced"] },
    audit: {
      type: "array",
      items: { type: "string" }
    },
    questions: {
      type: "array",
      items: { type: "string" }
    },
    gap_map: {
      type: "array",
      items: {
        type: "object",
        properties: {
          skill: { type: "string" },
          status: { type: "string", enum: ["strong", "weak", "missing"] },
          suggestion: { type: "string" }
        },
        required: ["skill", "status", "suggestion"]
      }
    },
    keywords: {
      type: "array",
      items: { type: "string" }
    },
    company_tone_tips: {
      type: "array",
      items: { type: "string" }
    },
    matched_projects: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          tech: {
            type: "array",
            items: { type: "string" }
          },
          relevance: { type: "string" }
        },
        required: ["name"]
      }
    }
  },
  required: ["mode", "audit", "questions", "gap_map", "keywords", "company_tone_tips"]
};

/**
 * Creates an empty, safely initialized profile structure.
 * Guaranteed: NO dummy entries, all lists default to empty arrays [].
 * @returns {ExtractedProfile}
 */
function createEmptyProfile() {
  return {
    name: "",
    email: "",
    phone: "",
    linkedin: "",
    github: "",
    location: "",
    summary: "",
    skills: [],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
    activities: [],
    github_repos: []
  };
}

/**
 * Cleans and normalizes an extracted profile:
 * - Enforces empty array [] defaults for all collection fields
 * - Purges placeholder/dummy companies (e.g., "Company", "Software Engineer")
 * - Sanitizes project names and strips conversational artifacts
 * @param {Partial<ExtractedProfile>} raw
 * @returns {ExtractedProfile}
 */
function normalizeProfile(raw = {}, fallbackText = "") {
  const empty = createEmptyProfile();
  if (!raw || typeof raw !== "object") return empty;

  // Filter out dummy/placeholder experiences (e.g., company === "Company" or title === "Software Engineer" with no bullets)
  const cleanedExperience = Array.isArray(raw.experience)
    ? raw.experience
        .filter(exp => {
          if (!exp || typeof exp !== "object") return false;
          const comp = (exp.company || "").trim().toLowerCase();
          const title = (exp.title || "").trim().toLowerCase();
          const bullets = Array.isArray(exp.bullets) ? exp.bullets.filter(b => typeof b === "string" && b.trim()) : [];
          // Discard mock placeholders
          if ((comp === "company" || comp === "placeholder") && bullets.length === 0) return false;
          if (title === "engineering experience: company" || title === "company") return false;
          return Boolean(exp.company || exp.title);
        })
        .map(exp => ({
          title: (exp.title || "").trim(),
          company: (exp.company || "").trim(),
          duration: (exp.duration || "").trim(),
          months: typeof exp.months === "number" ? exp.months : undefined,
          isInternship: Boolean(exp.isInternship || /intern\b/i.test(exp.title || "")),
          bullets: Array.isArray(exp.bullets) ? exp.bullets.map(b => String(b).trim()).filter(Boolean) : []
        }))
    : [];

  // Filter out invalid/conversational project names
  const cleanedProjects = Array.isArray(raw.projects)
    ? raw.projects
        .filter(proj => {
          if (!proj || typeof proj !== "object") return false;
          const name = (proj.name || "").trim().toLowerCase();
          if (!name) return false;
          // Filter out dummy or conversational artifacts
          if (name === "software application" || name === "software project" || name === "project 1") {
            const hasRealBullets = Array.isArray(proj.bullets) && proj.bullets.some(b => b && b.length > 15);
            if (!hasRealBullets) return false;
          }
          if (/^(every\s+one\s+of|this\s+is|please\s+refer|instructions?|evaluation|note\s+that)/i.test(name)) {
            return false;
          }
          return true;
        })
        .map(proj => ({
          name: (proj.name || "").trim(),
          description: (proj.description || "").trim(),
          tech: Array.isArray(proj.tech) ? proj.tech.map(t => String(t).trim()).filter(Boolean) : [],
          link: (proj.link || "").trim(),
          bullets: Array.isArray(proj.bullets) ? proj.bullets.map(b => String(b).trim()).filter(Boolean) : []
        }))
    : [];

  // Clean education
  const cleanedEducation = Array.isArray(raw.education)
    ? raw.education
        .filter(edu => edu && typeof edu === "object" && (edu.degree || edu.institution))
        .map(edu => ({
          degree: (edu.degree || "").trim(),
          institution: (edu.institution || "").trim(),
          year: (edu.year || "").trim(),
          gpa: (edu.gpa || "").trim(),
          coursework: Array.isArray(edu.coursework) ? edu.coursework.map(c => String(c).trim()).filter(Boolean) : []
        }))
    : [];

  // Fallback verbatim CGPA/GPA recovery if present in text but missed by LLM
  if (fallbackText && cleanedEducation.length > 0 && !cleanedEducation[0].gpa) {
    const gpaMatch = fallbackText.match(/\b(?:cgpa|gpa|grade|score|percentage)[:\s]*([0-9]+(?:\.[0-9]+)?(?:\s*\/\s*[0-9]+(?:\.[0-9]+)?)?%?)/i)
      || fallbackText.match(/([0-9]+\.[0-9]+(?:\s*\/\s*10)?)\s*(?:cgpa|gpa)/i);
    if (gpaMatch) {
      cleanedEducation[0].gpa = (gpaMatch[1] || gpaMatch[0]).trim();
    }
  }

  return {
    name: (raw.name || "").trim(),
    email: (raw.email || "").trim(),
    phone: (raw.phone || "").trim(),
    linkedin: (raw.linkedin || "").trim(),
    github: (raw.github || "").trim(),
    location: (raw.location || "").trim(),
    summary: (raw.summary || "").trim(),
    skills: Array.isArray(raw.skills) ? [...new Set(raw.skills.map(s => String(s).trim()).filter(Boolean))] : [],
    experience: cleanedExperience,
    education: cleanedEducation,
    projects: cleanedProjects,
    certifications: Array.isArray(raw.certifications) ? raw.certifications.map(c => String(c).trim()).filter(Boolean) : [],
    activities: Array.isArray(raw.activities) ? raw.activities.map(a => String(a).trim()).filter(Boolean) : [],
    github_repos: Array.isArray(raw.github_repos) ? raw.github_repos.map(r => String(r).trim()).filter(Boolean) : []
  };
}

module.exports = {
  PROFILE_JSON_SCHEMA,
  TARGET_LENS_JSON_SCHEMA,
  createEmptyProfile,
  normalizeProfile
};
