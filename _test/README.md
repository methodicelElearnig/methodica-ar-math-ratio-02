# `_test/` — headless regression oracle

**Not deployed.** Development tooling only — exclude the whole folder from any release
package, **including the stub library**. `xapi-720-k.js` shares a basename with the real CDN
library by design (the `XAPI_USING_G` gate reads the filename), and in a sibling project the
stub was once pushed under the library's name.

That is no longer left to whoever cuts the package. `docs-and-tools/package-allowlist.ps1`
excludes this folder twice over — `_test` by name, and any path segment starting with an
underscore — and `verify-package.ps1`'s HYGIENE check scans a finished package for `_*` again,
so the stub reaching a release now fails a script rather than a code review. Neither guard
replaces the rule; they just stop it depending on memory.

## What is here

| File | What it does |
|---|---|
| `verify-report.js` | **Structure.** 1051 assertions. Loads the real `index.html`, `script.js`, `unit-js/*.js` and `main.js` of all five components into jsdom, runs the script tags in document order from disk, and asserts against what actually ran. It does not call the code in isolation — it runs it. |
| `statement-flow.js` | **Behaviour.** 98 assertions. Which statements actually leave when a learner does something, in what order, carrying what result — and, more importantly, which ones do **not** leave when the same screen is reached again by a reload or the back button. |
| `xapi-720-k.js` | A local stand-in for the CDN library, backed by `sessionStorage`. Loaded in the browser through `?xapiLib=`, and executed directly by both harnesses. It also models the real library's **deferral guard** — an item's `completed` is dropped, with no queue and no retry, unless an `answered` for that item passed through in the same page load. Keep it: without the guard the suite is blind to a whole class of permanently lost statements, which is how one survived every assertion here until it was found live against Kata. |

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

### Pointing the suite at a deployment package

Both harnesses take an alternative base path as their first argument. Use it before an
upload: it asserts against the bytes that will actually ship, not against the tree they
were copied from.

```bash
NODE_PATH=... node _test/verify-report.js ../../deployments/2026-09-07
```

A working-tree run is **1051/1051, zero failures**. Nothing in this unit's suite needs a file
a package excludes, so a package run should also be clean — the totals differ only because a
package holds `DEPLOY.md` in place of the repo's linked docs, which changes what the
`docs resolve` section has to check. A different total is expected; a *failure* is not.

⚠️ **Only the newest package on disk is clean**, and that is the expected shape: a package fails
exactly the assertions added after it was cut. `verify-report.js`, 17.09.26:

| package | | |
|---|---|---|
| `2026-09-07` | 911/125 | predates the finale cut, platform routing, state v6 and the set gate |
| `2026-09-08` | 911/125 | ditto — **this is what the CDN is still serving** |
| `2026-09-08b` | 912/118 | finale cut; predates the rest |
| `2026-09-16` | 967/62 | platform routing; predates state v6 and the gate |
| `2026-09-16b` | 1004/25 | state v6; predates the gate (20 × `MAIN_FNS`, 5 × `gate`) |
| `2026-09-17` | **1046/0** | current |

**The packages are the stale side, not the suite.** Re-cut one and it returns to clean. A package
total is never the tree total — `docs resolve` walks the package's own `DEPLOY.md` links instead of
the repo's, so a longer deployment record raises the count. **Compare failures, not totals.**

⚠️ **`statement-flow.js` cannot run against a package at all** — 6 passed, 10 failed, every failure
`ENOENT … _test/xapi-720-k.js`. It boots each scenario against that stub, which a package correctly
omits, so only `reporting off is off` (the one scenario with `noLibrary`) survives. Same result
against every package on disk. Run it against the tree.

⚠️ **Do not assume that stays true.** The sibling unit `methodica-math-ratio-01` runs
1675/9 against its own package, and all nine failures are assertions that want
`_test/xapi-720-k.js` or an `index_dev.html` — files a package correctly omits. Add one
assertion here that reads a development file and this run stops being clean, without
anything being wrong. Read the failure list, not the exit code.

The real gate for a package is `docs-and-tools/verify-package.ps1`, which knows what a
package is meant to contain and exits 0 on a good one.

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
- a cross-part hop, a landing-pointer move or a unit-level statement reaching production: since
  2026-09-16 the platform routes, so `leaveToPart` must report and stop, the first screen's "חזרה"
  must be hidden (attribute **and** `display:none` — the attribute alone lost to `.scq-back`'s own
  display rule in a sibling unit), `goBackToPreviousPart` must move nothing, and every
  `location.replace` in shipped code must sit inside `if (DEV_NAV)`; the flag itself must need
  `?dev=1` **and** no `?registration` (`routing`, `devnav`, and the rewritten `seam` scenario,
  which also drives the `?dev=1` twin and part 05's finale)
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

## `back-resume.js` — every question screen after "חזרה" and after a resume (2026-10-07)

Real Chrome (puppeteer-core + local Chrome). Each question screen is answered through its own
controls into its final state, snapshotted, left and re-entered through the next screen's real
"חזרה" (a part's last screen: back one and forward), and restored into a fresh page with
`applyExecutionState`; the three snapshots (visibility, classes, disabled, text, values, popup
position and colour) must match. 27 of 35 passed before the 07.10 fix, 35 of 35 after.

```bash
NODE_PATH=/tmp/lomda-test/node_modules node _test/back-resume.js
```
