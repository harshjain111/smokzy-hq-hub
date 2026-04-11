// Shared authorization helpers for admin-only edge functions.
//
// Every function that mutates user accounts or roles must call
// assertCallerIsAdmin() at the top of its handler. The caller's JWT is
// extracted from the Authorization header and resolved against the
// database (NOT trusted from claims) before any privileged action runs.
//
// Error strategy: throw AuthzError with a safe client-facing message and
// the appropriate HTTP status. Handlers catch it and return the status
// with the safe message only. Detailed reasons are logged server-side.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export const ALLOWED_ROLES = [
  "admin",
  "club_incharge",
  "club_management",
  "employee",
] as const;

export type AllowedRole = (typeof ALLOWED_ROLES)[number];

export class AuthzError extends Error {
  status: number;
  constructor(status: number, clientMessage: string, serverReason?: string) {
    super(clientMessage);
    this.status = status;
    this.name = "AuthzError";
    if (serverReason) {
      console.error(`[AUTHZ] ${status} ${clientMessage} — ${serverReason}`);
    } else {
      console.error(`[AUTHZ] ${status} ${clientMessage}`);
    }
  }
}

/**
 * Extract the caller's IP address from forwarded headers. Best-effort;
 * returns null if none of the usual headers are present.
 */
export function getClientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    null
  );
}

/**
 * Verify that the Authorization bearer token belongs to a user who has
 * an 'admin' row in user_roles. Returns the caller's id on success,
 * throws AuthzError(401|403) otherwise.
 *
 * IMPORTANT: role is resolved from the DB, not from JWT claims — so a
 * tampered client-side token cannot forge an admin identity.
 */
export async function assertCallerIsAdmin(
  req: Request,
  supabaseAdmin: SupabaseClient,
): Promise<{ callerId: string; ip: string | null }> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    throw new AuthzError(401, "Unauthorized", "missing or malformed Authorization header");
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new AuthzError(401, "Unauthorized", "empty bearer token");
  }

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) {
    throw new AuthzError(401, "Unauthorized", `getUser failed: ${userErr?.message ?? "no user"}`);
  }
  const callerId = userData.user.id;

  const { data: roleRow, error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "admin")
    .maybeSingle();

  if (roleErr) {
    throw new AuthzError(500, "Internal error", `user_roles lookup failed: ${roleErr.message}`);
  }
  if (!roleRow) {
    throw new AuthzError(403, "Forbidden", `caller ${callerId} is not admin`);
  }

  return { callerId, ip: getClientIp(req) };
}

/**
 * Validate a user-supplied role string against the hardcoded allowlist.
 */
export function assertValidRole(role: unknown): asserts role is AllowedRole {
  if (typeof role !== "string" || !ALLOWED_ROLES.includes(role as AllowedRole)) {
    throw new AuthzError(400, "Invalid role", `role=${JSON.stringify(role)}`);
  }
}

/**
 * Count the total number of admin rows in user_roles. Used to enforce
 * the "cannot demote or delete the last remaining admin" guard, which
 * prevents self-lockout.
 */
export async function countAdmins(supabaseAdmin: SupabaseClient): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) {
    throw new AuthzError(500, "Internal error", `countAdmins failed: ${error.message}`);
  }
  return count ?? 0;
}

/**
 * Fetch a user's current role, or null if none exists.
 */
export async function getCurrentRole(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new AuthzError(500, "Internal error", `getCurrentRole failed: ${error.message}`);
  }
  return data?.role ?? null;
}

/**
 * Structured audit log entry. Emitted via console.log with an
 * [ADMIN_AUDIT] prefix so it's greppable in Supabase edge function logs.
 * Replace with a real admin_audit_log table insert in Sprint 3.
 */
export interface AdminAuditEntry {
  action: "create_user" | "update_user" | "delete_user";
  caller_id: string;
  target_user_id: string | null;
  old_role?: string | null;
  new_role?: string | null;
  ip?: string | null;
  success: boolean;
  error?: string;
}

export function logAdminAudit(entry: AdminAuditEntry): void {
  console.log(
    `[ADMIN_AUDIT] ${JSON.stringify({ ...entry, timestamp: new Date().toISOString() })}`,
  );
}

/**
 * Convert a thrown error into a safe JSON Response. Unknown errors are
 * surfaced as a generic 500 with the real reason logged server-side.
 */
export function errorResponse(
  err: unknown,
  corsHeaders: Record<string, string>,
): Response {
  if (err instanceof AuthzError) {
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: err.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[UNHANDLED] ${msg}`);
  return new Response(
    JSON.stringify({ error: "Internal error" }),
    {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
