/**
 * npm run sync — publish the vault to Supabase. One-way: the vault wins.
 *
 *   npm run sync               publish
 *   npm run sync -- --dry-run  show what would be published (no key needed)
 *
 * For now this publishes each campaign note's look (background, cover,
 * accent) and settings (map_year) to its campaign in the app. Notes
 * themselves come next.
 *
 * Needs SUPABASE_SECRET_KEY in .env.sync.local (gitignored). That key
 * bypasses every access rule: never commit it, never put it in a VITE_ variable.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { REPO_ROOT, contentDir, loadVault, noteType, resolveImage, fail } from './vault.js';
import { asText } from './format.js';

const DRY_RUN = process.argv.includes('--dry-run');
const ASSET_BUCKET = 'campaign-assets';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How each theme image is prepared for the web: widest useful size. */
const IMAGE_ROLES = {
  background: 2400,   // full-screen backdrop inside the campaign
  cover: 1200,        // the card on the campaign list
};

// --- Settings ----------------------------------------------------------------

const dir = contentDir();   // also loads .env.local
for (const file of ['.env.sync.local', '.env.production']) {
  try { process.loadEnvFile(path.join(REPO_ROOT, file)); } catch { /* optional */ }
}
const url = process.env.VITE_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!DRY_RUN && !url) fail('VITE_SUPABASE_URL isn\'t set (it normally comes from .env.local or .env.production).');
if (!DRY_RUN && !secretKey) {
  fail('SUPABASE_SECRET_KEY isn\'t set. Create a file .env.sync.local in Map-App with:\n'
    + '  SUPABASE_SECRET_KEY=sb_secret_...\n'
    + '(Supabase dashboard → Project Settings → API Keys → Secret keys.) Or try `npm run sync -- --dry-run`.');
}

// --- Campaign looks ----------------------------------------------------------

/** A web-ready copy of an image: resized WebP, named by its content. */
async function prepareImage(appId, role, file) {
  const data = await sharp(file)
    .rotate()   // respect camera orientation
    .resize({ width: IMAGE_ROLES[role], withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const hash = crypto.createHash('sha256').update(data).digest('hex').slice(0, 10);
  return { path: `${appId}/${role}-${hash}.webp`, data };
}

/** What each campaign note should publish: { note, appId, theme, uploads } or { note, problem }. */
async function planCampaigns(vault) {
  const plans = [];
  for (const note of vault.notes.filter(n => noteType(n) === 'campaign')) {
    const fm = note.frontmatter || {};
    const appId = asText(fm.app_id).toLowerCase();
    if (!UUID.test(appId)) { plans.push({ note, problem: 'no valid `app_id`' }); continue; }

    const theme = {};
    const uploads = [];
    let problem = null;
    for (const role of Object.keys(IMAGE_ROLES)) {
      if (fm[role] == null || fm[role] === '') continue;
      const image = resolveImage(vault, fm[role]);
      if (!image) { problem = `\`${role}\`: no such image in the vault`; break; }
      const prepared = await prepareImage(appId, role, path.join(vault.dir, image));
      theme[role] = prepared.path;
      uploads.push({ ...prepared, source: image });
    }
    if (problem) { plans.push({ note, problem }); continue; }
    if (/^#[0-9a-f]{6}$/i.test(asText(fm.accent))) theme.accent = asText(fm.accent);

    const settings = {};
    const year = parseInt(asText(fm.map_year), 10);
    if (Number.isFinite(year)) settings.map_year = year;   // where the campaign's map opens
    plans.push({ note, appId, theme, settings, uploads });
  }
  return plans;
}

async function publishCampaign(supabase, plan) {
  const { data: campaign, error } = await supabase.from('campaigns').select('id, name').eq('id', plan.appId).maybeSingle();
  if (error) throw error;
  if (!campaign) return `no campaign with id ${plan.appId} in the app (check \`app_id\`)`;

  // Upload images that aren't there yet (names change when content changes)
  const { data: existing, error: listError } = await supabase.storage.from(ASSET_BUCKET).list(plan.appId, { limit: 1000 });
  if (listError) throw listError;
  const have = new Set(existing.map(f => `${plan.appId}/${f.name}`));
  for (const upload of plan.uploads) {
    if (have.has(upload.path)) continue;
    const { error: upError } = await supabase.storage.from(ASSET_BUCKET)
      .upload(upload.path, upload.data, { contentType: 'image/webp', cacheControl: '31536000', upsert: true });
    if (upError) throw upError;
  }

  const { error: updateError } = await supabase.from('campaigns')
    .update({ theme: plan.theme, settings: plan.settings }).eq('id', plan.appId);
  if (updateError) throw updateError;

  // Remove images the theme no longer uses
  const keep = new Set(plan.uploads.map(u => u.path));
  const stale = [...have].filter(p => !keep.has(p));
  if (stale.length) {
    const { error: rmError } = await supabase.storage.from(ASSET_BUCKET).remove(stale);
    if (rmError) throw rmError;
  }
  return `published to "${campaign.name}" (${plan.uploads.length} image${plan.uploads.length === 1 ? '' : 's'}${stale.length ? `, ${stale.length} old removed` : ''})`;
}

// --- Run ---------------------------------------------------------------------

const vault = loadVault(dir);
const plans = await planCampaigns(vault);
if (!plans.length) console.log('No campaign notes (type: campaign) in the vault.');

const supabase = DRY_RUN ? null : createClient(url, secretKey, { auth: { persistSession: false } });
let failed = 0;
for (const plan of plans) {
  const label = `Campaign [[${plan.note.name}]]`;
  if (plan.problem) {
    console.log(`✖ ${label}: skipped, ${plan.problem}`);
    failed++;
    continue;
  }
  if (DRY_RUN) {
    console.log(`• ${label} → app campaign ${plan.appId}`);
    for (const u of plan.uploads) console.log(`    ${u.path}  ${(u.data.length / 1024).toFixed(0)} KB  (from ${u.source})`);
    console.log(`    theme: ${JSON.stringify(plan.theme)}`);
    console.log(`    settings: ${JSON.stringify(plan.settings)}`);
    continue;
  }
  try {
    const result = await publishCampaign(supabase, plan);
    const ok = result.startsWith('published');
    if (!ok) failed++;
    console.log(`${ok ? '✓' : '✖'} ${label}: ${result}`);
  } catch (err) {
    failed++;
    console.log(`✖ ${label}: ${err.message}`);
  }
}
if (DRY_RUN) console.log('\nDry run: nothing was sent.');
process.exitCode = failed ? 1 : 0;
