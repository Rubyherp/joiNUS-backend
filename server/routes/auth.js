import { Router } from "express";
import { supabase } from "../../supabaseClient.js";
import { validate } from "../utils/validation.js";
import { registerSchema, loginSchema } from "../schemas/auth.js";

const router = Router();

router.post("/register", validate(registerSchema), async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return res.status(400).json({ error: error.message });
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
    return res.status(400).json({ error: error.message });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.user.id)
    .single();

  if (profileError && profileError.code !== "PGRST116") {
    return res.status(500).json({ error: "Failed to check profile" });
  }

  return res.status(200).json({
    token: data.session.access_token,
    user: data.user,
    hasProfile: !!profile
  });
});

export default router;
