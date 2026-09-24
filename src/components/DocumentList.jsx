import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Anchor, Badge, Button, FileButton, Group, Stack, Text } from '@mantine/core';
import { ErrorAlert, Loading } from './Status.jsx';
import { useAsync } from '../lib/useAsync.js';
import { createDocument, createDocuments, exportDocuments, listDocuments } from '../lib/api/documents.js';
import { downloadZip, readMarkdownFiles } from '../lib/files.js';

/**
 * Documents in a campaign, grouped by folder, with New / Import / Export.
 * @param {{ campaign: object, userId: string, isGm: boolean }} props
 */
export function DocumentList({ campaign, userId, isGm }) {
  const navigate = useNavigate();
  const { data: docs, error, loading, reload } = useAsync(() => listDocuments(campaign.id), [campaign.id]);
  const [busy, setBusy] = useState(null);         // 'new' | 'import' | 'export'
  const [actionError, setActionError] = useState(null);
  const [notice, setNotice] = useState(null);

  async function run(kind, fn) {
    setBusy(kind);
    setActionError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(null);
    }
  }

  const handleNew = () => run('new', async () => {
    const id = await createDocument({ campaignId: campaign.id });
    navigate(`/c/${campaign.id}/docs/${id}?edit=1`);
  });

  const handleImport = (files) => files?.length && run('import', async () => {
    const parsed = await readMarkdownFiles(files);
    const n = await createDocuments(campaign.id, parsed);
    setNotice(`Imported ${n} document${n === 1 ? '' : 's'}. They're private until you share them.`);
    reload();
  });

  const handleExport = () => run('export', async () => {
    downloadZip(campaign.name, await exportDocuments(campaign.id));
  });

  // Group by folder; documents without a folder come first
  const groups = new Map();
  for (const doc of docs || []) {
    const key = doc.folder || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Button size="xs" onClick={handleNew} loading={busy === 'new'}>New document</Button>
        <FileButton onChange={handleImport} accept=".md,.markdown,.txt,text/markdown,text/plain" multiple>
          {(props) => <Button {...props} size="xs" variant="default" loading={busy === 'import'}>Import .md files</Button>}
        </FileButton>
        {docs?.length > 0 && (
          <Button size="xs" variant="default" onClick={handleExport} loading={busy === 'export'}>Export all (.zip)</Button>
        )}
      </Group>

      <ErrorAlert error={actionError} />
      <ErrorAlert error={error} title="Couldn't load documents" />
      {notice && <Text size="sm" c="teal">{notice}</Text>}
      {loading && !docs && <Loading />}

      {docs?.length === 0 && (
        <Text size="sm" c="dimmed">
          No documents yet. {isGm
            ? 'Write lore and handouts here, or keep private GM notes.'
            : 'Write your own notes or journal here — they stay private to you and the GMs unless you share them.'}
        </Text>
      )}

      {[...groups].map(([folder, items]) => (
        <Stack key={folder} gap={4}>
          {folder && <Text size="xs" fw={700} tt="uppercase" c="dimmed" mt="xs">{folder}</Text>}
          {items.map(doc => (
            <Group key={doc.id} justify="space-between" wrap="nowrap">
              <Anchor component={Link} to={`/c/${campaign.id}/docs/${doc.id}`} size="sm" truncate>
                {doc.title}
              </Anchor>
              <Group gap="xs" wrap="nowrap">
                {doc.author_id !== userId && doc.author?.display_name && (
                  <Text size="xs" c="dimmed" visibleFrom="sm">by {doc.author.display_name}</Text>
                )}
                <VisibilityBadge doc={doc} userId={userId} />
              </Group>
            </Group>
          ))}
        </Stack>
      ))}
    </Stack>
  );
}

/** Short label for who can see a document, from the current user's point of view. */
export function VisibilityBadge({ doc, userId }) {
  let label, color;
  if (doc.visibility === 'campaign') {
    [label, color] = ['Everyone', 'green'];
  } else if (doc.author_id === userId) {
    [label, color] = doc.grantCount > 0 ? [`Shared (${doc.grantCount})`, 'blue'] : ['Private', 'gray'];
  } else {
    // Not the author: either a GM (sees everything) or someone it was shared with
    [label, color] = doc.grantCount > 0 ? ['Shared', 'blue'] : ['Private', 'gray'];
  }
  return <Badge size="sm" variant="light" color={color}>{label}</Badge>;
}
