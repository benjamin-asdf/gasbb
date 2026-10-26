// Runs dist/gasbb.js in a bare V8 context shaped like Apps Script: no window,
// no require, no process, no setTimeout; services are small fakes.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";

const root = path.dirname(new URL(import.meta.url).pathname);
const bundle = fs.readFileSync(path.join(root, "../dist/gasbb.js"), "utf8");
const projectDir = path.join(root, "project");

function fakeSheet(name, rows) {
  const s = {
    name, rows,
    getDataRange: () => ({ getValues: () => s.rows.map(r => [...r]) }),
    getRange: (row, col, nr, nc) => ({
      setValues: (vals) => {
        assert.equal(vals.length, nr); vals.forEach(v => assert.equal(v.length, nc));
        vals.forEach((v, i) => { s.rows[row - 1 + i] = s.rows[row - 1 + i] || [];
                                 v.forEach((x, j) => s.rows[row - 1 + i][col - 1 + j] = x); });
      }}),
    appendRow: (r) => s.rows.push(r),
  };
  return s;
}

function newRuntime() {
  const logs = [];
  const sheets = {
    People: fakeSheet("People", [["First Name", "Age"], ["Ada", 36], ["Bob", 20], ["Cy", 44]]),
    Report: fakeSheet("Report", []),
  };
  const ctx = {
    console: { log: (...a) => logs.push(a.join(" ")) },
    HtmlService: {
      createHtmlOutputFromFile: (name) => {
        const f = path.join(projectDir, name);
        if (!fs.existsSync(f)) throw new Error("No HTML file named " + name + " was found.");
        const src = fs.readFileSync(f, "utf8");
        return { getContent: () => src };
      },
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (n) => sheets[n] || null,
        getActiveSheet: () => sheets.People,
      }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(bundle, ctx);
  return { gasbb: vm.runInContext("gasbb", ctx), ctx, logs, sheets };
}

// Values built inside the context have that realm's prototypes.
const plain = (x) => JSON.parse(JSON.stringify(x));

const tests = [];
const test = (name, f) => tests.push([name, f]);

test("bare context has no node globals", () => {
  const { ctx } = newRuntime();
  assert.equal(vm.runInContext("typeof require + typeof window + typeof process + typeof setTimeout", ctx),
               "undefinedundefinedundefinedundefined");
});

test("evalString returns plain JS", () => {
  const { gasbb } = newRuntime();
  assert.equal(gasbb.evalString("(+ 1 2)"), 3);
  assert.deepEqual(JSON.parse(JSON.stringify(gasbb.evalString("{:a [1 2] :b/c :d}"))), { a: [1, 2], "b/c": "d" });
});

test("js interop reaches Apps Script globals", () => {
  const { gasbb } = newRuntime();
  assert.equal(gasbb.evalString('(.getName #js {:getName (fn [] "x")})'), "x");
  assert.equal(gasbb.evalString('(some? js/SpreadsheetApp)'), true);
});

test("println goes to console.log line by line", () => {
  const { gasbb, logs } = newRuntime();
  gasbb.evalString('(println "a" 1) (print "b") (print "c") (prn {:x 1})');
  assert.deepEqual(logs, ["a 1", "bc{:x 1}"]);
});

test("run loads a file, requires other project files, converts result", () => {
  const { gasbb, logs } = newRuntime();
  const r = gasbb.run("main.clj", "main/greet", "world");
  assert.deepEqual(JSON.parse(JSON.stringify(r)), { greeting: "HELLO WORLD!", n: 3 });
  assert.deepEqual(logs, ["greeting world"]);
});

test("run loads a file only once per execution", () => {
  const { gasbb, ctx } = newRuntime();
  let reads = 0;
  const orig = ctx.HtmlService.createHtmlOutputFromFile;
  ctx.HtmlService.createHtmlOutputFromFile = (n) => { const r = orig(n); reads++; return r; };
  gasbb.run("main.clj", "main/greet", "a");
  gasbb.run("main.clj", "main/greet", "b");
  assert.equal(reads, 2); // main.clj + util/text.clj, each once
});

test("sheets helpers", () => {
  const { gasbb, sheets } = newRuntime();
  assert.deepEqual(Array.from(gasbb.run("main.clj", "main/people")), ["Ada", "Cy"]);
  gasbb.run("main.clj", "main/report!");
  assert.deepEqual(sheets.Report.rows, [["name", "age"], ["a", 1], ["b", ""]]);
});

test("unknown file and unknown fn give clear errors", () => {
  const { gasbb } = newRuntime();
  assert.throws(() => gasbb.run("nope.clj", "x"), /no project file named nope.clj/);
  assert.throws(() => gasbb.run("main.clj", "main/nope"), /could not resolve main\/nope/);
});

test("=CLJ cell function", () => {
  const { gasbb, ctx } = newRuntime();
  const js = (src) => vm.runInContext(src, ctx);
  assert.equal(gasbb.cell("(+ 1 2)", []), 3);
  assert.equal(gasbb.cell("(* %1 %2)", [6, 7]), 42);
  assert.equal(gasbb.cell("(reduce + (flatten %))", js("[[[1, 2], [3, 4]]]")), 10);
  assert.deepEqual(plain(gasbb.cell("(range 3)", [])), [[0], [1], [2]]);
  assert.deepEqual(plain(gasbb.cell("[[1 2] [3]]", [])), [[1, 2], [3, ""]]);
  assert.deepEqual(plain(gasbb.cell("(frequencies (map first %))", js('[[["a"], ["b"], ["a"]]]'))), [["a", 2], ["b", 1]]);
  assert.equal(gasbb.cell(":foo", []), "foo");
  assert.equal(gasbb.cell("nil", []), "");
  assert.equal(gasbb.cell("[]", []), "");
  assert.throws(() => gasbb.cell("(throw (ex-info \"boom\" {}))", []), /CLJ: boom/);
  assert.throws(() => gasbb.cell("(nope 1)", []), /CLJ: .*nope/);
});

test("dates pass through", () => {
  const { gasbb, ctx } = newRuntime();
  const d = vm.runInContext("new Date(2026, 0, 1)", ctx);
  assert.equal(gasbb.cell("(.getFullYear %)", [d]), 2026);
});

test("replEval replays history and reports errors", () => {
  const { gasbb } = newRuntime();
  const r1 = gasbb.replEval([], "(def x 41)");
  assert.equal(r1.value, "#'user/x");
  const r2 = gasbb.replEval(["(def x 41)"], '(println "hi") (inc x)');
  assert.equal(r2.value, "42");
  assert.equal(r2.out, "hi\n");
  const r3 = gasbb.replEval([], "(inc y)");
  assert.match(r3.error.message, /Unable to resolve symbol: y/);
});

test("setFileReader replaces HtmlService (library use)", () => {
  const { gasbb, ctx } = newRuntime();
  ctx.HtmlService.createHtmlOutputFromFile = () => { throw new Error("must not be called"); };
  gasbb.setFileReader((name) => name === "lib.clj" ? "(ns lib) (defn f [] :from-reader)" : null);
  assert.equal(gasbb.run("lib.clj", "lib/f"), "from-reader");
});

let failed = 0;
for (const [name, f] of tests) {
  try { f(); console.log("ok   " + name); }
  catch (e) { failed++; console.log("FAIL " + name + "\n     " + (e.stack || e).toString().split("\n").slice(0, 6).join("\n     ")); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
