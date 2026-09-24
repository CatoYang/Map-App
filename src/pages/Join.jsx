import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { PageShell } from '../components/PageShell.jsx';
import { pageBackground } from '../lib/brand.js';
import { ErrorAlert, Loading } from '../components/Status.jsx';
import { useAsync } from '../lib/useAsync.js';
import { previewInvite, redeemInvite } from '../lib/api/campaigns.js';
import { ROLE_LABELS } from '../lib/labels.js';

/** /join/:code — accept an invite link. Signed-in only (see App routes). */
export function Join() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { data: invite, error, loading } = useAsync(() => previewInvite(code), [code]);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);

  async function handleJoin() {
    setJoining(true);
    setJoinError(null);
    try {
      const campaignId = await redeemInvite(code);
      navigate(`/c/${campaignId}`, { replace: true });
    } catch (err) {
      setJoinError(err);
      setJoining(false);
    }
  }

  let body;
  if (loading) {
    body = <Loading />;
  } else if (error) {
    body = <ErrorAlert error={error} />;
  } else if (!invite) {
    body = (
      <>
        <Title order={3}>Invite not valid</Title>
        <Text c="dimmed">This invite link is invalid, has expired, or has already been used. Ask your GM for a new one.</Text>
        <Group><Button component={Link} to="/campaigns" variant="default">Your campaigns</Button></Group>
      </>
    );
  } else if (invite.already_member) {
    body = (
      <>
        <Title order={3}>{invite.campaign_name}</Title>
        <Text c="dimmed">You're already a member of this campaign.</Text>
        <Group><Button component={Link} to={`/c/${invite.campaign_id}`}>Open campaign</Button></Group>
      </>
    );
  } else {
    body = (
      <>
        <Text c="dimmed">You've been invited to join</Text>
        <Title order={3}>{invite.campaign_name}</Title>
        <Text c="dimmed">as a {ROLE_LABELS[invite.role]}.</Text>
        <ErrorAlert error={joinError} title="Couldn't join" />
        <Group><Button onClick={handleJoin} loading={joining}>Join campaign</Button></Group>
      </>
    );
  }

  return (
    <PageShell size="xs" backdrop={pageBackground('campaigns')} dim={0.6}>
      <Paper withBorder p="xl" radius="md">
        <Stack gap="sm">{body}</Stack>
      </Paper>
    </PageShell>
  );
}
