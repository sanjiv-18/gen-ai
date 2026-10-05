import { useState } from 'react';
import { Zap, Key, X, Eye, EyeOff } from 'lucide-react';

export default function Navbar({ step, apiKey, onApiKeyChange }) {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey]   = useState(apiKey || '');
  const [showKey, setShowKey]   = useState(false);

  const steps = [
    { num: 1, label: 'Input' },
    { num: 2, label: 'Review' },
    { num: 3, label: 'Result' },
  ];

  function saveKey() {
    onApiKeyChange(tempKey.trim());
    setShowKeyModal(false);
  }

  return (
    <>
      {/* ── Nav bar ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8, 10, 24, 0.88)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(37,42,74,0.9)',
        padding: '0 24px',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 0 rgba(99,102,241,0.08), 0 4px 24px rgba(0,0,0,0.4)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(99,102,241,0.45)',
          }}>
            <Zap size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em', color: '#F8FAFF' }}>
              CareerLens <span className="gradient-text">AI</span>
            </div>
            <div style={{ fontSize: '0.65rem', color: '#8D96B3', marginTop: -2 }}>ATS Resume Builder</div>
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
                  : step > s.num ? '#34d399' : 'rgba(255,255,255,0.06)',
                border: step === s.num ? 'none' : step > s.num ? 'none' : '1px solid rgba(37,42,74,0.9)',
                boxShadow: step === s.num ? '0 0 18px rgba(99,102,241,0.55)' : 'none',
                color: step >= s.num ? 'white' : '#8D96B3',
                transition: 'all 0.3s ease',
                position: 'relative',
              }}>
                {step > s.num ? '✓' : s.num}
                {step === s.num && (
                  <div style={{
                    position: 'absolute', bottom: -20,
                    fontSize: '0.63rem', fontWeight: 600,
                    color: '#a5b4fc', whiteSpace: 'nowrap',
                  }}>{s.label}</div>
                )}
              </div>
              {i < steps.length - 1 && (
                <div style={{
                  width: 48, height: 2,
                  background: step > s.num ? '#34d399' : 'rgba(37,42,74,0.9)',
                  transition: 'background 0.3s ease',
                }} />
              )}
            </div>
          ))}
        </div>

        {/* API Key Button */}
        <button className="btn btn-ghost btn-sm" onClick={() => setShowKeyModal(true)} style={{ gap: 6 }}>
          <Key size={14} />
          {apiKey
            ? <span style={{ color: '#34d399' }}>API Key ✓</span>
            : <span style={{ color: '#B8C0D9' }}>API Key</span>}
        </button>
      </nav>

      {/* ── API Key Modal ── */}
      {showKeyModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setShowKeyModal(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 460, background: '#0D1025', border: '1px solid rgba(99,102,241,0.3)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ color: '#F8FAFF', marginBottom: 4 }}>Gemini API Key</h3>
                <p style={{ fontSize: '0.8rem', color: '#8D96B3' }}>
                  Required for real AI generation. Leave blank to use demo mode.
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowKeyModal(false)}>
                <X size={16} />
              </button>
            </div>

            {/* Input */}
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
                  background: 'none', border: 'none', cursor: 'pointer', color: '#8D96B3',
                }}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Info box */}
            <div style={{
              background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              fontSize: '0.8rem', color: '#a5f3fc',
            }}>
              💡 Get your free key at{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
                style={{ color: '#22d3ee', textDecoration: 'underline' }}>
                Google AI Studio
              </a>
              . Use Gemini 2.0 Flash for best results.
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setTempKey(''); onApiKeyChange(''); setShowKeyModal(false); }}
              >
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
