import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogIn, LogOut, Mail, Lock, X, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

/* ------------------------------------------------------------------------ */
/*  AuthPanel — real email/password auth via Supabase.                      */
/*  Renders a small "Войти" / "user@email + Выйти" pill for the header, and */
/*  a modal with real sign-up / sign-in forms.                              */
/*                                                                           */
/*  NOTE: by default Supabase requires email confirmation before a new      */
/*  account can log in. If you want instant sign-in during testing, turn    */
/*  off "Confirm email" in Authentication → Providers → Email in your       */
/*  Supabase dashboard. Turn it back on before a real launch.               */
/* ------------------------------------------------------------------------ */


const STR = {
  ru: {
    signIn: 'Войти',
    signOut: 'Выйти',
    title: 'Аккаунт',
    subtitle: 'Прогресс сохранится и будет доступен с любого устройства',
    email: 'Email',
    password: 'Пароль',
    showPassword: 'Показать пароль',
    hidePassword: 'Скрыть пароль',
    haveAccount: 'Уже есть аккаунт? Войти',
    noAccount: 'Нет аккаунта? Зарегистрироваться',
    submitSignIn: 'Войти',
    submitSignUp: 'Создать аккаунт',
    confirmNotice: 'Проверьте почту — нужно подтвердить email, прежде чем входить (если это включено в настройках проекта).',
    error: 'Что-то пошло не так',
    forgotPassword: 'Забыли пароль?',
    resetTitle: 'Восстановление пароля',
    resetSubtitle: 'Пришлём ссылку на почту, чтобы задать новый пароль',
    submitReset: 'Прислать ссылку',
    resetNotice: 'Если такой email зарегистрирован — письмо со ссылкой уже отправлено. Проверьте почту (и папку «Спам»).',
    backToSignIn: 'Назад ко входу',
    newPasswordTitle: 'Новый пароль',
    newPasswordSubtitle: 'Придумайте новый пароль для входа',
    submitNewPassword: 'Сохранить пароль',
    newPasswordSuccess: 'Пароль обновлён — теперь можно войти с ним.',
  },
  en: {
    signIn: 'Sign in',
    signOut: 'Sign out',
    title: 'Account',
    subtitle: 'Your progress will sync across every device',
    email: 'Email',
    password: 'Password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    haveAccount: 'Already have an account? Sign in',
    noAccount: "Don't have an account? Sign up",
    submitSignIn: 'Sign in',
    submitSignUp: 'Create account',
    confirmNotice: 'Check your inbox — you may need to confirm your email before signing in (if that\'s enabled in your project settings).',
    error: 'Something went wrong',
    forgotPassword: 'Forgot password?',
    resetTitle: 'Reset password',
    resetSubtitle: "We'll email you a link to set a new password",
    submitReset: 'Send link',
    resetNotice: "If that email is registered, a reset link is on its way. Check your inbox (and spam folder).",
    backToSignIn: 'Back to sign in',
    newPasswordTitle: 'New password',
    newPasswordSubtitle: 'Choose a new password to sign in with',
    submitNewPassword: 'Save password',
    newPasswordSuccess: 'Password updated — you can sign in with it now.',
  },
};

export default function AuthPanel({ lang = 'ru', user, variant = 'header', appName, tagline }) {
  const s = STR[lang] || STR.ru;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'reset' | 'newPassword'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState('');

  // Supabase redirects back here with type=recovery in the URL hash after the
  // person clicks the reset-password link in their email — catch that and
  // switch straight into the "set a new password" screen.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setMode('newPassword');
      setOpen(true);
    }
  }, []);

  const reset = () => {
    setEmail('');
    setPassword('');
    setError('');
    setNotice('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        setOpen(false);
        reset();
      } else if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setNotice(s.confirmNotice);
      } else if (mode === 'reset') {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (err) throw err;
        setNotice(s.resetNotice);
      } else if (mode === 'newPassword') {
        const { error: err } = await supabase.auth.updateUser({ password });
        if (err) throw err;
        setNotice(s.newPasswordSuccess);
        setTimeout(() => {
          setMode('signin');
          setOpen(false);
          reset();
          window.history.replaceState(null, '', window.location.pathname);
        }, 1800);
      }
    } catch (err) {
      setError(err.message || s.error);
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const titles = {
    signin: s.title,
    signup: s.title,
    reset: s.resetTitle,
    newPassword: s.newPasswordTitle,
  };
  const subtitles = {
    signin: tagline || s.subtitle,
    signup: tagline || s.subtitle,
    reset: s.resetSubtitle,
    newPassword: s.newPasswordSubtitle,
  };
  const submitLabels = {
    signin: s.submitSignIn,
    signup: s.submitSignUp,
    reset: s.submitReset,
    newPassword: s.submitNewPassword,
  };

  const formFields = (
    <>
      <h3 className="text-lg font-bold text-white mb-1">{variant === 'gate' && mode === 'signin' ? appName || titles[mode] : titles[mode]}</h3>
      <p className="text-sm text-slate-400 mb-4">{subtitles[mode]}</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode !== 'newPassword' && (
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={s.email}
              className="w-full rounded-xl bg-slate-950/80 border border-slate-700 pl-10 pr-4 py-3 text-slate-100 placeholder-slate-600 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 transition"
            />
          </div>
        )}
        {mode !== 'reset' && (
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={s.password}
              className="w-full rounded-xl bg-slate-950/80 border border-slate-700 pl-10 pr-11 py-3 text-slate-100 placeholder-slate-600 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
              aria-label={showPassword ? s.hidePassword : s.showPassword}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        )}

        {mode === 'signin' && (
          <button
            type="button"
            onClick={() => {
              setMode('reset');
              setError('');
              setNotice('');
            }}
            className="text-xs text-slate-500 hover:text-emerald-300 transition underline underline-offset-2"
          >
            {s.forgotPassword}
          </button>
        )}

        {error && <p className="text-[13px] text-rose-400">{error}</p>}
        {notice && <p className="text-[13px] text-amber-300">{notice}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl text-slate-950 font-bold px-5 py-3 text-sm transition active:scale-95 disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg,#34D399,#2DD4BF)', boxShadow: '0 0 20px -4px rgba(45,212,191,0.8)' }}
        >
          {submitLabels[mode]}
        </button>
      </form>

      {mode === 'signin' || mode === 'signup' ? (
        <button
          onClick={() => {
            setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
            reset();
          }}
          className="mt-3 text-xs text-slate-400 hover:text-emerald-300 transition underline underline-offset-2"
        >
          {mode === 'signin' ? s.noAccount : s.haveAccount}
        </button>
      ) : mode === 'reset' ? (
        <button
          onClick={() => {
            setMode('signin');
            reset();
          }}
          className="mt-3 text-xs text-slate-400 hover:text-emerald-300 transition underline underline-offset-2"
        >
          {s.backToSignIn}
        </button>
      ) : null}
    </>
  );

  // Gate variant: mandatory full-screen welcome/auth screen, no dismiss button.
  // Renders nothing once a user is signed in — the parent then shows the app.
  if (variant === 'gate') {
    if (user) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'radial-gradient(ellipse 120% 80% at 50% -10%, #1b2436 0%, #10151f 55%, #0b0f19 100%)' }}>
        <div
          className="rounded-2xl p-8 w-full max-w-sm relative border border-emerald-400/25"
          style={{ background: 'linear-gradient(180deg, rgba(30,41,59,0.95), rgba(15,20,32,0.98))', boxShadow: '0 0 60px -10px rgba(16,185,129,0.35)' }}
        >
          {formFields}
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2 bg-slate-900/85 border border-slate-700 rounded-full pl-3 pr-1.5 py-1">
        <span className="fc-mono text-[10px] text-slate-300 max-w-[9rem] truncate">{user.email}</span>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold px-2.5 py-1 transition"
        >
          <LogOut size={11} />
          {s.signOut}
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full bg-slate-900/85 border border-emerald-400/40 text-emerald-200 text-xs font-semibold px-3.5 py-2 transition hover:border-emerald-400/70"
        style={{ boxShadow: '0 0 14px -4px rgba(16,185,129,0.5)' }}
      >
        <LogIn size={13} />
        {s.signIn}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-950/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="rounded-2xl p-6 w-full max-w-sm relative border border-emerald-400/25"
            style={{ background: 'linear-gradient(180deg, rgba(30,41,59,0.95), rgba(15,20,32,0.98))', backdropFilter: 'blur(16px)' }}
          >
            <button onClick={() => setOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition" aria-label="close">
              <X size={18} />
            </button>

            {formFields}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}