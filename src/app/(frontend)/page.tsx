'use client';

import { useState, useRef, useMemo } from 'react';
import { X } from 'lucide-react';
import BottomBar from '../../components/BottomBar';
import NavBar, { type SortOption } from '../../components/NavBar';
import SideBar from '../../components/SideBar';
import Cart from '../../components/Cart';
import BannerCarousel from '../../components/BannerCarousel';
import Grid from '../../components/Grid';
import CompareBasket from '../../components/CompareBasket';
import CompareWrapper from '../../components/CompareWrapper';
import { useStore } from '../../context/StoreContext';
import { getFilterDisplayName, type Product } from '../../data/utils';

const MAX_COMPARE_ITEMS = 3;

export default function HomePage() {
  const {
    products,
    banners,
    cartItems,
    totalCartCount,
    isCartOpen,
    setIsCartOpen,
    isCartAnimating,
    addToCart,
    updateCartQuantity,
    removeCartItem,
    clearCart,
  } = useStore();

  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [compareItems, setCompareItems] = useState<Product[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState<boolean>(false);

  const hamburgerRef = useRef<HTMLButtonElement | null>(null);
  const cartBtnRef = useRef<HTMLButtonElement | null>(null);

  const sortedProducts = useMemo(() => {
    const list = [...products];
    if (sortBy === 'price-asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      list.sort((a, b) => b.averageRating - a.averageRating);
    }
    return list;
  }, [products, sortBy]);

  const visibleProductsCount = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedProducts.filter((p) => {
      const matchesCat =
        !activeFilter ||
        activeFilter === 'all' ||
        p.category === activeFilter ||
        (Array.isArray(p.tags) && p.tags.includes(activeFilter));
      if (!matchesCat) return false;
      if (!q) return true;
      return [
        p.title,
        p.brand,
        p.category,
        p.subcategory,
        p.description,
        p.material,
        ...(p.tags || []),
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    }).length;
  }, [sortedProducts, activeFilter, searchQuery]);

  const compareIds = useMemo(
    () => compareItems.map((item) => item.id),
    [compareItems]
  );

  const handleToggleCompare = (product: Product) => {
    setCompareItems((prev) => {
      const exists = prev.some((item) => item.id === product.id);
      if (exists) {
        const next = prev.filter((item) => item.id !== product.id);
        if (next.length === 0) {
          setIsCompareOpen(false);
        }
        return next;
      }
      if (prev.length >= MAX_COMPARE_ITEMS) {
        return prev;
      }
      return [...prev, product];
    });
  };

  const handleRemoveCompare = (productId: string) => {
    setCompareItems((prev) => {
      const next = prev.filter((item) => item.id !== productId);
      if (next.length === 0) {
        setIsCompareOpen(false);
      }
      return next;
    });
  };

  const handleCloseMenu = () => {
    setIsMenuOpen(false);
    hamburgerRef.current?.focus();
  };

  const handleCloseCart = () => {
    setIsCartOpen(false);
    cartBtnRef.current?.focus();
  };

  const hasActiveCriteria =
    (activeFilter && activeFilter !== 'all') || searchQuery.trim().length > 0;

  return (
    <>
      <CompareBasket
        compareItems={compareItems}
        isCompareOpen={isCompareOpen}
        onRemoveCompare={handleRemoveCompare}
        onOpenCompare={() => setIsCompareOpen(true)}
      />

      <BottomBar
        ref={cartBtnRef}
        activeFilter={activeFilter}
        onSelectFilter={setActiveFilter}
        cartCount={totalCartCount}
        isCartAnimating={isCartAnimating}
        onOpenCart={() => setIsCartOpen(true)}
      />

      <SideBar
        isOpen={isMenuOpen}
        onClose={handleCloseMenu}
        activeFilter={activeFilter}
        onSelectFilter={setActiveFilter}
      />

      <Cart
        isOpen={isCartOpen}
        onClose={handleCloseCart}
        items={cartItems}
        onUpdateQuantity={updateCartQuantity}
        onRemoveItem={removeCartItem}
        onClearCart={clearCart}
      />

      <div className={`view${isCompareOpen ? ' view--compare' : ''}`}>
        <NavBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onOpenMenu={() => setIsMenuOpen(true)}
          hamburgerRef={hamburgerRef}
        />

        <BannerCarousel
          banners={banners}
          onCategorySelect={(filter) => {
            setActiveFilter(filter || 'all');
          }}
        />

        {hasActiveCriteria && (
          <div className="mx-auto w-[92%] max-w-[1280px] mb-2 flex justify-center">
            <div
              className="active-filter-banner"
              role="status"
              aria-live="polite"
            >
              <span>
                Showing{' '}
                <strong>
                  {activeFilter !== 'all'
                    ? getFilterDisplayName(activeFilter)
                    : 'All Categories'}
                </strong>
                {searchQuery.trim()
                  ? ` matching "${searchQuery.trim()}"`
                  : ''}{' '}
                ({visibleProductsCount} of {products.length})
              </span>
              <button
                type="button"
                className="active-filter-reset"
                onClick={() => {
                  setActiveFilter('all');
                  setSearchQuery('');
                }}
              >
                <X className="h-3 w-3" aria-hidden="true" /> Reset
              </button>
            </div>
          </div>
        )}

        <Grid
          products={sortedProducts}
          activeFilter={activeFilter}
          searchQuery={searchQuery}
          compareIds={compareIds}
          maxCompareReached={compareItems.length >= MAX_COMPARE_ITEMS}
          onToggleCompare={handleToggleCompare}
          onAddToCart={(product) => addToCart(product)}
        />
      </div>

      <CompareWrapper
        compareItems={compareItems}
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        onAddToCart={(product) => addToCart(product)}
      />
    </>
  );
}
