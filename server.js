// server.js

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

const app = express();
// База: файл database.sqlite у корні проєкту
const db  = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), err => {
  if (err) console.error('Cannot open database:', err);
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Ініціалізація таблиць ---
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    difficulty TEXT,
    questions TEXT,
    prereq INTEGER
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user TEXT,
    testId INTEGER,
    testTitle TEXT,
    score INTEGER,
    date INTEGER
  )`);
  // початкові дані: хоча б один користувач і тест
  db.get(`SELECT COUNT(*) AS c FROM users`, (_, r) => {
    if (r.c === 0) db.run(`INSERT INTO users(username) VALUES(?)`, 'Guest');
  });
  db.get(`SELECT COUNT(*) AS c FROM tests`, (_, r) => {
    if (r.c === 0) {
      const sampleQ = JSON.stringify([
        { question:'What is 2+2?', options:['1','2','3','4'], answer:3 },
        { question:'Capital of France?', options:['Paris','London','Rome','Berlin'], answer:0 }
      ]);
      db.run(
        `INSERT INTO tests(title,difficulty,questions,prereq)
         VALUES(?,?,?,?)`,
        'Sample Test','Easy', sampleQ, null
      );
    }
  });
});

// --- USERS ---
app.get('/api/users', (req, res) => {
  db.all(`SELECT username FROM users`, (e, rows) => {
    if (e) return res.status(500).json({ error: e.message });
    res.json(rows.map(r => r.username));
  });
});
app.post('/api/users', (req, res) => {
  const { username } = req.body;
  db.run(
    `INSERT OR IGNORE INTO users(username) VALUES(?)`,
    [username],
    err => err ? res.status(500).json({ error: err.message }) : res.sendStatus(200)
  );
});
app.delete('/api/users/:u', (req, res) => {
  db.run(
    `DELETE FROM users WHERE username = ?`,
    [req.params.u],
    err => err ? res.status(500).json({ error: err.message }) : res.sendStatus(200)
  );
});

// --- TESTS ---
app.get('/api/tests', (req, res) => {
  db.all(`SELECT * FROM tests`, (e, rows) => {
    if (e) return res.status(500).json({ error: e.message });
    rows.forEach(r => r.questions = JSON.parse(r.questions));
    res.json(rows);
  });
});
app.post('/api/tests', (req, res) => {
  const t = req.body;
  db.run(
    `INSERT INTO tests(title,difficulty,questions,prereq)
     VALUES(?,?,?,?)`,
    [t.title, t.difficulty, JSON.stringify(t.questions), t.prereq || null],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});
app.put('/api/tests/:id', (req, res) => {
  const t = req.body;
  db.run(
    `UPDATE tests
     SET title=?, difficulty=?, questions=?, prereq=?
     WHERE id=?`,
    [t.title, t.difficulty, JSON.stringify(t.questions), t.prereq || null, req.params.id],
    err => err ? res.status(500).json({ error: err.message }) : res.sendStatus(200)
  );
});
app.delete('/api/tests/:id', (req, res) => {
  db.run(
    `DELETE FROM tests WHERE id = ?`,
    [req.params.id],
    err => err ? res.status(500).json({ error: err.message }) : res.sendStatus(200)
  );
});

// --- HISTORY ---
app.get('/api/history', (req, res) => {
  db.all(`SELECT * FROM history`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});
app.post('/api/history', (req, res) => {
  const { user, testId, testTitle, score, date } = req.body;
  db.run(
    `INSERT INTO history(user,testId,testTitle,score,date)
     VALUES(?,?,?,?,?)`,
    [user, testId, testTitle, score, date],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    }
  );
});
app.delete('/api/history/:id', (req, res) => {
  db.run(
    `DELETE FROM history WHERE id = ?`,
    [req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
      res.sendStatus(200);
    }
  );
});
app.delete('/api/history', (req, res) => {
  db.run(`DELETE FROM history`, err => {
    if (err) return res.status(500).json({ error: err.message });
    res.sendStatus(200);
  });
});

// --- Запуск сервера ---
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
