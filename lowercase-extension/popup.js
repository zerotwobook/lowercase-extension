"use strict";

const source = document.getElementById("source");
const result = document.getElementById("result");
const modeGroup = document.getElementById("mode");
const modeChoices = [document.getElementById("mode-lower"), document.getElementById("mode-title")];
const resultLabel = document.getElementById("result-label");
const copyButton = document.getElementById("copy");
const clearButton = document.getElementById("clear");
const actionStatus = document.getElementById("action-status");
const storageStatus = document.getElementById("storage-status");
const storageKey = "lastSource";
const modeKey = "lastMode";

let revision = 0;
let ready = false;
let copying = false;
let saveQueue = Promise.resolve();
let mode = "lower";

function convert(text, mode) {
  const lower = text.toLowerCase();
  if (mode !== "title") return lower;
  // Keep internal apostrophes together: DON'T becomes Don't, not Don'T.
  return lower.replace(/\p{L}[\p{L}\p{M}\p{N}]*(?:['’][\p{L}\p{M}\p{N}]+)*/gu, (word) => {
    const [first] = word;
    return first.toUpperCase() + word.slice(first.length);
  });
}

function render() {
  const titleCase = mode === "title";
  for (const choice of modeChoices) choice.checked = choice.value === mode;
  result.value = convert(source.value, mode);
  resultLabel.textContent = titleCase ? "Title Case result" : "Lowercase result";
  result.placeholder = titleCase ? "Hello World!" : "hello world!";
  copyButton.disabled = result.value.length === 0 || copying;
  clearButton.disabled = !ready;
}

function persistMode(mode, editRevision) {
  saveQueue = saveQueue.then(async () => {
    try {
      await chrome.storage.local.set({ [modeKey]: mode });
      if (editRevision === revision) storageStatus.textContent = "";
    } catch {
      if (editRevision === revision) {
        storageStatus.textContent = "Couldn't save your text style. You can still convert and copy, but your selection may not return next time.";
      }
    }
  });
}

modeGroup.addEventListener("change", () => {
  const nextMode = modeChoices.find((choice) => choice.checked)?.value;
  if (!nextMode || nextMode === mode) return;
  mode = nextMode;
  revision += 1;
  setActionStatus();
  render();
  persistMode(mode, revision);
});

function setActionStatus(message = "", error = false) {
  actionStatus.textContent = message;
  actionStatus.dataset.error = String(error);
}

// Serialize writes so a slow previous save cannot restore text after Clear.
// Save every input without a debounce timer that could be lost on popup close.
function persist(text, editRevision) {
  saveQueue = saveQueue.then(async () => {
    try {
      if (text.length === 0) {
        await chrome.storage.local.remove(storageKey);
      } else {
        await chrome.storage.local.set({ [storageKey]: text });
      }
      if (editRevision === revision) storageStatus.textContent = "";
    } catch {
      if (editRevision === revision) {
        storageStatus.textContent = text.length === 0
          ? "Couldn't delete saved text. It may reappear next time. Try Clear again."
          : "Couldn't save your text. You can still convert and copy, but your latest text may not return next time.";
      }
    }
  });
}

source.addEventListener("input", () => {
  revision += 1;
  setActionStatus();
  render();
  persist(source.value, revision);
});

clearButton.addEventListener("click", () => {
  revision += 1;
  source.value = "";
  render();
  setActionStatus("Text cleared.");
  persist("", revision);
  source.focus();
});

copyButton.addEventListener("click", async () => {
  if (!result.value || copying) return;
  const text = result.value;
  const copyRevision = revision;
  copying = true;
  render();
  setActionStatus();
  try {
    await navigator.clipboard.writeText(text);
    if (copyRevision === revision) setActionStatus("Copied to clipboard!");
  } catch {
    if (copyRevision === revision) {
      result.focus();
      result.select();
      setActionStatus("Couldn't copy automatically. Press Ctrl+C to copy the selected text.", true);
    }
  } finally {
    copying = false;
    render();
  }
});

async function initialize() {
  try {
    const saved = await chrome.storage.local.get([storageKey, modeKey]);
    source.value = typeof saved[storageKey] === "string" ? saved[storageKey] : "";
    mode = saved[modeKey] === "title" ? "title" : "lower";
  } catch {
    storageStatus.textContent = "Couldn't load your last text. You can still paste, convert, and copy.";
  } finally {
    ready = true;
    source.disabled = false;
    modeGroup.disabled = false;
    render();
    source.focus();
  }
}

initialize();
