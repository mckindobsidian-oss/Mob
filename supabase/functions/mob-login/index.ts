const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const publicKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "apikey, authorization, content-type, x-client-info",
  "cache-control": "no-store",
};
const failure = { code: "invalid_credentials", message: "Credentials did not match." };
function json(value: unknown, status: number) {
  return Response.json(value, { status, headers: cors });
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return json(failure, 405);
  try {
    const input = await request.text();
    if (input.length > 4096) return json(failure, 400);
    const { username, password } = JSON.parse(input);
    if (typeof username !== "string" || !/^[a-z0-9][a-z0-9-]{2,23}$/.test(username) ||
        typeof password !== "string" || !password || password.length > 1024) return json(failure, 400);

    const lookup = await fetch(url + "/rest/v1/rpc/mob_login_email", {
      method: "POST",
      headers: { apikey: serviceKey, authorization: "Bearer " + serviceKey, "content-type": "application/json" },
      body: JSON.stringify({ p_username: username, p_network: request.headers.get("cf-connecting-ip") || "unknown" }),
    });
    if (!lookup.ok) return json({ code: "login_unavailable" }, 503);
    const email = await lookup.json();
    // Run the same password endpoint for unresolved usernames to reduce timing differences.
    const auth = await fetch(url + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: publicKey, "content-type": "application/json" },
      body: JSON.stringify({ email: email || "no-mob-account@example.invalid", password }),
    });
    if (!email || !auth.ok) return json(failure, 401);
    const { access_token, refresh_token } = await auth.json();
    return json({ access_token, refresh_token }, 200);
  } catch {
    return json({ code: "login_unavailable" }, 503);
  }
});
