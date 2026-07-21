import mongoose from "mongoose";

const upiSchema = new mongoose.Schema(
  {
    upiId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Upi", upiSchema);
