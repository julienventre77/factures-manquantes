import ReactMarkdown from "react-markdown";

// Replies can echo bank labels written by third parties: no images, no HTML, and links
// only to official sites. Any other link is shown as plain text.
const OFFICIAL_SITE = /^https:\/\/([a-z0-9-]+\.)*(legifrance\.gouv\.fr|impots\.gouv\.fr|service-public\.fr)(\/|$)/i;

export function SafeMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      skipHtml
      disallowedElements={["img"]}
      components={{
        a: ({ href, children: text }) =>
          href && OFFICIAL_SITE.test(href) ? <a href={href} target="_blank" rel="noopener noreferrer">{text}</a> : <>{text}</>,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
