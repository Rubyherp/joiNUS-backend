import { Router } from "express";
import { supabase } from "../../supabaseClient.js";
import authMiddleware from "../middleware/authMiddleware.js";
import multer from "multer";

const router = Router();
const upload = multer({
    storage: multer.memoryStorage()
});

// honestly should change this endpoint name
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

    const profilePayload = {
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
    };

    const { data, error } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: 'id' })
        .select()
        .single();

    if (error) {
        return res.status(400).json({ error: error.message });
    }
    return res.status(200).json({ message: "Profile saved succesfully", data });
});

// fetch profile
router.get("/profile", authMiddleware, async (req, res) => {
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
                console.error("STORAGE ERROR:", uploadError);
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
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        return res.status(400).json({ error: error.message });
    };

    return res.status(200).json(data);
})

router.get('/fetchUserByUsername/:username', authMiddleware, async (req, res) => {
    const { username } = req.params;
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', `%${username}%`);

    if (error) {
        return res.status(400).json({ error: error.message })
    };

    return res.status(200).json(data);

})

export default router;
