/**
 * The app's own page backgrounds (campaigns bring their own; see
 * docs/content-format.md → Campaign look).
 *
 * To swap a page's background, change its name in PAGE_BACKGROUNDS to another
 * key of BACKGROUNDS. To add one, put an image in src/assets/brand/ and import
 * it below. The SVGs are drawn by scripts/brand/backgrounds.mjs.
 */
import contours from '../assets/brand/contours.svg';
import deco from '../assets/brand/deco.svg';
import ember from '../assets/brand/ember.svg';
import nocturne from '../assets/brand/nocturne.svg';
import ridges from '../assets/brand/ridges.svg';

export const BACKGROUNDS = { contours, deco, ember, nocturne, ridges };

export const PAGE_BACKGROUNDS = {
  landing: 'nocturne',     // home page and sign-in
  campaigns: 'contours',   // campaign list, invite links
};

/** The background image URL for one of the app's own pages. */
export function pageBackground(page) {
  return BACKGROUNDS[PAGE_BACKGROUNDS[page]] ?? null;
}
