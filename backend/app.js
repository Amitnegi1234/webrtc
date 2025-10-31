import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./db/db.js";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import cors from "cors";
import { userRouter } from "./routes/user.js";
import { createServer } from "http";
import { Server } from "socket.io";

dotenv.config();

const app = express();

// ✅ Setup allowed origins
const allowedOrigins = [process.env.CLIENT_URL];

// ✅ Middlewares
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ✅ Routes
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);

// ✅ Home route
app.get("/", (req, res) => {
  res.json({ message: "Subscribe to SLRTech — Server working ✅" });
});

const port = process.env.PORT || 3000;
const server = createServer(app);

// ✅ Connect to DB first, then initialize Socket.io
(async () => {
  try {
    await connectDB();
    console.log("✅ Successfully connected to the database");

    const io = new Server(server, {
      pingTimeout: 60000,
      cors: {
        origin: allowedOrigins[0],
        methods: ["GET", "POST"],
      },
    });

    let onlineUser = [];

    io.on("connection", (socket) => {
      console.log(" New connection:", socket.id);
      socket.emit("me", socket.id);

      socket.on("join", (user) => {
        if (!user || !user.id) return console.log("Invalid user");

        socket.join(user.id);

        const existingUser = onlineUser.find((u) => u.userId === user.id);
        if (existingUser) {
          existingUser.socketId = socket.id;
        } else {
          onlineUser.push({
            userId: user.id,
            name: user.name,
            socketId: socket.id,
          });
        }

        io.emit("online-users", onlineUser);
      });
      socket.on("callToUser",(data)=>{
        const call = onlineUser.find((user)=>user.userId===data.callToUserId)
        if(!call){
            socket.emit("userUnavailable",{message:`${call?.name} is offline`})
        }
        //emit an event to reciever
        io.to(call.socketId).emit("callToUser",{
            signal:data.signalData,
            from:data.from,
            name:data.name,
            email:data.email,
            profilepic:data.profilepic
        })
      })
      socket.on("call-ended",(data)=>{
        io.to(data.to).emit("callEnded",{
            name:data.name,
        })
      })

      socket.on("reject-call",(data)=>{
        io.to(data.to).emit("callRejected",{
            name:data.name,
            profilepic:data.profilepic
        })
      })
      socket.on("answeredCall",(data)=>{
        io.to(data.to).emit("callAccepted",{
            signal:data.signal,
            from:data.from
        })
      })
      socket.on("disconnect", () => {
        const user=onlineUser.find((u)=>u.socketId===socket.id)
        onlineUser = onlineUser.filter((u) => u.socketId !== socket.id);
        io.emit("online-users", onlineUser);
        socket.broadcast.emit("disconnected user", { disUser: socket.id });
        console.log(" Disconnected:", socket.id);
      });
    });

    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });

  } catch (error) {
    console.error("Database connection failed:", error.message);
  }
})();
