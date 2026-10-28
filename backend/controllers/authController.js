
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {
  hashPassword,
  comparePassword,
} = require("../utils/password");

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from environment variables");
  }

  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    }
  );
}

function publicUser(user) {
  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    phone: user.phone,
    skills: user.skills,
    resumeUrl: user.resumeUrl,
    createdAt: user.createdAt,
  };
}

async function register(req, res) {
  const {
    firstName,
    lastName,
    email,
    password,
    role,
    phone,
  } = req.body || {};

  if (
    typeof firstName !== "string" ||
    typeof lastName !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    return res.status(400).json({
      success: false,
      message: "First name, last name, email, and password are required",
    });
  }

  const normalizedFirstName = firstName.trim();
  const normalizedLastName = lastName.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (
    !normalizedFirstName ||
    !normalizedLastName ||
    normalizedFirstName.length > 50 ||
    normalizedLastName.length > 50
  ) {
    return res.status(400).json({
      success: false,
      message: "Names must be between 1 and 50 characters",
    });
  }

  if (
    normalizedEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid email address",
    });
  }

  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({
      success: false,
      message: "Password must contain at least 8 characters and at most 72 UTF-8 bytes",
    });
  }

  // Public registration cannot create administrator accounts.
  if (role !== undefined && !["candidate", "recruiter"].includes(role)) {
    return res.status(400).json({
      success: false,
      message: "Invalid role for public registration",
    });
  }

  if (phone !== undefined && (typeof phone !== "string" || phone.trim().length > 20)) {
    return res.status(400).json({
      success: false,
      message: "Phone must be a string of at most 20 characters",
    });
  }

  const existingUser = await User.findOne({
    email: normalizedEmail,
  });

  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "An account with this email already exists",
    });
  }

  const hashedPassword = await hashPassword(password);

  let user;
  try {
    user = await User.create({
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      email: normalizedEmail,
      password: hashedPassword,
      role: role || "candidate",
      phone: typeof phone === "string" ? phone.trim() : "",
    });
  } catch (error) {
    // Concurrent registrations can both pass the earlier existence check.
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }
    throw error;
  }

  const token = createToken(user);

  return res.status(201).json({
    success: true,
    message: "Account created successfully",
    token,
    user: publicUser(user),
  });
}

async function login(req, res) {
  const { email, password } = req.body || {};

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required",
    });
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    return res.status(401).json({ success: false, message: "Invalid email or password" });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
  }).select("+password");

  if (!user || !user.isActive || ["deactivated", "suspended"].includes(user.accountStatus)) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  const passwordMatches = await comparePassword(
    password,
    user.password
  );

  if (!passwordMatches) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  const token = createToken(user);

  return res.status(200).json({
    success: true,
    message: "Login successful",
    token,
    user: publicUser(user),
  });
}

async function getCurrentUser(req, res) {
  const user = await User.findById(req.user.userId);

  if (!user || !user.isActive || ["deactivated", "suspended"].includes(user.accountStatus)) {
    return res.status(401).json({
      success: false,
      message: "User account is unavailable",
    });
  }

  return res.status(200).json({
    success: true,
    user: publicUser(user),
  });
}

module.exports = {
  register,
  login,
  getCurrentUser,
};
