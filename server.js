const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// Pool till Postgres – Render ger DATABASE_URL i env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

app.use(cors());
app.use(bodyParser.json());

// Skapa tabell om den inte finns (körs automatiskt vid start)
async function ensureTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS notes (
      id UUID PRIMARY KEY,
      message_id TEXT NOT NULL,
      text TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'yellow',
      snippet_key TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_notes_message_id ON notes(message_id);
  `;
  await pool.query(sql);
  console.log("notes-tabellen finns / är skapad.");
}

// Hämta notes för ett specifikt messageId
app.get("/notes", async (req, res) => {
  const messageId = req.query.messageId;
  if (!messageId) {
    return res.status(400).json({ error: "messageId is required" });
  }

  try {
    const result = await pool.query(
      "SELECT id, message_id, text, color, snippet_key, created_by, created_at FROM notes WHERE message_id = $1 ORDER BY created_at ASC",
      [messageId]
    );

    const notes = result.rows.map((row) => ({
      id: row.id,
      messageId: row.message_id,
      text: row.text,
      color: row.color,
      snippetKey: row.snippet_key,
      createdBy: row.created_by,
      createdAt: row.created_at
    }));

    res.json({ notes });
  } catch (err) {
    console.error("Fel vid GET /notes:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Skapa en ny note
app.post("/notes", async (req, res) => {
  const { messageId, text, color, snippetKey, createdBy } = req.body;

  if (!messageId || !text) {
    return res.status(400).json({ error: "messageId and text are required" });
  }

  const id = uuidv4();
  const finalColor = color || "yellow";

  try {
    const result = await pool.query(
      "INSERT INTO notes (id, message_id, text, color, snippet_key, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, message_id, text, color, snippet_key, created_by, created_at",
      [id, messageId, text, finalColor, snippetKey || null, createdBy || "okänd"]
    );

    const row = result.rows[0];

    const note = {
      id: row.id,
      messageId: row.message_id,
      text: row.text,
      color: row.color,
      snippetKey: row.snippet_key,
      createdBy: row.created_by,
      createdAt: row.created_at
    };

    res.status(201).json({ note });
  } catch (err) {
    console.error("Fel vid POST /notes:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Ta bort en note
app.delete("/notes/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query("DELETE FROM notes WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Fel vid DELETE /notes/:id:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Starta servern först när tabellens struktur är fixad
ensureTable()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Gmail Notes backend lyssnar på port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Kunde inte initiera databasen:", err);
    process.exit(1);
  });
