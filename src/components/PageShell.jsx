import { Link } from 'react-router';
import { Anchor, Box, Button, Container, Group, Text } from '@mantine/core';
import { signOut, useAuth } from '../app/auth.jsx';

/**
 * Header + centred content column used by every page except the map.
 *
 * `backdrop` is an image URL shown behind the page, darkened so text stays
 * readable: `dim` (0–1) is how dark it gets at the bottom. `soften` blurs it
 * slightly (for small photos stretched to full screen). `accent` is a colour
 * for the line under the header.
 */
export function PageShell({ children, size = 'md', backdrop = null, dim = 0.85, soften = false, accent = null }) {
  const { user } = useAuth();

  return (
    <Box pos="relative" mih="100vh">
      {backdrop && <Backdrop image={backdrop} dim={dim} soften={soften} />}
      <Box pos="relative" style={{ zIndex: 1 }}>
        <Container size={size} py="md" style={accent ? { borderBottom: `2px solid ${accent}` } : undefined}>
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
      </Box>
    </Box>
  );
}

/** A full-screen background image behind the page, fixed while scrolling. */
function Backdrop({ image, dim, soften }) {
  return (
    <Box
      aria-hidden
      pos="fixed"
      inset={0}
      style={{ zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      <Box
        pos="absolute"
        // Blurring pulls in the edges, so overshoot a little
        inset={soften ? -12 : 0}
        style={{
          backgroundImage: `url("${image}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: soften ? 'blur(3px)' : undefined,
        }}
      />
      {/* Darken towards the bottom, where the page content is */}
      <Box
        pos="absolute"
        inset={0}
        style={{ background: `linear-gradient(rgba(10,10,14,${dim / 2}), rgba(10,10,14,${dim}))` }}
      />
    </Box>
  );
}
