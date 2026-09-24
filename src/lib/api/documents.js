/**
 * Documents, sharing and document images. Access is decided by the database
 * rules (supabase/migrations/…_documents.sql); this file just asks.
 */
import { supabase } from '../supabase.js';

const IMAGE_BUCKET = 'document-images';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

const LIST_FIELDS = `
  id, title, folder, visibility, author_id, updated_at,
  author:profiles!documents_author_id_fkey (display_name),
  document_grants (count)`;

const DOC_FIELDS = `
  id, campaign_id, author_id, title, body, folder, visibility, created_at, updated_at, updated_by,
  author:profiles!documents_author_id_fkey (display_name),
  editor:profiles!documents_updated_by_fkey (display_name),
  document_grants (count)`;

/** Flatten the embedded grant count: GMs/author get the total, others their own (0 or 1). */
function withGrantCount({ document_grants, ...doc }) {
  return { ...doc, grantCount: document_grants?.[0]?.count ?? 0 };
}

/** Documents the user can see in a campaign, by folder then title. */
export async function listDocuments(campaignId) {
  const rows = unwrap(await supabase
    .from('documents')
    .select(LIST_FIELDS)
    .eq('campaign_id', campaignId)
    .order('folder', { nullsFirst: true })
    .order('title'));
  return rows.map(withGrantCount);
}

/** A document, or null if it doesn't exist or the user can't see it. */
export async function getDocument(docId) {
  const doc = unwrap(await supabase.from('documents').select(DOC_FIELDS).eq('id', docId).maybeSingle());
  return doc && withGrantCount(doc);
}

/** Returns the new document's id. */
export async function createDocument({ campaignId, title = 'Untitled', body = '', folder = null }) {
  const row = unwrap(await supabase
    .from('documents')
    .insert({ campaign_id: campaignId, title, body, folder })
    .select('id')
    .single());
  return row.id;
}

/** Create several documents at once (import). Returns how many were created. */
export async function createDocuments(campaignId, docs) {
  const rows = unwrap(await supabase
    .from('documents')
    .insert(docs.map(d => ({ campaign_id: campaignId, title: d.title, body: d.body, folder: d.folder ?? null })))
    .select('id'));
  return rows.length;
}

/** Thrown by saveDocument when someone else saved first. */
export class SaveConflictError extends Error {
  constructor(current) {
    super('Someone else saved this document after you started editing.');
    this.current = current;
  }
}

/**
 * Save title/body/folder. If `expectedUpdatedAt` is given, only save when the
 * document hasn't changed since then; otherwise throw SaveConflictError with
 * the latest version. Returns the saved document.
 */
export async function saveDocument(docId, fields, expectedUpdatedAt = null) {
  let query = supabase.from('documents').update(fields).eq('id', docId);
  if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt);
  const saved = unwrap(await query.select(DOC_FIELDS).maybeSingle());
  if (saved) return withGrantCount(saved);

  // Nothing was updated: find out why
  const current = await getDocument(docId);
  if (!current) throw new Error('This document no longer exists, or you no longer have access to it.');
  if (expectedUpdatedAt && current.updated_at !== expectedUpdatedAt) throw new SaveConflictError(current);
  throw new Error("You don't have permission to edit this document.");
}

/** GMs and the author only. */
export async function setVisibility(docId, visibility) {
  unwrap(await supabase.from('documents').update({ visibility }).eq('id', docId));
}

/** GMs and the author only. */
export async function deleteDocument(docId) {
  unwrap(await supabase.from('documents').delete().eq('id', docId));
}

/** Everything visible in a campaign, with bodies, for export. */
export async function exportDocuments(campaignId) {
  return unwrap(await supabase
    .from('documents')
    .select('title, folder, body')
    .eq('campaign_id', campaignId)
    .order('folder', { nullsFirst: true })
    .order('title'));
}

// --- Sharing -----------------------------------------------------------------

/** GMs and the author see all grants; others see only their own. */
export async function listGrants(docId) {
  return unwrap(await supabase
    .from('document_grants')
    .select('user_id, permission')
    .eq('document_id', docId));
}

/** 'view' | 'edit' | null */
export async function getMyGrant(docId, userId) {
  const row = unwrap(await supabase
    .from('document_grants')
    .select('permission')
    .eq('document_id', docId)
    .eq('user_id', userId)
    .maybeSingle());
  return row?.permission ?? null;
}

/** Give a member 'view' or 'edit' access, or remove their grant with null. */
export async function setGrant(docId, userId, permission) {
  if (permission) {
    // Update an existing grant, or add one. (Not upsert: only `permission` may be updated.)
    const updated = unwrap(await supabase
      .from('document_grants')
      .update({ permission })
      .eq('document_id', docId)
      .eq('user_id', userId)
      .select('user_id'));
    if (updated.length === 0) {
      unwrap(await supabase
        .from('document_grants')
        .insert({ document_id: docId, user_id: userId, permission }));
    }
  } else {
    unwrap(await supabase
      .from('document_grants')
      .delete()
      .eq('document_id', docId)
      .eq('user_id', userId));
  }
}

// --- Images ------------------------------------------------------------------

const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Upload an image for a document. Returns its storage path. */
export async function uploadImage(campaignId, docId, file) {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error('Images must be PNG, JPEG, GIF or WebP.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Images must be 5 MB or smaller.');
  const path = `${campaignId}/${docId}/${crypto.randomUUID()}.${ext}`;
  unwrap(await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type }));
  return path;
}

/** Temporary URLs (1 hour) for private images. Returns Map path → url. */
export async function signImageUrls(paths) {
  if (paths.length === 0) return new Map();
  const rows = unwrap(await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(paths, 3600));
  return new Map(rows.filter(r => r.signedUrl).map(r => [r.path, r.signedUrl]));
}
