import { useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { Button, Paper, Stack, Text, Title } from '@mantine/core';
import { PageShell } from '../components/PageShell.jsx';
import { signInWithGoogle, useAuth } from '../app/auth.jsx';
import { pageBackground } from '../lib/brand.js';

export function Login() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  // Where to go after signing in (set by RequireAuth when it redirected here)
  const from = location.state?.from || '/campaigns';

  if (!loading && user) {
    return <Navigate to={from} replace />;
  }

  async function handleSignIn() {
    setPending(true);
    setError(null);
    const { error } = await signInWithGoogle(from);
    // On success the browser navigates away to Google, so we only get here on failure
    if (error) {
      setError(error.message);
      setPending(false);
    }
  }

  return (
    <PageShell size="xs" backdrop={pageBackground('landing')} dim={0.5}>
      <Paper withBorder p="xl" radius="md" mt={{ base: 20, sm: 80 }}>
        <Stack>
          <Title order={2}>Sign in</Title>
          <Text c="dimmed" size="sm">
            Use your Google account to reach your campaigns.
          </Text>
          <Button onClick={handleSignIn} loading={pending || loading} size="md">
            Sign in with Google
          </Button>
          {error && <Text c="red" size="sm">{error}</Text>}
        </Stack>
      </Paper>
    </PageShell>
  );
}
