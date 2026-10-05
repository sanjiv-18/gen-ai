// ── One-Click Demo Presets ── //

export const FRESHER_DEMO = {
  rawText: `Priya Sharma
priya.sharma@gmail.com | +91-9876543210 | Chennai, Tamil Nadu
linkedin.com/in/priyasharma | github.com/priyasharma

EDUCATION
B.Tech Computer Science Engineering
SRM Institute of Science and Technology, Chennai
2020 – 2024 | CGPA: 8.2/10

SKILLS
Languages: Python, Java, JavaScript, HTML, CSS
Database: MySQL, SQLite
Tools: Git, GitHub, VS Code
Frameworks: Flask (beginner), React (learning)

PROJECTS
Library Management System
- Built a CRUD web application for managing library books using Python Flask and MySQL
- Designed MySQL schema with 5 normalized tables
- Worked on the front-end using HTML and CSS

Portfolio Website
- Made a personal portfolio website using HTML, CSS, JavaScript
- Used responsive design principles

ACTIVITIES
- Member of college coding club
- Participated in college hackathon (2023)
- Completed Python for Everybody course on Coursera

CERTIFICATIONS
- Python for Everybody – Coursera (University of Michigan)
`,
  targetCompany: 'zoho',
  targetRole: 'Software Developer',
  jd: '',
  demoMode: 'fresher'
};

export const EXPERIENCED_DEMO = {
  rawText: `Arjun Mehta
arjun.mehta@gmail.com | +91-9123456789 | Bengaluru, Karnataka
linkedin.com/in/arjunmehta | github.com/arjunmehta

EXPERIENCE
Software Development Engineer — TechStartup Pvt Ltd
June 2022 – Present (2 years)
- Worked on the backend API for the product
- Helped fix bugs in the frontend React codebase  
- Was responsible for database optimization tasks
- Assisted in migrating to AWS
- Handles 1000 monthly active users

EDUCATION
B.Tech Computer Science
National Institute of Technology (NIT), Trichy
2018 – 2022 | CGPA: 8.5/10

SKILLS
JavaScript, React, Node.js, Python, AWS (S3, EC2), PostgreSQL, Docker, TypeScript, Git, REST APIs, Redis

PROJECTS
E-Commerce Platform
- Built a full-stack e-commerce platform with React and Node.js
- Handles 1000 monthly active users
- Integrated Stripe payment processing for transactions
- Deployed on AWS

CERTIFICATIONS
AWS Solutions Architect Associate
`,
  targetCompany: 'amazon',
  targetRole: 'Software Development Engineer (SDE-II)',
  jd: `We are looking for a Software Development Engineer to join our team. 
You will design and build scalable distributed systems serving millions of customers.
Requirements: Strong CS fundamentals, experience with microservices, AWS, TypeScript/Python/Java.
Must demonstrate ownership, customer obsession, and ability to deliver measurable results.
Experience with CI/CD, Kafka, DynamoDB, Lambda is a plus.
You should be able to quantify your impact and align with our Leadership Principles.`,
  demoMode: 'experienced'
};

export const COMPANY_LABELS = {
  tcs: 'TCS',
  infosys: 'Infosys',
  zoho: 'Zoho',
  amazon: 'Amazon',
  startup: 'Startup',
  other: 'Other'
};

export const COMPANY_COLORS = {
  tcs: { bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.3)', text: '#67e8f9' },
  infosys: { bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.3)', text: '#a5b4fc' },
  zoho: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#fcd34d' },
  amazon: { bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.3)', text: '#fdba74' },
  startup: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', text: '#6ee7b7' },
  other: { bg: 'rgba(139,92,246,0.1)', border: 'rgba(139,92,246,0.3)', text: '#c4b5fd' },
};
