import { useEffect, useState } from 'react';
import { Avatar, Group, Modal, SegmentedControl, Select, Stack, Text } from '@mantine/core';
import { ErrorAlert, Loading } from './Status.jsx';
import { listGrants, setGrant, setVisibility } from '../lib/api/documents.js';

/**
 * Choose who can see and edit a document. For GMs and the document's author.
 *
 * @param {object} props
 * @param {object} props.doc — { id, author_id, visibility }
 * @param {Array}  props.members — from listMembers()
 * @param {(visibility: string) => void} props.onVisibilityChange
 * @param {(count: number) => void} props.onGrantCountChange
 */
export function ShareDialog({ opened, onClose, doc, members, onVisibilityChange, onGrantCountChange }) {
  const [grants, setGrants] = useState(null);   // Map user_id → permission
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setGrants(null);
    setError(null);
    listGrants(doc.id)
      .then(rows => setGrants(new Map(rows.map(r => [r.user_id, r.permission]))))
      .catch(setError);
  }, [opened, doc.id]);

  async function changeVisibility(visibility) {
    setSaving(true);
    setError(null);
    try {
      await setVisibility(doc.id, visibility);
      onVisibilityChange(visibility);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  async function changeAccess(userId, value) {
    const permission = value === 'none' ? null : value;
    setError(null);
    try {
      await setGrant(doc.id, userId, permission);
      const next = new Map(grants);
      if (permission) next.set(userId, permission); else next.delete(userId);
      setGrants(next);
      onGrantCountChange(next.size);
    } catch (err) {
      setError(err);
    }
  }

  const everyone = doc.visibility === 'campaign';
  // GMs always see everything and the author owns it, so only list the other players
  const players = members.filter(m => m.role !== 'gm' && m.user_id !== doc.author_id);

  const options = everyone
    ? [{ value: 'none', label: 'Can view' }, { value: 'edit', label: 'Can edit' }]
    : [{ value: 'none', label: 'No access' }, { value: 'view', label: 'Can view' }, { value: 'edit', label: 'Can edit' }];

  const valueFor = (userId) => {
    const p = grants?.get(userId);
    if (everyone) return p === 'edit' ? 'edit' : 'none';
    return p ?? 'none';
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Share document" size="md">
      <Stack>
        <SegmentedControl
          fullWidth
          value={doc.visibility}
          onChange={changeVisibility}
          disabled={saving}
          data={[
            { value: 'private', label: 'Only people I choose' },
            { value: 'campaign', label: 'Everyone in the campaign' },
          ]}
        />
        <Text size="sm" c="dimmed">
          GMs can always see and edit every document. Only GMs and the author can change sharing.
        </Text>

        <ErrorAlert error={error} />
        {!grants && !error && <Loading />}

        {grants && players.length === 0 && (
          <Text size="sm" c="dimmed">No players to share with yet. Invite some from the campaign page.</Text>
        )}

        {grants && players.map(m => (
          <Group key={m.user_id} justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <Avatar src={m.profile?.avatar_url} radius="xl" size="sm">{m.profile?.display_name?.[0]}</Avatar>
              <Text size="sm">{m.profile?.display_name || 'Unnamed'}</Text>
            </Group>
            <Select
              w={140}
              size="xs"
              data={options}
              value={valueFor(m.user_id)}
              onChange={v => changeAccess(m.user_id, v)}
              allowDeselect={false}
              aria-label={`Access for ${m.profile?.display_name || 'player'}`}
            />
          </Group>
        ))}
      </Stack>
    </Modal>
  );
}
