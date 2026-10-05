require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");

const { getCompanyProfile, MODES, detectMode } = require("./companyProfiles");
const { verifyBullets, revalidateBullet, scoreKeywords, auditInput, resumeToPlainText } = require("./truthLock");
const {
  initGemini,
  callUnderstand,
  callAnalyze,
  callBuild,
  mockUnderstand,
  mockAnalyze,
  mockBuild
} = require("./gemini");

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Multer for file uploads — memory storage (stateless)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".docx", ".txt", ".doc"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error("Only PDF, DOCX, and TXT files are allowed"));
  }
});

// ── Helper: Extract text from uploaded file ────────────────────────────────
async function extractTextFromFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (ext === ".txt") {
    return file.buffer.toString("utf-8");
  }
  
  if (ext === ".pdf") {
    try {
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(file.buffer);
      return data.text;
    } catch (e) {
      throw new Error("Failed to parse PDF: " + e.message);
    }
  }
  
  if (ext === ".docx" || ext === ".doc") {
    try {
      const mammoth = require("mammoth");
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return result.value;
    } catch (e) {
      throw new Error("Failed to parse DOCX: " + e.message);
    }
  }
  
  throw new Error("Unsupported file type");
}

// ── Helper: Live GitHub Data Fetcher (Pre-AI Step) ────────────────────────
async function fetchGitHubRepos(githubUrlOrUsername) {
  if (!githubUrlOrUsername || typeof githubUrlOrUsername !== "string") return [];

  let username = githubUrlOrUsername.trim();
  username = username.replace(/^https?:\/\/(www\.)?github\.com\//i, "");
  username = username.replace(/\/.*$/, "").replace(/@/g, "").trim();

  if (!username) return [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=30`,
      {
        signal: controller.signal,
        headers: {
          "User-Agent": "CareerLens-AI-Resume-Builder",
          "Accept": "application/vnd.github.v3+json"
        }
      }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`GitHub API returned status ${response.status} for user ${username}`);
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    // Filter to exclude forks and map to clean array of objects
    const realRepos = data
      .filter(repo => repo.fork === false)
      .map(repo => ({
        name: repo.name,
        description: repo.description || "",
        language: repo.language || "",
        topics: repo.topics || [],
        html_url: repo.html_url
      }));

    return realRepos;
  } catch (err) {
    console.warn("Error fetching live GitHub repos:", err.message);
    return [];
  }
}

// ── Health Check ───────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "1.0.0", time: new Date().toISOString() });
});

// ── ENDPOINT 1: Understand ────────────────────────────────────────────────
// POST /api/understand
// Body: { rawText?, targetCompany, targetRole, apiKey? } OR multipart file
app.post("/api/understand", upload.single("resume"), async (req, res) => {
  try {
    let rawText = req.body.rawText || "";
    const { targetCompany = "other", targetRole = "", apiKey = "", demoMode } = req.body;

    // Extract text from uploaded file
    if (req.file) {
      rawText = await extractTextFromFile(req.file);
      if (!rawText || !rawText.trim()) {
        return res.status(400).json({
          error: "Could not extract text from the uploaded file. Please ensure it contains selectable text, or paste your resume content directly."
        });
      }
    }

    if (!rawText.trim() && !demoMode) {
      return res.status(400).json({ error: "No resume text or file provided" });
    }

    // Initialize Gemini if API key provided or set in env
    const effectiveKey = (apiKey && apiKey.trim()) || process.env.GEMINI_API_KEY || "";
    let result;
    if (effectiveKey) {
      initGemini(effectiveKey);
      try {
        result = await callUnderstand(rawText, targetCompany, targetRole);
      } catch (geminiErr) {
        console.warn("Gemini call failed, using mock:", geminiErr.message);
        result = mockUnderstand(rawText, targetCompany, demoMode || "auto");
      }
    } else {
      // Fallback mock engine
      result = mockUnderstand(rawText, targetCompany, demoMode || "auto");
    }

    // Code-based audit supplement (deterministic)
    if (rawText) {
      const codeAudit = auditInput(rawText);
      result.audit = [...new Set([...(result.audit || []), ...codeAudit])];
    }

    // Attach rawText to response (needed for Truth Lock later)
    result.rawText = rawText;

    res.json(result);
  } catch (err) {
    console.error("Understand error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ── ENDPOINT 2: Analyze ────────────────────────────────────────────────────
// POST /api/analyze
// Body: { profile, targetCompany, targetRole, jd, mode, apiKey? }
app.post("/api/analyze", async (req, res) => {
  try {
    const { profile, targetCompany = "other", jd = "", mode = "fresher", apiKey = "" } = req.body;

    if (!profile) {
      return res.status(400).json({ error: "Profile is required" });
    }

    const companyProfile = getCompanyProfile(targetCompany);
    
    // 4. Live GitHub Data Fetcher (Pre-AI Step)
    const githubInput = profile.github || req.body.github || "";
    const liveGithubRepos = await fetchGitHubRepos(githubInput);

    // Initialize Gemini if key provided or set in env
    const effectiveKey = (apiKey && apiKey.trim()) || process.env.GEMINI_API_KEY || "";
    let result;
    if (effectiveKey) {
      initGemini(effectiveKey);
      try {
        result = await callAnalyze(profile, companyProfile, jd, mode, liveGithubRepos);
      } catch (geminiErr) {
        console.warn("Gemini analyze failed, using mock:", geminiErr.message);
        result = mockAnalyze(profile, companyProfile, mode, liveGithubRepos);
      }
    } else {
      result = mockAnalyze(profile, companyProfile, mode, liveGithubRepos);
    }

    result.live_github_repos = liveGithubRepos;
    if (!result.matched_projects || result.matched_projects.length === 0) {
      const companyStack = companyProfile.stack.map(s => s.toLowerCase());
      if (liveGithubRepos.length > 0) {
        result.matched_projects = liveGithubRepos.filter(repo => {
          const lang = (repo.language || "").toLowerCase();
          const topics = (repo.topics || []).map(t => t.toLowerCase());
          const desc = (repo.description || "").toLowerCase();
          return companyStack.some(cs => lang.includes(cs) || cs.includes(lang) || topics.some(t => t.includes(cs)) || desc.includes(cs));
        });
      } else {
        result.matched_projects = (profile.projects || []).filter(proj => {
          const tech = (proj.tech || []).map(t => t.toLowerCase());
          return tech.some(t => companyStack.some(cs => cs.includes(t) || t.includes(cs)));
        });
      }
    }

    result.company_profile = {
      name: companyProfile.name,
      type: companyProfile.type,
      hiringStyle: companyProfile.hiringStyle,
      coreValues: companyProfile.coreValues,
      stack: companyProfile.stack,
      tone: companyProfile.tone,
      templateStyle: companyProfile.templateStyle
    };

    res.json(result);
  } catch (err) {
    console.error("Analyze error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ── ENDPOINT 3: Build ──────────────────────────────────────────────────────
// POST /api/build
// Body: { profile, targetCompany, mode, keywords, gapAnswers, userAnswers, jd, rawText, apiKey? }
app.post("/api/build", async (req, res) => {
  try {
    const {
      profile,
      targetCompany = "other",
      mode = "fresher",
      keywords = [],
      gapAnswers = {},
      userAnswers = {},
      jd = "",
      rawText = "",
      apiKey = ""
    } = req.body;

    if (!profile) {
      return res.status(400).json({ error: "Profile is required" });
    }

    const companyProfile = getCompanyProfile(targetCompany);
    const modeConfig = MODES[mode] || MODES.fresher;

    // Initialize Gemini if key provided or set in env
    const effectiveKey = (apiKey && apiKey.trim()) || process.env.GEMINI_API_KEY || "";
    let llmResult;
    if (effectiveKey) {
      initGemini(effectiveKey);
      try {
        llmResult = await callBuild(profile, companyProfile, mode, modeConfig, keywords, gapAnswers, userAnswers, jd);
      } catch (geminiErr) {
        console.warn("Gemini build failed, using mock:", geminiErr.message);
        llmResult = mockBuild(profile, companyProfile, mode, modeConfig, keywords);
      }
    } else {
      llmResult = mockBuild(profile, companyProfile, mode, modeConfig, keywords);
    }

    // ── DETERMINISTIC: Truth Lock Verification ────────────────────────────
    const verifiedBullets = verifyBullets(llmResult.bullets || [], rawText, userAnswers);

    // ── DETERMINISTIC: ATS Scoring ────────────────────────────────────────
    const resumePlainText = resumeToPlainText(llmResult.resume);
    const optimizedScore = scoreKeywords(resumePlainText, keywords);

    // Baseline score (original profile)
    const skillsArr = Array.isArray(profile.skills)
      ? profile.skills
      : (profile.skills && typeof profile.skills === "object")
        ? Object.values(profile.skills).flat()
        : [];

    const originalProfileText = [
      ...skillsArr,
      ...(profile.experience || []).flatMap(e => e.bullets || []),
      ...(profile.projects || []).flatMap(p => p.bullets || []),
      profile.summary || ""
    ].join(" ");
    const baselineScore = scoreKeywords(originalProfileText, keywords);

    res.json({
      resume: llmResult.resume,
      changes_explained: llmResult.changes_explained || [],
      bullets: verifiedBullets,
      ats: {
        baseline: baselineScore.score,
        optimized: Math.max(baselineScore.score, optimizedScore.score),
        matched: optimizedScore.matched,
        missing: optimizedScore.missing,
        baselineMatched: baselineScore.matched,
        baselineMissing: baselineScore.missing
      },
      mode,
      sectionOrder: modeConfig.order,
      plainText: resumePlainText
    });
  } catch (err) {
    console.error("Build error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ── ENDPOINT: Re-validate single bullet ───────────────────────────────────
// POST /api/revalidate
// Body: { bullet, rawText, userAnswers }
app.post("/api/revalidate", (req, res) => {
  try {
    const { bullet, rawText = "", userAnswers = {} } = req.body;
    if (!bullet) return res.status(400).json({ error: "Bullet is required" });

    const result = revalidateBullet(bullet, rawText, userAnswers);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ENDPOINT: Company Profile Info ────────────────────────────────────────
app.get("/api/company/:key", (req, res) => {
  const profile = getCompanyProfile(req.params.key);
  res.json(profile);
});

// ── Error Handling Middleware ──────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File exceeds 10MB limit. Please upload a smaller file." });
    }
    return res.status(400).json({ error: `File upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message || "An unexpected error occurred." });
  }
  next();
});

// ── Start Server ───────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🚀 CareerLens AI Server running on http://localhost:${PORT}`);
    console.log(`   Endpoints:`);
    console.log(`   POST /api/understand  — Parse resume + draft questions`);
    console.log(`   POST /api/analyze     — Company analysis + gap map`);
    console.log(`   POST /api/build       — Generate optimized resume`);
    console.log(`   POST /api/revalidate  — Re-validate single bullet\n`);
  });
}

module.exports = app;
