'use client';

import { forwardRef } from 'react';
import {
  Footprints,
  Layers,
  Scissors,
  Shirt,
  ShoppingCart,
  Sparkles,
} from 'lucide-react';
import {
  BOTTOM_BAR_FILTERS,
  BottomBarFilter,
  getMainCategoryForFilter,
} from '../data/utils';

interface BottomBarProps {
  activeFilter: string;
  onSelectFilter: (filter: string) => void;
  cartCount: number;
  isCartAnimating: boolean;
  onOpenCart: () => void;
}

function renderFilterIcon(icon: BottomBarFilter['icon']) {
  switch (icon) {
    case 'jacket':
      return <Layers className="h-4 w-4" aria-hidden="true" />;
    case 'shirt':
      return <Shirt className="h-4 w-4" aria-hidden="true" />;
    case 'dress':
      return <Sparkles className="h-4 w-4" aria-hidden="true" />;
    case 'trousers':
      return <Scissors className="h-4 w-4" aria-hidden="true" />;
    case 'shoe':
      return <Footprints className="h-4 w-4" aria-hidden="true" />;
    case 'all':
    default:
      return null;
  }
}

const BottomBar = forwardRef<HTMLButtonElement, BottomBarProps>(
  (
    { activeFilter, onSelectFilter, cartCount, isCartAnimating, onOpenCart },
    cartBtnRef
  ) => {
    const activeMainCategory = getMainCategoryForFilter(activeFilter);

    return (
      <div className="bar">
        <div
          className="filter"
          role="toolbar"
          aria-label="Product category filters"
        >
          <span className="filter__label">Filter: </span>
          {BOTTOM_BAR_FILTERS.map((item) => {
            const isSelected =
              item.id === 'all'
                ? activeFilter === 'all'
                : activeFilter === item.id || activeMainCategory === item.id;
            const iconNode = renderFilterIcon(item.icon);

            return (
              <button
                key={item.id}
                type="button"
                className={`action filter__item${
                  isSelected ? ' filter__item--selected' : ''
                }`}
                data-filter={item.id}
                aria-pressed={isSelected}
                onClick={() => onSelectFilter(item.id)}
              >
                {iconNode}
                <span className={iconNode ? 'action__text' : undefined}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
        <button
          ref={cartBtnRef}
          type="button"
          className={`cart${isCartAnimating ? ' cart--animate' : ''}`}
          onClick={onOpenCart}
          aria-label={`Shopping cart with ${cartCount} items`}
        >
          <ShoppingCart className="cart__icon h-5 w-5" aria-hidden="true" />
          <span className="text-hidden">Shopping cart</span>
          <span className="cart__count">{cartCount}</span>
        </button>
      </div>
    );
  }
);

BottomBar.displayName = 'BottomBar';

export default BottomBar;
