import { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, Download, Monitor, Code2, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, TrendingUp, RefreshCw, Eye, FileText,
  Info, Sparkles, Award, Edit3, Check, X
} from 'lucide-react';
import { apiBuild, apiRevalidate } from '../services/api';
import ResumeTemplate from './ResumeTemplate';

// Animated Counter
function AnimatedNumber({ from, to, duration = 1200 }) {
  const [val, setVal] = useState(from);
  useEffect(() => {
    const start = performance.now();
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(from + (to - from) * eased));
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [from, to, duration]);
  return <>{val}</>;
}

// Score Ring SVG
function ScoreRing({ score, color, size = 100 }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
      <circle
        cx="50" cy="50" r={r} fill="none"
        stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
        style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }}
      />
      <text x="50" y="56" textAnchor="middle" fill="white" fontSize="18" fontWeight="700" fontFamily="Inter">
        {score}%
      </text>
    </svg>
  );
}

// Truth Lock Badge
function TruthBadge({ verified }) {
  return (
    <span className={`truth-badge ${verified ? 'truth-badge-verified' : 'truth-badge-unverified'}`}>
      {verified ? <><CheckCircle2 size={9} /> Verified</> : <><AlertTriangle size={9} /> Confirm</>}
    </span>
  );
}

export default function Screen3Result({ data, onBack, apiKey }) {
  const [buildData, setBuildData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [atsXRay, setAtsXRay] = useState(false);
  const [expandedChange, setExpandedChange] = useState(null);
  const [editingBullet, setEditingBullet] = useState(null);
  const [bullets, setBullets] = useState([]);
  const [revalidating, setRevalidating] = useState(null);
  const [showAllChanges, setShowAllChanges] = useState(false);
  const printRef = useRef(null);

  useEffect(() => {
    buildResume();
  }, []);

  async function buildResume() {
    setLoading(true);
    setError('');
    try {
      const result = await apiBuild({
        profile: data.profile,
        targetCompany: data.targetCompany,
        mode: data.mode,
        keywords: data.keywords,
        gapAnswers: data.gapAnswers,
        userAnswers: data.userAnswers,
        jd: data.jd,
        rawText: data.rawText,
        apiKey
      });
      setBuildData(result);
      setBullets(result.bullets || []);
    } catch (e) {
      setError(e.message || 'Failed to build resume');
    } finally {
      setLoading(false);
    }
  }

  async function handleBulletEdit(bulletIndex, newText) {
    const bullet = bullets[bulletIndex];
    setRevalidating(bulletIndex);
    try {
      const updated = { ...bullet, text: newText };
      const result = await apiRevalidate({ bullet: updated, rawText: data.rawText, userAnswers: data.userAnswers || {} });
      const newBullets = [...bullets];
      newBullets[bulletIndex] = result;
      setBullets(newBullets);
    } catch (e) {
      // Just update the text without re-validation
      const newBullets = [...bullets];
      newBullets[bulletIndex] = { ...bullet, text: newText };
      setBullets(newBullets);
    } finally {
      setRevalidating(null);
      setEditingBullet(null);
    }
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', gap: 20
      }}>
        <div style={{ position: 'relative' }}>
          <div className="spinner" style={{ width: 56, height: 56, borderWidth: 4 }} />
          <Sparkles size={22} color="#a5b4fc" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ marginBottom: 8 }}>Building Your Optimized Resume</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Running ATS optimization · Truth Lock verification · Company tailoring...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 600, margin: '60px auto', padding: '0 24px', textAlign: 'center' }}>
        <div style={{
          padding: '32px', borderRadius: 'var(--radius-lg)',
          background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.3)'
        }}>
          <AlertTriangle size={40} color="#f43f5e" style={{ marginBottom: 16 }} />
          <h3 style={{ marginBottom: 8 }}>Build Failed</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>{error}</p>
          <button className="btn btn-primary" onClick={buildResume}><RefreshCw size={16} /> Retry</button>
        </div>
      </div>
    );
  }

  const { resume, changes_explained, ats, sectionOrder, plainText } = buildData || {};
  const verifiedCount = bullets.filter(b => b.verified).length;
  const unverifiedCount = bullets.length - verifiedCount;
  const changes = changes_explained || [];
  const displayChanges = showAllChanges ? changes : changes.slice(0, 3);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }} className="anim-fade">
      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ marginBottom: 8 }}>
          Your Resume is Ready <span style={{ fontSize: '1.4rem' }}>🎉</span>
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          ATS-optimized · Truth Lock verified · Tailored for {data.targetCompany?.toUpperCase()}
        </p>
      </div>

      {/* ── Scorecard Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {/* ATS Score Before */}
        <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Before
          </div>
          <ScoreRing score={ats?.baseline || 0} color="#f43f5e" size={90} />
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>ATS Score</div>
        </div>

        {/* Arrow */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <TrendingUp size={32} color="#10b981" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
              +<AnimatedNumber from={0} to={(ats?.optimized || 0) - (ats?.baseline || 0)} />%
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>improvement</div>
          </div>
        </div>

        {/* ATS Score After */}
        <div className="card card-glow" style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            After ✨
          </div>
          <ScoreRing score={ats?.optimized || 0} color="#6366f1" size={90} />
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>ATS Score</div>
        </div>

        {/* Truth Lock */}
        <div className="card" style={{ padding: '20px 16px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Truth Lock
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={18} color="#10b981" />
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.2rem', lineHeight: 1 }}>{verifiedCount}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Verified bullets</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} color="#f59e0b" />
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.2rem', lineHeight: 1 }}>{unverifiedCount}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Need confirmation</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Keyword Chips ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', color: '#6ee7b7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              ✓ Matched Keywords ({(ats?.matched || []).length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(ats?.matched || []).map(k => (
                <span key={k} className="badge badge-green" style={{ fontSize: '0.75rem' }}>{k}</span>
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', color: '#fda4af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              ✗ Missing Keywords ({(ats?.missing || []).length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(ats?.missing || []).map(k => (
                <span key={k} className="badge badge-rose" style={{ fontSize: '0.75rem' }}>{k}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 24 }}>
        {/* ── Left: Resume Preview ── */}
        <div>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <h3 style={{ flex: 1, fontSize: '1rem' }}>Resume Preview</h3>
            <button
              className={`btn btn-sm ${atsXRay ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setAtsXRay(x => !x)}
            >
              <Code2 size={14} /> {atsXRay ? 'Exit ATS X-Ray' : 'ATS X-Ray'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={handlePrint}>
              <Download size={14} /> Export PDF
            </button>
          </div>

          {/* Resume Display */}
          <div ref={printRef} style={{
            background: atsXRay ? '#000' : 'white',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            transition: 'background 0.3s ease'
          }}>
            {atsXRay ? (
              <div className="ats-xray">
                {`=== ATS PARSER OUTPUT ===\n`}
                {`Mode: ${data.mode?.toUpperCase()}\n`}
                {`Target: ${data.targetCompany?.toUpperCase()}\n\n`}
                {plainText || 'No plain text available'}
              </div>
            ) : (
              <ResumeTemplate
                resume={resume}
                bullets={bullets}
                sectionOrder={sectionOrder || ['header', 'summary', 'skills', 'experience', 'projects', 'education', 'certifications']}
                mode={data.mode}
                company={data.targetCompany}
                onBulletEdit={handleBulletEdit}
                editingBullet={editingBullet}
                setEditingBullet={setEditingBullet}
                revalidating={revalidating}
              />
            )}
          </div>
        </div>

        {/* ── Right Panel: Why We Changed + Bullets ── */}
        <div>
          {/* Why We Changed */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
              <Edit3 size={15} color="#a5b4fc" /> Why We Changed This
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {displayChanges.map((ch, i) => (
                <div key={i} style={{
                  borderRadius: 'var(--radius-md)', overflow: 'hidden',
                  border: '1px solid var(--border)'
                }}>
                  <button
                    onClick={() => setExpandedChange(expandedChange === i ? null : i)}
                    style={{
                      width: '100%', padding: '10px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: 'none', cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      color: 'var(--text-primary)', fontFamily: 'inherit'
                    }}
                  >
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, textAlign: 'left', lineHeight: 1.4 }}>
                      "{ch.original?.slice(0, 50)}{ch.original?.length > 50 ? '...' : ''}"
                    </span>
                    {expandedChange === i ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                  </button>
                  {expandedChange === i && (
                    <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: '0.7rem', color: '#fda4af', fontWeight: 700, marginBottom: 4 }}>ORIGINAL</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, fontStyle: 'italic' }}>"{ch.original}"</div>
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: '0.7rem', color: '#6ee7b7', fontWeight: 700, marginBottom: 4 }}>OPTIMIZED</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.5, fontWeight: 600 }}>"{ch.updated}"</div>
                      </div>
                      <div style={{
                        padding: '8px 10px',
                        background: 'rgba(99,102,241,0.08)', borderRadius: 8,
                        fontSize: '0.78rem', color: '#a5b4fc', lineHeight: 1.6
                      }}>
                        <Info size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        {ch.reason}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {changes.length > 3 && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowAllChanges(x => !x)}
                  style={{ alignSelf: 'center' }}
                >
                  {showAllChanges ? 'Show Less' : `Show ${changes.length - 3} More`}
                </button>
              )}
            </div>
          </div>

          {/* Bullet Truth Lock List */}
          <div className="card">
            <h3 style={{ marginBottom: 12, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Award size={15} color="#fcd34d" /> Truth Lock Status
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
              {bullets.map((b, i) => (
                <div key={i} style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: b.verified ? 'rgba(16,185,129,0.05)' : 'rgba(245,158,11,0.05)',
                  border: `1px solid ${b.verified ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                  display: 'flex', alignItems: 'flex-start', gap: 8
                }}>
                  <TruthBadge verified={b.verified} />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', flex: 1, lineHeight: 1.5 }}>
                    {b.text?.slice(0, 80)}{b.text?.length > 80 ? '...' : ''}
                  </span>
                  {revalidating === i && <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Nav Buttons ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
        <button className="btn btn-ghost" onClick={onBack}>
          <ChevronLeft size={16} /> Back to Review
        </button>
        <button className="btn btn-primary btn-lg" onClick={handlePrint}>
          <Download size={18} /> Download PDF
        </button>
      </div>
    </div>
  );
}
