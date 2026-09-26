/**
 * Map overlays: territories drawn per era. World history (mortal control,
 * military) is shared by every campaign in a world; campaign overlays (Kindred
 * domains, clan presence) belong to one campaign and stay hidden from players
 * until revealed. The database rules decide who sees and edits what
 * (supabase/migrations/20260928120000_overlays.sql).
 */
import { supabase } from '../supabase.js';

const COLUMNS = 'id, campaign_id, world_pack, mode, era, from_year, to_year, name, faction, color, pattern, geojson, visibility, updated_at';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

/** The campaign's overlays the user can see, plus its world's history. */
export async function listOverlays(campaign) {
  return unwrap(await supabase
    .from('overlays')
    .select(COLUMNS)
    .or(`campaign_id.eq.${campaign.id},and(campaign_id.is.null,world_pack.eq.${campaign.world_pack})`)
    .order('name'));
}

/** What the user may draw: `gm` → this campaign's overlays, `worldEditor` → world history. */
export async function getOverlayRights(campaignId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { gm: false, worldEditor: false };
  const [membership, editor] = await Promise.all([
    supabase.from('memberships').select('role').eq('campaign_id', campaignId).eq('user_id', user.id).maybeSingle(),
    supabase.from('world_editors').select('user_id').eq('user_id', user.id).maybeSingle(),
  ]);
  return { gm: unwrap(membership)?.role === 'gm', worldEditor: !!unwrap(editor) };
}

/**
 * Create (no `id`) or update an overlay. `world` rows go to the campaign's
 * world, the rest to the campaign. Returns the saved row.
 */
export async function saveOverlay(campaign, { id, world, ...fields }) {
  const values = {
    mode: fields.mode, era: fields.era, name: fields.name,
    from_year: fields.from_year ?? null, to_year: fields.to_year ?? null,
    faction: fields.faction || null, color: fields.color, pattern: fields.pattern || null,
    geojson: fields.geojson,
    visibility: world ? 'campaign' : fields.visibility,
  };
  if (id) {
    return unwrap(await supabase.from('overlays').update(values).eq('id', id).select(COLUMNS).single());
  }
  const owner = world ? { world_pack: campaign.world_pack } : { campaign_id: campaign.id };
  return unwrap(await supabase.from('overlays').insert({ ...owner, ...values }).select(COLUMNS).single());
}

export async function deleteOverlay(id) {
  unwrap(await supabase.from('overlays').delete().eq('id', id));
}

/** Everything the map needs to read and draw one campaign's overlays. */
export function overlaySource(campaign) {
  return {
    list: () => listOverlays(campaign),
    rights: () => getOverlayRights(campaign.id),
    save: (row) => saveOverlay(campaign, row),
    remove: (id) => deleteOverlay(id),
  };
}
