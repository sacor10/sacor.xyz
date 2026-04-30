// Single source of truth for blog posts.
// Posts with a `link` field link to a custom page (e.g. /ytmp4).
// All others are rendered via /blog/:slug using the `body` field.

export const posts = [
  {
    slug: 'ytmp4',
    title: 'I Built a youtube link to mp4 downloader EXE and You Should Try It!!!',
    date: 'Posted April 14, 2026 by Sacor',
    excerpt:
      'So I made this little tray app that just reminds you to drink water, but it yells at you in Comic Sans. Download it below and let me know how many hydration crimes it catches you committing!!! Haha jk, you could steal uncopyrighted music and videos and music videos from the internet with this, though.',
    thumbBorder: '#FF00FF',
    thumb: '/generated-assets/thumb-ytmp4.png',
    link: '/ytmp4',
  },
  {
    slug: 'slc-lan-party',
    title: 'Why Salt Lake City Is Basically a Giant LAN Party in the Mountains',
    date: 'Posted April 2, 2026 by Sacor',
    excerpt:
      'A love letter to SLUT, cold winters, and the people who are never nerding out with me about Theodore Roosevelt on the weekends. Also: I tried to LARP as a Utah College Republican. Results were mixed.',
    thumbBorder: '#00FFFF',
    thumb: '/generated-assets/thumb-slc-lan.png',
    body: (
      <font face="Comic Sans MS" size="3" color="#FFFFFF">
        <i>Post coming soon!!! Sacor is writing this one up.</i>
        <br />
        <br />
        {/* WRITE POST BODY HERE */}
      </font>
    ),
  },
  {
    slug: '90s-snacks',
    title: 'Ranking Every 90s Snack I Can Still Actually Find',
    date: 'Posted March 21, 2026 by Sacor',
    excerpt:
      'Cheez-its are BACK, Fruit Gushers never left, and I have STRONG opinions about Bagel Bites. Come fight me in the comments (that I haven\u2019t implemented yet).',
    thumbBorder: '#00FF00',
    thumb: '/generated-assets/thumb-90s-snacks.png',
    body: (
      <font face="Comic Sans MS" size="3" color="#FFFFFF">
        <i>Post coming soon!!! Sacor is writing this one up.</i>
        <br />
        <br />
        {/* WRITE POST BODY HERE */}
      </font>
    ),
  },
  {
    slug: 'stop-it-now',
    title: 'Somebody needs to stop it now!!!',
    date: 'Posted March 8, 2026 by Sacor',
    excerpt:
      'Was it a good idea? Absolutely not. Did I learn a lot? Kind of. Did I? You bet I did!!! Link inside.',
    thumbBorder: '#FFFF00',
    thumb: '/generated-assets/thumb-stop-warning.png',
    body: (
      <font face="Comic Sans MS" size="3" color="#FFFFFF">
        <i>Post coming soon!!! Sacor is writing this one up.</i>
        <br />
        <br />
        {/* WRITE POST BODY HERE */}
      </font>
    ),
  },
]

export function getPostHref(post) {
  return post.link ?? `/blog/${post.slug}`
}

export function getPostBySlug(slug) {
  return posts.find((p) => p.slug === slug)
}
