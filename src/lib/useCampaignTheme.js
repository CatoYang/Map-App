/**
 * A campaign's look, published from its vault by `npm run sync`:
 * accent colour plus cover and background images (as temporary links).
 */
import { useAsync } from './useAsync.js';
import { signCampaignAssets } from './api/campaigns.js';

const NO_IMAGES = new Map();

/** Themes for several campaigns: Map of campaign id → { accent, cover, background }. */
export function useCampaignThemes(campaigns) {
  const list = campaigns || [];
  const paths = list.flatMap(c => [c.theme?.cover, c.theme?.background]).filter(Boolean);
  const { data: urls } = useAsync(
    () => (paths.length ? signCampaignAssets(paths) : Promise.resolve(NO_IMAGES)),
    [paths.join('|')],
  );
  return new Map(list.map(c => [c.id, {
    accent: c.theme?.accent ?? null,
    cover: urls?.get(c.theme?.cover) ?? null,
    background: urls?.get(c.theme?.background) ?? null,
  }]));
}

/** One campaign's theme (see useCampaignThemes). Safe to call with null. */
export function useCampaignTheme(campaign) {
  return useCampaignThemes(campaign ? [campaign] : []).get(campaign?.id)
    ?? { accent: null, cover: null, background: null };
}
