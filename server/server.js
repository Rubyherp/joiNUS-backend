import app from "./app.js";
import { createServer } from "http";
import { Server } from "socket.io";
import { supabase } from "../supabaseClient.js";

// explicitly creating http server
const httpServer = createServer(app);

// creating websocket server
export const io = new Server(httpServer, {
    cors: { origin: "*" }
});

// auth middleware for socket 
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('No token'));
    }

    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
        return next(new Error('Invalid token'));
    }

    socket.userId = data.user.id;
    next();
})

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);

    socket.on('join_dm', (otherUserId) => {
        const roomId = [socket.userId, otherUserId].sort().join('_');
        socket.join(`dm:${roomId}`);
        console.log(`${socket.userId} joined dm: ${roomId}`);
    })

    socket.on('leave_dm', (otherUserId) => {
        const roomId = [socket.userId, otherUserId].sort().join('_');
        socket.leave(`dm:${roomId}`);
    })

    socket.on('send_dm', async ({ otherUserId, content }) => {
        const roomId = [socket.userId, otherUserId].sort().join('_');

        const { data, error } = await supabase
            .from('direct_messages')
            .insert({
                room_id: roomId,
                sender_id: socket.userId,
                content,
            })
            .select('*, profiles(username, avatar)')
            .single();

        if (error) {
            console.log('DM insert error', error);
            socket.emit('error', { message: 'Failed to send message' });
            return;
        }

        io.to(`dm:${roomId}`).emit('new_dm', data);
    })

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.userId}`);
    });

})

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Backend running on PORT: ${PORT}`));










