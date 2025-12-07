// middleware/requireUser.js
import { getAuth } from "@clerk/express";
import { syncClerkUserToMongo } from "../utils/syncClerkUser.js";

export const requireUser = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // 🔁 Sync Clerk user into Mongo
    const mongoUser = await syncClerkUserToMongo(userId);

    // Attach to request for easy access
    req.user = mongoUser;            // Mongo user
    req.userId = mongoUser._id;      // same as Clerk id

    next();
  } catch (err) {
    console.error("Error in requireUser:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to sync user",
    });
  }
};
