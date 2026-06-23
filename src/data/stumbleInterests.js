// Canonical interest catalog for the /stumble discovery feature.
// Shared by the React frontend (interest picker) and the Netlify Functions
// (interest validation + recommendation filtering). Slugs are the stable key
// stored against users and pages — renaming a slug orphans existing data.

export const stumbleInterests = [
  { id: 1, name: 'Art', slug: 'art' },
  { id: 2, name: 'Science', slug: 'science' },
  { id: 3, name: 'Technology', slug: 'technology' },
  { id: 4, name: 'Humor', slug: 'humor' },
  { id: 5, name: 'Music', slug: 'music' },
  { id: 6, name: 'History', slug: 'history' },
  { id: 7, name: 'Photography', slug: 'photography' },
  { id: 8, name: 'Food', slug: 'food' },
  { id: 9, name: 'Travel', slug: 'travel' },
  { id: 10, name: 'Gaming', slug: 'gaming' },
  { id: 11, name: 'Books', slug: 'books' },
  { id: 12, name: 'Nature', slug: 'nature' },
  { id: 13, name: 'Design', slug: 'design' },
  { id: 14, name: 'Space', slug: 'space' },
  { id: 15, name: 'Movies', slug: 'movies' },
  { id: 16, name: 'Weird & Wonderful', slug: 'weird' },
]

export const stumbleInterestSlugs = stumbleInterests.map((i) => i.slug)

const slugSet = new Set(stumbleInterestSlugs)

export const isKnownInterest = (slug) => slugSet.has(slug)

// Minimum interests a signed-in user must pick during onboarding (PRD §6.1).
export const MIN_INTERESTS = 3
