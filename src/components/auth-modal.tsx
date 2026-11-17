'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Alert } from './ui/alert'
import { useStore } from '../context/StoreContext'
import { Eye, EyeOff, Lock, Mail, User as UserIcon, Info, Loader2 } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { toast } from './ui/toast'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { FieldGroup, FieldLabel, Field, FieldError } from './ui/field'
import { neonAuthClient } from '@/lib/auth-client'

const loginSchema = z.object({
  email: z.email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(8, {
    message: 'Password must be at least 8 characters.',
  }),
  rememberMe: z.boolean(),
})

const signUpSchema = z.object({
  name: z.string().min(3, {
    message: 'Name must be at least 3 characters.',
  }),
  email: z.email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(8, {
    message: 'Password must be at least 8 characters.',
  }),
  rememberMe: z.boolean(),
})

export default function AuthModal() {
  const { isAuthModalOpen, setIsAuthModalOpen, authModalIntent, cartItems, setIsCartOpen } =
    useStore()

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  })

  const signUpForm = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      rememberMe: false,
    },
  })

  const handleSuccessRedirect = () => {
    if (authModalIntent === 'checkout') {
      setIsCartOpen(true)
    }
  }

  const signUpWithEmailMutation = useMutation({
    mutationFn: async (values: z.infer<typeof signUpSchema>) => {
      const { error } = await neonAuthClient.signUp.email({
        ...values,
      })

      if (!error) {
        toast.add({
          type: 'success',
          description: 'Signed up successfully.',
        })
      } else {
        toast.add({ type: 'error', description: error.message || 'An unknown error occurred.' })
      }
    },
    onSuccess: handleSuccessRedirect,
  })

  const loginWithEmailMutation = useMutation({
    mutationFn: async (values: z.infer<typeof loginSchema>) => {
      const { error } = await neonAuthClient.signIn.email({
        ...values,
      })

      if (!error) {
        toast.add({ type: 'sucess', description: 'Signed in successfully.' })
      } else {
        toast.add({ type: 'error', description: error.message || 'An unknown error occurred.' })
      }
    },
    onSuccess: handleSuccessRedirect,
  })

  const loginWithGoogleMutation = useMutation({
    mutationFn: async () => {
      const { error } = await neonAuthClient.signIn.social({
        provider: 'google',
        callbackURL: window.location.href,
      })

      if (error) {
        toast.add({ type: 'error', description: error.message || 'An unknown error occurred.' })
      }
    },
    onSuccess: handleSuccessRedirect,
  })

  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!isAuthModalOpen) {
      setShowPassword(false)
    }
  }, [isAuthModalOpen])

  return (
    <Dialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Account</DialogTitle>
          <DialogDescription>
            Save loved clothing items, sync your cart across sessions, write verified reviews, and
            track orders.
          </DialogDescription>
        </DialogHeader>

        {authModalIntent === 'checkout' && (
          <Alert>
            <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs leading-relaxed">
              Registration or sign-in is required at checkout to allocate stock and send order
              tracking updates.{' '}
              {cartItems.length > 0 && (
                <strong>
                  Your {cartItems.reduce((s, i) => s + i.quantity, 0)} cart item(s) will be saved.
                </strong>
              )}
            </div>
          </Alert>
        )}

        <Button
          type="button"
          variant="outline"
          onClick={() => loginWithGoogleMutation.mutate()}
          disabled={loginWithEmailMutation.isPending}
          className="w-full gap-2 font-semibold"
        >
          {loginWithEmailMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81Z"
              />
            </svg>
          )}{' '}
          <span>Continue with Google</span>
        </Button>

        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-[var(--border-color)]" />
          <span className="mx-3 shrink text-[11px] uppercase tracking-wider text-[var(--fg-muted)]">
            Or continue with email
          </span>
          <div className="flex-grow border-t border-[var(--border-color)]" />
        </div>

        <Tabs defaultValue={'signin'}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Create Account</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form
              id="signin"
              onSubmit={loginForm.handleSubmit((values) => loginWithEmailMutation.mutate(values))}
              className="space-y-3"
            >
              <FieldGroup>
                <Controller
                  name="email"
                  control={loginForm.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="auth-signin-email">Email</FieldLabel>
                      <div className="relative">
                        <Mail
                          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]"
                          aria-hidden="true"
                        />
                        <Input
                          {...field}
                          id="auth-signin-email"
                          aria-invalid={fieldState.invalid}
                          placeholder="you@example.com"
                          autoComplete="username"
                          autoCapitalize="off"
                          autoCorrect="off"
                          spellCheck={false}
                          className="pl-9"
                        />
                      </div>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="password"
                  control={loginForm.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="auth-signin-password">Password</FieldLabel>
                      <div className="relative">
                        <Lock
                          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]"
                          aria-hidden="true"
                        />
                        <Input
                          {...field}
                          id="auth-signin-password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="Enter your password"
                          className="pl-9 pr-10"
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
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </FieldGroup>

              <Button
                type="submit"
                disabled={loginWithEmailMutation.isPending}
                className="w-full mt-2"
              >
                {loginWithEmailMutation.isPending && <Loader2 className="size-4 animate-spin" />}{' '}
                {loginWithEmailMutation.isPending ? 'Signing in...' : 'Sign In & Sync Account'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form
              id="signup"
              onSubmit={signUpForm.handleSubmit((values) => signUpWithEmailMutation.mutate(values))}
              className="space-y-3"
            >
              <FieldGroup>
                <Controller
                  name="name"
                  control={signUpForm.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="auth-signup-name">Full Name</FieldLabel>
                      <div className="relative">
                        <UserIcon
                          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]"
                          aria-hidden="true"
                        />
                        <Input
                          {...field}
                          id="auth-signup-name"
                          aria-invalid={fieldState.invalid}
                          autoComplete="name"
                          placeholder="Alex Rivera"
                          autoCapitalize="off"
                          autoCorrect="off"
                          spellCheck={false}
                          className="pl-9"
                        />
                      </div>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="email"
                  control={signUpForm.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="auth-signup-email">Email</FieldLabel>
                      <div className="relative">
                        <Mail
                          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]"
                          aria-hidden="true"
                        />
                        <Input
                          {...field}
                          id="auth-signup-email"
                          aria-invalid={fieldState.invalid}
                          placeholder="you@example.com"
                          autoComplete="username"
                          autoCapitalize="off"
                          autoCorrect="off"
                          spellCheck={false}
                          className="pl-9"
                        />
                      </div>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="password"
                  control={signUpForm.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="auth-signup-password">Password</FieldLabel>
                      <div className="relative">
                        <Lock
                          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)]"
                          aria-hidden="true"
                        />
                        <Input
                          {...field}
                          id="auth-signup-password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="Create new password"
                          className="pl-9 pr-10"
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
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </FieldGroup>

              <Button
                type="submit"
                disabled={signUpWithEmailMutation.isPending}
                className="w-full mt-2"
              >
                {signUpWithEmailMutation.isPending && <Loader2 className="size-4 animate-spin" />}{' '}
                {signUpWithEmailMutation.isPending
                  ? 'Creating account...'
                  : 'Create Account & Merge Cart'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
