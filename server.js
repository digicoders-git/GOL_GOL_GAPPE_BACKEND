import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./config/db.js";

dotenv.config();
connectDB();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
