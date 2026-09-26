import getBrowserConfig from "@/browser-lib/getBrowserConfig";

/**
 * Absolute canonical URL for an internal path (`/teachers/programmes/…`).
 * Falls back to the path itself when `seoAppUrl` is not a usable base (tests,
 * local builds without the env), which Next resolves as a relative canonical.
 */
export function canonicalUrl(path: string): string {
  try {
    return new URL(path, getBrowserConfig("seoAppUrl")).toString();
  } catch {
    return path;
  }
}
