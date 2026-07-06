import { Router } from "express";
import { supabase } from "../../supabaseClient.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

// fetch DM history
router.get('/dm/:otherUserId/messages', authMiddleware, async (req, res) => {
    const { otherUserId } = req.params;
    const roomId = [req.user.id, otherUserId].sort().join('_');

    const { data, error } = await supabase
        .from('direct_messages')
        .select('*, profiles(username, avatar)')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    return res.status(200).json(data);
})

// fetch all DM conversations for current user 
router.get('/conversations', authMiddleware, async (req, res) => {
    const userId = req.user.id;

    const { data: messages, error: msgError } = await supabase
        .from('direct_messages')
        .select('room_id, content, created_at, sender_id')
        .or(`room_id.like.${userId}_%,room_id.like.%_${userId}`)
        .order('created_at', { ascending: false });

    if (msgError) return res.status(400).json({ error: msgError.message });

    // Filter out only the latest message per room
    const roomMap = new Map();
    const otherUserIds = new Set();

    for (const msg of messages) {
        if (!roomMap.has(msg.room_id)) {
            roomMap.set(msg.room_id, msg);

            const [id1, id2] = msg.room_id.split('_');
            const otherUserId = id1 === userId ? id2 : id1;
            if (otherUserId) otherUserIds.add(otherUserId);
        }
    }

    let profilesMap = new Map();
    if (otherUserIds.size > 0) {
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, username, avatar')
            .in('id', Array.from(otherUserIds));

        if (!profileError && profiles) {
            profiles.forEach(p => profilesMap.set(p.id, p));
        }
    }

    const conversations = Array.from(roomMap.values()).map((msg) => {
        const [id1, id2] = msg.room_id.split('_');
        const otherUserId = id1 === userId ? id2 : id1;
        const profile = profilesMap.get(otherUserId) || null;

        return {
            room_id: msg.room_id,
            other_user_id: otherUserId,
            last_message: msg.content,
            last_message_at: msg.created_at,
            profile: profile ? { username: profile.username, avatar: profile.avatar } : null,
        };
    });

    return res.status(200).json(conversations);
});

export default router;
