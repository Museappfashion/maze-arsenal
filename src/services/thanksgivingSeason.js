// Keep this event's advertised deadline fixed when the calendar rolls over.
export const THANKSGIVING_EVENT_YEAR = 2026;

export function thanksgivingDate(year = THANKSGIVING_EVENT_YEAR) {
  const novemberFirst = new Date(year, 10, 1);
  const firstThursday = 1 + (4 - novemberFirst.getDay() + 7) % 7;
  return new Date(year, 10, firstThursday + 21);
}

export function isThanksgivingOpen(now = new Date()) {
  const end = thanksgivingDate();
  end.setDate(end.getDate() + 1);
  return now.getTime() < end.getTime();
}

export const THANKSGIVING_DATE_LABEL = thanksgivingDate().toLocaleDateString("en-US", {
  month: "long", day: "numeric", year: "numeric",
});
