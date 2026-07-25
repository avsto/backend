import Game from "../models/Game.js";
import Bet from "../models/Bet.js";
import Wallet from "../models/Wallet.js";
import Setting from "../models/Setting.js";

let ioInstance = null;

// ==============================
// Socket
// ==============================

export const setSocket = (io) => {
  ioInstance = io;
};

// ==============================
// Settings Cache
// ==============================

let settingsCache = null;

export const refreshSettings = async () => {
  try {
    let settings = await Setting.findOne();

    if (!settings) {
      settings = await Setting.create({});
    }

    settingsCache = settings;

    console.log("✅ Settings Reloaded");
  } catch (err) {
    console.log("Settings Load Error:", err);
  }
};

export const getSettings = async () => {
  if (!settingsCache) {
    await refreshSettings();
  }

  return settingsCache;
};

// ==============================
// Helpers
// ==============================

// Generate Unique Period

const generatePeriod = () => {
  return Date.now().toString();
};

// Number -> Color

const getColor = (number) => {
  if (number === 0 || number === 5) {
    return "violet";
  }

  return number % 2 === 0 ? "red" : "green";
};

// Number -> Size

const getSize = (number) => {
  return number >= 5 ? "big" : "small";
};

// Emit Wallet Balance

const emitWallet = async (userId) => {
  if (!ioInstance) return;

  const wallet = await Wallet.findOne({
    user: userId,
  });

  if (!wallet) return;

  ioInstance.emit(`wallet_${userId}`, {
    balance: wallet.balance,
  });
};

// Emit Game Result

const emitGameResult = (game) => {
  if (!ioInstance) return;

  ioInstance.emit("gameResult", game);
};

// Emit New Game

const emitNewGame = (game) => {
  if (!ioInstance) return;

  ioInstance.emit("newGame", game);
};

// ==============================
// Sleep Helper
// ==============================

const delay = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

// ==============================
// Calculate Result Values
// ==============================

const createResult = (number) => {
  return {
    number,

    color: getColor(number),

    size: getSize(number),
  };
};

// =====================================
// Calculate Total Payout
// =====================================

const calculatePayout = async (result, bets, settings) => {
  let payout = 0;

  for (const bet of bets) {
    // Number

    if (bet.type === "number" && Number(bet.value) === result.number) {
      payout += bet.amount * settings.numberMultiplier;
    }

    // Color
    else if (
      bet.type === "color" &&
      bet.value.toLowerCase() === result.color.toLowerCase()
    ) {
      payout += bet.amount * settings.colorMultiplier;
    }

    // Size
    else if (
      bet.type === "size" &&
      bet.value.toLowerCase() === result.size.toLowerCase()
    ) {
      payout += bet.amount * settings.sizeMultiplier;
    }
  }

  return payout;
};

// =====================================
// RTP Helper Functions
// =====================================

// Number -> Available Colors
const getNumberColors = (number) => {
  if (number === 0) return ["red", "violet"];

  if (number === 5) return ["green", "violet"];

  return number % 2 === 0 ? ["red"] : ["green"];
};

// -------------------------------------
// Big / Small Statistics
// -------------------------------------

const getSizeStats = (bets) => {
  const stats = {
    big: {
      amount: 0,
      bets: 0,
    },
    small: {
      amount: 0,
      bets: 0,
    },
  };

  for (const bet of bets) {
    if (bet.type !== "size") continue;

    const key = bet.value.toLowerCase();

    if (!stats[key]) continue;

    stats[key].amount += bet.amount;
    stats[key].bets++;
  }

  return stats;
};

// -------------------------------------
// Color Statistics
// -------------------------------------

const getColorStats = (bets) => {
  const stats = {
    red: {
      amount: 0,
      bets: 0,
    },

    green: {
      amount: 0,
      bets: 0,
    },

    violet: {
      amount: 0,
      bets: 0,
    },
  };

  for (const bet of bets) {
    if (bet.type !== "color") continue;

    const key = bet.value.toLowerCase();

    if (!stats[key]) continue;

    stats[key].amount += bet.amount;
    stats[key].bets++;
  }

  return stats;
};

// -------------------------------------
// Number Statistics
// -------------------------------------

const getNumberStats = (bets) => {
  const stats = {};

  for (let i = 0; i <= 9; i++) {
    stats[i] = {
      number: i,

      amount: 0,

      bets: 0,
    };
  }

  for (const bet of bets) {
    if (bet.type !== "number") continue;

    const num = Number(bet.value);

    if (!stats[num]) continue;

    stats[num].amount += bet.amount;

    stats[num].bets++;
  }

  return stats;
};

// -------------------------------------
// Decide Winner Between Two Options
// -------------------------------------

const chooseLowest = (first, second) => {
  // No bet always wins

  if (first.amount === 0 && first.bets === 0) return "first";

  if (second.amount === 0 && second.bets === 0) return "second";

  // Lowest Amount

  if (first.amount !== second.amount)
    return first.amount < second.amount ? "first" : "second";

  // Lowest Bets

  if (first.bets !== second.bets)
    return first.bets < second.bets ? "first" : "second";

  // Random

  return Math.random() > 0.5 ? "first" : "second";
};

// -------------------------------------
// Pick Lowest Color
// -------------------------------------

const pickLowestColor = (colors, colorStats) => {
  let winner = colors[0];

  for (let i = 1; i < colors.length; i++) {
    const result = chooseLowest(colorStats[winner], colorStats[colors[i]]);

    if (result === "second") winner = colors[i];
  }

  return winner;
};

// -------------------------------------
// Pick Lowest Number
// -------------------------------------

const pickLowestNumber = (numbers, numberStats) => {
  let winner = numbers[0];

  for (let i = 1; i < numbers.length; i++) {
    const result = chooseLowest(numberStats[winner], numberStats[numbers[i]]);

    if (result === "second") winner = numbers[i];
  }

  return winner;
};

// =====================================
// Smart RTP Engine
// Big/Small -> Color -> Number
// =====================================

const getRTPResult = async (bets) => {
  // --------------------------
  // Statistics
  // --------------------------

  const sizeStats = getSizeStats(bets);
  const colorStats = getColorStats(bets);
  const numberStats = getNumberStats(bets);

  // --------------------------
  // STEP 1 : Choose Size
  // --------------------------

  let selectedSize;

  const sizeWinner = chooseLowest(sizeStats.small, sizeStats.big);

  selectedSize = sizeWinner === "first" ? "small" : "big";

  console.log("Selected Size :", selectedSize);

  // --------------------------
  // STEP 2 : Available Numbers
  // --------------------------

  const availableNumbers =
    selectedSize === "small" ? [0, 1, 2, 3, 4] : [5, 6, 7, 8, 9];

  // --------------------------
  // STEP 3 : Available Colors
  // --------------------------

  let availableColors = [];

  availableNumbers.forEach((number) => {
    getNumberColors(number).forEach((color) => {
      if (!availableColors.includes(color)) availableColors.push(color);
    });
  });

  const selectedColor = pickLowestColor(availableColors, colorStats);

  console.log("Selected Color :", selectedColor);

  // --------------------------
  // STEP 4 : Valid Numbers
  // --------------------------

  const validNumbers = availableNumbers.filter((number) =>
    getNumberColors(number).includes(selectedColor),
  );

  console.log("Valid Numbers :", validNumbers);

  // --------------------------
  // STEP 5 : Final Number
  // --------------------------

  const selectedNumber = pickLowestNumber(validNumbers, numberStats);

  console.log("Selected Number :", selectedNumber);

  // --------------------------
  // Final Result
  // --------------------------

  return createResult(selectedNumber);
};

// =====================================
// Manual Result
// =====================================

const getManualResult = (settings) => {
  return {
    number: Number(settings.manualNumber),

    color: settings.manualColor,

    size: settings.manualSize,
  };
};

// =====================================
// Auto Result
// =====================================

const getAutoResult = () => {
  const number = Math.floor(Math.random() * 10);

  return createResult(number);
};

// =====================================
// Generate Result
// =====================================
// =====================================
// Generate Result
// =====================================

export const generateResult = async (game) => {
  await refreshSettings();

  const settings = await getSettings();

  // -----------------------------
  // Manual Mode
  // -----------------------------
  if (settings.resultMode === "manual") {
    console.log("Manual Result");

    return {
      number: Number(settings.manualNumber),
      color: getColor(Number(settings.manualNumber)),
      size: getSize(Number(settings.manualNumber)),
    };
  }

  // -----------------------------
  // RTP Mode
  // -----------------------------
  if (settings.resultMode === "rtp" || settings.rtpEnabled) {
    console.log("RTP Result");

    const bets = await Bet.find({
      game: game._id,
      result: "pending",
    });

    return await getRTPResult(bets, settings);
  }

  // -----------------------------
  // Auto Mode
  // -----------------------------
  console.log("Auto Result");

  const number = Math.floor(Math.random() * 10);

  return {
    number,
    color: getColor(number),
    size: getSize(number),
  };
};

// =====================================
// Process Bets
// =====================================

export const processBets = async (game) => {
  try {
    await refreshSettings();

    const settings = await getSettings();

    const bets = await Bet.find({
      game: game._id,
      result: "pending",
    });

    console.log(`Settling ${bets.length} Bets`);

    let totalBetAmount = 0;
    let totalPlayers = new Set();

    for (const bet of bets) {
      totalBetAmount += bet.amount;

      totalPlayers.add(bet.user.toString());

      let isWinner = false;

      let winningAmount = 0;

      // ======================
      // Number
      // ======================

      if (bet.type === "number" && Number(bet.value) === game.result.number) {
        isWinner = true;

        winningAmount = bet.amount * settings.numberMultiplier;
      }

      // ======================
      // Color
      // ======================
      else if (
        bet.type === "color" &&
        bet.value.toLowerCase() === game.result.color.toLowerCase()
      ) {
        isWinner = true;

        winningAmount = bet.amount * settings.colorMultiplier;
      }

      // ======================
      // Size
      // ======================
      else if (
        bet.type === "size" &&
        bet.value.toLowerCase() === game.result.size.toLowerCase()
      ) {
        isWinner = true;

        winningAmount = bet.amount * settings.sizeMultiplier;
      }

      // ======================
      // Winner
      // ======================

      if (isWinner) {
        const wallet = await Wallet.findOne({
          user: bet.user,
        });

        if (wallet) {
          wallet.balance += winningAmount;

          wallet.transactions.unshift({
            type: "win",

            amount: winningAmount,

            status: "success",

            referenceId: game.period,

            description: `Game Win (${game.period})`,
          });

          await wallet.save();

          await emitWallet(bet.user);
        }

        bet.result = "win";

        bet.winningAmount = winningAmount;
      }

      // ======================
      // Lose
      // ======================
      else {
        bet.result = "lose";

        bet.winningAmount = 0;
      }

      bet.settlement = true;

      await bet.save();
    }

    // ======================
    // Update Game Stats
    // ======================

    game.totalBetAmount = totalBetAmount;

    game.totalPlayers = totalPlayers.size;

    await game.save();

    console.log("Settlement Completed");
  } catch (err) {
    console.log("Settlement Error", err);
  }
};

// =====================================
// Current Running Game
// =====================================

let currentGame = null;

// =====================================
// Start New Game
// =====================================

const startNewGame = async () => {
  try {
    await refreshSettings();

    const settings = await getSettings();

    // Maintenance Mode

    if (settings.maintenanceMode) {
      console.log("Maintenance Mode Enabled");

      return setTimeout(startNewGame, 5000);
    }

    // Close old running games

    await Game.updateMany(
      {
        status: "running",
      },
      {
        $set: {
          status: "completed",
          endTime: new Date(),
        },
      },
    );

    const period = generatePeriod();

    currentGame = await Game.create({
      period,

      status: "running",

      startTime: new Date(),
    });

    console.log("Game Started :", period);

    emitNewGame(currentGame);

    // Wait Game Duration

    await delay(settings.gameDuration * 1000);

    await finishGame();
  } catch (err) {
    console.log(err);

    setTimeout(startNewGame, 3000);
  }
};

// =====================================
// Finish Game
// =====================================

const finishGame = async () => {
  try {
    await refreshSettings();

    const settings = await getSettings();

    currentGame = await Game.findOne({
      status: "running",
    }).sort({
      createdAt: 1,
    });

    if (!currentGame) {
      console.log("No Running Game");

      return startNewGame();
    }

    // Generate Result

    currentGame.result = await generateResult(currentGame);

    currentGame.status = "completed";

    currentGame.endTime = new Date();

    currentGame.resultTime = new Date();

    await currentGame.save();

    // Settlement

    await processBets(currentGame);

    // Socket Result

    emitGameResult(currentGame);

    console.log("Result Declared", currentGame.result);

    // Break Time

    await delay(settings.breakTime * 1000);

    await startNewGame();
  } catch (err) {
    console.log(err);

    setTimeout(startNewGame, 3000);
  }
};

// =====================================
// Recover Running Game
// =====================================

const recoverGame = async () => {
  const runningGame = await Game.findOne({
    status: "running",
  });

  if (!runningGame) {
    return startNewGame();
  }

  currentGame = runningGame;

  await finishGame();
};

// =====================================
// Start Engine
// =====================================

export const startGameEngine = async () => {
  console.log("Starting Game Engine...");

  await refreshSettings();

  await recoverGame();
};
