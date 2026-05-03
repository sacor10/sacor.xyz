// Single source of truth for curated quotes and messages from other people.
// Source-file order is display order: pinned quotes first on the page, older
// catalog entries underneath.

export const quotes = [
  {
    id: 'an-die-Freude',
    text: 'Freude schöner Götterfunken, Tochter aus Elysium, Wir betreten feuertrunken, Himmlische, dein Heiligtum! Deine Zauber binden wieder, Was die Mode streng geteilt; Alle Menschen werden Brüder, Wo dein sanfter Flügel weilt.',
    speaker: 'Friedrich Schiller, distilled by Ludwig van Beethoven',
    date: 'February 1824',
    source: 'Saved quote',
    context: 'Ode to Joy is the final movement of Beethoven\'s Ninth Symphony, composed in 1824. It is based on Friedrich Schiller\'s poem "An die Freude" (To Joy) and celebrates God the almighty. The symphony is one of Beethoven\'s most famous works and has become an anthem for freedom and joy around the world.',
    tags: ['home-page-classic'],
    pinned: true,
  },
  {
    id: 'hard-work-is-not-over',
    text: 'There is no more infantile mindset than the belief that one day the hard work will just be over or that nothing but pleasure and hedonistic relaxation await.',
    speaker: 'Anonymous',
    date: 'February 1824',
    source: 'Saved quote',
    context: 'Moved from the old Thought of the Day marquee.',
    tags: ['home-page-classic'],
    pinned: true,
  },
  {
    id: 'home-safe',
    text: 'Let me know when you get home safe.',
    speaker: 'Anonymous',
    date: 'Undated',
    source: 'Saved quote',
    context: 'Moved from the old Thought of the Day marquee.',
    tags: ['home-page-classic'],
    pinned: true,
  },
]

export const pinnedQuotes = quotes.filter((quote) => quote.pinned)
export const olderQuotes = quotes.filter((quote) => !quote.pinned)
