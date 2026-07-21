import Upi from "../models/Upi.js";

export const getUpi = async (req, res) => {
  try {
    const upis = await Upi.find({
      status: true,
    });

    if (upis.length === 0) {
      return res.status(404).json({
        message: "No UPI available",
      });
    }

    // Random UPI Select

    const randomUpi = upis[Math.floor(Math.random() * upis.length)];

    res.status(200).json({
      upiId: randomUpi.upiId,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
