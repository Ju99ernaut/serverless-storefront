'use client'

import { useState, FormEvent } from 'react'
import { CheckCircle2, MessageSquare, Star } from 'lucide-react'
import { cn } from 'cn'
import type { Product, ProductReviewItem, ProductVariant, StoreUserRecord } from '@/data/utils'
import { submitProductReviewViaSdk } from '@/lib/payload-sdk'
import { Alert } from '../ui/alert'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../ui/empty'
import { Input } from '../ui/input'
import { Skeleton } from '../ui/skeleton'
import { Textarea } from '../ui/textarea'

interface ProductReviewsSectionProps {
  product: Product
  activeVariant?: ProductVariant
  reviews: ProductReviewItem[]
  loading: boolean
  user: StoreUserRecord | null
  onOpenAuthModal: () => void
  onReviewSubmitted: (review: ProductReviewItem, updatedProduct: Product) => Promise<void>
}

export function ProductReviewsSection({
  product,
  activeVariant,
  reviews,
  loading,
  user,
  onOpenAuthModal,
  onReviewSubmitted,
}: ProductReviewsSectionProps) {
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewTitle, setReviewTitle] = useState('')
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState('')

  const handleReviewSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user) return
    if (!reviewTitle.trim() || !reviewComment.trim()) {
      setReviewError('Please enter a review headline and comment.')
      return
    }

    setReviewSubmitting(true)
    setReviewError('')
    setReviewSuccess('')

    try {
      const res = await submitProductReviewViaSdk({
        productSlug: product.slug,
        authorName: user.name,
        authorEmail: user.email,
        rating: reviewRating,
        title: reviewTitle.trim(),
        comment: reviewComment.trim(),
        variantSize: activeVariant?.size,
        variantColor: activeVariant?.color,
      })
      await onReviewSubmitted(res.review, res.product)
      setReviewTitle('')
      setReviewComment('')
      setReviewRating(5)
      setReviewSuccess('Thank you! Your review has been published.')
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : 'Unable to submit review.')
    } finally {
      setReviewSubmitting(false)
    }
  }

  return (
    <section aria-label="Customer Reviews" className="mt-14 pt-10 border-t border-border">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Review Form / Prompt */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Customer Reviews ({product.reviewCount})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold text-[var(--fg-heading)]">
                  {product.averageRating.toFixed(1)}
                </span>
                <div className="space-y-1">
                  <div className="flex items-center gap-0.5 text-amber-400">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          star <= Math.round(product.averageRating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-muted-foreground'
                        }`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <span className="block text-xs text-muted-foreground">
                    Based on {product.reviewCount} rating(s)
                  </span>
                </div>
              </div>

              {user ? (
                <form
                  onSubmit={handleReviewSubmit}
                  className="space-y-3 border-t border-border pt-4"
                >
                  <div className="text-xs font-semibold text-foreground">
                    Write a Review as {user.name}
                  </div>

                  {reviewError && (
                    <Alert variant="destructive">
                      <span className="text-xs">{reviewError}</span>
                    </Alert>
                  )}
                  {reviewSuccess && (
                    <Alert>
                      <span className="text-xs">{reviewSuccess}</span>
                    </Alert>
                  )}

                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Your Rating</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Button
                          key={star}
                          type="button"
                          size="icon-sm"
                          onClick={() => setReviewRating(star)}
                          aria-label={`Rate ${star} out of 5 stars`}
                          variant="ghost"
                        >
                          <Star
                            className={cn(
                              'h-5 w-5',
                              star <= reviewRating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-muted-foreground',
                            )}
                          />
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="review-title" className="text-xs font-semibold text-foreground">
                      Headline
                    </label>
                    <Input
                      id="review-title"
                      placeholder="e.g., Tailored silhouette & superb fabric"
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="review-comment"
                      className="text-xs font-semibold text-foreground"
                    >
                      Review Details
                    </label>
                    <Textarea
                      id="review-comment"
                      placeholder="Share how this piece fits, feels, and wears..."
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      required
                    />
                  </div>

                  <Button type="submit" disabled={reviewSubmitting} className="w-full">
                    {reviewSubmitting ? 'Publishing Review...' : 'Submit Review'}
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
                        Purchased:{' '}
                        {[rev.variantColor, rev.variantSize].filter(Boolean).join(' • ')}
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
