import mongoose from "mongoose";
import path from "path";
import dotenv from "dotenv";
import Booking from "./Server/models/Booking.js";

dotenv.config({ path: path.join(process.cwd(), "Server", ".env") });
await mongoose.connect(process.env.MONGO_URI);
const bookingId = process.argv[2];
await Booking.updateOne({ _id: bookingId }, { $set: { endDate: new Date(Date.now() - 3600 * 1000), status: "active" } });
await mongoose.disconnect();
console.log("OK");
