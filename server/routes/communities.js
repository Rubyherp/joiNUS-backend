import { Router } from "express";
import { supabase } from "../../supabaseClient.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

//get communities
router.get('/', authMiddleware, async (req, res) => {
    const { data, error } = await supabase
        .from('communities')
        .select('*');

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
})

// get community by id
router.get('/fetchCommunityById/:communityId', authMiddleware, async (req, res) => {
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
router.get('/following', authMiddleware, async (req, res) => {
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
router.post('/:id/follow', authMiddleware, async (req, res) => {
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
router.delete('/:id/follow', authMiddleware, async (req, res) => {
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

router.post('/requestNewCommunity', authMiddleware, async (req, res) => {
    const { name, description, category } = req.body;
    console.log('Request body:', req.body);
    const requesterId = req.user.id;

    if (!name || !description || !category) {
        return res.status(400).json({ error: 'name, description, and category are required =)' });
    }

    const communityPayload = {
        requester_id: requesterId,
        name,
        description,
        category
    }

    const { error } = await supabase
        .from('community_requests')
        .insert(communityPayload);

    if (error) {
        return res.status(400).json({ error: error.message });
    };

    return res.status(200).json({ message: 'Community request submitted successfully' });
})

export default router;
