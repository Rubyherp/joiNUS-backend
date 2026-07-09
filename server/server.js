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

    socket.on('send_dm', async ({ otherUserId, content, attachments }) => {
        const roomId = [socket.userId, otherUserId].sort().join('_');

        const { data, error } = await supabase
            .from('direct_messages')
            .insert({
                room_id: roomId,
                sender_id: socket.userId,
                content,
                has_attachments: attachments && attachments.length > 0,
            })
            .select('*, profiles(username, avatar)')
            .single();

        if (error) {
            console.log('DM insert error', error);
            socket.emit('error', { message: 'Failed to send message' });
            return;
        }

        if (attachments && attachments.length > 0) {
            const { error: attachmentError } = await supabase
                .from('message_attachments')
                .insert(
                    attachments.map(att => ({
                        message_id: data.id,
                        file_name: att.file_name,
                        file_size: att.file_size,
                        mime_type: att.mime_type,
                        storage_path: att.storage_path,
                    }))
                )

            if (attachmentError) {
                console.log('Attachment insert error', attachmentError);
            }
        }

        const { data: msgWithAttachments } = await supabase
            .from('direct_messages')
            .select('*, profiles(username, avatar), message_attachments!left(*)')
            .eq('id', data.id)
            .single();

        const attachmentsWithSignedUrls = await Promise.all(
            (msgWithAttachments.message_attachments || []).map(async (att) => {
                const { data: signedUrlData } = await supabase
                    .storage
                    .from('dm-attachments')
                    .createSignedUrl(att.storage_path, 3600);
                return {
                    ...att,
                    signedUrl: signedUrlData?.signedUrl || null,
                }
            })
        );

        msgWithAttachments.message_attachments = attachmentsWithSignedUrls;

        io.to(`dm:${roomId}`).emit('new_dm', msgWithAttachments);
    })

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.userId}`);
    });

})

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Backend running on PORT: ${PORT}`));










