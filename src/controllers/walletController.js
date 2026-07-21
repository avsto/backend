import Wallet from "../models/Wallet.js";
import User from "../models/User.js";

// =====================================
// GET WALLET
// GET /api/wallet
// =====================================

export const getWallet = async (req, res) => {
  try {
    let wallet = await Wallet.findOne({
      user: req.user._id,
    });

    if (!wallet) {
      wallet = await Wallet.create({
        user: req.user._id,

        balance: req.user.wallet || 0,
      });
    }

    const transactions = wallet.transactions
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    res.status(200).json({
      balance: wallet.balance,

      transactions,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// =====================================
// DEPOSIT REQUEST
// POST /api/wallet/deposit
// =====================================

export const deposit = async (req, res) => {
  try {
    const { amount, referenceId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        message: "Invalid deposit amount",
      });
    }

    let wallet = await Wallet.findOne({
      user: req.user._id,
    });

    if (!wallet) {
      wallet = await Wallet.create({
        user: req.user._id,
      });
    }

    wallet.transactions.unshift({
      type: "deposit",

      amount,

      status: "pending",

      referenceId: referenceId || "",

      description: "Deposit request",
    });

    await wallet.save();

    res.json({
      message: "Deposit request submitted",

      transaction: wallet.transactions[0],
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// =====================================
// WITHDRAW REQUEST
// POST /api/wallet/withdraw
// =====================================

export const withdraw = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        message: "Invalid withdraw amount",
      });
    }

    let wallet = await Wallet.findOne({
      user: req.user._id,
    });

    if (!wallet) {
      return res.status(404).json({
        message: "Wallet not found",
      });
    }

    if (wallet.balance < amount) {
      return res.status(400).json({
        message: "Insufficient balance",
      });
    }

    wallet.transactions.unshift({
      type: "withdraw",

      amount,

      status: "pending",

      description: "Withdraw request",
    });

    await wallet.save();

    res.json({
      message: "Withdraw request submitted",

      transaction: wallet.transactions[0],
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// =====================================
// TRANSACTION HISTORY
// GET /api/wallet/history
// =====================================

export const history = async (req, res) => {
  try {
    const wallet = await Wallet.findOne({
      user: req.user._id,
    });

    if (!wallet) {
      return res.json({
        transactions: [],
      });
    }

    res.json({
      transactions: wallet.transactions.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      ),
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// =====================================
// ADMIN APPROVE DEPOSIT
// =====================================

export const approveDeposit = async (req, res) => {
  try {
    const { userId, transactionId } = req.body;

    const wallet = await Wallet.findOne({
      user: userId,
    });

    const transaction = wallet.transactions.id(transactionId);

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction not found",
      });
    }

    transaction.status = "success";

    wallet.balance += transaction.amount;

    await wallet.save();

    await User.findByIdAndUpdate(userId, {
      wallet: wallet.balance,
      $inc: {
        totalDeposit: transaction.amount,
      },
    });

    res.json({
      message: "Deposit approved",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
