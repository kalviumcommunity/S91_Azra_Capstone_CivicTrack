
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const Complaint = require("./models/Complaint");
const User = require("./models/User");

// POST API: Create a user
app.post("/api/users", async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
      });
    }

    const user = await User.create({ name, email });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  } catch (error) {
    console.error("Create user error:", error.message);
    return res.status(400).json({
      success: false,
      message: "Failed to create user",
    });
  }
});

// GET API: Fetch all complaints and their associated users
app.get("/api/complaints", async (req, res) => {
  try {
    const complaints = await Complaint.find()
      .populate("user", "name email")
      .lean();

    return res.status(200).json({
      success: true,
      count: complaints.length,
      data: complaints,
    });
  } catch (error) {
    console.error("GET error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch complaints",
    });
  }
});

// POST API: Create a complaint
app.post("/api/complaints", async (req, res) => {
  try {
    const { title, description, category, location, status, priority, user } =
      req.body;

    if (!title || !description || !category || !location) {
      return res.status(400).json({
        success: false,
        message: "Title, description, category, and location are required",
      });
    }

    const complaintData = {
      ticketId: `CIVIC-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      title,
      description,
      category,
      location,
      status,
      priority,
    };

    if (user) {
      if (!mongoose.isValidObjectId(user)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      const existingUser = await User.findById(user);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      complaintData.user = user;
    }

    const complaint = await Complaint.create(complaintData);

    return res.status(201).json({
      success: true,
      message: "Complaint created successfully",
      data: complaint,
    });
  } catch (error) {
    console.error("POST error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to create complaint",
    });
  }
});

// PUT API: Update a complaint by ID
app.put("/api/complaints/:id", async (req, res) => {
  try {
    const allowedFields = [
      "title",
      "description",
      "category",
      "location",
      "status",
      "priority",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one valid field to update",
      });
    }

    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Complaint updated successfully",
      data: complaint,
    });
  } catch (error) {
    console.error("PUT error:", error.message);
    return res.status(400).json({
      success: false,
      message: "Failed to update complaint",
    });
  }
});

// Connect to MongoDB and start server
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
  });
