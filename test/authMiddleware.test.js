import { jest } from "@jest/globals";

const mockGetUser = jest.fn();

jest.unstable_mockModule("../supabaseClient.js", () => ({
    supabase: {
        auth: {
            getUser: mockGetUser
        }
    }
}));

const { default: authMiddleware } = await import(
    "../server/middleware/authMiddleware.js"
);

const createRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe("authMiddleware", () => {
    it("returns 401 when no token is provided", async () => {
        const req = { headers: {} };
        const res = createRes();
        const next = jest.fn();

        await authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "No token provided" });
        expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 when token is invalid", async () => {
        mockGetUser.mockResolvedValueOnce({ data: {}, error: { message: "bad" } });

        const req = { headers: { authorization: "Bearer bad-token" } };
        const res = createRes();
        const next = jest.fn();

        await authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ error: "Invalid Token p1" });
        expect(next).not.toHaveBeenCalled();
    });

    it("attaches user and calls next on success", async () => {
        mockGetUser.mockResolvedValueOnce({
            data: { user: { id: "user-1" } },
            error: null
        });

        const req = { headers: { authorization: "Bearer ok-token" } };
        const res = createRes();
        const next = jest.fn();

        await authMiddleware(req, res, next);

        expect(req.user).toEqual({ id: "user-1" });
        expect(next).toHaveBeenCalled();
    });
});
