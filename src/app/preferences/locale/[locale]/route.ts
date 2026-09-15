import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "en" && locale !== "ja") return new Response("Invalid locale", { status: 400 });

  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo") ?? "/";
  const destination = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  const host = request.headers.get("host") ?? url.host;
  const response = NextResponse.redirect(new URL(destination, `${url.protocol}//${host}`));
  response.cookies.set("github-monitor-locale", locale, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  return response;
}
