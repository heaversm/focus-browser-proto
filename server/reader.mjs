// A page in reader view: fetched here, cleaned with Readability (the library
// behind Firefox's Reader View). The extension shows it in a sandboxed frame
// with scripts off.
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export async function readerView(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0" },
    redirect: "follow",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`The site answered ${response.status}.`);
  const html = await response.text();
  const { document } = parseHTML(html);
  // Relative links and images need the page's own address.
  const base = document.createElement("base");
  base.setAttribute("href", response.url);
  document.head?.prepend(base);
  const article = new Readability(document).parse();
  if (!article?.content) throw new Error("No readable article on that page.");
  return {
    url: response.url,
    title: article.title,
    byline: article.byline,
    siteName: article.siteName ?? new URL(response.url).host,
    content: article.content,
  };
}
