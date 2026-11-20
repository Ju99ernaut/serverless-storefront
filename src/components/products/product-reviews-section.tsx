'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, MessageSquare, Star } from 'lucide-react'
import { cn } from 'cn'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { storefrontQueryKeys, type ProductDetailResponse } from '@/context'
import type { NeonUser, ProductVariant } from '@/lib/utils/data'
import { createProductReview } from '@/lib/payload-sdk'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../ui/empty'
import { Field, FieldError, FieldGroup, FieldLabel } from '../ui/field'
import { Input } from '../ui/input'
import { Skeleton } from '../ui/skeleton'
import { Textarea } from '../ui/textarea'
import { toast } from '../ui/toast'
import type { Product, Review } from '@/payload-types'

const reviewSchema = z.object({
  rating: z.number().min(1, { message: 'Please select a rating.' }).max(5),
  title: z.string().trim().min(1, {
    message: 'Please enter a review headline.',
  }),
  comment: z.string().trim().min(1, {
    message: 'Please enter your review details.',
  }),
})

interface ProductReviewsSectionProps {
  product: Product
  activeVariant?: ProductVariant
  reviews: Review[]
  loading: boolean
  user?: NeonUser | null
  onOpenAuthModal: () => void
}

export function ProductReviewsSection({
  product,
  activeVariant,
  reviews,
  loading,
  user,
  onOpenAuthModal,
}: ProductReviewsSectionProps) {
  const queryClient = useQueryClient()

  const reviewForm = useForm<z.infer<typeof reviewSchema>>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 5,
      title: '',
      comment: '',
    },
  })

  const submitReviewMutation = useMutation({
    mutationFn: (values: z.infer<typeof reviewSchema>) =>
      createProductReview({
        productId: product.id,
        productSlug: product.slug,
        neonUserId: user!.id,
        authorName: user!.name,
        authorEmail: user!.email,
        rating: values.rating,
        title: values.title.trim(),
        comment: values.comment.trim(),
        variantSize: activeVariant?.size ?? undefined,
        variantColor: activeVariant?.color ?? undefined,
      }),
    onSuccess: async (res) => {
      queryClient.setQueryData<ProductDetailResponse>(
        storefrontQueryKeys.productDetail(product.slug),
        (prev) =>
          prev
            ? {
                ...prev,
                product: res.product,
                reviews: [res.review, ...prev.reviews],
              }
            : prev,
      )
      await queryClient.invalidateQueries({ queryKey: storefrontQueryKeys.catalog })
      reviewForm.reset()
      toast.add({
        type: 'success',
        description: 'Thank you! Your review has been published.',
      })
    },
    onError: (err: unknown) => {
      toast.add({
        type: 'error',
        description: err instanceof Error ? err.message : 'Unable to submit review.',
      })
    },
  })

  return (
    <section aria-label="Customer Reviews" className="mt-14 pt-10 border-t border-border">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Review Form / Prompt */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Customer Reviews ({product.reviewCount ?? 0})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-foreground">
                  {(product.averageRating ?? 0).toFixed(1)}
                </span>
                <div className="space-y-1">
                  <div className="flex items-center gap-0.5 text-amber-400">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          star <= Math.round(product.averageRating ?? 0)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-muted-foreground'
                        }`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <span className="block text-xs text-muted-foreground">
                    Based on {product.reviewCount ?? 0} rating(s)
                  </span>
                </div>
              </div>

              {user ? (
                <form
                  onSubmit={reviewForm.handleSubmit((values) => {
                    if (!user || submitReviewMutation.isPending) return
                    submitReviewMutation.mutate(values)
                  })}
                  className="space-y-3 border-t border-border pt-4"
                >
                  <div className="text-xs font-semibold text-foreground">
                    Write a Review as {user.name}
                  </div>

                  <FieldGroup>
                    <Controller
                      name="rating"
                      control={reviewForm.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel>Your Rating</FieldLabel>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Button
                                key={star}
                                type="button"
                                size="icon-sm"
                                onClick={() => field.onChange(star)}
                                aria-label={`Rate ${star} out of 5 stars`}
                                variant="ghost"
                              >
                                <Star
                                  className={cn(
                                    'h-5 w-5',
                                    star <= field.value
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-muted-foreground',
                                  )}
                                />
                              </Button>
                            ))}
                          </div>
                          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                      )}
                    />

                    <Controller
                      name="title"
                      control={reviewForm.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="review-title">Headline</FieldLabel>
                          <Input
                            {...field}
                            id="review-title"
                            aria-invalid={fieldState.invalid}
                            placeholder="e.g., Tailored silhouette & superb fabric"
                          />
                          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                      )}
                    />

                    <Controller
                      name="comment"
                      control={reviewForm.control}
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor="review-comment">Review Details</FieldLabel>
                          <Textarea
                            {...field}
                            id="review-comment"
                            aria-invalid={fieldState.invalid}
                            placeholder="Share how this piece fits, feels, and wears..."
                          />
                          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                        </Field>
                      )}
                    />
                  </FieldGroup>

                  <Button
                    type="submit"
                    disabled={submitReviewMutation.isPending}
                    className="w-full"
                  >
                    {submitReviewMutation.isPending && <Loader2 className="size-4 animate-spin" />}{' '}
                    {submitReviewMutation.isPending ? 'Publishing Review...' : 'Submit Review'}
                  </Button>
                </form>
              ) : (
                <div className="border-t border-border pt-4 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Sign in or create an account to leave a verified clothing review.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={onOpenAuthModal}
                  >
                    Sign In to Write a Review
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Existing Reviews List */}
        <div className="lg:col-span-7 space-y-4">
          {loading && reviews.length === 0 ? (
            Array.from({ length: 2 }).map((_, idx) => (
              <Card key={`review-skeleton-${idx}`}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3.5 w-20" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            ))
          ) : reviews.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <Empty className="p-4">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <MessageSquare aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>No customer reviews yet</EmptyTitle>
                    <EmptyDescription>Be the first to review {product.title}!</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </CardContent>
            </Card>
          ) : (
            reviews.map((rev) => (
              <Card key={rev.id}>
                <CardContent className="p-5 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{rev.authorName}</span>
                      {rev.verifiedPurchase && (
                        <Badge className="text-[10px]">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          <span>Verified Purchase</span>
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(rev.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={cn(
                            'h-3.5 w-3.5',
                            s <= rev.rating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-muted-foreground',
                          )}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                    {(rev.variantColor || rev.variantSize) && (
                      <span className="text-[11px] text-muted-foreground">
                        Purchased: {[rev.variantColor, rev.variantSize].filter(Boolean).join(' • ')}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-foreground">{rev.title}</h3>
                  <p className="text-xs sm:text-sm leading-relaxed text-primary">{rev.comment}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
