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

const generatePeriod = () => {
  return Date.now().toString();
};

const getColor = (number) => {
  if (number === 0 || number === 5) {
    return "violet";
  }
  return number % 2 === 0 ? "red" : "green";
};

const getSize = (number) => {
  return number >= 5 ? "big" : "small";
};

const emitWallet = async (userId) => {
  if (!ioInstance) return;

  const wallet = await Wallet.findOne({ user: userId });
  if (!wallet) return;

  ioInstance.emit(`wallet_${userId}`, {
    balance: wallet.balance,
  });
};

const emitGameResult = (game) => {
  if (!ioInstance) return;
  ioInstance.emit("gameResult", game);
};

const emitNewGame = (game) => {
  if (!ioInstance) return;
  ioInstance.emit("newGame", game);
};

const delay = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const createResult = (number) => {
  return {
    number,
    color: getColor(number),
    size: getSize(number),
  };
};

// =====================================
// Calculate Total Payout for a Candidate Result
// =====================================

const calculatePayout = (candidateNumber, bets, settings) => {
  const candidateColor = getColor(candidateNumber);
  const candidateSize = getSize(candidateNumber);

  let totalPayout = 0;
  let winningBetsCount = 0;

  for (const bet of bets) {
    let isWin = false;
    let betPayout = 0;

    // Number Bet
    if (bet.type === "number" && Number(bet.value) === candidateNumber) {
      isWin = true;
      betPayout = bet.amount * (settings.numberMultiplier || 9);
    }
    // Color Bet
    else if (bet.type === "color") {
      const betColor = bet.value.toLowerCase();

      // Standard Rules: 0 & 5 split payout between Red/Green and Violet
      if (candidateNumber === 0 && betColor === "red") {
        isWin = true;
        betPayout = bet.amount * (settings.colorMultiplier || 2) * 0.5; // Half win on 0
      } else if (candidateNumber === 0 && betColor === "violet") {
        isWin = true;
        betPayout = bet.amount * (settings.violetMultiplier || 4.5);
      } else if (candidateNumber === 5 && betColor === "green") {
        isWin = true;
        betPayout = bet.amount * (settings.colorMultiplier || 2) * 0.5; // Half win on 5
      } else if (candidateNumber === 5 && betColor === "violet") {
        isWin = true;
        betPayout = bet.amount * (settings.violetMultiplier || 4.5);
      } else if (betColor === candidateColor) {
        isWin = true;
        betPayout = bet.amount * (settings.colorMultiplier || 2);
      }
    }
    // Size Bet (Big / Small)
    else if (bet.type === "size") {
      if (bet.value.toLowerCase() === candidateSize) {
        isWin = true;
        betPayout = bet.amount * (settings.sizeMultiplier || 2);
      }
    }

    if (isWin) {
      totalPayout += betPayout;
      winningBetsCount++;
    }
  }

  return { totalPayout, winningBetsCount };
};

// =====================================
// Smart RTP Engine (Lowest Loss/Payout Winner)
// =====================================

const getRTPResult = async (bets, settings) => {
  // Candidate summary for all numbers from 0 to 9
  const outcomes = [];

  for (let num = 0; num <= 9; num++) {
    const { totalPayout, winningBetsCount } = calculatePayout(
      num,
      bets,
      settings,
    );
    outcomes.push({
      number: num,
      payout: totalPayout,
      betsCount: winningBetsCount,
    });
  }

  // Sort Outcomes:
  // 1. Lowest Total Payout (Sabse Kam Paisa Dene Me Mile)
  // 2. Lowest Winning Bets Count (Sabse Kam Bet Jeete)
  // 3. Randomize if tied
  outcomes.sort((a, b) => {
    if (a.payout !== b.payout) {
      return a.payout - b.payout;
    }
    if (a.betsCount !== b.betsCount) {
      return a.betsCount - b.betsCount;
    }
    return Math.random() - 0.5;
  });

  const winnerNumber = outcomes[0].number;
  console.log(
    `🏆 RTP Chosen Winner: Number ${winnerNumber} (Payout: ${outcomes[0].payout}, Winners: ${outcomes[0].betsCount})`,
  );

  return createResult(winnerNumber);
};

// =====================================
// Generate Result
// =====================================

export const generateResult = async (game) => {
  await refreshSettings();
  const settings = await getSettings();

  // 1. Manual Mode
  if (settings.resultMode === "manual") {
    console.log("🕹️ Manual Result Mode");
    const num = Number(settings.manualNumber);
    return createResult(num);
  }

  // 2. RTP Mode
  if (settings.resultMode === "rtp" || settings.rtpEnabled) {
    console.log("⚙️ RTP Result Mode");
    const bets = await Bet.find({
      game: game._id,
      result: "pending",
    });

    return await getRTPResult(bets, settings);
  }

  // 3. Auto Mode (Random)
  console.log("🎲 Auto Result Mode");
  const number = Math.floor(Math.random() * 10);
  return createResult(number);
};

// =====================================
// Process Bets (Settlement)
// =====================================

export const processBets = async (game) => {
  try {
    await refreshSettings();
    const settings = await getSettings();

    const bets = await Bet.find({
      game: game._id,
      result: "pending",
    });

    console.log(`Settling ${bets.length} Bets...`);

    let totalBetAmount = 0;
    let totalPlayers = new Set();

    for (const bet of bets) {
      totalBetAmount += bet.amount;
      totalPlayers.add(bet.user.toString());

      let isWinner = false;
      let winningAmount = 0;

      // Number Match
      if (bet.type === "number" && Number(bet.value) === game.result.number) {
        isWinner = true;
        winningAmount = bet.amount * (settings.numberMultiplier || 9);
      }
      // Color Match
      else if (bet.type === "color") {
        const betColor = bet.value.toLowerCase();

        if (game.result.number === 0 && betColor === "red") {
          isWinner = true;
          winningAmount = bet.amount * (settings.colorMultiplier || 2) * 0.5;
        } else if (game.result.number === 0 && betColor === "violet") {
          isWinner = true;
          winningAmount = bet.amount * (settings.violetMultiplier || 4.5);
        } else if (game.result.number === 5 && betColor === "green") {
          isWinner = true;
          winningAmount = bet.amount * (settings.colorMultiplier || 2) * 0.5;
        } else if (game.result.number === 5 && betColor === "violet") {
          isWinner = true;
          winningAmount = bet.amount * (settings.violetMultiplier || 4.5);
        } else if (betColor === game.result.color.toLowerCase()) {
          isWinner = true;
          winningAmount = bet.amount * (settings.colorMultiplier || 2);
        }
      }
      // Size Match
      else if (
        bet.type === "size" &&
        bet.value.toLowerCase() === game.result.size.toLowerCase()
      ) {
        isWinner = true;
        winningAmount = bet.amount * (settings.sizeMultiplier || 2);
      }

      // Update Bet Status & Wallet
      if (isWinner) {
        const wallet = await Wallet.findOne({ user: bet.user });
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
      } else {
        bet.result = "lose";
        bet.winningAmount = 0;
      }

      bet.settlement = true;
      await bet.save();
    }

    // Game stats update
    game.totalBetAmount = totalBetAmount;
    game.totalPlayers = totalPlayers.size;
    await game.save();

    console.log("✅ Settlement Completed");
  } catch (err) {
    console.log("Settlement Error:", err);
  }
};

// =====================================
// Game Engine Loops
// =====================================

let currentGame = null;

const startNewGame = async () => {
  try {
    await refreshSettings();
    const settings = await getSettings();

    if (settings.maintenanceMode) {
      console.log("Maintenance Mode Enabled");
      return setTimeout(startNewGame, 5000);
    }

    await Game.updateMany(
      { status: "running" },
      { $set: { status: "completed", endTime: new Date() } },
    );

    const period = generatePeriod();
    currentGame = await Game.create({
      period,
      status: "running",
      startTime: new Date(),
    });

    console.log("🎮 Game Started Period:", period);
    emitNewGame(currentGame);

    await delay((settings.gameDuration || 30) * 1000);
    await finishGame();
  } catch (err) {
    console.log("Start Game Error:", err);
    setTimeout(startNewGame, 3000);
  }
};

const finishGame = async () => {
  try {
    await refreshSettings();
    const settings = await getSettings();

    currentGame = await Game.findOne({ status: "running" }).sort({
      createdAt: 1,
    });

    if (!currentGame) {
      console.log("No Running Game Found");
      return startNewGame();
    }

    currentGame.result = await generateResult(currentGame);
    currentGame.status = "completed";
    currentGame.endTime = new Date();
    currentGame.resultTime = new Date();
    await currentGame.save();

    await processBets(currentGame);
    emitGameResult(currentGame);

    console.log("📊 Result Declared:", currentGame.result);

    await delay((settings.breakTime || 5) * 1000);
    await startNewGame();
  } catch (err) {
    console.log("Finish Game Error:", err);
    setTimeout(startNewGame, 3000);
  }
};

const recoverGame = async () => {
  const runningGame = await Game.findOne({ status: "running" });

  if (!runningGame) {
    return startNewGame();
  }

  currentGame = runningGame;
  await finishGame();
};

export const startGameEngine = async () => {
  console.log("🚀 Starting Game Engine...");
  await refreshSettings();
  await recoverGame();
};
