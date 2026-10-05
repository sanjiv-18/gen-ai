// Cached Company Profiles - Company Lens Engine
const COMPANY_PROFILES = {
  tcs: {
    name: "TCS (Tata Consultancy Services)",
    type: "IT Services / Outsourcing",
    tone: "professional, process-oriented, team-player",
    coreValues: ["Digital Transformation", "Agile Delivery", "Client Partnership", "Innovation at Scale"],
    stack: ["Java", "Spring Boot", "Python", "SAP", "Oracle", "SQL", "DevOps", "AWS", "Microservices", "REST APIs"],
    keywords: ["scalable", "enterprise", "agile", "delivery", "client", "stakeholder", "process", "automation", "digital transformation", "cross-functional"],
    hiringStyle: "Focuses on foundational CS skills, communication, team collaboration, and ability to work in large enterprise environments. Values candidates who can follow structured methodologies.",
    templateStyle: "clean",
    emphasis: ["teamwork", "process adherence", "communication", "scalability"],
    avoidWords: ["solo", "startup", "hacked", "quick fix"]
  },
  infosys: {
    name: "Infosys",
    type: "IT Services / Consulting",
    tone: "analytical, consulting-driven, learning-focused",
    coreValues: ["Client Value", "Leadership by Example", "Integrity", "Fairness", "Excellence"],
    stack: ["Java", "Python", ".NET", "Azure", "AWS", "Selenium", "React", "Angular", "SQL Server", "Kubernetes"],
    keywords: ["optimization", "consulting", "client engagement", "analytics", "enterprise solutions", "delivery excellence", "innovation", "data-driven"],
    hiringStyle: "Strong emphasis on analytical thinking, problem-solving aptitude, and continuous learning. Looks for candidates with strong fundamentals and growth mindset.",
    templateStyle: "clean",
    emphasis: ["analytics", "problem-solving", "continuous learning", "client focus"],
    avoidWords: ["unmaintainable", "quick hack", "workaround"]
  },
  zoho: {
    name: "Zoho Corporation",
    type: "Product-Based SaaS",
    tone: "product-minded, self-taught, builder, frugal innovation",
    coreValues: ["Build from scratch", "Privacy-first", "Long-term thinking", "Product ownership"],
    stack: ["Java", "JavaScript", "React", "Node.js", "Python", "MySQL", "Deluge", "REST APIs", "HTML/CSS", "Data Structures"],
    keywords: ["built", "designed", "architected", "ownership", "product", "from scratch", "optimized", "performance", "user experience", "shipped"],
    hiringStyle: "Highly values self-learners who built real things. Prefers people who understand products deeply over process followers. Looks for hustle, curiosity, and builder mentality.",
    templateStyle: "minimal",
    emphasis: ["building real products", "self-learning", "ownership", "performance optimization"],
    avoidWords: ["followed instructions", "assisted", "helped team"]
  },
  amazon: {
    name: "Amazon",
    type: "Big Tech / E-commerce / Cloud",
    tone: "data-driven, impact-focused, leadership-principles-aligned",
    coreValues: ["Customer Obsession", "Ownership", "Invent & Simplify", "Are Right, A Lot", "Bias for Action", "Deliver Results"],
    stack: ["Java", "Python", "AWS", "DynamoDB", "Lambda", "React", "TypeScript", "Kubernetes", "Microservices", "Redis", "Kafka"],
    keywords: ["reduced", "improved", "increased", "decreased", "drove", "delivered", "owned", "launched", "metrics", "KPIs", "latency", "throughput", "scale"],
    hiringStyle: "Obsessed with measurable impact and Leadership Principles. Every bullet must answer 'so what?' with a number. Ownership over individual contributions is critical.",
    templateStyle: "impact",
    emphasis: ["quantified impact", "leadership principles", "scale", "customer focus", "ownership"],
    avoidWords: ["responsible for", "helped", "worked on", "involved in", "team player"]
  },
  startup: {
    name: "Startup / Scale-up",
    type: "Early-Stage / Growth Startup",
    tone: "agile, generalist, impact-driven, fast-paced",
    coreValues: ["Move Fast", "Ownership", "Growth Mindset", "Versatility", "Ship It"],
    stack: ["React", "Node.js", "Python", "PostgreSQL", "MongoDB", "Docker", "AWS", "TypeScript", "GraphQL", "Firebase"],
    keywords: ["shipped", "built", "launched", "owned", "drove growth", "MVP", "full-stack", "zero to one", "scaled", "iterated"],
    hiringStyle: "Values versatility, hustle, and ability to wear multiple hats. Strong preference for candidates who shipped real products and thrive in ambiguity.",
    templateStyle: "modern",
    emphasis: ["shipping fast", "full-stack ability", "product sense", "hustle", "growth impact"],
    avoidWords: ["assigned by manager", "followed procedure", "waiting for approval"]
  },
  other: {
    name: "Other Company",
    type: "Custom (Extracted from JD)",
    tone: "adaptable",
    coreValues: ["Excellence", "Innovation", "Collaboration"],
    stack: [],
    keywords: [],
    hiringStyle: "Using provided Job Description to extract company-specific requirements.",
    templateStyle: "clean",
    emphasis: [],
    avoidWords: []
  }
};

const MODES = {
  fresher: {
    order: ["header", "summary", "education", "skills", "projects", "experience", "certifications"],
    rule: "Build bullets from projects, coursework, activities. Never present academic work as professional employment.",
    pages: 1
  },
  experienced: {
    order: ["header", "summary", "skills", "experience", "projects", "education", "certifications"],
    rule: "Convert duties into impact statements. Never inflate titles, dates, or metrics.",
    pages: 1
  }
};

function getCompanyProfile(companyKey) {
  return COMPANY_PROFILES[companyKey?.toLowerCase()] || COMPANY_PROFILES.other;
}

function detectMode(profile) {
  const experience = profile?.experience || [];
  if (!experience.length) return "fresher";
  
  const hasSubstantialExp = experience.some(exp => {
    if (!exp.duration && !exp.months) {
      // Try to detect internship vs full-time
      const title = (exp.title || exp.role || "").toLowerCase();
      const isIntern = title.includes("intern");
      if (!isIntern) return true;
      return false;
    }
    const months = exp.months || 0;
    const isIntern = (exp.title || exp.role || "").toLowerCase().includes("intern");
    return !isIntern && months >= 3;
  });
  
  return hasSubstantialExp ? "experienced" : "fresher";
}

module.exports = { COMPANY_PROFILES, MODES, getCompanyProfile, detectMode };
