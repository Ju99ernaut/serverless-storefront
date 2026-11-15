'use client';

import Link from 'next/link';
import { ShoppingCart, Star, X } from 'lucide-react';
import { OptimizedImage } from './ui/optimized-image';
import {
  getProductTotalAvailableStock,
  type Product,
} from '../data/products';

interface CompareWrapperProps {
  compareItems: Product[];
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (product: Product) => void;
}

const CompareWrapper = ({
  compareItems,
  isOpen,
  onClose,
  onAddToCart,
}: CompareWrapperProps) => {
  return (
    <section
      className="compare"
      aria-hidden={!isOpen}
      aria-label="Product comparison overlay"
    >
      {compareItems.map((product) => {
        const totalAvail = getProductTotalAvailableStock(product);
        return (
          <div key={product.id} className="compare__item">
            <div className="compare__effect">
              <div className="w-40 h-40 flex items-center justify-center rounded-xl bg-[var(--surface-elevated)] p-3 border border-[var(--border-color)]">
                <OptimizedImage
                  src={product.images[0] || '/images/shirt.png'}
                  alt={product.title}
                  width={180}
                  height={180}
                  className="max-h-full w-auto object-contain"
                />
              </div>
              <Link
                href={`/products/${product.slug}`}
                className="hover:underline"
                onClick={onClose}
              >
                <h3 className="meta__title">{product.title}</h3>
              </Link>
              <span className="meta__brand">{product.brand}</span>
              <span className="meta__price">${product.price}</span>
              <span className="meta__year">{product.subcategory}</span>
              <span className="meta__region">{product.material}</span>
              <span className="meta__varietal">{product.fit}</span>
              <span className="meta__alcohol">
                {product.care} &bull; {totalAvail} units available
              </span>
              <span className="inline-flex items-center justify-center gap-1 text-xs text-amber-400 py-2">
                <Star className="h-3.5 w-3.5 fill-amber-400" aria-hidden="true" />
                {product.averageRating.toFixed(1)} ({product.reviewCount} reviews)
              </span>
              <button
                type="button"
                className="action action--button action--buy compare__buy-btn"
                onClick={() => onAddToCart(product)}
                disabled={totalAvail <= 0}
              >
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                <span className="action__text">
                  {totalAvail > 0 ? 'Add to cart' : 'Out of Stock'}
                </span>
              </button>
            </div>
          </div>
        );
      })}
      <button
        type="button"
        className="action action--close"
        onClick={onClose}
        aria-label="Close comparison overlay"
      >
        <X className="h-5 w-5" aria-hidden="true" />
        <span className="action__text action__text--invisible">
          Close comparison overlay
        </span>
      </button>
    </section>
  );
};

export default CompareWrapper;
