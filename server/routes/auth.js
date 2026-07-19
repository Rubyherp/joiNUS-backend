import { Router } from "express";
import { supabase } from "../../supabaseClient.js";
import { validate } from "../utils/validation.js";
import { registerSchema, loginSchema, sendOtpSchema } from "../schemas/auth.js";
import { AppError } from "../utils/AppError.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const router = Router();

router.post("/send-otp", validate(sendOtpSchema), async (req, res) => {
    const { email } = req.body;

    // console.log(`[send-otp] Sending OTP to ${email}...`);

    const { data, error } = await supabase.auth.signInWithOtp({ email });

    // console.log(`[send-otp] Response for ${email}:`, JSON.stringify({ data, error }));

    if (error) {
        // console.log(`[send-otp] FAILED for ${email}:`, error);
        throw new AppError("OTP_SEND_FAILED", error.message || "Unknown error");
    }

    // console.log(`[send-otp] SUCCESS for ${email}`);
    return res.status(200).json({ message: "OTP sent" });
});

router.post("/register", validate(registerSchema), async (req, res) => {
    const { email, password, otp } = req.body;

    const { data: verifyData, error: otpError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
    });

    if (otpError) {
        throw new AppError("OTP_VERIFICATION_FAILED", otpError.message);
    }

    const userId = verifyData.user?.id;
    if (!userId) {
        throw new AppError("REGISTRATION_FAILED", "User not found after OTP verification");
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        password,
    });

    if (updateError) {
        throw new AppError("REGISTRATION_FAILED", updateError.message);
    }

    return res.status(200).json({
        message: "User created successfully",
        user: verifyData.user,
    });
});

router.post("/login", validate(loginSchema), async (req, res) => {
    const { email, password } = req.body;

    let token, user;
    try {
        const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_ROLE_KEY,
            },
            body: JSON.stringify({ email, password }),
        });
        const authData = await authRes.json();
        if (!authRes.ok || !authData.access_token) {
            throw new Error(authData.error_description || authData.msg || 'Authentication failed');
        }
        token = authData.access_token;
        user = authData.user;
    } catch (err) {
        throw new AppError('LOGIN_FAILED', err.message);
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

    if (profileError && profileError.code !== "PGRST116") {
        throw new AppError('INTERNAL_ERROR', 'Failed to check profile', 500);
    }

    return res.status(200).json({
        token,
        user,
        hasProfile: !!profile
    });
});

export default router;
