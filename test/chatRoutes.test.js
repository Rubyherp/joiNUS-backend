import request from "supertest";
import { jest } from "@jest/globals";

const mockFrom = jest.fn();

jest.unstable_mockModule("../supabaseClient.js", () => ({
    supabase: {
        from: mockFrom,
    },
}));

jest.unstable_mockModule("../server/middleware/authMiddleware.js", () => ({
    default: (req, res, next) => {
        req.user = { id: "user-1" };
        next();
    }
}));

const { default: app } = await import("../server/app.js");

beforeEach(() => {
    jest.clearAllMocks();
});

describe("GET /chats/dm/:otherUserId/messages", () => {
    it("returns the DM history ordered ascending", async () => {
        const order = jest.fn().mockResolvedValue({
            data: [
                { id: "m1", content: "hi", room_id: "user-1_user-2" },
                { id: "m2", content: "hello", room_id: "user-1_user-2" }
            ],
            error: null
        });
        const eq = jest.fn().mockReturnValue({ order });
        const select = jest.fn().mockReturnValue({ eq });
        mockFrom.mockReturnValue({ select });

        const res = await request(app).get("/chats/dm/user-2/messages");

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(mockFrom).toHaveBeenCalledWith("direct_messages");
        expect(eq).toHaveBeenCalledWith("room_id", "user-1_user-2");
        expect(order).toHaveBeenCalledWith("created_at", { ascending: true });
    });

    it("sorts the room id consistently regardless of who is the requester", async () => {
        const order = jest.fn().mockResolvedValue({ data: [], error: null });
        const eq = jest.fn().mockReturnValue({ order });
        const select = jest.fn().mockReturnValue({ eq });
        mockFrom.mockReturnValue({ select });

        await request(app).get("/chats/dm/user-0/messages");

        expect(eq).toHaveBeenCalledWith("room_id", "user-0_user-1");
    });

    it("returns 400 when the query fails", async () => {
        const order = jest.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
        const eq = jest.fn().mockReturnValue({ order });
        const select = jest.fn().mockReturnValue({ eq });
        mockFrom.mockReturnValue({ select });

        const res = await request(app).get("/chats/dm/user-2/messages");

        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe("DB error");
    });
});

describe("GET /chats/conversations", () => {
    it("returns 400 when fetching messages fails", async () => {
        const order = jest.fn().mockResolvedValue({ data: null, error: { message: "Failed to fetch" } });
        const or = jest.fn().mockReturnValue({ order });
        const select = jest.fn().mockReturnValue({ or });
        mockFrom.mockReturnValue({ select });

        const res = await request(app).get("/chats/conversations");

        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe("Failed to fetch");
    });

    it("returns the latest message per room with profile info attached", async () => {
        const messages = [
            {
                room_id: "user-1_user-2",
                content: "latest from user-2 room",
                created_at: "2026-06-20T10:00:00Z",
                sender_id: "user-2"
            },
            {
                room_id: "user-1_user-2",
                content: "older message",
                created_at: "2026-06-19T10:00:00Z",
                sender_id: "user-1"
            },
            {
                room_id: "user-1_user-3",
                content: "hi from user-3 room",
                created_at: "2026-06-18T10:00:00Z",
                sender_id: "user-3"
            }
        ];

        const order = jest.fn().mockResolvedValue({ data: messages, error: null });
        const or = jest.fn().mockReturnValue({ order });
        const messagesSelect = jest.fn().mockReturnValue({ or });

        const profiles = [
            { id: "user-2", username: "xn-1", avatar: "xn.jpg" },
            { id: "user-3", username: "xn-2", avatar: "xn.jpg" }
        ];
        const inFn = jest.fn().mockResolvedValue({ data: profiles, error: null });
        const profilesSelect = jest.fn().mockReturnValue({ in: inFn });

        mockFrom.mockImplementation((table) => {
            if (table === "direct_messages") return { select: messagesSelect };
            if (table === "profiles") return { select: profilesSelect };
            throw new Error(`Unexpected table: ${table}`);
        });

        const res = await request(app).get("/chats/conversations");

        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);

        const room12 = res.body.find(c => c.room_id === "user-1_user-2");
        expect(room12.last_message).toBe("latest from user-2 room");
        expect(room12.other_user_id).toBe("user-2");
        expect(room12.profile).toEqual({ username: "xn-1", avatar: "xn.jpg" });

        const room13 = res.body.find(c => c.room_id === "user-1_user-3");
        expect(room13.profile).toEqual({ username: "xn-2", avatar: "xn.jpg" });
    });

    it("returns an empty array when there are no messages", async () => {
        const order = jest.fn().mockResolvedValue({ data: [], error: null });
        const or = jest.fn().mockReturnValue({ order });
        const select = jest.fn().mockReturnValue({ or });
        mockFrom.mockReturnValue({ select });

        const res = await request(app).get("/chats/conversations");

        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    it("sets profile to null when no matching profile is found", async () => {
        const messages = [
            {
                room_id: "user-1_user-4",
                content: "hello",
                created_at: "2026-06-20T10:00:00Z",
                sender_id: "user-4"
            }
        ];
        const order = jest.fn().mockResolvedValue({ data: messages, error: null });
        const or = jest.fn().mockReturnValue({ order });
        const messagesSelect = jest.fn().mockReturnValue({ or });

        const inFn = jest.fn().mockResolvedValue({ data: [], error: null });
        const profilesSelect = jest.fn().mockReturnValue({ in: inFn });

        mockFrom.mockImplementation((table) => {
            if (table === "direct_messages") return { select: messagesSelect };
            if (table === "profiles") return { select: profilesSelect };
            throw new Error(`Unexpected table: ${table}`);
        });

        const res = await request(app).get("/chats/conversations");

        expect(res.status).toBe(200);
        expect(res.body[0].profile).toBeNull();
    });
});
