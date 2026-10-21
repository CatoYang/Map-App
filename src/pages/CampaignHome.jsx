import { Link } from 'react-router';
import {
  Avatar, Badge, Box, Button, Card, Group, SimpleGrid, Stack, Text, Title, Tooltip,
} from '@mantine/core';
import { useCampaign } from '../app/CampaignLayout.jsx';
import { ROLE_LABELS, WORLD_PACKS } from '../lib/labels.js';

/** Plural labels for the library summary, in the order they're listed. */
const LIBRARY_COUNTS = [
  ['event', 'events'], ['location', 'places'], ['character', 'characters'], ['kindred', 'Kindred'],
  ['faction', 'factions'], ['placard', 'placards'],
];

/** A campaign's overview: what it is, and the way into its map, library and members. */
export function CampaignHome() {
  const { campaign, members, myRole, isGm, theme, docs } = useCampaign();
  const world = WORLD_PACKS[campaign.world_pack];
  const mapYear = campaign.settings?.map_year;

  const vaultNotes = (docs || []).filter(d => d.source_path);
  const counts = LIBRARY_COUNTS
    .map(([type, label]) => [vaultNotes.filter(d => d.note_type === type).length, label])
    .filter(([n]) => n > 0);

  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Group gap="sm">
          <Title order={2}>{campaign.name}</Title>
          {myRole && <Badge variant="light" color={isGm ? 'grape' : 'blue'}>{ROLE_LABELS[myRole]}</Badge>}
        </Group>
        {theme.accent && <Box w={56} h={3} bg={theme.accent} style={{ borderRadius: 2 }} />}
        {campaign.description && <Text c="gray.4" style={{ whiteSpace: 'pre-wrap' }}>{campaign.description}</Text>}
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {world && (
          <Card withBorder padding="lg" radius="md">
            <Stack gap="xs" h="100%" justify="space-between">
              <div>
                <Text fw={600}>Map</Text>
                <Text size="sm" c="dimmed">
                  {world.name}{mapYear ? `, opening in ${mapYear}` : ''}
                </Text>
              </div>
              <Button component={Link} to={`/c/${campaign.id}/map/${world.mapId}`} style={{ alignSelf: 'flex-start' }}>
                Open map
              </Button>
            </Stack>
          </Card>
        )}

        <Card withBorder padding="lg" radius="md">
          <Stack gap="xs">
            <Text fw={600}>Library</Text>
            {!docs ? (
              <Text size="sm" c="dimmed">Loading…</Text>
            ) : vaultNotes.length ? (
              <>
                <Text size="sm" c="dimmed">
                  {vaultNotes.length} notes{counts.length > 0 && `: ${counts.map(([n, label]) => `${n} ${label}`).join(', ')}`}.
                </Text>
                <Text size="sm" c="dimmed">Browse or search them in the sidebar.</Text>
              </>
            ) : (
              <Text size="sm" c="dimmed">
                {isGm ? 'Nothing published yet. Run `npm run sync` to publish the vault.' : 'Nothing shared with players yet.'}
              </Text>
            )}
          </Stack>
        </Card>
      </SimpleGrid>

      <Stack gap="xs">
        <Group justify="space-between">
          <Title order={4}>Members</Title>
          <Button component={Link} to={`/c/${campaign.id}/members`} variant="subtle" size="xs">
            {isGm ? 'Manage and invite' : 'See all'}
          </Button>
        </Group>
        <Avatar.Group>
          {members.map(m => (
            <Tooltip key={m.user_id} label={`${m.profile?.display_name || 'Unnamed'} (${ROLE_LABELS[m.role]})`}>
              <Avatar src={m.profile?.avatar_url} radius="xl">{m.profile?.display_name?.[0]}</Avatar>
            </Tooltip>
          ))}
        </Avatar.Group>
      </Stack>
    </Stack>
  );
}
