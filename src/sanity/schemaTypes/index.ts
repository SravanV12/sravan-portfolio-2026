import type { SchemaTypeDefinition } from "sanity";
import { architectureDiagram } from "./architectureDiagram";
import { caseStudy } from "./caseStudy";
import {
  caseStudySection,
  diagramEdge,
  diagramNode,
  platform,
  skillGroup,
} from "./objects";
import { profile } from "./profile";
import { richText } from "./richText";

/** Document types that may only ever have one instance. */
export const singletonTypes = new Set(["profile"]);

export const schemaTypes: SchemaTypeDefinition[] = [
  // Documents
  profile,
  caseStudy,
  architectureDiagram,
  // Objects
  richText,
  skillGroup,
  caseStudySection,
  platform,
  diagramNode,
  diagramEdge,
];
