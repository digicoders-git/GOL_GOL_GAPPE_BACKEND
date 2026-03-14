import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import kitchenRoutes from "./routes/kitchenRoutes.js";
import billingRoutes from "./routes/billingRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import billingAdminRoutes from "./routes/billingAdminRoutes.js";
import offerRoutes from "./routes/offerRoutes.js";
import testRoutes from "./routes/testRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get("/", (req, res) => {
  res.json({
    message: "Gol Gol Gappe Admin API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      products: "/api/products",
      kitchens: "/api/kitchens",
      billing: "/api/billing",
      orders: "/api/orders",
      users: "/api",
      billingAdmin: "/api/billing-admin",
      offers: "/api/offers"
    }
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/kitchens", kitchenRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api", userRoutes);
app.use("/api/billing-admin", billingAdminRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/test", testRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('=== GLOBAL ERROR HANDLER ===');
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  console.error('Request URL:', req.url);
  console.error('Request Method:', req.method);
  console.error('Request Body:', req.body);
  
  res.status(err.status || 500).json({ 
    success: false,
    message: err.message || "Something went wrong!",
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

export default app;
