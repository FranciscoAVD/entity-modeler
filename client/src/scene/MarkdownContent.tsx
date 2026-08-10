import Markdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import { cn } from "@/lib/utils";

// Custom element styling matching the panel's existing typography, rather than pulling in
// @tailwindcss/typography for what's a handful of tags (plan.md's Phase 8 notes plan).
const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  // text-xl matches GroupDetails/RelationshipDetails' own title in InfoPanel.tsx.
  h1: ({ children }) => (
    <h1 className="text-primary mt-3 mb-1.5 text-xl font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-primary mt-3 mb-1.5 text-lg font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-primary mt-3 mb-1 text-base font-semibold first:mt-0">{children}</h3>
  ),
  // marker:text-primary tints just the bullet/number, not the item text itself — matches how
  // text-primary is used as an accent elsewhere in the panel (badges, note titles), not body text.
  ul: ({ children }) => (
    <ul className="marker:text-primary mb-2 list-disc space-y-0.5 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="marker:text-primary mb-2 list-decimal space-y-0.5 pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li>{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="bg-border/40 rounded-xs px-1 py-0.5 font-mono text-sm">{children}</code>
  ),
  // [&>code]: resets the inline `code` styling above for the one nested inside a block, since
  // react-markdown v10 no longer tells the code renderer whether it's inline or fenced.
  pre: ({ children }) => (
    <pre className="bg-border/20 [&>code]:bg-transparent [&>code]:p-0 mb-2 overflow-x-auto rounded-sm p-2 font-mono text-sm last:mb-0">
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-border text-muted-foreground mb-2 border-l-2 pl-2 italic last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-border my-2" />,
};

export function MarkdownContent({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("text-justify text-base break-words", className)}>
      <Markdown remarkPlugins={[remarkBreaks]} components={components}>
        {text}
      </Markdown>
    </div>
  );
}
