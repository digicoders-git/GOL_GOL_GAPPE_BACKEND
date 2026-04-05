import { Server } from "socket.io";

let io = null;

export const initIO = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    
    socket.on("join-kitchen", (kitchenId) => {
      socket.join(`kitchen-${kitchenId}`);
      console.log(`Socket ${socket.id} joined kitchen-${kitchenId}`);
    });
    
    socket.on("join-billing", (billingAdminId) => {
      socket.join(`billing-${billingAdminId}`);
      console.log(`Socket ${socket.id} joined billing-${billingAdminId}`);
    });
    
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
};

export const getIO = () => io;