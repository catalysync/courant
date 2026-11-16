import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./database/schema.ts",
  out: "./migrations",
  dbCredentials: {
    // D1 only needs the URL for `drizzle-kit studio`; migrations are generated offline.
    url: process.env.DATABASE_URL ?? ":memory:",
  },
});