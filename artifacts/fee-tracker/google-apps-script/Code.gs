/**
 * Student Fee Tracker — Google Apps Script Backend
 * =================================================
 * Google Sheets is the sole database. No user configuration required.
 *
 * ONE-TIME SETUP (app owner only):
 *
 *  1. Go to https://script.google.com → New project.
 *  2. Paste this entire file → Save (Ctrl+S).
 *  3. Click Deploy → New deployment → Web app:
 *       Execute as:    Me
 *       Who can access: Anyone
 *  4. Copy the Web App URL (https://script.google.com/macros/s/…/exec).
 *  5. In Netlify → Site settings → Environment variables → add:
 *       VITE_GAS_URL = <paste the URL here>
 *  6. Trigger a new Netlify deploy.
 *
 * Done. Google Sheets are created automatically on first use.
 * End users just sign up, log in, and their data syncs automatically.
 *
 * ─── Sheet structure (auto-created on first request) ─────────────────────────
 *  Users    : userId | username | passwordHash | coachingId | createdAt
 *  Students : id | userId | name | parentName | mobile | email | address |
 *             batch | className | totalFee | admissionDate | status | createdAt | updatedAt
 *  Payments : id | userId | studentId | receiptNumber | amountPaid |
 *             paymentDate | paymentType | dueDate | notes | createdAt
 *  Profiles : id | userId | name | ownerName | mobile | address | updatedAt
 *             (logo is stored device-locally only — too large for Sheets cells)
 */

var SHEET = {
  USERS:    "Users",
  STUDENTS: "Students",
  PAYMENTS: "Payments",
  PROFILES: "Profiles",
};

var HEADERS = {
  Users:    ["userId",  "username",  "passwordHash", "coachingId", "createdAt"],
  Students: ["id", "userId", "name", "parentName", "mobile", "email", "address",
             "batch", "className", "totalFee", "admissionDate", "status", "createdAt", "updatedAt"],
  Payments: ["id", "userId", "studentId", "receiptNumber", "amountPaid",
             "paymentDate", "paymentType", "dueDate", "notes", "createdAt"],
  Profiles: ["id", "userId", "name", "ownerName", "mobile", "address", "updatedAt"],
};

// ─── Entry points ─────────────────────────────────────────────────────────────

function doGet() {
  return respond({ status: "ok", message: "Fee Tracker API is running." });
}

function doPost(e) {
  try {
    var body    = JSON.parse(e.postData.contents);
    var action  = String(body.action  || "");
    var payload = body.payload || {};

    var result;
    if      (action === "auth")      result = handleAuth(payload);
    else if (action === "students")  result = handleStudents(payload);
    else if (action === "payments")  result = handlePayments(payload);
    else if (action === "profile")   result = handleProfile(payload);
    else if (action === "syncBulk")  result = handleSyncBulk(payload);
    else result = { success: false, error: "Unknown action: " + action };

    return respond(result);
  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

function respond(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── Sheet helpers ────────────────────────────────────────────────────────────

function getSheet(name) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    var headers = HEADERS[name] || [];
    if (headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    }
  }
  return sheet;
}

function sheetToObjects(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[String(h)] = row[i]; });
    return obj;
  });
}

/** Returns 1-based row index of the first row where column[colIdx] === value, or -1. */
function findRow(sheet, colIdx, value) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colIdx]) === String(value)) return i + 1;
  }
  return -1;
}

/** Deletes all rows (excluding header) where column[colIdx] matches userId. Bottom-to-top. */
function deleteRowsByUserId(sheet, colIdx, userId) {
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][colIdx]) === String(userId)) {
      sheet.deleteRow(i + 1);
    }
  }
}

function generateId() {
  return Utilities.getUuid();
}

function now() {
  return new Date().toISOString();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function hashPassword(password) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) {
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

function handleAuth(payload) {
  var method = String(payload.method || "");
  if      (method === "signup")         return authSignup(payload);
  else if (method === "login")          return authLogin(payload);
  else if (method === "changePassword") return authChangePassword(payload);
  else return { success: false, error: "Unknown auth method: " + method };
}

function authSignup(p) {
  var username     = String(p.username     || "").trim();
  var password     = String(p.password     || "");
  var coachingName = String(p.coachingName || "My Coaching");

  if (username.length < 3)
    return { success: false, error: "Username must be at least 3 characters." };
  if (password.length < 6)
    return { success: false, error: "Password must be at least 6 characters." };

  var sheet = getSheet(SHEET.USERS);
  var users = sheetToObjects(sheet);

  if (users.find(function(u) {
    return String(u.username).toLowerCase() === username.toLowerCase();
  })) {
    return { success: false, error: "Username already taken. Please choose another." };
  }

  var userId     = generateId();
  var coachingId = generateId();
  var ts         = now();

  sheet.appendRow([userId, username, hashPassword(password), coachingId, ts]);

  // Create a default profile row
  var profileSheet = getSheet(SHEET.PROFILES);
  profileSheet.appendRow([coachingId, userId, coachingName, "", "", "", ts]);

  return {
    success: true,
    user: { id: userId, username: username, coachingId: coachingId },
  };
}

function authLogin(p) {
  var username = String(p.username || "").trim();
  var password = String(p.password || "");
  var pwHash   = hashPassword(password);

  var sheet = getSheet(SHEET.USERS);
  var users = sheetToObjects(sheet);

  var user = null;
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].username).toLowerCase() === username.toLowerCase() &&
        String(users[i].passwordHash) === pwHash) {
      user = users[i];
      break;
    }
  }

  if (!user) {
    return { success: false, error: "Invalid username or password." };
  }

  var uid = String(user.userId);

  // Return all user data in one round trip so the client can hydrate instantly.
  return {
    success:  true,
    user:     { id: uid, username: String(user.username), coachingId: String(user.coachingId) },
    students: fetchStudents(uid),
    payments: fetchPayments(uid),
    profile:  fetchProfile(uid),
  };
}

function authChangePassword(p) {
  var userId      = String(p.userId          || "");
  var currentPwd  = String(p.currentPassword || "");
  var newPwd      = String(p.newPassword     || "");

  if (newPwd.length < 6)
    return { success: false, error: "New password must be at least 6 characters." };

  var sheet = getSheet(SHEET.USERS);
  var users = sheetToObjects(sheet);
  var idx   = -1;

  for (var i = 0; i < users.length; i++) {
    if (String(users[i].userId) === userId &&
        String(users[i].passwordHash) === hashPassword(currentPwd)) {
      idx = i;
      break;
    }
  }

  if (idx === -1) return { success: false, error: "Current password is incorrect." };

  // Column index 3 (0-based) = passwordHash; row is idx+2 (1-based + skip header)
  sheet.getRange(idx + 2, 3).setValue(hashPassword(newPwd));
  return { success: true };
}

// ─── Students ─────────────────────────────────────────────────────────────────

function handleStudents(payload) {
  if (!payload.userId) return { success: false, error: "userId required" };
  var method = String(payload.method || "");
  if      (method === "create") return studentsCreate(payload);
  else if (method === "update") return studentsUpdate(payload);
  else if (method === "delete") return studentsDelete(payload);
  else return { success: false, error: "Unknown students method: " + method };
}

function fetchStudents(userId) {
  var all = sheetToObjects(getSheet(SHEET.STUDENTS));
  return all
    .filter(function(s) { return String(s.userId) === userId; })
    .map(function(s) {
      return {
        id:            String(s.id),
        userId:        String(s.userId),
        name:          String(s.name),
        parentName:    String(s.parentName),
        mobile:        String(s.mobile),
        email:         String(s.email   || ""),
        address:       String(s.address || ""),
        batch:         String(s.batch),
        className:     String(s.className),
        totalFee:      Number(s.totalFee),
        admissionDate: String(s.admissionDate),
        status:        String(s.status) === "active" ? "active" : "inactive",
        createdAt:     String(s.createdAt),
      };
    });
}

function studentsCreate(p) {
  var s   = p.student;
  var ts  = now();
  var id  = String(s.id || generateId());
  getSheet(SHEET.STUDENTS).appendRow([
    id, p.userId, s.name, s.parentName, s.mobile,
    s.email || "", s.address || "",
    s.batch, s.className, Number(s.totalFee), s.admissionDate,
    s.status || "active", s.createdAt || ts, ts,
  ]);
  return { success: true };
}

function studentsUpdate(p) {
  var s      = p.student;
  var sheet  = getSheet(SHEET.STUDENTS);
  var rowIdx = findRow(sheet, 0, s.id);   // col 0 = id
  var ts     = now();
  var row    = [
    String(s.id), p.userId, s.name, s.parentName, s.mobile,
    s.email || "", s.address || "",
    s.batch, s.className, Number(s.totalFee), s.admissionDate,
    s.status, s.createdAt || ts, ts,
  ];
  if (rowIdx === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);
  }
  return { success: true };
}

function studentsDelete(p) {
  var sheet  = getSheet(SHEET.STUDENTS);
  var rowIdx = findRow(sheet, 0, p.studentId);
  if (rowIdx !== -1) sheet.deleteRow(rowIdx);
  return { success: true };
}

// ─── Payments ─────────────────────────────────────────────────────────────────

function handlePayments(payload) {
  if (!payload.userId) return { success: false, error: "userId required" };
  var method = String(payload.method || "");
  if      (method === "create") return paymentsCreate(payload);
  else if (method === "delete") return paymentsDelete(payload);
  else return { success: false, error: "Unknown payments method: " + method };
}

function fetchPayments(userId) {
  var all = sheetToObjects(getSheet(SHEET.PAYMENTS));
  return all
    .filter(function(p) { return String(p.userId) === userId; })
    .map(function(p) {
      return {
        id:            String(p.id),
        userId:        String(p.userId),
        studentId:     String(p.studentId),
        receiptNumber: String(p.receiptNumber),
        amountPaid:    Number(p.amountPaid),
        paymentDate:   String(p.paymentDate),
        paymentType:   String(p.paymentType) === "full" ? "full" : "partial",
        dueDate:       String(p.dueDate || ""),
        notes:         String(p.notes   || ""),
        createdAt:     String(p.createdAt),
      };
    });
}

function paymentsCreate(p) {
  var pay = p.payment;
  var ts  = now();
  var id  = String(pay.id || generateId());
  getSheet(SHEET.PAYMENTS).appendRow([
    id, p.userId, pay.studentId,
    pay.receiptNumber, Number(pay.amountPaid),
    pay.paymentDate, pay.paymentType,
    pay.dueDate || "", pay.notes || "",
    pay.createdAt || ts,
  ]);
  return { success: true };
}

function paymentsDelete(p) {
  var sheet  = getSheet(SHEET.PAYMENTS);
  var rowIdx = findRow(sheet, 0, p.paymentId);
  if (rowIdx !== -1) sheet.deleteRow(rowIdx);
  return { success: true };
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

function handleProfile(payload) {
  if (!payload.userId) return { success: false, error: "userId required" };
  if (payload.method === "update") return profileUpdate(payload);
  return { success: false, error: "Unknown profile method: " + payload.method };
}

function fetchProfile(userId) {
  var all = sheetToObjects(getSheet(SHEET.PROFILES));
  var row = null;
  for (var i = 0; i < all.length; i++) {
    if (String(all[i].userId) === userId) { row = all[i]; break; }
  }
  if (!row) return null;
  return {
    id:        String(row.id),
    userId:    String(row.userId),
    name:      String(row.name),
    ownerName: String(row.ownerName || ""),
    mobile:    String(row.mobile    || ""),
    address:   String(row.address   || ""),
    // logoBase64 intentionally omitted — logos are stored device-locally only
  };
}

function profileUpdate(p) {
  var profile = p.profile;
  var sheet   = getSheet(SHEET.PROFILES);
  var ts      = now();
  var rowIdx  = findRow(sheet, 1, p.userId);   // col 1 = userId
  var id      = String(profile.id || generateId());
  var row     = [id, p.userId, profile.name, profile.ownerName || "",
                 profile.mobile || "", profile.address || "", ts];
  if (rowIdx === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);
  }
  return { success: true };
}

// ─── Bulk sync ────────────────────────────────────────────────────────────────
// Replaces ALL rows for a userId in Students and Payments, then updates the
// profile. Called by the frontend on logout to flush any pending mutations.

function handleSyncBulk(payload) {
  var userId = String(payload.userId || "");
  if (!userId) return { success: false, error: "userId required" };

  if (Array.isArray(payload.students)) {
    replaceUserStudents(userId, payload.students);
  }
  if (Array.isArray(payload.payments)) {
    replaceUserPayments(userId, payload.payments);
  }
  if (payload.profile) {
    profileUpdate({ userId: userId, profile: payload.profile });
  }

  return { success: true };
}

function replaceUserStudents(userId, students) {
  var sheet = getSheet(SHEET.STUDENTS);
  deleteRowsByUserId(sheet, 1, userId);   // col 1 = userId
  var ts = now();
  students.forEach(function(s) {
    sheet.appendRow([
      String(s.id || generateId()), userId,
      s.name, s.parentName, s.mobile,
      s.email || "", s.address || "",
      s.batch, s.className, Number(s.totalFee), s.admissionDate,
      s.status || "active",
      s.createdAt || ts, ts,
    ]);
  });
}

function replaceUserPayments(userId, payments) {
  var sheet = getSheet(SHEET.PAYMENTS);
  deleteRowsByUserId(sheet, 1, userId);   // col 1 = userId
  var ts = now();
  payments.forEach(function(p) {
    sheet.appendRow([
      String(p.id || generateId()), userId, p.studentId,
      p.receiptNumber, Number(p.amountPaid),
      p.paymentDate, p.paymentType,
      p.dueDate || "", p.notes || "",
      p.createdAt || ts,
    ]);
  });
}
