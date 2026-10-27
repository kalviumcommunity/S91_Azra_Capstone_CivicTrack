
const mongoose = require("mongoose");

const complaintSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      unique: true,
      required: true,
      default: () =>
        `CIVIC-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      enum: ["Roads", "Electricity", "Water", "Waste", "Other"],
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["Pending", "In Progress", "Resolved"],
      default: "Pending",
    },

    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Complaint", complaintSchema);
