import { unified } from "unified";
import remarkParse from "remark-parse";
import { toString } from "mdast-util-to-string";
import type { Root, Heading, RootContent } from "mdast";
import { countTokens } from "@/lib/ingest/tokenize";

export type Chunk = {
  position: number;
  content: string;
  headingPath: string[];
  tokenCount: number;
  /** True for chunks that came from splitting an oversized section, used
   *  by orchestrators that want to track provenance. */
  splitOf?: number;
};

const MIN_TOKENS = 50;
const TARGET_MIN = 200;
const TARGET_MAX = 500;
const OVERLAP_RATIO = 0.2;

type RawSection = {
  headingPath: string[];
  content: string;
  depthOfBoundary: number;
};

function extractSections(md: string): RawSection[] {
  const tree = unified().use(remarkParse).parse(md) as Root;
  const sections: RawSection[] = [];
  const stack: { depth: number; text: string }[] = [];
  let current: RawSection | null = null;

  const flush = () => {
    if (current !== null && current.content.trim()) {
      sections.push(current);
    }
  };

  for (const node of tree.children as RootContent[]) {
    if (node.type === "heading") {
      const heading = node as Heading;
      const text = toString(heading);
      // Pop stack entries at same depth or deeper than this heading
      while (
        stack.length > 0 &&
        (stack[stack.length - 1]?.depth ?? 0) >= heading.depth
      ) {
        stack.pop();
      }
      stack.push({ depth: heading.depth, text });

      if (heading.depth >= 2) {
        // Start a new section at ## or ### boundaries
        flush();
        current = {
          headingPath: stack.map((s) => s.text),
          content: "",
          depthOfBoundary: heading.depth,
        };
      } else {
        // depth 1 (#) is the file title — track in stack for headingPath but don't start a chunk
        flush();
        current = null;
      }
    } else if (current !== null) {
      current.content += toString(node) + "\n\n";
    }
  }
  flush();
  return sections;
}

function splitOversized(section: RawSection, startPosition: number): Chunk[] {
  const sentences = section.content
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);

  const chunks: string[] = [];
  let buf: string[] = [];
  let bufTokens = 0;

  for (const sent of sentences) {
    const sTok = countTokens(sent);
    if (bufTokens + sTok > TARGET_MAX && buf.length > 0) {
      chunks.push(buf.join(" "));
      // Carry overlap (last ~20% of the buffer) into the next chunk
      const overlap = Math.max(1, Math.floor(buf.length * OVERLAP_RATIO));
      buf = buf.slice(-overlap);
      bufTokens = buf.reduce((acc, s) => acc + countTokens(s), 0);
    }
    buf.push(sent);
    bufTokens += sTok;
  }
  if (buf.length > 0) {
    chunks.push(buf.join(" "));
  }

  return chunks.map<Chunk>((content, i) => ({
    position: startPosition + i,
    content: content.trim(),
    headingPath: section.headingPath,
    tokenCount: countTokens(content),
    splitOf: startPosition,
  }));
}

export function chunkMarkdown(md: string): Chunk[] {
  const sections = extractSections(md);

  // Pass 1: convert sections to candidate chunks
  const candidates: Array<{ section: RawSection; chunk: Chunk }> =
    sections.map((s, i) => ({
      section: s,
      chunk: {
        position: i,
        content: s.content.trim(),
        headingPath: s.headingPath,
        tokenCount: countTokens(s.content),
      } as Chunk,
    }));

  // Pass 2: merge tiny SIBLING sections (same headingPath depth and same ## parent)
  // — never merge a ## section into a ### section or vice versa
  const merged: Chunk[] = [];
  let i = 0;
  while (i < candidates.length) {
    const cur = candidates[i];
    if (cur === undefined) {
      i++;
      continue;
    }
    let acc: Chunk = { ...cur.chunk };
    let accSection: RawSection = cur.section;
    let j = i + 1;

    while (j < candidates.length) {
      const next = candidates[j];
      if (next === undefined) break;

      const sameDepth =
        accSection.depthOfBoundary === next.section.depthOfBoundary;
      // Same ## parent: headingPath[1] matches (the ## heading text)
      const sameTopBoundary =
        acc.headingPath[1] === next.chunk.headingPath[1];
      const accUndersize = acc.tokenCount < TARGET_MIN;
      const fitsInWindow =
        acc.tokenCount + next.chunk.tokenCount <= TARGET_MAX;

      if (accUndersize && sameDepth && sameTopBoundary && fitsInWindow) {
        const combined = acc.content + "\n\n" + next.chunk.content;
        acc = {
          ...acc,
          content: combined,
          tokenCount: countTokens(combined),
        };
        accSection = { ...accSection }; // depth stays the same
        j++;
      } else {
        break;
      }
    }

    merged.push(acc);
    i = j;
  }

  // Pass 3: split oversized, assign final positions, drop undersized
  const out: Chunk[] = [];
  let nextPosition = 0;

  for (const m of merged) {
    if (m.tokenCount < MIN_TOKENS) {
      // Drop chunks that are too small and couldn't be merged
      continue;
    }
    if (m.tokenCount > TARGET_MAX) {
      const splits = splitOversized(
        {
          headingPath: m.headingPath,
          content: m.content,
          depthOfBoundary: 2,
        },
        nextPosition,
      );
      for (const s of splits) {
        if (s.tokenCount >= MIN_TOKENS) {
          out.push({ ...s, position: nextPosition++ });
        }
      }
    } else {
      out.push({ ...m, position: nextPosition++ });
    }
  }

  return out;
}
