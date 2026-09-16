import { useState } from 'react';
import Calculator from './components/Calculator.jsx';

const ACCESS_CODE = 'dbf123';
const SESSION_KEY = 'sae_unlocked_until';
const SESSION_DURATION = 60 * 60 * 1000; // 1 hour

function isSessionValid() {
  const expiry = localStorage.getItem(SESSION_KEY);
  return expiry && Date.now() < Number(expiry);
}

function saveSession() {
  localStorage.setItem(SESSION_KEY, Date.now() + SESSION_DURATION);
}

function LockScreen({ onUnlock }) {
  const [input, setInput] = useState('');
  const [failed, setFailed] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (input === ACCESS_CODE) {
      saveSession();
      onUnlock();
    } else {
      setFailed(true);
      setInput('');
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center px-4" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div className="w-full max-w-xs">
        <h1 className="text-2xl font-bold text-white tracking-tight mb-2">SAE Aero Calculator</h1>
        <p className="text-sm text-gray-400 mb-8">Enter access code to continue.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            aria-label="Access code"
            value={input}
            onChange={e => { setInput(e.target.value); setFailed(false); }}
            placeholder="Access code"
            autoFocus
            className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          {failed && <p className="text-red-400 text-sm">Incorrect access code.</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium rounded px-3 py-2 text-sm transition-colors"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [unlocked, setUnlocked] = useState(isSessionValid);
  if (!unlocked) return <LockScreen onUnlock={() => setUnlocked(true)} />;
  return <Calculator />;
}
