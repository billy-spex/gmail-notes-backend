const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = 3000;

// Enkel in-memory-lagring – byt till databas i skarp drift
const notes = [];

// Tillåt alla origins (inkl. chrome-extension://…)
app.use(cors());
app.use(bodyParser.json());

// Hämta notes för ett specifikt messageId
app.get("/notes", (req, res) => {
  const messageId = req.query.messageId;
  if (!messageId) {
    return res.status(400).json({ error: "messageId is required" });
  }

  const filtered = notes
    .filter((n) => n.messageId === messageId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  res.json({ notes: filtered });
});

// Skapa en ny note
app.post("/notes", (req, res) => {
  const { messageId, text, color, snippetKey, createdBy } = req.body;

  if (!messageId || !text) {
    return res.status(400).json({ error: "messageId and text are required" });
  }

  const note = {
    id: uuidv4(),
    messageId,
    text,
    color: color || "yellow",
    snippetKey: snippetKey || null,
    createdBy: createdBy || "okänd",
    createdAt: new Date().toISOString(),
  };

  notes.push(note);
  res.status(201).json({ note });
});

// (Frivilligt) rensa alla notes – bara för test
app.delete("/notes", (req, res) => {
  notes.length = 0;
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Gmail Notes backend lyssnar på http://localhost:${PORT}`);
});
