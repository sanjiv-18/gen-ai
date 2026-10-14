import { useState, useRef, useCallback } from 'react';
import {
  Upload, FileText, PenLine, Zap, ChevronRight,
  Globe, Code2, Mail, Phone, MapPin, Briefcase,
  Building, Sparkles, X, AlertCircle, ArrowUpRight,
  GraduationCap, Layers, CheckCircle2
} from 'lucide-react';
import { FRESHER_DEMO, EXPERIENCED_DEMO } from './SampleResumes';
import { apiUnderstand } from '../services/api';

const COMPANIES = [
  { value: 'zoho', label: 'Zoho', tag: 'Product Mindset', desc: 'Focus on DSA, core coding depth & practical architecture' },
  { value: 'amazon', label: 'Amazon', tag: 'Leadership & STAR', desc: 'Customer obsession, ownership & quantifiable business metrics' },
  { value: 'tcs', label: 'TCS', tag: 'Enterprise Systems', desc: 'Enterprise frameworks, foundational engineering & SDLC' },
  { value: 'infosys', label: 'Infosys', tag: 'Global Tech Delivery', desc: 'Scalable services, certifications & client solutions' },
  { value: 'startup', label: 'Startup', tag: 'Full-Stack Agility', desc: 'Speed to delivery, product ownership & multi-role impact' },
  { value: 'other', label: 'Other', tag: 'Custom Hiring Lens', desc: 'Configurable company archetype & ATS keyword optimization' }
];

const COMPANY_TYPES = [
  'Early-Stage Startup (Seed/Series A)',
  'Growth-Stage Startup (Series B+)',
  'Product Tech Company',
  'SaaS Company',
  'Fintech',
  'Edtech',
  'Healthtech',
  'Enterprise Software',
  'Open Source Company',
  'Agency / Consulting'
];

export default function Screen1Input({ onNext, apiKey }) {
  const [entryMode, setEntryMode] = useState(null); // 'upload' | 'scratch' | null
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [rawText, setRawText] = useState('');
  const [targetCompany, setTargetCompany] = useState('zoho');
  const [targetRole, setTargetRole] = useState('Software Developer');
  const [jd, setJd] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState({
    name: '', email: '', phone: '', linkedin: '', github: '', location: ''
  });
  const fileInputRef = useRef(null);

  const handleFile = useCallback((f) => {
    if (!f) return;
    const allowed = ['.pdf', '.docx', '.doc', '.txt'];
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setError('Please upload a PDF, DOCX, or TXT file');
      return;
    }
    setFile(f);
    setError('');
    if (ext === '.txt') {
      const reader = new FileReader();
      reader.onload = (e) => setRawText(e.target.result);
      reader.readAsText(f);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  async function loadDemo(preset) {
    setLoading(true);
    setError('');
    try {
      const data = preset === 'fresher' ? FRESHER_DEMO : EXPERIENCED_DEMO;
      setRawText(data.rawText);
      setTargetCompany(data.targetCompany);
      setTargetRole(data.targetRole);
      setJd(data.jd || '');
      setEntryMode('scratch');

      const result = await apiUnderstand({
        rawText: data.rawText,
        targetCompany: data.targetCompany,
        targetRole: data.targetRole,
        apiKey,
        demoMode: data.demoMode
      });
      onNext({ ...result, targetCompany: data.targetCompany, targetRole: data.targetRole, jd: data.jd || '', rawText: data.rawText });
    } catch (e) {
      setError(e.message || 'Demo loading failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!targetCompany) { setError('Please select a target company'); return; }
    if (!file && !rawText.trim() && entryMode === 'upload') { setError('Please upload a resume file'); return; }
    if (entryMode === 'scratch' && !rawText.trim() && !profile.name) { setError('Please provide your name or resume text'); return; }

    setLoading(true);
    setError('');
    try {
      let text = rawText;
      if (entryMode === 'scratch' && !text && profile.name) {
        text = `${profile.name}\n${profile.email} | ${profile.phone} | ${profile.location}\n${profile.linkedin} | ${profile.github}\n\n`;
      }

      const result = await apiUnderstand({
        rawText: text,
        file: file,
        targetCompany,
        targetRole,
        apiKey,
        demoMode: ''
      });

      if (entryMode === 'scratch' && profile.name) {
        result.profile = { ...result.profile, ...profile };
      }

      onNext({ ...result, targetCompany, targetRole, jd, companyType, rawText: text || result.rawText || '' });
    } catch (e) {
      setError(e.message || 'Failed to process resume');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 24px' }}>
      {/* ── Hero Section (Strict Layout Discipline) ── */}
      <div className="anim-fade" style={{ textAlign: 'center', marginBottom: 44 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '5px 14px', borderRadius: 'var(--radius-full)',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid var(--border)',
          fontSize: '0.74rem', color: 'var(--text-secondary)',
          fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
          marginBottom: 20
        }}>
          <div className="dot-live" />
          ATS-Optimized · Company-Tailored · Truth-Locked
        </div>

        <h1 style={{ marginBottom: 14, maxWidth: 760, margin: '0 auto 14px' }}>
          Tailor your resume for the <span className="text-accent-gradient">exact team hiring you.</span>
        </h1>

        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1.05rem',
          maxWidth: 600,
          margin: '0 auto',
          lineHeight: 1.6
        }}>
          Deterministic Truth Lock™ verifies every metric against your source profile while aligning keywords with target company rubrics.
        </p>
      </div>

      {/* ── One-Click Demo Preset Showcase ── */}
      <div className="demo-preset-panel anim-fade" style={{ marginBottom: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Zap size={15} color="#60a5fa" />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Instant Demo Presets:
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: 1 }}>
          <button
            className="preset-chip"
            onClick={() => !loading && loadDemo('fresher')}
            disabled={loading}
          >
            <GraduationCap size={15} color="#93c5fd" />
            <span>Fresher → Zoho Developer</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>B.Tech SRM · Projects</span>
          </button>

          <button
            className="preset-chip"
            onClick={() => !loading && loadDemo('experienced')}
            disabled={loading}
          >
            <Briefcase size={14} color="#93c5fd" />
            <span>Experienced → Amazon SDE-II</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>2 YOE · AWS & STAR</span>
          </button>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--emerald)' }} />
          Zero API key needed
        </div>
      </div>

      {/* ── Entry Mode Selection ── */}
      {!entryMode && (
        <div className="grid-2 anim-fade" style={{ marginBottom: 36 }}>
          {/* Card 1: Upload */}
          <div
            className="card card-interactive"
            onClick={() => setEntryMode('upload')}
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 220 }}
          >
            <div>
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16
              }}>
                <Upload size={20} color="#93c5fd" />
              </div>
              <h3 style={{ marginBottom: 8, fontSize: '1.2rem', fontWeight: 700 }}>
                Upload Existing Resume
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.5 }}>
                Parse your current PDF, DOCX, or TXT file. We extract your experience, skills, and metrics automatically.
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                {['PDF', 'DOCX', 'TXT'].map(fmt => (
                  <span key={fmt} className="badge badge-muted" style={{ fontSize: '0.7rem' }}>{fmt}</span>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }}>
              Select Resume File <ArrowUpRight size={15} />
            </button>
          </div>

          {/* Card 2: Scratch */}
          <div
            className="card card-interactive"
            onClick={() => setEntryMode('scratch')}
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 220 }}
          >
            <div>
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16
              }}>
                <PenLine size={20} color="#93c5fd" />
              </div>
              <h3 style={{ marginBottom: 8, fontSize: '1.2rem', fontWeight: 700 }}>
                Build from Scratch
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 18, lineHeight: 1.5 }}>
                Enter your details manually or paste unformatted notes. Our AI formats and tailors it into an ATS-ready document.
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                <span className="badge badge-muted" style={{ fontSize: '0.7rem' }}>Guided Workflow</span>
                <span className="badge badge-muted" style={{ fontSize: '0.7rem' }}>Raw Text Support</span>
              </div>
            </div>
            <button className="btn btn-secondary" style={{ width: '100%' }}>
              Start Clean Profile <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── Active: Upload Mode ── */}
      {entryMode === 'upload' && (
        <div className="anim-fade" style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem' }}>
              <Upload size={17} color="#60a5fa" /> Upload Resume Document
            </h3>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setEntryMode(null); setFile(null); }}
            >
              <X size={14} /> Switch Mode
            </button>
          </div>

          {!file ? (
            <div
              className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}
              />
              <Upload size={32} color="var(--text-muted)" style={{ marginBottom: 12, display: 'inline-block' }} />
              <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                Drag & drop your resume file here
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Supports PDF and DOCX files up to 10MB
              </p>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 20px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--inner-highlight)'
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 'var(--radius-sm)',
                background: 'var(--emerald-subtle)',
                border: '1px solid var(--emerald-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <FileText size={20} color="#6ee7b7" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {file.name}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {(file.size / 1024).toFixed(1)} KB · Ready to analyze
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setFile(null)}
                style={{ padding: 6 }}
              >
                <X size={15} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Active: Scratch Mode ── */}
      {entryMode === 'scratch' && (
        <div className="anim-fade" style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem' }}>
              <PenLine size={17} color="#60a5fa" /> Candidate Profile & Details
            </h3>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setEntryMode(null); setRawText(''); }}
            >
              <X size={14} /> Switch Mode
            </button>
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <div className="form-row">
              <div className="form-group">
                <label>Full Name</label>
                <input
                  className="input"
                  placeholder="e.g. Priya Sharma"
                  value={profile.name}
                  onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  className="input"
                  type="email"
                  placeholder="e.g. priya.sharma@gmail.com"
                  value={profile.email}
                  onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  className="input"
                  placeholder="+91-9876543210"
                  value={profile.phone}
                  onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input
                  className="input"
                  placeholder="Chennai, Tamil Nadu"
                  value={profile.location}
                  onChange={e => setProfile(p => ({ ...p, location: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>LinkedIn Profile</label>
                <input
                  className="input"
                  placeholder="linkedin.com/in/username"
                  value={profile.linkedin}
                  onChange={e => setProfile(p => ({ ...p, linkedin: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>GitHub Profile</label>
                <input
                  className="input"
                  placeholder="github.com/username"
                  value={profile.github}
                  onChange={e => setProfile(p => ({ ...p, github: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Paste Resume Content / Project Notes</span>
              <span className="badge badge-muted" style={{ fontSize: '0.68rem' }}>Recommended for best accuracy</span>
            </label>
            <textarea
              className="textarea"
              rows={8}
              placeholder={`Paste your existing resume text, bullet points, skills, or achievements here...\n\nExample:\nEDUCATION: B.Tech CSE (2020-2024)\nSKILLS: Python, React, PostgreSQL, Docker\nPROJECTS: Microservices billing engine handling 5,000 req/s`}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              style={{ minHeight: 180 }}
            />
          </div>
        </div>
      )}

      {/* ── Target Company & Lens Selection ── */}
      {entryMode && (
        <div className="card anim-fade" style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <Building size={17} color="#60a5fa" />
            <h3 style={{ fontSize: '1.05rem' }}>Select Target Company Hiring Lens</h3>
          </div>

          {/* Company Grid (Anti-slop monograms, zero cheesy emojis) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginBottom: 22 }}>
            {COMPANIES.map(c => {
              const isSelected = targetCompany === c.value;
              return (
                <div
                  key={c.value}
                  onClick={() => setTargetCompany(c.value)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    boxShadow: isSelected ? '0 0 0 1px var(--accent), var(--inner-highlight)' : 'var(--inner-highlight)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: isSelected ? '#ffffff' : 'var(--text-primary)' }}>
                      {c.label}
                    </span>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      color: isSelected ? '#93c5fd' : 'var(--text-muted)'
                    }}>
                      {c.tag}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {c.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* If Other, pick custom company archetype */}
          {targetCompany === 'other' && (
            <div className="form-group anim-fade">
              <label>Custom Company Archetype</label>
              <select
                className="select"
                value={companyType}
                onChange={e => setCompanyType(e.target.value)}
              >
                <option value="">Select industry / company archetype...</option>
                {COMPANY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          {/* Target Role & Optional JD */}
          <div className="form-group">
            <label>Target Job Title / Role</label>
            <input
              className="input"
              placeholder="e.g. Software Engineer, SDE-II, Full Stack Developer"
              value={targetRole}
              onChange={e => setTargetRole(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Job Description (JD)</span>
              <span className="badge badge-muted" style={{ fontSize: '0.68rem' }}>Optional</span>
            </label>
            <textarea
              className="textarea"
              rows={4}
              placeholder="Paste the target job description to match exact required keywords, frameworks, and experience levels..."
              value={jd}
              onChange={e => setJd(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px',
          background: 'var(--rose-subtle)',
          border: '1px solid var(--rose-border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 20,
          color: '#fda4af',
          fontSize: '0.86rem'
        }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Submit Action */}
      {entryMode && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleSubmit}
            disabled={loading || !targetCompany}
            style={{ minWidth: 220 }}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16 }} />
                <span>Running ATS Analysis...</span>
              </>
            ) : (
              <>
                <span>Analyze & Tailor Resume</span>
                <ChevronRight size={17} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
