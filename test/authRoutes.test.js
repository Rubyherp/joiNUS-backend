import request from "supertest";
import { jest } from '@jest/globals'

process.env.SUPABASE_URL = "https://test-project.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockSignUp = jest.fn();
const mockSignIn = jest.fn();
const mockSignInWithOtp = jest.fn();
const mockVerifyOtp = jest.fn();
const mockAdminUpdateUser = jest.fn();
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
            admin: {
                createUser: mockSignUp,
                updateUserById: mockAdminUpdateUser,
            },
            signInWithPassword: mockSignIn,
            signInWithOtp: mockSignInWithOtp,
            verifyOtp: mockVerifyOtp,
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

describe("POST /send-otp", () => {
    it("sends OTP successfully", async () => {
        mockSignInWithOtp.mockResolvedValueOnce({ data: {}, error: null });

        const res = await request(app).post('/send-otp').send({
            email: "user@1.com"
        });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe("OTP sent");
        expect(mockSignInWithOtp).toHaveBeenCalledWith({ email: "user@1.com" });
    });

    it("returns 400 when OTP send fails", async () => {
        mockSignInWithOtp.mockResolvedValueOnce({
            data: null,
            error: { message: "Rate limit exceeded" }
        });

        const res = await request(app).post('/send-otp').send({
            email: "user@1.com"
        });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe("Rate limit exceeded");
    });
});

describe("POST /register", () => {
    beforeEach(() => {
        mockVerifyOtp.mockResolvedValue({ data: { user: { id: "user-1", email: "user@1.com" } }, error: null });
    });

    it("successfully registers a user", async () => {
        mockAdminUpdateUser.mockResolvedValueOnce({ data: { user: { id: "user-1", email: "user@1.com" } }, error: null });

        const res = await request(app).post('/register').send({
            email: "user@1.com",
            password: "123456",
            otp: "12345678"
        });

        expect(res.status).toBe(200);
        expect(res.body.user).toEqual({ id: "user-1", email: "user@1.com" });
        expect(mockVerifyOtp).toHaveBeenCalledWith({
            email: "user@1.com",
            token: "12345678",
            type: "email",
        });
        expect(mockAdminUpdateUser).toHaveBeenCalledWith("user-1", { password: "123456" });
    });

    it("returns 400 on OTP verification failure", async () => {
        mockVerifyOtp.mockResolvedValueOnce({
            data: null,
            error: { message: "Invalid OTP" }
        });

        const res = await request(app).post('/register').send({
            email: "user@1.com",
            password: "123456",
            otp: "00000000"
        });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe("Invalid OTP");
    });

    it("returns 400 when user not found after OTP verification", async () => {
        mockVerifyOtp.mockResolvedValueOnce({
            data: { user: null },
            error: null
        });

        const res = await request(app).post('/register').send({
            email: "user@1.com",
            password: "123456",
            otp: "12345678"
        });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe("User not found after OTP verification");
    });

    it("returns 400 on password update failure after OTP verified", async () => {
        mockAdminUpdateUser.mockResolvedValueOnce({
            data: null,
            error: { message: "Password update failed" }
        });

        const res = await request(app).post('/register').send({
            email: "user@1.com",
            password: "123456",
            otp: "12345678"
        });

        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe("Password update failed");
    });
})

describe("POST /login", () => {
    it("logs in and returns JWT with hasProfile true", async () => {
        supabaseOverrides.single = { data: { id: "user-2" }, error: null };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ access_token: "token", user: { id: "user-2" } }),
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
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ access_token: "token-2", user: { id: 'user-3' } }),
        });

        const res = await request(app).post('/login').send({
            email: "noprofile@test.com",
            password: "123456"
        })

        expect(res.status).toBe(200);
        expect(res.body.hasProfile).toBe(false);
    })

    it("returns 500 when profile lookup fails", async () => {
        supabaseOverrides.single = { data: null, error: { code: 'OTHER' } };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ access_token: "token-3", user: { id: "user-4" } }),
        })

        const res = await request(app).post('/login').send({
            email: "user@4.com",
            password: "123456",
        })

        expect(res.status).toBe(500);
        expect(res.body.error.message).toBe("Failed to check profile");
    })

    it("returns 400 on login failure", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ error_description: "Bad credentials" }),
        })

        const res = await request(app).post('/login').send({
            email: "user@5.com",
            password: "123456"
        })

        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe("Bad credentials");
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
        expect(res.body.error.message).toBe("Insert failed");
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
        expect(res.body.error.message).toBe("No profile found");
    })

    it("returns 400 when profile fetch errors", async () => {
        supabaseOverrides.maybeSingle = {
            data: null,
            error: { message: "Fetch failed" }
        };

        const res = await request(app).get('/profile');

        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe("Fetch failed");
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
        expect(res.body.error.message).toBe("Lookup failed");
    })
})

describe("POST /changeAvatar", () => {
    it("returns 400 when no file is uploaded", async () => {
        const res = await request(app).post("/changeAvatar");

        expect(res.status).toBe(400);
        expect(res.body.error.message).toBe("No file uploaded");
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
        expect(res.body.error.message).toBe("Upload failed");
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
        expect(res.body.error.message).toBe("Update failed");
    })
})
