import request from "supertest";
import { jest } from '@jest/globals'

const mockSignUp = jest.fn();
const mockSignIn = jest.fn();
const mockFrom = jest.fn();
const mockStorageFrom = jest.fn();
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();

// Mock chainable query for Supabase
const buildChainableQuery = (overrides = {}) => {
    const createThenable = () => {
        const promise = Promise.resolve(overrides.eqError || { error: null });
        const thenable = {
            then: promise.then.bind(promise),
            select: jest.fn().mockImplementation(() => createThenable()),
            eq: jest.fn().mockImplementation(() => createThenable()),
            single: jest.fn().mockImplementation(() => Promise.resolve(overrides.single || { data: null, error: null })),
            maybeSingle: jest.fn().mockImplementation(() => Promise.resolve(overrides.maybeSingle || { data: null, error: null })),
            insert: jest.fn().mockImplementation(() => Promise.resolve(overrides.insert || { error: null })),
            update: jest.fn().mockImplementation(() => createThenable()),
            upsert: jest.fn().mockImplementation(() => createThenable()),
        };
        return thenable;
    };
    return createThenable();
};

// Mock Supabase client
jest.unstable_mockModule("../supabaseClient.js", () => ({
    supabase: {
        auth: {
            signUp: mockSignUp,
            signInWithPassword: mockSignIn,
        },
        from: mockFrom,
        storage: {
            from: mockStorageFrom,
        },
    },
}));

// Mock auth middleware
jest.unstable_mockModule("../server/middleware/authMiddleware.js", () => ({
    default: (req, res, next) => {
        req.user = { id: "user-001" };
        next();
    }
}))

const { default: app } = await import("../server/app.js");

let supabaseOverrides = {};

beforeEach(() => {
    jest.clearAllMocks();
    supabaseOverrides = {};
    mockFrom.mockImplementation((table) => buildChainableQuery(supabaseOverrides));
    mockStorageFrom.mockImplementation(() => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl
    }))
})

describe("POST /register", () => {
    it("successfully registers a user", async () => {
        mockSignUp.mockResolvedValueOnce({
            data: { user: { id: "user-1", email: "user@1.com" } },
            error: null
        });

        const res = await request(app).post('/register').send({
            email: "user@1.com",
            password: "123456"
        });

        expect(res.status).toBe(200);
        expect(res.body.user).toEqual({ id: "user-1", email: "user@1.com" })
    })

    it("returns 400 on registration failure", async () => {
        mockSignUp.mockResolvedValueOnce({
            data: null,
            error: { message: "Registration failed" }
        })

        const res = await request(app).post('/register').send({
            email: "user@1.com",
            password: "123456"
        });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Registration failed");
    })
})

describe("POST /login", () => {
    it("logs in and returns JWT with hasProfile true", async () => {
        supabaseOverrides.single = { data: { id: "user-2" }, error: null };
        mockSignIn.mockResolvedValueOnce({
            data: {
                user: { id: "user-2" },
                session: { access_token: "token" },
            },
            error: null
        });

        const res = await request(app).post('/login').send({
            email: "user@2.com",
            password: "123456"
        })

        expect(res.status).toBe(200);
        expect(res.body.token).toBe("token");
        expect(res.body.hasProfile).toBe(true);
    })

    it("returns hasProfile false when profile is missing", async () => {
        supabaseOverrides.single = { data: null, error: { code: 'PGRST116' } };
        mockSignIn.mockResolvedValueOnce({
            data: {
                user: { id: 'user-3' },
                session: { access_token: "token-2" }
            },
            error: null
        });

        const res = await request(app).post('/login').send({
            email: "noProfile.com",
            password: "123456"
        })

        expect(res.status).toBe(200);
        expect(res.body.hasProfile).toBe(false);
    })

    it("returns 500 when profile lookup fails", async () => {
        supabaseOverrides.single = { data: null, error: { code: 'OTHER' } };
        mockSignIn.mockResolvedValueOnce({
            data: {
                user: { id: "user-4" },
                session: { access_token: "token-3" }
            },
            error: null
        })

        const res = await request(app).post('/login').send({
            email: "user@4.com",
            password: "123456",
        })

        expect(res.status).toBe(500);
        expect(res.body.error).toBe("Failed to check profile");
    })

    it("returns 400 on login failure", async () => {
        mockSignIn.mockResolvedValueOnce({
            data: null,
            error: { message: "Bad credentials" }
        })

        const res = await request(app).post('/login').send({
            email: "user@5.com",
            password: "123456"
        })

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Bad credentials");
    })
})

describe("POST /profileCreation", () => {
    it("creates a profile succesfully", async () => {
        supabaseOverrides.single = { data: { id: "user-001", username: "Tester" }, error: null };

        const res = await request(app).post('/profileCreation').send({
            username: "Tester",
            major: "CS",
            year: "1",
            modules: "CS2030S",
            contact: "9999",
            email: "tester@u.nus.edu",
            about: "hello",
            skills: "js",
            experiences: "none"
        });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("Profile saved succesfully");
    })

    it("returns 400 on profile creation fail", async () => {
        supabaseOverrides.single = { data: null, error: { message: "Insert failed" } };

        const res = await request(app).post('/profileCreation').send({
            username: "Fail"
        })

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Insert failed");
    })
})

describe("GET /profile", () => {
    it("returns profile data", async () => {
        supabaseOverrides.maybeSingle = {
            data: { id: "user-6", username: "tester" },
            error: null
        }

        const res = await request(app).get('/profile');

        expect(res.status).toBe(200);
        expect(res.body.username).toBe("tester");
    })

    it("returns 404 when the profile is missing", async () => {
        supabaseOverrides.maybeSingle = {
            data: null,
            error: null
        };

        const res = await request(app).get('/profile');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("No Profile Found");
    })

    it("returns 400 when profile fetch errors", async () => {
        supabaseOverrides.maybeSingle = {
            data: null,
            error: { message: "Fetch failed" }
        };

        const res = await request(app).get('/profile');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Fetch failed");
    })
})


describe("GET /fetchUserDetails/:userId", () => {
    it("returns the requested user's profile", async () => {
        supabaseOverrides.maybeSingle = {
            data: { id: "user-999", username: "OtherUser" },
            error: null
        };

        const res = await request(app).get("/fetchUserDetails/user-999");

        expect(res.status).toBe(200);
        expect(res.body.username).toBe("OtherUser");
    })

    it("returns 400 when the lookup fails", async () => {
        supabaseOverrides.maybeSingle = {
            data: null,
            error: { message: "Lookup failed" }
        };

        const res = await request(app).get("/fetchUserDetails/user-999");

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Lookup failed");
    })
})

describe("POST /changeAvatar", () => {
    it("returns 404 when no file is uploaded", async () => {
        const res = await request(app).post("/changeAvatar");

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("No file uploaded");
    })

    it("uploads avatar and updates profile sucessfully", async () => {
        mockUpload.mockResolvedValueOnce({ error: null })
        mockGetPublicUrl.mockReturnValueOnce({
            data: { publicUrl: "https://example.com/avatar.jpg" }
        })
        const res = await request(app)
            .post('/changeAvatar')
            .attach("avatar", Buffer.from("avatar"), {
                filename: "avatar.jpg",
                contentType: "image/jpeg"
            })

        expect(res.status).toBe(200);
        expect(res.body.avatar).toBe("https://example.com/avatar.jpg");
    })

    it("returns 400 when avatar upload fails", async () => {
        mockUpload.mockResolvedValueOnce({ error: { message: "Upload failed" } })

        const res = await request(app)
            .post('/changeAvatar')
            .attach("avatar", Buffer.from("avatar"), {
                filename: "avatar.jpg",
                contentType: "image/jpeg"
            })

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Upload failed");
    })

    it('retuns 400 when avatar update fails', async () => {
        supabaseOverrides.eqError = { error: { message: "Update failed" } };
        mockUpload.mockResolvedValueOnce({ error: null });
        mockGetPublicUrl.mockReturnValueOnce({
            data: { publicUrl: "https://example.com/avatar.jpg" }
        });

        const res = await request(app)
            .post('/changeAvatar')
            .attach("avatar", Buffer.from("avatar"), {
                filename: "avatar.jpg",
                contentType: "image/jpeg"
            })

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Update failed");
    })
})
