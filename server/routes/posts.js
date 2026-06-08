import { Router } from "express";
import { supabase } from "../../supabaseClient.js";
import authMiddleware from "../middleware/authMiddleware.js";
import multer from "multer";

const router = Router();
const upload = multer({
    storage: multer.memoryStorage()
});

// create post
router.post('/', authMiddleware, upload.none(), async (req, res) => {
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
router.get('/', authMiddleware, async (req, res) => {
    const { data, error } = await supabase
        .from('posts')
        .select('*, communities(id, name, category, tags)')
        .order('created_at', { ascending: false });

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
})

// get user's saved posts
router.get('/saved', authMiddleware, async (req, res) => {
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

// get post by id
router.get('/fetchPostById/:postId', authMiddleware, async (req, res) => {
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
router.post('/uploadPostImage', authMiddleware, upload.single('postFile'), async (req, res) => {
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

// user saving a post
router.post('/:id/save', authMiddleware, async (req, res) => {
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
router.delete('/:id/save', authMiddleware, async (req, res) => {
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

export default router;
