/**
 * Event Director testimonials shown on the /host (For Event Directors) page.
 *
 * Kept as static, hand-curated data (not a DB table) because these are
 * marketing quotes with no user-facing edit surface — every change ships as
 * a code deploy. If we later add an admin CMS for them, migrate to Supabase
 * with the same shape as `reviews`.
 *
 * Source: Bubble.io export /Users/.../testimonials.csv (Aug 2025).
 */

export type EventDirectorTestimonial = {
  id: string;
  name: string;
  eventTitle: string;
  quote: string;
  photo: string;
  createdAt: string;
};

export const EVENT_DIRECTOR_TESTIMONIALS: EventDirectorTestimonial[] = [
  {
    id: "1754033822298x529549456226829500",
    name: "David Reynolds",
    eventTitle: "West Coast Champions Cup",
    quote:
      "We saw a 40% increase in team registrations after listing our tournament on Tournament Guru. The exposure and trust the platform brings are unmatched.",
    photo:
      "https://6b99937c58841db1737bd13b7652fd27.cdn.bubble.io/f1754033819241x590343753309172600/brooke-cagle-wKOKidNT14w-unsplash.jpg",
    createdAt: "2025-08-01T10:37:00Z",
  },
  {
    id: "1754033865877x155949706159650880",
    name: "Carlos Martinez",
    eventTitle: "Elite Hoops Invitational",
    quote:
      "What impressed me most was how quickly we started seeing results. Within days, we had inquiries from out-of-state teams who found us through the platform.",
    photo:
      "https://6b99937c58841db1737bd13b7652fd27.cdn.bubble.io/f1754033862753x575809574104988200/toa-heftiba-chn-__w4I3M-unsplash.jpg",
    createdAt: "2025-08-01T10:37:00Z",
  },
  {
    id: "1754034084034x275986832754934180",
    name: "Linda Chen",
    eventTitle: "NextGen Soccer Series",
    quote:
      "Tournament Guru made it easy to collect reviews, showcase credibility, and attract top-tier teams. It’s become a must-have tool for us.",
    photo:
      "https://6b99937c58841db1737bd13b7652fd27.cdn.bubble.io/f1754034074042x307995981767289000/brooke-cagle-QZRAaYfmvA8-unsplash.jpg",
    createdAt: "2025-08-01T10:41:00Z",
  },
  {
    id: "1754034134575x182100719436067330",
    name: "Rebecca Stone",
    eventTitle: "National Youth Open",
    quote:
      "Tournament Guru isn’t just a listing site — it’s a credibility engine. Reviews, ratings, and exposure helped take our event to the next level.",
    photo:
      "https://6b99937c58841db1737bd13b7652fd27.cdn.bubble.io/f1754034110496x130750801177470960/joshua-rawson-harris--4kwwL-iZ2Q-unsplash.jpg",
    createdAt: "2025-08-01T10:42:00Z",
  },
  {
    id: "1754034347740x899663973817983900",
    name: "Jonathan Blake",
    eventTitle: "Midwest All-Stars Showcase",
    quote:
      "After 10+ years in events, Tournament Guru has been the most effective platform we’ve used. It boosted our credibility and brought in new teams we hadn’t reached before.",
    photo:
      "https://6b99937c58841db1737bd13b7652fd27.cdn.bubble.io/f1754034335083x377516904898155260/brooke-cagle-JrzzESCqeko-unsplash.jpg",
    createdAt: "2025-08-01T10:45:00Z",
  },
];
