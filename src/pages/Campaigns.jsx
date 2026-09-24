import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Badge, Button, Card, Group, Modal, SimpleGrid, Stack, Text, TextInput, Textarea, Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { PageShell } from '../components/PageShell.jsx';
import { ErrorAlert, Loading } from '../components/Status.jsx';
import { useAuth } from '../app/auth.jsx';
import { useAsync } from '../lib/useAsync.js';
import { createCampaign, listMyCampaigns } from '../lib/api/campaigns.js';
import { ROLE_LABELS } from '../lib/labels.js';
import { pageBackground } from '../lib/brand.js';
import { useCampaignThemes } from '../lib/useCampaignTheme.js';

export function Campaigns() {
  const { user } = useAuth();
  const { data: campaigns, error, loading } = useAsync(() => listMyCampaigns(user.id), [user.id]);
  const [creating, { open, close }] = useDisclosure(false);
  const themes = useCampaignThemes(campaigns);

  return (
    <PageShell backdrop={pageBackground('campaigns')} dim={0.6}>
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={2}>Your campaigns</Title>
          <Button onClick={open}>New campaign</Button>
        </Group>

        <ErrorAlert error={error} />
        {loading && <Loading />}

        {campaigns?.length === 0 && (
          <Text c="dimmed">
            You're not in any campaigns yet. Create one, or ask your GM for an invite link.
          </Text>
        )}

        {campaigns?.length > 0 && (
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            {campaigns.map(c => (
              <Card key={c.id} component={Link} to={`/c/${c.id}`} withBorder padding="lg" radius="md">
                <CampaignCover theme={themes.get(c.id)} />
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Text fw={600}>{c.name}</Text>
                  <Badge variant="light" color={c.role === 'gm' ? 'grape' : 'blue'}>
                    {ROLE_LABELS[c.role]}
                  </Badge>
                </Group>
                {c.description && (
                  <Text size="sm" c="dimmed" mt="xs" lineClamp={2}>{c.description}</Text>
                )}
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Stack>

      <NewCampaignModal opened={creating} onClose={close} />
    </PageShell>
  );
}

/** The campaign's cover image, or a gradient in its accent colour until it has one. */
function CampaignCover({ theme }) {
  const image = theme?.cover
    ? `url("${theme.cover}")`
    : `linear-gradient(135deg, ${theme?.accent ?? '#373a40'}, #141517)`;
  return (
    <Card.Section
      h={140}
      mb="md"
      style={{ backgroundImage: image, backgroundSize: 'cover', backgroundPosition: 'center' }}
    />
  );
}

function NewCampaignModal({ opened, onClose }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const id = await createCampaign({ name: name.trim(), description: description.trim() });
      navigate(`/c/${id}`);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="New campaign">
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Name"
            placeholder="e.g. Shanghai by Night"
            required
            maxLength={100}
            value={name}
            onChange={e => setName(e.currentTarget.value)}
            data-autofocus
          />
          <Textarea
            label="Description"
            placeholder="Optional"
            autosize
            minRows={2}
            maxLength={2000}
            value={description}
            onChange={e => setDescription(e.currentTarget.value)}
          />
          <Text size="sm" c="dimmed">You'll be the GM. Invite players from the campaign page.</Text>
          <ErrorAlert error={error} title="Couldn't create the campaign" />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving} disabled={!name.trim()}>Create</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
