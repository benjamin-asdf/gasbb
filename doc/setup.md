# Setting up gasbb

Three ways in, from fastest to most flexible.

## A. Copy the demo spreadsheet (1 minute)

1. Open the [demo spreadsheet](https://docs.google.com/spreadsheets/d/1CXI2q7DkxalQYklY1nv3d8c9VCCzEUOvAMuobF729s4/edit)
   and choose **File → Make a copy**, or open the
   [copy link](https://docs.google.com/spreadsheets/d/1CXI2q7DkxalQYklY1nv3d8c9VCCzEUOvAMuobF729s4/copy)
   directly. The bound Apps Script project, with gasbb and an example `main.clj`, is copied
   along with the sheet.
2. Open your copy. After a moment a **Clojure** menu appears. The first time you use it,
   Google asks you to authorize the script (*Review permissions → your account →
   Advanced → Go to … (unsafe)*). This is the standard screen for scripts you own.
3. **Clojure → Open REPL**, or type `=CLJ("(+ 1 2)")` into any cell.
4. Edit your Clojure code: **Extensions → Apps Script → `main.clj`**.

## B. Add gasbb to an existing spreadsheet

1. In the spreadsheet: **Extensions → Apps Script**.
2. **+ → Script**, name it `gasbb`, and replace its content with
   [`dist/gasbb.js`](../dist/gasbb.js). The file is ~950 KB, so paste the raw file:
   ```
   curl -sL https://raw.githubusercontent.com/benjamin-asdf/gasbb/main/dist/gasbb.js | xclip -selection clipboard   # Linux
   curl -sL https://raw.githubusercontent.com/benjamin-asdf/gasbb/main/dist/gasbb.js | pbcopy                       # macOS
   ```
3. Replace `Code.gs` with [`template/Code.js`](../template/Code.js).
4. **+ → HTML**, name it `gasbb-repl`, and paste
   [`template/gasbb-repl.html`](../template/gasbb-repl.html).
5. **+ → HTML**, name it `main.clj`, and paste [`template/main.clj`](../template/main.clj).
   The editor shows it as `main.clj.html`. That is fine: gasbb reads it under the name
   `main.clj`.
6. **Project Settings → Show "appsscript.json" manifest file in editor**, then copy
   [`template/appsscript.json`](../template/appsscript.json). See [Scopes](#scopes).
7. Reload the spreadsheet.

More namespaces: an HTML file named `util/text.clj` is found by
`(require '[util.text :as text])`.

## C. Local files with clasp

[clasp](https://github.com/google/clasp) pushes local files to Apps Script. It only knows
`.js`/`.gs`/`.html`/`.json`, so name Clojure files `*.clj.html` locally:

```
my-sheet-tools/
  .clasp.json
  appsscript.json
  gasbb.js              # from dist/
  Code.js
  gasbb-repl.html
  main.clj.html         # (ns main ...)
  util/text.clj.html    # (ns util.text ...)
```

```
npx @google/clasp login
npx @google/clasp clone <scriptId>    # or: clasp create --type sheets
npx @google/clasp push --watch
```

To keep editing with Clojure tooling (syntax highlighting, paredit, clj-kondo), tell your
editor that `*.clj.html` is Clojure. In Emacs: `(add-to-list 'auto-mode-alist
'("\\.clj\\.html\\'" . clojure-mode))`.

## Scopes

Apps Script normally works out which OAuth scopes a project needs by scanning its script
files for calls like `GmailApp.sendEmail`
([docs](https://developers.google.com/apps-script/concepts/scopes)). It can't see into your
`.clj` files, so a service you only use from Clojure is not detected. List every scope
explicitly in `appsscript.json` → `oauthScopes`. The template has the two that the demo
needs:

```json
"oauthScopes": [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/script.container.ui"
]
```

Add what your code uses, e.g. `https://www.googleapis.com/auth/script.send_mail` for
`(.sendEmail js/MailApp …)`, `https://www.googleapis.com/auth/drive` for `js/DriveApp`,
`https://www.googleapis.com/auth/script.external_request` for `js/UrlFetchApp`. On the next
run, Google asks you to authorize the new scopes.

## Standalone scripts, web apps, triggers

gasbb doesn't need a spreadsheet. In a standalone Apps Script project, use the same files
without the Sheets parts:

```js
function doGet(e)      { return gasbb.run("main.clj", "main/do-get", e); }   // web app
function nightly()     { gasbb.run("main.clj", "main/nightly!"); }           // time-driven trigger
```

Time-driven and installable triggers point at the declared JS function (`nightly`), which
forwards to Clojure.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `gasbb: no project file named main.clj` | The HTML file must be called exactly `main.clj` (shown as `main.clj.html`). |
| `gasbb: could not resolve main/foo` | The fn is missing or the ns name differs from `main`. Names are `"ns/fn"`. |
| `=CLJ` shows `#ERROR!` | Hover the cell for the message, e.g. `CLJ: Unable to resolve symbol: x`. |
| `=CLJ` stays at `Loading...` | The first call after an edit loads the ~950 KB bundle. Wait a second. |
| Menu does not appear | `onOpen` only runs on reload, and only after the script was saved. Check *Executions* in the Apps Script editor. |
| `You do not have permission to call …` | The service's scope is missing from `oauthScopes`, see [Scopes](#scopes). |
| `println` output | **Executions** in the Apps Script editor (or Cloud Logging). |

---

*Generated by Claude Code on behalf of Benjamin Schwerdtner.*
