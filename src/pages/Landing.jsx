import { Link } from 'react-router';
import { Anchor, Button, Stack, Text, Title } from '@mantine/core';
import { PageShell } from '../components/PageShell.jsx';
import { useAuth } from '../app/auth.jsx';

export function Landing() {
  const { user } = useAuth();

  return (
    <PageShell>
      <Stack gap="lg" align="flex-start">
        <Title order={1}>Map-App</Title>
        <Text size="lg" c="dimmed">
          A campaign companion for tabletop role-playing games: historical maps,
          lore and handouts, shared with your group.
        </Text>
        {user ? (
          <Button component={Link} to="/campaigns" size="md">Go to your campaigns</Button>
        ) : (
          <Button component={Link} to="/login" size="md">Sign in</Button>
        )}
        <Anchor component={Link} to="/privacy" size="sm" c="dimmed">Privacy</Anchor>
      </Stack>
    </PageShell>
  );
}
