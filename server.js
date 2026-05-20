import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/ping', (req, res) => {
    res.json({ message: 'pong from Node!' });
});

app.listen(3000, () => console.log('Backend running on port 3000'));
