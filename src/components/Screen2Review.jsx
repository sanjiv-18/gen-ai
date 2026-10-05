import { useState, useEffect } from 'react';
import {
  Star, ChevronRight, ChevronLeft, Building2, ToggleLeft, ToggleRight,
  AlertTriangle, CheckCircle2, XCircle, HelpCircle, Code2,
  Lightbulb, Filter, Sparkles, BookOpen, Award, Users
} from 'lucide-react';
import { apiAnalyze } from '../services/api';
import { COMPANY_COLORS } from './SampleResumes';

const FRESHER_ACTIVITIES = [
  { label: 'Hackathon', icon: '🏆' },
  { label: 'Coding Club', icon: '💻' },
  { label: 'NSS/NCC', icon: '🎖️' },
  { label: 'Sports Captain', icon: '⚽' },
  { label: 'Cultural Event', icon: '🎭' },
  { label: 'Research Paper', icon: '📝' },
  { label: 'Open Source Contribution', icon: '🔓' },
  { label: 'Freelance Project', icon: '💼' },
  { label: 'Online Certification', icon: '🎓' },
  { label: 'Teaching/Tutoring', icon: '📚' }
];

const WEAK_VERBS = ['helped', 'assisted', 'worked on', 'was responsible for', 'involved in', 'contributed to', 'did', 'made', 'tried'];

function detectWeakVerbs(text) {
  const t = (text || '').toLowerCase();
  return WEAK_VERBS.filter(v => t.includes(v));
}

export default function Screen2Review({ data, onNext, onBack, apiKey }) {
  const [profile, setProfile] = useState(data.profile || {});
  const [mode, setMode] = useState(data.mode || 'fresher');
  const [loading, setLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [gapAnswers, setGapAnswers] = useState({});
  const [smartAnswers, setSmartAnswers] = useState({});
  const [selectedActivities, setSelectedActivities] = useState([]);
  const [error, setError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const companyColor = COMPANY_COLORS[data.targetCompany] || COMPANY_COLORS.other;

  useEffect(() => {
    runAnalysis();
  }, [mode]);

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      const result = await apiAnalyze({
        profile,
        targetCompany: data.targetCompany,
        jd: data.jd,
        mode,
        apiKey,
        companyType: data.companyType
      });
      setAnalysisData(result);
    } catch (e) {
      setError('Analysis failed: ' + e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  const isFresher = mode === 'fresher';
  const questions = data.questions || [];
  const audit = data.audit || [];

  // Detect weak verbs in experience bullets
  const allExpBullets = (profile.experience || []).flatMap(e => e.bullets || []);
  const weakVerbsFound = allExpBullets.flatMap(b => detectWeakVerbs(b));
  const uniqueWeak = [...new Set(weakVerbsFound)];

  async function handleBuild() {
    setLoading(true);
    setError('');
    try {
      // Merge selected activities into profile
      const updatedProfile = { ...profile };
      if (selectedActivities.length > 0) {
        updatedProfile.activities = [...(updatedProfile.activities || []), ...selectedActivities];
      }

      onNext({
        profile: updatedProfile,
        mode,
        keywords: analysisData?.keywords || [],
        gapMap: analysisData?.gap_map || [],
        gapAnswers,
        userAnswers: smartAnswers,
        companyProfile: analysisData?.company_profile,
        rawText: data.rawText
      });
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div className="anim-fade" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <h2>Review & Optimize</h2>
          {/* Mode Badge + Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <span className={`badge ${isFresher ? 'badge-cyan' : 'badge-violet'}`} style={{ fontSize: '0.8rem' }}>
              {isFresher ? '🎓 Fresher' : '💼 Experienced'}
            </span>
            <div className="toggle-wrap" onClick={() => setMode(m => m === 'fresher' ? 'experienced' : 'fresher')}>
              <button className={`toggle ${!isFresher ? 'active' : ''}`} />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Override mode</span>
            </div>
          </div>
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>
          Review your parsed data, check the analysis, and answer a few questions before we build your optimized resume.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        {/* Left Column — Editable Profile + Questions */}
        <div>
          {/* Profile Fields */}
          <div className="card anim-fade" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 16 }}>
              {isFresher && <span className="badge badge-amber" style={{ marginRight: 8, fontSize: '0.65rem' }}>⭐ Recommended</span>}
              Profile Information
            </h3>
            <div className="form-row">
              <div className="form-group">
                <label>Full Name</label>
                <input className="input" value={profile.name || ''} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input className="input" value={profile.email || ''} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Phone</label>
                <input className="input" value={profile.phone || ''} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input className="input" value={profile.location || ''} onChange={e => setProfile(p => ({ ...p, location: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>LinkedIn</label>
                <input className="input" value={profile.linkedin || ''} onChange={e => setProfile(p => ({ ...p, linkedin: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>GitHub</label>
                <input className="input" value={profile.github || ''} onChange={e => setProfile(p => ({ ...p, github: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Experience */}
          {(profile.experience || []).length > 0 && (
            <div className="card anim-fade" style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 16 }}>Work Experience</h3>
              {(profile.experience || []).map((exp, i) => (
                <div key={i} style={{
                  padding: '14px', borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border)',
                  marginBottom: 12
                }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Title / Role</label>
                      <input className="input" value={exp.title || exp.role || ''}
                        onChange={e => {
                          const updated = [...(profile.experience || [])];
                          updated[i] = { ...updated[i], title: e.target.value };
                          setProfile(p => ({ ...p, experience: updated }));
                        }} />
                    </div>
                    <div className="form-group">
                      <label>Company</label>
                      <input className="input" value={exp.company || ''}
                        onChange={e => {
                          const updated = [...(profile.experience || [])];
                          updated[i] = { ...updated[i], company: e.target.value };
                          setProfile(p => ({ ...p, experience: updated }));
                        }} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Duration</label>
                    <input className="input" value={exp.duration || ''}
                      onChange={e => {
                        const updated = [...(profile.experience || [])];
                        updated[i] = { ...updated[i], duration: e.target.value };
                        setProfile(p => ({ ...p, experience: updated }));
                      }} />
                  </div>
                  {(exp.bullets || []).length > 0 && (
                    <div>
                      <label>Bullets</label>
                      {(exp.bullets || []).map((b, bi) => (
                        <div key={bi} style={{ position: 'relative', marginBottom: 6 }}>
                          <input className="input" value={b}
                            onChange={e => {
                              const updated = [...(profile.experience || [])];
                              const bullets = [...(updated[i].bullets || [])];
                              bullets[bi] = e.target.value;
                              updated[i] = { ...updated[i], bullets };
                              setProfile(p => ({ ...p, experience: updated }));
                            }}
                            style={{
                              paddingLeft: 20,
                              borderColor: uniqueWeak.some(w => b.toLowerCase().includes(w)) ? 'rgba(245,158,11,0.4)' : undefined
                            }}
                          />
                          {uniqueWeak.some(w => b.toLowerCase().includes(w)) && (
                            <span style={{
                              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                              fontSize: '0.7rem', color: '#fcd34d'
                            }}>⚠️ weak verb</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Education */}
          {(profile.education || []).length > 0 && (
            <div className="card anim-fade" style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 16 }}>
                {isFresher && <span className="badge badge-amber" style={{ marginRight: 8, fontSize: '0.65rem' }}>⭐ Key Section</span>}
                Education
              </h3>
              {(profile.education || []).map((edu, i) => (
                <div key={i} style={{
                  padding: '14px', borderRadius: 'var(--radius-md)',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', marginBottom: 12
                }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Degree</label>
                      <input className="input" value={edu.degree || ''}
                        onChange={e => {
                          const updated = [...(profile.education || [])];
                          updated[i] = { ...updated[i], degree: e.target.value };
                          setProfile(p => ({ ...p, education: updated }));
                        }} />
                    </div>
                    <div className="form-group">
                      <label>Institution</label>
                      <input className="input" value={edu.institution || edu.school || ''}
                        onChange={e => {
                          const updated = [...(profile.education || [])];
                          updated[i] = { ...updated[i], institution: e.target.value };
                          setProfile(p => ({ ...p, education: updated }));
                        }} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Year</label>
                      <input className="input" value={edu.year || ''}
                        onChange={e => {
                          const updated = [...(profile.education || [])];
                          updated[i] = { ...updated[i], year: e.target.value };
                          setProfile(p => ({ ...p, education: updated }));
                        }} />
                    </div>
                    <div className="form-group">
                      <label>GPA / CGPA</label>
                      <input className="input" value={edu.gpa || edu.cgpa || ''}
                        onChange={e => {
                          const updated = [...(profile.education || [])];
                          updated[i] = { ...updated[i], gpa: e.target.value };
                          setProfile(p => ({ ...p, education: updated }));
                        }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Projects */}
          {(profile.projects || []).length > 0 && (
            <div className="card anim-fade" style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 16 }}>
                {isFresher && <span className="badge badge-amber" style={{ marginRight: 8, fontSize: '0.65rem' }}>⭐ Crucial</span>}
                Projects
              </h3>
              {(profile.projects || []).map((proj, i) => {
                const matchesCompany = analysisData?.company_profile?.stack
                  ? (proj.tech || []).some(t => analysisData.company_profile.stack.map(s => s.toLowerCase()).some(s => s.includes(t.toLowerCase()) || t.toLowerCase().includes(s)))
                  : false;
                return (
                  <div key={i} style={{
                    padding: '14px', borderRadius: 'var(--radius-md)',
                    background: 'rgba(255,255,255,0.03)', border: `1px solid ${matchesCompany ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
                    marginBottom: 12
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label>Project Name</label>
                        <input className="input" value={proj.name || proj.title || ''}
                          onChange={e => {
                            const updated = [...(profile.projects || [])];
                            updated[i] = { ...updated[i], name: e.target.value };
                            setProfile(p => ({ ...p, projects: updated }));
                          }} />
                      </div>
                      {matchesCompany && (
                        <span className="badge badge-green" style={{ marginTop: 20, flexShrink: 0 }}>
                          <Filter size={10} /> Stack Match
                        </span>
                      )}
                    </div>
                    <div className="form-group">
                      <label>Tech Stack</label>
                      <input className="input" value={(proj.tech || []).join(', ')}
                        onChange={e => {
                          const updated = [...(profile.projects || [])];
                          updated[i] = { ...updated[i], tech: e.target.value.split(',').map(t => t.trim()) };
                          setProfile(p => ({ ...p, projects: updated }));
                        }} />
                    </div>
                    <div className="form-group">
                      <label>GitHub Link</label>
                      <input className="input" value={proj.link || ''}
                        onChange={e => {
                          const updated = [...(profile.projects || [])];
                          updated[i] = { ...updated[i], link: e.target.value };
                          setProfile(p => ({ ...p, projects: updated }));
                        }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Fresher Activity Chips */}
          {isFresher && (
            <div className="card anim-fade" style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Award size={16} color="#fcd34d" />
                Did you do any of these?
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                These extra-curriculars can strengthen a fresher resume significantly.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {FRESHER_ACTIVITIES.map(act => {
                  const isSelected = selectedActivities.includes(act.label);
                  return (
                    <button
                      key={act.label}
                      onClick={() => setSelectedActivities(prev =>
                        isSelected ? prev.filter(a => a !== act.label) : [...prev, act.label]
                      )}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-full)',
                        border: `1px solid ${isSelected ? 'rgba(16,185,129,0.5)' : 'var(--border)'}`,
                        background: isSelected ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
                        color: isSelected ? '#6ee7b7' : 'var(--text-secondary)',
                        cursor: 'pointer', fontSize: '0.82rem', fontWeight: isSelected ? 600 : 400,
                        transition: 'all 0.15s', fontFamily: 'inherit'
                      }}
                    >
                      {act.icon} {act.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Smart Questions */}
          {questions.length > 0 && (
            <div className="card anim-fade" style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <HelpCircle size={16} color="#a5b4fc" />
                Smart Questions
                <span className="badge badge-muted" style={{ marginLeft: 4 }}>Skippable</span>
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                Your answers will be used to add measurable impact to your resume. All are optional.
              </p>
              {questions.slice(0, 3).map((q, i) => (
                <div key={i} className="form-group">
                  <label style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600, fontSize: '0.87rem', color: 'var(--text-primary)' }}>
                    {i + 1}. {q}
                  </label>
                  <input
                    className="input"
                    placeholder="Your answer (optional)..."
                    value={smartAnswers[i] || ''}
                    onChange={e => setSmartAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column — Company Brief + Audit + Gap Map */}
        <div>
          {/* Company Brief */}
          <div className="card anim-fade" style={{ marginBottom: 16, borderColor: companyColor.border }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Building2 size={18} color={companyColor.text} />
              <h3 style={{ fontSize: '1rem', color: companyColor.text }}>
                {analysisData?.company_profile?.name || data.targetCompany.toUpperCase()}
              </h3>
            </div>
            {analysisData?.company_profile?.hiringStyle && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.7 }}>
                {analysisData.company_profile.hiringStyle}
              </p>
            )}
            {analysisData?.company_profile?.coreValues && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {analysisData.company_profile.coreValues.slice(0, 4).map(v => (
                  <span key={v} className="badge badge-muted" style={{ fontSize: '0.7rem' }}>{v}</span>
                ))}
              </div>
            )}
          </div>

          {/* Input Audit */}
          {audit.length > 0 && (
            <div className="card anim-fade" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
                <AlertTriangle size={15} color="#fcd34d" /> Input Audit
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {audit.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                    padding: '8px 10px',
                    background: 'rgba(245,158,11,0.06)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(245,158,11,0.15)'
                  }}>
                    <AlertTriangle size={13} color="#fcd34d" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gap Map */}
          {analyzing ? (
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
              <div className="spinner" />
            </div>
          ) : analysisData?.gap_map && (
            <div className="card anim-fade" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
                <Lightbulb size={15} color="#a5b4fc" /> Skill Gap Map
              </h3>

              {/* Strong */}
              {analysisData.gap_map.filter(g => g.status === 'strong').length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: '0.72rem', color: '#6ee7b7', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    ✓ Strong
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {analysisData.gap_map.filter(g => g.status === 'strong').map(g => (
                      <span key={g.skill} className="badge badge-green" style={{ fontSize: '0.72rem' }}>{g.skill}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Weak */}
              {analysisData.gap_map.filter(g => g.status === 'weak').length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: '0.72rem', color: '#fcd34d', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    ⚠ Needs Work
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {analysisData.gap_map.filter(g => g.status === 'weak').map(g => (
                      <span key={g.skill} className="badge badge-amber" style={{ fontSize: '0.72rem' }}>{g.skill}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing — with Yes/No toggles */}
              {analysisData.gap_map.filter(g => g.status === 'missing').length > 0 && (
                <div>
                  <div style={{ fontSize: '0.72rem', color: '#fda4af', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    ✗ Missing
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {analysisData.gap_map.filter(g => g.status === 'missing').map(g => (
                      <div key={g.skill} style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(244,63,94,0.05)',
                        border: '1px solid rgba(244,63,94,0.15)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: g.suggestion ? 6 : 0 }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{g.skill}</span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              onClick={() => setGapAnswers(prev => ({ ...prev, [g.skill]: true }))}
                              style={{
                                padding: '2px 10px', borderRadius: 'var(--radius-full)',
                                fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                                border: `1px solid ${gapAnswers[g.skill] === true ? 'rgba(16,185,129,0.6)' : 'var(--border)'}`,
                                background: gapAnswers[g.skill] === true ? 'rgba(16,185,129,0.15)' : 'transparent',
                                color: gapAnswers[g.skill] === true ? '#6ee7b7' : 'var(--text-muted)',
                                fontFamily: 'inherit'
                              }}
                            >Yes</button>
                            <button
                              onClick={() => setGapAnswers(prev => ({ ...prev, [g.skill]: false }))}
                              style={{
                                padding: '2px 10px', borderRadius: 'var(--radius-full)',
                                fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                                border: `1px solid ${gapAnswers[g.skill] === false ? 'rgba(244,63,94,0.6)' : 'var(--border)'}`,
                                background: gapAnswers[g.skill] === false ? 'rgba(244,63,94,0.1)' : 'transparent',
                                color: gapAnswers[g.skill] === false ? '#fda4af' : 'var(--text-muted)',
                                fontFamily: 'inherit'
                              }}
                            >No</button>
                          </div>
                        </div>
                        {g.suggestion && (
                          <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                            💡 {g.suggestion}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Matched GitHub Projects */}
          {(analysisData?.matched_projects || []).length > 0 && (
            <div className="card anim-fade" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
                <Code2 size={15} /> Stack-Matched Projects
              </h3>
              {(analysisData.matched_projects || []).map((proj, i) => (
                <div key={i} style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  background: 'rgba(16,185,129,0.05)',
                  marginBottom: 6
                }}>
                  <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 3 }}>{proj.name}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(proj.tech || []).slice(0, 4).map(t => (
                      <span key={t} className="badge badge-green" style={{ fontSize: '0.65rem' }}>{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: 16,
          background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)',
          color: '#fda4af', fontSize: '0.85rem'
        }}>{error}</div>
      )}

      {/* Nav Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
        <button className="btn btn-ghost" onClick={onBack}>
          <ChevronLeft size={16} /> Back
        </button>
        <button className="btn btn-primary btn-lg" onClick={handleBuild} disabled={loading}>
          {loading ? (
            <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Building Resume...</>
          ) : (
            <><Sparkles size={18} /> Build Optimized Resume</>
          )}
        </button>
      </div>
    </div>
  );
}
