/**
 * Campaigns, members and invites. What each user can see or change is decided
 * by the database rules (supabase/migrations/), not by this file.
 */
import { supabase } from '../supabase.js';

/** Throw Supabase errors so callers can use try/catch. */
function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

/** Campaigns the user belongs to, newest membership first, with their role. */
export async function listMyCampaigns(userId) {
  const rows = unwrap(await supabase
    .from('memberships')
    .select('role, campaign:campaigns (id, name, description, world_pack, theme)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false }));
  return rows.map(r => ({ ...r.campaign, role: r.role }));
}

/** A campaign, or null if it doesn't exist or the user isn't a member. */
export async function getCampaign(campaignId) {
  return unwrap(await supabase
    .from('campaigns')
    .select('id, name, description, world_pack, owner_id, theme')
    .eq('id', campaignId)
    .maybeSingle());
}

export async function listMembers(campaignId) {
  return unwrap(await supabase
    .from('memberships')
    .select('user_id, role, joined_at, profile:profiles (display_name, avatar_url)')
    .eq('campaign_id', campaignId)
    .order('joined_at'));
}

/** Create a campaign with the current user as GM. Returns its id. */
export async function createCampaign({ name, description }) {
  return unwrap(await supabase.rpc('create_campaign', {
    p_name: name,
    p_description: description || null,
  }));
}

// --- Invites -----------------------------------------------------------------

/** Full URL for an invite code. */
export function inviteLink(code) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${window.location.origin}${base}/join/${code}`;
}

/** GM only. */
export async function listInvites(campaignId) {
  return unwrap(await supabase
    .from('invites')
    .select('code, role, expires_at, max_uses, uses, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false }));
}

/**
 * GM only. Returns the new invite's code.
 * @param {{ campaignId: string, role: 'gm'|'player', expiresInDays: number|null, maxUses: number|null }} opts
 */
export async function createInvite({ campaignId, role, expiresInDays, maxUses }) {
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  const row = unwrap(await supabase
    .from('invites')
    .insert({ campaign_id: campaignId, role, expires_at: expiresAt, max_uses: maxUses })
    .select('code')
    .single());
  return row.code;
}

/** GM only. */
export async function revokeInvite(code) {
  unwrap(await supabase.from('invites').delete().eq('code', code));
}

/**
 * What an invite leads to, or null if it's invalid, expired or used up.
 * @returns {Promise<{ campaign_id: string, campaign_name: string, role: string, already_member: boolean } | null>}
 */
export async function previewInvite(code) {
  const rows = unwrap(await supabase.rpc('invite_preview', { p_code: code }));
  return rows[0] ?? null;
}

/** Join the campaign an invite belongs to. Returns the campaign id. */
export async function redeemInvite(code) {
  return unwrap(await supabase.rpc('redeem_invite', { p_code: code }));
}

// --- Theme images ------------------------------------------------------------

const ASSET_BUCKET = 'campaign-assets';
const SIGNED_FOR = 3600;                 // seconds a link works
const signedCache = new Map();           // path → { url, until }

/**
 * Temporary links (members only) for campaign theme images. Returns a Map of
 * path → url. Links are reused until shortly before they expire, so moving
 * between pages doesn't download the images again.
 */
export async function signCampaignAssets(paths) {
  const now = Date.now();
  const missing = [...new Set(paths)].filter(p => !(signedCache.get(p)?.until > now));
  if (missing.length) {
    const rows = unwrap(await supabase.storage.from(ASSET_BUCKET).createSignedUrls(missing, SIGNED_FOR));
    for (const r of rows) {
      if (r.signedUrl) signedCache.set(r.path, { url: r.signedUrl, until: now + (SIGNED_FOR - 600) * 1000 });
    }
  }
  return new Map(paths.filter(p => signedCache.has(p)).map(p => [p, signedCache.get(p).url]));
}
