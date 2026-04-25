'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export default function LoginPage() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstLoginUser, setFirstLoginUser] = useState<{ fullName: string; role: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const data = await api.login(userId, password);
      if (data.isFirstLogin) {
        setIsFirstLogin(true);
        setResetToken(data.resetToken);
        setFirstLoginUser(data.user);
        setIsLoading(false);
        return;
      }
      const user = data.user;
      login(user, data.token);
      switch (user.role) {
        case 'admin': router.push('/admin/dashboard'); break;
        case 'student': router.push('/student/dashboard'); break;
        case 'faculty': router.push('/faculty/dashboard'); break;
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/;
    if (!passwordRegex.test(newPassword)) { setError('Password must contain uppercase, lowercase, number, and special character.'); return; }
    setIsLoading(true);
    try {
      const data = await api.setPassword(resetToken, newPassword);
      login({ id: '', userId, email: '', fullName: firstLoginUser?.fullName || '', role: (firstLoginUser?.role || 'student') as 'admin' | 'student' | 'faculty' }, data.token);
      const role = firstLoginUser?.role || 'student';
      router.push(`/${role}/dashboard`);
    } catch (err: any) {
      setError(err.message || 'Failed to set password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setForgotSuccess('');
    setIsLoading(true);
    try {
      const data = await api.forgotPassword(forgotEmail);
      setForgotSuccess(data.message);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .lr {
          font-family: 'DM Sans', sans-serif;
          min-height: 100vh;
          background: #fdf8f3;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          position: relative;
          overflow: hidden;
        }

        /* ── Background ── */
        .lr-bg {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .lr-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 70% 55% at 10% 5%,  rgba(251,146,60,0.18)  0%, transparent 55%),
            radial-gradient(ellipse 60% 50% at 90% 90%, rgba(249,115,22,0.13)  0%, transparent 55%),
            radial-gradient(ellipse 50% 40% at 50% 50%, rgba(253,186,116,0.08) 0%, transparent 60%);
        }
        .lr-bg::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, rgba(0,0,0,0.045) 1px, transparent 1px);
          background-size: 22px 22px;
          mask-image: radial-gradient(ellipse 90% 90% at 50% 50%, black 30%, transparent 80%);
        }

        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(70px);
          pointer-events: none;
          z-index: 0;
          animation: orbDrift 16s ease-in-out infinite alternate;
        }
        .orb-1 { width: 480px; height: 480px; background: rgba(251,146,60,0.15);  top:-10%; left:-8%; animation-delay:0s; }
        .orb-2 { width: 360px; height: 360px; background: rgba(249,115,22,0.10); bottom:-8%; right:-6%; animation-delay:-6s; }
        .orb-3 { width: 260px; height: 260px; background: rgba(253,186,116,0.12); top:40%; left:60%; animation-delay:-11s; }
        @keyframes orbDrift {
          from { transform: translate(0,0) scale(1); }
          to   { transform: translate(28px,22px) scale(1.07); }
        }

        /* ── Wrap ── */
        .lr-wrap {
          width: 100%;
          max-width: 440px;
          position: relative;
          z-index: 10;
          animation: fadeUp .5s cubic-bezier(.22,1,.36,1) both;
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(24px); }
          to   { opacity:1; transform:translateY(0); }
        }

        /* ── Logo ── */
        .lr-logo { text-align:center; margin-bottom:1.75rem; animation:fadeUp .5s cubic-bezier(.22,1,.36,1) .05s both; }
        .lr-logo-icon {
          display:inline-flex; align-items:center; justify-content:center;
          width:54px; height:54px; border-radius:16px;
          background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
          box-shadow: 0 0 0 1px rgba(249,115,22,0.35), 0 8px 28px rgba(249,115,22,0.30);
          margin-bottom:.85rem; position:relative; overflow:hidden;
        }
        .lr-logo-icon::after {
          content:''; position:absolute; inset:0;
          background:linear-gradient(135deg,rgba(255,255,255,0.28) 0%,transparent 55%);
        }
        .lr-logo-icon svg { width:26px; height:26px; color:#fff; position:relative; z-index:1; }
        .lr-logo-title {
          font-family:'Syne',sans-serif; font-size:2rem; font-weight:800;
          letter-spacing:-0.03em; line-height:1; margin-bottom:.3rem;
        }
        .lr-logo-title .pa { color:#ea580c; }
        .lr-logo-title .pb { color:#f97316; }
        .lr-logo-sub {
          font-size:.73rem; color:#a78469; letter-spacing:.09em;
          text-transform:uppercase; font-weight:500;
        }

        /* ── Card ── */
        .lr-card {
          background: rgba(255,255,255,0.82);
          border: 1px solid rgba(249,115,22,0.12);
          border-radius: 22px;
          padding: 2rem 2rem 1.75rem;
          backdrop-filter: blur(20px);
          box-shadow:
            0 1px 0 rgba(255,255,255,0.9) inset,
            0 4px 8px rgba(0,0,0,0.04),
            0 20px 60px rgba(0,0,0,0.08),
            0 0 0 1px rgba(249,115,22,0.06);
          animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .12s both;
        }

        .lr-hg { border-bottom:1px solid rgba(0,0,0,0.06); padding-bottom:1.2rem; margin-bottom:1.4rem; }
        .lr-heading {
          font-family:'Syne',sans-serif; font-size:1.3rem; font-weight:700;
          color:#1c0a00; letter-spacing:-.02em; margin-bottom:.25rem;
        }
        .lr-sub { font-size:.83rem; color:#9a7b6a; }
        .lr-sub span { color:#ea580c; font-weight:500; }

        .lr-fg { margin-bottom:1rem; }
        .lr-label {
          display:block; font-size:.72rem; font-weight:600; color:#7c5a4a;
          margin-bottom:.45rem; letter-spacing:.06em; text-transform:uppercase;
        }
        .lr-iw { position:relative; }
        .lr-icon {
          position:absolute; left:13px; top:50%; transform:translateY(-50%);
          color:#c4977a; pointer-events:none; transition:color .2s;
        }
        .lr-icon svg { width:15px; height:15px; display:block; }

        input[type=text], input[type=email], input[type=password] {
          width:100%;
          background: rgba(255,248,240,0.9);
          border: 1px solid rgba(0,0,0,0.1);
          border-radius:11px;
          color:#1c0a00;
          font-family:'DM Sans',sans-serif;
          font-size:.9rem;
          padding:.72rem 1rem .72rem 2.5rem;
          outline:none;
          transition: border-color .2s, box-shadow .2s, background .2s;
          -webkit-appearance:none;
        }
        input[type=text]:focus,
        input[type=email]:focus,
        input[type=password]:focus {
          border-color: rgba(249,115,22,0.55);
          background: #fff;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.1);
        }
        input::placeholder { color:#c4a08a; }
        .lr-iw:focus-within .lr-icon { color:#f97316; }

        .lr-eye {
          position:absolute; right:11px; top:50%; transform:translateY(-50%);
          background:none; border:none; padding:4px; cursor:pointer;
          color:#c4977a; transition:color .2s; display:flex;
        }
        .lr-eye:hover { color:#ea580c; }
        .lr-eye svg { width:15px; height:15px; }

        .btn-orange {
          width:100%; padding:.78rem 1.5rem;
          background: linear-gradient(135deg, #ea580c 0%, #f97316 100%);
          border: 1px solid rgba(234,88,12,0.4);
          border-radius:12px; color:#fff;
          font-family:'Syne',sans-serif; font-size:.92rem; font-weight:700;
          cursor:pointer; margin-top:.4rem;
          display:flex; align-items:center; justify-content:center; gap:8px;
          transition:all .2s;
          box-shadow: 0 4px 18px rgba(234,88,12,0.28), inset 0 1px 0 rgba(255,255,255,0.18);
          position:relative; overflow:hidden;
        }
        .btn-orange::before {
          content:''; position:absolute; inset:0;
          background:linear-gradient(135deg,rgba(255,255,255,0.15) 0%,transparent 55%);
          opacity:0; transition:opacity .2s;
        }
        .btn-orange:hover:not(:disabled)::before { opacity:1; }
        .btn-orange:hover:not(:disabled) {
          transform:translateY(-1px);
          box-shadow:0 8px 26px rgba(234,88,12,0.35), inset 0 1px 0 rgba(255,255,255,0.18);
        }
        .btn-orange:active:not(:disabled) { transform:translateY(0); }
        .btn-orange:disabled { opacity:.5; cursor:not-allowed; }

        .btn-green {
          width:100%; padding:.78rem 1.5rem;
          background:linear-gradient(135deg,#16a34a 0%,#22c55e 100%);
          border:1px solid rgba(22,163,74,0.4);
          border-radius:12px; color:#fff;
          font-family:'Syne',sans-serif; font-size:.92rem; font-weight:700;
          cursor:pointer; margin-top:.4rem;
          display:flex; align-items:center; justify-content:center; gap:8px;
          transition:all .2s;
          box-shadow:0 4px 18px rgba(22,163,74,0.22), inset 0 1px 0 rgba(255,255,255,0.18);
        }
        .btn-green:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 8px 24px rgba(22,163,74,0.3); }
        .btn-green:disabled { opacity:.5; cursor:not-allowed; }

        .btn-ghost {
          width:100%; background:none; border:none; padding:.45rem;
          color:#9a7b6a; font-family:'DM Sans',sans-serif; font-size:.82rem;
          cursor:pointer; transition:color .2s; margin-top:.2rem;
        }
        .btn-ghost:hover { color:#ea580c; }

        .back-link {
          display:inline-flex; align-items:center; gap:5px;
          font-size:.8rem; color:#9a7b6a; background:none; border:none;
          padding:0; cursor:pointer; transition:color .2s;
          margin-bottom:1.2rem; font-family:'DM Sans',sans-serif;
        }
        .back-link:hover { color:#ea580c; }
        .back-link svg { width:14px; height:14px; }

        .alert {
          display:flex; align-items:center; gap:9px;
          padding:.65rem .85rem; border-radius:10px;
          font-size:.81rem; margin-bottom:.75rem;
        }
        .alert svg { width:14px; height:14px; flex-shrink:0; }
        .alert-error   { background:rgba(239,68,68,0.07);  border:1px solid rgba(239,68,68,0.2);  color:#dc2626; }
        .alert-success { background:rgba(22,163,74,0.07);  border:1px solid rgba(22,163,74,0.2);  color:#16a34a; }

        @keyframes spin { to { transform:rotate(360deg); } }
        .spin { animation:spin .8s linear infinite; }

        .verified-badge {
          display:inline-flex; align-items:center; gap:6px;
          background:rgba(22,163,74,0.09); border:1px solid rgba(22,163,74,0.22);
          border-radius:8px; padding:.3rem .65rem;
          font-size:.76rem; color:#16a34a; font-weight:600; margin-bottom:.5rem;
        }
        .verified-badge svg { width:12px; height:12px; }

        .pw-box {
          background:rgba(255,248,240,0.7);
          border:1px solid rgba(249,115,22,0.12);
          border-radius:10px; padding:.75rem .9rem; margin-bottom:.9rem;
        }
        .pw-box-title { font-size:.69rem; color:#9a7b6a; text-transform:uppercase; letter-spacing:.06em; font-weight:600; margin-bottom:.5rem; }
        .pw-list { display:grid; grid-template-columns:1fr 1fr; gap:.28rem .8rem; list-style:none; }
        .pw-list li { font-size:.75rem; color:#c4977a; display:flex; align-items:center; gap:5px; transition:color .2s; }
        .pw-list li.ok { color:#16a34a; }
        .pw-list li::before { content:'○'; font-size:.58rem; }
        .pw-list li.ok::before { content:'●'; }

        .lr-roles {
          display:grid; grid-template-columns:repeat(3,1fr); gap:.55rem;
          margin-top:1.1rem;
          animation:fadeUp .5s cubic-bezier(.22,1,.36,1) .25s both;
        }
        .lr-role {
          text-align:center; padding:.6rem .4rem;
          border-radius:12px;
          background:rgba(255,255,255,0.7);
          border:1px solid rgba(249,115,22,0.12);
          box-shadow:0 1px 3px rgba(0,0,0,0.04);
        }
        .lr-role-icon { font-size:1.05rem; display:block; margin-bottom:.18rem; }
        .lr-role-label { font-size:.68rem; color:#a07050; font-weight:600; letter-spacing:.06em; text-transform:uppercase; }

        .lr-footer {
          text-align:center; font-size:.69rem; color:#c4a08a;
          margin-top:1.1rem; letter-spacing:.04em;
          animation:fadeUp .5s cubic-bezier(.22,1,.36,1) .35s both;
        }
      `}</style>

      <div className="lr">
        <div className="lr-bg" />
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />

        <div className="lr-wrap">

          {/* Logo */}
          <div className="lr-logo">
            <div className="lr-logo-icon">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="lr-logo-title">
              <span className="pa">Chrono</span><span className="pb">Sync</span>
            </div>
            <p className="lr-logo-sub">Academic Schedule Platform</p>
          </div>

          {/* Card */}
          <div className="lr-card">

            {showForgotPassword ? (
              <>
                <button className="back-link" type="button" onClick={() => { setShowForgotPassword(false); setError(''); setForgotSuccess(''); }}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  Back to Sign In
                </button>
                <div className="lr-hg">
                  <h2 className="lr-heading">Reset Password</h2>
                  <p className="lr-sub">We'll email you a secure reset link.</p>
                </div>
                <form onSubmit={handleForgotPassword}>
                  <div className="lr-fg">
                    <label className="lr-label" htmlFor="forgot-email">Email Address</label>
                    <div className="lr-iw">
                      <span className="lr-icon"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></span>
                      <input id="forgot-email" type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="your.email@university.edu" required />
                    </div>
                  </div>
                  {error && <div className="alert alert-error"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{error}</div>}
                  {forgotSuccess && <div className="alert alert-success"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>{forgotSuccess}</div>}
                  <button type="submit" className="btn-orange" disabled={isLoading}>
                    {isLoading ? <><svg className="spin" style={{ width: 15, height: 15 }} fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: .25 }} /><path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" style={{ opacity: .75 }} /></svg>Sending…</> : 'Send Reset Link'}
                  </button>
                </form>
              </>

            ) : isFirstLogin ? (
              <>
                <div className="lr-hg">
                  <span className="verified-badge">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    OTP Verified
                  </span>
                  <h2 className="lr-heading">Set Your Password</h2>
                  <p className="lr-sub">Welcome, <span>{firstLoginUser?.fullName}</span>. Create a secure password to continue.</p>
                </div>
                <form onSubmit={handleSetPassword}>
                  <div className="lr-fg">
                    <label className="lr-label" htmlFor="new-password">New Password</label>
                    <div className="lr-iw">
                      <span className="lr-icon"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></span>
                      <input id="new-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Create a strong password" required minLength={8} />
                    </div>
                  </div>
                  <div className="lr-fg">
                    <label className="lr-label" htmlFor="confirm-password">Confirm Password</label>
                    <div className="lr-iw">
                      <span className="lr-icon"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></span>
                      <input id="confirm-password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your new password" required />
                    </div>
                  </div>
                  <div className="pw-box">
                    <p className="pw-box-title">Requirements</p>
                    <ul className="pw-list">
                      <li className={newPassword.length >= 8 ? 'ok' : ''}>8+ characters</li>
                      <li className={/[A-Z]/.test(newPassword) ? 'ok' : ''}>Uppercase</li>
                      <li className={/[a-z]/.test(newPassword) ? 'ok' : ''}>Lowercase</li>
                      <li className={/\d/.test(newPassword) ? 'ok' : ''}>Number</li>
                      <li className={/[@$!%*?&#]/.test(newPassword) ? 'ok' : ''}>Special char</li>
                    </ul>
                  </div>
                  {error && <div className="alert alert-error"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{error}</div>}
                  <button type="submit" className="btn-green" disabled={isLoading}>
                    {isLoading
                      ? <><svg className="spin" style={{ width: 15, height: 15 }} fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: .25 }} /><path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" style={{ opacity: .75 }} /></svg>Saving…</>
                      : <><svg style={{ width: 15, height: 15 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Set Password & Continue</>}
                  </button>
                </form>
              </>

            ) : (
              <>
                <div className="lr-hg">
                  <h2 className="lr-heading">Welcome back</h2>
                  <p className="lr-sub">Sign in to access your dashboard</p>
                </div>
                <form onSubmit={handleLogin}>
                  <div className="lr-fg">
                    <label className="lr-label" htmlFor="login-user-id">User ID or Email</label>
                    <div className="lr-iw">
                      <span className="lr-icon"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></span>
                      <input id="login-user-id" type="text" value={userId} onChange={e => setUserId(e.target.value)} placeholder="STU2026XXXX or admin@chronosync.com" required />
                    </div>
                  </div>
                  <div className="lr-fg">
                    <label className="lr-label" htmlFor="login-password">Password</label>
                    <div className="lr-iw">
                      <span className="lr-icon"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></span>
                      <input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password or OTP" required style={{ paddingRight: '2.6rem' }} />
                      <button type="button" className="lr-eye" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword
                          ? <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                          : <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        }
                      </button>
                    </div>
                  </div>
                  {error && <div className="alert alert-error"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{error}</div>}
                  <button id="login-submit-button" type="submit" className="btn-orange" disabled={isLoading}>
                    {isLoading
                      ? <><svg className="spin" style={{ width: 15, height: 15 }} fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: .25 }} /><path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" style={{ opacity: .75 }} /></svg>Signing in…</>
                      : <>Sign In <svg style={{ width: 15, height: 15 }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg></>
                    }
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => { setShowForgotPassword(true); setError(''); }}>
                    Forgot your password?
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Role pills */}
          <div className="lr-roles">
            {[{ role: 'Admin', icon: '🔑' }, { role: 'Faculty', icon: '👩‍🏫' }, { role: 'Student', icon: '🎓' }].map(item => (
              <div key={item.role} className="lr-role">
                <span className="lr-role-icon">{item.icon}</span>
                <span className="lr-role-label">{item.role}</span>
              </div>
            ))}
          </div>

          <p className="lr-footer">© {new Date().getFullYear()} ChronoSync · Secure Access Portal</p>
        </div>
      </div>
    </>
  );
}