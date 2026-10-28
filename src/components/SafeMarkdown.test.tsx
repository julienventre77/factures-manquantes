import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SafeMarkdown } from "./SafeMarkdown";

const html = (md: string) => renderToStaticMarkup(<SafeMarkdown>{md}</SafeMarkdown>);

describe("SafeMarkdown", () => {
  it("never loads an image", () => {
    expect(html("Voici ![x](https://x.ex/p.png?q=secret)")).not.toMatch(/<img|x\.ex/);
  });
  it("keeps links to official sites only", () => {
    const out = html("[loi](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006303954) et [ici](https://x.ex/phish)");
    expect(out).toContain('href="https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006303954"');
    expect(out).not.toContain("x.ex");
    expect(out).toContain("ici");
  });
  it("does not trust look-alike domains or raw HTML", () => {
    expect(html("[a](https://legifrance.gouv.fr.x.ex/) <b>gras</b>")).not.toMatch(/href|<b>/);
  });
});
