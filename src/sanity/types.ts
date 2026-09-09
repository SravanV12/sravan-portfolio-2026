/**
 * Hand-written to match the projections in queries.ts. They live next to the
 * queries so a change to one is an obvious prompt to change the other.
 *
 * Fields are optional wherever the schema does not guarantee them, so the
 * pages are forced to handle content that has not been filled in yet.
 */

export type PortableTextSpan = {
  _type: string;
  _key: string;
  text?: string;
  marks?: string[];
};

export type PortableTextMarkDef = {
  _type: string;
  _key: string;
  href?: string;
};

export type PortableTextBlock = {
  _type: string;
  _key: string;
  style?: string;
  listItem?: string;
  level?: number;
  children?: PortableTextSpan[];
  markDefs?: PortableTextMarkDef[];
};

export type SkillGroup = {
  label?: string;
  items?: string[];
};

export type Profile = {
  name?: string;
  headline?: string;
  location?: string;
  intro?: PortableTextBlock[];
  email?: string;
  linkedin?: string;
  github?: string;
  resumeUrl?: string;
  skillGroups?: SkillGroup[];
};

/** The index-card projection. Intentionally has no body. */
export type CaseStudyCard = {
  _id: string;
  title?: string;
  slug?: string;
  summary?: string;
  stack?: string[];
  timeframe?: string;
  client?: string;
};

export type CaseStudySection = {
  heading?: string;
  body?: PortableTextBlock[];
};

export type Platform = {
  label?: string;
  description?: string;
};

export type DiagramNode = {
  id?: string;
  label?: string;
  sublabel?: string;
  column?: number;
  row?: number;
};

export type DiagramEdge = {
  from?: string;
  to?: string;
  label?: string;
  bidirectional?: boolean;
};

export type ArchitectureDiagram = {
  title?: string;
  altText?: string;
  nodes?: DiagramNode[];
  edges?: DiagramEdge[];
};

export type CaseStudy = {
  _id: string;
  title?: string;
  slug?: string;
  client?: string;
  role?: string;
  timeframe?: string;
  summary?: string;
  stack?: string[];
  showPlatformSection?: boolean;
  platforms?: Platform[];
  sections?: CaseStudySection[];
  diagram?: ArchitectureDiagram | null;
};

export type CaseStudySlug = {
  slug?: string;
};
