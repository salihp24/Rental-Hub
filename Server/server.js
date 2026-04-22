  // Express API entry point: loads config, connects MongoDB, mounts middleware,
  // registers routes, and starts the HTTP server.
  import express from "express";
  import path from "path";
  import { fileURLToPath } from "url";
  import dotenv from "dotenv";
  import cors from "cors";
  import helmet from "helmet";
  import morgan from "morgan";
  import cookieParser from "cookie-parser";
  import rateLimit from "express-rate-limit";
  import http from "http";

  //Recreating, because ES module __dirname doesn’t exist - Useful for reading files, serving static content, etc.
  //convert the url to normal file path
  const __filename = fileURLToPath(import.meta.url);
  //Extracts the folder path from the file, Result:C:\project\src
  const __dirname = path.dirname(__filename);

  dotenv.config({ path: path.join(__dirname, ".env") });

  import connectDB from "./config/db.js";
  import errorHandler from "./middleware/errorHandler.js";
  // /handles unknown routes
  import notFound from "./middleware/notFound.js";
  import productRoutes from "./routes/productRoutes.js";
  import userRoutes from "./routes/userRoutes.js";
  import categoryRoutes from "./routes/categoryRoutes.js";

  const app = express();
  //useful for scaling, sockets later
  const server = http.createServer(app);

  app.use(helmet());
  app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }));
  //When a client sends a request to your API, Morgan prints useful info in the console
  app.use(morgan("dev"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  //read cookies (for auth)
  app.use(cookieParser());

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { status: "fail", message: "Too many requests, please try again later." },
  });
  app.use("/api", limiter);

  // Lightweight health check for local testing and monitoring.
  app.get("/api/v1/health", (req, res) => {
    res.status(200).json({
      status: "success",
      message: "RentHub API is running",
      environment: process.env.NODE_ENV,
    });
  });

  app.use("/api/v1/users", userRoutes);
  app.use("/api/v1/categories", categoryRoutes);
  app.use("/api/v1/products", productRoutes);

  app.use(notFound);
  //handles all errors globally
  app.use(errorHandler);

  const PORT = process.env.PORT || 5000;

  const startServer = async () => {
    await connectDB();

    server.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  };

  startServer();

  // Handle async failures that escape route-level error handling.
  process.on("unhandledRejection", (err) => {
    console.error("UNHANDLED REJECTION:", err.message);
    server.close(() => process.exit(1));
  });

  // Catch synchronous crashes so the process exits explicitly.
  process.on("uncaughtException", (err) => {
    console.error("UNCAUGHT EXCEPTION:", err.message);
    process.exit(1);
  });
