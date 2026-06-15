import { useState, FormEvent } from "react";

interface Props {
  onLogin: (username: string, password: string) => Promise<void>;
  error: string;
}

export default function LoginForm({ onLogin, error }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onLogin(username, password);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vs-login-wrap">
      <form className="vs-login-card" onSubmit={handleSubmit}>
        <div className="vs-login-title">VeloIQ Studio</div>
        <div className="vs-login-sub">Sign in with your Admin account</div>

        <div className="vs-field">
          <label>Username</label>
          <input
            type="text"
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="vs-field">
          <label>Password</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button className="vs-btn-primary" type="submit" disabled={loading || !username}>
          {loading ? "Signing in…" : "Sign in"}
        </button>

        {error && <div className="vs-error-msg">{error}</div>}
      </form>
    </div>
  );
}
