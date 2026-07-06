import request from "supertest";
import { jest } from "@jest/globals";

const mockFrom = jest.fn();

const buildChainableQuery = (overrides = {}) => {
    const createThenable = (extra = {}) => {
        const resolved = extra.resolveWith || overrides.default || { data: [], error: null };
        const promise = Promise.resolve(resolved);
        const thenable = {
            then: promise.then.bind(promise),
            select: jest.fn().mockImplementation(() => createThenable(extra)),
            eq: jest.fn().mockImplementation(() => createThenable(extra)),
            insert: jest.fn().mockImplementation(() => Promise.resolve(overrides.insert || { error: null })),
            delete: jest.fn().mockImplementation(() => createThenable(extra)),
            maybeSingle: jest.fn().mockImplementation(() => Promise.resolve(overrides.maybeSingle || { data: null, error: null })),
        };
        return thenable;
    };
    return createThenable();
};

jest.unstable_mockModule("../supabaseClient.js", () => ({
    supabase: {
        from: mockFrom,
    },
}));

jest.unstable_mockModule("../server/middleware/authMiddleware.js", () => ({
    default: (req, res, next) => {
        req.user = { id: "user-001" };
        next();
    }
}));

const { default: app } = await import("../server/app.js");

let supabaseOverrides = {};

beforeEach(() => {
    jest.clearAllMocks();
    supabaseOverrides = {};
    mockFrom.mockImplementation(() => buildChainableQuery(supabaseOverrides));
});

describe("GET /communities", () => {
    it("returns list of communities", async () => {
        supabaseOverrides.default = {
            data: [{ id: "c1", name: "c1" }],
            error: null
        };

        const res = await request(app).get("/communities");

        expect(res.status).toBe(200);
        expect(res.body).toEqual([{ id: "c1", name: "c1" }]);
    });

    it("returns 400 when fetch fails", async () => {
        supabaseOverrides.default = { data: null, error: { message: "DB error" } };

        const res = await request(app).get("/communities");

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("DB error");
    });
});

describe("GET /communities/fetchCommunityById/:communityId", () => {
    it("returns the community when found", async () => {
        supabaseOverrides.maybeSingle = {
            data: { id: "c1", name: "c1" },
            error: null
        };

        const res = await request(app).get("/communities/fetchCommunityById/c1");

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ id: "c1", name: "c1" });
    });

    it("returns 400 on error", async () => {
        supabaseOverrides.maybeSingle = {
            data: null,
            error: { message: "Not found" }
        };

        const res = await request(app).get("/communities/fetchCommunityById/c1");

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Not found");
    });
});

describe("GET /communities/following", () => {
    it("returns followed communities for the current user", async () => {
        supabaseOverrides.default = {
            data: [{ community_id: "c1", communities: { id: "c1", name: "c1" } }],
            error: null
        };

        const res = await request(app).get("/communities/following");

        expect(res.status).toBe(200);
        expect(res.body[0].community_id).toBe("c1");
    });

    it("returns 400 on error", async () => {
        supabaseOverrides.default = { data: null, error: { message: "Failed" } };

        const res = await request(app).get("/communities/following");

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Failed");
    });
});

describe("POST /communities/:id/follow", () => {
    it("follows a community successfully", async () => {
        supabaseOverrides.insert = { error: null };

        const res = await request(app).post("/communities/c1/follow");

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("Followed community successfully");
    });

    it("returns 400 when follow insert fails", async () => {
        supabaseOverrides.insert = { error: { message: "Already following" } };

        const res = await request(app).post("/communities/c1/follow");

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Already following");
    });
});

describe("DELETE /communities/:id/follow", () => {
    it("unfollows a community successfully", async () => {
        supabaseOverrides.default = { data: null, error: null };

        const res = await request(app).delete("/communities/c1/follow");

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("Unfollowed community successfully");
    });

    it("returns 400 when unfollow fails", async () => {
        supabaseOverrides.default = { data: null, error: { message: "Unfollow failed" } };

        const res = await request(app).delete("/communities/c1/follow");

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Unfollow failed");
    });
});

describe("POST /communities/requestNewCommunity", () => {
    it("submits a community request successfully", async () => {
        supabaseOverrides.insert = { error: null };

        const res = await request(app)
            .post("/communities/requestNewCommunity")
            .send({ name: "Test Community", description: "A test community", category: "Study" });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("Community request submitted successfully");
    });

    it("returns 400 when name is missing", async () => {
        const res = await request(app)
            .post("/communities/requestNewCommunity")
            .send({ description: "A test community", category: "Study" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("name, description, and category are required");
    });

    it("returns 400 when description is missing", async () => {
        const res = await request(app)
            .post("/communities/requestNewCommunity")
            .send({ name: "Test Community", category: "Study" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("name, description, and category are required");
    });

    it("returns 400 when category is missing", async () => {
        const res = await request(app)
            .post("/communities/requestNewCommunity")
            .send({ name: "Test Community", description: "A test community" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("name, description, and category are required");
    });

    it("returns 400 when insert fails", async () => {
        supabaseOverrides.insert = { error: { message: "DB error" } };

        const res = await request(app)
            .post("/communities/requestNewCommunity")
            .send({ name: "Test Community", description: "A test community", category: "Study" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("DB error");
    });
});
