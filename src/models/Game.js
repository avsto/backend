import mongoose from "mongoose";

const gameSchema = new mongoose.Schema(
  {
    // Unique game period
    period: {
      type: String,
      required: true,
      unique: true,
    },

    // Winning Result

    result: {
      number: {
        type: Number,
        min: 0,
        max: 9,
      },

      color: {
        type: String,
        enum: ["green", "red", "violet"],
      },

      size: {
        type: String,
        enum: ["big", "small"],
      },
    },

    // Game status

    status: {
      type: String,

      enum: ["pending", "running", "completed"],

      default: "pending",
    },

    // Betting time

    startTime: {
      type: Date,
      default: Date.now,
    },

    endTime: {
      type: Date,
    },

    resultTime: {
      type: Date,
    },

    // Total money in game

    totalBetAmount: {
      type: Number,
      default: 0,
    },

    totalPlayers: {
      type: Number,
      default: 0,
    },

    // Admin override

    isManualResult: {
      type: Boolean,

      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const Game = mongoose.model("Game", gameSchema);

export default Game;
