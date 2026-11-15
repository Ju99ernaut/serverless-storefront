'use client';

import { useState, FormEvent, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Alert } from './ui/alert';
import { useStore } from '../context/StoreContext';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
  AlertCircle,
} from 'lucide-react';

export default function AuthModal() {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    authModalIntent,
    signInWithEmail,
    signInWithGoogle,
    cartItems,
    setIsCartOpen,
  } = useStore();

  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthModalOpen) {
      setError('');
      setShowPassword(false);
    }
  }, [isAuthModalOpen]);

  const handleSuccessRedirect = () => {
    if (authModalIntent === 'checkout') {
      setIsCartOpen(true);
    }
  };

  const handleSignInSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await signInWithEmail({
        email: email.trim(),
        password,
        isRegister: false,
      });
      handleSuccessRedirect();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Unable to sign in. Please retry.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUpSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || password.length < 6) {
      setError(
        'Please provide your full name, a valid email, and a password of at least 6 characters.'
      );
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await signInWithEmail({
        email: email.trim(),
        password,
        name: name.trim(),
        isRegister: true,
      });
      handleSuccessRedirect();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create account. Please retry.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await signInWithGoogle();
      handleSuccessRedirect();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Google authentication failed.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#797BED]">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>Neon Managed Better Auth</span>
          </div>
          <DialogTitle>
            {tab === 'signin' ? 'Sign in to Storefront' : 'Create your account'}
          </DialogTitle>
          <DialogDescription>
            Save loved clothing items, sync your cart across sessions, write
            verified reviews, and track orders.
          </DialogDescription>
        </DialogHeader>

        {authModalIntent === 'checkout' && (
          <Alert className="border-[#5C5EDC]/40 bg-[#5C5EDC]/10 text-[var(--fg-primary)]">
            <Sparkles
              className="h-4 w-4 text-[#797BED] shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="text-xs leading-relaxed">
              Registration or sign-in is required at checkout to allocate stock
              and send order tracking updates.{' '}
              {cartItems.length > 0 && (
                <strong>
                  Your {cartItems.reduce((s, i) => s + i.quantity, 0)} guest
                  cart item(s) saved in localStorage will merge automatically.
                </strong>
              )}
            </div>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span className="text-xs">{error}</span>
          </Alert>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleSignIn}
          disabled={isSubmitting}
          className="w-full gap-2 font-semibold"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fill="currentColor"
              d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
            />
          </svg>
          <span>Continue with Google (Neon Auth)</span>
        </Button>

        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-[var(--border-color)]" />
          <span className="mx-3 shrink text-[11px] uppercase tracking-wider text-[var(--fg-muted)]">
            Or continue with email
          </span>
          <div className="flex-grow border-t border-[var(--border-color)]" />
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as 'signin' | 'signup');
            setError('');
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Create Account</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignInSubmit} className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="auth-signin-email"
                  className="text-xs font-semibold text-[var(--fg-heading)]"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]"
                    aria-hidden="true"
                  />
                  <Input
                    id="auth-signin-email"
                    name="username"
                    type="email"
                    required
                    autoComplete="username"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="you@example.com"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="auth-signin-password"
                  className="text-xs font-semibold text-[var(--fg-heading)]"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]"
                    aria-hidden="true"
                  />
                  <Input
                    id="auth-signin-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="pl-9 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--fg-muted)] hover:text-[var(--fg-heading)] cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2"
              >
                {isSubmitting ? 'Signing in...' : 'Sign In & Sync Account'}
              </Button>

              <p className="text-[11px] text-[var(--fg-muted)] text-center">
                Demo account ready: <code>alex.rivera@example.com</code> (any
                password)
              </p>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUpSubmit} className="space-y-3">
              <div className="space-y-1">
                <label
                  htmlFor="auth-signup-name"
                  className="text-xs font-semibold text-[var(--fg-heading)]"
                >
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]"
                    aria-hidden="true"
                  />
                  <Input
                    id="auth-signup-name"
                    name="name"
                    type="text"
                    required
                    autoComplete="name"
                    placeholder="Alex Rivera"
                    className="pl-9"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="auth-signup-email"
                  className="text-xs font-semibold text-[var(--fg-heading)]"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]"
                    aria-hidden="true"
                  />
                  <Input
                    id="auth-signup-email"
                    name="username"
                    type="email"
                    required
                    autoComplete="username"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="you@example.com"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="auth-signup-password"
                  className="text-xs font-semibold text-[var(--fg-heading)]"
                >
                  Create Password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]"
                    aria-hidden="true"
                  />
                  <Input
                    id="auth-signup-password"
                    name="new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="At least 6 characters"
                    className="pl-9 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--fg-muted)] hover:text-[var(--fg-heading)] cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2"
              >
                {isSubmitting
                  ? 'Creating Neon Auth account...'
                  : 'Create Account & Merge Cart'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
