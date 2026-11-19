const MEMBER_COLORS = [
  '#333399',
  '#808000',
  '#cc6600',
  '#006666',
  '#663399',
  '#993333',
  '#336633',
  '#336699',
];

/** Deterministic retro web-safe color for a member name */
export function memberDotColor(name: string): string {
  if (!name) return '#808080';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return MEMBER_COLORS[hash % MEMBER_COLORS.length];
}
