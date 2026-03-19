import OpenAI from 'openai';
import { createServiceClient } from '@/lib/supabase/server';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Generate embedding for a text string using OpenAI
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text.slice(0, 8000), // limit input size
  });
  return response.data[0].embedding;
}

/**
 * Embed all active products and store vectors in Supabase
 */
export async function embedAllProducts(): Promise<{ processed: number; errors: number }> {
  const supabase = await createServiceClient();
  let processed = 0;
  let errors = 0;

  const { data: products } = await supabase
    .from('products')
    .select('id, name, description, metadata')
    .eq('status', 'active');

  if (!products) return { processed: 0, errors: 0 };

  for (const product of products) {
    try {
      const text = `${product.name} ${product.description} ${JSON.stringify(product.metadata ?? {})}`;
      const embedding = await generateEmbedding(text);

      await supabase
        .from('products')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ embedding: embedding as any })
        .eq('id', product.id);

      processed++;
    } catch (err) {
      console.error(`Failed to embed product ${product.id}:`, err);
      errors++;
    }
  }

  return { processed, errors };
}

/**
 * Embed a single product
 */
export async function embedProduct(productId: string): Promise<void> {
  const supabase = await createServiceClient();

  const { data: product } = await supabase
    .from('products')
    .select('id, name, description, metadata')
    .eq('id', productId)
    .single();

  if (!product) throw new Error('Product not found');

  const text = `${product.name} ${product.description} ${JSON.stringify(product.metadata ?? {})}`;
  const embedding = await generateEmbedding(text);

  await supabase
    .from('products')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ embedding: embedding as any })
    .eq('id', productId);
}
