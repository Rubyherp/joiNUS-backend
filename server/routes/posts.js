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

// user sends join request
router.post('/:id/request', authMiddleware, async (req, res) => {
    const { id: postId } = req.params;
    const { message } = req.body;
    const requesterId = req.user.id;

    const { data: existing } = await supabase
        .from('join_requests')
        .select('status')
        .eq('post_id', postId)
        .eq('requester_id', requesterId)
        .single();

    if (existing) {
        if (existing.status === "pending") {
            return res.status(400).json({ error: 'Request already pending' });
        }
        if (existing.status === "accepted") {
            return res.status(400).json({ error: 'Already a member' });
        }

        const { error } = await supabase
            .from('join_requests')
            .update({
                status: 'pending',
                message: message || null
            })
            .eq('post_id', postId)
            .eq('requester_id', requesterId);

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        return res.status(200).json({ message: 'Request resent successfully' })
    }

    const { error } = await supabase
        .from('join_requests')
        .insert({
            post_id: postId,
            requester_id: requesterId,
            message: message || null,
        });

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ message: 'Request sent successfully' });
})

// user check own request status for Post listing
router.get('/:id/request/status', authMiddleware, async (req, res) => {
    const { id: postId } = req.params;
    const requesterId = req.user.id;

    const { data, error } = await supabase
        .from('join_requests')
        .select('status')
        .eq('post_id', postId)
        .eq('requester_id', requesterId)
        .maybeSingle();

    if (error) {
        return res.status(400).json({ error: error.message })
    }

    return res.status(200).json(data);
})


// host check accepted requests for their post
router.get('/:id/requests/accepted', authMiddleware, async (req, res) => {
    const { id: postId } = req.params;
    const userId = req.user.id;

    const { data: post, error: postError } = await supabase
        .from('posts')
        .select('author_id')
        .eq('id', postId)
        .single();

    if (postError || !post || post.author_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized to view requests for this post' });
    }

    const { data, error } = await supabase
        .from('join_requests')
        .select('*, profiles(username, avatar)')
        .eq('post_id', postId)
        .eq('status', 'accepted')

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
})


// host check pending requests for their post
router.get('/:id/requests/pending', authMiddleware, async (req, res) => {
    const { id: postId } = req.params;
    const userId = req.user.id;

    const { data: post, error: postError } = await supabase
        .from('posts')
        .select('author_id')
        .eq('id', postId)
        .single();

    if (postError || !post || post.author_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized to view requests for this post' });
    }

    const { data, error } = await supabase
        .from('join_requests')
        .select('*, profiles(username, avatar)')
        .eq('post_id', postId)
        .eq('status', 'pending')

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
})

// accept / reject pending requests
router.patch('/requests/:requestId', authMiddleware, async (req, res) => {
    const { requestId } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    console.log('handling request');

    if (!['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    const { data: requestData, error: fetchError } = await supabase
        .from('join_requests')
        .select('post_id, posts(author_id)')
        .eq('id', requestId)
        .single();

    if (fetchError || !requestData) {
        return res.status(404).json({ error: 'Request not found' })
    }

    if (requestData.posts.author_id !== userId) {
        return res.status(400).json({ error: 'Unauthorized to modify this request' })
    }

    const { error } = await supabase
        .from('join_requests')
        .update({ status })
        .eq('id', requestId);

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    if (status == 'accepted') {
        await supabase.rpc('increment_member_count', { post_id: requestData.post_id });
    }

    return res.status(200).json({ message: `Request ${status}` });

})


export default router;
