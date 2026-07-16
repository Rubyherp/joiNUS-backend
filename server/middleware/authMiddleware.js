import { supabase } from "../../supabaseClient.js";
import { AppError } from "../utils/AppError.js";

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
        throw new AppError('UNAUTHORIZED', 'No token provided', 401);
    }

    try {
        const { data, error } = await supabase.auth.getUser(token);
        if (error) {
            throw new AppError('UNAUTHORIZED', 'Invalid token', 401);
        }
        req.user = data.user;
        next();
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError('UNAUTHORIZED', 'Invalid token', 401);
    }
};

export default authMiddleware;
