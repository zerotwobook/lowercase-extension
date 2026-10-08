import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const script = await readFile(new URL("../popup.js", import.meta.url), "utf8");
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function createPopup({ saved = {}, storageOverrides = {}, writeText } = {}) {
  const elements = Object.fromEntries(
    ["source", "result", "mode", "mode-lower", "mode-title", "result-label", "copy", "clear", "action-status", "storage-status"].map((id) => [id, {
      value: id === "mode-lower" ? "lower" : id === "mode-title" ? "title" : "", checked: id === "mode-lower", disabled: ["source", "mode", "copy", "clear"].includes(id), textContent: "", dataset: {},
      listeners: {}, focused: false, selected: false,
      addEventListener(name, callback) { this.listeners[name] = callback; },
      focus() { this.focused = true; },
      select() { this.selected = true; },
    }]),
  );
  const calls = [];
  const clipboard = [];
  const storage = { ...saved };
  const local = {
    async get() { return { ...storage }; },
    async set(values) { calls.push(["set", values.lastSource]); Object.assign(storage, values); },
    async remove(key) { calls.push(["remove", key]); delete storage[key]; },
    ...storageOverrides,
  };
  vm.runInNewContext(script, {
    document: { getElementById: (id) => elements[id] },
    chrome: { storage: { local } },
    navigator: { clipboard: { writeText: writeText ?? (async (text) => { clipboard.push(text); }) } },
  });
  return {
    elements, calls, clipboard, storage,
    async input(text) { elements.source.value = text; elements.source.listeners.input(); await tick(); },
    async choose(mode) { elements["mode-lower"].checked = mode === "lower"; elements["mode-title"].checked = mode === "title"; elements.mode.listeners.change(); await tick(); },
    async clear() { elements.clear.listeners.click(); await tick(); },
    async copy() { await elements.copy.listeners.click(); await tick(); },
  };
}

test("converts input immediately and preserves whitespace, Thai, emoji and symbols", async () => {
  const ui = createPopup();
  await tick();
  for (const [input, expected] of [
    ["HELLO WORLD", "hello world"], ["already lowercase", "already lowercase"],
    ["HELLO World!", "hello world!"],
    ["  HELLO\n\tWorld 123! ภาษาไทย 😀  ", "  hello\n\tworld 123! ภาษาไทย 😀  "],
  ]) {
    await ui.input(input);
    assert.equal(ui.elements.result.value, expected);
    assert.equal(ui.storage.lastSource, input);
  }
  await ui.input("");
  assert.equal(ui.elements.copy.disabled, true);
  assert.equal(ui.storage.lastSource, undefined);
});

test("restores the latest source on reopen and Clear deletes it", async () => {
  const first = createPopup();
  await tick();
  await first.input("RESTORE Me");
  const reopened = createPopup({ saved: first.storage });
  await tick();
  assert.equal(reopened.elements.source.value, "RESTORE Me");
  assert.equal(reopened.elements.result.value, "restore me");
  await reopened.clear();
  assert.equal(reopened.elements.source.value, "");
  assert.equal(reopened.elements.result.value, "");
  assert.equal(reopened.elements.copy.disabled, true);
  const cleared = createPopup({ saved: reopened.storage });
  await tick();
  assert.equal(cleared.elements.source.value, "");
});

test("loading keeps input disabled, and a failed load still allows conversion", async () => {
  const loading = deferred();
  const ui = createPopup({ storageOverrides: { get: () => loading.promise } });
  assert.equal(ui.elements.source.disabled, true);
  assert.equal(ui.elements.clear.disabled, true);
  loading.reject(new Error("read failed"));
  await tick();
  assert.equal(ui.elements.source.disabled, false);
  assert.match(ui.elements["storage-status"].textContent, /Couldn't load/);
  await ui.input("WORKS");
  assert.equal(ui.elements.result.value, "works");
});

test("invalid stored value is ignored", async () => {
  const ui = createPopup({ saved: { lastSource: 42 } });
  await tick();
  assert.equal(ui.elements.source.value, "");
  assert.equal(ui.elements.copy.disabled, true);
});

test("copies the output and reports success", async () => {
  const ui = createPopup();
  await tick();
  await ui.input("COPY Me!\nภาษาไทย 😀");
  await ui.copy();
  assert.deepEqual(ui.clipboard, ["copy me!\nภาษาไทย 😀"]);
  assert.equal(ui.elements["action-status"].textContent, "Copied to clipboard!");
  assert.equal(ui.elements.copy.disabled, false);
});

test("clipboard failure selects the result and tells the user to press Ctrl+C", async () => {
  const ui = createPopup({ writeText: async () => { throw new Error("denied"); } });
  await tick();
  await ui.input("FALLBACK");
  await ui.copy();
  assert.equal(ui.elements.result.focused, true);
  assert.equal(ui.elements.result.selected, true);
  assert.match(ui.elements["action-status"].textContent, /Ctrl\+C/);
  assert.equal(ui.elements["action-status"].dataset.error, "true");
});

test("a stale clipboard completion does not label newer text as copied", async () => {
  const writing = deferred();
  const ui = createPopup({ writeText: () => writing.promise });
  await tick();
  await ui.input("OLD");
  const copying = ui.copy();
  assert.equal(ui.elements.copy.disabled, true);
  await ui.input("NEW");
  writing.resolve();
  await copying;
  assert.equal(ui.elements["action-status"].textContent, "");
  assert.equal(ui.elements.result.value, "new");
});

test("a delayed old save completes before queued Clear, preventing text restoration", async () => {
  const saving = deferred();
  let saved;
  const writes = [];
  const ui = createPopup({ storageOverrides: {
    async set(values) { writes.push("set-start"); await saving.promise; saved = values.lastSource; writes.push("set-end"); },
    async remove() { saved = undefined; writes.push("remove"); },
  } });
  await tick();
  await ui.input("OLD TEXT");
  await ui.clear();
  assert.deepEqual(writes, ["set-start"]);
  assert.equal(ui.elements.result.value, "");
  saving.resolve();
  await tick();
  assert.deepEqual(writes, ["set-start", "set-end", "remove"]);
  assert.equal(saved, undefined);
});

test("failed writes report errors without breaking later saves or copying", async () => {
  let fail = true;
  const ui = createPopup({ storageOverrides: {
    async set() { if (fail) throw new Error("quota"); },
  } });
  await tick();
  await ui.input("FIRST");
  assert.match(ui.elements["storage-status"].textContent, /Couldn't save/);
  await ui.copy();
  assert.deepEqual(ui.clipboard, ["first"]);
  fail = false;
  await ui.input("SECOND");
  assert.equal(ui.elements["storage-status"].textContent, "");
});

test("failed deletion warns about restoring old text and Clear remains retryable", async () => {
  let fail = true;
  const ui = createPopup({ saved: { lastSource: "OLD" }, storageOverrides: {
    async remove() { if (fail) throw new Error("write failed"); },
  } });
  await tick();
  await ui.clear();
  assert.match(ui.elements["storage-status"].textContent, /Couldn't delete/);
  assert.equal(ui.elements.clear.disabled, false);
  fail = false;
  await ui.clear();
  assert.equal(ui.elements["storage-status"].textContent, "");
});

test("Title Case updates existing text while preserving whitespace, punctuation and apostrophes", async () => {
  const ui = createPopup();
  await tick();
  const input = "  HELLO WORLD!\n\tDON'T STOP — 'HAPPY-DAYS' ภาษาไทย 😀  ";
  await ui.input(input);
  await ui.choose("title");
  assert.equal(ui.elements.result.value, "  Hello World!\n\tDon't Stop — 'Happy-Days' ภาษาไทย 😀  ");
  assert.equal(ui.elements.source.value, input);
  assert.equal(ui.elements["result-label"].textContent, "Title Case result");
  await ui.copy();
  assert.deepEqual(ui.clipboard, ["  Hello World!\n\tDon't Stop — 'Happy-Days' ภาษาไทย 😀  "]);
  await ui.choose("lower");
  assert.equal(ui.elements.result.value, input.toLowerCase());
  assert.equal(ui.elements["action-status"].textContent, "");
});

test("restores the chosen style on reopen and keeps it after Clear", async () => {
  const first = createPopup();
  await tick();
  await first.choose("title");
  await first.input("HELLO WORLD");
  const reopened = createPopup({ saved: first.storage });
  await tick();
  assert.equal(reopened.elements["mode-title"].checked, true);
  assert.equal(reopened.elements.result.value, "Hello World");
  await reopened.clear();
  assert.equal(reopened.storage.lastSource, undefined);
  assert.equal(reopened.storage.lastMode, "title");
  const cleared = createPopup({ saved: reopened.storage });
  await tick();
  assert.equal(cleared.elements["mode-title"].checked, true);
  assert.equal(cleared.elements.result.value, "");
  assert.equal(cleared.elements.copy.disabled, true);
});

test("older saved data or an invalid style defaults to lowercase", async () => {
  for (const saved of [{ lastSource: "HELLO WORLD" }, { lastSource: "HELLO WORLD", lastMode: "invalid" }]) {
    const ui = createPopup({ saved });
    await tick();
    assert.equal(ui.elements["mode-lower"].checked, true);
    assert.equal(ui.elements.result.value, "hello world");
  }
});

test("style changes while copying do not mark a different result as copied", async () => {
  const writing = deferred();
  const ui = createPopup({ writeText: () => writing.promise });
  await tick();
  await ui.input("HELLO WORLD");
  const copying = ui.copy();
  await ui.choose("title");
  writing.resolve();
  await copying;
  assert.equal(ui.elements.result.value, "Hello World");
  assert.equal(ui.elements["action-status"].textContent, "");
});

test("a failed style save reports the issue without breaking conversion", async () => {
  const ui = createPopup({ saved: { lastSource: "HELLO WORLD" }, storageOverrides: {
    async set() { throw new Error("write failed"); },
  } });
  await tick();
  await ui.choose("title");
  assert.equal(ui.elements.result.value, "Hello World");
  assert.match(ui.elements["storage-status"].textContent, /Couldn't save your text style/);
});
