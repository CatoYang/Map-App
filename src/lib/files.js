/** Import/export helpers for markdown documents. */
import { strToU8, zipSync } from 'fflate';

/** Make a string safe to use as a file or folder name. */
export function safeFileName(name) {
  const cleaned = String(name ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim().slice(0, 100);
  return cleaned || 'Untitled';
}

/** Trigger a browser download. */
export function download(fileName, content, type = 'text/markdown;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download one document as a .md file. */
export function downloadMarkdown(doc) {
  download(`${safeFileName(doc.title)}.md`, doc.body);
}

/** Download documents as a .zip of .md files, with folders as directories. */
export function downloadZip(zipName, docs) {
  const files = {};
  for (const doc of docs) {
    const dir = doc.folder ? `${safeFileName(doc.folder)}/` : '';
    const base = `${dir}${safeFileName(doc.title)}`;
    let name = `${base}.md`;
    for (let n = 2; files[name]; n++) name = `${base} (${n}).md`;   // same title twice
    files[name] = strToU8(doc.body);
  }
  download(`${safeFileName(zipName)}.zip`, new Blob([zipSync(files)], { type: 'application/zip' }));
}

/**
 * Read .md files chosen by the user.
 * @param {File[]} files
 * @returns {Promise<{ title: string, body: string }[]>}
 */
export async function readMarkdownFiles(files) {
  return Promise.all(files.map(async (file) => ({
    title: file.name.replace(/\.(md|markdown|txt)$/i, '').slice(0, 200) || 'Untitled',
    body: await file.text(),
  })));
}
