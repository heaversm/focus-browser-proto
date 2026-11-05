# Focus Browser

A browser that starts by asking what you're trying to do, builds the interface that task needs, keeps everything else out, and closes when you're done. A Future of the Web prototype for the week's theme, *belong*.

A Firefox extension, run full screen in its own Firefox profile, plus a small local server that holds the API key and talks to Claude.

## Run it

    npm install
    npm run rehearse               # scripted answers, no AI, no cost
    npm start                      # the real thing (needs a key, below)
    npm start -- --window          # a normal window instead of full screen
    npm run reset                  # end a break early and clear the saved shelf

Needs Firefox at `/Applications/Firefox.app` (or set `FIREFOX` to the binary). Quit with Cmd-Q.

## The AI

`npm start` reads `ANTHROPIC_API_KEY` from your shell, or from `.env`: `cp .env.example .env` and paste the key after the `=` (`.env` is git-ignored). Model and effort are in `server/settings.mjs`; the default model is `claude-opus-5-5`. Each step can search and read the web, so each costs real money.

## Mac Focus mode (optional)

The browser can turn a Focus mode on while you work and off when you're done. It runs two shortcuts you make once in the Shortcuts app:

- **Focus Browser On**: one action, *Set Focus*. Choose your Focus (e.g. Do Not Disturb), set it to *Turn On*, and set the duration to *Until Turned Off*.
- **Focus Browser Off**: one action, *Set Focus*, the same Focus, *Turn Off*.

The browser runs "Off" when the task ends, when you stop, and when the focus browser quits. For a Focus that silences everything but chosen people, make one in System Settings → Focus first. If the shortcuts don't exist, the browser says so and carries on.

Check them from Terminal: `shortcuts run "Focus Browser On"`, then `shortcuts run "Focus Browser Off"`.

## Tests

    npm run test:app               # whole flow with scripted answers; screenshots in test-results/app/
    npm run test:site-pane         # can real pages show inside our page?
    npm run test:intents           # five different intents through the real AI (costs credit)
    npm run shots:mockup           # screenshots of the storyboard

Add `-- --headless` to the first two to hide the window.

## Layout

    extension/app/                the interface: intent, agreement, workspace, done, cool-down
    extension/app/pieces.js       draws each piece the AI can choose
    extension/background.js       lets real sites show in frames inside our own tab; closes the window at the end
    extension/frame-probe.js      reports what a frame shows (site panel test)
    extension/site-test/          the site panel test page
    server/index.mjs              local server, 127.0.0.1 only
    server/schema.mjs             the agreement and the pieces the AI may return
    server/planner.mjs            the Claude calls
    server/reader.mjs             reader view (Readability)
    server/focus.mjs              Mac Focus mode through Shortcuts
    server/rehearse.mjs           scripted answers for --rehearse
    mockup/                       clickable storyboard of the hike demo, invented content
    scripts/start.mjs             starts the server and Firefox
    tests/                        the tests above
