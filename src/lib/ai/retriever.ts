import { createServiceClient } from '@/lib/supabase/server';
import { generateEmbedding } from './embeddings';

interface RetrievedProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  similarity: number;
}

/**
 * Retrieve relevant products using pgvector similarity search
 */
export async function retrieveRelevantProducts(
  query: string,
  limit = 5
): Promise<RetrievedProduct[]> {
  const supabase = await createServiceClient();
  const queryEmbedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc('match_products', {
    query_embedding: queryEmbedding,
    match_count: limit,
  });

  if (error) {
    console.error('Vector search error:', error);
    return [];
  }

  return (data ?? []) as RetrievedProduct[];
}
