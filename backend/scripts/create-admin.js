require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const connectDB = require("../config/db");
const { hashPassword } = require("../utils/password");

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Set ADMIN_EMAIL to a valid email address");
  }
  if (!password || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Set ADMIN_PASSWORD to at least 8 characters and at most 72 UTF-8 bytes");
  }
  await connectDB();
  if (await User.exists({ email })) throw new Error("That email already has an account; no role changes were made");
  await User.create({ firstName: "CareerPath", lastName: "Administrator", email,
    password: await hashPassword(password), role: "admin" });
  console.log("Administrator account created. You can now sign in through the normal login page.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
