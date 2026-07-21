import mongoose from "mongoose";


const betSchema = new mongoose.Schema(
  {

    // User who placed bet

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },


    // Game reference

    game: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Game",
      required: true,
    },


    period: {
      type: String,
      required: true,
    },


    // Bet Type

    type: {
      type: String,
      enum: [
        "color",
        "number",
        "size",
      ],
      required: true,
    },


    // Selected Option

    value: {

      type: String,

      required: true,

    },


    // Amount user placed

    amount: {

      type: Number,

      required: true,

      min: 1,

    },


    // Result

    result: {

      type: String,

      enum: [
        "pending",
        "win",
        "lose",
      ],

      default: "pending",

    },


    // Winning money

    winningAmount: {

      type: Number,

      default: 0,

    },


    // Settlement status

    settlement: {

      type: Boolean,

      default: false,

    },


  },
  {
    timestamps: true,
  }
);



const Bet = mongoose.model(
  "Bet",
  betSchema
);



export default Bet;