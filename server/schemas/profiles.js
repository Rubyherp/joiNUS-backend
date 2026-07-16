import { z } from 'zod';

export const createProfileSchema = z.object({
    avatar: z.string().optional(),
    username: z.string().min(1, 'Username is required').max(30, 'Username must be at most 30 characters'),
    major: z.string().optional(),
    year: z.string().optional(),
    modules: z.union([z.string(), z.array(z.any())]).optional(),
    contact: z.string().optional(),
    email: z.string().optional(),
    about: z.string().optional(),
    skills: z.union([z.string(), z.array(z.any())]).optional(),
    experiences: z.union([z.string(), z.array(z.any())]).optional()
});
