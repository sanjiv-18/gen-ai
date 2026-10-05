import { useState } from 'react';
import { Zap, Key, X, ChevronDown, Eye, EyeOff } from 'lucide-react';

export default function Navbar({ step, apiKey, onApiKeyChange }) {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey || '');
  const [showKey, setShowKey] = useState(false);

  const steps = [
    { num: 1, label: 'Input' },
    { num: 2, label: 'Review' },
    { num: 3, label: 'Result' }
  ];

  function saveKey() {
    onApiKeyChange(tempKey.trim());
    setShowKeyModal(false);
  }

  return (
    <>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,8,18,0.85)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 24px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Zap size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em' }}>
              CareerLens <span className="gradient-text">AI</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: -2 }}>ATS Resume Builder</div>
          </div>
        </div>

        {/* Step Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {steps.map((s, i) => (
            <div key={s.num} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.78rem', fontWeight: 700,
                background: step === s.num
                  ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
                  : step > s.num ? '#10b981' : 'rgba(255,255,255,0.06)',
                border: step === s.num ? 'none' : step > s.num ? 'none' : '1px solid rgba(255,255,255,0.1)',
                boxShadow: step === s.num ? '0 0 16px rgba(99,102,241,0.5)' : 'none',
                color: step >= s.num ? 'white' : 'var(--text-muted)',
                transition: 'all 0.3s ease',
                position: 'relative',
              }}>
                {step > s.num ? '✓' : s.num}
                {step === s.num && (
                  <div style={{
                    position: 'absolute', bottom: -18,
                    fontSize: '0.65rem', fontWeight: 600,
                    color: '#a5b4fc', whiteSpace: 'nowrap'
                  }}>{s.label}</div>
                )}
              </div>
              {i < steps.length - 1 && (
                <div style={{
                  width: 48, height: 2,
                  background: step > s.num ? '#10b981' : 'rgba(255,255,255,0.08)',
                  transition: 'background 0.3s ease'
                }} />
              )}
            </div>
          ))}
        </div>

        {/* API Key Button */}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowKeyModal(true)}
          style={{ gap: 6 }}
        >
          <Key size={14} />
          {apiKey ? (
            <span style={{ color: '#6ee7b7' }}>API Key ✓</span>
          ) : (
            <span>API Key</span>
          )}
        </button>
      </nav>

      {/* API Key Modal */}
      {showKeyModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24
        }} onClick={() => setShowKeyModal(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>Gemini API Key</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Required for real AI generation. Leave blank to use demo mode.
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowKeyModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ position: 'relative', marginBottom: 12 }}>
              <input
                className="input"
                type={showKey ? 'text' : 'password'}
                placeholder="AIza..."
                value={tempKey}
                onChange={e => setTempKey(e.target.value)}
                style={{ paddingRight: 44 }}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)'
                }}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div style={{
              background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              fontSize: '0.8rem', color: '#67e8f9'
            }}>
              💡 Get your free key at{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
                style={{ color: '#67e8f9', textDecoration: 'underline' }}>
                Google AI Studio
              </a>
              . Use Gemini 2.0 Flash for best results.
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setTempKey(''); onApiKeyChange(''); setShowKeyModal(false); }}>
                Clear
              </button>
              <button className="btn btn-primary btn-sm" onClick={saveKey}>Save Key</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
