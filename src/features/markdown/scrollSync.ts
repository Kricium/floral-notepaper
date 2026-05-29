export interface BlockMeasurement {
  text: string;
  offset: number;
  height: number;
}

/** Parse markdown text into non-empty logical blocks (headings, code fences, math blocks, etc.) */
function parseBlocks(text: string): string[] {
  const lines = text.split("\n");
  const blocks: string[] = [];
  let i = 0;

  while (i < lines.length) {
    // Skip blank lines
    if (lines[i].trim() === "") {
      i++;
      continue;
    }

    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code block
    const fenceMatch = trimmed.match(/^(```|~~~)/);
    if (fenceMatch) {
      const fence = fenceMatch[1];
      const start = i;
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) i++;
      if (i < lines.length) i++;
      blocks.push(lines.slice(start, i).join("\n"));
      continue;
    }

    // Display math block
    if (trimmed === "$$") {
      const start = i;
      i++;
      while (i < lines.length && lines[i].trim() !== "$$") i++;
      if (i < lines.length) i++;
      blocks.push(lines.slice(start, i).join("\n"));
      continue;
    }

    // Heading / HR (single-line blocks)
    if (/^#{1,6}\s/.test(line) || /^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      blocks.push(line);
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      const start = i;
      while (i < lines.length && lines[i].startsWith(">")) i++;
      blocks.push(lines.slice(start, i).join("\n"));
      continue;
    }

    // Table
    if (/^\s*\|/.test(line)) {
      const start = i;
      while (i < lines.length && /^\s*\|/.test(lines[i])) i++;
      blocks.push(lines.slice(start, i).join("\n"));
      continue;
    }

    // List
    if (/^(\s*[-*+]\s|\s*\d+[.)]\s)/.test(line)) {
      const start = i;
      while (i < lines.length) {
        const l = lines[i];
        if (l.trim() === "") {
          const next = i + 1;
          if (next < lines.length && /^(\s*[-*+]\s|\s*\d+[.)]\s)/.test(lines[next])) {
            i++;
            continue;
          }
          break;
        }
        if (/^(#{1,6}\s|```|~~~|>)/.test(l) || l.trim() === "$$") break;
        i++;
      }
      blocks.push(lines.slice(start, i).join("\n"));
      continue;
    }

    // Paragraph
    const start = i;
    while (i < lines.length && lines[i].trim() !== "") {
      const l = lines[i];
      if (/^(#{1,6}\s|```|~~~|>)/.test(l)) break;
      if (l.trim() === "$$") break;
      if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(l.trim())) break;
      i++;
    }
    if (i > start) {
      blocks.push(lines.slice(start, i).join("\n"));
    }
  }

  return blocks;
}

/**
 * Measure pixel offsets of each block when rendered with textarea-equivalent styling.
 * Must be called after the textarea is in the DOM.
 */
export function measureBlocks(content: string, textarea: HTMLTextAreaElement): BlockMeasurement[] {
  const blocks = parseBlocks(content);
  if (blocks.length === 0) return [];

  const style = getComputedStyle(textarea);
  const fontSize = parseFloat(style.fontSize) || 14;
  const lineHeight = parseFloat(style.lineHeight) || fontSize * 1.9;

  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed; top: -9999px; left: -9999px; visibility: hidden;
    width: ${textarea.clientWidth}px;
    font-family: ${style.fontFamily};
    font-size: ${fontSize}px;
    line-height: ${lineHeight};
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
    tab-size: 2;
  `;
  document.body.appendChild(container);

  const results: BlockMeasurement[] = [];
  for (const block of blocks) {
    const div = document.createElement("div");
    div.textContent = block;
    container.appendChild(div);
    results.push({
      text: block,
      offset: div.offsetTop,
      height: div.offsetHeight,
    });
  }

  document.body.removeChild(container);
  return results;
}

/** Find which block index contains the given pixel offset. */
export function blockIndexAtOffset(measurements: BlockMeasurement[], offset: number): number {
  for (let i = measurements.length - 1; i >= 0; i--) {
    if (measurements[i].offset <= offset) return i;
  }
  return 0;
}

/**
 * Add data-block-index attributes to block-level children
 * of the MarkdownPreview root element (.font-body).
 * Indices match the non-empty block array produced by parseBlocks.
 */
export function tagPreviewBlocks(container: HTMLElement): void {
  const root = container.querySelector<HTMLElement>(".font-body");
  if (!root) return;
  let index = 0;
  for (const child of root.children) {
    if (child instanceof HTMLElement) {
      child.setAttribute("data-block-index", String(index++));
    }
  }
}
