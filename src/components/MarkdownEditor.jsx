import { useRef, useState } from 'react';
import {
  ActionIcon, Box, FileButton, Group, Paper, SegmentedControl, SimpleGrid, Text, Textarea, Tooltip,
} from '@mantine/core';
import { MarkdownView } from './MarkdownView.jsx';
import { STORAGE_IMAGE_PREFIX } from '../lib/markdown.js';

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp';

/**
 * Markdown text editor with a formatting toolbar and live preview.
 *
 * @param {object}   props
 * @param {string}   props.value
 * @param {(v: string) => void} props.onChange
 * @param {(file: File) => Promise<string>} [props.onUploadImage] — uploads and returns a storage path
 */
export function MarkdownEditor({ value, onChange, onUploadImage }) {
  const textareaRef = useRef(null);
  const [mode, setMode] = useState('split');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  /** Replace the current selection using fn(selectedText) → { text, select: [start, end] relative to insert }. */
  function edit(fn) {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end } = ta;
    const { text, select } = fn(value.slice(start, end));
    onChange(value.slice(0, start) + text + value.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + select[0], start + select[1]);
    });
  }

  const wrap = (before, after = before, placeholder = 'text') => () => edit(sel => {
    const inner = sel || placeholder;
    return { text: before + inner + after, select: [before.length, before.length + inner.length] };
  });

  // Prefix every selected line (headings, lists, quotes). Starts a new line if needed.
  const prefixLines = (prefix) => () => {
    const ta = textareaRef.current;
    const atLineStart = !ta || ta.selectionStart === 0 || value[ta.selectionStart - 1] === '\n';
    edit(sel => {
      const lines = (sel || 'text').split('\n').map(l => prefix + l).join('\n');
      const text = (atLineStart ? '' : '\n') + lines;
      return { text, select: [text.length, text.length] };
    });
  };

  const insertLink = () => edit(sel => {
    const label = sel || 'link text';
    const text = `[${label}](https://)`;
    return { text, select: [label.length + 3, text.length - 1] };   // select the URL
  });

  async function insertImage(file) {
    if (!file || !onUploadImage) return;
    setUploading(true);
    setUploadError(null);
    try {
      const path = await onUploadImage(file);
      const alt = file.name.replace(/\.[^.]+$/, '') || 'image';
      edit(() => {
        const text = `![${alt}](${STORAGE_IMAGE_PREFIX}${path})`;
        return { text, select: [text.length, text.length] };
      });
    } catch (err) {
      setUploadError(err.message || String(err));
    } finally {
      setUploading(false);
    }
  }

  function handlePaste(e) {
    const file = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/'));
    if (file && onUploadImage) {
      e.preventDefault();
      insertImage(file);
    }
  }

  const tools = [
    { label: 'Bold', icon: <b>B</b>, action: wrap('**', '**', 'bold text') },
    { label: 'Italic', icon: <i>I</i>, action: wrap('*', '*', 'italic text') },
    { label: 'Heading', icon: 'H', action: prefixLines('## ') },
    { label: 'Bulleted list', icon: '•', action: prefixLines('- ') },
    { label: 'Numbered list', icon: '1.', action: prefixLines('1. ') },
    { label: 'Quote', icon: '❝', action: prefixLines('> ') },
    { label: 'Link', icon: '🔗', action: insertLink },
  ];

  const editor = (
    <Textarea
      ref={textareaRef}
      value={value}
      onChange={e => onChange(e.currentTarget.value)}
      onPaste={handlePaste}
      autosize
      minRows={18}
      placeholder="Write in markdown…"
      styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 14 } }}
    />
  );

  const preview = (
    <Paper withBorder p="md" radius="sm" mih={200}>
      {value.trim() ? <MarkdownView markdown={value} /> : <Text c="dimmed" size="sm">Nothing to preview yet.</Text>}
    </Paper>
  );

  return (
    <Box>
      <Group justify="space-between" mb="xs">
        <Group gap={4}>
          {tools.map(t => (
            <Tooltip key={t.label} label={t.label}>
              <ActionIcon variant="default" onClick={t.action} aria-label={t.label} disabled={mode === 'preview'}>
                {t.icon}
              </ActionIcon>
            </Tooltip>
          ))}
          {onUploadImage && (
            <FileButton onChange={insertImage} accept={IMAGE_ACCEPT}>
              {(props) => (
                <Tooltip label="Insert image (or paste one)">
                  <ActionIcon {...props} variant="default" loading={uploading} aria-label="Insert image"
                    disabled={mode === 'preview'}>🖼</ActionIcon>
                </Tooltip>
              )}
            </FileButton>
          )}
        </Group>
        <SegmentedControl size="xs" value={mode} onChange={setMode} data={[
          { value: 'write', label: 'Write' },
          { value: 'split', label: 'Split' },
          { value: 'preview', label: 'Preview' },
        ]} />
      </Group>

      {uploadError && <Text c="red" size="sm" mb="xs">{uploadError}</Text>}

      {mode === 'write' && editor}
      {mode === 'preview' && preview}
      {mode === 'split' && (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {editor}
          {preview}
        </SimpleGrid>
      )}
    </Box>
  );
}
