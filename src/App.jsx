import { useState, Component } from 'react';
import './index.css';
import Navbar from './components/Navbar';
import Screen1Input from './components/Screen1Input';
import Screen2Review from './components/Screen2Review';
import Screen3Result from './components/Screen3Result';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("CareerLens Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0B0F17', color: '#fff', padding: 24, textAlign: 'center'
        }}>
          <div style={{
            maxWidth: 500, padding: 32, borderRadius: 16, background: '#161F30',
            border: '1px solid rgba(239, 68, 68, 0.3)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ color: '#EF4444', marginBottom: 12 }}>Something went wrong</h2>
            <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginBottom: 20 }}>
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <button
              className="btn btn-primary"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/';
              }}
            >
              🔄 Return to Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Animated background grid
const BGGrid = () => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
    backgroundImage: `
      radial-gradient(ellipse at 20% 10%, rgba(99,102,241,0.12) 0%, transparent 50%),
      radial-gradient(ellipse at 80% 90%, rgba(139,92,246,0.08) 0%, transparent 50%),
      linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
    `,
    backgroundSize: '100% 100%, 100% 100%, 48px 48px, 48px 48px'
  }} />
);

export default function App() {
  const [step, setStep] = useState(1);
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem('cl_apikey') || ''; } catch { return ''; }
  });
  const [screen1Data, setScreen1Data] = useState(null);
  const [buildPayload, setBuildPayload] = useState(null);

  function handleApiKeyChange(key) {
    setApiKey(key);
    try {
      if (key) localStorage.setItem('cl_apikey', key);
      else localStorage.removeItem('cl_apikey');
    } catch {}
  }

  function handleScreen1Next(data) {
    setScreen1Data(data);
    setStep(2);
  }

  function handleScreen2Next(data) {
    setBuildPayload({
      ...data,
      targetCompany: screen1Data?.targetCompany || 'other',
      jd: screen1Data?.jd || '',
      rawText: screen1Data?.rawText || data.rawText || '',
    });
    setStep(3);
  }

  function goBack() {
    setStep(s => Math.max(1, s - 1));
  }

  return (
    <ErrorBoundary>
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', position: 'relative' }}>
        <BGGrid />
        <Navbar
          step={step}
          apiKey={apiKey}
          onApiKeyChange={handleApiKeyChange}
          onReset={() => {
            setStep(1);
            setScreen1Data(null);
            setBuildPayload(null);
          }}
          onStepClick={(s) => setStep(s)}
        />
        <main style={{ paddingBottom: 60, position: 'relative', zIndex: 1 }}>
          {step === 1 && (
            <div className="anim-fade">
              <Screen1Input onNext={handleScreen1Next} apiKey={apiKey} />
            </div>
          )}
          {step === 2 && screen1Data && (
            <div className="anim-fade">
              <Screen2Review
                data={screen1Data}
                onNext={handleScreen2Next}
                onBack={goBack}
                apiKey={apiKey}
              />
            </div>
          )}
          {step === 3 && buildPayload && (
            <div className="anim-fade">
              <Screen3Result
                data={buildPayload}
                onBack={goBack}
                apiKey={apiKey}
              />
            </div>
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}
