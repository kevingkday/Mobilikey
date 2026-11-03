import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Lock, Mail, User, Building2 } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { ProfileImportCard } from '../../components/profile/ProfileImportCard';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { INDUSTRIES } from '../../../shared/constants';
import type { AuthenticatedUser } from '../../../shared/types';

function GoogleAuthButton({ label = 'Continue with Google' }: { label?: string }) {
  return (
    <a
      href="/api/auth/google"
      className="flex w-full items-center justify-center gap-2.5 rounded border border-[#CBD5E1] bg-white py-2.5 px-4 text-xs font-semibold text-[#1F2937] hover:bg-[#F7F9FB] transition-colors"
    >
      <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
        />
        <path
          fill="#FBBC05"
          d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
        />
      </svg>
      <span>{label}</span>
    </a>
  );
}

export function LoginPage() {
  const { setUserDirect, refreshUnread } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(searchParams.get('error') || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const urlErr = searchParams.get('error');
    if (urlErr) setError(urlErr);
  }, [searchParams]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiFetch<{ user: AuthenticatedUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setUserDirect(res.user);
      await refreshUnread();
      navigate('/feed');
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  async function quickDemoLogin(demoEmail: string) {
    setEmail(demoEmail);
    setPassword('Mobilikey2026!');
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ user: AuthenticatedUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: demoEmail, password: 'Mobilikey2026!' }),
      });
      setUserDirect(res.user);
      await refreshUnread();
      navigate('/feed');
    } catch (err: any) {
      setError(err.message || 'Demo account not seeded yet. Run npm run db:setup:local.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md py-8">
        <div className="rounded-md border border-[#E2E8F0] bg-white p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-[#1F2937]">Sign in to Mobilikey</h1>
            <p className="mt-1 text-xs text-[#64748B]">
              Access your professional inbox, network, and company announcements.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="mb-4">
            <GoogleAuthButton label="Continue with Google" />
            <div className="relative my-4 flex items-center justify-center">
              <div className="border-t border-[#E2E8F0] w-full" />
              <span className="bg-white px-2.5 text-[11px] uppercase tracking-wider text-[#64748B]">
                or
              </span>
              <div className="border-t border-[#E2E8F0] w-full" />
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#1F2937] mb-1">
                Work or Professional Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937] focus:border-[#243B53] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-[#1F2937]">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-[#287D7D] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937] focus:border-[#243B53] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-[#243B53] py-2.5 text-xs font-semibold text-white hover:bg-[#1B2D40] disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Local Development Seeded Account Quick Switcher */}
          <div className="mt-6 border-t border-[#E2E8F0] pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B] mb-2">
              Quick Sign-In (Seeded Accounts)
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() => quickDemoLogin('sarah.chen@northstar-infra.com')}
                className="flex items-center justify-between rounded border border-[#E2E8F0] bg-[#F7F9FB] px-3 py-1.5 text-left text-xs hover:border-[#CBD5E1]"
              >
                <span className="font-medium text-[#1F2937]">Sarah Chen</span>
                <span className="text-[11px] text-[#64748B]">Managing Partner · Platform Admin</span>
              </button>
              <button
                type="button"
                onClick={() => quickDemoLogin('john.miller@vanguard-logistics.com')}
                className="flex items-center justify-between rounded border border-[#E2E8F0] bg-[#F7F9FB] px-3 py-1.5 text-left text-xs hover:border-[#CBD5E1]"
              >
                <span className="font-medium text-[#1F2937]">John Miller</span>
                <span className="text-[11px] text-[#64748B]">VP Supply Chain · Vanguard</span>
              </button>
              <button
                type="button"
                onClick={() => quickDemoLogin('elena.rostova@helion-bio.com')}
                className="flex items-center justify-between rounded border border-[#E2E8F0] bg-[#F7F9FB] px-3 py-1.5 text-left text-xs hover:border-[#CBD5E1]"
              >
                <span className="font-medium text-[#1F2937]">Dr. Elena Rostova</span>
                <span className="text-[11px] text-[#64748B]">Chief Scientific Officer · Helion</span>
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-[#64748B]">
            New to Mobilikey?{' '}
            <Link to="/signup" className="font-semibold text-[#243B53] hover:underline">
              Create a free account
            </Link>
          </p>
        </div>
      </div>
    </AppShell>
  );
}

export function SignUpPage() {
  const { setUserDirect, refreshUnread } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [position, setPosition] = useState('');
  const [headline, setHeadline] = useState('');
  const [biography, setBiography] = useState('');
  const [website, setWebsite] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [industry, setIndustry] = useState<string>(INDUSTRIES[0]);
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiFetch<{ user: AuthenticatedUser }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          password,
          companyName,
          position,
          headline: headline || [position, companyName].filter(Boolean).join(' at '),
          biography,
          website,
          socialLinks: {
            ...(linkedinUrl ? { linkedin: linkedinUrl } : {}),
            ...(githubUrl ? { github: githubUrl } : {}),
          },
          industry,
          location,
        }),
      });
      setUserDirect(res.user);
      await refreshUnread();
      navigate('/feed');
    } catch (err: any) {
      setError(err.message || 'Could not complete registration');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-lg py-6">
        <div className="rounded-md border border-[#E2E8F0] bg-white p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-[#1F2937]">Join Mobilikey</h1>
            <p className="mt-1 text-xs text-[#64748B]">
              Free professional directory profile and recipient-controlled messaging.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="mb-4">
            <GoogleAuthButton label="Sign up with Google" />
            <div className="relative my-4 flex items-center justify-center">
              <div className="border-t border-[#E2E8F0] w-full" />
              <span className="bg-white px-2.5 text-[11px] uppercase tracking-wider text-[#64748B]">
                or register with email
              </span>
              <div className="border-t border-[#E2E8F0] w-full" />
            </div>
          </div>

          <div className="mb-5">
            <ProfileImportCard
              compactTitle="Quick Fill from LinkedIn URL or CV / PDF"
              onImport={(imported) => {
                if (imported.name) setName(imported.name);
                if (imported.email && !email) setEmail(imported.email);
                if (imported.companyName) setCompanyName(imported.companyName);
                if (imported.position) setPosition(imported.position);
                if (imported.headline) setHeadline(imported.headline);
                if (imported.location) setLocation(imported.location);
                if (imported.industry) setIndustry(imported.industry);
                if (imported.biography) setBiography(imported.biography);
                if (imported.website) setWebsite(imported.website);
                if (imported.socialLinks?.linkedin) setLinkedinUrl(imported.socialLinks.linkedin);
                if (imported.socialLinks?.github) setGithubUrl(imported.socialLinks.github);
              }}
            />
          </div>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-[#1F2937] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sarah Chen"
                  className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937] focus:border-[#243B53] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1F2937] mb-1">
                  Professional Email *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sarah@company.com"
                  className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937] focus:border-[#243B53] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1F2937] mb-1">
                Password * <span className="text-[#64748B] font-normal">(Min. 8 chars, letter + number)</span>
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937] focus:border-[#243B53] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-[#1F2937] mb-1">Company</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Northstar Infrastructure"
                  className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937] focus:border-[#243B53] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1F2937] mb-1">Position / Title</label>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="Managing Partner"
                  className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937] focus:border-[#243B53] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-[#1F2937] mb-1">Industry</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full rounded border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#1F2937] focus:border-[#243B53] focus:outline-none"
                >
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1F2937] mb-1">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="New York, NY"
                  className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937] focus:border-[#243B53] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#1F2937] mb-1">
                Professional Headline
              </label>
              <input
                type="text"
                maxLength={140}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Infrastructure Debt & Grid Modernization Advisory"
                className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937] focus:border-[#243B53] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded bg-[#243B53] py-2.5 text-xs font-semibold text-white hover:bg-[#1B2D40] disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Create Free Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-[#64748B]">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-[#243B53] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </AppShell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ message: string; devResetToken?: string }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        }
      );
      setMessage(res.message);
      if (res.devResetToken) {
        setToken(res.devResetToken);
      }
      setStep('reset');
    } catch (err: any) {
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
      setMessage(res.message);
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md py-8">
        <div className="rounded-md border border-[#E2E8F0] bg-white p-6 sm:p-8">
          <h1 className="text-xl font-bold text-[#1F2937]">Reset Password</h1>
          <p className="mt-1 text-xs text-[#64748B]">
            Recover access to your Mobilikey account.
          </p>

          {error && (
            <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="mt-4 rounded border border-[#287D7D]/30 bg-[#287D7D]/10 px-3 py-2 text-xs text-[#1D5E5E]">
              {message}
            </div>
          )}

          {step === 'request' && (
            <form onSubmit={handleRequest} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1F2937] mb-1">
                  Account Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937] focus:border-[#243B53] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded bg-[#243B53] py-2 text-xs font-semibold text-white hover:bg-[#1B2D40]"
              >
                {loading ? 'Sending...' : 'Send Reset Token'}
              </button>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={handleReset} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1F2937] mb-1">Reset Token</label>
                <input
                  type="text"
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste reset token from email"
                  className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm font-mono text-[#1F2937]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1F2937] mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded border border-[#E2E8F0] px-3 py-2 text-sm text-[#1F2937]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded bg-[#243B53] py-2 text-xs font-semibold text-white hover:bg-[#1B2D40]"
              >
                {loading ? 'Updating...' : 'Set New Password'}
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="mt-6">
              <Link
                to="/login"
                className="block w-full rounded bg-[#243B53] py-2 text-center text-xs font-semibold text-white"
              >
                Proceed to Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

