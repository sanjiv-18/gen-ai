import { useState, useRef, useCallback } from 'react';
import {
  Upload, FileText, PenLine, Zap, ChevronRight,
  Globe, Code2, Mail, Phone, MapPin, Briefcase,
  Building, Sparkles, X, AlertCircle
} from 'lucide-react';
import { FRESHER_DEMO, EXPERIENCED_DEMO } from './SampleResumes';
import { apiUnderstand } from '../services/api';

const COMPANIES = [
  { value: 'tcs', label: 'TCS', emoji: '🏢' },
  { value: 'infosys', label: 'Infosys', emoji: '💼' },
  { value: 'zoho', label: 'Zoho', emoji: '🦁' },
  { value: 'amazon', label: 'Amazon', emoji: '📦' },
  { value: 'startup', label: 'Startup', emoji: '🚀' },
  { value: 'other', label: 'Other', emoji: '✨' }
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
  const [targetCompany, setTargetCompany] = useState('');
  const [targetRole, setTargetRole] = useState('');
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
    // If TXT, also read into rawText for preview
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
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!targetCompany) { setError('Please select a target company'); return; }
    if (!file && !rawText.trim() && entryMode === 'upload') { setError('Please upload a file'); return; }
    if (entryMode === 'scratch' && !rawText.trim() && !profile.name) { setError('Please enter your information'); return; }

    setLoading(true);
    setError('');
    try {
      // Build rawText from scratch form if needed
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

      // Merge manual profile data if from scratch
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
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div className="anim-fade" style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 16px', borderRadius: 'var(--radius-full)',
          background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
          fontSize: '0.8rem', color: '#a5b4fc', fontWeight: 600, marginBottom: 20
        }}>
          <Sparkles size={14} /> ATS-Optimized · Company-Tailored · Truth-Locked
        </div>
        <h1 style={{ marginBottom: 12 }}>
          Build Your <span className="gradient-text">Perfect Resume</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: 520, margin: '0 auto' }}>
          AI-powered resume tailoring that matches your target company's hiring style — with guaranteed accuracy.
        </p>
      </div>

      {/* ── Demo Bar ── */}
      <div className="demo-bar anim-fade" style={{ marginBottom: 32, animationDelay: '0.1s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Zap size={16} color="#fcd34d" />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fcd34d' }}>One-Click Demo:</span>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => !loading && loadDemo('fresher')}
          disabled={loading}
          style={{ borderColor: 'rgba(245,158,11,0.3)', color: '#fcd34d' }}
        >
          🎓 Fresher → Zoho
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => !loading && loadDemo('experienced')}
          disabled={loading}
          style={{ borderColor: 'rgba(251,146,60,0.3)', color: '#fdba74' }}
        >
          💼 Experienced → Amazon
        </button>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          No API key needed
        </span>
      </div>

      {/* ── Entry Mode Selection ── */}
      {!entryMode && (
        <div className="grid-2 anim-fade" style={{ marginBottom: 32, animationDelay: '0.15s' }}>
          <div
            className="card"
            onClick={() => setEntryMode('upload')}
            style={{
              textAlign: 'left', cursor: 'pointer',
              border: '1px solid rgba(99,102,241,0.3)',
              background: 'linear-gradient(145deg, rgba(16,19,41,0.95) 0%, rgba(26,29,62,0.85) 100%)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 20px rgba(99,102,241,0.12)',
              transition: 'all 0.25s ease',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              borderRadius: 'var(--radius-lg)',
              padding: '28px 24px'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.7)';
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 12px 36px rgba(0,0,0,0.5), 0 0 30px rgba(99,102,241,0.25)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.35), 0 0 20px rgba(99,102,241,0.12)';
            }}
          >
            <div>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.2))',
                border: '1px solid rgba(99,102,241,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16
              }}>
                <Upload size={24} color="#a5b4fc" />
              </div>
              <h3 style={{ marginBottom: 8, color: '#F8FAFF', fontSize: '1.25rem', fontWeight: 700 }}>
                Upload Your Resume
              </h3>
              <p style={{ color: '#B8C0D9', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 16 }}>
                Drop your PDF, DOCX or TXT here. We'll parse, analyze, and enhance it.
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                {['PDF', 'DOCX', 'TXT'].map(f => (
                  <span key={f} className="badge badge-indigo" style={{ fontSize: '0.72rem' }}>{f}</span>
                ))}
              </div>
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', fontSize: '0.88rem' }}
            >
              <Upload size={16} /> Choose Resume
            </button>
          </div>

          <div
            className="card"
            onClick={() => setEntryMode('scratch')}
            style={{
              textAlign: 'left', cursor: 'pointer',
              border: '1px solid rgba(139,92,246,0.3)',
              background: 'linear-gradient(145deg, rgba(16,19,41,0.95) 0%, rgba(28,24,64,0.85) 100%)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 20px rgba(139,92,246,0.12)',
              transition: 'all 0.25s ease',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              borderRadius: 'var(--radius-lg)',
              padding: '28px 24px'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.7)';
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 12px 36px rgba(0,0,0,0.5), 0 0 30px rgba(139,92,246,0.25)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.35), 0 0 20px rgba(139,92,246,0.12)';
            }}
          >
            <div>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(236,72,153,0.2))',
                border: '1px solid rgba(139,92,246,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16
              }}>
                <PenLine size={24} color="#ddd6fe" />
              </div>
              <h3 style={{ marginBottom: 8, color: '#F8FAFF', fontSize: '1.25rem', fontWeight: 700 }}>
                Build From Scratch
              </h3>
              <p style={{ color: '#B8C0D9', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 16 }}>
                Create your resume with our guided AI workflow. Perfect for first-time builders.
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                <span className="badge badge-violet" style={{ fontSize: '0.72rem' }}>✨ Guided Workflow</span>
              </div>
            </div>
            <button
              className="btn btn-primary"
              style={{
                width: '100%', justifyContent: 'center', padding: '10px 16px', fontSize: '0.88rem',
                background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)'
              }}
            >
              <PenLine size={16} /> Start Building →
            </button>
          </div>
        </div>
      )}

      {/* ── Upload Mode ── */}
      {entryMode === 'upload' && (
        <div className="anim-scale" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Upload size={18} color="#a5b4fc" /> Upload Resume
            </h3>
            <button className="btn btn-ghost btn-sm" onClick={() => { setEntryMode(null); setFile(null); }}>
              <X size={14} /> Change
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
                accept=".pdf,.docx,.doc,.txt"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}
              />
              <Upload size={36} color="var(--text-muted)" style={{ marginBottom: 12 }} />
              <p style={{ fontWeight: 600, marginBottom: 6 }}>Drop your resume here</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>or click to browse — PDF, DOCX, TXT (max 10MB)</p>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '16px 20px',
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.25)',
              borderRadius: 'var(--radius-md)'
            }}>
              <FileText size={24} color="#6ee7b7" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{file.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {(file.size / 1024).toFixed(1)} KB · Ready to process
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setFile(null)}><X size={14} /></button>
            </div>
          )}
        </div>
      )}

      {/* ── Scratch Mode ── */}
      {entryMode === 'scratch' && (
        <div className="anim-scale" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PenLine size={18} color="#c4b5fd" /> Your Profile
            </h3>
            <button className="btn btn-ghost btn-sm" onClick={() => { setEntryMode(null); setRawText(''); }}>
              <X size={14} /> Change
            </button>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Fill in your details below <strong>or</strong> paste your full resume text at the bottom.
            </p>

            <div className="form-row">
              <div className="form-group">
                <label><Mail size={11} style={{ marginRight: 4 }} />Full Name</label>
                <input className="input" placeholder="Priya Sharma"
                  value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label><Mail size={11} style={{ marginRight: 4 }} />Email</label>
                <input className="input" type="email" placeholder="you@email.com"
                  value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label><Phone size={11} style={{ marginRight: 4 }} />Phone</label>
                <input className="input" placeholder="+91-9876543210"
                  value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label><MapPin size={11} style={{ marginRight: 4 }} />Location</label>
                <input className="input" placeholder="City, State"
                  value={profile.location} onChange={e => setProfile(p => ({ ...p, location: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label><Globe size={11} style={{ marginRight: 4 }} />LinkedIn URL</label>
                <input className="input" placeholder="linkedin.com/in/yourname"
                  value={profile.linkedin} onChange={e => setProfile(p => ({ ...p, linkedin: e.target.value }))} />
              </div>
              <div className="form-group">
                <label><Code2 size={11} style={{ marginRight: 4 }} />GitHub URL</label>
                <input className="input" placeholder="github.com/yourname"
                  value={profile.github} onChange={e => setProfile(p => ({ ...p, github: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label><FileText size={11} style={{ marginRight: 4 }} />Paste Full Resume Text (recommended)</label>
            <textarea
              className="textarea"
              rows={10}
              placeholder={`Paste your full resume content here — experience, education, skills, projects...

Example:
EXPERIENCE
Software Developer — Acme Corp (2022-2024)
- Built microservices handling 5000 req/s
...`}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              style={{ minHeight: 200 }}
            />
          </div>
        </div>
      )}

      {/* ── Targeting Section ── */}
      {entryMode && (
        <div className="card anim-fade" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building size={18} color="#a5b4fc" /> Target Company & Role
          </h3>

          {/* Company Picker */}
          <div className="form-group">
            <label>Target Company *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {COMPANIES.map(c => (
                <button
                  key={c.value}
                  onClick={() => setTargetCompany(c.value)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${targetCompany === c.value ? 'rgba(99,102,241,0.6)' : 'var(--border)'}`,
                    background: targetCompany === c.value ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.03)',
                    color: targetCompany === c.value ? '#a5b4fc' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: targetCompany === c.value ? 700 : 500,
                    fontSize: '0.87rem',
                    transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 8
                  }}
                >
                  <span>{c.emoji}</span> {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Other → Company Type */}
          {targetCompany === 'other' && (
            <div className="form-group anim-fade">
              <label>Company Type *</label>
              <select className="select" value={companyType} onChange={e => setCompanyType(e.target.value)}>
                <option value="">Select company type...</option>
                {COMPANY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label><Briefcase size={11} style={{ marginRight: 4 }} />Target Role</label>
              <input className="input" placeholder="Software Engineer, SDE-II..."
                value={targetRole} onChange={e => setTargetRole(e.target.value)} />
            </div>
          </div>

          {/* JD Textarea */}
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Job Description
              <span className="badge badge-muted" style={{ fontSize: '0.65rem' }}>Optional but recommended</span>
            </label>
            <textarea
              className="textarea"
              rows={5}
              placeholder="Paste the job description here for precise ATS keyword extraction and role-specific tailoring..."
              value={jd}
              onChange={e => setJd(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px',
          background: 'rgba(244,63,94,0.1)',
          border: '1px solid rgba(244,63,94,0.3)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 20,
          color: '#fda4af', fontSize: '0.87rem'
        }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Submit */}
      {entryMode && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleSubmit}
            disabled={loading || !targetCompany}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                Analyzing Resume...
              </>
            ) : (
              <>
                Analyze My Resume <ChevronRight size={18} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
