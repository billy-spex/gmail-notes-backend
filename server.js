const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// Pool till Postgres – Render sätter DATABASE_URL i env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

app.use(cors());
app.use(bodyParser.json());

// Skapa tabell om den inte finns (körs vid start)
async function ensureTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS notes (
      id UUID PRIMARY KEY,
      message_id TEXT NOT NULL,
      text TEXT NOT NULL,
      tag_name TEXT,
      tag_color TEXT NOT NULL DEFAULT '#a855f7',
      snippet_key TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_notes_message_id ON notes(message_id);
  `;
  await pool.query(sql);
  console.log("notes-tabellen finns / är skapad.");
}

// Hämta notes för en tråd
app.get("/notes", async (req, res) => {
  const messageId = req.query.messageId;
  if (!messageId) {
    return res.status(400).json({ error: "messageId is required" });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        message_id,
        text,
        tag_name,
        tag_color,
        snippet_key,
        created_at
      FROM notes
      WHERE message_id = $1
      ORDER BY created_at ASC
      `,
      [messageId]
    );

    const notes = result.rows.map((row) => ({
      id: row.id,
      messageId: row.message_id,
      text: row.text,
      tagName: row.tag_name,
      tagColor: row.tag_color,
      snippetKey: row.snippet_key,
      createdAt: row.created_at
    }));

    res.json({ notes });
  } catch (err) {
    console.error("Fel vid GET /notes:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Skapa note
app.post("/notes", async (req, res) => {
  const { messageId, text, tagName, tagColor, snippetKey } = req.body;

  if (!messageId || !text) {
    return res.status(400).json({ error: "messageId and text are required" });
  }

  const id = uuidv4();

  // Standardvärden om frontend skickar tomt
  const finalTagName = tagName || "Okänd";
  // Lila standard (#a855f7 – samma som Billy i frontenden om du vill)
  const finalTagColor = tagColor || "#a855f7";

  try {
    const result = await pool.query(
      `
      INSERT INTO notes (id, message_id, text, tag_name, tag_color, snippet_key)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        message_id,
        text,
        tag_name,
        tag_color,
        snippet_key,
        created_at
      `,
      [id, messageId, text, finalTagName, finalTagColor, snippetKey || null]
    );

    const row = result.rows[0];

    const note = {
      id: row.id,
      messageId: row.message_id,
      text: row.text,
      tagName: row.tag_name,
      tagColor: row.tag_color,
      snippetKey: row.snippet_key,
      createdAt: row.created_at
    };

    res.status(201).json({ note });
  } catch (err) {
    console.error("Fel vid POST /notes:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Ta bort note
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

// Starta servern när tabellen är klar
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
