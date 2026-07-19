export const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        const details = result.error.flatten().fieldErrors;
        // console.log(`[validation] Failed for ${req.path}:`, JSON.stringify(details));
        return res.status(400).json({
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid request body',
                details
            }
        });
    }
    req.body = result.data;
    next();
};
