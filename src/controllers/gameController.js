import Game from "../models/Game.js";
import Setting from "../models/Setting.js";
// ==============================
// Current Game
// GET /api/game/current
// ==============================

export const currentGame = async (req, res) => {
  try {
    const game = await Game.findOne({
      status: {
        $in: ["running", "pending"],
      },
    }).sort({
      createdAt: -1,
    });

    if (!game) {
      return res.status(404).json({
        message: "No active game",
      });
    }

    // Load Settings
    let settings = await Setting.findOne();

    if (!settings) {
      settings = await Setting.create({});
    }

    res.json({
      ...game.toObject(),

      gameDuration: settings.gameDuration,
      breakTime: settings.breakTime,

      minimumBet: settings.minimumBet,
      maximumBet: settings.maximumBet,

      bettingEnabled: settings.bettingEnabled,
      maintenanceMode: settings.maintenanceMode,

      resultMode: settings.resultMode,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: error.message,
    });
  }
};
// ==============================
// Result History
// GET /api/game/history
// ==============================

export const gameHistory = async (req, res) => {
  try {
    const games = await Game.find({
      status: "completed",
    })
      .sort({
        createdAt: -1,
      })
      .limit(20);

    res.json(games);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// ==============================
// Admin Create Result
// POST /api/game/result
// ==============================

export const createResult = async (req, res) => {
  try {
    const { period, number, color, size } = req.body;

    const game = await Game.create({
      period,

      result: {
        number,
        color,
        size,
      },

      status: "completed",

      resultTime: new Date(),
    });

    res.json({
      message: "Result created",

      game,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
