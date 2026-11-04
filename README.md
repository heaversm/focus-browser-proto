# Focus Browser

A browser that starts by asking what you're trying to do, builds the interface that task needs, keeps everything else out, and closes when you're done. A Future of the Web prototype for the week's theme, *belong*.

Built as a Firefox extension, run in its own Firefox profile.

## Run it

    npm install
    npm run test:site-pane            # opens Firefox; add -- --headless to hide it
    npm run shots:mockup              # screenshots each storyboard stage

The storyboard: open `mockup/index.html` in a browser; arrow keys move between stages.

Needs Firefox at `/Applications/Firefox.app` (or set `FIREFOX` to the binary).

## Layout

    extension/manifest.json       the extension
    extension/background.js       lets real sites show in frames inside our own tab
    extension/frame-probe.js      reports what a frame shows when our page asks
    extension/site-test/          the site panel test page and its list of pages
    mockup/                       clickable storyboard of the hike demo, invented content
    tests/site-pane.mjs           runs the site panel test and prints a table
    tests/lib/firefox.mjs         opens a clean Firefox with the extension installed
