import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useMatch, useNavigate } from 'react-router';
import {
  ActionIcon, Anchor, AppShell, Badge, Box, Group, Menu, NavLink, ScrollArea, Stack, Text, TextInput, Tooltip, Tree,
  useTree,
} from '@mantine/core';
import { useFileDialog } from '@mantine/hooks';
import { useCampaign } from '../app/CampaignLayout.jsx';
import { ErrorAlert } from './Status.jsx';
import { createDocument, createDocuments, exportDocuments } from '../lib/api/documents.js';
import { downloadZip, readMarkdownFiles } from '../lib/files.js';
import { ROLE_LABELS, WORLD_PACKS } from '../lib/labels.js';
import classes from './CampaignSidebar.module.css';

/**
 * The campaign's sidebar: quick links, the user's own documents, the library
 * of notes published from the vault, and members.
 */
export function CampaignSidebar() {
  const { campaign, myRole, isGm, members, theme, docs, docsError } = useCampaign();
  const { pathname } = useLocation();
  const docId = useMatch('/c/:campaignId/docs/:docId')?.params.docId ?? null;
  const base = `/c/${campaign.id}`;
  const world = WORLD_PACKS[campaign.world_pack];

  const appDocs = (docs || []).filter(d => !d.source_path);
  const vaultNotes = (docs || []).filter(d => d.source_path);

  return (
    <>
      <AppShell.Section p="md" pb="xs">
        <Anchor component={Link} to="/campaigns" size="xs" c="dimmed">← Your campaigns</Anchor>
        <Group gap="xs" mt={6} wrap="nowrap">
          <Text fw={700} size="lg" truncate>{campaign.name}</Text>
          {myRole && <Badge size="xs" variant="light" color={isGm ? 'grape' : 'blue'}>{ROLE_LABELS[myRole]}</Badge>}
        </Group>
        {theme.accent && <Box w={40} h={3} mt={6} bg={theme.accent} style={{ borderRadius: 2 }} />}
      </AppShell.Section>

      <AppShell.Section px="xs">
        <NavLink component={Link} to={base} label="Overview" active={pathname === base} />
        {world && (
          <NavLink component={Link} to={`${base}/map/${world.mapId}`} label="Map"
            rightSection={<Text size="xs" c="dimmed">full screen</Text>} />
        )}
      </AppShell.Section>

      <AppShell.Section grow component={ScrollArea} scrollbars="y" px="xs" mt="sm">
        <ErrorAlert error={docsError} title="Couldn't load documents" />
        <MyDocuments docs={appDocs} activeId={docId} />
        {vaultNotes.length > 0 && <Library notes={vaultNotes} activeId={docId} />}
      </AppShell.Section>

      <AppShell.Section px="xs" py="xs" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <NavLink component={Link} to={`${base}/members`} label="Members"
          active={pathname === `${base}/members`}
          rightSection={<Text size="xs" c="dimmed">{members.length}</Text>} />
      </AppShell.Section>
    </>
  );
}

function SectionTitle({ children, right }) {
  return (
    <Group justify="space-between" px="xs" mt="md" mb={4} wrap="nowrap">
      <Text size="xs" fw={700} tt="uppercase" c="dimmed">{children}</Text>
      {right}
    </Group>
  );
}

/** Documents written in the app, with New / Import / Export. */
function MyDocuments({ docs, activeId }) {
  const { campaign, isGm, reloadDocs } = useCampaign();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  async function run(fn) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const handleNew = () => run(async () => {
    const id = await createDocument({ campaignId: campaign.id });
    reloadDocs();
    navigate(`/c/${campaign.id}/docs/${id}?edit=1`);
  });

  const importDialog = useFileDialog({
    accept: '.md,.markdown,.txt,text/markdown,text/plain',
    multiple: true,
    resetOnOpen: true,
    onChange: files => files?.length && run(async () => {
      const n = await createDocuments(campaign.id, await readMarkdownFiles([...files]));
      setNotice(`Imported ${n} document${n === 1 ? '' : 's'}. They're private until you share them.`);
      reloadDocs();
    }),
  });

  const handleExport = () => run(async () => {
    downloadZip(campaign.name, await exportDocuments(campaign.id));
  });

  // Group by folder; documents without a folder come first
  const groups = new Map();
  for (const doc of docs) {
    const key = doc.folder || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }

  return (
    <Box>
      <SectionTitle right={(
        <Group gap={2} wrap="nowrap">
          <Tooltip label="New document">
            <ActionIcon size="sm" variant="subtle" onClick={handleNew} loading={busy} aria-label="New document">+</ActionIcon>
          </Tooltip>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon size="sm" variant="subtle" aria-label="More">⋯</ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={importDialog.open}>Import .md files</Menu.Item>
              <Menu.Item onClick={handleExport}>Export everything you can see (.zip)</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      )}>
        My documents
      </SectionTitle>

      <Stack gap={4} px="xs">
        <ErrorAlert error={error} />
        {notice && <Text size="xs" c="teal">{notice}</Text>}
      </Stack>

      {docs.length === 0 && (
        <Text size="xs" c="dimmed" px="xs">
          {isGm
            ? 'Handouts, session notes and private GM notes you write here.'
            : 'Your notes and journal. Private to you and the GMs unless you share them.'}
        </Text>
      )}

      {[...groups].map(([folder, items]) => (
        <Box key={folder}>
          {folder && <Text size="xs" c="dimmed" px="xs" mt={6}>{folder}</Text>}
          {items.map(doc => (
            <NavLink key={doc.id} component={Link} to={`/c/${campaign.id}/docs/${doc.id}`}
              label={doc.title} active={doc.id === activeId} py={4} />
          ))}
        </Box>
      ))}
    </Box>
  );
}

/**
 * Turn vault notes into a folder tree, ordered like the vault (by path, so the
 * `01_` sort prefixes still count), folders before notes. Also returns, for
 * each note, the folders that contain it (to open them when it's shown).
 */
function buildTree(notes) {
  const root = [];
  const folders = new Map();     // folder path → node
  const ancestors = new Map();   // note id → folder node values
  for (const note of [...notes].sort((a, b) => a.source_path.localeCompare(b.source_path))) {
    let children = root;
    let key = '';
    const path = [];
    for (const part of note.folder ? note.folder.split(' / ') : []) {
      key = key ? `${key} / ${part}` : part;
      let node = folders.get(key);
      if (!node) {
        node = { value: `folder:${key}`, label: part, children: [], nodeProps: { count: 0 } };
        folders.set(key, node);
        children.push(node);
      }
      node.nodeProps.count++;
      path.push(node.value);
      children = node.children;
    }
    children.push({ value: `doc:${note.id}`, label: note.title });
    ancestors.set(note.id, path);
  }
  const foldersFirst = (nodes) => {
    nodes.sort((a, b) => Number(!a.children) - Number(!b.children));
    for (const n of nodes) if (n.children) foldersFirst(n.children);
    return nodes;
  };
  return { data: foldersFirst(root), ancestors };
}

/** Notes published from the vault, as a folder tree, with search. */
function Library({ notes, activeId }) {
  const { campaign } = useCampaign();
  const [query, setQuery] = useState('');
  const { data, ancestors } = useMemo(() => buildTree(notes), [notes]);
  // Which folders are open; kept here so opening a note's folders isn't undone when the tree resets
  const [expanded, setExpanded] = useState({});
  const tree = useTree({ expandedState: expanded, onExpandedStateChange: setExpanded });

  // Open the folders around the note being shown (they can still be closed afterwards)
  useEffect(() => {
    const path = ancestors.get(activeId);
    if (!path?.length) return undefined;
    setExpanded(prev => ({ ...prev, ...Object.fromEntries(path.map(v => [v, true])) }));
    // …and scroll the sidebar to it once the folders have opened
    const timer = setTimeout(() => {
      document.querySelector(`nav a[data-value="doc:${activeId}"]`)?.scrollIntoView({ block: 'nearest' });
    }, 50);
    return () => clearTimeout(timer);
  }, [activeId, ancestors]);

  const q = query.trim().toLowerCase();
  const matches = q ? notes.filter(n => n.title.toLowerCase().includes(q)).slice(0, 100) : null;

  return (
    <Box mb="md">
      <SectionTitle right={<Text size="xs" c="dimmed">{notes.length}</Text>}>Library</SectionTitle>
      <TextInput size="xs" mx="xs" mb={6} placeholder="Search notes" value={query}
        onChange={e => setQuery(e.currentTarget.value)} />

      {matches ? (
        <>
          {matches.length === 0 && <Text size="xs" c="dimmed" px="xs">No notes match.</Text>}
          {matches.map(n => (
            <NavLink key={n.id} component={Link} to={`/c/${campaign.id}/docs/${n.id}`} py={4}
              label={n.title} description={n.folder} active={n.id === activeId} />
          ))}
        </>
      ) : (
        <Tree
          data={data}
          tree={tree}
          levelOffset="sm"
          renderNode={({ node, expanded, hasChildren, elementProps }) => {
            if (hasChildren) {
              return (
                <Group gap={6} wrap="nowrap" {...elementProps} className={`${elementProps.className} ${classes.node}`}>
                  <Text span size="xs" c="dimmed" w={10}>{expanded ? '▾' : '▸'}</Text>
                  <Text span size="sm" truncate style={{ flex: 1 }}>{node.label}</Text>
                  <Text span size="xs" c="dimmed">{node.nodeProps.count}</Text>
                </Group>
              );
            }
            const id = node.value.slice('doc:'.length);
            return (
              <Box component={Link} to={`/c/${campaign.id}/docs/${id}`} {...elementProps}
                className={`${elementProps.className} ${classes.node} ${classes.note}`}
                data-active={id === activeId || undefined} title={node.label}>
                <Text span size="sm">{node.label}</Text>
              </Box>
            );
          }}
        />
      )}
    </Box>
  );
}
