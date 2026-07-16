import { jest } from "@jest/globals";
import { errorHandler } from "../server/middleware/errorHandler.js";
import { AppError } from "../server/utils/AppError.js";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("AppError", () => {
  it("creates error with code, message, and status", () => {
    const err = new AppError("NOT_FOUND", "Post not found", 404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Post not found");
    expect(err.status).toBe(404);
    expect(err).toBeInstanceOf(Error);
  });

  it("defaults to status 400", () => {
    const err = new AppError("BAD_REQUEST", "bad");
    expect(err.status).toBe(400);
  });
});

describe("errorHandler", () => {
  it("returns AppError as JSON with correct status", () => {
    const err = new AppError("NOT_FOUND", "Post not found", 404);
    const req = {};
    const res = createRes();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "NOT_FOUND", message: "Post not found" }
    });
  });

  it("returns 500 for unknown errors", () => {
    const err = new Error("something broke");
    const req = {};
    const res = createRes();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" }
    });
  });

  it("returns 500 when error has no message", () => {
    const err = {};
    const req = {};
    const res = createRes();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" }
    });
  });
});
