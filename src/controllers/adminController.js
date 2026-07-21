import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import Game from "../models/Game.js";
import Bet from "../models/Bet.js";
import Wallet from "../models/Wallet.js";
import Upi from "../models/Upi.js";

import Setting from "../models/Setting.js";
import { refreshSettings } from "../services/gameEngine.js";
// =======================================
// Login Page
// =======================================

export const loginPage = (req, res) => {
  res.render("login", {
    layout: false,
    error: null,
  });
};

// =======================================
// Login
// =======================================

export const login = async (req, res) => {
  try {
    const { mobile, password } = req.body;

    const admin = await User.findOne({
      mobile,
      role: "admin",
    });

    if (!admin) {
      return res.render("login", {
        layout: false,
        error: "Invalid Mobile Number",
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.render("login", {
        layout: false,
        error: "Invalid Password",
      });
    }

    const token = jwt.sign(
      {
        id: admin._id,
        role: admin.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      },
    );

    res.cookie("adminToken", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.redirect("/admin/dashboard");
  } catch (err) {
    console.log(err);

    return res.render("login", {
      layout: false,
      error: "Something went wrong",
    });
  }
};

// =======================================
// Dashboard
// =======================================

export const dashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({
      role: "user",
    });

    const totalAdmins = await User.countDocuments({
      role: "admin",
    });

    const totalGames = await Game.countDocuments();

    const runningGames = await Game.countDocuments({
      status: "running",
    });

    const completedGames = await Game.countDocuments({
      status: "completed",
    });

    const totalBets = await Bet.countDocuments();

    const pendingBets = await Bet.countDocuments({
      result: "pending",
    });

    const winBets = await Bet.countDocuments({
      result: "win",
    });

    const loseBets = await Bet.countDocuments({
      result: "lose",
    });

    // =====================================
    // Wallet Balance
    // =====================================

    const walletData = await Wallet.aggregate([
      {
        $group: {
          _id: null,
          totalBalance: {
            $sum: "$balance",
          },
        },
      },
    ]);

    const totalWallet = walletData.length > 0 ? walletData[0].totalBalance : 0;

    // =====================================
    // Bet Amount
    // =====================================

    const betAmount = await Bet.aggregate([
      {
        $group: {
          _id: null,
          total: {
            $sum: "$amount",
          },
        },
      },
    ]);

    const totalBetAmount = betAmount.length > 0 ? betAmount[0].total : 0;

    // =====================================
    // Winning Amount
    // =====================================

    const winAmount = await Bet.aggregate([
      {
        $group: {
          _id: null,
          total: {
            $sum: "$winningAmount",
          },
        },
      },
    ]);

    const totalWinningAmount = winAmount.length > 0 ? winAmount[0].total : 0;

    // =====================================
    // Profit
    // =====================================

    const totalProfit = totalBetAmount - totalWinningAmount;

    // =====================================
    // Latest Games
    // =====================================

    const latestGames = await Game.find()
      .sort({
        createdAt: -1,
      })
      .limit(10);

    // =====================================
    // Latest Bets
    // =====================================

    const latestBets = await Bet.find()
      .populate("user")
      .sort({
        createdAt: -1,
      })
      .limit(10);

    res.render("dashboard", {
      title: "Dashboard",

      totalUsers,

      totalAdmins,

      totalGames,

      runningGames,

      completedGames,

      totalBets,

      pendingBets,

      winBets,

      loseBets,

      totalWallet,

      totalBetAmount,

      totalWinningAmount,

      totalProfit,

      latestGames,

      latestBets,
    });
  } catch (err) {
    console.log(err);

    res.redirect("/admin/login");
  }
};

// =======================================
// Logout
// =======================================

export const logout = (req, res) => {
  res.clearCookie("adminToken");

  res.redirect("/admin/login");
};

// =======================================
// Users List
// =======================================

export const users = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const search = req.query.search || "";

    const query = {
      role: "user",
    };

    if (search) {
      query.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          mobile: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const total = await User.countDocuments(query);

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const userIds = users.map((u) => u._id);

    // Get all wallets at once
    const wallets = await Wallet.find({
      user: { $in: userIds },
    }).lean();

    // Get all bets at once
    const bets = await Bet.find({
      user: { $in: userIds },
    }).lean();

    const walletMap = {};
    wallets.forEach((wallet) => {
      walletMap[wallet.user.toString()] = wallet;
    });

    const betMap = {};

    bets.forEach((bet) => {
      const id = bet.user.toString();

      if (!betMap[id]) {
        betMap[id] = {
          totalBets: 0,
          totalBetAmount: 0,
          totalWinAmount: 0,
          totalLoseAmount: 0,
        };
      }

      betMap[id].totalBets++;

      betMap[id].totalBetAmount += bet.amount;

      if (bet.result === "win") {
        betMap[id].totalWinAmount += bet.winningAmount;
      }

      if (bet.result === "lose") {
        betMap[id].totalLoseAmount += bet.amount;
      }
    });

    const finalUsers = users.map((user) => {
      const wallet = walletMap[user._id.toString()];
      const bet = betMap[user._id.toString()] || {};

      return {
        ...user,

        balance: wallet?.balance || 0,

        totalTransactions: wallet?.transactions?.length || 0,

        totalBets: bet.totalBets || 0,

        totalBetAmount: bet.totalBetAmount || 0,

        totalWinAmount: bet.totalWinAmount || 0,

        totalLoseAmount: bet.totalLoseAmount || 0,
      };
    });

    res.render("users", {
      title: "Users",
      users: finalUsers,
      search,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.log(err);
    res.redirect("/admin/dashboard");
  }
};

// =======================================
// User Details
// =======================================

export const userDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).lean();

    if (!user) {
      return res.redirect("/admin/users");
    }

    const wallet = await Wallet.findOne({
      user: user._id,
    });

    const bets = await Bet.find({
      user: user._id,
    })
      .sort({
        createdAt: -1,
      })
      .limit(20);

    user.balance = wallet ? wallet.balance : 0;

    user.transactions = wallet ? wallet.transactions : [];

    res.render("user-details", {
      title: "User Details",
      user,
      bets,
    });
  } catch (err) {
    console.log(err);

    res.redirect("/admin/users");
  }
};

// =======================================
// Block User
// =======================================

export const blockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, {
      status: "blocked",
    });

    res.redirect("/admin/users");
  } catch (err) {
    console.log(err);

    res.redirect("/admin/users");
  }
};

// =======================================
// Unblock User
// =======================================

export const unblockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, {
      status: "active",
    });

    res.redirect("/admin/users");
  } catch (err) {
    console.log(err);

    res.redirect("/admin/users");
  }
};

// =======================================
// Delete User
// =======================================

export const deleteUser = async (req, res) => {
  try {
    const id = req.params.id;

    await User.findByIdAndDelete(id);

    await Wallet.deleteOne({
      user: id,
    });

    await Bet.deleteMany({
      user: id,
    });

    res.redirect("/admin/users");
  } catch (err) {
    console.log(err);

    res.redirect("/admin/users");
  }
};

// ======================================
// GAMES
// ======================================

export const games = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 15;
    const skip = (page - 1) * limit;

    const search = req.query.search || "";

    let query = {};

    if (search) {
      query.period = {
        $regex: search,
        $options: "i",
      };
    }

    const total = await Game.countDocuments(query);

    const games = await Game.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const runningGame = await Game.findOne({
      status: "running",
    });

    res.render("games", {
      title: "Games",
      games,
      runningGame,
      search,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.log(err);

    res.redirect("/admin/dashboard");
  }
};

// ======================================
// BETS
// ======================================

export const bets = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const search = req.query.search || "";
    const result = req.query.result || "";

    let query = {};

    if (result) {
      query.result = result;
    }

    const total = await Bet.countDocuments(query);

    const bets = await Bet.find(query)
      .populate("user", "name mobile")
      .populate("game", "period")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Search by Name / Mobile / Period
    let filtered = bets;

    if (search) {
      filtered = bets.filter((bet) => {
        return (
          bet.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
          bet.user?.mobile?.includes(search) ||
          bet.game?.period?.includes(search)
        );
      });
    }

    // Dashboard Stats
    const totalBetAmount = await Bet.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    const totalWinning = await Bet.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$winningAmount" },
        },
      },
    ]);

    const pending = await Bet.countDocuments({
      result: "pending",
    });

    const win = await Bet.countDocuments({
      result: "win",
    });

    const lose = await Bet.countDocuments({
      result: "lose",
    });

    res.render("bets", {
      title: "Bet History",

      bets: filtered,

      search,
      result,

      pending,
      win,
      lose,

      totalBetAmount: totalBetAmount[0]?.total || 0,
      totalWinning: totalWinning[0]?.total || 0,

      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.log(err);

    res.redirect("/admin/dashboard");
  }
};

export const wallet = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 15;
    const skip = (page - 1) * limit;

    const search = req.query.search || "";

    const wallets = await Wallet.find()
      .populate("user", "name mobile status")
      .sort({ updatedAt: -1 })
      .lean();

    let filtered = wallets;

    if (search) {
      filtered = wallets.filter((wallet) => {
        return (
          wallet.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
          wallet.user?.mobile?.includes(search)
        );
      });
    }

    const total = filtered.length;

    const data = filtered.slice(skip, skip + limit);

    res.render("wallet", {
      title: "Wallet",

      wallets: data,

      search,

      currentPage: page,

      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.log(err);

    res.redirect("/admin/dashboard");
  }
};

// ======================================
// WALLET TRANSACTIONS
// ======================================

export const transactions = async (req, res) => {
  try {
    const search = req.query.search || "";

    const wallets = await Wallet.find().populate("user").lean();

    let transactions = [];

    wallets.forEach((wallet) => {
      if (!wallet.user) return;

      wallet.transactions.forEach((tx) => {
        if (
          search &&
          !wallet.user.name.toLowerCase().includes(search.toLowerCase()) &&
          !wallet.user.mobile.includes(search)
        ) {
          return;
        }

        transactions.push({
          ...tx,
          user: wallet.user,
          balance: wallet.balance,
        });
      });
    });

    transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.render("transactions", {
      title: "Transactions",
      transactions,
      search,
    });
  } catch (err) {
    console.log(err);

    res.redirect("/admin/dashboard");
  }
};

// ============================
// Settings Page
// ============================

export const settings = async (req, res) => {
  try {
    let settings = await Setting.findOne();

    if (!settings) {
      settings = await Setting.create({});
    }

    res.render("settings", {
      title: "Settings",
      settings,
    });
  } catch (err) {
    console.log(err);
    res.redirect("/admin/dashboard");
  }
};

// ============================
// Save Settings
// ============================

export const updateSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne();

    if (!settings) {
      settings = new Setting();
    }

    // ==========================
    // Game
    // ==========================

    settings.gameDuration = Number(req.body.gameDuration) || 30;
    settings.breakTime = Number(req.body.breakTime) || 1;

    // ==========================
    // Betting
    // ==========================

    settings.bettingEnabled = req.body.bettingEnabled === "on";

    settings.maintenanceMode = req.body.maintenanceMode === "on";

    settings.minimumBet = Number(req.body.minimumBet) || 10;

    settings.maximumBet = Number(req.body.maximumBet) || 10000;

    // ==========================
    // Multipliers
    // ==========================

    settings.numberMultiplier = Number(req.body.numberMultiplier) || 9;

    settings.colorMultiplier = Number(req.body.colorMultiplier) || 2;

    settings.sizeMultiplier = Number(req.body.sizeMultiplier) || 2;

    // ==========================
    // Deposit / Withdraw
    // ==========================

    settings.minimumDeposit = Number(req.body.minimumDeposit) || 100;

    settings.minimumWithdraw = Number(req.body.minimumWithdraw) || 200;

    settings.withdrawCharge = Number(req.body.withdrawCharge) || 0;

    // ==========================
    // Bonus
    // ==========================

    settings.signupBonus = Number(req.body.signupBonus) || 0;

    settings.referralBonus = Number(req.body.referralBonus) || 50;

    // ==========================
    // Result
    // ==========================

    settings.resultMode = req.body.resultMode || "auto";

    settings.manualNumber = Number(req.body.manualNumber) || 0;

    settings.manualColor = req.body.manualColor || "violet";

    settings.manualSize = req.body.manualSize || "small";

    // ==========================
    // RTP
    // ==========================

    settings.rtpEnabled = req.body.rtpEnabled === "on";

    settings.rtpPercentage = Number(req.body.rtpPercentage) || 80;

    await settings.save();

    // Refresh Game Engine Settings
    if (typeof refreshSettings === "function") {
      await refreshSettings();
    }

    return res.redirect("/admin/settings");
  } catch (err) {
    console.log(err);
    return res.redirect("/admin/settings");
  }
};

export const payoutRequests = async (req, res) => {
  try {
    const search = req.query.search || "";

    const wallets = await Wallet.find().populate("user").lean();

    let payouts = [];

    wallets.forEach((wallet) => {
      // Search
      if (
        search &&
        !wallet.user?.name?.toLowerCase().includes(search.toLowerCase()) &&
        !wallet.user?.mobile?.includes(search)
      ) {
        return;
      }

      wallet.transactions.forEach((tx) => {
        if (tx.type === "withdraw" && tx.status === "pending") {
          payouts.push({
            walletId: wallet._id,

            transactionId: tx._id,

            user: wallet.user,

            amount: tx.amount,

            createdAt: tx.createdAt,

            balance: wallet.balance,

            description: tx.description,

            referenceId: tx.referenceId,

            status: tx.status,
          });
        }
      });
    });

    payouts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.render("payouts", {
      title: "Withdrawal Requests",

      payouts,

      search,
    });
  } catch (err) {
    console.log(err);

    res.redirect("/admin/dashboard");
  }
};

export const approvePayout = async (req, res) => {
  try {
    const { walletId, transactionId } = req.params;

    const wallet = await Wallet.findById(walletId);

    if (!wallet) {
      return res.redirect("/admin/payouts");
    }

    const tx = wallet.transactions.id(transactionId);

    if (!tx) {
      return res.redirect("/admin/payouts");
    }

    // Already processed
    if (tx.status === "approved") {
      return res.redirect("/admin/payouts");
    }

    // Deduct balance
    wallet.balance -= Number(tx.amount);

    // Safety
    if (wallet.balance < 0) {
      wallet.balance = 0;
    }

    tx.status = "approved";
    tx.referenceId = "TXN" + Date.now();
    tx.description = "Withdrawal Approved";

    await wallet.save();

    res.redirect("/admin/payouts");
  } catch (err) {
    console.log(err);
    res.redirect("/admin/payouts");
  }
};

export const rejectPayout = async (req, res) => {
  try {
    const { walletId, transactionId } = req.params;

    const wallet = await Wallet.findById(walletId);

    if (!wallet) return res.redirect("/admin/payouts");

    const tx = wallet.transactions.id(transactionId);

    if (!tx) return res.redirect("/admin/payouts");

    tx.status = "rejected";

    tx.description = "Withdrawal Rejected";

    // Refund Amount

    wallet.balance += tx.amount;

    wallet.transactions.unshift({
      type: "refund",

      amount: tx.amount,

      status: "success",

      description: "Withdrawal Refund",

      referenceId: tx.referenceId,
    });

    await wallet.save();

    res.redirect("/admin/payouts");
  } catch (err) {
    console.log(err);

    res.redirect("/admin/payouts");
  }
};

export const deposits = async (req, res) => {
  try {
    const search = req.query.search || "";

    const wallets = await Wallet.find().populate("user").lean();

    let deposits = [];

    wallets.forEach((wallet) => {
      if (
        search &&
        !wallet.user?.name?.toLowerCase().includes(search.toLowerCase()) &&
        !wallet.user?.mobile?.includes(search)
      ) {
        return;
      }

      wallet.transactions.forEach((tx) => {
        if (tx.type === "deposit" && tx.status === "pending") {
          deposits.push({
            walletId: wallet._id,

            transactionId: tx._id,

            user: wallet.user,

            amount: tx.amount,

            createdAt: tx.createdAt,

            description: tx.description,

            referenceId: tx.referenceId,

            status: tx.status,

            balance: wallet.balance,
          });
        }
      });
    });

    deposits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.render("deposits", {
      title: "Deposit Requests",
      deposits,
      search,
    });
  } catch (err) {
    console.log(err);

    res.redirect("/admin/dashboard");
  }
};

export const approveDeposit = async (req, res) => {
  try {
    const { walletId, transactionId } = req.params;

    const wallet = await Wallet.findById(walletId);

    const tx = wallet.transactions.id(transactionId);

    if (!tx) {
      return res.redirect("/admin/deposits");
    }

    tx.status = "approved";

    wallet.balance += tx.amount;

    await wallet.save();

    res.redirect("/admin/deposits");
  } catch (err) {
    console.log(err);

    res.redirect("/admin/deposits");
  }
};

export const rejectDeposit = async (req, res) => {
  try {
    const { walletId, transactionId } = req.params;

    const wallet = await Wallet.findById(walletId);

    const tx = wallet.transactions.id(transactionId);

    if (!tx) {
      return res.redirect("/admin/deposits");
    }

    tx.status = "rejected";

    await wallet.save();

    res.redirect("/admin/deposits");
  } catch (err) {
    console.log(err);

    res.redirect("/admin/deposits");
  }
};



// ==========================
// UPI Page
// ==========================

export const upiPage = async (req, res) => {
  try {
    const upis = await Upi.find().sort({
      createdAt: -1,
    });

    res.render("upi", {
       title: "UPI Management",
       upis
    });
  } catch (error) {
    console.log(error);

    res.status(500).send(error.message);
  }
};

// ==========================
// Add UPI
// ==========================

export const addUpi = async (req, res) => {
  try {
    const { upiId } = req.body;

    if (!upiId) {
      return res.redirect("/admin/upi");
    }

    const exist = await Upi.findOne({
      upiId,
    });

    if (exist) {
      return res.redirect("/admin/upi");
    }

    await Upi.create({
      upiId,

      status: true,
    });

    res.redirect("/admin/upi");
  } catch (error) {
    console.log(error);

    res.status(500).send(error.message);
  }
};

// ==========================
// Toggle Status
// ==========================

export const toggleUpi = async (req, res) => {
  try {
    const upi = await Upi.findById(req.params.id);

    if (!upi) {
      return res.redirect("/admin/upi");
    }

    upi.status = !upi.status;

    await upi.save();

    res.redirect("/admin/upi");
  } catch (error) {
    console.log(error);

    res.status(500).send(error.message);
  }
};

// ==========================
// Delete UPI
// ==========================

export const deleteUpi = async (req, res) => {
  try {
    await Upi.findByIdAndDelete(req.params.id);

    res.redirect("/admin/upi");
  } catch (error) {
    console.log(error);

    res.status(500).send(error.message);
  }
};
