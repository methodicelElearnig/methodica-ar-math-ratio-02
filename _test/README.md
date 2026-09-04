# `_test/` — headless regression oracle

**Not deployed.** Development tooling only — exclude the whole folder from any release
package, **including the stub library**. `xapi-720-k.js` shares a basename with the real CDN
library by design (the `XAPI_USING_G` gate reads the filename), and in a sibling project the
stub was once pushed under the library's name.

## What is here

| File | What it does |
|---|---|
| `verify-report.js` | **Structure.** ~670 assertions. Loads the real `index.html`, `script.js`, `unit-js/*.js` and `main.js` of all five components into jsdom, runs the script tags in document order from disk, and asserts against what actually ran. It does not call the code in isolation — it runs it. |
| `statement-flow.js` | **Behaviour.** ~42 assertions. Which statements actually leave when a learner does something, in what order, carrying what result — and, more importantly, which ones do **not** leave when the same screen is reached again by a reload or the back button. |
| `xapi-720-k.js` | A local stand-in for the CDN library, backed by `sessionStorage`. Loaded in the browser through `?xapiLib=`, and executed directly by both harnesses. |

## Running

jsdom is not in the repo and there is no `package.json`. **Do not install it inside the
project folder** — it sits in a synced OneDrive directory, and jsdom's `node_modules` is
around 26MB that would be synced for nothing. Install elsewhere and point `NODE_PATH` at it:

```bash
mkdir -p /tmp/lomda-test && cd /tmp/lomda-test && npm install jsdom
```

Then from the unit root:

```bash
NODE_PATH=/tmp/lomda-test/node_modules node _test/verify-report.js && NODE_PATH=/tmp/lomda-test/node_modules node _test/statement-flow.js
```

Exit 0 = everything passed. `statement-flow.js` prints one `Not implemented: navigation to
another Document` line — that is jsdom reacting to the real `location.replace()` in
`leaveToPart()`, and it is expected.

## The selection criterion

**Every assertion here guards a failure mode that is otherwise silent.** A bug that shows up
as a red screen does not need a test; a bug that shows up as a learner quietly losing their
answers does. Concretely, the suite exists to catch:

- a `?v=` that drifted in one of five `index.html`, so two parts run different versions of one
  shared file inside one learner session
- a mixed-case cross-part path — a 404 on a case-sensitive host, and a split resume document
  because the state key comes from `location.pathname`
- an identifier declared in both a numbered `unit-js/*.js` and `main.js`: a `var`/`function`
  clash is a **silent last-wins overwrite**, and `main.js` loads last. This already happened
  once — `main.js` carried its own `shortId()` with no trailing-slash trim, which returns `''`
  for every canonical id
- a `SCREEN_TO_SUBCONTENT` that claims a screen the component does not own, or an item suffix
  that is not in `metadata/`
- an `XAPI_COMP_ID` that does not byte-match its metadata `id` — Kata then accepts statements
  pointing at an object that does not exist
- a `Set` that went through `JSON.stringify` and came back as `{}`, restoring as "nothing
  picked" on a screen that is also locked
- a `Q[sid]` whose **config** was carried through the state document, pinning a returning
  learner to the answer key that was live when they started
- `applyResumeVars` with a renamed parameter: its `eval` resolves `st` lexically, so a rename
  throws into the surrounding `try/catch` and the answers vanish with nothing in the console
- a painter that throws on another component's screen, or is not idempotent
- an answer committed without a synchronous `flushResumeSave()`
- a boot cover that is a child of `#app` (which is scaled, so a child stops covering), or whose
  failsafe depends on a JS file, or whose ceiling is below the loader's 10s metadata poll
- a duplicate `completed` — the failure the whole ledger exists to prevent
- any statement at all when the platform did not launch the unit

## What is deliberately NOT asserted

- **The parts are not compared to each other.** Unlike the ratio-01 reference, this unit keeps
  all screen logic in one shared `main.js`, so there is no 5× duplication to keep in step.
- **Video reporting.** None of the three `<video>` elements is wired, because none is
  instructional — two are looping decoration inside the character-choice cards and one is a
  confetti reward. The suite asserts that no `data-xapi-report` exists, so re-adding one is a
  deliberate act rather than a silent drift.
- **`correctAnswers` in `metadata/`.** The runtime never reads them. Two are known wrong,
  inherited from the deck — see the root `README.md`, *Known content issues*.
