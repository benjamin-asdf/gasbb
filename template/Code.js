// Apps Script only sees functions declared in .gs/.js files. These thin
// wrappers are the entry points (menu items, triggers, custom functions);
// each one forwards to Clojure. Your code lives in main.clj.

function onOpen(e) {
  gasbb.run("main.clj", "main/on-open", e);
}

function hello() {
  return gasbb.run("main.clj", "main/hello");
}

/**
 * Evaluates Clojure in a cell. Inside the code, % or %1 ... %9 are the
 * arguments; a range arrives as a vector of row vectors.
 *
 *   =CLJ("(* %1 %2)", A1, B1)
 *   =CLJ("(->> % (map first) frequencies)", A2:A100)
 *
 * @param {string} code Clojure source
 * @param {...*} args values or ranges
 * @return the result; sequences spill into a range
 * @customfunction
 */
function CLJ(code, ...args) {
  return gasbb.cell(code, args);
}

// --- REPL sidebar -----------------------------------------------------------

function gasbbOpenRepl() {
  const html = HtmlService.createHtmlOutputFromFile("gasbb-repl").setTitle("Clojure REPL");
  SpreadsheetApp.getUi().showSidebar(html);
}

function gasbbReplEval(history, code) {
  return gasbb.replEval(history, code);
}
