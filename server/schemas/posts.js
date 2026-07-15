import { z } from 'zod';

export const createPostSchema = z.object({
  postId: z.string().optional(),
  communityId: z.string().optional(),
  title: z.string().min(1, 'Title is required').max(100, 'Title must be at most 100 characters'),
  description: z.string().min(1, 'Description is required').max(2000, 'Description must be at most 2000 characters'),
  imageUrl: z.string().optional(),
  moreDetails: z.string().optional(),
  requirements: z.string().optional(),
  memberLimit: z.coerce.number().int().positive('Member limit must be positive').optional().nullable(),
  deadline: z.string().optional().nullable(),
  isAnonymous: z.boolean().optional()
});

export const joinRequestSchema = z.object({
  message: z.string().optional()
});

export const updateRequestSchema = z.object({
  status: z.enum(['accepted', 'rejected'])
});

export const pushTokenSchema = z.object({
  token: z.string().min(1, 'Token is required')
});
