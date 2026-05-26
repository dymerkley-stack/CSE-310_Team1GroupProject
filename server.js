const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// DATABASE
const db = new sqlite3.Database("./database.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      physical INTEGER DEFAULT 70,
      mental INTEGER DEFAULT 70,
      social INTEGER DEFAULT 70,
      intellectual INTEGER DEFAULT 70,
      spiritual INTEGER DEFAULT 70
    )
  `);
});

// TEST ROUTE
app.get("/", (req, res) => {
  res.send("Backend is working");
});

// SAVE PROGRESS ROUTE
app.post("/save", (req, res) => {
  const {
    username,
    physical,
    mental,
    social,
    intellectual,
    spiritual,
    level,
    exp
  } = req.body;

  const sql = `
    INSERT INTO users (
      username, physical, mental, social, intellectual, spiritual, level, exp
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(username)
    DO UPDATE SET
      physical = excluded.physical,
      mental = excluded.mental,
      social = excluded.social,
      intellectual = excluded.intellectual,
      spiritual = excluded.spiritual,
      level = excluded.level,
      exp = excluded.exp
  `;

  db.run(sql, [
    username,
    physical,
    mental,
    social,
    intellectual,
    spiritual,
    level,
    exp
  ], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false });
    }

    res.json({ success: true });
  });
});


app.post("/save", (req, res) => {
  console.log(req.body);

  res.json({
    success: true,
    received: req.body
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

app.get("/test", (req, res) => {
  res.json({ message: "API is working" });
});

app.get("/save", (req, res) => {
  const {
    username,
    level,
    exp
  } = req.body;

  const sql = `
    INSERT INTO users (username, level, exp)
    VALUES (?, ?, ?)
    ON CONFLICT(username)
    DO UPDATE SET
      level = excluded.level,
      exp = excluded.exp
  `;

  db.run(sql, [username, level, exp], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        success: false
      });
    }

    res.json({
      success: true
    });
  });
});

fetch("http://localhost:3000/save", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    username: "testUser",
    level: 5,
    exp: 100,
    physical: 70,
    mental: 70,
    social: 70,
    intellectual: 70,
    spiritual: 70
  })
});