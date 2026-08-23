require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { Pool } = require("pg");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Serve static files from the public folder (two levels up) ----------
app.use(express.static(path.join(__dirname, "../../public")));

// ---------- Root route (serves index.html) ----------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../../public/index.html"));
});

// ---------- Database (PostgreSQL via Neon) ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Initialize tables
async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        pass_hash TEXT NOT NULL,
        created_at BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS reset_tokens (
        token TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        expires_at BIGINT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL DEFAULT 'New chat',
        created_at BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at BIGINT NOT NULL
      );
    `);
    console.log("Database initialized");
  } catch (err) {
    console.error("Database init error:", err);
  } finally {
    client.release();
  }
}
initDb();

// ---------- Email Transporter (use Gmail or Resend) ----------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function sendResetEmail(toEmail, resetLink) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: toEmail,
      subject: "Reset your password",
      html: `
        <h2>Reset your password</h2>
        <p>Click below to reset your password. This link expires in 30 minutes.</p>
        <a href="${resetLink}">Reset Password</a>
        <p>Or paste this link: ${resetLink}</p>
      `,
    });
  } catch (err) {
    console.error("SMTP Error:", err);
    throw err;
  }
}

// ---------- Helpers ----------
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function emailValid(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

// ---------- OpenRouter AI ----------
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

async function getOpenRouterResponse(messages) {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "HTTP-Referer": process.env.APP_URL || "https://your-app.vercel.app",
      "X-Title": "AI Chat App",
    },
    body: JSON.stringify({
      // ✅ FIXED: using a free, working model
      model: "meta-llama/llama-3.2-3b-instruct:free",
      messages: messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0) {
    throw new Error("No response from OpenRouter");
  }

  return data.choices[0].message.content;
}

// ---------- AUTH ROUTES ----------

// Register
app.post("/api/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !emailValid(email) || !password || password.length < 8) {
    return res.status(400).json({ error: "Invalid name, email, or password (min 8 chars)." });
  }
  const client = await pool.connect();
  try {
    const existing = await client.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    const passHash = await bcrypt.hash(password, 12);
    const result = await client.query(
      "INSERT INTO users (name, email, pass_hash, created_at) VALUES ($1, $2, $3, $4) RETURNING id, name, email",
      [name, email.toLowerCase(), passHash, Date.now()]
    );
    const user = result.rows[0];
    const token = signToken(user);
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  } finally {
    client.release();
  }
});

// Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT id, name, email, pass_hash FROM users WHERE email = $1", [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.pass_hash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });
    const token = signToken(user);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  } finally {
    client.release();
  }
});

// Get current user
app.get("/api/me", authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT id, name, email FROM users WHERE id = $1", [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get user" });
  } finally {
    client.release();
  }
});

// Forgot password
app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email || !emailValid(email)) return res.status(400).json({ error: "Valid email required" });
  const client = await pool.connect();
  try {
    const result = await client.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.json({ message: "If that email is registered, a reset link has been sent." });
    }
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 30 * 60 * 1000;
    await client.query(
      "INSERT INTO reset_tokens (token, email, expires_at, used) VALUES ($1, $2, $3, 0)",
      [token, email.toLowerCase(), expiresAt]
    );
    const resetLink = `${process.env.APP_URL}/reset.html?token=${token}`;
    await sendResetEmail(email, resetLink);
    res.json({ message: "If that email is registered, a reset link has been sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send reset email" });
  } finally {
    client.release();
  }
});

// Reset password
app.post("/api/reset-password", async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: "Token and password (min 8 chars) required" });
  }
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT email, expires_at, used FROM reset_tokens WHERE token = $1",
      [token]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }
    const { email, expires_at, used } = result.rows[0];
    if (used === 1) return res.status(400).json({ error: "Token already used" });
    if (Date.now() > expires_at) return res.status(400).json({ error: "Token expired" });
    const passHash = await bcrypt.hash(newPassword, 12);
    await client.query("UPDATE users SET pass_hash = $1 WHERE email = $2", [passHash, email]);
    await client.query("UPDATE reset_tokens SET used = 1 WHERE token = $1", [token]);
    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reset password" });
  } finally {
    client.release();
  }
});

// ---------- CONVERSATION ROUTES ----------

// Get all conversations for user
app.get("/api/conversations", authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT id, title, created_at FROM conversations WHERE user_id = $1 ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json({ conversations: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  } finally {
    client.release();
  }
});

// Create new conversation
app.post("/api/conversations", authMiddleware, async (req, res) => {
  const { title } = req.body || {};
  const client = await pool.connect();
  try {
    const result = await client.query(
      "INSERT INTO conversations (user_id, title, created_at) VALUES ($1, $2, $3) RETURNING id, title, created_at",
      [req.user.id, title || "New chat", Date.now()]
    );
    res.status(201).json({ conversation: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create conversation" });
  } finally {
    client.release();
  }
});

// Delete conversation
app.delete("/api/conversations/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const check = await client.query(
      "SELECT id FROM conversations WHERE id = $1 AND user_id = $2",
      [id, req.user.id]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    await client.query("DELETE FROM conversations WHERE id = $1", [id]);
    res.json({ message: "Conversation deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete conversation" });
  } finally {
    client.release();
  }
});

// Rename conversation
app.patch("/api/conversations/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { title } = req.body || {};
  if (!title) return res.status(400).json({ error: "Title required" });
  const client = await pool.connect();
  try {
    const check = await client.query(
      "SELECT id FROM conversations WHERE id = $1 AND user_id = $2",
      [id, req.user.id]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    await client.query("UPDATE conversations SET title = $1 WHERE id = $2", [title, id]);
    res.json({ message: "Conversation renamed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to rename conversation" });
  } finally {
    client.release();
  }
});

// Get messages for a conversation
app.get("/api/conversations/:id/messages", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const check = await client.query(
      "SELECT id FROM conversations WHERE id = $1 AND user_id = $2",
      [id, req.user.id]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    const result = await client.query(
      "SELECT id, role, content, created_at FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC",
      [id]
    );
    res.json({ messages: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  } finally {
    client.release();
  }
});

// ---------- CHAT (OpenRouter) ROUTE ----------
app.post("/api/chat", authMiddleware, async (req, res) => {
  const { conversationId, message } = req.body || {};
  if (!message) return res.status(400).json({ error: "Message required" });

  const client = await pool.connect();
  try {
    // Get or create conversation
    let convoId = conversationId;
    if (!convoId) {
      const result = await client.query(
        "INSERT INTO conversations (user_id, title, created_at) VALUES ($1, $2, $3) RETURNING id",
        [req.user.id, "New chat", Date.now()]
      );
      convoId = result.rows[0].id;
    } else {
      const check = await client.query(
        "SELECT id FROM conversations WHERE id = $1 AND user_id = $2",
        [convoId, req.user.id]
      );
      if (check.rows.length === 0) {
        return res.status(404).json({ error: "Conversation not found" });
      }
    }

    // Save user message
    await client.query(
      "INSERT INTO messages (conversation_id, role, content, created_at) VALUES ($1, $2, $3, $4)",
      [convoId, "user", message, Date.now()]
    );

    // Get conversation history for context
    const historyResult = await client.query(
      "SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC",
      [convoId]
    );
    const history = historyResult.rows.map(row => ({
      role: row.role === "user" ? "user" : "assistant",
      content: row.content,
    }));

    // Call OpenRouter
    const aiResponse = await getOpenRouterResponse(history);

    // Save AI response
    await client.query(
      "INSERT INTO messages (conversation_id, role, content, created_at) VALUES ($1, $2, $3, $4)",
      [convoId, "assistant", aiResponse, Date.now()]
    );

    // Update conversation title if it's the first message
    const countResult = await client.query(
      "SELECT COUNT(*) FROM messages WHERE conversation_id = $1",
      [convoId]
    );
    if (parseInt(countResult.rows[0].count) === 2) {
      const title = message.length > 50 ? message.slice(0, 50) + "..." : message;
      await client.query("UPDATE conversations SET title = $1 WHERE id = $2", [title, convoId]);
    }

    res.json({
      conversationId: convoId,
      response: aiResponse,
    });
  } catch (err) {
    console.error(err);
    if (err.message.includes("OpenRouter")) {
      return res.status(500).json({ error: "AI service error: " + err.message });
    }
    res.status(500).json({ error: "Failed to get AI response" });
  } finally {
    client.release();
  }
});

// ---------- DELETE ACCOUNT ----------
app.delete("/api/account", authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM users WHERE id = $1", [req.user.id]);
    res.json({ message: "Account deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete account" });
  } finally {
    client.release();
  }
});

// ---------- START SERVER ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
