// Lets real sites show inside the extension's own page.
//
// Many sites send X-Frame-Options or a Content-Security-Policy frame-ancestors
// rule that stops them being shown inside another page. For frames inside one
// of our tabs, and only those, a session rule removes both headers. Firefox
// 159 ignores header changes made from a blocking webRequest listener for
// these headers, so this uses declarativeNetRequest. webRequest only records
// framed loads that fail, for the site panel test.

const OURS = browser.runtime.getURL("");

// Framed loads that failed, for the site panel test.
const responses = [];
// Pages loaded as normal tabs, reported by frame-probe.js (the test's control).
const topProbes = [];

const insideOurPage = (details) =>
  (details.frameAncestors ?? []).some((a) => a.url?.startsWith(OURS));

// One rule, covering every tab that has asked. Rule IDs are per extension.
const RULE_ID = 1;
const framingTabs = new Set();

async function allowFramingIn(tabId) {
  framingTabs.add(tabId);
  await browser.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [RULE_ID],
    addRules: [{
      id: RULE_ID,
      priority: 1,
      action: {
        type: "modifyHeaders",
        responseHeaders: [
          { header: "x-frame-options", operation: "remove" },
          // The whole policy goes: a rule can't remove one directive. Acceptable
          // for a prototype; a product would rewrite only frame-ancestors.
          { header: "content-security-policy", operation: "remove" },
        ],
      },
      condition: { resourceTypes: ["sub_frame"], tabIds: [...framingTabs] },
    }],
  });
}

browser.tabs.onRemoved.addListener((tabId) => {
  if (framingTabs.delete(tabId) && framingTabs.size === 0) {
    browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: [RULE_ID] });
  }
});

browser.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (insideOurPage(details)) responses.push({ url: details.url, error: details.error, time: Date.now() });
  },
  { urls: ["<all_urls>"], types: ["sub_frame"] }
);

// While a task runs, only its tab may exist: new tabs and windows are closed.
let lockedTab = null;
browser.tabs.onCreated.addListener((tab) => {
  if (lockedTab == null || tab.id === lockedTab) return;
  browser.tabs.remove(tab.id).catch(() => {});
  browser.tabs.update(lockedTab, { active: true }).catch(() => {});
});
browser.tabs.onRemoved.addListener((tabId) => { if (tabId === lockedTab) lockedTab = null; });

browser.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "lock-tabs" && sender.url?.startsWith(OURS) && sender.tab) {
    lockedTab = message.on ? sender.tab.id : null;
    return;
  }
  // Only our own pages can ask; content scripts run in web pages and can't.
  const fromOurPage = sender.url?.startsWith(OURS);
  if (message?.type === "allow-framing" && fromOurPage && sender.tab) return allowFramingIn(sender.tab.id);
  // The end of a task: close the window so the cool-down starts.
  if (message?.type === "close-window" && fromOurPage && sender.tab) return browser.windows.remove(sender.tab.windowId);
  if (message?.type === "probe-top") {
    topProbes.push({ ...message.probe, tabId: sender.tab?.id });
    if (topProbes.length > 50) topProbes.shift();
  }
  if (message?.type === "responses") return Promise.resolve(responses);
  if (message?.type === "top-probes") return Promise.resolve(topProbes);
});
