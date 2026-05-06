require('dotenv').config({ path: './.env' });
console.log("ENV CHECK:", process.env.DB_USER, process.env.DB_PASSWORD);
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ DB
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) console.log("DB Error:", err.message);
  else console.log("MySQL Connected ✅");
});

// ✅ Health
app.get("/health", (req, res) => {
  res.json({ ok: true, msg: "Backend working ✅" });
});  

// ✅ REGISTER
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;

    if (!name || !email || !mobile || !password) {
      return res.status(400).json({ ok: false, msg: "All fields required" });
    }

    const user_id = "DFH" + Math.floor(1000 + Math.random() * 9000);
    const hash = await bcrypt.hash(password, 10);

    // ✅ password_hash column
    const sql =
      "INSERT INTO users (user_id, name, email, mobile, password_hash, role) VALUES (?,?,?,?,?, 'user')";

    db.query(sql, [user_id, name, email, mobile, hash], (err) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res
            .status(409)
            .json({ ok: false, msg: "Email or mobile already registered" });
        }
        console.log("REGISTER DB ERROR:", err.code, err.sqlMessage);
        return res.status(500).json({ ok: false, msg: "Database error" });
      }

      return res.json({
        ok: true,
        msg: "Registered successfully",
        user_id,
      });
    });
  } catch (e) {
    console.log("REGISTER ERROR:", e);
    return res.status(500).json({ ok: false, msg: "Server error" });
  }
});

// ✅ LOGIN (email OR user_id)
app.post("/api/login", (req, res) => {
  const input = (req.body.input || "").trim();
  const password = (req.body.password || "").trim();

  if (!input || !password) {
    return res.status(400).json({ ok: false, msg: "All fields required" });
  }

  db.query(
    "SELECT * FROM users WHERE email=? OR user_id=? LIMIT 1",
    [input, input],
    async (err, rows) => {
      if (err) {
        console.log("LOGIN DB ERROR:", err.code, err.sqlMessage);
        return res.status(500).json({ ok: false, msg: "Database error" });
      }

      if (rows.length === 0) {
        return res.status(401).json({ ok: false, msg: "USER_NOT_FOUND" });
      }

      const user = rows[0];
      if (Number(user.is_blocked) === 1) {
        return res.status(403).json({ ok: false, msg: "BLOCKED_USER" });
      }

      const storedHash = user.password_hash ? String(user.password_hash) : "";

      let match = false;

      if (
        storedHash &&
        (storedHash.startsWith("$2a$") ||
          storedHash.startsWith("$2b$") ||
          storedHash.startsWith("$2y$"))
      ) {
        match = await bcrypt.compare(password, storedHash);
      }

      if (!match) {
        return res.status(401).json({ ok: false, msg: "WRONG_PASSWORD" });
      }

      return res.json({
        ok: true,
        msg: "Login success",
        user: {
          user_id: user.user_id,
          name: user.name,
          email: user.email,
          role: user.role || "user",
        },
      });
    },
  );
});
//// ✅ Admin middleware (simple & project-friendly)
function requireAdmin(req, res, next) {
  const adminId = (req.headers["x-admin-id"] || "").toString().trim();

  if (!adminId) {
    return res.status(401).json({ ok: false, msg: "Admin ID missing" });
  }

  db.query(
    "SELECT user_id, role, is_blocked FROM users WHERE user_id=? LIMIT 1",
    [adminId],
    (err, rows) => {
      if (err)
        return res.status(500).json({ ok: false, msg: "Database error" });
      if (rows.length === 0)
        return res.status(401).json({ ok: false, msg: "Invalid admin" });

      const u = rows[0];
      if (Number(u.is_blocked) === 1)
        return res.status(403).json({ ok: false, msg: "Admin blocked" });
      if ((u.role || "user") !== "admin")
        return res.status(403).json({ ok: false, msg: "Admin only" });

      next();
    },
  );
}

// ✅ Admin stats (Total / Blocked)
app.get("/api/admin/stats", requireAdmin, (req, res) => {
  db.query(
    "SELECT COUNT(*) AS total, SUM(is_blocked=1) AS blocked FROM users",
    (err, rows) => {
      if (err)
        return res.status(500).json({ ok: false, msg: "Database error" });
      const r = rows[0] || { total: 0, blocked: 0 };
      res.json({
        ok: true,
        total: Number(r.total || 0),
        blocked: Number(r.blocked || 0),
      });
    },
  );
});

// ✅ Admin list users
app.get("/api/admin/users", requireAdmin, (req, res) => {
  db.query(
    "SELECT id, user_id, name, email, mobile, role, is_blocked, created_at FROM users ORDER BY id DESC",
    (err, rows) => {
      if (err)
        return res.status(500).json({ ok: false, msg: "Database error" });

      const users = rows.map((u) => ({
        id: u.id,
        userId: u.user_id,
        name: u.name,
        email: u.email,
        mobile: u.mobile,
        role: u.role || "user",
        blocked: Number(u.is_blocked) === 1,
        created_at: u.created_at,
      }));

      res.json({ ok: true, users });
    },
  );
});

/* ================= ADMIN USER SUMMARY (DB) ================= */
// ✅ NEW: Admin per-user summary from DB (for View Data modal)
app.get("/api/admin/users/:userId/summary", requireAdmin, (req, res) => {
  const userId = String(req.params.userId || "").trim();
  if (!userId) return res.status(400).json({ ok: false, msg: "userId required" });

  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const todayStr = `${y}-${m}-${d}`;
  const monthStr = `${y}-${m}`; // YYYY-MM

  // 1) animals count
  db.query(
    "SELECT COUNT(*) AS animals FROM animals WHERE user_id=?",
    [userId],
    (e1, aRows) => {
      if (e1) return res.status(500).json({ ok: false, msg: "Database error" });

      // 2) milk rows
      db.query(
        "SELECT COUNT(*) AS milkRows FROM milk_records WHERE user_id=?",
        [userId],
        (e2, mrRows) => {
          if (e2) return res.status(500).json({ ok: false, msg: "Database error" });

          // 3) today milk
          db.query(
            "SELECT IFNULL(SUM(total),0) AS todayMilk FROM milk_records WHERE user_id=? AND date=?",
            [userId, todayStr],
            (e3, tmRows) => {
              if (e3) return res.status(500).json({ ok: false, msg: "Database error" });

              // 4) month milk
              db.query(
                "SELECT IFNULL(SUM(total),0) AS monthMilk FROM milk_records WHERE user_id=? AND DATE_FORMAT(date,'%Y-%m')=?",
                [userId, monthStr],
                (e4, mmRows) => {
                  if (e4) return res.status(500).json({ ok: false, msg: "Database error" });

                  // 5) sales rows
                  db.query(
                    "SELECT COUNT(*) AS salesRows FROM sales WHERE user_id=?",
                    [userId],
                    (e5, srRows) => {
                      if (e5) return res.status(500).json({ ok: false, msg: "Database error" });

                      // 6) today sales (sales.date is DATE/DATETIME, so DATE(date)=todayStr safe)
                      db.query(
                        "SELECT IFNULL(SUM(total),0) AS todaySales FROM sales WHERE user_id=? AND DATE(date)=?",
                        [userId, todayStr],
                        (e6, tsRows) => {
                          if (e6) return res.status(500).json({ ok: false, msg: "Database error" });

                          // 7) month sales
                          db.query(
                            "SELECT IFNULL(SUM(total),0) AS monthSales FROM sales WHERE user_id=? AND DATE_FORMAT(date,'%Y-%m')=?",
                            [userId, monthStr],
                            (e7, msRows) => {
                              if (e7) return res.status(500).json({ ok: false, msg: "Database error" });

                              return res.json({
                                ok: true,
                                userId,
                                animals: Number(aRows?.[0]?.animals || 0),
                                milkRows: Number(mrRows?.[0]?.milkRows || 0),
                                todayMilk: Number(tmRows?.[0]?.todayMilk || 0),
                                monthMilk: Number(mmRows?.[0]?.monthMilk || 0),
                                salesRows: Number(srRows?.[0]?.salesRows || 0),
                                todaySales: Number(tsRows?.[0]?.todaySales || 0),
                                monthSales: Number(msRows?.[0]?.monthSales || 0),
                              });
                            },
                          );
                        },
                      );
                    },
                  );
                },
              );
            },
          );
        },
      );
    },
  );
});

// ✅ Block / Unblock
app.patch("/api/admin/users/:userId/block", requireAdmin, (req, res) => {
  const userId = req.params.userId;
  const blocked = req.body.blocked === true;

  // prevent blocking admin
  db.query(
    "SELECT role FROM users WHERE user_id=? LIMIT 1",
    [userId],
    (err, rows) => {
      if (err)
        return res.status(500).json({ ok: false, msg: "Database error" });
      if (rows.length === 0)
        return res.status(404).json({ ok: false, msg: "User not found" });

      if ((rows[0].role || "user") === "admin") {
        return res
          .status(400)
          .json({ ok: false, msg: "You cannot block admin" });
      }

      db.query(
        "UPDATE users SET is_blocked=? WHERE user_id=?",
        [blocked ? 1 : 0, userId],
        (err2) => {
          if (err2)
            return res.status(500).json({ ok: false, msg: "Database error" });
          res.json({
            ok: true,
            msg: blocked ? "User blocked" : "User unblocked",
          });
        },
      );
    },
  );
});

// ✅ Delete user (admin cannot delete admin)
app.delete("/api/admin/users/:userId", requireAdmin, (req, res) => {
  const userId = req.params.userId;

  db.query(
    "SELECT role FROM users WHERE user_id=? LIMIT 1",
    [userId],
    (err, rows) => {
      if (err)
        return res.status(500).json({ ok: false, msg: "Database error" });
      if (rows.length === 0)
        return res.status(404).json({ ok: false, msg: "User not found" });

      if ((rows[0].role || "user") === "admin") {
        return res
          .status(400)
          .json({ ok: false, msg: "You cannot delete admin" });
      }

      db.query("DELETE FROM users WHERE user_id=?", [userId], (err2) => {
        if (err2)
          return res.status(500).json({ ok: false, msg: "Database error" });
        res.json({ ok: true, msg: "User deleted" });
      });
    },
  );
});
/*forget*/
function genOtp6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/* ================= SEND OTP ================= */
app.post("/api/forgot/send-otp", (req, res) => {
  const input = (req.body.input || "").trim();
  if (!input) return res.status(400).json({ ok: false, msg: "Input required" });

  db.query(
    "SELECT user_id FROM users WHERE user_id=? OR email=? OR mobile=? LIMIT 1",
    [input, input, input],
    (err, rows) => {
      if (err)
        return res.status(500).json({ ok: false, msg: "Database error" });
      if (rows.length === 0)
        return res.status(404).json({ ok: false, msg: "USER_NOT_FOUND" });

      const user = rows[0];
      const otp = genOtp6();

      db.query(
        "INSERT INTO password_otps (user_id, otp, expires_at, used) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE), 0)",
        [user.user_id, otp],
        (err2) => {
          if (err2)
            return res.status(500).json({ ok: false, msg: "Database error" });

          console.log("OTP for", user.user_id, "=>", otp);

          return res.json({
            ok: true,
            msg: "OTP_SENT",
            user_id: user.user_id,
          });
        },
      );
    },
  );
});

/* ================= VERIFY OTP ================= */
app.post("/api/forgot/verify-otp", (req, res) => {
  const { user_id, otp } = req.body;

  if (!user_id || !otp)
    return res.status(400).json({ ok: false, msg: "All fields required" });

  db.query(
    `SELECT id FROM password_otps
     WHERE user_id=? AND otp=? AND used=0 AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [user_id, otp],
    (err, rows) => {
      if (err)
        return res.status(500).json({ ok: false, msg: "Database error" });

      if (rows.length === 0)
        return res.status(401).json({ ok: false, msg: "INVALID_OTP" });

      return res.json({ ok: true, msg: "OTP_VERIFIED" });
    },
  );
});

/* ================= RESET PASSWORD ================= */
const crypto = require("crypto"); // (optional, not used below)

// ✅ small helper: mysql callback -> promise
function q(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/* ================= RESET PASSWORD WITH OTP (FINAL) ================= */
app.post("/api/forgot/reset-with-otp", async (req, res) => {
  try {
    const user_id = String(req.body.user_id || "").trim();
    const otp = String(req.body.otp || "").trim();
    const newPassword = String(req.body.newPassword || "").trim();

    if (!user_id || !otp || !newPassword) {
      return res.status(400).json({ ok: false, msg: "All fields required" });
    }

    // ✅ Strong password
    const strongPass = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
    if (!strongPass.test(newPassword)) {
      return res.status(400).json({ ok: false, msg: "WEAK_PASSWORD" });
    }

    // ✅ 1) OTP valid?
    const otpRows = await q(
      `SELECT id FROM password_otps
       WHERE user_id=? AND otp=? AND used=0 AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [user_id, otp],
    );

    if (otpRows.length === 0) {
      return res.status(401).json({ ok: false, msg: "INVALID_OTP" });
    }

    const otpRowId = otpRows[0].id;

    // ✅ 2) Get current user old hash
    const urows = await q(
      "SELECT password_hash FROM users WHERE user_id=? LIMIT 1",
      [user_id],
    );

    if (urows.length === 0) {
      return res.status(404).json({ ok: false, msg: "USER_NOT_FOUND" });
    }

    const oldHash = String(urows[0].password_hash || "");

    // ✅ same as old password NOT allowed
    if (oldHash) {
      const sameOld = await bcrypt.compare(newPassword, oldHash);
      if (sameOld) {
        return res
          .status(400)
          .json({ ok: false, msg: "SAME_PASSWORD_NOT_ALLOWED" });
      }
    }

    // ✅ 3) Global unique password (check against OTHER users)
    const otherUsers = await q(
      "SELECT user_id, password_hash FROM users WHERE user_id <> ? AND password_hash IS NOT NULL",
      [user_id],
    );

    for (const r of otherUsers) {
      const h = String(r.password_hash || "");
      if (!h) continue;

      const matchAny = await bcrypt.compare(newPassword, h);
      if (matchAny) {
        return res
          .status(400)
          .json({ ok: false, msg: "PASSWORD_NOT_AVAILABLE" });
      }
    }

    // ✅ 4) Update password
    const newHash = await bcrypt.hash(newPassword, 10);
    await q("UPDATE users SET password_hash=? WHERE user_id=?", [
      newHash,
      user_id,
    ]);

    // ✅ 5) Mark OTP used (so cannot reuse)
    await q("UPDATE password_otps SET used=1 WHERE id=?", [otpRowId]);

    return res.json({ ok: true, msg: "PASSWORD_RESET_SUCCESS" });
  } catch (e) {
    console.log("RESET WITH OTP ERROR:", e);
    return res.status(500).json({ ok: false, msg: "Database/Server error" });
  }
});
/* ================= USER MIDDLEWARE ================= */
function requireUser(req, res, next) {
  const uid = (req.headers["x-user-id"] || "").toString().trim();
  if (!uid) return res.status(401).json({ ok: false, msg: "USER_ID_MISSING" });
  req.user_id = uid;
  next();
}
// ✅ Logged-in user profile (DB)
app.get("/api/profile", requireUser, (req, res) => {
  const uid = req.user_id;

  db.query(
    "SELECT user_id, name, email, mobile, role, created_at FROM users WHERE user_id=? LIMIT 1",
    [uid],
    (err, rows) => {
      if (err) {
        console.log("PROFILE DB ERROR:", err.code, err.sqlMessage);
        return res.status(500).json({ ok: false, msg: "Database error" });
      }
      if (!rows.length) {
        return res.status(404).json({ ok: false, msg: "USER_NOT_FOUND" });
      }

      return res.json({ ok: true, user: rows[0] });
    }
  );
});
/* ================= DASHBOARD (DB) ================= */

// ✅ Summary: totalAnimals, todayMilk, monthlyMilk
app.get("/api/dashboard/summary", requireUser, (req, res) => {
  const uid = req.user_id;

  // Today's date (server time)
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const todayStr = `${y}-${m}-${d}`;
  const monthStr = `${y}-${m}`; // YYYY-MM

  // 1) total animals
  db.query(
    "SELECT COUNT(*) AS totalAnimals FROM animals WHERE user_id=?",
    [uid],
    (err1, aRows) => {
      if (err1) {
        console.log("DASH animals error:", err1.code, err1.sqlMessage);
        return res.status(500).json({ ok: false, msg: "Database error" });
      }

      // 2) today milk sum
      db.query(
        "SELECT IFNULL(SUM(total),0) AS todayMilk FROM milk_records WHERE user_id=? AND date=?",
        [uid, todayStr],
        (err2, tRows) => {
          if (err2) {
            console.log("DASH today milk error:", err2.code, err2.sqlMessage);
            return res.status(500).json({ ok: false, msg: "Database error" });
          }

          // 3) monthly milk sum
          db.query(
            "SELECT IFNULL(SUM(total),0) AS monthlyMilk FROM milk_records WHERE user_id=? AND DATE_FORMAT(date,'%Y-%m')=?",
            [uid, monthStr],
            (err3, mRows) => {
              if (err3) {
                console.log(
                  "DASH monthly milk error:",
                  err3.code,
                  err3.sqlMessage,
                );
                return res
                  .status(500)
                  .json({ ok: false, msg: "Database error" });
              }

              res.json({
                ok: true,
                totalAnimals: Number(aRows?.[0]?.totalAnimals || 0),
                todayMilk: Number(tRows?.[0]?.todayMilk || 0),
                monthlyMilk: Number(mRows?.[0]?.monthlyMilk || 0),
              });
            },
          );
        },
      );
    },
  );
});

// ✅ Daily sales total: ?date=YYYY-MM-DD
app.get("/api/dashboard/sales/daily", requireUser, (req, res) => {
  const date = String(req.query.date || "").trim();
  if (!date) return res.status(400).json({ ok: false, msg: "date required" });

  db.query(
    "SELECT IFNULL(SUM(total),0) AS totalSales FROM sales WHERE user_id=? AND date=?",
    [req.user_id, date],
    (err, rows) => {
      if (err) {
        console.log("DASH daily sales error:", err.code, err.sqlMessage);
        return res.status(500).json({ ok: false, msg: "Database error" });
      }
      res.json({ ok: true, totalSales: Number(rows?.[0]?.totalSales || 0) });
    },
  );
});

// ✅ Monthly sales total: ?month=YYYY-MM
app.get("/api/dashboard/sales/monthly", requireUser, (req, res) => {
  const month = String(req.query.month || "").trim(); // YYYY-MM
  if (!month) return res.status(400).json({ ok: false, msg: "month required" });

  db.query(
    "SELECT IFNULL(SUM(total),0) AS totalSales FROM sales WHERE user_id=? AND DATE_FORMAT(date,'%Y-%m')=?",
    [req.user_id, month],
    (err, rows) => {
      if (err) {
        console.log("DASH monthly sales error:", err.code, err.sqlMessage);
        return res.status(500).json({ ok: false, msg: "Database error" });
      }
      res.json({ ok: true, totalSales: Number(rows?.[0]?.totalSales || 0) });
    },
  );
});
/* ================= DASHBOARD INSIGHTS (DB) ================= */
app.get("/api/dashboard/insights", requireUser, (req, res) => {
  const uid = req.user_id;
  const month = String(req.query.month || "").trim(); // YYYY-MM
  if (!month) return res.status(400).json({ ok: false, msg: "month required" });

  // ✅ Feed cost assumptions (simple estimate for college project)
  const FEED_COST = {
    "Dry Feed": 20,
    "Green Feed": 5,
    Concentrate: 25,
  };

  // 1) Monthly milk total
  db.query(
    "SELECT IFNULL(SUM(total),0) AS monthlyMilk FROM milk_records WHERE user_id=? AND DATE_FORMAT(date,'%Y-%m')=?",
    [uid, month],
    (e1, mRows) => {
      if (e1) return res.status(500).json({ ok: false, msg: "Database error" });

      const monthlyMilk = Number(mRows?.[0]?.monthlyMilk || 0);

      // 2) Monthly sales total
      db.query(
        "SELECT IFNULL(SUM(total),0) AS monthlySales FROM sales WHERE user_id=? AND DATE_FORMAT(date,'%Y-%m')=?",
        [uid, month],
        (e2, sRows) => {
          if (e2)
            return res.status(500).json({ ok: false, msg: "Database error" });

          const monthlySales = Number(sRows?.[0]?.monthlySales || 0);

          // 3) Feed by type (kg)
          db.query(
            "SELECT feed_type, IFNULL(SUM(qty),0) AS kg FROM feed_records WHERE user_id=? AND DATE_FORMAT(date,'%Y-%m')=? GROUP BY feed_type",
            [uid, month],
            (e3, fTypeRows) => {
              if (e3)
                return res
                  .status(500)
                  .json({ ok: false, msg: "Database error" });

              const feedByType = (fTypeRows || []).map((r) => ({
                feed_type: r.feed_type,
                kg: Number(r.kg || 0),
              }));

              const monthlyFeedKg = feedByType.reduce(
                (sum, x) => sum + Number(x.kg || 0),
                0,
              );

              // Estimated feed cost
              let estimatedFeedCost = 0;
              feedByType.forEach((x) => {
                const costPerKg = FEED_COST[x.feed_type] ?? 10;
                estimatedFeedCost += Number(x.kg || 0) * costPerKg;
              });

              const monthlyProfit = monthlySales - estimatedFeedCost;
              const milkFeedRatio =
                monthlyFeedKg > 0 ? monthlyMilk / monthlyFeedKg : 0;

              // 4) Top animal in month (milk)
              db.query(
                `
                SELECT mr.animal_id, a.name, IFNULL(SUM(mr.total),0) AS milk_total
                FROM milk_records mr
                JOIN animals a ON a.id = mr.animal_id AND a.user_id = mr.user_id
                WHERE mr.user_id=? AND DATE_FORMAT(mr.date,'%Y-%m')=?
                GROUP BY mr.animal_id, a.name
                ORDER BY milk_total DESC
                LIMIT 1
                `,
                [uid, month],
                (e4, topRows) => {
                  if (e4)
                    return res
                      .status(500)
                      .json({ ok: false, msg: "Database error" });

                  const topAnimal = topRows?.[0]
                    ? {
                        animal_id: topRows[0].animal_id,
                        name: topRows[0].name,
                        milk_total: Number(topRows[0].milk_total || 0),
                      }
                    : null;

                  // 5) Daily milk chart data
                  db.query(
                    `
                    SELECT DATE(date) AS date, IFNULL(SUM(total),0) AS total
                    FROM milk_records
                    WHERE user_id=? AND DATE_FORMAT(date,'%Y-%m')=?
                    GROUP BY DATE(date)
                    ORDER BY DATE(date)
                    `,
                    [uid, month],
                    (e5, dmRows) => {
                      if (e5)
                        return res
                          .status(500)
                          .json({ ok: false, msg: "Database error" });

                      const dailyMilk = (dmRows || []).map((r) => ({
                        date: String(r.date),
                        total: Number(r.total || 0),
                      }));

                      // 6) Daily sales chart data
                      db.query(
                        `
                        SELECT DATE(date) AS date, IFNULL(SUM(total),0) AS total
                        FROM sales
                        WHERE user_id=? AND DATE_FORMAT(date,'%Y-%m')=?
                        GROUP BY DATE(date)
                        ORDER BY DATE(date)
                        `,
                        [uid, month],
                        (e6, dsRows) => {
                          if (e6)
                            return res
                              .status(500)
                              .json({ ok: false, msg: "Database error" });

                          const dailySales = (dsRows || []).map((r) => ({
                            date: String(r.date),
                            total: Number(r.total || 0),
                          }));

                          // 7) Milk by animal (bar chart)
                          db.query(
                            `
                            SELECT mr.animal_id, a.name, IFNULL(SUM(mr.total),0) AS total
                            FROM milk_records mr
                            JOIN animals a ON a.id = mr.animal_id AND a.user_id = mr.user_id
                            WHERE mr.user_id=? AND DATE_FORMAT(mr.date,'%Y-%m')=?
                            GROUP BY mr.animal_id, a.name
                            ORDER BY total DESC
                            LIMIT 10
                            `,
                            [uid, month],
                            (e7, mbaRows) => {
                              if (e7)
                                return res
                                  .status(500)
                                  .json({ ok: false, msg: "Database error" });

                              const milkByAnimal = (mbaRows || []).map((r) => ({
                                animal_id: r.animal_id,
                                name: r.name,
                                total: Number(r.total || 0),
                              }));

                              return res.json({
                                ok: true,
                                month,
                                topAnimal,
                                monthlyMilk,
                                monthlySales,
                                monthlyFeedKg,
                                milkFeedRatio,
                                estimatedFeedCost,
                                monthlyProfit,
                                dailyMilk,
                                dailySales,
                                milkByAnimal,
                                feedByType,
                              });
                            },
                          );
                        },
                      );
                    },
                  );
                },
              );
            },
          );
        },
      );
    },
  );
});

/* ================= ANIMALS CRUD (works with your Animal.js) ================= */

// ✅ LIST
app.get("/api/animals", requireUser, (req, res) => {
  db.query(
    `SELECT 
        id AS animal_id, 
        name, 
        type, 
        ear_tag, 
        dob, 
        first_birth, 
        color, 
        breed
     FROM animals
     WHERE user_id=?
     ORDER BY id ASC`,
    [req.user_id],
    (err, rows) => {
      if (err) {
        console.log("ANIMALS LIST ERROR:", err.code, err.sqlMessage);
        return res.status(500).json({ ok: false, msg: "Database error" });
      }
      res.json({ ok: true, animals: rows });
    },
  );
});

// ✅ ADD
app.post("/api/animals", requireUser, (req, res) => {
  const { name, type, earTag, dob, firstBirth, color, breed } = req.body;

  if (!name || !type) {
    return res.status(400).json({ ok: false, msg: "Name and type required" });
  }

  // NOTE: Animal.js sends animal_id, but your DB doesn't have animal_id column.
  // So we ignore it and let MySQL auto_increment id generate.

  db.query(
    `INSERT INTO animals (user_id, name, type, ear_tag, dob, first_birth, color, breed)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      req.user_id,
      name,
      type,
      earTag || null,
      dob || null,
      firstBirth || null,
      color || null,
      breed || null,
    ],
    (err, result) => {
      if (err) {
        console.log("ANIMALS ADD ERROR:", err.code, err.sqlMessage);
        return res.status(500).json({ ok: false, msg: "Database error" });
      }
      // return new id as animal_id (so JS can use it if needed)
      res.json({ ok: true, msg: "Animal added", animal_id: result.insertId });
    },
  );
});

// ✅ UPDATE
app.put("/api/animals/:animal_id", requireUser, (req, res) => {
  const animal_id = Number(req.params.animal_id || 0);
  const { name, type, earTag, dob, firstBirth, color, breed } = req.body;

  if (!animal_id)
    return res.status(400).json({ ok: false, msg: "animal_id required" });

  db.query(
    `UPDATE animals
     SET name=?, type=?, ear_tag=?, dob=?, first_birth=?, color=?, breed=?
     WHERE user_id=? AND id=?`,
    [
      name || "",
      type || "",
      earTag || null,
      dob || null,
      firstBirth || null,
      color || null,
      breed || null,
      req.user_id,
      animal_id,
    ],
    (err, r) => {
      if (err) {
        console.log("ANIMALS UPDATE ERROR:", err.code, err.sqlMessage);
        return res.status(500).json({ ok: false, msg: "Database error" });
      }
      if (r.affectedRows === 0)
        return res.status(404).json({ ok: false, msg: "NOT_FOUND" });
      res.json({ ok: true, msg: "Animal updated" });
    },
  );
});

// ✅ DELETE
app.delete("/api/animals/:animal_id", requireUser, (req, res) => {
  const animal_id = Number(req.params.animal_id || 0);
  if (!animal_id)
    return res.status(400).json({ ok: false, msg: "animal_id required" });

  db.query(
    "DELETE FROM animals WHERE user_id=? AND id=?",
    [req.user_id, animal_id],
    (err, r) => {
      if (err) {
        console.log("ANIMALS DELETE ERROR:", err.code, err.sqlMessage);
        return res.status(500).json({ ok: false, msg: "Database error" });
      }
      if (r.affectedRows === 0)
        return res.status(404).json({ ok: false, msg: "NOT_FOUND" });
      res.json({ ok: true, msg: "Animal deleted" });
    },
  );
});
/* ================= MILK CRUD (DB) ================= */
// ✅ LIST MILK
app.get("/api/milk", requireUser, (req, res) => {
  db.query(
    `SELECT 
        id AS record_id,
        animal_id,
        date,
        morning,
        evening,
        total
     FROM milk_records
     WHERE user_id=?
     ORDER BY date DESC, id DESC`,
    [req.user_id],
    (err, rows) => {
      if (err) {
        console.log("MILK LIST ERROR:", err.code, err.sqlMessage);
        return res.status(500).json({ ok: false, msg: "Database error" });
      }
      res.json({ ok: true, records: rows });
    },
  );
});

// ✅ ADD MILK
app.post("/api/milk", requireUser, (req, res) => {
  const animalId = Number(req.body.animalId || 0);
  const date = (req.body.date || "").toString().trim();
  const morning = Number(req.body.morning || 0);
  const evening = Number(req.body.evening || 0);
  const total = morning + evening;

  if (!animalId || !date)
    return res
      .status(400)
      .json({ ok: false, msg: "animalId and date required" });

  // ✅ ensure animal belongs to same user
  db.query(
    "SELECT id FROM animals WHERE user_id=? AND id=? LIMIT 1",
    [req.user_id, animalId],
    (err, aRows) => {
      if (err)
        return res.status(500).json({ ok: false, msg: "Database error" });
      if (!aRows.length)
        return res.status(400).json({ ok: false, msg: "INVALID_ANIMAL" });

      // ✅ duplicate check: same user + same animal + same date
      db.query(
        "SELECT id FROM milk_records WHERE user_id=? AND animal_id=? AND date=? LIMIT 1",
        [req.user_id, animalId, date],
        (err2, dRows) => {
          if (err2)
            return res.status(500).json({ ok: false, msg: "Database error" });
          if (dRows.length)
            return res.json({ ok: false, msg: "DUPLICATE_ANIMAL_DATE" });

          db.query(
            `INSERT INTO milk_records (user_id, animal_id, date, morning, evening, total)
             VALUES (?,?,?,?,?,?)`,
            [req.user_id, animalId, date, morning, evening, total],
            (err3, result) => {
              if (err3) {
                console.log("MILK ADD ERROR:", err3.code, err3.sqlMessage);
                return res
                  .status(500)
                  .json({ ok: false, msg: "Database error" });
              }
              res.json({
                ok: true,
                msg: "Milk added",
                record_id: result.insertId,
              });
            },
          );
        },
      );
    },
  );
});

// ✅ UPDATE MILK
app.put("/api/milk/:record_id", requireUser, (req, res) => {
  const record_id = Number(req.params.record_id || 0);
  const animalId = Number(req.body.animalId || 0);
  const date = (req.body.date || "").toString().trim();
  const morning = Number(req.body.morning || 0);
  const evening = Number(req.body.evening || 0);
  const total = morning + evening;

  if (!record_id)
    return res.status(400).json({ ok: false, msg: "record_id required" });
  if (!animalId || !date)
    return res
      .status(400)
      .json({ ok: false, msg: "animalId and date required" });

  // ✅ ensure animal belongs to same user
  db.query(
    "SELECT id FROM animals WHERE user_id=? AND id=? LIMIT 1",
    [req.user_id, animalId],
    (err, aRows) => {
      if (err)
        return res.status(500).json({ ok: false, msg: "Database error" });
      if (!aRows.length)
        return res.status(400).json({ ok: false, msg: "INVALID_ANIMAL" });

      // ✅ duplicate check excluding current record
      db.query(
        `SELECT id FROM milk_records 
         WHERE user_id=? AND animal_id=? AND date=? AND id<>? 
         LIMIT 1`,
        [req.user_id, animalId, date, record_id],
        (err2, dRows) => {
          if (err2)
            return res.status(500).json({ ok: false, msg: "Database error" });
          if (dRows.length)
            return res.json({ ok: false, msg: "DUPLICATE_ANIMAL_DATE" });

          db.query(
            `UPDATE milk_records
             SET animal_id=?, date=?, morning=?, evening=?, total=?
             WHERE user_id=? AND id=?`,
            [animalId, date, morning, evening, total, req.user_id, record_id],
            (err3, r) => {
              if (err3) {
                console.log("MILK UPDATE ERROR:", err3.code, err3.sqlMessage);
                return res
                  .status(500)
                  .json({ ok: false, msg: "Database error" });
              }
              if (r.affectedRows === 0)
                return res.status(404).json({ ok: false, msg: "NOT_FOUND" });
              res.json({ ok: true, msg: "Milk updated" });
            },
          );
        },
      );
    },
  );
});

// ✅ DELETE MILK
app.delete("/api/milk/:record_id", requireUser, (req, res) => {
  const record_id = Number(req.params.record_id || 0);
  if (!record_id)
    return res.status(400).json({ ok: false, msg: "record_id required" });

  db.query(
    "DELETE FROM milk_records WHERE user_id=? AND id=?",
    [req.user_id, record_id],
    (err, r) => {
      if (err) {
        console.log("MILK DELETE ERROR:", err.code, err.sqlMessage);
        return res.status(500).json({ ok: false, msg: "Database error" });
      }
      if (r.affectedRows === 0)
        return res.status(404).json({ ok: false, msg: "NOT_FOUND" });
      res.json({ ok: true, msg: "Milk deleted" });
    },
  );
});
/* ================= FEED CRUD (DB) ================= */

// ✅ LIST FEED
app.get("/api/feed", requireUser, (req, res) => {
  db.query(
    `SELECT 
        id,
        animal_id,
        feed_type,
        qty,
        date
     FROM feed_records
     WHERE user_id=?
     ORDER BY date DESC, id DESC`,
    [req.user_id],
    (err, rows) => {
      if (err) {
        console.log("FEED LIST ERROR:", err.code, err.sqlMessage);
        return res.status(500).json({ ok: false, msg: "Database error" });
      }
      res.json({ ok: true, records: rows });
    },
  );
});

// ✅ ADD FEED
app.post("/api/feed", requireUser, (req, res) => {
  const animalId = Number(req.body.animalId || 0);
  const feedType = (req.body.feedType || "").toString().trim();
  const qty = Number(req.body.qty || 0);
  const date = (req.body.date || "").toString().trim();

  if (!animalId || !date)
    return res
      .status(400)
      .json({ ok: false, msg: "animalId and date required" });
  if (!feedType)
    return res.status(400).json({ ok: false, msg: "feedType required" });
  if (qty <= 0)
    return res.status(400).json({ ok: false, msg: "qty must be > 0" });

  // ✅ ensure animal belongs to same user
  db.query(
    "SELECT id FROM animals WHERE user_id=? AND id=? LIMIT 1",
    [req.user_id, animalId],
    (err, aRows) => {
      if (err)
        return res.status(500).json({ ok: false, msg: "Database error" });
      if (!aRows.length)
        return res.status(400).json({ ok: false, msg: "INVALID_ANIMAL" });

      // ✅ duplicate check
      db.query(
        `SELECT id FROM feed_records 
         WHERE user_id=? AND animal_id=? AND date=? AND feed_type=? 
         LIMIT 1`,
        [req.user_id, animalId, date, feedType],
        (err2, dRows) => {
          if (err2)
            return res.status(500).json({ ok: false, msg: "Database error" });
          if (dRows.length)
            return res.json({ ok: false, msg: "DUPLICATE_FEED" });

          db.query(
            `INSERT INTO feed_records (user_id, animal_id, feed_type, qty, date)
             VALUES (?,?,?,?,?)`,
            [req.user_id, animalId, feedType, qty, date],
            (err3, result) => {
              if (err3) {
                console.log("FEED ADD ERROR:", err3.code, err3.sqlMessage);
                return res
                  .status(500)
                  .json({ ok: false, msg: "Database error" });
              }
              res.json({ ok: true, msg: "Feed added", id: result.insertId });
            },
          );
        },
      );
    },
  );
});

// ✅ UPDATE FEED
app.put("/api/feed/:id", requireUser, (req, res) => {
  const id = Number(req.params.id || 0);
  const animalId = Number(req.body.animalId || 0);
  const feedType = (req.body.feedType || "").toString().trim();
  const qty = Number(req.body.qty || 0);
  const date = (req.body.date || "").toString().trim();

  if (!id) return res.status(400).json({ ok: false, msg: "id required" });
  if (!animalId || !date)
    return res
      .status(400)
      .json({ ok: false, msg: "animalId and date required" });
  if (!feedType)
    return res.status(400).json({ ok: false, msg: "feedType required" });
  if (qty <= 0)
    return res.status(400).json({ ok: false, msg: "qty must be > 0" });

  // ✅ ensure animal belongs to same user
  db.query(
    "SELECT id FROM animals WHERE user_id=? AND id=? LIMIT 1",
    [req.user_id, animalId],
    (err, aRows) => {
      if (err)
        return res.status(500).json({ ok: false, msg: "Database error" });
      if (!aRows.length)
        return res.status(400).json({ ok: false, msg: "INVALID_ANIMAL" });

      // ✅ duplicate check excluding current id
      db.query(
        `SELECT id FROM feed_records
         WHERE user_id=? AND animal_id=? AND date=? AND feed_type=? AND id<>?
         LIMIT 1`,
        [req.user_id, animalId, date, feedType, id],
        (err2, dRows) => {
          if (err2)
            return res.status(500).json({ ok: false, msg: "Database error" });
          if (dRows.length)
            return res.json({ ok: false, msg: "DUPLICATE_FEED" });

          db.query(
            `UPDATE feed_records
             SET animal_id=?, feed_type=?, qty=?, date=?
             WHERE user_id=? AND id=?`,
            [animalId, feedType, qty, date, req.user_id, id],
            (err3, r) => {
              if (err3) {
                console.log("FEED UPDATE ERROR:", err3.code, err3.sqlMessage);
                return res
                  .status(500)
                  .json({ ok: false, msg: "Database error" });
              }
              if (r.affectedRows === 0)
                return res.status(404).json({ ok: false, msg: "NOT_FOUND" });
              res.json({ ok: true, msg: "Feed updated" });
            },
          );
        },
      );
    },
  );
});

// ✅ DELETE FEED
app.delete("/api/feed/:id", requireUser, (req, res) => {
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ ok: false, msg: "id required" });

  db.query(
    "DELETE FROM feed_records WHERE user_id=? AND id=?",
    [req.user_id, id],
    (err, r) => {
      if (err) {
        console.log("FEED DELETE ERROR:", err.code, err.sqlMessage);
        return res.status(500).json({ ok: false, msg: "Database error" });
      }
      if (r.affectedRows === 0)
        return res.status(404).json({ ok: false, msg: "NOT_FOUND" });
      res.json({ ok: true, msg: "Feed deleted" });
    },
  );
});
/* ================= SALES CRUD (DB) ================= */
// ✅ LIST SALES (show animal name + time)
app.get("/api/sales", requireUser, (req, res) => {
  db.query(
    `
    SELECT 
      s.id,
      DATE_FORMAT(s.date, '%Y-%m-%d') AS date,
      DATE_FORMAT(s.date, '%H:%i') AS time,
      s.animal_id,
      a.name AS animal_name,
      s.milk_type,
      s.qty,
      s.rate,
      s.total
    FROM sales s
    LEFT JOIN animals a 
      ON a.id = s.animal_id AND a.user_id = s.user_id
    WHERE s.user_id=?
    ORDER BY s.date DESC, s.id DESC
    `,
    [req.user_id],
    (err, rows) => {
      if (err) {
        console.log("SALES LIST ERROR:", err.code, err.sqlMessage);
        return res.status(500).json({ ok: false, msg: "Database error" });
      }
      res.json({ ok: true, records: rows });
    }
  );
});

// ✅ ADD SALE
app.post("/api/sales", requireUser, (req, res) => {
  const animalId = Number(req.body.animalId || 0);
  const date = String(req.body.date || "").trim();     // YYYY-MM-DD
  const time = String(req.body.time || "00:00").trim(); // HH:MM
  const milkType = String(req.body.milkType || "").trim();
  const qty = Number(req.body.qty || 0);
  const rate = Number(req.body.rate || 0);
  const total = qty * rate;

  if (!animalId || !date || !milkType) {
    return res.status(400).json({ ok: false, msg: "animalId, date, milkType required" });
  }
  if (qty <= 0 || rate <= 0) {
    return res.status(400).json({ ok: false, msg: "qty and rate must be > 0" });
  }

  // ✅ ensure animal belongs to same user
  db.query(
    "SELECT id FROM animals WHERE user_id=? AND id=? LIMIT 1",
    [req.user_id, animalId],
    (err, aRows) => {
      if (err) return res.status(500).json({ ok: false, msg: "Database error" });
      if (!aRows.length) return res.status(400).json({ ok: false, msg: "INVALID_ANIMAL" });

      // ✅ duplicate check: same user + same animal + same DATE + same milkType
      db.query(
        "SELECT id FROM sales WHERE user_id=? AND animal_id=? AND DATE(date)=? AND milk_type=? LIMIT 1",
        [req.user_id, animalId, date, milkType],
        (err2, dRows) => {
          if (err2) return res.status(500).json({ ok: false, msg: "Database error" });
          if (dRows.length) return res.json({ ok: false, msg: "DUPLICATE_SALE" });

          const dt = `${date} ${time}:00`; // works even if column is DATE (time ignored)
          db.query(
            `INSERT INTO sales (user_id, animal_id, date, milk_type, qty, rate, total)
             VALUES (?,?,?,?,?,?,?)`,
            [req.user_id, animalId, dt, milkType, qty, rate, total],
            (err3, result) => {
              if (err3) {
                console.log("SALES ADD ERROR:", err3.code, err3.sqlMessage);
                return res.status(500).json({ ok: false, msg: "Database error" });
              }
              res.json({ ok: true, msg: "Sale added", id: result.insertId });
            }
          );
        }
      );
    }
  );
});

// ✅ UPDATE SALE
app.put("/api/sales/:id", requireUser, (req, res) => {
  const id = Number(req.params.id || 0);
  const animalId = Number(req.body.animalId || 0);
  const date = String(req.body.date || "").trim();
  const time = String(req.body.time || "00:00").trim();
  const milkType = String(req.body.milkType || "").trim();
  const qty = Number(req.body.qty || 0);
  const rate = Number(req.body.rate || 0);
  const total = qty * rate;

  if (!id) return res.status(400).json({ ok: false, msg: "id required" });
  if (!animalId || !date || !milkType) {
    return res.status(400).json({ ok: false, msg: "animalId, date, milkType required" });
  }
  if (qty <= 0 || rate <= 0) {
    return res.status(400).json({ ok: false, msg: "qty and rate must be > 0" });
  }

  db.query(
    "SELECT id FROM animals WHERE user_id=? AND id=? LIMIT 1",
    [req.user_id, animalId],
    (err, aRows) => {
      if (err) return res.status(500).json({ ok: false, msg: "Database error" });
      if (!aRows.length) return res.status(400).json({ ok: false, msg: "INVALID_ANIMAL" });

      // duplicate check excluding current record
      db.query(
        "SELECT id FROM sales WHERE user_id=? AND animal_id=? AND DATE(date)=? AND milk_type=? AND id<>? LIMIT 1",
        [req.user_id, animalId, date, milkType, id],
        (err2, dRows) => {
          if (err2) return res.status(500).json({ ok: false, msg: "Database error" });
          if (dRows.length) return res.json({ ok: false, msg: "DUPLICATE_SALE" });

          const dt = `${date} ${time}:00`;
          db.query(
            `UPDATE sales
             SET animal_id=?, date=?, milk_type=?, qty=?, rate=?, total=?
             WHERE user_id=? AND id=?`,
            [animalId, dt, milkType, qty, rate, total, req.user_id, id],
            (err3, r) => {
              if (err3) {
                console.log("SALES UPDATE ERROR:", err3.code, err3.sqlMessage);
                return res.status(500).json({ ok: false, msg: "Database error" });
              }
              if (r.affectedRows === 0) return res.status(404).json({ ok: false, msg: "NOT_FOUND" });
              res.json({ ok: true, msg: "Sale updated" });
            }
          );
        }
      );
    }
  );
});

// ✅ DELETE SALE
app.delete("/api/sales/:id", requireUser, (req, res) => {
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ ok: false, msg: "id required" });

  db.query(
    "DELETE FROM sales WHERE user_id=? AND id=?",
    [req.user_id, id],
    (err, r) => {
      if (err) {
        console.log("SALES DELETE ERROR:", err.code, err.sqlMessage);
        return res.status(500).json({ ok: false, msg: "Database error" });
      }
      if (r.affectedRows === 0) return res.status(404).json({ ok: false, msg: "NOT_FOUND" });
      res.json({ ok: true, msg: "Sale deleted" });
    }
  );
});
// ✅ Always JSON
app.use((req, res) => {
  res.status(404).json({ ok: false, msg: "Route not found" });
});

app.listen(5000, () => console.log("Server running on port 5000"));
