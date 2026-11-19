'use client'

import { useState, useEffect, FormEvent, ChangeEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Camera, CheckCircle2, Eye, EyeOff, KeyRound, Upload, X } from 'lucide-react'
import { postAccountAction, storefrontQueryKeys, useAuth, type OrdersResponse } from '@/context'
import type { StoreUserRecord } from '@/data/utils'
import { Alert } from '../ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { getUserInitials } from '../user-menu'

interface AccountProfileTabProps {
  user: StoreUserRecord
}

export function AccountProfileTab({ user }: AccountProfileTabProps) {
  const queryClient = useQueryClient()
  const { setUser } = useAuth()

  const [profileName, setProfileName] = useState(user.name || '')
  const [profileEmail, setProfileEmail] = useState(user.email || '')
  const [profilePhone, setProfilePhone] = useState(user.phone || '')
  const [profileAddress, setProfileAddress] = useState(
    user.shippingAddresses?.[0]?.streetAddress || '',
  )
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(user.avatarUrl || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [profileSavedMsg, setProfileSavedMsg] = useState('')
  const [profileErrorMsg, setProfileErrorMsg] = useState('')

  useEffect(() => {
    setProfileName(user.name || '')
    setProfileEmail(user.email || '')
    setProfilePhone(user.phone || '')
    setProfileAddress(user.shippingAddresses?.[0]?.streetAddress || '')
    setProfileAvatarUrl(user.avatarUrl || '')
  }, [user])

  const updateProfileMutation = useMutation({
    mutationFn: (params: {
      name?: string
      newEmail?: string
      phone?: string
      shippingAddress?: string
      avatarUrl?: string | null
      currentPassword?: string
      newPassword?: string
    }) =>
      postAccountAction({
        action: 'update_profile',
        email: user.email,
        ...params,
      }),
    onSuccess: (res) => {
      const prevEmail = user.email
      setUser(res.user)
      queryClient.setQueryData<OrdersResponse>(storefrontQueryKeys.orders(res.user.email), {
        orders: res.orders || [],
      })
      if (prevEmail && prevEmail !== res.user.email) {
        queryClient.removeQueries({ queryKey: storefrontQueryKeys.orders(prevEmail) })
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setProfileSavedMsg('Profile details, email, password, and avatar updated successfully.')
    },
    onError: (err: unknown) => {
      setProfileErrorMsg(err instanceof Error ? err.message : 'Unable to save profile updates.')
    },
  })

  const handleAvatarFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1_500_000) {
      setProfileErrorMsg('Please select an image smaller than 1.5 MB.')
      return
    }
    setProfileErrorMsg('')
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfileAvatarUrl(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSaveProfile = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (updateProfileMutation.isPending) return
    setProfileSavedMsg('')
    setProfileErrorMsg('')

    if (!profileName.trim() || !profileEmail.trim()) {
      setProfileErrorMsg('Full name and email address are required.')
      return
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        setProfileErrorMsg('New password must be at least 6 characters long.')
        return
      }
      if (newPassword !== confirmNewPassword) {
        setProfileErrorMsg('New password and confirmation do not match.')
        return
      }
    }

    updateProfileMutation.mutate({
      name: profileName.trim(),
      newEmail: profileEmail.trim(),
      phone: profilePhone.trim(),
      shippingAddress: profileAddress.trim(),
      avatarUrl: profileAvatarUrl.trim() ? profileAvatarUrl.trim() : null,
      currentPassword: currentPassword || undefined,
      newPassword: newPassword || undefined,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Picture, Identity, Password &amp; Address</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSaveProfile} className="space-y-5 max-w-xl">
          {profileErrorMsg && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="text-xs">{profileErrorMsg}</span>
            </Alert>
          )}

          {profileSavedMsg && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="text-xs">{profileSavedMsg}</span>
            </Alert>
          )}

          {/* Profile Picture Upload & URL */}
          <div className="border border-border bg-secondary p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
              <Camera className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>Profile Picture</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Avatar className="h-16 w-16 border border-primary/40">
                {profileAvatarUrl ? (
                  <AvatarImage src={profileAvatarUrl} alt={profileName || 'Profile preview'} />
                ) : null}
                <AvatarFallback className="text-base">
                  {getUserInitials(profileName, profileEmail)}
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
                  {profileAvatarUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setProfileAvatarUrl('')}
                      className="gap-1.5"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Remove Photo</span>
                    </Button>
                  )}
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="profile-avatar-url"
                    className="text-[11px] font-semibold text-muted-foreground"
                  >
                    Or paste image URL
                  </label>
                  <Input
                    id="profile-avatar-url"
                    type="url"
                    value={profileAvatarUrl.startsWith('data:') ? '' : profileAvatarUrl}
                    onChange={(e) => setProfileAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="profile-name" className="text-xs font-semibold text-foreground">
                Full Name
              </label>
              <Input
                id="profile-name"
                name="name"
                type="text"
                autoComplete="name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="profile-email" className="text-xs font-semibold text-foreground">
                Email Address
              </label>
              <Input
                id="profile-email"
                name="username"
                type="email"
                autoComplete="username"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="profile-phone" className="text-xs font-semibold text-foreground">
              Phone Number
            </label>
            <Input
              id="profile-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={profilePhone}
              onChange={(e) => setProfilePhone(e.target.value)}
              placeholder="+1 (415) 555-0192"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="profile-address" className="text-xs font-semibold text-foreground">
              Default Shipping Address
            </label>
            <Textarea
              id="profile-address"
              name="street-address"
              autoComplete="street-address"
              value={profileAddress}
              onChange={(e) => setProfileAddress(e.target.value)}
              placeholder="Street address, suite, city, postal code"
            />
          </div>

          {/* Password Update Section */}
          <div className="border border-border bg-secondary p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
              <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>Change Password (Optional)</span>
            </div>
            <div className="space-y-1">
              <label htmlFor="current-password" className="text-xs font-semibold text-foreground">
                Current Password
              </label>
              <div className="relative">
                <Input
                  id="current-password"
                  name="current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="new-password" className="text-xs font-semibold text-foreground">
                  New Password
                </label>
                <div className="relative">
                  <Input
                    id="new-password"
                    name="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    minLength={6}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="confirm-new-password"
                  className="text-xs font-semibold text-foreground"
                >
                  Confirm New Password
                </label>
                <Input
                  id="confirm-new-password"
                  name="confirm-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  minLength={6}
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={updateProfileMutation.isPending}>
            {updateProfileMutation.isPending ? 'Saving Profile...' : 'Save Changes'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
