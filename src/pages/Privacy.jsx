import { List, Stack, Text, Title } from '@mantine/core';
import { PageShell } from '../components/PageShell.jsx';

export function Privacy() {
  return (
    <PageShell size="sm">
      <Stack>
        <Title order={2}>Privacy</Title>
        <Text>
          Map-App is a private tool for running tabletop role-playing campaigns.
          It stores only what it needs to let you sign in and use your campaigns.
        </Text>

        <Title order={4}>What is stored</Title>
        <List>
          <List.Item>Your Google account name, email address and profile picture, used to sign you in and show who you are to your group.</List.Item>
          <List.Item>Which campaigns you belong to and your role in them.</List.Item>
          <List.Item>Content you create in the app, such as documents and notes.</List.Item>
        </List>

        <Title order={4}>Who handles it</Title>
        <List>
          <List.Item>Google — sign-in.</List.Item>
          <List.Item>Supabase — account and campaign data storage.</List.Item>
          <List.Item>Cloudflare — hosting of the website and maps.</List.Item>
        </List>

        <Title order={4}>What is not done with it</Title>
        <Text>
          Your information is not sold, shared with advertisers, or used for
          anything other than running the app.
        </Text>

        <Title order={4}>Removing your data</Title>
        <Text>
          Ask the person who invited you to your campaign and your account and
          content will be deleted.
        </Text>
      </Stack>
    </PageShell>
  );
}
