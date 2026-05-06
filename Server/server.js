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
  import bookingRoutes from "./routes/bookingRoutes.js";
  import chatRoutes from "./routes/chatRoutes.js";
  import uploadRoutes from "./routes/uploadRoutes.js";
  import adminRoutes from "./routes/admin/adminRoutes.js";
  import registerChatSocket from "./socket/chatSocket.js";
  import Conversation from "./models/Conversation.js";

  const app = express();
  //useful for scaling, sockets later
  const server = http.createServer(app);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "img-src": ["'self'", "data:", "blob:", "https:"],
        },
      },
    })
  );
  const allowedOrigins = [
    process.env.CLIENT_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ].filter(Boolean);

  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }));
  
  // starts a Socket.IO server on the same HTTP server
  const io = registerChatSocket(server, allowedOrigins);
  app.set("io", io);
  //When a client sends a request to your API, Morgan prints useful info in the console
  app.use(morgan("dev"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  //read cookies (for auth)
  app.use(cookieParser());

  const isDevelopment = process.env.NODE_ENV !== "production";

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDevelopment ? 1000 : 100,
    skip: (req) => {
      if (req.path.startsWith("/v1/chat")) return true;
      if (isDevelopment) return true;
      return false;
    },
    message: { status: "fail", message: "Too many requests, please try again later." },
  });
  app.use("/api", apiLimiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDevelopment ? 50 : 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      status: "fail",
      message: "Too many login attempts, please try again later.",
    },
  });

  const chatLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 400,
    message: { status: "fail", message: "Too many chat requests, please slow down a bit." },
  });

  const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDevelopment ? 500 : 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: "fail", message: "Too many admin requests, please slow down." },
  });

  // Lightweight health check for local testing and monitoring.
  app.get("/api/v1/health", (req, res) => {
    res.status(200).json({
      status: "success",
      message: "RentHub API is running",
      environment: process.env.NODE_ENV,
    });
  });

  app.use("/api/v1/users/login", authLimiter);
  app.use("/api/v1/users/register", authLimiter);
  app.use("/api/v1/users", userRoutes);
  app.use("/api/v1/categories", categoryRoutes);
  app.use("/api/v1/products", productRoutes);
  app.use("/api/v1/bookings", bookingRoutes);
  app.use("/api/v1/chat", chatLimiter, chatRoutes);
  app.use("/api/v1/uploads", uploadRoutes);
  app.use("/api/v1/admin", adminLimiter, adminRoutes);

  app.use(notFound);
  //handles all errors globally
  app.use(errorHandler);

  const PORT = process.env.PORT || 5000;

  const ensureConversationIndexes = async () => {
    const collection = Conversation.collection;
    const indexes = await collection.indexes();
    const bookingIndex = indexes.find((index) => index.name === "booking_1");

    if (bookingIndex && !bookingIndex.partialFilterExpression) {
      await collection.dropIndex("booking_1");
    }

    await Conversation.syncIndexes();
  };

  const startServer = async () => {
    await connectDB();
    await ensureConversationIndexes();

    server.once("error", (err) => {
      if (err?.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use. Stop the existing process or start with a different PORT.`);
        process.exit(1);
      }
      throw err;
    });

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
