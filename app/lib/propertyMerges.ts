/**
 * Properties that Lilo lists separately but which are really one hotel —
 * per-department accounts, or two brands sharing a single building.
 *
 * The merge is applied when data is READ, never written back, so the stored
 * orders keep Lilo's original names and any merge can be undone by deleting
 * its rule here.
 */

export interface MergeRule {
  /** The name the merged hotel is shown under. */
  canonical: string;
  /** Exact property names that collapse into `canonical`. */
  aliases?: string[];
  /**
   * Collapse every property whose name starts with this. Used for hotels split
   * into department accounts, so a department added later merges on its own.
   */
  prefix?: string;
}

export const PROPERTY_MERGES: MergeRule[] = [
  {
    // Seven department accounts: Banquet, F&B, Rooms, Starbucks,
    // Repairs & Maintenance, Shop, General & Admin.
    canonical: 'The Westin Raleigh Durham Airport',
    prefix: 'The Westin Raleigh Durham Airport',
  },
  {
    // One dual-brand building; both brands share a go-live date.
    canonical: 'Home2 Suites & Tru by Hilton Houston Downtown Convention Center',
    aliases: [
      'Home2 Suites Houston Downtown Convention Center',
      'Tru by Hilton Houston Downtown Convention Center',
    ],
  },
  {
    // Two lodging types at one resort, sharing a go-live date. Listed by name
    // rather than by prefix so a genuinely separate Sundance property would
    // not be swept in on its own.
    canonical: 'Sundance Mountain Resort',
    aliases: [
      'Sundance Mountain Resort Inn',
      'Sundance Mountain Resort Cottages',
    ],
  },
];

const exactAliases = new Map<string, string>();
for (const rule of PROPERTY_MERGES) {
  for (const alias of rule.aliases ?? []) {
    exactAliases.set(alias.trim().toLowerCase(), rule.canonical);
  }
}

const prefixRules = PROPERTY_MERGES.filter((r) => r.prefix).map((r) => ({
  canonical: r.canonical,
  prefix: r.prefix!.trim().toLowerCase(),
}));

/**
 * The name a property should be reported under. Returns the input unchanged
 * when no merge rule applies.
 */
export function canonicalProperty(property: string): string {
  const name = (property ?? '').trim();
  if (!name) return property;

  const key = name.toLowerCase();
  const exact = exactAliases.get(key);
  if (exact) return exact;

  for (const rule of prefixRules) {
    if (key === rule.prefix || key.startsWith(rule.prefix)) return rule.canonical;
  }

  return name;
}

/** True when this property name is produced by a merge rule. */
export function isMergedProperty(property: string): boolean {
  return PROPERTY_MERGES.some((r) => r.canonical === property);
}
