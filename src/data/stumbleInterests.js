// Canonical interest catalog for the /stumble discovery feature.
// Shared by the React frontend (interest picker) and the Netlify Functions
// (interest validation + recommendation filtering). Slugs are the stable key
// stored against users and pages — renaming a slug orphans existing data.

export const stumbleInterestGroups = [
  { id: 'culture', name: 'Culture' },
  { id: 'knowledge', name: 'Knowledge' },
  { id: 'places', name: 'Places' },
  { id: 'web', name: 'Web & Play' },
]

export const stumbleInterests = [
  { id: 1, name: 'Art', slug: 'art', group: 'culture' },
  { id: 2, name: 'Science', slug: 'science', group: 'knowledge' },
  { id: 3, name: 'Technology', slug: 'technology', group: 'knowledge' },
  { id: 4, name: 'Humor', slug: 'humor', group: 'web' },
  { id: 5, name: 'Music', slug: 'music', group: 'culture' },
  { id: 6, name: 'History', slug: 'history', group: 'knowledge' },
  { id: 7, name: 'Photography', slug: 'photography', group: 'culture' },
  { id: 8, name: 'Food', slug: 'food', group: 'culture' },
  { id: 9, name: 'Travel', slug: 'travel', group: 'places' },
  { id: 10, name: 'Gaming', slug: 'gaming', group: 'web' },
  { id: 11, name: 'Books', slug: 'books', group: 'culture' },
  { id: 12, name: 'Nature', slug: 'nature', group: 'knowledge' },
  { id: 13, name: 'Design', slug: 'design', group: 'culture' },
  { id: 14, name: 'Space', slug: 'space', group: 'knowledge' },
  { id: 15, name: 'Movies', slug: 'movies', group: 'culture' },
  { id: 16, name: 'Weird & Wonderful', slug: 'weird', group: 'web' },
  { id: 17, name: 'Learning', slug: 'learning', group: 'knowledge' },
  { id: 18, name: 'Maps', slug: 'maps', group: 'places' },
  { id: 19, name: 'Internet Culture', slug: 'internet-culture', group: 'web' },
  { id: 20, name: 'Tools', slug: 'tools', group: 'web' },
  { id: 21, name: 'Programming', slug: 'programming', group: 'knowledge' },
  { id: 22, name: 'Museums', slug: 'museums', group: 'places' },
  { id: 23, name: 'Archives', slug: 'archives', group: 'places' },
  { id: 24, name: 'Interactives', slug: 'interactives', group: 'web' },
]

export const stumbleInterestSlugs = stumbleInterests.map((i) => i.slug)

const slugSet = new Set(stumbleInterestSlugs)

export const isKnownInterest = (slug) => slugSet.has(slug)

// Minimum interests a signed-in user must pick during onboarding (PRD §6.1).
export const MIN_INTERESTS = 3
