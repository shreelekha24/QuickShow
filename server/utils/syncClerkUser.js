// utils/syncClerkUser.js
import { clerkClient } from "@clerk/express";
import User from "../models/User.js";

export const syncClerkUserToMongo = async (clerkUserId) => {
  // 1) Get user from Clerk
  const clerkUser = await clerkClient.users.getUser(clerkUserId);

  // 2) Prepare data for Mongo User model
  const email =
    clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;

  const name =
    clerkUser.fullName ||
    `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() ||
    "Unknown";

  const userData = {
    _id: clerkUser.id,        // 🔥 IMPORTANT: same as Booking.user
    name,
    email,
    image: clerkUser.imageUrl,
  };

  // 3) Upsert into Mongo (create if not exists, update if exists)
  const mongoUser = await User.findByIdAndUpdate(
    clerkUser.id,
    userData,
    {
      new: true,
      upsert: true,           // create if missing
      setDefaultsOnInsert: true,
      runValidators: true,
    }
  );

  return mongoUser;
};
