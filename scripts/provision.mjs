// Idempotent provisioning of Courant's Cloudflare resources (D1, R2, KV, Rate Limiting).
// Reads credentials from a 0600 env file (CF_ENV_FILE) or CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID.
//
//   node scripts/provision.mjs --env prod     # or: staging
//
// Never deletes anything. Writes discovered ids back into wrangler.jsonc (PENDING_ placeholders).
import { readFile, writeFile } from "node:fs/promises";
import { stat } from "node:fs";
import { resolve } from "node:path";

const ACCOUNT_ID = "6d5166b8b31547608cbbba06affc288b";

const envName = process.argv.includes("--env") ? process.argv[process.argv.indexOf("--env") + 1] : "prod";
if (!["prod", "staging"].includes(envName)) throw new Error("--env prod|staging required");

const prefix = envName === "prod" ? "courant" : "courant-staging";
const dbName = envName === "prod" ? "courant-prod" : "courant-staging";
const bucketName = `${prefix}-assets`;
const kvTitle = `${prefix}-cache`;

async function credentials() {
  let token = process.env.CLOUDFLARE_API_TOKEN;
  let account = process.env.CLOUDFLARE_ACCOUNT_ID ?? ACCOUNT_ID;
  const envFile = process.env.CF_ENV_FILE;
  if (envFile) {
    const info = await stat(envFile);
    if ((info.mode & 0o077) !== 0) throw new Error("CF_ENV_FILE must be mode 0600");
    for (const raw of (await readFile(envFile, "utf8")).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
      if (!m) continue;
      if (m[1] === "CLOUDFLARE_API_TOKEN") token = m[2];
      if (m[1] === "CLOUDFLARE_ACCOUNT_ID") account = m[2];
    }
  }
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN required (or CF_ENV_FILE)");
  if (account !== ACCOUNT_ID) throw new Error(`Unexpected account ${account}`);
  return { token, account };
}

async function api(token, account, path, method = "GET", body) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok || data.success !== true)
    throw new Error(`${method} ${path}: ${JSON.stringify(data.errors)}`);
  return data.result;
}

async function listAll(token, account, path) {
  const items = [];
  for (let page = 1; ; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const result = await api(token, account, `${path}${sep}page=${page}&per_page=100`);
    items.push(...(Array.isArray(result) ? result : result.buckets ?? []));
    if (!Array.isArray(result) || result.length < 100) return items;
  }
}

const { token, account } = await credentials();

// D1
let db = (await listAll(token, account, "/d1/database")).find((d) => d.name === dbName);
if (!db) db = await api(token, account, "/d1/database", "POST", { name: dbName });

// R2
let buckets = await listAll(token, account, "/r2/buckets");
if (!buckets.some((b) => b.name === bucketName)) {
  await api(token, account, "/r2/buckets", "POST", { name: bucketName });
}

// KV
let kv = (await listAll(token, account, "/storage/kv/namespaces")).find((n) => n.title === kvTitle);
if (!kv) kv = await api(token, account, "/storage/kv/namespaces", "POST", { title: kvTitle });

const result = { account_id: account, env: envName, database_name: dbName, database_id: db.uuid, bucket: bucketName, kv_title: kvTitle, kv_id: kv.id };

// Write ids back into wrangler.jsonc (PENDING_ placeholders).
const configPath = resolve(import.meta.dirname, "../wrangler.jsonc");
let config = await readFile(configPath, "utf8");
config = config.replaceAll("PENDING_D1_ID", db.uuid).replaceAll("PENDING_KV_ID", kv.id);
await writeFile(configPath, config);

console.log(JSON.stringify(result, null, 2));
console.log("Wrote ids into wrangler.jsonc. Rate-limit namespace_id still PENDING (dashboard-created).");