import { config } from "dotenv";

// Integration tests need the local Supabase keys. Load .env.local first
// (developer machine) and fall back to .env for CI. Missing values are handled
// per-test by skipping integration suites, so we never throw here.
config({ path: ".env.local" });
config({ path: ".env" });
