// Shared authentication for the Smokzy Inventory integration endpoints.
// Uses a pre-shared API key (INVENTORY_API_KEY env var) verified via Bearer token.
// This is server-to-server auth — separate from user JWT authentication.

export class IntegrationAuthError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "IntegrationAuthError";
  }
}

export function assertInventoryApiKey(req: Request): void {
  const apiKey = Deno.env.get("INVENTORY_API_KEY");
  if (!apiKey) {
    console.error("[INVENTORY_AUTH] INVENTORY_API_KEY is not configured");
    throw new IntegrationAuthError(
      503,
      "SERVICE_UNAVAILABLE",
      "Integration is not configured.",
    );
  }

  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    throw new IntegrationAuthError(
      401,
      "UNAUTHORIZED",
      "Missing or malformed Authorization header. Expected: Bearer <API_KEY>",
    );
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new IntegrationAuthError(
      401,
      "UNAUTHORIZED",
      "Empty bearer token.",
    );
  }

  if (!timingSafeEqual(token, apiKey)) {
    throw new IntegrationAuthError(
      401,
      "UNAUTHORIZED",
      "Invalid API key.",
    );
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);
  let diff = 0;
  for (let i = 0; i < aBuf.length; i++) {
    diff |= aBuf[i] ^ bBuf[i];
  }
  return diff === 0;
}

export function inventoryCorsHeaders(req: Request): Record<string, string> {
  const allowedOrigin = Deno.env.get("INVENTORY_ALLOWED_ORIGIN") || "";
  const origin = req.headers.get("origin") || "";

  const effectiveOrigin =
    allowedOrigin && origin === allowedOrigin ? allowedOrigin : "";

  return {
    "Access-Control-Allow-Origin": effectiveOrigin,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

export function inventoryErrorResponse(
  err: unknown,
  corsHeaders: Record<string, string>,
): Response {
  if (err instanceof IntegrationAuthError) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: err.code, message: err.message },
      }),
      {
        status: err.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[INVENTORY_UNHANDLED] ${msg}`);
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    }),
    {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
