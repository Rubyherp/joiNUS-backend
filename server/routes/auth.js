import { Router } from "express";
import { supabase } from "../../supabaseClient.js";
import { validate } from "../utils/validation.js";
import { registerSchema, loginSchema } from "../schemas/auth.js";
import { AppError } from "../utils/AppError.js";

const router = Router();

router.post("/register", validate(registerSchema), async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    throw new AppError('REGISTRATION_FAILED', error.message);
  }

  return res.status(200).json({
    message: "User created successfully",
    user: data.user
  });
});

router.post("/login", validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw new AppError('LOGIN_FAILED', error.message);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.user.id)
    .single();

  if (profileError && profileError.code !== "PGRST116") {
    throw new AppError('INTERNAL_ERROR', 'Failed to check profile', 500);
  }

  return res.status(200).json({
    token: data.session.access_token,
    user: data.user,
    hasProfile: !!profile
  });
});

export default router;
