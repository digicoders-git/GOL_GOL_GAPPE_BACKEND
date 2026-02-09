import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import kitchenRoutes from "./routes/kitchenRoutes.js";
import billingRoutes from "./routes/billingRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import billingAdminRoutes from "./routes/billingAdminRoutes.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get("/", (req, res) => {
  res.json({
    message: "Gol Gol Gappe Admin API 🚀",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      products: "/api/products",
      kitchens: "/api/kitchens",
      billing: "/api/billing",
      users: "/api",
      billingAdmin: "/api/billing-admin"
    }
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/kitchens", kitchenRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api", userRoutes);
app.use("/api/billing-admin", billingAdminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

export default app;
