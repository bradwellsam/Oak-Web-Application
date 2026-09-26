import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  MiddlewareConfig,
  NextFetchEvent,
  NextRequest,
  NextResponse,
} from "next/server";

import { getSeoRedirectUrl } from "@/utils/integratedJourney/seoRedirects";

export default async function middleware(
  req: NextRequest,
  event: NextFetchEvent,
) {
  // SEO redirect ticket: legacy `/teachers/curriculum/{slug}/units` and
  // `/teachers/key-stages/…/subjects/…` URLs become a single permanent
  // redirect to the current programme page (thread parameters dropped).
  // See src/utils/integratedJourney/seoRedirects.ts.
  const seoRedirect = getSeoRedirectUrl(req.nextUrl);
  if (seoRedirect) {
    return NextResponse.redirect(seoRedirect, 308);
  }

  // Teacher pages don't need Clerk (see note below) – fall through untouched.
  if (req.nextUrl.pathname.startsWith("/teachers/")) {
    return NextResponse.next();
  }

  return clerkMiddleware()(req, event);
}

/**
 * Clerk middleware causes page latency, we're only enabling it for API routes or pages where
 * we need to access the user session in the backend
 */

export const config: MiddlewareConfig = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    //"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // API routes except /api/classroom/* which is used for Google Classroom Add-on
    "/(api|trpc)((?!/classroom))(.*)",
    // SEO redirects (no Clerk on these – see middleware body)
    "/teachers/curriculum/:path*",
    "/teachers/key-stages/:path*",
  ],
};
