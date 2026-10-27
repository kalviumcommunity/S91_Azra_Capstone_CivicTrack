
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const path = require("path");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const app = express();

app.use(cors());
app.use(express.json());

const Complaint = require("./models/Complaint");
const User = require("./models/User");

const PORT = process.env.PORT || 5001;

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

// Check required environment variables
if (!process.env.MONGO_URI) {
  console.error("Error: MONGO_URI is missing from server/.env");
  process.exit(1);
}

// JWT AUTHORIZATION MIDDLEWARE
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token || !process.env.JWT_SECRET) {
    return res.status(401).json({
      success: false,
      message: "Invalid token or authentication configuration.",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload.",
      });
    }

    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
}

// REGISTER WITH EMAIL AND PASSWORD
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      !name?.trim() ||
      !email?.trim() ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email, and password of at least 8 characters are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered.",
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful.",
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Registration error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email already registered.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Registration failed.",
    });
  }
});

// LOGIN WITH EMAIL AND PASSWORD
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || typeof password !== "string" || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "JWT_SECRET is missing from server/.env.",
      });
    }

    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Login failed.",
    });
  }
});

// GOOGLE AUTHENTICATION
app.post("/api/auth/google", async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required.",
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Google authentication is not configured.",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (
      !payload ||
      !payload.sub ||
      !payload.email ||
      payload.email_verified !== true
    ) {
      return res.status(401).json({
        success: false,
        message: "Google account could not be verified.",
      });
    }

    const normalizedEmail = payload.email.toLowerCase();

    let user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      user = await User.create({
        name: payload.name || normalizedEmail.split("@")[0],
        email: normalizedEmail,
        password: crypto.randomBytes(32).toString("hex"),
      });
    }

    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      success: true,
      message: "Google login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Google authentication error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Google authentication failed.",
    });
  }
});

// GET ALL COMPLAINTS (JWT required)
app.get("/api/complaints", verifyToken, async (req, res) => {
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
    console.error("GET complaints error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch complaints.",
    });
  }
});

// CREATE COMPLAINT (JWT required)
app.post("/api/complaints", verifyToken, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      location,
      status,
      priority,
    } = req.body;

    if (
      !title?.trim() ||
      !description?.trim() ||
      !category?.trim() ||
      !location?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Title, description, category, and location are required.",
      });
    }

    const complaintData = {
      ticketId: `CIVIC-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      title: title.trim(),
      description: description.trim(),
      category,
      location: location.trim(),
      status,
      priority,
      user: req.userId,
    };

    const complaint = await Complaint.create(complaintData);

    return res.status(201).json({
      success: true,
      message: "Complaint created successfully.",
      data: complaint,
    });
  } catch (error) {
    console.error("POST complaint error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to create complaint.",
    });
  }
});

// UPDATE COMPLAINT (JWT required)
app.put("/api/complaints/:id", verifyToken, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid complaint ID.",
      });
    }

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
        message: "Provide at least one valid field to update.",
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
        message: "Complaint not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Complaint updated successfully.",
      data: complaint,
    });
  } catch (error) {
    console.error("PUT complaint error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to update complaint.",
    });
  }
});

// CONNECT TO MONGODB AND START SERVER
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
