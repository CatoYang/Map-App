import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  Anchor, Autocomplete, Badge, Button, Group, Modal, SegmentedControl, Stack, Text, TextInput, Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { ErrorAlert, Loading } from '../components/Status.jsx';
import { MarkdownView } from '../components/MarkdownView.jsx';
import { MarkdownEditor } from '../components/MarkdownEditor.jsx';
import { ShareDialog } from '../components/ShareDialog.jsx';
import { VisibilityBadge } from '../components/VisibilityBadge.jsx';
import { useCampaign } from '../app/CampaignLayout.jsx';
import { useAsync } from '../lib/useAsync.js';
import {
  SaveConflictError, deleteDocument, getDocument, getFullNote, getMyGrant, listBacklinks,
  saveDocument, uploadImage,
} from '../lib/api/documents.js';
import { downloadMarkdown } from '../lib/files.js';
import { NOTE_TYPE_LABELS, formatNoteDates, useNoteLinks } from '../lib/notes.js';

/** One document or vault note, inside the campaign frame (CampaignLayout). */
export function DocumentPage() {
  const { docId } = useParams();
  const { campaign, userId } = useCampaign();
  const { data, error, loading } = useAsync(async () => {
    const [doc, myGrant, fullBody, backlinks] = await Promise.all([
      getDocument(docId), getMyGrant(docId, userId), getFullNote(docId), listBacklinks(docId),
    ]);
    return { doc, myGrant, fullBody, backlinks };
  }, [docId, userId]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorAlert error={error} />;

  if (!data.doc) {
    return (
      <Stack align="flex-start">
        <Title order={2}>Document not found</Title>
        <Text c="dimmed">It was deleted, or it hasn't been shared with you.</Text>
        <Button component={Link} to={`/c/${campaign.id}`} variant="default">Back to the overview</Button>
      </Stack>
    );
  }

  return <DocumentScreen key={data.doc.id} {...data} />;
}

function DocumentScreen({ doc: initialDoc, myGrant, fullBody, backlinks }) {
  const { campaign, members, userId, reloadDocs } = useCampaign();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [doc, setDoc] = useState(initialDoc);
  const editing = searchParams.get('edit') === '1';

  const myRole = members.find(m => m.user_id === userId)?.role;
  // Notes published from the vault are edited in the vault
  const fromVault = !!doc.source_path;
  const canManage = !fromVault && (myRole === 'gm' || doc.author_id === userId);
  const canEdit = canManage || (!fromVault && myGrant === 'edit');
  // GMs see GM-only sections, and can check what players see instead
  const [playerView, setPlayerView] = useState(false);
  const shownBody = fullBody && !playerView ? fullBody : doc.body;
  const resolveLink = useNoteLinks(campaign.id);

  const [sharing, share] = useDisclosure(false);
  const [confirmingDelete, confirmDelete] = useDisclosure(false);
  const [deleteError, setDeleteError] = useState(null);

  function setEditing(on) {
    setSearchParams(on ? { edit: '1' } : {}, { replace: true });
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deleteDocument(doc.id);
      reloadDocs();
      navigate(`/c/${campaign.id}`, { replace: true });
    } catch (err) {
      setDeleteError(err);
    }
  }

  return (
    <>
      <Stack gap="lg">
        {editing && canEdit ? (
          <DocumentEditor
            doc={doc}
            onSaved={saved => { setDoc(saved); setEditing(false); reloadDocs(); }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                {doc.folder && <Text size="xs" fw={700} tt="uppercase" c="dimmed">{doc.folder}</Text>}
                <Title order={2}>{doc.title}</Title>
                {formatNoteDates(doc.meta) && <Text c="gray.4">{formatNoteDates(doc.meta)}</Text>}
                <Group gap="xs">
                  {doc.note_type && <Badge size="sm" variant="outline" color="gray">{NOTE_TYPE_LABELS[doc.note_type] ?? doc.note_type}</Badge>}
                  <VisibilityBadge doc={doc} userId={userId} />
                  {fromVault ? (
                    <Text size="xs" c="dimmed">From the vault · published {new Date(doc.updated_at).toLocaleDateString()}</Text>
                  ) : (
                    <Text size="xs" c="dimmed">
                      {doc.author?.display_name && `By ${doc.author.display_name} · `}
                      Updated {new Date(doc.updated_at).toLocaleString()}
                      {doc.editor?.display_name && doc.updated_by !== doc.author_id && ` by ${doc.editor.display_name}`}
                    </Text>
                  )}
                </Group>
              </Stack>
              <Group gap="xs">
                {canEdit && <Button size="xs" onClick={() => setEditing(true)}>Edit</Button>}
                {canManage && <Button size="xs" variant="default" onClick={share.open}>Share</Button>}
                <Button size="xs" variant="default" onClick={() => downloadMarkdown(doc)}>Download .md</Button>
                {canManage && <Button size="xs" variant="subtle" color="red" onClick={confirmDelete.open}>Delete</Button>}
              </Group>
            </Group>

            {fullBody && (
              <SegmentedControl
                size="xs"
                style={{ alignSelf: 'flex-start' }}
                value={playerView ? 'players' : 'full'}
                onChange={v => setPlayerView(v === 'players')}
                data={[
                  { value: 'full', label: 'Full note (GM)' },
                  { value: 'players', label: doc.visibility === 'campaign' ? 'As players see it' : 'Without GM-only sections' },
                ]}
              />
            )}

            {shownBody.trim()
              ? <MarkdownView markdown={shownBody} resolveLink={resolveLink} />
              : <Text c="dimmed">This document is empty.</Text>}

            {backlinks.length > 0 && (
              <Stack gap={4}>
                <Title order={5}>Mentioned in</Title>
                {backlinks.map(b => (
                  <Group key={b.id} gap="xs" wrap="nowrap">
                    <Anchor component={Link} to={`/c/${campaign.id}/docs/${b.id}`} size="sm">{b.title}</Anchor>
                    {formatNoteDates(b.meta) && <Text size="xs" c="dimmed">{formatNoteDates(b.meta)}</Text>}
                  </Group>
                ))}
              </Stack>
            )}
          </>
        )}
      </Stack>

      {canManage && (
        <ShareDialog
          opened={sharing}
          onClose={share.close}
          doc={doc}
          members={members}
          onVisibilityChange={visibility => setDoc(d => ({ ...d, visibility }))}
          onGrantCountChange={grantCount => setDoc(d => ({ ...d, grantCount }))}
        />
      )}

      <Modal opened={confirmingDelete} onClose={confirmDelete.close} title="Delete document?">
        <Stack>
          <Text size="sm">"{doc.title}" will be deleted for everyone. This can't be undone.</Text>
          <ErrorAlert error={deleteError} />
          <Group justify="flex-end">
            <Button variant="default" onClick={confirmDelete.close}>Cancel</Button>
            <Button color="red" onClick={handleDelete}>Delete</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

function DocumentEditor({ doc, onSaved, onCancel }) {
  const { campaign, docs } = useCampaign();
  const [title, setTitle] = useState(doc.title);
  const [folder, setFolder] = useState(doc.folder || '');
  const [body, setBody] = useState(doc.body);
  // Version this edit started from; used to detect someone else saving meanwhile
  const [baseUpdatedAt, setBaseUpdatedAt] = useState(doc.updated_at);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(null);   // latest version from the server

  // Folders already used by documents written in the app
  const folders = [...new Set((docs || []).filter(d => !d.source_path).map(d => d.folder).filter(Boolean))].sort();

  const dirty = title !== doc.title || (folder || null) !== (doc.folder || null) || body !== doc.body;

  // Warn before closing the tab with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  async function save({ overwrite = false } = {}) {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveDocument(
        doc.id,
        { title: title.trim() || 'Untitled', folder: folder.trim() || null, body },
        overwrite ? null : baseUpdatedAt,
      );
      setConflict(null);
      onSaved(saved);
    } catch (err) {
      if (err instanceof SaveConflictError) setConflict(err.current);
      else setError(err);
    } finally {
      setSaving(false);
    }
  }

  function takeTheirs() {
    setTitle(conflict.title);
    setFolder(conflict.folder || '');
    setBody(conflict.body);
    setBaseUpdatedAt(conflict.updated_at);
    setConflict(null);
  }

  function handleCancel() {
    if (!dirty || window.confirm('Discard your unsaved changes?')) onCancel();
  }

  return (
    <Stack>
      <Group align="flex-end">
        <TextInput label="Title" value={title} onChange={e => setTitle(e.currentTarget.value)}
          maxLength={200} style={{ flex: 1 }} data-autofocus />
        <Autocomplete label="Folder" placeholder="None" value={folder} onChange={setFolder}
          data={folders} maxLength={100} w={220} />
      </Group>

      <MarkdownEditor
        value={body}
        onChange={setBody}
        onUploadImage={file => uploadImage(campaign.id, doc.id, file)}
      />

      <ErrorAlert error={error} title="Couldn't save" />
      <Group justify="flex-end">
        <Button variant="default" onClick={handleCancel}>Cancel</Button>
        <Button onClick={() => save()} loading={saving}>Save</Button>
      </Group>

      <Modal opened={!!conflict} onClose={() => setConflict(null)} title="This document changed while you were editing">
        {conflict && (
          <Stack>
            <Text size="sm">
              {conflict.editor?.display_name || 'Someone'} saved a newer version at{' '}
              {new Date(conflict.updated_at).toLocaleTimeString()}. Saving now would replace their changes.
            </Text>
            <Text size="sm" c="dimmed">
              Tip: copy anything you want to keep before loading their version.
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setConflict(null)}>Keep editing</Button>
              <Button variant="default" onClick={takeTheirs}>Load their version</Button>
              <Button color="red" onClick={() => save({ overwrite: true })} loading={saving}>Replace with mine</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
