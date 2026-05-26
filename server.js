import express from 'express';
import cors from 'cors';
import { supabase } from './supabaseClient.js';
import authMiddleware from './middleware/authMiddleware.js';
import multer from 'multer';

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({
    storage: multer.memoryStorage()
})

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// test connection with frontend
app.get('/ping', (req, res) => {
    res.json({ message: 'pong from Node!' });
});

// user sign up
// tested using postman first to see if it works
app.post('/register', async (req, res) => {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    })

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ message: 'User created successfully', user: data.user });

})

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    })

    if (error) {
        return res.status(400).json({ error: error.message });
    }

    // check if user has a profile in db
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .single();

    if (profileError && profileError.code !== 'PGRST116') {
        return res.status(500).json({ error: 'Failed to check profile' });
    }

    // jwt token for authorization not sure about the expiry tho =p
    return res.status(200).json({
        token: data.session.access_token,
        user: data.user,
        hasProfile: !!profile
    })
})

app.post('/profileCreation', authMiddleware, async (req, res) => {
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

    const { error } = await supabase
        .from('profiles')
        .insert({
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
            experiences,
        });

    if (error) {
        return res.status(400).json({ error: error.message });
    }
    return res.status(200).json({ message: 'Profile created successfully' })
})

app.get('/profile', authMiddleware, async (req, res) => {
    console.log(req.user);
    const userId = req.user.id;
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        return res.status(400).json({ error: error.message });
    }
    if (!data) {
        return res.status(404).json({ error: 'No Profile Found' });
    }

    return res.status(200).json(data);
})

app.post('/changeAvatar', authMiddleware, upload.single("avatar"), async (req, res) => {
    try {
        console.log("USER:", req.user);
        console.log("BODY:", req.body);
        console.log(req.file);
        const file = req.file;

        if (!file) {
            return res.status(404).json({ error: 'No file uploaded' });
        }

        const filePath = `${req.user.id}.jpg`;

        const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: true,
            });

        if (uploadError) {
            console.log("STORAGE ERROR:", uploadError);
            return res.status(400).json({ error: uploadError.message });
        }


        const { data } = supabase.storage
            .from("avatars")
            .getPublicUrl(filePath);

        const avatarUrl = data.publicUrl;

        const { error: dbError } = await supabase
            .from("profiles")
            .update({ avatar: avatarUrl })
            .eq('id', req.user.id);

        if (dbError) {
            return res.status(400).json({ error: dbError.message });
        }

        return res.status(200).json({ avatar: avatarUrl })

    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
})


//TODO: Add santization ig? in the future

app.listen(PORT, () => console.log(`Backend running on PORT: ${PORT}`));










