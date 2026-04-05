import dotenv from "dotenv";
import http from "http";
import app from "./app.js";
import connectDB from "./config/db.js";
import { initIO } from "./config/socket.js";

dotenv.config();
connectDB();

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
initIO(server);

server.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
