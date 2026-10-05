const path = require("path");

// Point dotenv to the root .env file
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const serverless = require("serverless-http");

const { getCompanyProfile, MODES, detectMode } = require("../../server/companyProfiles");
const { verifyBullets, revalidateBullet, scoreKeywords, auditInput, resumeToPlainText } = require("../../server/truthLock");
const {
  initGemini,
  callUnderstand,
  callAnalyze,
  callBuild,
  mockUnderstand,
  mockAnalyze,
  mockBuild
} = require("../../server/gemini");

const app = express();

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Multer for file uploads — memory storage (stateless)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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

  if (ext === ".txt") return file.buffer.toString("utf-8");

  if (ext === ".pdf") {
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(file.buffer);
    return data.text;
  }

  if (ext === ".docx" || ext === ".doc") {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  }

  throw new Error("Unsupported file type");
}

// ── Helper: Live GitHub Data Fetcher ───────────────────────────────────────
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

    if (!response.ok) return [];

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data
      .filter(repo => repo.fork === false)
      .map(repo => ({
        name: repo.name,
        description: repo.description || "",
        language: repo.language || "",
        topics: repo.topics || [],
        html_url: repo.html_url
      }));
  } catch (err) {
    console.warn("Error fetching GitHub repos:", err.message);
    return [];
  }
}

// ── Routes ─────────────────────────────────────────────────────────────────
// Note: routes use /api/* because Netlify redirects /api/* → /.netlify/functions/api/*
// serverless-http maps them accordingly

const router = express.Router();

// Health check
router.get("/health", (req, res) => {
  res.json({ status: "ok", version: "1.0.0", time: new Date().toISOString() });
});

// ENDPOINT 1: Understand
router.post("/understand", upload.single("resume"), async (req, res) => {
  try {
    let rawText = req.body.rawText || "";
    const { targetCompany = "other", targetRole = "", apiKey = "", demoMode } = req.body;

    if (req.file) {
      rawText = await extractTextFromFile(req.file);
      if (!rawText || !rawText.trim()) {
        return res.status(400).json({
          error: "Could not extract text from the uploaded file."
        });
      }
    }

    if (!rawText.trim() && !demoMode) {
      return res.status(400).json({ error: "No resume text or file provided" });
    }

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
      result = mockUnderstand(rawText, targetCompany, demoMode || "auto");
    }

    if (rawText) {
      const codeAudit = auditInput(rawText);
      result.audit = [...new Set([...(result.audit || []), ...codeAudit])];
    }
    result.rawText = rawText;

    res.json(result);
  } catch (err) {
    console.error("Understand error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// ENDPOINT 2: Analyze
router.post("/analyze", async (req, res) => {
  try {
    const { profile, targetCompany = "other", jd = "", mode = "fresher", apiKey = "" } = req.body;

    if (!profile) return res.status(400).json({ error: "Profile is required" });

    const companyProfile = getCompanyProfile(targetCompany);
    const githubInput = profile.github || req.body.github || "";
    const liveGithubRepos = await fetchGitHubRepos(githubInput);

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

// ENDPOINT 3: Build
router.post("/build", async (req, res) => {
  try {
    const {
      profile, targetCompany = "other", mode = "fresher",
      keywords = [], gapAnswers = {}, userAnswers = {},
      jd = "", rawText = "", apiKey = ""
    } = req.body;

    if (!profile) return res.status(400).json({ error: "Profile is required" });

    const companyProfile = getCompanyProfile(targetCompany);
    const modeConfig = MODES[mode] || MODES.fresher;

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

    const verifiedBullets = verifyBullets(llmResult.bullets || [], rawText, userAnswers);
    const resumePlainText = resumeToPlainText(llmResult.resume);
    const optimizedScore = scoreKeywords(resumePlainText, keywords);

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

// ENDPOINT: Re-validate single bullet
router.post("/revalidate", (req, res) => {
  try {
    const { bullet, rawText = "", userAnswers = {} } = req.body;
    if (!bullet) return res.status(400).json({ error: "Bullet is required" });
    const result = revalidateBullet(bullet, rawText, userAnswers);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ENDPOINT: Company Profile Info
router.get("/company/:key", (req, res) => {
  const profile = getCompanyProfile(req.params.key);
  res.json(profile);
});

// Mount all routes under /.netlify/functions/api
app.use("/.netlify/functions/api", router);

// Also mount under /api for local testing
app.use("/api", router);

// Error handling
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File exceeds 10MB limit." });
    }
    return res.status(400).json({ error: `File upload error: ${err.message}` });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
});

// Export serverless handler
module.exports.handler = serverless(app);
