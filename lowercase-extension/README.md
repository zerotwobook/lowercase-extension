# Lowercase

Instantly convert pasted or typed text to lowercase or Title Case. Copy the result with one click and keep your latest text and selected style on this device. The interface uses a white-and-orange palette and the bundled Inter font. No build tools or internet connection are needed to use the extension.

## Try before installing

Open `lowercase-preview.html` in Chrome. It is a standalone HTML file with the same interface and conversion/copy logic as the extension. Its saved text is separate from the extension's saved text.

## Install in Google Chrome

1. Keep the `lowercase-extension` folder on your computer. Do not move or delete it after installation.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** in the upper-right corner.
4. Click **Load unpacked** and select the `lowercase-extension` folder containing `manifest.json`.
5. Click the puzzle-piece icon in Chrome's toolbar and pin **Lowercase**.
6. Click the Lowercase icon to open the popup.

If using the ZIP, extract it first and select the inner `lowercase-extension` folder.

## Use

- Click a **Text style** card: **lowercase** makes `HELLO WORLD` into `hello world`; **Title Case** makes it into `Hello World`. The selected card has an orange checkmark. You can also Tab to the options and switch with the arrow keys.
- Paste with **Ctrl+V** or type in **Your text**. The result updates immediately, including when you switch styles.
- Click **Copy text**. The message **Copied to clipboard!** confirms success.
- If automatic copying fails, the result is selected for you. Press **Ctrl+C** to copy it manually.
- Close and reopen the popup to restore your latest text and selected style.
- Click **Clear** to clear both fields and delete the saved text. Your selected style stays the same.

Whitespace, line breaks, numbers, punctuation, Thai text, and emoji are preserved. Title Case capitalizes the first letter of every word and lowercases the remaining letters, including small words such as `and` and `the`. Internal apostrophes stay within a word (`DON'T` becomes `Don't`), while hyphenated parts are capitalized separately (`HELLO-WORLD` becomes `Hello-World`). JavaScript's standard case conversion also applies to letters in other languages that have uppercase/lowercase forms. This tool does not translate languages.

## Privacy and offline use

The extension requests only the `storage` permission. It keeps the latest source text and selected style in `chrome.storage.local`, without a history or cloud sync. It sends no text over the network and has no permission to read web pages or the clipboard. It writes to the clipboard only when you click **Copy text**.

The Inter font is included locally, so there are no runtime font downloads. The standalone preview embeds the font and uses a separate browser-local storage key.

If reading or saving fails, an English message explains the issue. Conversion and copying remain available. If deleting saved text fails, old text may return when reopened; click **Clear** again to retry.

## Update or uninstall

After changing the files, open `chrome://extensions`, click the extension's reload button, then reopen the popup. To uninstall, click **Remove**.

## Developer checks

From the project root, run:

```sh
node --test lowercase-extension/tests/popup.test.mjs
```

This checks conversion, clipboard success/failure, restore, storage failures, and delayed-save/clear ordering without extra packages. Test fixtures include Thai and emoji to ensure multilingual input still works.

To regenerate the standalone preview after editing the popup files:

```sh
node tools/build-preview.mjs
```

## Font license

[Inter](https://github.com/rsms/inter) is bundled under the SIL Open Font License. The full license is included in `fonts/OFL.txt` and in an HTML comment inside the standalone preview.

## References

[Chrome action/popup](https://developer.chrome.com/docs/extensions/reference/api/action), [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage), [Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText), [Local installation](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world).
