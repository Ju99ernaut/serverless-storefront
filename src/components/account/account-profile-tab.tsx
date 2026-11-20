'use client'

import { useState, useEffect, type ChangeEvent } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Eye, EyeOff, KeyRound, Loader2, Upload, X } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { CACHE_TIMES, storefrontQueryKeys } from '@/context'
import { neonAuthClient } from '@/lib/auth-client'
import { getBillingDetails, upsertBillingDetails } from '@/lib/payload-sdk'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '../ui/field'
import { Input } from '../ui/input'
import { Skeleton } from '../ui/skeleton'
import { Textarea } from '../ui/textarea'
import { toast } from '../ui/toast'
import { getUserInitials } from '../user-menu'

const profileSchema = z
  .object({
    name: z.string().trim().min(1, {
      message: 'Full name is required.',
    }),
    email: z.email({ message: 'Please enter a valid email address.' }),
    phone: z.string(),
    shippingAddress: z.string(),
    avatarUrl: z.string().refine(
      (val) => {
        const trimmed = val.trim()
        if (!trimmed) return true
        if (trimmed.startsWith('data:image/')) return true
        return z.url().safeParse(trimmed).success
      },
      { message: 'Please enter a valid image URL.' },
    ),
    currentPassword: z.string(),
    newPassword: z.string(),
    confirmNewPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword) {
      if (data.newPassword.length < 6) {
        ctx.addIssue({
          code: 'custom',
          path: ['newPassword'],
          message: 'New password must be at least 6 characters long.',
        })
      }
      if (data.newPassword !== data.confirmNewPassword) {
        ctx.addIssue({
          code: 'custom',
          path: ['confirmNewPassword'],
          message: 'New password and confirmation do not match.',
        })
      }
    } else if (data.confirmNewPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmNewPassword'],
        message: 'New password and confirmation do not match.',
      })
    }
  })

type ProfileFormValues = z.infer<typeof profileSchema>

export function AccountProfileTab() {
  const queryClient = useQueryClient()
  const { data: sessionData, isPending: isSessionPending } = neonAuthClient.useSession()
  const user = sessionData?.user

  const { data: billingDetails } = useQuery({
    queryKey: storefrontQueryKeys.billingDetails(user?.id),
    queryFn: () => getBillingDetails(user?.id || ''),
    enabled: Boolean(user?.id),
    ...CACHE_TIMES.userState,
  })

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: billingDetails?.phone || '',
      shippingAddress: billingDetails?.shippingAddress || '',
      avatarUrl: user?.image || '',
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  })

  const { reset, getValues, setValue, setError, clearErrors } = profileForm

  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  useEffect(() => {
    if (!user) return
    reset({
      ...getValues(),
      name: user.name || '',
      email: user.email || '',
      avatarUrl: user.image || '',
    })
  }, [user, reset, getValues])

  useEffect(() => {
    if (!billingDetails) return
    reset({
      ...getValues(),
      phone: billingDetails.phone || '',
      shippingAddress: billingDetails.shippingAddress || '',
    })
  }, [billingDetails, reset, getValues])

  const watchedAvatarUrl = profileForm.watch('avatarUrl')
  const watchedName = profileForm.watch('name')
  const watchedEmail = profileForm.watch('email')

  const updateProfileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      if (!user) {
        throw new Error('You must be signed in to update your profile.')
      }

      const trimmedName = values.name.trim()
      const trimmedEmail = values.email.trim()
      const trimmedPhone = values.phone.trim()
      const trimmedAddress = values.shippingAddress.trim()
      const trimmedAvatarUrl = values.avatarUrl.trim() || undefined

      const { error: updateUserErr } = await neonAuthClient.updateUser({
        name: trimmedName,
        image: trimmedAvatarUrl,
      })
      if (updateUserErr) {
        throw new Error(updateUserErr.message || 'Unable to update user profile.')
      }

      if (trimmedEmail.toLowerCase() !== user.email.toLowerCase()) {
        const { error: emailErr } = await neonAuthClient.changeEmail({
          newEmail: trimmedEmail,
        })
        if (emailErr) {
          throw new Error(emailErr.message || 'Unable to update email address.')
        }
      }

      if (values.newPassword) {
        const { error: pwErr } = await neonAuthClient.changePassword({
          currentPassword: values.currentPassword || '',
          newPassword: values.newPassword,
        })
        if (pwErr) {
          throw new Error(pwErr.message || 'Unable to update password.')
        }
      }

      const savedBilling = await upsertBillingDetails({
        neonUserId: user.id,
        phone: trimmedPhone,
        shippingAddress: trimmedAddress,
      })

      return savedBilling
    },
    onSuccess: (savedBilling) => {
      queryClient.setQueryData(storefrontQueryKeys.billingDetails(user?.id), savedBilling)
      setValue('currentPassword', '')
      setValue('newPassword', '')
      setValue('confirmNewPassword', '')
      toast.add({
        type: 'success',
        description: 'Profile details, billing address, password, and avatar updated.',
      })
    },
    onError: (err: unknown) => {
      toast.add({
        type: 'error',
        description: err instanceof Error ? err.message : 'Unable to save profile updates.',
      })
    },
  })

  const handleAvatarFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1_500_000) {
      setError('avatarUrl', { message: 'Please select an image smaller than 1.5 MB.' })
      return
    }
    clearErrors('avatarUrl')
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setValue('avatarUrl', reader.result, { shouldDirty: true, shouldValidate: true })
      }
    }
    reader.readAsDataURL(file)
  }

  if (isSessionPending) {
    return (
      <Card aria-busy="true" aria-label="Loading profile">
        <CardHeader>
          <CardTitle>Profile Picture, Identity, Password &amp; Billing Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 max-w-xl">
          <div className="border border-border bg-secondary p-4 flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Picture, Identity, Password &amp; Billing Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          id="account-profile"
          onSubmit={profileForm.handleSubmit((values) => updateProfileMutation.mutate(values))}
          className="space-y-5 max-w-xl"
        >
          <FieldGroup>
            {/* Profile Picture Upload & URL */}
            <div className="border border-border bg-secondary p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                <Camera className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Profile Picture</span>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Avatar className="h-16 w-16 border border-primary/40">
                  {watchedAvatarUrl ? (
                    <AvatarImage src={watchedAvatarUrl} alt={watchedName || 'Profile preview'} />
                  ) : null}
                  <AvatarFallback className="text-base">
                    {getUserInitials(watchedName, watchedEmail)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-[200px] space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor="profile-avatar-file"
                      className="inline-flex h-9 items-center gap-1.5 border border-border bg-card px-3 text-xs font-semibold text-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Upload Photo</span>
                      <input
                        id="profile-avatar-file"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarFileChange}
                        className="sr-only"
                      />
                    </label>
                    {watchedAvatarUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          clearErrors('avatarUrl')
                          setValue('avatarUrl', '', { shouldDirty: true, shouldValidate: true })
                        }}
                        className="gap-1.5"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Remove Photo</span>
                      </Button>
                    )}
                  </div>
                  <Controller
                    name="avatarUrl"
                    control={profileForm.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel
                          htmlFor="profile-avatar-url"
                          className="text-[11px] font-semibold text-muted-foreground"
                        >
                          Or paste image URL
                        </FieldLabel>
                        <Input
                          {...field}
                          id="profile-avatar-url"
                          aria-invalid={fieldState.invalid}
                          value={field.value.startsWith('data:') ? '' : field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          placeholder="https://example.com/avatar.jpg"
                        />
                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                      </Field>
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Controller
                name="name"
                control={profileForm.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="profile-name">Full Name</FieldLabel>
                    <Input
                      {...field}
                      id="profile-name"
                      type="text"
                      autoComplete="name"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              <Controller
                name="email"
                control={profileForm.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="profile-email">Email Address</FieldLabel>
                    <Input
                      {...field}
                      id="profile-email"
                      autoComplete="username"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </div>

            <Controller
              name="phone"
              control={profileForm.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="profile-phone">Phone Number</FieldLabel>
                  <Input
                    {...field}
                    id="profile-phone"
                    type="tel"
                    autoComplete="tel"
                    aria-invalid={fieldState.invalid}
                    placeholder="+1 (415) 555-0192"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <Controller
              name="shippingAddress"
              control={profileForm.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="profile-address">Default Shipping Address</FieldLabel>
                  <Textarea
                    {...field}
                    id="profile-address"
                    autoComplete="street-address"
                    aria-invalid={fieldState.invalid}
                    placeholder="Street address, suite, city, postal code"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            {/* Password Update Section */}
            <div className="border border-border bg-secondary p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
                <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Change Password (Optional)</span>
              </div>

              <Controller
                name="currentPassword"
                control={profileForm.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="current-password">Current Password</FieldLabel>
                    <div className="relative">
                      <Input
                        {...field}
                        id="current-password"
                        type={showCurrentPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        aria-invalid={fieldState.invalid}
                        placeholder="Required only if modifying an existing password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword((prev) => !prev)}
                        aria-label={
                          showCurrentPassword ? 'Hide current password' : 'Show current password'
                        }
                        aria-pressed={showCurrentPassword}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showCurrentPassword ? (
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Controller
                  name="newPassword"
                  control={profileForm.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="new-password">New Password</FieldLabel>
                      <div className="relative">
                        <Input
                          {...field}
                          id="new-password"
                          type={showNewPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          aria-invalid={fieldState.invalid}
                          placeholder="At least 6 characters"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((prev) => !prev)}
                          aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                          aria-pressed={showNewPassword}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {showNewPassword ? (
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

                <Controller
                  name="confirmNewPassword"
                  control={profileForm.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="confirm-new-password">Confirm New Password</FieldLabel>
                      <Input
                        {...field}
                        id="confirm-new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        aria-invalid={fieldState.invalid}
                        placeholder="Re-enter new password"
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </div>
            </div>
          </FieldGroup>

          <Button type="submit" disabled={updateProfileMutation.isPending}>
            {updateProfileMutation.isPending && <Loader2 className="size-4 animate-spin" />}{' '}
            {updateProfileMutation.isPending ? 'Saving Profile...' : 'Save Changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
