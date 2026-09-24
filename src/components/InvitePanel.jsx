import { useState } from 'react';
import {
  ActionIcon, Badge, Button, Code, CopyButton, Group, Select, Stack, Table, Text, Tooltip,
} from '@mantine/core';
import { ErrorAlert, Loading } from './Status.jsx';
import { useAsync } from '../lib/useAsync.js';
import { createInvite, inviteLink, listInvites, revokeInvite } from '../lib/api/campaigns.js';
import { ROLE_LABELS } from '../lib/labels.js';

const EXPIRY_OPTIONS = [
  { value: '1', label: '1 day' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: 'never', label: 'Never' },
];

const USES_OPTIONS = [
  { value: '1', label: 'One person' },
  { value: 'unlimited', label: 'Anyone with the link' },
];

/** GM-only: create, copy and revoke invite links for a campaign. */
export function InvitePanel({ campaignId }) {
  const { data: invites, error, loading, reload } = useAsync(() => listInvites(campaignId), [campaignId]);
  const [role, setRole] = useState('player');
  const [expiry, setExpiry] = useState('7');
  const [uses, setUses] = useState('1');
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState(null);

  async function handleCreate() {
    setCreating(true);
    setActionError(null);
    try {
      await createInvite({
        campaignId,
        role,
        expiresInDays: expiry === 'never' ? null : Number(expiry),
        maxUses: uses === 'unlimited' ? null : Number(uses),
      });
      reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(code) {
    setActionError(null);
    try {
      await revokeInvite(code);
      reload();
    } catch (err) {
      setActionError(err);
    }
  }

  return (
    <Stack>
      <Group align="flex-end">
        <Select label="Joins as" data={[
          { value: 'player', label: 'Player' },
          { value: 'gm', label: 'GM (co-GM)' },
        ]} value={role} onChange={setRole} allowDeselect={false} w={140} />
        <Select label="Expires after" data={EXPIRY_OPTIONS} value={expiry} onChange={setExpiry}
          allowDeselect={false} w={140} />
        <Select label="Can be used by" data={USES_OPTIONS} value={uses} onChange={setUses}
          allowDeselect={false} w={200} />
        <Button onClick={handleCreate} loading={creating}>Create invite link</Button>
      </Group>

      <ErrorAlert error={actionError} />
      <ErrorAlert error={error} title="Couldn't load invites" />
      {loading && !invites && <Loading />}

      {invites?.length === 0 && <Text size="sm" c="dimmed">No invite links yet.</Text>}

      {invites?.length > 0 && (
        <Table verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Link</Table.Th>
              <Table.Th>Joins as</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {invites.map(inv => {
              const status = inviteStatus(inv);
              const link = inviteLink(inv.code);
              return (
                <Table.Tr key={inv.code} style={{ opacity: status.active ? 1 : 0.5 }}>
                  <Table.Td><Code>/join/{inv.code}</Code></Table.Td>
                  <Table.Td>{ROLE_LABELS[inv.role]}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={status.active ? 'green' : 'gray'}>{status.label}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-end" wrap="nowrap">
                      {status.active && (
                        <CopyButton value={link}>
                          {({ copied, copy }) => (
                            <Button size="xs" variant="light" color={copied ? 'teal' : 'blue'} onClick={copy}>
                              {copied ? 'Copied' : 'Copy link'}
                            </Button>
                          )}
                        </CopyButton>
                      )}
                      <Tooltip label="Revoke">
                        <ActionIcon variant="subtle" color="red" onClick={() => handleRevoke(inv.code)}
                          aria-label="Revoke invite">✕</ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

function inviteStatus(inv) {
  if (inv.expires_at && new Date(inv.expires_at) <= new Date()) {
    return { active: false, label: 'Expired' };
  }
  if (inv.max_uses != null && inv.uses >= inv.max_uses) {
    return { active: false, label: 'Used' };
  }
  const expires = inv.expires_at
    ? `until ${new Date(inv.expires_at).toLocaleDateString()}`
    : 'no expiry';
  const n = inv.max_uses != null ? inv.max_uses - inv.uses : null;
  const left = n != null ? `${n} use${n === 1 ? '' : 's'} left · ` : '';
  return { active: true, label: `${left}${expires}` };
}
