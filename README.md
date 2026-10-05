# CareerLens AI 🚀

**ATS-friendly, company-tailored AI resume builder** with Truth Lock verification.

## Quick Start

```bash
# Terminal 1 — Backend (Express)
cd server && npm install && node index.js

# Terminal 2 — Frontend (Vite + React)
npm install && npm run dev
```

Or run both at once:
```bash
npm install && npm start
```

Frontend → http://localhost:5173  
Backend  → http://localhost:5000

## Features
- **3-Screen Workflow**: Input → Review → Result
- **Dual Entry**: Upload PDF/DOCX/TXT or start from scratch
- **Company Lens**: Tailored for TCS, Infosys, Zoho, Amazon, Startup
- **Truth Lock**: Deterministic bullet verification (no LLM hallucinations)
- **ATS X-Ray**: Preview what ATS parsers see
- **Gap Map**: Skill strength analysis with Yes/No confirmations
- **One-Click Demos**: Fresher→Zoho and Experienced→Amazon presets
- **PDF Export**: Clean one-page print via CSS @media print

## API Key (Optional)
Add your Gemini API key in the top-right corner for real AI generation.  
Without a key, the app uses a rich mock engine — perfect for demos.

Get a free key at: https://aistudio.google.com/app/apikey

## Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite |
| Styling | Vanilla CSS (glassmorphism) |
| Icons | Lucide React |
| Backend | Node.js + Express |
| AI | Gemini 2.0 Flash (`@google/generative-ai`) |
| Parsing | pdf-parse + mammoth |
| State | In-memory (stateless backend) |
