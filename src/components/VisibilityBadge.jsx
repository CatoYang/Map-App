import { Badge } from '@mantine/core';

/** Short label for who can see a document, from the current user's point of view. */
export function VisibilityBadge({ doc, userId }) {
  let label, color;
  if (doc.visibility === 'campaign') {
    [label, color] = ['Everyone', 'green'];
  } else if (doc.source_path) {
    [label, color] = doc.grantCount > 0 ? ['Shared', 'blue'] : ['GM only', 'gray'];
  } else if (doc.author_id === userId) {
    [label, color] = doc.grantCount > 0 ? [`Shared (${doc.grantCount})`, 'blue'] : ['Private', 'gray'];
  } else {
    // Not the author: either a GM (sees everything) or someone it was shared with
    [label, color] = doc.grantCount > 0 ? ['Shared', 'blue'] : ['Private', 'gray'];
  }
  return <Badge size="sm" variant="light" color={color}>{label}</Badge>;
}
