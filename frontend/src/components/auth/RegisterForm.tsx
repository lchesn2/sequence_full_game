import { useState, type FormEvent } from 'react';

interface Props {
  onRegister: (username: string, password: string) => Promise<void>;
  onSwitchToLogin: () => void;
  error: string;
  isLoading: boolean;
}

export default function RegisterForm({ onRegister, onSwitchToLogin, error, isLoading }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError('');
    if (password !== confirm) {
      setLocalError('Passwords do not match');
      return;
    }
    await onRegister(username, password);
  }

  const displayError = localError || error;

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Sequence</h1>
        <p className="auth-subtitle">Create an account</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="reg-username">Username</label>
            <input
              id="reg-username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="3–20 chars, letters/numbers/_"
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-confirm">Confirm Password</label>
            <input
              id="reg-confirm"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat password"
              autoComplete="new-password"
              required
            />
          </div>

          {displayError && <p className="auth-error">{displayError}</p>}

          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? 'Creating account…' : 'Register'}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{' '}
          <button className="link-btn" onClick={onSwitchToLogin}>
            Sign In
          </button>
        </p>
      </div>
    </div>
  );
}
