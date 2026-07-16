import supertest from "supertest";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../.env.test") });

const SUPABASE_URL = process.env.SUPABASE_URL_TEST;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY_TEST;

let app;
try {
    app = (await import("../../server/app.js")).default;
} catch (e) {
    console.error("Failed to import app:", e.message);
}

const request = app ? supertest(app) : null;

const hasSupabaseConfig = SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith("http");
const itWhenConfigured = hasSupabaseConfig && request ? test : test.skip;

describe("E2E: Core user flow smoke test", () => {
    const ts = Date.now();
    const emailA = `e2e-a-${ts}@test.com`;
    const emailB = `e2e-b-${ts}@test.com`;
    const password = "testpass123";
    const usernameA = `userA-${ts}`;
    const usernameB = `userB-${ts}`;

    let userAId, userAToken;
    let userBId, userBToken;
    let postId, requestId;

    beforeAll(() => {
        if (!hasSupabaseConfig || !request) {
            console.warn("Skipping e2e smoke tests: SUPABASE_URL_TEST not configured");
        }
    });

    afterAll(async () => {
        if (hasSupabaseConfig) {
            const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
            for (const id of [userAId, userBId].filter(Boolean)) {
                await supabase.from("profiles").delete().eq("id", id);
                try { await supabase.auth.admin.deleteUser(id); } catch { }
            }
        }
    });

    itWhenConfigured("should register user A", async () => {
        const res = await request.post("/register").send({ email: emailA, password });
        expect(res.status).toBe(200);
        expect(res.body.user).toBeDefined();
        userAId = res.body.user.id;
    });

    itWhenConfigured("should login as user A", async () => {
        const res = await request.post("/login").send({ email: emailA, password });
        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        userAToken = res.body.token;
    });

    itWhenConfigured("should create profile for user A", async () => {
        const res = await request
            .post("/profileCreation")
            .set("Authorization", `Bearer ${userAToken}`)
            .send({ username: usernameA, major: "CS", year: "3" });
        expect(res.status).toBe(200);
    });

    itWhenConfigured("should register user B", async () => {
        const res = await request.post("/register").send({ email: emailB, password });
        expect(res.status).toBe(200);
        expect(res.body.user).toBeDefined();
        userBId = res.body.user.id;
    });

    itWhenConfigured("should login as user B", async () => {
        const res = await request.post("/login").send({ email: emailB, password });
        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        userBToken = res.body.token;
    });

    itWhenConfigured("should create profile for user B", async () => {
        const res = await request
            .post("/profileCreation")
            .set("Authorization", `Bearer ${userBToken}`)
            .send({ username: usernameB, major: "EE", year: "2" });
        expect(res.status).toBe(200);
    });

    itWhenConfigured("should create a post as user A", async () => {
        const res = await request
            .post("/posts")
            .set("Authorization", `Bearer ${userAToken}`)
            .send({ title: "E2E: study buddy", description: "Looking for a study partner" });
        expect(res.status).toBe(200);
        expect(res.body.data).toBeDefined();
        postId = res.body.data.id;
    });

    itWhenConfigured("should allow user B to request join", async () => {
        const res = await request
            .post(`/posts/${postId}/request`)
            .set("Authorization", `Bearer ${userBToken}`)
            .send({ message: "I'd like to join!" });
        expect(res.status).toBe(200);
    });

    itWhenConfigured("should show pending request to user A", async () => {
        const res = await request
            .get(`/posts/${postId}/requests/pending`)
            .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
        requestId = res.body[0].id;
    });

    itWhenConfigured("should accept user B's join request", async () => {
        const res = await request
            .patch(`/posts/requests/${requestId}`)
            .set("Authorization", `Bearer ${userAToken}`)
            .send({ status: "accepted" });
        expect(res.status).toBe(200);
    });

    itWhenConfigured("should reflect accepted status for user B", async () => {
        const res = await request
            .get(`/posts/${postId}/request/status`)
            .set("Authorization", `Bearer ${userBToken}`);
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("accepted");
    });

    itWhenConfigured("should show the DM conversation for user A", async () => {
        const res = await request
            .get("/chats/conversations")
            .set("Authorization", `Bearer ${userAToken}`);
        expect(res.status).toBe(200);
        const convWithB = res.body.find(c => c.other_user_id === userBId);
        expect(convWithB).toBeDefined();
    });
});
