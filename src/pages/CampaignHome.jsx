import { Link, useParams } from 'react-router';
import {
  Anchor, Avatar, Badge, Box, Button, Card, Group, Stack, Text, Title,
} from '@mantine/core';
import { PageShell } from '../components/PageShell.jsx';
import { ErrorAlert, Loading } from '../components/Status.jsx';
import { InvitePanel } from '../components/InvitePanel.jsx';
import { DocumentList } from '../components/DocumentList.jsx';
import { useAuth } from '../app/auth.jsx';
import { useAsync } from '../lib/useAsync.js';
import { getCampaign, listMembers } from '../lib/api/campaigns.js';
import { useCampaignTheme } from '../lib/useCampaignTheme.js';
import { ROLE_LABELS, WORLD_PACKS } from '../lib/labels.js';

export function CampaignHome() {
  const { campaignId } = useParams();
  const { user } = useAuth();
  const { data, error, loading } = useAsync(async () => {
    const [campaign, members] = await Promise.all([getCampaign(campaignId), listMembers(campaignId)]);
    return { campaign, members };
  }, [campaignId]);
  const theme = useCampaignTheme(data?.campaign);

  if (loading) return <PageShell><Loading /></PageShell>;
  if (error) return <PageShell><ErrorAlert error={error} /></PageShell>;

  const { campaign, members } = data;

  // The database hides campaigns you're not in, so "not a member" looks like "doesn't exist"
  if (!campaign) {
    return (
      <PageShell>
        <Stack align="flex-start">
          <Title order={2}>Campaign not found</Title>
          <Text c="dimmed">It doesn't exist, or you're not a member. Ask the GM for an invite link.</Text>
          <Button component={Link} to="/campaigns" variant="default">Your campaigns</Button>
        </Stack>
      </PageShell>
    );
  }

  const myRole = members.find(m => m.user_id === user.id)?.role;
  const isGm = myRole === 'gm';
  const world = WORLD_PACKS[campaign.world_pack];

  return (
    <PageShell backdrop={theme.background} soften panel={!!theme.background}>
      <Stack gap="xl">
        <Stack gap="xs">
          <Anchor component={Link} to="/campaigns" size="sm" c="dimmed">← Your campaigns</Anchor>
          <Group gap="sm">
            <Title order={2}>{campaign.name}</Title>
            {myRole && <Badge variant="light" color={isGm ? 'grape' : 'blue'}>{ROLE_LABELS[myRole]}</Badge>}
          </Group>
          {theme.accent && <Box w={56} h={3} bg={theme.accent} style={{ borderRadius: 2 }} />}
          {campaign.description && <Text c="gray.4" style={{ whiteSpace: 'pre-wrap' }}>{campaign.description}</Text>}
        </Stack>

        <Section title="Maps">
          {world ? (
            <Card withBorder padding="lg" radius="md">
              <Group justify="space-between">
                <Text fw={600}>{world.name}</Text>
                <Button component={Link} to={`/c/${campaign.id}/map/${world.mapId}`}>Open map</Button>
              </Group>
            </Card>
          ) : (
            <Text c="dimmed">No map available for world "{campaign.world_pack}".</Text>
          )}
        </Section>

        <Section title="Documents">
          <DocumentList campaign={campaign} userId={user.id} isGm={isGm} />
        </Section>

        <Section title={`Members (${members.length})`}>
          <Stack gap="xs">
            {members.map(m => (
              <Group key={m.user_id} gap="sm">
                <Avatar src={m.profile?.avatar_url} radius="xl" size="sm">
                  {m.profile?.display_name?.[0]}
                </Avatar>
                <Text size="sm">
                  {m.profile?.display_name || 'Unnamed'}
                  {m.user_id === user.id && <Text span c="dimmed"> (you)</Text>}
                </Text>
                <Badge size="sm" variant="light" color={m.role === 'gm' ? 'grape' : 'blue'}>
                  {ROLE_LABELS[m.role]}
                </Badge>
                {m.user_id === campaign.owner_id && <Badge size="sm" variant="outline" color="gray">Owner</Badge>}
              </Group>
            ))}
          </Stack>
        </Section>

        {isGm && (
          <Section title="Invite players">
            <InvitePanel campaignId={campaign.id} />
          </Section>
        )}
      </Stack>
    </PageShell>
  );
}

function Section({ title, children }) {
  return (
    <Stack gap="sm">
      <Title order={4}>{title}</Title>
      {children}
    </Stack>
  );
}
