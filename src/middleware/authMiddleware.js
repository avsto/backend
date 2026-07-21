import jwt from "jsonwebtoken";
import User from "../models/User.js";


const authMiddleware = async (
  req,
  res,
  next
) => {

  try {

    let token;


    // Header se token lena

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {

      token =
        req.headers.authorization.split(" ")[1];

    }


    if (!token) {

      return res.status(401).json({

        message:
          "Authorization token missing",

      });

    }



    // Verify Token

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );



    // User Check

    const user =
      await User.findById(
        decoded.id
      ).select(
        "-password"
      );



    if (!user) {

      return res.status(401).json({

        message:
          "User not found",

      });

    }



    if (
      user.status === "blocked"
    ) {

      return res.status(403).json({

        message:
          "Account blocked",

      });

    }



    // Attach User

    req.user = user;


    next();



  } catch (error) {


    if (
      error.name === "TokenExpiredError"
    ) {

      return res.status(401).json({

        message:
          "Token expired",

      });

    }


    return res.status(401).json({

      message:
        "Invalid token",

    });


  }

};


export default authMiddleware;