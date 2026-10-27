
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { OAuth2Client } = require("google-auth-library");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const Complaint = require("./models/Complaint");
const User = require("./models/User");

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

// ---------- FILE UPLOAD CONFIGURATION ----------

const uploadDirectory = path.join(__dirname, "uploads");

fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadDirectory);
  },

  filename: (req, file, callback) => {
    const extensionByMimeType = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
    };

    const extension = extensionByMimeType[file.mimetype];

    callback(
      null,
      `${Date.now()}-${require("crypto").randomUUID()}${extension}`
    );
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only JPEG, PNG, and WebP images are allowed.")
      );
    }

    callback(null, true);
  },
});

// Serve uploaded images through /uploads/<filename>
app.use("/uploads", express.static(uploadDirectory));

// ---------- JWT AUTHORIZATION ----------

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: "JWT authentication is not configured.",
    });
  }

  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.userId || !mongoose.isValidObjectId(decoded.userId)) {
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

// ---------- REGISTER ----------

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
        message: "Name, email, and password of at least 8 characters are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (await User.findOne({ email: normalizedEmail })) {
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

    return res.status(error.code === 11000 ? 409 : 500).json({
      success: false,
      message: error.code === 11000
        ? "Email already registered."
        : "Registration failed.",
    });
  }
});

// ---------- EMAIL/PASSWORD LOGIN ----------

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
        message: "JWT_SECRET is not configured.",
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

// ---------- GOOGLE LOGIN ----------

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

    if (!payload?.email || !payload.email_verified) {
      return res.status(401).json({
        success: false,
        message: "Google email could not be verified.",
      });
    }

    const email = payload.email.toLowerCase();
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name: payload.name || email.split("@")[0],
        email,
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
    console.error("Google login error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Google authentication failed.",
    });
  }
});

// ---------- GET COMPLAINTS ----------

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

// ---------- CREATE COMPLAINT WITH OPTIONAL IMAGE ----------

app.post(
  "/api/complaints",
  verifyToken,
  upload.single("image"),
  async (req, res) => {
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
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }

        return res.status(400).json({
          success: false,
          message: "Title, description, category, and location are required.",
        });
      }

      const complaintData = {
        ticketId: `CIVIC-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        location: location.trim(),
        user: req.userId,
      };

      if (status) complaintData.status = status;
      if (priority) complaintData.priority = priority;

      if (req.file) {
        complaintData.attachments = [
          `/uploads/${req.file.filename}`,
        ];
      }

      const complaint = await Complaint.create(complaintData);

      return res.status(201).json({
        success: true,
        message: "Complaint created successfully.",
        data: complaint,
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.error("POST complaint error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Failed to create complaint.",
      });
    }
  }
);

// ---------- UPLOAD IMAGE FOR AN EXISTING COMPLAINT ----------

app.post(
  "/api/complaints/:id/upload",
  verifyToken,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        if (req.file) fs.unlinkSync(req.file.path);

        return res.status(400).json({
          success: false,
          message: "Invalid complaint ID.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select an image to upload.",
        });
      }

      const complaint = await Complaint.findOne({
        _id: req.params.id,
        user: req.userId,
      });

      if (!complaint) {
        fs.unlinkSync(req.file.path);

        return res.status(404).json({
          success: false,
          message: "Complaint not found or you do not own it.",
        });
      }

      if (!Array.isArray(complaint.attachments)) {
        complaint.attachments = [];
      }

      complaint.attachments.push(`/uploads/${req.file.filename}`);
      await complaint.save();

      return res.status(200).json({
        success: true,
        message: "Image uploaded successfully.",
        data: complaint,
      });
    } catch (error) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      console.error("Upload error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Image upload failed.",
      });
    }
  }
);

// ---------- UPDATE COMPLAINT ----------

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

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one valid field to update.",
      });
    }

    const complaint = await Complaint.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found or you do not own it.",
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

// ---------- MULTER ERROR HANDLER ----------

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "Image must be 5 MB or smaller."
      : "Invalid upload request.";

    return res.status(400).json({
      success: false,
      message,
    });
  }

  if (error.message === "Only JPEG, PNG, and WebP images are allowed.") {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  console.error("Request error:", error.message);

  return res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
  });
});

// ---------- START SERVER ----------

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is missing from server/.env");
  process.exit(1);
}

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
