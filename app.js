const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const path = require("path");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
  session({
    secret: "cyberclash",
    resave: false,
    saveUninitialized: false,
  })
);

const db = new sqlite3.Database("./app.db");

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      password TEXT,
      role TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user TEXT,
      title TEXT,
      content TEXT
    )
  `);

  db.get("SELECT COUNT(*) AS c FROM users", (err, row) => {
    if (row.c === 0) {
      db.run("INSERT INTO users VALUES (NULL,'admin','admin123','admin')");
      db.run("INSERT INTO users VALUES (NULL,'alice','alice123','user')");
    }
  });
});

function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/login");
}

app.get("/", (req, res) => {
  res.render("index", { user: req.session.user });
});

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const q = `
    SELECT * FROM users
    WHERE username='${username}'
    AND password='${password}'
  `;

  db.get(q, (err, user) => {
    if (user) {
      req.session.user = {
        username: user.username,
        role: user.role,
      };
      res.redirect("/posts");
    } else {
      res.render("login", { error: "Invalid credentials" });
    }
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

app.get("/posts", requireAuth, (req, res) => {
  db.all("SELECT * FROM posts ORDER BY id DESC", (err, rows) => {
    res.render("posts", {
      posts: rows,
      user: req.session.user,
    });
  });
});

app.get("/post/new", requireAuth, (req, res) => {
  res.render("new", { user: req.session.user });
});

app.post("/post/create", requireAuth, (req, res) => {
  const { title, content } = req.body;
  const user = req.session.user.username;

  db.run(
    "INSERT INTO posts (user,title,content) VALUES (?,?,?)",
    [user, title, content],
    () => res.redirect("/posts")
  );
});

app.post("/post/delete/:id", requireAuth, (req, res) => {
  db.run("DELETE FROM posts WHERE id=?", [req.params.id], () =>
    res.redirect("/posts")
  );
});

app.get("/admin", requireAuth, (req, res) => {
  if (req.session.user.role !== "admin")
    return res.status(403).send("Forbidden");
  res.render("admin", { user: req.session.user });
});

app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on port 3000");
});
