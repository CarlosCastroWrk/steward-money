import { NextResponse } from "next/server";

// Intentionally unauthenticated: returns only public config info (app URL, whether
// NEXT_PUBLIC_GOOGLE_CLIENT_ID is set). No user data is exposed.
export async function GET() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return NextResponse.json({
    client_id_set: clientId ? "yes" : "no",
    client_id_prefix: clientId ? clientId.slice(0, 20) + "..." : "(not set)",
    app_url: appUrl || "(not set)",
    // The JavaScript origins that MUST be registered in Google Cloud Console:
    required_javascript_origins: appUrl
      ? [appUrl, appUrl.replace(/\/$/, "")]
      : ["(NEXT_PUBLIC_APP_URL not set)"],
    // There is no redirect_uri — this app uses the GSI implicit token flow,
    // which only requires JavaScript Origins (not OAuth redirect URIs).
    flow: "GSI implicit token (initTokenClient)",
    instructions: [
      "1. Open console.cloud.google.com → APIs & Services → Credentials",
      "2. Click your OAuth 2.0 Client ID",
      "3. Under 'Authorized JavaScript origins', add the value in required_javascript_origins",
      "4. Save and wait ~5 minutes for Google to propagate",
    ],
  });
}
