import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy /api/* and /uploads/* to the FastAPI backend.
 * In production (Electron) LW_API_PORT is injected by the main process.
 * In development it defaults to 8000 (the uvicorn default).
 */
export function proxy(request: NextRequest) {
  const apiPort = process.env.LW_API_PORT ?? "8000";
  const { pathname, search } = request.nextUrl;
  const target = `http://127.0.0.1:${apiPort}${pathname}${search}`;
  return NextResponse.rewrite(new URL(target));
}

export const config = {
  matcher: ["/api/:path*", "/uploads/:path*"],
};
