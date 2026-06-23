// Seed pool for the /stumble discovery feature (PRD §6.6 "bulk-seed pages").
//
// This fixture bootstraps an empty pool: stumble.mjs lazy-loads it into the
// `stumble-pages` Blobs store when the approved index is empty (mirrors the
// seedIfEmpty pattern in travel-plans.mjs). Real submissions + moderation
// (M3) grow the pool beyond these seeds.
//
// Every entry is an evergreen, safe-for-work, reputable destination. `interests`
// are slugs from stumbleInterests.js. `thumbnailUrl` is intentionally null for
// seeds — the preview card renders a deterministic placeholder; scraped OG
// images arrive with user submissions in M3. `framePolicy` is advisory metadata
// for the iframe-first UI: "allow", "block", or omitted/"unknown".

export const stumbleSeedPages = [
  {
    url: 'https://apod.nasa.gov/apod/',
    title: 'Astronomy Picture of the Day',
    description:
      "NASA's daily window on the cosmos: a new astronomy image each day with a short explanation from a professional astronomer.",
    interests: ['space', 'science', 'photography'],
    framePolicy: 'block',
  },
  {
    url: 'https://www.metmuseum.org/art/collection',
    title: 'The Met Collection',
    description:
      'Browse hundreds of thousands of artworks spanning 5,000 years of human creativity, free to explore online.',
    interests: ['art', 'history'],
  },
  {
    url: 'https://www.atlasobscura.com',
    title: 'Atlas Obscura',
    description:
      "A guide to the world's hidden wonders — the strange, the overlooked, and the extraordinary places worth a detour.",
    interests: ['travel', 'history', 'weird'],
  },
  {
    url: 'https://xkcd.com',
    title: 'xkcd',
    description:
      'A webcomic of romance, sarcasm, math, and language. Beloved by anyone who has ever loved a good footnote.',
    interests: ['humor', 'science', 'technology'],
    framePolicy: 'allow',
  },
  {
    url: 'https://www.quantamagazine.org',
    title: 'Quanta Magazine',
    description:
      'Award-winning, illuminating coverage of developments in mathematics, physics, biology, and computer science.',
    interests: ['science', 'technology'],
    framePolicy: 'block',
  },
  {
    url: 'https://radio.garden',
    title: 'Radio Garden',
    description:
      'Spin a globe of live radio stations and drop in on broadcasts from anywhere on Earth in real time.',
    interests: ['music', 'travel', 'weird'],
  },
  {
    url: 'https://www.gutenberg.org',
    title: 'Project Gutenberg',
    description:
      'Over 70,000 free eBooks — the classics of world literature, digitized and in the public domain.',
    interests: ['books', 'history'],
    framePolicy: 'allow',
  },
  {
    url: 'https://neal.fun',
    title: 'Neal.fun',
    description:
      'A playground of interactive toys and explainers: the scale of the universe, the price of life, and other delightful rabbit holes.',
    interests: ['weird', 'science', 'design'],
  },
  {
    url: 'https://www.seriouseats.com',
    title: 'Serious Eats',
    description:
      'Obsessively tested recipes and the food science behind why they work. Cooking, explained.',
    interests: ['food', 'science'],
  },
  {
    url: 'https://unsplash.com',
    title: 'Unsplash',
    description:
      'A vast library of striking, freely usable photography contributed by photographers around the world.',
    interests: ['photography', 'art', 'design'],
  },
  {
    url: 'https://www.worldhistory.org',
    title: 'World History Encyclopedia',
    description:
      'A deep, readable, peer-reviewed reference for the history of civilizations, from antiquity to the modern age.',
    interests: ['history', 'books'],
  },
  {
    url: 'https://musiclab.chromeexperiments.com',
    title: 'Chrome Music Lab',
    description:
      'Hands-on experiments that make learning music fun and visual — rhythm, harmonics, melody, and more.',
    interests: ['music', 'technology', 'design'],
  },
  {
    url: 'https://explore.org/livecams',
    title: 'Explore.org Live Cams',
    description:
      'Live nature cams from around the planet: bears, puffins, coral reefs, and aurora, streaming 24/7.',
    interests: ['nature', 'travel'],
  },
  {
    url: 'https://www.dezeen.com',
    title: 'Dezeen',
    description:
      "The world's most influential architecture and design magazine, covering buildings, interiors, and objects.",
    interests: ['design', 'art'],
  },
  {
    url: 'https://letterboxd.com',
    title: 'Letterboxd',
    description:
      'A social network for film lovers — track what you watch, write reviews, and find your next great movie.',
    interests: ['movies', 'art'],
  },
  {
    url: 'https://www.theverge.com',
    title: 'The Verge',
    description:
      'Smart reporting on technology, science, and the way they reshape culture and daily life.',
    interests: ['technology', 'science'],
  },
  {
    url: 'https://eyes.nasa.gov/apps/solar-system/',
    title: 'Eyes on the Solar System',
    description:
      "NASA's real-time, interactive 3D ride through the solar system, built from real mission data.",
    interests: ['space', 'science', 'technology'],
  },
  {
    url: 'https://theoatmeal.com',
    title: 'The Oatmeal',
    description:
      'Comics and stories that are funny, occasionally profound, and frequently about why your dog is the way it is.',
    interests: ['humor', 'art'],
  },
  {
    url: 'https://www.are.na',
    title: 'Are.na',
    description:
      'A quiet, ad-free space for collecting and connecting ideas — like a mood board for your brain.',
    interests: ['design', 'art', 'books'],
  },
  {
    url: 'https://www.nationalgeographic.com',
    title: 'National Geographic',
    description:
      'Photography and storytelling about our planet, its wildlife, and the people exploring it.',
    interests: ['nature', 'photography', 'travel'],
  },
  {
    url: 'https://aeon.co',
    title: 'Aeon',
    description:
      'Long-form essays and ideas on philosophy, science, and the human condition — slow reading, well spent.',
    interests: ['science', 'books', 'history'],
  },
  {
    url: 'https://archive.org',
    title: 'Internet Archive',
    description:
      'A nonprofit library of millions of free books, movies, songs, websites, and software — including the Wayback Machine.',
    interests: ['history', 'books', 'movies', 'weird'],
  },
  {
    url: 'https://www.openculture.com',
    title: 'Open Culture',
    description:
      'The best free cultural and educational media on the web: courses, films, audiobooks, and more.',
    interests: ['books', 'movies', 'music', 'history'],
  },
  {
    url: 'https://pudding.cool',
    title: 'The Pudding',
    description:
      'Visual essays that explain ideas debated in culture with playful, beautifully crafted data journalism.',
    interests: ['design', 'technology', 'weird'],
    framePolicy: 'allow',
  },
  {
    url: 'https://xkcd.com/353/',
    title: 'xkcd: Python',
    description:
      'A tiny classic about importing antigravity, programming joy, and why xkcd became part of internet folklore.',
    interests: ['humor', 'technology'],
    framePolicy: 'allow',
  },
  {
    url: 'https://xkcd.com/936/',
    title: 'xkcd: Password Strength',
    description:
      'The memorable comic that changed how a generation thought about passwords, entropy, and passphrases.',
    interests: ['humor', 'technology'],
    framePolicy: 'allow',
  },
  {
    url: 'https://www.gutenberg.org/files/1342/1342-h/1342-h.htm',
    title: 'Pride and Prejudice',
    description:
      'Jane Austen in full public-domain HTML, ready to read without an app, account, or download.',
    interests: ['books', 'history'],
    framePolicy: 'allow',
  },
  {
    url: 'https://www.gutenberg.org/files/1661/1661-h/1661-h.htm',
    title: 'The Adventures of Sherlock Holmes',
    description:
      'Arthur Conan Doyle stories in Project Gutenberg form, a direct doorway into classic detective fiction.',
    interests: ['books', 'history'],
    framePolicy: 'allow',
  },
  {
    url: 'https://pudding.cool/2017/05/song-repetition/',
    title: 'The Pudding: Are Pop Lyrics Getting More Repetitive?',
    description:
      'A playful data essay about repetition in pop music, with interactive charts and cultural texture.',
    interests: ['music', 'design', 'technology'],
    framePolicy: 'allow',
  },
  {
    url: 'https://pudding.cool/2018/08/pockets/',
    title: 'The Pudding: Pudding Pockets',
    description:
      'A visual investigation into clothing pockets, everyday design, and how small measurements reveal big patterns.',
    interests: ['design', 'weird'],
    framePolicy: 'allow',
  },
  {
    url: 'https://apod.nasa.gov/apod/ap240101.html',
    title: 'APOD: A Beautiful Trifid',
    description:
      'A specific Astronomy Picture of the Day entry, useful as both a space stumble and a known iframe fallback test.',
    interests: ['space', 'science', 'photography'],
    framePolicy: 'block',
  },
  {
    url: 'https://www.quantamagazine.org/the-map-of-mathematics-20200213/',
    title: 'Quanta: The Map of Mathematics',
    description:
      'A guided visual tour of modern mathematics from Quanta Magazine; marked as blocked for iframe fallback testing.',
    interests: ['science', 'technology'],
    framePolicy: 'block',
  },
  {
    url: 'https://www.worldhistory.org/article/1048/the-silk-road/',
    title: 'World History Encyclopedia: The Silk Road',
    description:
      'A focused history article on trade routes, exchange, and the movement of ideas across Eurasia.',
    interests: ['history', 'travel', 'books'],
  },
  {
    url: 'https://musiclab.chromeexperiments.com/Song-Maker/',
    title: 'Chrome Music Lab: Song Maker',
    description:
      'A direct jump into the browser-based music sketchpad for making loops with melody and rhythm.',
    interests: ['music', 'technology', 'design'],
  },
  {
    url: 'https://neal.fun/deep-sea/',
    title: 'Neal.fun: The Deep Sea',
    description:
      'A scrollable dive from the surface to the deepest ocean trenches, full of creatures and scale surprises.',
    interests: ['weird', 'science', 'nature'],
  },
  {
    url: 'https://neal.fun/size-of-space/',
    title: 'Neal.fun: Size of Space',
    description:
      'An interactive scale tour that makes the solar system and universe feel both huge and strangely tangible.',
    interests: ['space', 'science', 'design'],
  },
  {
    url: 'https://archive.org/details/softwarelibrary_msdos_games',
    title: 'Internet Archive: MS-DOS Games',
    description:
      'A deep link into the Archive software library, with playable classic games and computing history.',
    interests: ['gaming', 'history', 'weird'],
    framePolicy: 'allow',
  },
  {
    url: 'https://www.openculture.com/freeonlinecourses',
    title: 'Open Culture: Free Online Courses',
    description:
      'A direct catalog of free courses from universities and cultural institutions around the web.',
    interests: ['books', 'history', 'science'],
  },
  {
    url: 'https://www.metmuseum.org/art/collection/search/436535',
    title: 'The Met: Van Gogh, Wheat Field with Cypresses',
    description:
      'A specific artwork page from The Met collection, with object details and art historical context.',
    interests: ['art', 'history'],
  },
  {
    url: 'https://www.atlasobscura.com/places/winchester-mystery-house',
    title: 'Atlas Obscura: Winchester Mystery House',
    description:
      "A direct trip to one of Atlas Obscura's strange-place entries: architectural legend, myth, and maze.",
    interests: ['travel', 'history', 'weird'],
  },
  {
    url: 'https://www.seriouseats.com/the-best-roast-potatoes-ever-recipe',
    title: 'Serious Eats: The Best Roast Potatoes Ever',
    description:
      'A recipe deep link that shows the food-science side of Serious Eats in one crispy, practical page.',
    interests: ['food', 'science'],
  },
]
