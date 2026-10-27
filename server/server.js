
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Import Complaint model
const Complaint = require("./models/Complaint");

// Basic API test route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "CIVIC track API is running",
  });
});

// GET API: Fetch all complaints
app.get("/api/complaints", async (req, res) => {
  try {
    const complaints = await Complaint.find().lean();

    return res.status(200).json({
      success: true,
      count: complaints.length,
      data: complaints,
    });
  } catch (error) {
    console.error("Error fetching complaints:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch complaints",
      error: error.message,
    });
  }
});

// Connect to MongoDB and start the server
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
