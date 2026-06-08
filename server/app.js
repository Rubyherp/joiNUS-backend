import express from "express";
import cors from "cors";
import multer from "multer";

import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profiles.js";
import postRoutes from "./routes/posts.js";
import communityRoutes from "./routes/communities.js";

const app = express();
const upload = multer({
    storage: multer.memoryStorage()
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// test connection with frontend
app.get("/ping", (req, res) => {
    res.json({ message: "pong from Node!" });
});

app.use("/", authRoutes);
app.use("/", profileRoutes);
app.use("/posts", postRoutes);
app.use("/communities", communityRoutes);

export default app;
