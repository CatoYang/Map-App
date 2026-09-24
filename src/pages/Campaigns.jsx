import { Link } from 'react-router';
import { Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { PageShell } from '../components/PageShell.jsx';

/**
 * Campaign list. Until the campaigns table exists (P2), this shows a single
 * placeholder campaign that opens the existing Shanghai map.
 */
export function Campaigns() {
  return (
    <PageShell>
      <Stack gap="lg">
        <Title order={2}>Your campaigns</Title>
        <Card withBorder padding="lg" radius="md">
          <Group justify="space-between">
            <div>
              <Text fw={600}>Shanghai 1842–1949</Text>
              <Text size="sm" c="dimmed">Demo campaign</Text>
            </div>
            <Button component={Link} to="/c/demo/map/main">Open map</Button>
          </Group>
        </Card>
      </Stack>
    </PageShell>
  );
}
