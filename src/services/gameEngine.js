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

        if (
            bet.type === "number" &&
            Number(bet.value) === result.number
        ) {
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
// RTP Engine
// Lowest Payout Result
// =====================================

const getRTPResult = async (bets, settings) => {

    const results = [];

    for (let number = 0; number <= 9; number++) {

        const result = createResult(number);

        let totalPayout = 0;

        let totalBetAmount = 0;

        let winnerUsers = new Set();

        let winnerBets = 0;

        for (const bet of bets) {

            let isWinner = false;
            let payout = 0;

            // Number
            if (
                bet.type === "number" &&
                Number(bet.value) === result.number
            ) {

                isWinner = true;
                payout =
                    bet.amount *
                    settings.numberMultiplier;

            }

            // Color
            else if (
                bet.type === "color" &&
                bet.value.toLowerCase() === result.color
            ) {

                isWinner = true;
                payout =
                    bet.amount *
                    settings.colorMultiplier;

            }

            // Size
            else if (
                bet.type === "size" &&
                bet.value.toLowerCase() === result.size
            ) {

                isWinner = true;
                payout =
                    bet.amount *
                    settings.sizeMultiplier;

            }

            if (isWinner) {

                totalPayout += payout;

                totalBetAmount += bet.amount;

                winnerUsers.add(
                    bet.user.toString()
                );

                winnerBets++;

            }

        }

        results.push({

            result,

            payout: totalPayout,

            betAmount: totalBetAmount,

            users: winnerUsers.size,

            bets: winnerBets

        });

    }

    console.table(
        results.map(x => ({
            number: x.result.number,
            color: x.result.color,
            size: x.result.size,
            payout: x.payout,
            users: x.users,
            amount: x.betAmount,
            bets: x.bets
        }))
    );

    // Priority 1
    // Zero payout

    let candidates = results.filter(
        x => x.payout === 0
    );

    if (candidates.length) {

        return candidates[
            Math.floor(
                Math.random() * candidates.length
            )
        ].result;

    }

    // Priority 2
    // Lowest payout

    candidates = [...results].sort((a, b) => {

        if (a.payout !== b.payout)
            return a.payout - b.payout;

        if (a.users !== b.users)
            return a.users - b.users;

        if (a.betAmount !== b.betAmount)
            return a.betAmount - b.betAmount;

        if (a.bets !== b.bets)
            return a.bets - b.bets;

        return Math.random() - 0.5;

    });

    return candidates[0].result;

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

export const generateResult = async (game) => {

    await refreshSettings();

    const settings = await getSettings();

    // Manual Mode

    if (settings.resultMode === "manual") {

        console.log("Manual Result");

        return getManualResult(settings);

    }

    // RTP Mode

    if (
        settings.resultMode === "rtp" ||
        settings.rtpEnabled
    ) {

        console.log("RTP Result");

        const bets = await Bet.find({
            game: game._id,
            result: "pending",
        });

        return await getRTPResult(
            bets,
            settings
        );

    }

    // Auto

    console.log("Auto Result");

    return getAutoResult();

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

        console.log(
            `Settling ${bets.length} Bets`
        );

        let totalBetAmount = 0;
        let totalPlayers = new Set();

        for (const bet of bets) {

            totalBetAmount += bet.amount;

            totalPlayers.add(
                bet.user.toString()
            );

            let isWinner = false;

            let winningAmount = 0;

            // ======================
            // Number
            // ======================

            if (
                bet.type === "number" &&
                Number(bet.value) === game.result.number
            ) {

                isWinner = true;

                winningAmount =
                    bet.amount *
                    settings.numberMultiplier;

            }

            // ======================
            // Color
            // ======================

            else if (
                bet.type === "color" &&
                bet.value.toLowerCase() ===
                    game.result.color.toLowerCase()
            ) {

                isWinner = true;

                winningAmount =
                    bet.amount *
                    settings.colorMultiplier;

            }

            // ======================
            // Size
            // ======================

            else if (
                bet.type === "size" &&
                bet.value.toLowerCase() ===
                    game.result.size.toLowerCase()
            ) {

                isWinner = true;

                winningAmount =
                    bet.amount *
                    settings.sizeMultiplier;

            }

            // ======================
            // Winner
            // ======================

            if (isWinner) {

                const wallet =
                    await Wallet.findOne({
                        user: bet.user,
                    });

                if (wallet) {

                    wallet.balance += winningAmount;

                    wallet.transactions.unshift({

                        type: "win",

                        amount: winningAmount,

                        status: "success",

                        referenceId: game.period,

                        description:
                            `Game Win (${game.period})`,

                    });

                    await wallet.save();

                    await emitWallet(
                        bet.user
                    );

                }

                bet.result = "win";

                bet.winningAmount =
                    winningAmount;

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

        game.totalBetAmount =
            totalBetAmount;

        game.totalPlayers =
            totalPlayers.size;

        await game.save();

        console.log(
            "Settlement Completed"
        );

    }

    catch (err) {

        console.log(
            "Settlement Error",
            err
        );

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

            return setTimeout(
                startNewGame,
                5000
            );

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
            }
        );

        const period = generatePeriod();

        currentGame = await Game.create({

            period,

            status: "running",

            startTime: new Date(),

        });

        console.log(
            "Game Started :",
            period
        );

        emitNewGame(currentGame);

        // Wait Game Duration

        await delay(
            settings.gameDuration * 1000
        );

        await finishGame();

    }

    catch (err) {

        console.log(err);

        setTimeout(
            startNewGame,
            3000
        );

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

        currentGame.result =
            await generateResult(currentGame);

        currentGame.status = "completed";

        currentGame.endTime = new Date();

        currentGame.resultTime = new Date();

        await currentGame.save();

        // Settlement

        await processBets(currentGame);

        // Socket Result

        emitGameResult(currentGame);

        console.log(
            "Result Declared",
            currentGame.result
        );

        // Break Time

        await delay(
            settings.breakTime * 1000
        );

        await startNewGame();

    }

    catch (err) {

        console.log(err);

        setTimeout(
            startNewGame,
            3000
        );

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

    console.log(
        "Starting Game Engine..."
    );

    await refreshSettings();

    await recoverGame();

};