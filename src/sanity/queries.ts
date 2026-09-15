import { groq } from "next-sanity";

/**
 * Every query here runs on the server at build time or during revalidation.
 * None of them may be called from a client component.
 */

/** The singleton. */
export const PROFILE_QUERY = groq`
  *[_type == "profile"][0]{
    name,
    headline,
    location,
    intro,
    email,
    linkedin,
    github,
    "resumeUrl": resumeFile.asset->url,
    education[]{
      _key,
      qualification,
      institution,
      timeframe,
      location,
      result,
      notes
    },
    skillGroups[]{
      _key,
      label,
      items
    }
  }
`;

/**
 * Just enough to decide whether the Education nav item should exist.
 *
 * Its own query rather than reusing the profile: this runs in the layout, on
 * every route including the Studio, and pulling the whole profile plus its
 * rich text through there to answer one boolean would be wasteful.
 */
export const NAV_SECTIONS_QUERY = groq`
  *[_type == "profile"][0]{
    "hasEducation": count(education) > 0
  }
`;

/**
 * Index cards only. Bodies are deliberately not projected: the index has no
 * use for them, and fetching them would pull the whole site's prose into a
 * page that never renders it.
 */
export const CASE_STUDIES_QUERY = groq`
  *[_type == "caseStudy" && defined(slug.current)] | order(order asc){
    _id,
    title,
    "slug": slug.current,
    summary,
    stack,
    timeframe,
    client
  }
`;

/** One case study, with everything the detail page renders. */
export const CASE_STUDY_QUERY = groq`
  *[_type == "caseStudy" && slug.current == $slug][0]{
    _id,
    title,
    "slug": slug.current,
    client,
    role,
    timeframe,
    summary,
    stack,
    showPlatformSection,
    platforms[]{
      _key,
      label,
      description
    },
    sections[]{
      _key,
      heading,
      body
    },
    diagram->{
      title,
      altText,
      nodes[]{
        _key,
        id,
        label,
        sublabel,
        column,
        row
      },
      edges[]{
        _key,
        from,
        to,
        label,
        bidirectional
      }
    }
  }
`;

/** Slugs only, for generateStaticParams. */
export const CASE_STUDY_SLUGS_QUERY = groq`
  *[_type == "caseStudy" && defined(slug.current)]{
    "slug": slug.current
  }
`;
