import { useState, type FormEvent } from 'react';

interface Props {
  onLogin: (username: string, password: string) => Promise<void>;
  onSwitchToRegister: () => void;
  error: string;
  isLoading: boolean;
}

export default function LoginForm({ onLogin, onSwitchToRegister, error, isLoading }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onLogin(username, password);
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Sequence</h1>
        <p className="auth-subtitle">Sign in to play</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="auth-switch">
          No account?{' '}
          <button className="link-btn" onClick={onSwitchToRegister}>
            Register
          </button>
        </p>
      </div>
    </div>
  );
}
