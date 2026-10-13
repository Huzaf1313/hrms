const THOUGHTS: string[] = [
  "Small habits, repeated daily, outlast big bursts of effort.",
  "The best time to ask for help was yesterday. The second best is right now.",
  "Great work is rarely a solo act.",
  "Clarity is kindness to the people reading your work.",
  "Progress hides inside the ordinary.",
  "A team that talks openly solves problems before they grow.",
  "Done and imperfect beats perfect and unfinished.",
  "The people you work with are your biggest advantage.",
  "Celebrate the small wins. They compound.",
  "Consistency turns ordinary into exceptional.",
  "Good questions often beat quick answers.",
  "Trust is built in the details nobody is watching.",
  "Every process you improve saves someone a future headache.",
  "Kindness and high standards are not opposites.",
  "Learning something new takes one uncomfortable hour.",
  "The strongest ideas usually start as the quietest suggestion.",
  "Respect the time of the people on your team.",
  "Feedback is a gift, but only when it arrives on time.",
  "Sustainable pace beats heroic effort every single quarter.",
  "Being known is one of the nicest things a workplace can offer.",
  "You do not have to be perfect to be valuable.",
  "A short conversation solves what a long email cannot.",
  "Patience is a technical skill in any organisation.",
  "The work you are proud of is rarely the work you enjoy.",
  "Leave things better organised than you found them.",
  "Recognition costs nothing and is remembered for years.",
  "Ask what success looks like before you start.",
];

const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * Picks the thought shown for the given day.
 *
 * Indexed by day-of-year rather than picked at random, so the thought holds
 * steady all day instead of reshuffling on every render or refresh. Both ends
 * of the difference are built in UTC so daylight saving shifts cannot push
 * the count a day out of step.
 */
export function getThoughtForDate(date: Date = new Date()): string {
  const year = date.getFullYear();

  const startOfYear = Date.UTC(year, 0, 0);
  const currentDay = Date.UTC(year, date.getMonth(), date.getDate());

  const dayOfYear = Math.floor((currentDay - startOfYear) / MILLISECONDS_PER_DAY);

  return THOUGHTS[dayOfYear % THOUGHTS.length];
}