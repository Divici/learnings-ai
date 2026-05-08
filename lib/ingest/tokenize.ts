import { encode } from "gpt-tokenizer";

/** Approximate token count using the cl100k_base BPE tokenizer.
 *  Within ~5% of Voyage's own tokenizer for English text — sufficient
 *  for the 200–500 token target window the chunker uses. */
export function countTokens(text: string): number {
  if (!text) return 0;
  return encode(text).length;
}
