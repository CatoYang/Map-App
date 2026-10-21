import { Avatar, Badge, Group, Stack, Text, Title } from '@mantine/core';
import { useCampaign } from '../app/CampaignLayout.jsx';
import { InvitePanel } from '../components/InvitePanel.jsx';
import { ROLE_LABELS } from '../lib/labels.js';

/** Who's in the campaign; GMs also create invite links here. */
export function MembersPage() {
  const { campaign, members, isGm, userId } = useCampaign();

  return (
    <Stack gap="xl">
      <Stack gap="sm">
        <Title order={2}>Members ({members.length})</Title>
        {members.map(m => (
          <Group key={m.user_id} gap="sm">
            <Avatar src={m.profile?.avatar_url} radius="xl" size="sm">
              {m.profile?.display_name?.[0]}
            </Avatar>
            <Text size="sm">
              {m.profile?.display_name || 'Unnamed'}
              {m.user_id === userId && <Text span c="dimmed"> (you)</Text>}
            </Text>
            <Badge size="sm" variant="light" color={m.role === 'gm' ? 'grape' : 'blue'}>
              {ROLE_LABELS[m.role]}
            </Badge>
            {m.user_id === campaign.owner_id && <Badge size="sm" variant="outline" color="gray">Owner</Badge>}
          </Group>
        ))}
      </Stack>

      {isGm && (
        <Stack gap="sm">
          <Title order={4}>Invite players</Title>
          <InvitePanel campaignId={campaign.id} />
        </Stack>
      )}
    </Stack>
  );
}
