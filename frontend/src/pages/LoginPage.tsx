import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { useI18n } from '../i18n';

export default function LoginPage() {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        await login(name, password);
      } else {
        await register(name, password);
      }
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401) setError(t.auth.invalidCredentials);
        else if (err.status === 409) setError(t.auth.nameTaken);
        else if (err.status === 400) setError(t.auth.shortPassword);
        else setError(t.auth.genericError);
      } else {
        setError(t.auth.offline);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <img className="auth-logo" src="/logo.png" alt="" width={112} height={112} />
        <h1 className="auth-title">{t.app.name}</h1>
        <p className="auth-subtitle">
          {mode === 'login' ? t.auth.loginSubtitle : t.auth.registerSubtitle}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>{t.auth.username}</span>
            <input
              className="input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label className="field">
            <span>{t.auth.password}</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'register' ? 6 : undefined}
              required
            />
          </label>

          {error && <p className="field-error">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? t.auth.submitting : mode === 'login' ? t.auth.login : t.auth.register}
          </button>
        </form>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        >
          {mode === 'login' ? t.auth.toRegister : t.auth.toLogin}
        </button>
      </div>
    </div>
  );
}
