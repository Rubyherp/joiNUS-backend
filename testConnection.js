console.log("A. Script started");
import express from 'express';
import cors from 'cors';
import { supabase } from './supabaseClient.js';

console.log("B. Imports finished");

const app = express();

console.log("C. Express instance created");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log("D. Middleware applied");

// test connection with frontend
app.get('/ping', (req, res) => {
    res.json({ message: 'pong from Node!' });
});

app.post('/register', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ message: 'User created successfully', user: data.user });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ token: data.session.access_token, user: data.user });
});

console.log("E. Routes defined. About to listen...");

app.listen(3000, () => console.log('Backend running on port 3000')).on('error', (err) => {
    console.error("❌ SERVER FAILED TO START:", err.message);
});
