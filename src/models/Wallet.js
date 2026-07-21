import mongoose from "mongoose";


const walletSchema = new mongoose.Schema(
  {

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },


    balance: {
      type: Number,
      default: 0,
    },


    transactions: [
      {
        type: {
          type: String,
          enum: [
            "deposit",
            "withdraw",
            "bet",
            "win",
            "refund",
          ],
          required: true,
        },


        amount: {
          type: Number,
          required: true,
        },


        status: {
          type: String,
          enum: [
            "pending",
            "success",
            "failed",
            "approved",
            "rejected",
          ],
          default: "pending",
        },


        referenceId: {
          type: String,
          default: "",
        },


        description: {
          type: String,
          default: "",
        },


        createdAt: {
          type: Date,
          default: Date.now,
        },

      },
    ],


  },
  {
    timestamps: true,
  }
);



const Wallet = mongoose.model(
  "Wallet",
  walletSchema
);



export default Wallet;