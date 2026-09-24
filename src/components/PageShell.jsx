import { Link } from 'react-router';
import { Anchor, Button, Container, Group, Text } from '@mantine/core';
import { signOut, useAuth } from '../app/auth.jsx';

/** Header + centred content column used by every page except the map. */
export function PageShell({ children, size = 'md' }) {
  const { user } = useAuth();

  return (
    <>
      <Container size={size} py="md">
        <Group justify="space-between">
          <Anchor component={Link} to="/" fw={700} c="bright" underline="never">
            Map-App
          </Anchor>
          {user ? (
            <Group gap="sm">
              <Text size="sm" c="dimmed">{user.email}</Text>
              <Button variant="subtle" size="xs" onClick={signOut}>Sign out</Button>
            </Group>
          ) : (
            <Button component={Link} to="/login" variant="subtle" size="xs">Sign in</Button>
          )}
        </Group>
      </Container>
      <Container size={size} py="xl">
        {children}
      </Container>
    </>
  );
}
