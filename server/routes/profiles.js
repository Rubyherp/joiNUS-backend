import { Router } from "express";
import { supabase } from "../../supabaseClient.js";
import authMiddleware from "../middleware/authMiddleware.js";
import multer from "multer";
import { validate } from "../utils/validation.js";
import { createProfileSchema } from "../schemas/profiles.js";
import { AppError } from "../utils/AppError.js";

const router = Router();
const upload = multer({
    storage: multer.memoryStorage()
});

// honestly should change this endpoint name
//profile creation
router.post("/profileCreation", authMiddleware, validate(createProfileSchema), async (req, res) => {
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
        throw new AppError('DB_ERROR', error.message);
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
        throw new AppError('DB_ERROR', error.message);
    }
    if (!data) {
        throw new AppError('NOT_FOUND', 'No profile found', 404);
    }

    return res.status(200).json(data);
});

// change avatar
router.post("/changeAvatar", authMiddleware, upload.single("avatar"),
    async (req, res) => {
        try {
            const file = req.file;

            if (!file) {
                throw new AppError('VALIDATION_ERROR', 'No file uploaded');
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
                throw new AppError('AVATAR_ERROR', uploadError.message);
            }

            const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

            const avatarUrl = data.publicUrl;

            const { error: dbError } = await supabase
                .from("profiles")
                .update({ avatar: avatarUrl })
                .eq("id", req.user.id);

            if (dbError) {
                throw new AppError('DB_ERROR', dbError.message);
            }

            return res.status(200).json({ avatar: avatarUrl });
        } catch (error) {
            throw new AppError('AVATAR_ERROR', error.message);
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
        throw new AppError('DB_ERROR', error.message);
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
        throw new AppError('DB_ERROR', error.message)
    };

    return res.status(200).json(data);

})

export default router;
