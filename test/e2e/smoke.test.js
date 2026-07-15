import { jest } from "@jest/globals";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../.env.test") });

const SUPABASE_URL = process.env.SUPABASE_URL_TEST;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY_TEST;

let request;

beforeAll(async () => {
  // Dynamic import of supertest
  const supertest = (await import("supertest")).default;
  const { default: app } = await import("../../server/app.js");
  request = supertest(app);
});

const hasSupabaseConfig = SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith("http");

const itWhenConfigured = hasSupabaseConfig ? test : test.skip;

describe("E2E: Core user flow smoke test", () => {
  let userAToken, userBToken;
  let userAId, userBId;
  let postId, requestId;

  beforeAll(() => {
    if (!hasSupabaseConfig) {
      console.warn("Skipping e2e smoke tests: SUPABASE_URL_TEST not configured. Set up a test Supabase project and populate .env.test.");
    }
  });

  afterAll(async () => {
    // Cleanup: delete test data via Supabase admin
    if (hasSupabaseConfig) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
      if (userAId) {
        await supabase.from("profiles").delete().eq("id", userAId);
        await supabase.auth.admin.deleteUser(userAId);
      }
      if (userBId) {
        await supabase.from("profiles").delete().eq("id", userBId);
        await supabase.auth.admin.deleteUser(userBId);
      }
    }
  });

  // The full e2e flow: register A → login A → create profile A → register B →
  // login B → create profile B → A creates post → B requests join →
  // A accepts request → verify conversation thread exists
  //
  // Requires a test Supabase project. Complete these tests after provisioning.

  itWhenConfigured("register user A", async () => {
    const res = await request
      .post("/register")
      .send({ email: `e2e-test-a-${Date.now()}@test.com`, password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    userAId = res.body.user.id;
  });

  itWhenConfigured("login user A and verify token", async () => {
    const res = await request
      .post("/login")
      .send({ email: `e2e-test-a-${Date.now()}@test.com`, password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    userAToken = res.body.token;
  });
});
