// Runs in every page and frame. Inside one of our frames, it tells our page
// what loaded and can click a link on request. In a normal tab it reports to
// the background script (the site panel test's control). Nothing is sent
// anywhere outside the browser.

(() => {
  const OURS = browser.runtime.getURL("").replace(/\/$/, "");

  const BOT_WALL = /just a moment|access denied|attention required|verify you are human|are you a robot|captcha|request blocked/i;

  function probe() {
    const text = document.body?.innerText ?? "";
    const links = [...document.querySelectorAll("a[href]")];
    // A link a person might click: same site, a real page, opens in place.
    const next = links.find((a) => {
      try {
        const u = new URL(a.href, location.href);
        return u.origin === location.origin && u.pathname !== location.pathname &&
          !u.hash && a.target !== "_blank" && a.checkVisibility?.() && !/\.(pdf|jpg|png|zip)$/i.test(u.pathname);
      } catch { return false; }
    });
    return {
      href: location.href,
      title: document.title,
      textLength: text.length,
      links: links.length,
      next: next?.href ?? null,
      botWall: BOT_WALL.test(document.title) || (text.length < 2000 && BOT_WALL.test(text)),
    };
  }

  if (window === window.top) {
    browser.runtime.sendMessage({ type: "probe-top", probe: probe() }).catch(() => {});
    return;
  }
  // In a frame, speak only when our page asks. The origin check means an
  // ordinary site embedding this frame never hears from it.
  window.addEventListener("message", (event) => {
    if (event.origin !== OURS || event.source !== window.parent) return;
    const command = event.data?.focusCommand;
    if (command === "probe") {
      window.parent.postMessage({ focusProbe: probe() }, OURS);
    } else if (command === "click-next") {
      const p = probe();
      const link = p.next && [...document.querySelectorAll("a[href]")].find((a) => a.href === p.next);
      if (link) link.click();
      window.parent.postMessage({ focusClicked: link ? p.next : null }, OURS);
    }
  });
})();
