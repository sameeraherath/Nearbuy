import { createContext, use, useMemo, useState, type PropsWithChildren } from 'react';
import { MAX_ITEM_QTY } from '@nearbuy/shared';
import { uuid } from './supabase';

export interface CartLine {
  foodId: string;
  name: string;
  price: number;
  qty: number;
}

interface CartValue {
  shopId: string | null;
  shopName: string | null;
  lines: CartLine[];
  count: number;
  /** Idempotency key for this cart; a new one is made after each order. */
  clientRef: string;
  add: (shop: { id: string; name: string }, food: { id: string; name: string; price: number }) => void;
  setQty: (foodId: string, qty: number) => void;
  qtyOf: (foodId: string) => number;
  clear: () => void;
}

const CartContext = createContext<CartValue | null>(null);

export function useCart() {
  const v = use(CartContext);
  if (!v) throw new Error('useCart must be inside <CartProvider>');
  return v;
}

export function CartProvider({ children }: PropsWithChildren) {
  const [shop, setShop] = useState<{ id: string; name: string } | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [clientRef, setClientRef] = useState(uuid);

  const value = useMemo<CartValue>(
    () => ({
      shopId: shop?.id ?? null,
      shopName: shop?.name ?? null,
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      clientRef,
      add(s, food) {
        // One shop per order: adding from another shop starts a new cart.
        if (shop && shop.id !== s.id) {
          setShop(s);
          setLines([{ foodId: food.id, name: food.name, price: food.price, qty: 1 }]);
          return;
        }
        setShop(s);
        setLines((prev) => {
          const existing = prev.find((l) => l.foodId === food.id);
          if (existing) {
            return prev.map((l) =>
              l.foodId === food.id ? { ...l, qty: Math.min(l.qty + 1, MAX_ITEM_QTY) } : l,
            );
          }
          return [...prev, { foodId: food.id, name: food.name, price: food.price, qty: 1 }];
        });
      },
      setQty(foodId, qty) {
        setLines((prev) => {
          const next =
            qty <= 0
              ? prev.filter((l) => l.foodId !== foodId)
              : prev.map((l) => (l.foodId === foodId ? { ...l, qty: Math.min(qty, MAX_ITEM_QTY) } : l));
          if (next.length === 0) setShop(null);
          return next;
        });
      },
      qtyOf: (foodId) => lines.find((l) => l.foodId === foodId)?.qty ?? 0,
      clear() {
        setLines([]);
        setShop(null);
        setClientRef(uuid());
      },
    }),
    [shop, lines, clientRef],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
