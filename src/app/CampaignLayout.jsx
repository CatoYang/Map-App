import { createContext, useContext, useEffect } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router';
import { Anchor, AppShell, Box, Burger, Button, Container, Group, Stack, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Backdrop, GLASS, PageShell, UserMenu } from '../components/PageShell.jsx';
import { ErrorAlert, Loading } from '../components/Status.jsx';
import { CampaignSidebar } from '../components/CampaignSidebar.jsx';
import { useAuth } from './auth.jsx';
import { useAsync } from '../lib/useAsync.js';
import { getCampaign, listMembers } from '../lib/api/campaigns.js';
import { listDocuments } from '../lib/api/documents.js';
import { useCampaignTheme } from '../lib/useCampaignTheme.js';

const CampaignContext = createContext(null);

/**
 * What every page inside a campaign shares, loaded once by CampaignLayout:
 * { campaign, members, myRole, isGm, userId, theme, docs, docsError, reloadDocs }.
 * `docs` is every document the user can see (undefined while loading);
 * call `reloadDocs()` after creating, renaming or deleting one.
 */
export function useCampaign() {
  return useContext(CampaignContext);
}

/**
 * The frame around a campaign's pages (overview, documents, members): a
 * header, the campaign sidebar, and the page on the right. The map is its
 * own full-screen page, outside this frame.
 */
export function CampaignLayout() {
  const { campaignId } = useParams();
  const { user } = useAuth();
  const { data, error, loading } = useAsync(async () => {
    const [campaign, members] = await Promise.all([getCampaign(campaignId), listMembers(campaignId)]);
    return { campaign, members };
  }, [campaignId]);
  const { data: docs, error: docsError, reload: reloadDocs } = useAsync(() => listDocuments(campaignId), [campaignId]);
  const theme = useCampaignTheme(data?.campaign);

  // On phones the sidebar is a menu; close it once something's been picked
  const [navOpen, nav] = useDisclosure(false);
  const { pathname } = useLocation();
  const closeNav = nav.close;
  useEffect(() => closeNav(), [pathname, closeNav]);

  if (loading && !data) return <PageShell><Loading /></PageShell>;
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
  const value = {
    campaign, members, myRole, isGm: myRole === 'gm', userId: user.id, theme, docs, docsError, reloadDocs,
  };

  return (
    <CampaignContext.Provider value={value}>
      {theme.background && <Backdrop image={theme.background} soften />}
      <AppShell
        header={{ height: 56 }}
        navbar={{ width: 300, breakpoint: 'sm', collapsed: { mobile: !navOpen } }}
        styles={{
          header: { ...GLASS, borderWidth: '0 0 1px', background: 'rgba(14, 15, 18, 0.82)' },
          navbar: { ...GLASS, borderWidth: '0 1px 0 0', background: 'rgba(16, 17, 21, 0.88)' },
        }}
      >
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group gap="sm">
              <Burger opened={navOpen} onClick={nav.toggle} hiddenFrom="sm" size="sm" aria-label="Campaign menu" />
              <Anchor component={Link} to="/campaigns" fw={700} c="bright" underline="never">Map-App</Anchor>
            </Group>
            <UserMenu />
          </Group>
        </AppShell.Header>

        <AppShell.Navbar>
          <CampaignSidebar />
        </AppShell.Navbar>

        <AppShell.Main>
          {/* Above the backdrop, which sits at z-index 0 */}
          <Container size="lg" py="lg" pos="relative" style={{ zIndex: 1 }}>
            <Box
              p={{ base: 'md', sm: 'xl' }}
              style={theme.background
                ? { ...GLASS, borderRadius: 'var(--mantine-radius-md)', boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5)' }
                : undefined}
            >
              <Outlet />
            </Box>
          </Container>
        </AppShell.Main>
      </AppShell>
    </CampaignContext.Provider>
  );
}
