import { useState, useEffect } from 'react';
import {
  apiLogin, apiRegister,
  saveToken, saveUsername, clearToken,
  getSavedToken, getSavedUsername,
} from './api/client';
import LoginForm from './components/auth/LoginForm';
import RegisterForm from './components/auth/RegisterForm';
import GameScreen from './components/game/GameScreen';

type View = 'login' | 'register' | 'game';

export default function App() {
  const [view, setView] = useState<View>('login');
  const [username, setUsername] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Restore session from sessionStorage on first load
  useEffect(() => {
    const token = getSavedToken();
    const user = getSavedUsername();
    if (token && user) {
      setUsername(user);
      setView('game');
    }
  }, []);

  async function handleLogin(user: string, pass: string) {
    setAuthError('');
    setIsLoading(true);
    try {
      const res = await apiLogin(user, pass);
      saveToken(res.token);
      saveUsername(res.username);
      setUsername(res.username);
      setView('game');
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegister(user: string, pass: string) {
    setAuthError('');
    setIsLoading(true);
    try {
      const res = await apiRegister(user, pass);
      saveToken(res.token);
      saveUsername(res.username);
      setUsername(res.username);
      setView('game');
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  }

  function handleLogout() {
    clearToken();
    setUsername('');
    setAuthError('');
    setView('login');
  }

  if (view === 'game') {
    return <GameScreen username={username} onLogout={handleLogout} />;
  }

  if (view === 'register') {
    return (
      <RegisterForm
        onRegister={handleRegister}
        onSwitchToLogin={() => { setAuthError(''); setView('login'); }}
        error={authError}
        isLoading={isLoading}
      />
    );
  }

  return (
    <LoginForm
      onLogin={handleLogin}
      onSwitchToRegister={() => { setAuthError(''); setView('register'); }}
      error={authError}
      isLoading={isLoading}
    />
  );
}
