const MEMBER_COLORS = [
  '#333399', // 靛蓝
  '#ff6600', // 橙色
  '#008080', // 青绿
  '#cc3366', // 玫红
  '#339933', // 翠绿
  '#9933cc', // 紫色
  '#cc9900', // 琥珀
  '#3366cc', // 钴蓝
  '#996633', // 棕褐
  '#669900', // 橄榄
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

/**
 * Assign a guaranteed distinct color (up to palette size) to each unique member
 * in stable sorted order, avoiding hash collisions between members.
 */
export function buildMemberColorMap(members: Iterable<string>): Map<string, string> {
  const unique = Array.from(new Set(Array.from(members).map((m) => m || '默认'))).sort((a, b) =>
    a.localeCompare(b, 'zh-CN')
  );
  const map = new Map<string, string>();
  unique.forEach((name, idx) => {
    map.set(name, MEMBER_COLORS[idx % MEMBER_COLORS.length]);
  });
  return map;
}
