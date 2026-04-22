// const mongoose = require("mongoose");

// const pricingSchema = new mongoose.Schema({
//   type: {
//     type: String,
//     enum: ["hourly", "daily", "weekly", "monthly", "custom"],
//     required: true
//   },

//   price: {
//     type: Number,
//     required: true
//   },

//   minDuration: Number, 
//   maxDuration: Number,

//   fixedDuration: {
//     type: Boolean,
//     default: false 
//   }

// }, { _id: false });

// const availabilitySchema = new mongoose.Schema({
//   isAvailable: {
//     type: Boolean,
//     default: true
//   },

//   unavailableDates: [Date],

//   availableFrom: Date,
//   availableTo: Date

// }, { _id: false });

// const productSchema = new mongoose.Schema({

//   //  Owner Info
//   owner: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "User",
//     required: true
//   },

//   //  Basic Info
//   title: {
//     type: String,
//     required: true
//   },

//   description: String,

// // category you should create another schema and call its refernece here
//   category: {
//     type: String,
//     enum: ["electronics", "furniture", "music", "others"],
//     required: true
//   },

//   images: [String],


//   pricing: [pricingSchema],

  
//   securityDeposit: {
//     type: Number,
//     default: 0
//   },


//   location: {
//     address: String,
//     city: String,
//     state: String,
//     pincode: String,
//     coordinates: {
//       lat: Number,
//       lng: Number
//     }
//   },


//   availability: availabilitySchema,


//   condition: {
//     type: String,
//     enum: ["new", "like_new", "good", "fair"],
//     default: "good"
//   },

//   ratings: {
//     average: { type: Number, default: 0 },
//     count: { type: Number, default: 0 }
//   },


//   isActive: {
//     type: Boolean,
//     default: true
//   }

// }, { timestamps: true });

// module.exports = mongoose.model("Product", productSchema);