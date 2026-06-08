import { Router } from "express";
import { supabase } from "../../supabaseClient.js";
import authMiddleware from "../middleware/authMiddleware.js";
import multer from "multer";

const router = Router();
const upload = multer({
    storage: multer.memoryStorage()
});

//profile creation
router.post("/profileCreation", authMiddleware, async (req, res) => {
    const {
        avatar,
        username,
        major,
        year,
        modules,
        contact,
        email,
        about,
        skills,
        experiences
    } = req.body;

    const { error } = await supabase.from("profiles").insert({
        id: req.user.id,
        avatar,
        username,
        major,
        year,
        modules,
        contact,
        email,
        about,
        skills,
        experiences
    });

    if (error) {
        return res.status(400).json({ error: error.message });
    }
    return res.status(200).json({ message: "Profile created successfully" });
});

// fetch profile
router.get("/profile", authMiddleware, async (req, res) => {
    console.log(req.user);
    const userId = req.user.id;
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        return res.status(400).json({ error: error.message });
    }
    if (!data) {
        return res.status(404).json({ error: "No Profile Found" });
    }

    return res.status(200).json(data);
});

// change avatar
router.post("/changeAvatar", authMiddleware, upload.single("avatar"),
    async (req, res) => {
        try {
            console.log("USER:", req.user);
            console.log("BODY:", req.body);
            console.log(req.file);
            const file = req.file;

            if (!file) {
                return res.status(404).json({ error: "No file uploaded" });
            }

            const filePath = `${req.user.id}.jpg`;

            const { error: uploadError } = await supabase.storage
                .from("avatars")
                .upload(filePath, file.buffer, {
                    contentType: file.mimetype,
                    upsert: true
                });

            if (uploadError) {
                console.log("STORAGE ERROR:", uploadError);
                return res.status(400).json({ error: uploadError.message });
            }

            const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

            const avatarUrl = data.publicUrl;

            const { error: dbError } = await supabase
                .from("profiles")
                .update({ avatar: avatarUrl })
                .eq("id", req.user.id);

            if (dbError) {
                return res.status(400).json({ error: dbError.message });
            }

            return res.status(200).json({ avatar: avatarUrl });
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    }
);

// get user details by id
router.get('/fetchUserDetails/:userId', authMiddleware, async (req, res) => {
    const { userId } = req.params;
    const { data, error } = await supabase
        .from('profiles')
        .select('username, avatar')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
})

export default router;
