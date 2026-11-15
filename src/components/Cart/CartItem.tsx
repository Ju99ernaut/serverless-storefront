'use client';

import type { ChangeEvent } from 'react';
import Link from 'next/link';
import { AlertTriangle, Minus, Plus, Trash2 } from 'lucide-react';
import { OptimizedImage } from '../ui/optimized-image';
import s from '../../styles/CartItem.module.css';
import type { CartLineItem } from '../../data/utils';

interface CartItemProps {
  item: CartLineItem;
  onUpdateQuantity: (cartItemId: string, nextQty: number) => void;
  onRemove: (cartItemId: string) => void;
}

const CartItem = ({ item, onUpdateQuantity, onRemove }: CartItemProps) => {
  const {
    cartItemId,
    id,
    slug,
    title,
    brand,
    selectedSize,
    selectedColor,
    selectedColorHex,
    price,
    quantity,
    images,
    maxAvailableStock = 99,
  } = item;

  const itemKey = cartItemId || id;
  const imageUrl = images && images[0] ? images[0] : '/images/shirt.png';
  const isLowStock = maxAvailableStock > 0 && maxAvailableStock <= 5;

  const handleQuantityChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!Number.isNaN(val)) {
      onUpdateQuantity(itemKey, Math.min(maxAvailableStock, Math.max(1, val)));
    }
  };

  return (
    <li className={s.itemContainer}>
      <div className={s.productImageContainer}>
        <OptimizedImage
          className={s.productImage}
          width={96}
          height={96}
          src={imageUrl}
          alt={title}
        />
      </div>
      <div className={s.variantContainer}>
        <Link
          href={`/products/${slug || id}`}
          className={`${s.variantName} hover:text-[#5C5EDC] transition-colors`}
        >
          {title}
        </Link>
        <span className={s.variantValue}>{brand}</span>

        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-none border border-[var(--border-color)] bg-[var(--surface-elevated)] px-1.5 py-0.5 font-medium text-[var(--fg-primary)]">
            {selectedColorHex && (
              <span
                className="h-2 w-2 rounded-none border border-white/40"
                style={{ backgroundColor: selectedColorHex }}
                aria-hidden="true"
              />
            )}
            <span>{selectedColor || 'Default'}</span>
          </span>
          <span className="rounded-none border border-[var(--border-color)] bg-[var(--surface-elevated)] px-1.5 py-0.5 font-semibold text-[var(--fg-heading)]">
            Size: {selectedSize || 'M'}
          </span>
        </div>

        {isLowStock && (
          <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-amber-500">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            <span>Only {maxAvailableStock} in stock</span>
          </div>
        )}

        <div className={s.quantityContainer}>
          <button
            className={s.btn}
            type="button"
            aria-label={`Decrease quantity of ${title}`}
            onClick={() => onUpdateQuantity(itemKey, quantity - 1)}
          >
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <label>
            <span className="text-hidden">Quantity for {title}</span>
            <input
              type="number"
              max={maxAvailableStock}
              min={1}
              className={s.quantity}
              value={quantity}
              onChange={handleQuantityChange}
            />
          </label>
          <button
            className={s.btn}
            type="button"
            disabled={quantity >= maxAvailableStock}
            aria-label={`Increase quantity of ${title}`}
            title={
              quantity >= maxAvailableStock
                ? `Maximum available stock (${maxAvailableStock}) reached`
                : 'Increase quantity'
            }
            onClick={() =>
              onUpdateQuantity(
                itemKey,
                Math.min(maxAvailableStock, quantity + 1)
              )
            }
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className={s.priceContainer}>
        <span>${(price * quantity).toFixed(2)}</span>
        <button
          type="button"
          className={s.removeButton}
          onClick={() => onRemove(itemKey)}
          aria-label={`Remove ${title} from cart`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
};

export default CartItem;
