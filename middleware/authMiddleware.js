import { supabase } from "../supabaseClient.js"

const authMiddleware = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const { data, error } = await supabase.auth.getUser(token)
        if (error) {
            return res.status(401).json({
                error: 'Invalid Token p1'
            })
        }
        req.user = data.user;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid Token p2' });
    }
}

export default authMiddleware;
