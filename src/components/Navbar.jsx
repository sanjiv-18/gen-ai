import { useState } from 'react';
import { Sparkles, Key, X, Eye, EyeOff, Check, ArrowRight } from 'lucide-react';

export default function Navbar({ step, apiKey, onApiKeyChange, onReset, onStepClick }) {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey || '');
  const [showKey, setShowKey] = useState(false);

  const steps = [
    { num: 1, label: 'Input' },
    { num: 2, label: 'Review' },
    { num: 3, label: 'Tailored Resume' },
  ];

  function saveKey() {
    onApiKeyChange(tempKey.trim());
    setShowKeyModal(false);
  }

  function handleLogoClick() {
    if (onReset) onReset();
    else window.location.href = '/';
  }

  return (
    <>
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(9, 10, 15, 0.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 28px',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: 'var(--inner-highlight)'
      }}>
        {/* Brand Logo */}
        <div
          onClick={handleLogoClick}
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}
          title="Return to Home / Start Over"
        >
          <div style={{
            width: 34, height: 34, borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--inner-highlight)'
          }}>
            <Sparkles size={16} color="#60a5fa" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
              CareerLens
            </span>
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 4,
              background: 'rgba(59, 130, 246, 0.12)',
              color: '#93c5fd',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              letterSpacing: '0.04em'
            }}>
              AI
            </span>
          </div>
        </div>

        {/* Step Progress Tracker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {steps.map((s, i) => {
            const isCurrent = step === s.num;
            const isCompleted = step > s.num;
            return (
              <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => isCompleted && onStepClick && onStepClick(s.num)}
                  disabled={!isCompleted}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: isCurrent
                      ? 'rgba(255, 255, 255, 0.08)'
                      : isCompleted ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                    border: `1px solid ${isCurrent ? 'rgba(255, 255, 255, 0.2)' : isCompleted ? 'var(--border)' : 'transparent'}`,
                    cursor: isCompleted ? 'pointer' : 'default',
                    color: isCurrent ? '#ffffff' : isCompleted ? 'var(--text-secondary)' : 'var(--text-muted)',
                    fontSize: '0.8rem',
                    fontWeight: isCurrent ? 700 : 500,
                    letterSpacing: '-0.01em',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 700,
                    background: isCompleted ? 'var(--emerald)' : isCurrent ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                    color: isCompleted || isCurrent ? '#ffffff' : 'var(--text-muted)'
                  }}>
                    {isCompleted ? <Check size={11} strokeWidth={3} /> : s.num}
                  </span>
                  <span>{s.label}</span>
                </button>

                {i < steps.length - 1 && (
                  <ArrowRight size={12} color="rgba(255, 255, 255, 0.2)" />
                )}
              </div>
            );
          })}
        </div>

        {/* API Key Trigger */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowKeyModal(true)}
          style={{ gap: 7 }}
        >
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: apiKey ? 'var(--emerald)' : 'var(--text-muted)'
          }} />
          <Key size={13} />
          <span>{apiKey ? 'Custom Gemini Key' : 'Free Demo Key'}</span>
        </button>
      </nav>

      {/* ── API Key Modal ── */}
      {showKeyModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => setShowKeyModal(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 460, background: 'var(--bg-surface)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <h3 style={{ marginBottom: 4 }}>Gemini API Settings</h3>
                <p style={{ fontSize: '0.84rem' }}>
                  Provide your personal key for live Gemini 2.0 Flash generation, or use the built-in deterministic engine.
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowKeyModal(false)}
                style={{ padding: 4 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Input field */}
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <input
                className="input"
                type={showKey ? 'text' : 'password'}
                placeholder="AIzaSy..."
                value={tempKey}
                onChange={e => setTempKey(e.target.value)}
                style={{ paddingRight: 42, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.84rem' }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                }}
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {/* Helper note */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '11px 14px',
              marginBottom: 20,
              fontSize: '0.8rem',
              color: 'var(--text-secondary)'
            }}>
              Free keys can be created in seconds at{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#60a5fa', textDecoration: 'none', fontWeight: 600 }}
              >
                Google AI Studio ↗
              </a>
              . Without a key, all presets and ATS analysis run via the instant mock engine.
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setTempKey(''); onApiKeyChange(''); setShowKeyModal(false); }}
              >
                Clear
              </button>
              <button className="btn btn-primary btn-sm" onClick={saveKey}>
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
