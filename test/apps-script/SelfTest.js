// Pushed only into the test project. Run through the Apps Script API
// (scripts.run, devMode) by scripts/gas.py test; returns a report object.
function gasbbSelfTest() {
  const results = [];
  function check(name, f) {
    const t0 = Date.now();
    try {
      const v = f();
      results.push({ name, ok: true, ms: Date.now() - t0, value: JSON.stringify(v) });
    } catch (e) {
      results.push({ name, ok: false, ms: Date.now() - t0, error: String(e && e.stack || e) });
    }
  }
  function eq(a, b) {
    if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(JSON.stringify(a) + " != " + JSON.stringify(b));
    return a;
  }
  check("first eval (context init)", () => eq(gasbb.evalString("(+ 1 2)"), 3));
  check("second eval", () => eq(gasbb.evalString("(reduce + (range 1000))"), 499500));
  check("cell", () => eq(gasbb.cell("(* %1 %2)", [6, 7]), 42));
  check("cell spill", () => eq(gasbb.cell("(frequencies (map first %))", [[["a"], ["b"], ["a"]]]), [["a", 2], ["b", 1]]));
  check("cell date", () => eq(gasbb.cell("(.getFullYear %)", [new Date(2026, 0, 1)]), 2026));
  check("load main.clj via HtmlService + require", () => eq(gasbb.run("test.clj", "test/info"), { "loaded": true, "shout": "HI!" }));
  check("sheets: write + read maps", () => eq(gasbb.run("test.clj", "test/roundtrip"), [{ "name": "Ada", "age": 36 }, { "name": "Cy", "age": 44 }]));
  check("interop with services", () => gasbb.evalString("(str (.getName (.getActiveSpreadsheet js/SpreadsheetApp)))"));
  check("println -> console.log", () => gasbb.evalString('(println "hello from gasbb" (js/Date.))'));
  check("repl replay", () => eq(gasbb.replEval(["(def x 41)"], "(inc x)").value, "42"));
  check("error message", () => eq(gasbb.replEval([], "(inc y)").error.message, "Unable to resolve symbol: y"));
  return { version: gasbb.version, results };
}
