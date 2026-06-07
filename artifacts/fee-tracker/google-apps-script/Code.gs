/**
 * Student Fee Tracker — Google Apps Script Backend
 * =================================================
 * ONE-TIME SETUP (app owner only — end users never do this):
 *
 *  1. Go to https://script.google.com and create a new project.
 *  2. Paste this entire file into the editor and save.
 *  3. Click Deploy → New deployment → Web app.
 *     · Execute as:    Me
 *     · Who has access: Anyone
 *  4. Copy the Web app URL (looks like https://script.google.com/macros/s/…/exec).
 *  5. In Netlify: Site settings → Environment variables → add
 *       VITE_GAS_URL = <paste the URL>
 *  6. Trigger a new Netlify deploy.
 *
 * That's it. Google Sheets are created automatically on first use.
 * End users just sign up and use the app — no configuration needed.
 *
 * ─── Sheet structure (auto-created) ─────────────────────────────────────────
 *   Users    : userId | username | passwordHash | coachingId | createdAt
 *   Students : id | userId | name | parentName | mobile | email | address |
 *              batch | className | totalFee | admissionDate | status | createdAt | updatedAt
 *   Payments : id | userId | studentId | receiptNumber | amountPaid |
 *              paymentDate | paymentType | dueDate | notes | createdAt
 *   Profiles : id | userId | name | ownerName | mobile | address | updatedAt
 *              (logo is NOT synced — too large for Sheets; stays device-local)
 */

const SHEET = {
  USERS:    "Users",
  STUDENTS: "Students",
  PAYMENTS: "Payments",
  PROFILES: "Profiles",
};

// ─── Entry points ─────────────────────────────────────────────────────────────

function doGet(e) {
  return respond({ status: "ok", message: "Fee Tracker API is running." });
}

function doPost(e) {
  try {
    const body     = JSON.parse(e.postData.contents);
    const action   = body.action;
    const payload  = body.payload || {};

    let result;
    switch (action) {
      case "auth":     result = handleAuth(payload);     break;
      case "students": result = handleStudents(payload); break;
      case "payments": result = handlePayments(payload); break;
      case "profile":  result = handleProfile(payload);  break;
      default:
        result = { success: false, error: "Unknown action: " + action };
    }
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

const HEADERS = {
  [SHEET.USERS]:    ["userId", "username", "passwordHash", "coachingId", "createdAt"],
  [SHEET.STUDENTS]: ["id", "userId", "name", "parentName", "mobile", "email", "address",
                     "batch", "className", "totalFee", "admissionDate", "status", "createdAt", "updatedAt"],
  [SHEET.PAYMENTS]: ["id", "userId", "studentId", "receiptNumber", "amountPaid",
                     "paymentDate", "paymentType", "dueDate", "notes", "createdAt"],
  [SHEET.PROFILES]: ["id", "userId", "name", "ownerName", "mobile", "address", "updatedAt"],
};

function getSheet(name) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    const headers = HEADERS[name] || [];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function findRowIndex(sheet, colIndex, value) {
  // Returns 1-based row index or -1 if not found (skips header row 1)
  const data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colIndex]) === String(value)) return i + 1;
  }
  return -1;
}

function generateId() {
  return Utilities.getUuid();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function hashPassword(password) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password),
    Utilities.Charset.UTF_8
  );
  return bytes.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');
}

function handleAuth(payload) {
  switch (payload.method) {
    case "signup":         return authSignup(payload);
    case "login":          return authLogin(payload);
    case "changePassword": return authChangePassword(payload);
    default:
      return { success: false, error: "Unknown auth method: " + payload.method };
  }
}

function authSignup(p) {
  var username    = String(p.username || "").trim();
  var password    = String(p.password || "");
  var coachingName = String(p.coachingName || "My Coaching");

  if (!username || username.length < 3)
    return { success: false, error: "Username must be at least 3 characters." };
  if (!password || password.length < 6)
    return { success: false, error: "Password must be at least 6 characters." };

  var sheet = getSheet(SHEET.USERS);
  var users = sheetToObjects(sheet);

  if (users.find(function(u) { return u.username.toLowerCase() === username.toLowerCase(); })) {
    return { success: false, error: "Username already taken. Please choose another." };
  }

  var userId     = generateId();
  var coachingId = generateId();
  var now        = new Date().toISOString();

  sheet.appendRow([userId, username, hashPassword(password), coachingId, now]);

  // Create default profile
  var profileSheet = getSheet(SHEET.PROFILES);
  profileSheet.appendRow([coachingId, userId, coachingName, "", "", "", now]);

  return {
    success: true,
    user: { id: userId, username: username, coachingId: coachingId },
  };
}

function authLogin(p) {
  var username = String(p.username || "").trim();
  var password = String(p.password || "");

  var sheet    = getSheet(SHEET.USERS);
  var users    = sheetToObjects(sheet);
  var pwHash   = hashPassword(password);

  var user = users.find(function(u) {
    return u.username.toLowerCase() === username.toLowerCase() &&
           String(u.passwordHash)   === pwHash;
  });

  if (!user) {
    return { success: false, error: "Invalid username or password." };
  }

  // Fetch all user data and return it with the login response
  // so the frontend can hydrate localStorage in one round trip.
  var students = fetchStudents(String(user.userId));
  var payments = fetchPayments(String(user.userId));
  var profile  = fetchProfile(String(user.userId));

  return {
    success:  true,
    user:     { id: String(user.userId), username: String(user.username), coachingId: String(user.coachingId) },
    students: students,
    payments: payments,
    profile:  profile,
  };
}

function authChangePassword(p) {
  var userId          = String(p.userId || "");
  var currentPassword = String(p.currentPassword || "");
  var newPassword     = String(p.newPassword || "");

  if (newPassword.length < 6)
    return { success: false, error: "New password must be at least 6 characters." };

  var sheet = getSheet(SHEET.USERS);
  var users = sheetToObjects(sheet);
  var idx   = -1;

  for (var i = 0; i < users.length; i++) {
    if (String(users[i].userId) === userId &&
        String(users[i].passwordHash) === hashPassword(currentPassword)) {
      idx = i;
      break;
    }
  }

  if (idx === -1) return { success: false, error: "Current password is incorrect." };

  // Column 3 (0-indexed) = passwordHash; row = idx + 2 (header + 1-based)
  sheet.getRange(idx + 2, 3).setValue(hashPassword(newPassword));
  return { success: true };
}

// ─── Students ─────────────────────────────────────────────────────────────────

function handleStudents(payload) {
  if (!payload.userId) return { success: false, error: "userId required" };
  switch (payload.method) {
    case "create": return studentsCreate(payload);
    case "update": return studentsUpdate(payload);
    case "delete": return studentsDelete(payload);
    default:
      return { success: false, error: "Unknown students method: " + payload.method };
  }
}

function fetchStudents(userId) {
  var sheet = getSheet(SHEET.STUDENTS);
  var all   = sheetToObjects(sheet);
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
  var sheet   = getSheet(SHEET.STUDENTS);
  var student = p.student;
  var now     = new Date().toISOString();
  var id      = String(student.id || generateId());

  sheet.appendRow([
    id, p.userId,
    student.name, student.parentName, student.mobile,
    student.email || "", student.address || "",
    student.batch, student.className,
    Number(student.totalFee), student.admissionDate,
    student.status || "active",
    student.createdAt || now, now,
  ]);
  return { success: true };
}

function studentsUpdate(p) {
  var sheet   = getSheet(SHEET.STUDENTS);
  var student = p.student;
  var rowIdx  = findRowIndex(sheet, 0, student.id); // col 0 = id
  var now     = new Date().toISOString();

  if (rowIdx === -1) {
    // Not in sheet yet — insert it
    return studentsCreate(p);
  }

  var row = [
    String(student.id), p.userId,
    student.name, student.parentName, student.mobile,
    student.email || "", student.address || "",
    student.batch, student.className,
    Number(student.totalFee), student.admissionDate,
    student.status,
    student.createdAt || now, now,
  ];
  sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);
  return { success: true };
}

function studentsDelete(p) {
  var sheet  = getSheet(SHEET.STUDENTS);
  var rowIdx = findRowIndex(sheet, 0, p.studentId);
  if (rowIdx !== -1) sheet.deleteRow(rowIdx);
  return { success: true };
}

// ─── Payments ─────────────────────────────────────────────────────────────────

function handlePayments(payload) {
  if (!payload.userId) return { success: false, error: "userId required" };
  switch (payload.method) {
    case "create": return paymentsCreate(payload);
    case "delete": return paymentsDelete(payload);
    default:
      return { success: false, error: "Unknown payments method: " + payload.method };
  }
}

function fetchPayments(userId) {
  var sheet = getSheet(SHEET.PAYMENTS);
  var all   = sheetToObjects(sheet);
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
        notes:         String(p.notes  || ""),
        createdAt:     String(p.createdAt),
      };
    });
}

function paymentsCreate(p) {
  var sheet   = getSheet(SHEET.PAYMENTS);
  var payment = p.payment;
  var id      = String(payment.id || generateId());
  var now     = new Date().toISOString();

  sheet.appendRow([
    id, p.userId, payment.studentId,
    payment.receiptNumber, Number(payment.amountPaid),
    payment.paymentDate, payment.paymentType,
    payment.dueDate || "", payment.notes || "",
    payment.createdAt || now,
  ]);
  return { success: true };
}

function paymentsDelete(p) {
  var sheet  = getSheet(SHEET.PAYMENTS);
  var rowIdx = findRowIndex(sheet, 0, p.paymentId);
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
  var sheet = getSheet(SHEET.PROFILES);
  var all   = sheetToObjects(sheet);
  var row   = all.find(function(p) { return String(p.userId) === userId; });
  if (!row) return null;
  return {
    id:        String(row.id),
    userId:    String(row.userId),
    name:      String(row.name),
    ownerName: String(row.ownerName || ""),
    mobile:    String(row.mobile    || ""),
    address:   String(row.address   || ""),
    // logoBase64 intentionally not stored in Sheets (too large)
  };
}

function profileUpdate(p) {
  var sheet   = getSheet(SHEET.PROFILES);
  var profile = p.profile;
  var now     = new Date().toISOString();
  var rowIdx  = findRowIndex(sheet, 1, p.userId); // col 1 = userId

  var id  = String(profile.id || generateId());
  var row = [id, p.userId, profile.name, profile.ownerName || "",
             profile.mobile || "", profile.address || "", now];

  if (rowIdx === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(rowIdx, 1, 1, row.length).setValues([row]);
  }
  return { success: true };
}
