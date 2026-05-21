import express from 'express';
import cors from 'cors';
import { supabase } from './supabaseClient.js';

const app = express();
const PORT = process.env.PORT || 3000;

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
        password
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

    // jwt token for authorization not sure about the expiry tho =p
    return res.status(200).json({
        token: data.session.access_token,
        user: data.user
    })
})

//TODO: Add santization ig? in the future

app.listen(PORT, () => console.log(`Backend running on PORT: ${PORT}`));










