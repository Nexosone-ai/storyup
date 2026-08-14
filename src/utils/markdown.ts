import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: true });

/** Render trusted (owner-authored) markdown to HTML for public blog pages. */
export async function renderMarkdown(md: string): Promise<string> {
  return marked.parse(md ?? "");
}
