import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  Anchor, Autocomplete, Button, Group, Modal, Stack, Text, TextInput, Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { PageShell } from '../components/PageShell.jsx';
import { ErrorAlert, Loading } from '../components/Status.jsx';
import { MarkdownView } from '../components/MarkdownView.jsx';
import { MarkdownEditor } from '../components/MarkdownEditor.jsx';
import { ShareDialog } from '../components/ShareDialog.jsx';
import { VisibilityBadge } from '../components/DocumentList.jsx';
import { useAuth } from '../app/auth.jsx';
import { useAsync } from '../lib/useAsync.js';
import { getCampaign, listMembers } from '../lib/api/campaigns.js';
import { useCampaignTheme } from '../lib/useCampaignTheme.js';
import {
  SaveConflictError, deleteDocument, getDocument, getMyGrant, listDocuments, saveDocument, uploadImage,
} from '../lib/api/documents.js';
import { downloadMarkdown } from '../lib/files.js';

export function DocumentPage() {
  const { campaignId, docId } = useParams();
  const { user } = useAuth();
  const { data, error, loading } = useAsync(async () => {
    const [campaign, doc, members, myGrant] = await Promise.all([
      getCampaign(campaignId), getDocument(docId), listMembers(campaignId), getMyGrant(docId, user.id),
    ]);
    return { campaign, doc, members, myGrant };
  }, [campaignId, docId, user.id]);

  if (loading && !data) return <PageShell><Loading /></PageShell>;
  if (error) return <PageShell><ErrorAlert error={error} /></PageShell>;

  if (!data.campaign || !data.doc) {
    return (
      <PageShell>
        <Stack align="flex-start">
          <Title order={2}>Document not found</Title>
          <Text c="dimmed">It was deleted, or it hasn't been shared with you.</Text>
          <Button component={Link} to={data.campaign ? `/c/${campaignId}` : '/campaigns'} variant="default">Back</Button>
        </Stack>
      </PageShell>
    );
  }

  return <DocumentScreen key={data.doc.id} {...data} userId={user.id} />;
}

function DocumentScreen({ campaign, doc: initialDoc, members, myGrant, userId }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [doc, setDoc] = useState(initialDoc);
  const editing = searchParams.get('edit') === '1';

  const myRole = members.find(m => m.user_id === userId)?.role;
  const canManage = myRole === 'gm' || doc.author_id === userId;
  const canEdit = canManage || myGrant === 'edit';

  const [sharing, share] = useDisclosure(false);
  const [confirmingDelete, confirmDelete] = useDisclosure(false);
  const [deleteError, setDeleteError] = useState(null);
  const theme = useCampaignTheme(campaign);

  function setEditing(on) {
    setSearchParams(on ? { edit: '1' } : {}, { replace: true });
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deleteDocument(doc.id);
      navigate(`/c/${campaign.id}`, { replace: true });
    } catch (err) {
      setDeleteError(err);
    }
  }

  return (
    <PageShell size="xl" backdrop={theme.background} dim={0.92} soften accent={theme.accent}>
      <Stack gap="lg">
        <Anchor component={Link} to={`/c/${campaign.id}`} size="sm" c="dimmed">← {campaign.name}</Anchor>

        {editing && canEdit ? (
          <DocumentEditor
            campaign={campaign}
            doc={doc}
            onSaved={saved => { setDoc(saved); setEditing(false); }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <Group justify="space-between" align="flex-start">
              <Stack gap={4}>
                {doc.folder && <Text size="xs" fw={700} tt="uppercase" c="dimmed">{doc.folder}</Text>}
                <Title order={2}>{doc.title}</Title>
                <Group gap="xs">
                  <VisibilityBadge doc={doc} userId={userId} />
                  <Text size="xs" c="dimmed">
                    {doc.author?.display_name && `By ${doc.author.display_name} · `}
                    Updated {new Date(doc.updated_at).toLocaleString()}
                    {doc.editor?.display_name && doc.updated_by !== doc.author_id && ` by ${doc.editor.display_name}`}
                  </Text>
                </Group>
              </Stack>
              <Group gap="xs">
                {canEdit && <Button size="xs" onClick={() => setEditing(true)}>Edit</Button>}
                {canManage && <Button size="xs" variant="default" onClick={share.open}>Share</Button>}
                <Button size="xs" variant="default" onClick={() => downloadMarkdown(doc)}>Download .md</Button>
                {canManage && <Button size="xs" variant="subtle" color="red" onClick={confirmDelete.open}>Delete</Button>}
              </Group>
            </Group>

            {doc.body.trim()
              ? <MarkdownView markdown={doc.body} />
              : <Text c="dimmed">This document is empty.</Text>}
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
    </PageShell>
  );
}

function DocumentEditor({ campaign, doc, onSaved, onCancel }) {
  const [title, setTitle] = useState(doc.title);
  const [folder, setFolder] = useState(doc.folder || '');
  const [body, setBody] = useState(doc.body);
  // Version this edit started from; used to detect someone else saving meanwhile
  const [baseUpdatedAt, setBaseUpdatedAt] = useState(doc.updated_at);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(null);   // latest version from the server

  const { data: folders } = useAsync(async () => {
    const docs = await listDocuments(campaign.id);
    return [...new Set(docs.map(d => d.folder).filter(Boolean))].sort();
  }, [campaign.id]);

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
          data={folders || []} maxLength={100} w={220} />
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
