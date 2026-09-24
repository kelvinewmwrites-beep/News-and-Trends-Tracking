export type SegmentId =
  | "company-incorporation"
  | "corporate-secretary"
  | "grant-advisory"
  | "managed-legal-grc"
  | "accounting-tax";

export interface SegmentDef {
  id: SegmentId;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  /** Free-text search queries fed into Google News RSS (Singapore edition). */
  queries: string[];
  /**
   * Whole words (case-insensitive) that assign a WATCHED_SITES post to this segment by title.
   * A trailing "*" matches as a prefix, e.g. "incorporat*".
   */
  matchTerms: string[];
  /** Extra keywords used to boost trend relevance / fallback content ideas. */
  keywords: string[];
}

// Google News ranks plain queries by relevance, so most results are months old;
// the when: operator restricts results to recent coverage.
const RECENT = "when:30d";

/** Practitioner sites (guides, regulatory explainers) scanned in full and routed to segments by title. */
export const WATCHED_SITES = [
  { domain: "rafflescorporateservices.com", source: "Raffles Corporate Services" },
];

export function watchedSiteQuery(domain: string): string {
  return `site:${domain} ${RECENT}`;
}

export const SEGMENTS: SegmentDef[] = [
  {
    id: "company-incorporation",
    label: "Company Incorporation",
    shortLabel: "Incorporation",
    description: "Business registration, ACRA filings, and company setup in Singapore.",
    color: "#2563eb",
    queries: [
      "Singapore company incorporation",
      "ACRA business registration Singapore",
      "start a company Singapore foreigner",
      "ACRA companies act amendment",
      `Singapore company incorporation ${RECENT}`,
      `ACRA Singapore ${RECENT}`,
    ],
    matchTerms: [
      "incorporat*", "acra", "bizfile", "register", "registration", "company formation",
      "set up", "setup", "setting up", "pte ltd", "subsidiar*", "redomicil*", "relocat*",
      "business name*", "share capital", "sole proprietor*", "partnership", "family office*",
      "sfo", "global investor programme", "gip", "employment pass", "ep", "work pass*", "compass",
    ],
    keywords: [
      "incorporation",
      "acra",
      "bizfile",
      "shell company",
      "shareholder",
      "nominee director",
      "company registration",
      "sole proprietorship",
      "pte ltd",
    ],
  },
  {
    id: "corporate-secretary",
    label: "Corporate Secretary",
    shortLabel: "Corp Sec",
    description: "Company secretarial compliance, statutory filings, and governance duties.",
    color: "#7c3aed",
    queries: [
      "corporate secretary Singapore",
      "company secretary compliance Singapore",
      "ACRA annual return filing Singapore",
      "Singapore company secretarial services",
      `corporate secretary Singapore ${RECENT}`,
      `ACRA directors governance ${RECENT}`,
    ],
    matchTerms: [
      "secretar*", "agm", "annual general meeting", "director*", "annual return",
      "shareholder*", "constitution", "vcc", "registrable controller*", "nominee*",
      "general meeting", "resolution*", "shares", "companies act", "company chop",
      "indoor management", "winding up",
    ],
    keywords: [
      "company secretary",
      "annual return",
      "agm",
      "statutory compliance",
      "acra filing",
      "corporate governance",
      "board resolution",
      "registered office",
    ],
  },
  {
    id: "grant-advisory",
    label: "Grant Advisory",
    shortLabel: "Grants",
    description: "Government grants, SME funding schemes, and enterprise support in Singapore.",
    color: "#059669",
    queries: [
      "Singapore government grant SME",
      "Enterprise Singapore grant scheme",
      "Singapore Budget SME support grant",
      "SkillsFuture Enterprise Credit Singapore",
      "EDGE grant Singapore",
      `Business Grants Portal Singapore ${RECENT}`,
      `Enterprise Singapore ${RECENT}`,
      `"Enterprise Development Grant" OR "Productivity Solutions Grant" OR "Market Readiness Assistance" ${RECENT}`,
    ],
    matchTerms: [
      "grant*", "edge", "psg", "edg", "mra", "funding", "subsid*", "skillsfuture",
      "sfec", "enterprise singapore",
    ],
    keywords: [
      "grant",
      "enterprise singapore",
      "edge grant",
      "business grants portal",
      "enterprise development grant",
      "psg",
      "productivity solutions grant",
      "skillsfuture",
      "sfec",
      "eds grant",
      "market readiness assistance",
      "sme funding",
      "subsidy",
    ],
  },
  {
    id: "managed-legal-grc",
    label: "Managed Legal (DPO, Risk & GRC)",
    shortLabel: "Legal & GRC",
    description: "Data protection officer services, risk management, and governance/compliance in Singapore.",
    color: "#dc2626",
    queries: [
      "PDPA Singapore data protection",
      "Data Protection Officer Singapore",
      "Singapore compliance risk management regulation",
      "Singapore cybersecurity regulation business",
      `PDPC Singapore ${RECENT}`,
      `Singapore AI governance regulation ${RECENT}`,
      `MAS guidelines compliance ${RECENT}`,
    ],
    matchTerms: [
      "pdpa", "pdpc", "data protection", "compliance", "risk", "governance", "mas",
      "licen*", "aml", "cyber*", "injunction*", "regulat*", "legal", "sanction*",
      "sghc", "sgca", "court", "ruling", "judicata", "arbitra*", "ccs", "infringement",
      "damages", "exemption", "winding up",
    ],
    keywords: [
      "pdpa",
      "data protection officer",
      "pdpc",
      "grc",
      "risk management",
      "compliance",
      "data breach",
      "cybersecurity act",
      "governance",
    ],
  },
  {
    id: "accounting-tax",
    label: "Accounting & Tax",
    shortLabel: "Accounting & Tax",
    description: "IRAS updates, corporate tax, GST, and accounting standards in Singapore.",
    color: "#d97706",
    queries: [
      "IRAS Singapore tax",
      "Singapore corporate tax filing",
      "Singapore GST rate update",
      "Singapore accounting standards compliance",
      `IRAS Singapore tax ${RECENT}`,
      `Singapore GST ${RECENT}`,
      `Singapore corporate tax ${RECENT}`,
    ],
    matchTerms: [
      "tax*", "gst", "iras", "accounting", "audit*", "xbrl", "financial statement*",
      "transfer pricing", "section 13*", "stamp*", "margins",
    ],
    keywords: [
      "iras",
      "gst",
      "corporate tax",
      "tax filing",
      "withholding tax",
      "abss",
      "xbrl",
      "tax exemption",
      "accounting standards",
    ],
  },
];

export const SEGMENT_MAP: Record<SegmentId, SegmentDef> = Object.fromEntries(
  SEGMENTS.map((s) => [s.id, s])
) as Record<SegmentId, SegmentDef>;

function termRegex(term: string): RegExp {
  const prefix = term.endsWith("*");
  const escaped = term.replace(/\*$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}${prefix ? "" : "\\b"}`, "i");
}

const SEGMENT_MATCHERS = SEGMENTS.map((s) => ({ id: s.id, patterns: s.matchTerms.map(termRegex) }));

export function matchSegments(title: string): SegmentId[] {
  return SEGMENT_MATCHERS.filter((m) => m.patterns.some((p) => p.test(title))).map((m) => m.id);
}

export function isSegmentId(value: string): value is SegmentId {
  return SEGMENT_MAP[value as SegmentId] !== undefined;
}
