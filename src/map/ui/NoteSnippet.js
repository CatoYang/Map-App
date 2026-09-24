/**
 * A line of note YAML (e.g. `pin: enp-12`) with a Copy button, so map
 * positions can be pasted into content notes. See docs/content-format.md.
 */
export function noteSnippet(text) {
  const el = document.createElement('div');
  el.className = 'note-snippet';

  const code = document.createElement('code');
  code.textContent = text;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'note-snippet__copy';
  button.textContent = 'Copy';
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
    } catch {
      // Clipboard blocked: select the text so it can be copied by hand
      getSelection().selectAllChildren(code);
      button.textContent = 'Press Ctrl+C';
    }
    setTimeout(() => { button.textContent = 'Copy'; }, 1500);
  });

  el.append(code, button);
  return el;
}
