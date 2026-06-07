import express from "express";
import cors from "cors";
import { supabase } from "./supabaseClient.js";
import authMiddleware from "./middleware/authMiddleware.js";
import multer from "multer";

const app = express();
const upload = multer({
    storage: multer.memoryStorage()
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// test connection with frontend
app.get("/ping", (req, res) => {
    res.json({ message: "pong from Node!" });
});

// user sign up
app.post("/register", async (req, res) => {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signUp({
        email,
        password
    });

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
        message: "User created successfully",
        user: data.user
    });
});

// login
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    // check if user has a profile in db
    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .single();

    if (profileError && profileError.code !== "PGRST116") {
        return res.status(500).json({ error: "Failed to check profile" });
    }

    // jwt token for authorization not sure about the expiry tho =p
    return res.status(200).json({
        token: data.session.access_token,
        user: data.user,
        hasProfile: !!profile
    });
});

//profile creation
app.post("/profileCreation", authMiddleware, async (req, res) => {
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
app.get("/profile", authMiddleware, async (req, res) => {
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
app.post("/changeAvatar", authMiddleware, upload.single("avatar"),
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

// create post
app.post('/posts', authMiddleware, upload.none(), async (req, res) => {
    const {
        communityId,
        title,
        description,
        imageUrl,
        moreDetails,
        requirements,
        memberLimit,
        deadline,
    } = req.body;

    const { error } = await supabase
        .from('posts')
        .insert({
            author_id: req.user.id,
            community_id: communityId,
            title,
            description,
            image_url: imageUrl,
            more_details: moreDetails,
            requirements,
            member_limit: memberLimit ? parseInt(memberLimit) : null,
            deadline,
        })

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Post created successfully' });
})

// get posts
app.get('/posts', authMiddleware, async (req, res) => {
    const { data, error } = await supabase
        .from('posts')
        .select('*, communities(id, name, category, tags)')
        .order('created_at', { ascending: false });

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
})

// get post by id
app.get('/fetchPostById/:postId', authMiddleware, async (req, res) => {
    const { postId } = req.params;
    const userId = req.user.id;

    const { data, error } = await supabase
        .from('posts')
        .select('*, post_saves!left(user_id)')
        .eq('id', postId)
        .eq('post_saves.user_id', userId)
        .maybeSingle();

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
})

// upload post image
app.post('/uploadPostImage', authMiddleware, upload.single('postFile'), async (req, res) => {
    console.log('file:', req.file);
    console.log('mimetype:', req.file?.mimetype);
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: "No file uploaded" })
    }

    const filePath = `posts/${req.user.id}-${Date.now()}.jpg`;

    const { error } = await supabase.storage
        .from('post-images')
        .upload(filePath, file.buffer, {
            contentType: 'image/jpeg',
            upsert: false
        });

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    const { data } = supabase.storage.from('post-images').getPublicUrl(filePath);

    return res.status(200).json({ imageUrl: data.publicUrl });
})

// get user's saved posts
app.get('/posts/saved', authMiddleware, async (req, res) => {
    const userId = req.user.id;

    const { data, error } = await supabase
        .from('post_saves')
        .select('post_id, posts(*)')
        .eq('user_id', userId);

    if (error) {
        return res.status(400).json({ error: error.message })
    }

    return res.status(200).json(data);
})

// user saving a post
app.post('/posts/:id/save', authMiddleware, async (req, res) => {
    const { id: postId } = req.params;
    const userId = req.user.id;

    const { error } = await supabase
        .from('post_saves')
        .insert({
            post_id: postId,
            user_id: userId,
        })

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Saved post successfully' })
})

// user unsave a post
app.delete('/posts/:id/save', authMiddleware, async (req, res) => {
    const { id: postId } = req.params;
    const userId = req.user.id;

    const { error } = await supabase
        .from('post_saves')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ message: "Unsaved post successfully" })
})


//get communities
app.get('/communities', authMiddleware, async (req, res) => {
    const { data, error } = await supabase
        .from('communities')
        .select('*');

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
})

// get community by id
app.get('/fetchCommunityById/:communityId', authMiddleware, async (req, res) => {
    const { communityId } = req.params;
    const userId = req.user.id;

    const { data, error } = await supabase
        .from('communities')
        .select('*, community_follows!left(user_id)')
        .eq('id', communityId)
        .eq('community_follows.user_id', userId)
        .maybeSingle();

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
})

// get user's following communities
app.get('/communities/following', authMiddleware, async (req, res) => {
    const userId = req.user.id;

    const { data, error } = await supabase
        .from('community_follows')
        .select('community_id, communities(*)')
        .eq('user_id', userId);

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
})

// user follow a community
app.post('/communities/:id/follow', authMiddleware, async (req, res) => {
    const { id: communityId } = req.params;
    const userId = req.user.id;

    const { error } = await supabase
        .from('community_follows')
        .insert({
            user_id: userId,
            community_id: communityId
        });

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Followed community successfully' })
})

// user unfollow a community
app.delete('/communities/:id/follow', authMiddleware, async (req, res) => {
    const { id: communityId } = req.params;
    const userId = req.user.id;

    const { error } = await supabase
        .from('community_follows')
        .delete()
        .eq('user_id', userId)
        .eq('community_id', communityId);

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Unfollowed community successfully' })
})


// get user details by id
app.get('/fetchUserDetails/:userId', authMiddleware, async (req, res) => {
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

export default app;
