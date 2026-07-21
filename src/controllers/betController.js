import Game from "../models/Game.js";
import Bet from "../models/Bet.js";
import Wallet from "../models/Wallet.js";
import Setting from "../models/Setting.js";

// =====================================
// PLACE BET
// POST /api/bet/place
// =====================================

export const placeBet = async (req, res) => {
  try {
    const { type, value, amount } = req.body;

    // ==========================
    // Validation
    // ==========================

    if (!type || !value || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: "Type, Value and Amount are required",
      });
    }

    const betAmount = Number(amount);

    if (isNaN(betAmount) || betAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid bet amount",
      });
    }

    // ==========================
    // Load Settings
    // ==========================

    let settings = await Setting.findOne();

    if (!settings) {
      settings = await Setting.create({});
    }

    // Maintenance

    if (settings.maintenanceMode) {
      return res.status(400).json({
        success: false,
        message: "Server is under maintenance",
      });
    }

    // Betting Enabled

    if (!settings.bettingEnabled) {
      return res.status(400).json({
        success: false,
        message: "Betting is currently disabled",
      });
    }

    // Min Bet

    if (betAmount < settings.minimumBet) {
      return res.status(400).json({
        success: false,
        message: `Minimum bet amount is ₹${settings.minimumBet}`,
      });
    }

    // Max Bet

    if (betAmount > settings.maximumBet) {
      return res.status(400).json({
        success: false,
        message: `Maximum bet amount is ₹${settings.maximumBet}`,
      });
    }

    // ==========================
    // Validate Bet Type
    // ==========================

    const validTypes = ["number", "color", "size"];

    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bet type",
      });
    }

    // Number Validation

    if (type === "number") {
      const number = Number(value);

      if (isNaN(number) || number < 0 || number > 9) {
        return res.status(400).json({
          success: false,
          message: "Number must be between 0 and 9",
        });
      }
    }

    // Color Validation

    if (type === "color") {
      const colors = ["red", "green", "violet"];

      if (!colors.includes(String(value).toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: "Invalid color selected",
        });
      }
    }

    // Size Validation

    if (type === "size") {
      const sizes = ["big", "small"];

      if (!sizes.includes(String(value).toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: "Invalid size selected",
        });
      }
    }

    // ==========================
    // Current Running Game
    // ==========================

    const game = await Game.findOne({
      status: "running",
    });

    if (!game) {
      return res.status(400).json({
        success: false,
        message: "No active game found",
      });
    }

    // ==========================
    // Wallet
    // ==========================

    const wallet = await Wallet.findOne({
      user: req.user._id,
    });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    if (wallet.balance < betAmount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }

    // ==========================
    // Prevent Duplicate Bet (Optional)
    // ==========================

    const alreadyBet = await Bet.findOne({
      user: req.user._id,
      game: game._id,
      type,
      value: String(value),
      result: "pending",
    });

    if (alreadyBet) {
      return res.status(400).json({
        success: false,
        message: "You already placed this bet.",
      });
    }

    // ==========================
    // Deduct Wallet
    // ==========================

    wallet.balance -= betAmount;

    wallet.transactions.unshift({
      type: "bet",
      amount: betAmount,
      status: "success",
      referenceId: game.period,
      description: `${type.toUpperCase()} Bet (${value})`,
    });

    await wallet.save();

    // ==========================
    // Create Bet
    // ==========================

    const bet = await Bet.create({
      user: req.user._id,
      game: game._id,
      period: game.period,
      type,
      value: String(value).toLowerCase(),
      amount: betAmount,
    });

    // ==========================
    // Update Game Statistics
    // ==========================

    game.totalBetAmount += betAmount;

    const uniquePlayers = await Bet.distinct("user", {
      game: game._id,
    });

    game.totalPlayers = uniquePlayers.length;

    await game.save();

    // ==========================
    // Response
    // ==========================

    return res.status(201).json({
      success: true,
      message: "Bet placed successfully",
      balance: wallet.balance,
      gamePeriod: game.period,
      bet,
    });

  } catch (error) {
    console.error("Place Bet Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

// =====================================
// BET HISTORY
// GET /api/bet/history
// =====================================

export const betHistory = async (req, res) => {
  try {
    const bets = await Bet.find({
      user: req.user._id,
    })

      .populate("game")

      .sort({
        createdAt: -1,
      });

    res.json(bets);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
