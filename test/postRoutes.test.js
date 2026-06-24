import request from "supertest";
import { describe, expect, jest } from "@jest/globals";

const mockFrom = jest.fn();
const mockStorageFrom = jest.fn();
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockRpc = jest.fn();
const mockSendPushNotification = jest.fn();

// Mock Supabase client
jest.unstable_mockModule("../supabaseClient.js", () => ({
    supabase: {
        from: mockFrom,
        storage: { from: mockStorageFrom },
        rpc: mockRpc,
    },
}));

// Mock auth middleware
jest.unstable_mockModule("../server/middleware/authMiddleware.js", () => ({
    default: (req, res, next) => {
        req.user = { id: "user-001" };
        next();
    }
}))

jest.unstable_mockModule("../server/utils/sendPushNotification.js", () => ({
    sendPushNotification: mockSendPushNotification,
}));

const { default: app } = await import("../server/app.js");

beforeEach(() => {
    jest.clearAllMocks();
    mockStorageFrom.mockImplementation(() => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
    }));
})

describe("POST /posts for create and update", () => {
    it("creates a new post successfully", async () => {
        const single = jest.fn().mockResolvedValue({
            data: { id: 'post-1', title: 'title-1' },
            error: null,
        });

        const select = jest.fn().mockReturnValue({ single });
        const upsert = jest.fn().mockReturnValue({ select });
        mockFrom.mockReturnValue({ upsert });

        const res = await request(app).post("/posts").send({
            communityId: "community-1",
            title: "title-1",
            description: "description-1",
        });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("Post saved successfully");
        expect(res.body.data.id).toBe("post-1");
    });

    it("returns 404 when editing a post that does not exists", async () => {
        const fetchSingle = jest.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
        const fetchEq = jest.fn().mockReturnValue({ single: fetchSingle });
        const fetchSelect = jest.fn().mockReturnValue({ eq: fetchEq });
        mockFrom.mockReturnValue({ select: fetchSelect });

        const res = await request(app).post("/posts").send({
            postId: "nope",
            title: "nope",
        });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("Post not found");
    });

    it("returns 400 when upsert fails", async () => {
        const single = jest.fn().mockResolvedValue({ data: null, error: { message: "Insert failed" } });
        const select = jest.fn().mockReturnValue({ single });
        const upsert = jest.fn().mockReturnValue({ select });
        mockFrom.mockReturnValue({ upsert });

        const res = await request(app).post("/posts").send({ title: "Bad post" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Insert failed");
    });
});

describe("GET /posts", () => {
    it("returns posts ordered by created date", async () => {
        const order = jest.fn().mockResolvedValue({
            data: [{ id: 'post-1' }, { id: 'post-2' }],
            error: null,
        });

        const select = jest.fn().mockReturnValue({ order });
        mockFrom.mockReturnValue({ select });

        const res = await request(app).get("/posts");

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    });
});

describe("GET /posts/saved", () => {

    it("returns the user's saved posts", async () => {
        const eq = jest.fn().mockResolvedValue({
            data: [{ post_id: 'post-1', posts: { id: 'post-1' } }],
            error: null,
        });

        const select = jest.fn().mockReturnValue({ eq });
        mockFrom.mockReturnValue({ select });

        const res = await request(app).get("/posts/saved");

        expect(res.status).toBe(200);
        expect(res.body[0].post_id).toBe("post-1");
    });
});

describe("POST /posts/uploadPostImage", () => {

    it("returns 400 when no file is uploaded", async () => {
        const res = await request(app).post("/posts/uploadPostImage");

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("No file uploaded");
    });

    it("uploads an image and returns its public URL", async () => {
        mockUpload.mockResolvedValue({ error: null });
        mockGetPublicUrl.mockReturnValue({
            data: { publicUrl: "http://xn.jpg" }
        });

        const res = await request(app)
            .post("/posts/uploadPostImage")
            .attach("postFile", Buffer.from("fake image"), {
                filename: "test.jpg",
                contentType: "image/jpeg",
            });

        expect(res.status).toBe(200);
        expect(res.body.imageUrl).toBe("http://xn.jpg");
    });

    it("returns 400 when the storage upload fails", async () => {
        mockUpload.mockResolvedValue({ error: { message: "Storage error" } });

        const res = await request(app)
            .post("/posts/uploadPostImage")
            .attach("postFile", Buffer.from("fake image"), {
                filename: "img.jpg",
                contextType: "image/jpeg",
            });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Storage error");
    });
});

describe("POST /posts/:id/save and DELETE /posts/:id/save", () => {
    it("saves a post for the user", async () => {
        const insert = jest.fn().mockResolvedValue({ error: null });
        mockFrom.mockReturnValue({ insert });

        const res = await request(app).post("/posts/post-1/save");

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("Saved post successfully");
        expect(insert).toHaveBeenCalledWith({ post_id: "post-1", user_id: "user-001" });
    });

    it("returns 400 when save insert fails", async () => {
        const insert = jest.fn().mockResolvedValue({ error: { message: "Duplicate save" } });
        mockFrom.mockReturnValue({ insert });

        const res = await request(app).post("/posts/post-1/save");

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Duplicate save");
    });

    it("unsaves a post successfully", async () => {
        const secondEq = jest.fn().mockResolvedValue({ error: null });
        const firstEq = jest.fn().mockReturnValue({ eq: secondEq });
        const del = jest.fn().mockReturnValue({ eq: firstEq });
        mockFrom.mockReturnValue({ delete: del });

        const res = await request(app).delete("/posts/post-1/save");

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("Unsaved post successfully");
    });
});

describe("POST /posts/:id/request", () => {
    it("returns 400 when pending request already exists", async () => {
        const maybeSingle = jest.fn().mockResolvedValue({
            data: { status: "pending" },
            error: null,
        });

        const eq2 = jest.fn().mockReturnValue({ maybeSingle });
        const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
        const select = jest.fn().mockReturnValue({ eq: eq1 });
        mockFrom.mockReturnValue({ select });

        const res = await request(app).post("/posts/post-1/request").send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Request already pending");
    });

    it("resends a previously rejected request", async () => {
        const maybeSingle = jest.fn().mockResolvedValue({
            data: { status: "rejected" },
            error: null,
        });

        const eq2 = jest.fn().mockReturnValue({ maybeSingle });
        const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
        const select = jest.fn().mockReturnValue({ eq: eq1 });

        const updateEq2 = jest.fn().mockReturnValue({ maybeSingle: null });
        const updateEq1 = jest.fn().mockReturnValue({ eq: updateEq2 });
        const updateFn = jest.fn().mockReturnValue({ eq: updateEq1 });

        const singlePost = jest.fn().mockResolvedValue({
            data: { author_id: "author-1", title: "Need teammates" },
            error: null
        });

        const eqPost = jest.fn().mockReturnValue({ single: singlePost });
        const selectPost = jest.fn().mockReturnValue({ eq: eqPost });

        mockFrom.mockImplementation((table) => {
            if (table === "join_requests") {
                return { select, update: updateFn };
            }
            if (table === "posts") {
                return { select: selectPost };
            }
            throw new Error(`Unexpected table: ${table}`);
        });

        const res = await request(app).post("/posts/post-1/request").send({ message: "trying again" });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("Request resent successfully");
        expect(updateFn).toHaveBeenCalledWith({ status: "pending", message: "trying again" });
    });
});

describe("PATCH /posts/requests/:requestId", () => {
    it("returns 400 when current user is not the post author", async () => {
        const single = jest.fn().mockResolvedValue({
            data: {
                post_id: "post-1",
                requester_id: "user-1",
                posts: { author_id: "user-2", title: "title" },
            },
            error: null,
        });
        const eq = jest.fn().mockReturnValue({ single });
        const select = jest.fn().mockReturnValue({ eq });
        mockFrom.mockReturnValue({ select });

        const res = await request(app).patch("/posts/requests/request-1").send({ status: "accepted" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Unauthorized to modify this request");
    });


    it("accepts a request, increments member count, and notifies requester", async () => {
        const single = jest.fn().mockResolvedValue({
            data: {
                post_id: "post-1",
                requester_id: "user-555",
                posts: { author_id: "user-001", title: "Need teammates" }
            },
            error: null
        });
        const fetchEq = jest.fn().mockReturnValue({ single });
        const fetchSelect = jest.fn().mockReturnValue({ eq: fetchEq });

        const updateEq = jest.fn().mockResolvedValue({ error: null });
        const updateFn = jest.fn().mockReturnValue({ eq: updateEq });

        const eqTokens = jest.fn().mockResolvedValue({
            data: [{ token: "ExponentPushToken[req]" }],
            error: null
        });
        const selectTokens = jest.fn().mockReturnValue({ eq: eqTokens });

        mockFrom.mockImplementation((table) => {
            if (table === "join_requests") {
                return { select: fetchSelect, update: updateFn };
            }
            if (table === "push_tokens") {
                return { select: selectTokens };
            }
            throw new Error(`Unexpected table: ${table}`);
        });

        const res = await request(app).patch("/posts/requests/req-1").send({ status: "accepted" });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("Request accepted");
        expect(mockRpc).toHaveBeenCalledWith("increment_member_count", { post_id: "post-1" });
        expect(mockSendPushNotification).toHaveBeenCalledWith(
            ["ExponentPushToken[req]"],
            "Request Approved! 🎉",
            'You have been accepted into "Need teammates"!',
            { type: "join_decision", postId: "post-1", status: "accepted" }
        );
    });
});

describe("GET /posts/fetchPostById/:postId", () => {
    it("returns the post with save info for the current user", async () => {
        const maybeSingle = jest.fn().mockResolvedValue({
            data: { id: "post-1", title: "Need teammates" },
            error: null
        });
        const eq2 = jest.fn().mockReturnValue({ maybeSingle });
        const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
        const select = jest.fn().mockReturnValue({ eq: eq1 });
        mockFrom.mockReturnValue({ select });

        const res = await request(app).get("/posts/fetchPostById/post-1");

        expect(res.status).toBe(200);
        expect(res.body.id).toBe("post-1");
    });

    it("returns 400 on fetch error", async () => {
        const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: { message: "Failed" } });
        const eq2 = jest.fn().mockReturnValue({ maybeSingle });
        const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
        const select = jest.fn().mockReturnValue({ eq: eq1 });
        mockFrom.mockReturnValue({ select });

        const res = await request(app).get("/posts/fetchPostById/post-1");

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Failed");
    });
});

describe("GET /posts/:id/requests/accepted", () => {
    it("returns accepted requests when the user is the post author", async () => {
        const singlePost = jest.fn().mockResolvedValue({
            data: { author_id: "user-001" },
            error: null
        });
        const eqPost = jest.fn().mockReturnValue({ single: singlePost });
        const selectPost = jest.fn().mockReturnValue({ eq: eqPost });

        const eqStatus = jest.fn().mockResolvedValue({
            data: [{ id: "req-1", profiles: { username: "xn" } }],
            error: null
        });
        const eqPostId = jest.fn().mockReturnValue({ eq: eqStatus });
        const selectRequests = jest.fn().mockReturnValue({ eq: eqPostId });

        mockFrom.mockImplementation((table) => {
            if (table === "posts") return { select: selectPost };
            if (table === "join_requests") return { select: selectRequests };
            throw new Error(`Unexpected table: ${table}`);
        });

        const res = await request(app).get("/posts/post-1/requests/accepted");

        expect(res.status).toBe(200);
        expect(res.body[0].id).toBe("req-1");
    });
});

describe("GET /posts/:id/requests/pending", () => {
    it("returns pending requests when the user is the post author", async () => {
        const singlePost = jest.fn().mockResolvedValue({
            data: { author_id: "user-001" },
            error: null
        });
        const eqPost = jest.fn().mockReturnValue({ single: singlePost });
        const selectPost = jest.fn().mockReturnValue({ eq: eqPost });

        const eqStatus = jest.fn().mockResolvedValue({
            data: [{ id: "req-2", profiles: { username: "xn" } }],
            error: null
        });
        const eqPostId = jest.fn().mockReturnValue({ eq: eqStatus });
        const selectRequests = jest.fn().mockReturnValue({ eq: eqPostId });

        mockFrom.mockImplementation((table) => {
            if (table === "posts") return { select: selectPost };
            if (table === "join_requests") return { select: selectRequests };
            throw new Error(`Unexpected table: ${table}`);
        });

        const res = await request(app).get("/posts/post-1/requests/pending");

        expect(res.status).toBe(200);
        expect(res.body[0].id).toBe("req-2");
    });
});

describe("DELETE /posts/delete/:postId", () => {
    it("deletes the post when the requester is the author", async () => {
        const secondEq = jest.fn().mockResolvedValue({ error: null });
        const firstEq = jest.fn().mockReturnValue({ eq: secondEq });
        const del = jest.fn().mockReturnValue({ eq: firstEq });
        mockFrom.mockReturnValue({ delete: del });

        const res = await request(app).delete("/posts/delete/post-1");

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("Successfully deleted post");
        expect(firstEq).toHaveBeenCalledWith("id", "post-1");
        expect(secondEq).toHaveBeenCalledWith("author_id", "user-001");
    });
});
