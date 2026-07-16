import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../.env.test") });

const { default: supertest } = await import("supertest");
const { default: app } = await import("../../server/app.js");
const request = supertest(app);

const ts = Date.now();
const emailA = `e2e-a-${ts}@test.com`;
const password = "testpass123";

// Register
const reg = await request.post("/register").send({ email: emailA, password });
console.log("REGISTER:", reg.status, JSON.stringify(reg.body));

const token = (await request.post("/login").send({ email: emailA, password })).body.token;

// Profile
await request.post("/profileCreation")
    .set("Authorization", `Bearer ${token}`)
    .send({ username: `userA-${ts}`, major: "CS", year: "3" });

// Try creating a post without communityId
const post1 = await request.post("/posts")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Test post", description: "Test description" });
console.log("CREATE POST (no category):", post1.status, JSON.stringify(post1.body));

// Maybe it needs category?
const post2 = await request.post("/posts")
    .set("Authorization", `Bearer ${token}`)
    .send({ title: "Test post", description: "Test description", category: "Study" });
console.log("CREATE POST (with category):", post2.status, JSON.stringify(post2.body));
