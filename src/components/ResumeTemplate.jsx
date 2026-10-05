import { useState, useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';

// ─── Inline Editable Bullet ─────────────────────────────────────────────────
// Shown ONLY in interactive mode (Review/Preview screen).
// Never rendered when printMode=true.
function EditableBullet({ text, bulletIndex, verified, revalidating, onEdit, editingBullet, setEditingBullet }) {
  const [draft, setDraft] = useState(text);
  const isEditing = editingBullet === bulletIndex;
  const inputRef = useRef(null);

  function startEdit() {
    setDraft(text);
    setEditingBullet(bulletIndex);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function commitEdit() {
    if (draft.trim() !== text) {
      onEdit(bulletIndex, draft.trim());
    } else {
      setEditingBullet(null);
    }
  }

  return (
    <li style={{ marginBottom: 3, display: 'flex', gap: 6, alignItems: 'flex-start', pageBreakInside: 'avoid' }}>
      <span style={{ color: '#6366f1', flexShrink: 0, marginTop: 2, fontSize: '0.8em' }}>▸</span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        {isEditing ? (
          <div style={{ flex: 1, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              style={{
                flex: 1, background: 'rgba(99,102,241,0.08)',
                border: '1.5px solid rgba(99,102,241,0.5)',
                borderRadius: 6, padding: '4px 8px',
                fontSize: '0.82rem', fontFamily: 'inherit', color: '#1a1a2e',
                resize: 'vertical', minHeight: 36, lineHeight: 1.4
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
                if (e.key === 'Escape') setEditingBullet(null);
              }}
            />
            {/* Save button — hidden by .no-print during PDF export */}
            <button
              onClick={commitEdit}
              className="no-print"
              style={{
                background: '#10b981', border: 'none', borderRadius: 4,
                padding: '4px 8px', cursor: 'pointer', color: 'white', fontSize: '0.75rem', flexShrink: 0
              }}
            >
              <CheckCircle2 size={13} />
            </button>
          </div>
        ) : (
          <span
            className="bullet-editable"
            onClick={startEdit}
            title="Click to edit"
            style={{ flex: 1, fontSize: '0.82rem', lineHeight: 1.5, color: '#1e293b', cursor: 'text' }}
          >
            {text}
          </span>
        )}
        {/* Revalidating spinner only — no verification badge in the resume */}
        {!isEditing && revalidating === bulletIndex && (
          <div className="spinner no-print" style={{ width: 12, height: 12, borderWidth: 2, flexShrink: 0 }} />
        )}

      </div>
    </li>
  );
}

// ─── Clean Read-Only Bullet ──────────────────────────────────────────────────
// Used when printMode=true. Renders ONLY the bullet text — no badges, no edit
// controls, no verification overlays of any kind.
function CleanBullet({ text }) {
  return (
    <li style={{ marginBottom: 3, display: 'flex', gap: 6, alignItems: 'flex-start', pageBreakInside: 'avoid' }}>
      <span style={{ color: '#6366f1', flexShrink: 0, marginTop: 2, fontSize: '0.8em' }}>▸</span>
      <span style={{ flex: 1, fontSize: '0.82rem', lineHeight: 1.5, color: '#1e293b' }}>{text}</span>
    </li>
  );
}

// ─── ResumeTemplate ──────────────────────────────────────────────────────────
// Props:
//   printMode (bool, default false) — when true, renders a fully clean resume
//   with zero verification / review UI elements.
export default function ResumeTemplate({
  resume,
  bullets,
  sectionOrder,
  mode,
  company,
  onBulletEdit,
  editingBullet,
  setEditingBullet,
  revalidating,
  printMode = false,
}) {
  if (!resume) return null;

  const { header, summary, skills, experience, education, projects, certifications } = resume;

  // Build bullet lookup map (only needed in interactive mode)
  const bulletMap = {};
  if (!printMode) {
    (bullets || []).forEach((b, i) => {
      bulletMap[b.text?.slice(0, 50)] = { index: i, verified: b.verified };
    });
  }

  function getBulletInfo(text) {
    const key = (text || '').slice(0, 50);
    const match = bulletMap[key];
    if (!match) {
      const entry = Object.entries(bulletMap).find(([k]) => k && text && text.includes(k.slice(0, 20)));
      return entry ? { index: entry[1].index, verified: entry[1].verified } : { index: -1, verified: undefined };
    }
    return match;
  }

  const accentColor =
    company === 'amazon' ? '#ff9990' :
    company === 'zoho'   ? '#eab308' :
    company === 'tcs'    ? '#06b6d4' :
    company === 'infosys'? '#6366f1' :
    '#6366f1';

  // Renders a single bullet — CleanBullet in printMode, EditableBullet otherwise
  function renderBullet(b, bi, indexOffset = 0) {
    if (printMode) {
      return <CleanBullet key={bi} text={b} />;
    }
    const bInfo = getBulletInfo(b);
    return (
      <EditableBullet
        key={bi}
        text={b}
        bulletIndex={bInfo.index >= 0 ? bInfo.index : bi + indexOffset}
        verified={bInfo.verified}
        revalidating={revalidating}
        onEdit={onBulletEdit}
        editingBullet={editingBullet}
        setEditingBullet={setEditingBullet}
      />
    );
  }

  const sectionComponents = {
    header: (
      <div key="header" style={{ borderBottom: `3px solid ${accentColor}`, paddingBottom: 14, marginBottom: 16 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f0f1a', marginBottom: 3 }}>{header?.name}</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: '0.78rem', color: '#475569' }}>
          {header?.email    && <span>📧 {header.email}</span>}
          {header?.phone    && <span>📱 {header.phone}</span>}
          {header?.location && <span>📍 {header.location}</span>}
          {header?.linkedin && <span style={{ color: '#0077b5' }}>🔗 {header.linkedin}</span>}
          {header?.github   && <span>⚡ {header.github}</span>}
        </div>
      </div>
    ),

    summary: summary ? (
      <div key="summary" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: accentColor, marginBottom: 5 }}>
          Professional Summary
        </div>
        <p style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.65 }}>{summary}</p>
      </div>
    ) : null,

    skills: skills ? (
      <div key="skills" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: accentColor, marginBottom: 6, borderBottom: '1.5px solid #e2e8f0', paddingBottom: 4 }}>
          Technical Skills
        </div>
        {typeof skills === 'object' && !Array.isArray(skills)
          ? Object.entries(skills).filter(([, v]) => v?.length).map(([cat, items]) => (
              <div key={cat} style={{ display: 'flex', gap: 6, marginBottom: 3, fontSize: '0.78rem', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: 700, color: '#334155', minWidth: 90, flexShrink: 0 }}>{cat}:</span>
                <span style={{ color: '#475569' }}>{Array.isArray(items) ? items.join(' · ') : items}</span>
              </div>
            ))
          : <div style={{ fontSize: '0.78rem', color: '#475569' }}>{(Array.isArray(skills) ? skills : []).join(' · ')}</div>
        }
      </div>
    ) : null,

    experience: (experience || []).length ? (
      <div key="experience" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: accentColor, marginBottom: 8, borderBottom: '1.5px solid #e2e8f0', paddingBottom: 4 }}>
          Work Experience
        </div>
        {experience.map((exp, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.87rem', color: '#0f172a' }}>{exp.title}</span>
                <span style={{ color: '#475569', fontSize: '0.82rem' }}> · {exp.company}</span>
              </div> 
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', flexShrink: 0, marginLeft: 8 }}>{exp.duration}</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {(exp.bullets || []).map((b, bi) => renderBullet(b, bi, 1000 + i))}
            </ul>
          </div>
        ))}
      </div>
    ) : null,

    education: (education || []).length ? (
      <div key="education" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: accentColor, marginBottom: 8, borderBottom: '1.5px solid #e2e8f0', paddingBottom: 4 }}>
          Education
        </div>
        {education.map((edu, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{edu.degree}</div>
              <div style={{ fontSize: '0.78rem', color: '#475569' }}>{edu.institution}</div>
              {edu.gpa && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>GPA: {edu.gpa}</div>}
              {(edu.relevantCoursework || edu.coursework || []).length > 0 && (
                <div style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: 2 }}>
                  Coursework: {(edu.relevantCoursework || edu.coursework || []).join(', ')}
                </div>
              )}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', flexShrink: 0, marginLeft: 10 }}>{edu.year}</span>
          </div>
        ))}
      </div>
    ) : null,

    projects: (projects || []).length ? (
      <div key="projects" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: accentColor, marginBottom: 8, borderBottom: '1.5px solid #e2e8f0', paddingBottom: 4 }}>
          Projects
        </div>
        {projects.map((proj, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>{proj.name}</span>
                {(proj.tech || []).length > 0 && (
                  <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: 8 }}>
                    {proj.tech.join(' · ')}
                  </span>
                )}
              </div>
              {proj.link && <span style={{ fontSize: '0.72rem', color: accentColor }}>{proj.link}</span>}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {(proj.bullets || []).map((b, bi) => renderBullet(b, bi, 2000 + i))}
            </ul>
          </div>
        ))}
      </div>
    ) : null,

    certifications: (certifications || []).length ? (
      <div key="certifications" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: accentColor, marginBottom: 6, borderBottom: '1.5px solid #e2e8f0', paddingBottom: 4 }}>
          Certifications
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {certifications.map((cert, i) => (
            <span key={i} style={{
              padding: '2px 10px', borderRadius: 99,
              background: `${accentColor}15`, color: accentColor,
              border: `1px solid ${accentColor}40`, fontSize: '0.75rem', fontWeight: 600
            }}>
              {typeof cert === 'string' ? cert : `${cert.name}${cert.issuer ? ` — ${cert.issuer}` : ''}`}
            </span>
          ))}
        </div>
      </div>
    ) : null,
  };

  const orderedSections = sectionOrder || Object.keys(sectionComponents);

  return (
    <div style={{
      background: 'white',
      padding: '32px 36px',
      fontFamily: "'Inter', sans-serif",
      minHeight: '297mm',
      maxWidth: '210mm',
      margin: '0 auto',
      color: '#1e293b',
      fontSize: '0.82rem',
    }}>
      {/*
        ── Print / Export CSS ────────────────────────────────────────────────
        Double layer of protection:
          1. printMode=true → CleanBullet renders with zero verification DOM.
          2. @media print   → .no-print, badges, buttons, spinners are hidden.
        Result: 0 occurrences of "Confirm", "Verified" badges, or any review UI
                in the downloaded PDF.
      */}
      {/*
        ── Print / Export CSS ────────────────────────────────────────────────
        Double layer of protection:
          1. printMode=true → CleanBullet renders with zero verification DOM.
          2. @media print   → .no-print, badges, buttons, spinners are hidden.
        Result: 0 occurrences of "Confirm", "Verified" badges, or any review UI
                in the downloaded PDF.
      */}
      <style>{`
        @page {
          margin: 12mm 15mm;
          size: A4 portrait;
        }
        @media print {
          html, body {
            background: white !important;
            color: #1e293b !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body * {
            visibility: hidden;
          }
          #resume-print, #resume-print * {
            visibility: visible;
          }
          #resume-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }
          .no-print,
          .truth-badge,
          .resume-verify-badge,
          .spinner,
          button {
            display: none !important;
          }
        }
      `}</style>

      <div id="resume-print">
        {orderedSections.map(sec => sectionComponents[sec] || null)}
      </div>
    </div>
  );
}
