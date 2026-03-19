'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Product } from '@/lib/types/database.types';

interface UseProductsOptions {
  page?: number;
  limit?: number;
  vendorId?: string;
  status?: 'draft' | 'active' | 'paused';
}

export function useProducts(options: UseProductsOptions = {}) {
  const { page = 1, limit = 20, vendorId, status = 'active' } = options;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('status', status)
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (vendorId) {
        query = query.eq('vendor_id', vendorId);
      }

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;
      setProducts(data ?? []);
      setTotal(count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [page, limit, vendorId, status]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error, total, refetch: fetchProducts };
}
