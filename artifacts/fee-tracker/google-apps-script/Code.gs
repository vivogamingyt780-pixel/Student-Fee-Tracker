/**
 * Student Fee Tracker - Google Apps Script Backend
 * ================================================
 * Paste this entire file into your Google Apps Script project.
 * See SETUP_GUIDE.md for step-by-step instructions.
 *
 * Endpoints (all via POST with JSON body):
 *   action: "auth"      — login / signup / changePassword
 *   action: "students"  — CRUD for students
 *   action: "payments"  — CRUD for payments
 *   action: "profile"   — get/set coaching profile
 *   action: "backup"    — export all user data
 *   action: "restore"   — import data from backup
 */

// ─── CONFIGURATION ───────────────────────────────────────────────────────────

const SHEET_NAMES = {
  USERS:    "Users",
  STUDENTS: "Students",
  PAYMENTS: "Payments",
  PROFILES: "Profiles",
};

// ─── MAIN ENTRY POINT ────────────────────────────────────────────────────────

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const { action, payload } = body;

    let result;
    switch (action) {
      case "auth":      result = handleAuth(payload);     break;
      case "students":  result = handleStudents(payload); break;
      case "payments":  result = handlePayments(payload); break;
      case "profile":   result = handleProfile(payload);  break;
      case "backup":    result = handleBackup(payload);   break;
      case "restore":   result = handleRestore(payload);  break;
      default:
        result = { success: false, error: "Unknown action: " + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", message: "Fee Tracker API is running." }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── SHEET HELPERS ────────────────────────────────────────────────────────────

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    initSheet(sheet, name);
  }
  return sheet;
}

function initSheet(sheet, name) {
  const headers = {
    [SHEET_NAMES.USERS]:    ["id", "username", "passwordHash", "coachingId", "createdAt"],
    [SHEET_NAMES.STUDENTS]: ["id", "userId", "name", "parentName", "mobile", "email", "address", "batch", "className", "totalFee", "admissionDate", "status", "createdAt", "updatedAt"],
    [SHEET_NAMES.PAYMENTS]: ["id", "userId", "studentId", "receiptNumber", "amountPaid", "paymentDate", "paymentType", "dueDate", "notes", "createdAt"],
    [SHEET_NAMES.PROFILES]: ["id", "userId", "name", "ownerName", "mobile", "address", "logoBase64", "updatedAt"],
  };
  if (headers[name]) {
    sheet.appendRow(headers[name]);
    sheet.getRange(1, 1, 1, headers[name].length).setFontWeight("bold");
  }
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function findRowById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) return i + 1; // 1-indexed
  }
  return -1;
}

function generateId() {
  return Utilities.getUuid();
}

// ─── AUTH HANDLER ─────────────────────────────────────────────────────────────

function handleAuth(payload) {
  const { method } = payload;

  if (method === "signup") {
    return authSignup(payload);
  } else if (method === "login") {
    return authLogin(payload);
  } else if (method === "changePassword") {
    return authChangePassword(payload);
  }
  return { success: false, error: "Unknown auth method" };
}

function hashPassword(password) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function authSignup({ username, password, coachingName }) {
  const sheet = getSheet(SHEET_NAMES.USERS);
  const users = sheetToObjects(sheet);

  if (users.find(u => u.username === username)) {
    return { success: false, error: "Username already exists" };
  }

  const id = generateId();
  const coachingId = generateId();
  const passwordHash = hashPassword(password);
  const now = new Date().toISOString();

  sheet.appendRow([id, username, passwordHash, coachingId, now]);

  // Create default coaching profile
  const profileSheet = getSheet(SHEET_NAMES.PROFILES);
  profileSheet.appendRow([coachingId, id, coachingName || "My Coaching", "", "", "", "", now]);

  return {
    success: true,
    user: { id, username, coachingId },
  };
}

function authLogin({ username, password }) {
  const sheet = getSheet(SHEET_NAMES.USERS);
  const users = sheetToObjects(sheet);
  const passwordHash = hashPassword(password);

  const user = users.find(u => u.username === username && u.passwordHash === passwordHash);
  if (!user) {
    return { success: false, error: "Invalid username or password" };
  }

  return {
    success: true,
    user: { id: user.id, username: user.username, coachingId: user.coachingId },
  };
}

function authChangePassword({ userId, currentPassword, newPassword }) {
  const sheet = getSheet(SHEET_NAMES.USERS);
  const users = sheetToObjects(sheet);
  const currentHash = hashPassword(currentPassword);

  const userIndex = users.findIndex(u => u.id === userId && u.passwordHash === currentHash);
  if (userIndex === -1) {
    return { success: false, error: "Current password is incorrect" };
  }

  const rowIndex = userIndex + 2; // +1 for header, +1 for 1-indexed
  const newHash = hashPassword(newPassword);
  sheet.getRange(rowIndex, 3).setValue(newHash); // column 3 = passwordHash

  return { success: true };
}

// ─── STUDENTS HANDLER ─────────────────────────────────────────────────────────

function handleStudents(payload) {
  const { method, userId } = payload;

  if (!userId) return { success: false, error: "userId required" };

  switch (method) {
    case "list":   return studentsGetAll(userId);
    case "create": return studentsCreate(payload);
    case "update": return studentsUpdate(payload);
    case "delete": return studentsDelete(payload);
    default:       return { success: false, error: "Unknown students method" };
  }
}

function studentsGetAll(userId) {
  const sheet = getSheet(SHEET_NAMES.STUDENTS);
  const all = sheetToObjects(sheet);
  const students = all.filter(s => s.userId === userId);
  return { success: true, data: students };
}

function studentsCreate({ userId, student }) {
  const sheet = getSheet(SHEET_NAMES.STUDENTS);
  const id = generateId();
  const now = new Date().toISOString();

  sheet.appendRow([
    id, userId,
    student.name, student.parentName, student.mobile,
    student.email || "", student.address || "",
    student.batch, student.className,
    Number(student.totalFee), student.admissionDate,
    student.status || "active",
    now, now,
  ]);

  return { success: true, data: { id, ...student, userId, createdAt: now, updatedAt: now } };
}

function studentsUpdate({ student }) {
  const sheet = getSheet(SHEET_NAMES.STUDENTS);
  const rowIndex = findRowById(sheet, student.id);
  if (rowIndex === -1) return { success: false, error: "Student not found" };

  const now = new Date().toISOString();
  const row = [
    student.id, student.userId,
    student.name, student.parentName, student.mobile,
    student.email || "", student.address || "",
    student.batch, student.className,
    Number(student.totalFee), student.admissionDate,
    student.status,
    student.createdAt || now, now,
  ];
  sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);

  return { success: true, data: { ...student, updatedAt: now } };
}

function studentsDelete({ studentId }) {
  const sheet = getSheet(SHEET_NAMES.STUDENTS);
  const rowIndex = findRowById(sheet, studentId);
  if (rowIndex === -1) return { success: false, error: "Student not found" };

  sheet.deleteRow(rowIndex);
  return { success: true };
}

// ─── PAYMENTS HANDLER ─────────────────────────────────────────────────────────

function handlePayments(payload) {
  const { method, userId } = payload;

  if (!userId) return { success: false, error: "userId required" };

  switch (method) {
    case "list":   return paymentsGetAll(userId);
    case "create": return paymentsCreate(payload);
    case "delete": return paymentsDelete(payload);
    default:       return { success: false, error: "Unknown payments method" };
  }
}

function paymentsGetAll(userId) {
  const sheet = getSheet(SHEET_NAMES.PAYMENTS);
  const all = sheetToObjects(sheet);
  const payments = all.filter(p => p.userId === userId);
  return { success: true, data: payments };
}

function paymentsCreate({ userId, payment }) {
  const sheet = getSheet(SHEET_NAMES.PAYMENTS);
  const id = generateId();
  const now = new Date().toISOString();

  sheet.appendRow([
    id, userId, payment.studentId,
    payment.receiptNumber, Number(payment.amountPaid),
    payment.paymentDate, payment.paymentType,
    payment.dueDate || "", payment.notes || "",
    now,
  ]);

  return { success: true, data: { id, ...payment, userId, createdAt: now } };
}

function paymentsDelete({ paymentId }) {
  const sheet = getSheet(SHEET_NAMES.PAYMENTS);
  const rowIndex = findRowById(sheet, paymentId);
  if (rowIndex === -1) return { success: false, error: "Payment not found" };

  sheet.deleteRow(rowIndex);
  return { success: true };
}

// ─── PROFILE HANDLER ─────────────────────────────────────────────────────────

function handleProfile(payload) {
  const { method, userId } = payload;

  if (!userId) return { success: false, error: "userId required" };

  if (method === "get") {
    return profileGet(userId);
  } else if (method === "update") {
    return profileUpdate(payload);
  }
  return { success: false, error: "Unknown profile method" };
}

function profileGet(userId) {
  const sheet = getSheet(SHEET_NAMES.PROFILES);
  const all = sheetToObjects(sheet);
  const profile = all.find(p => p.userId === userId);
  if (!profile) return { success: false, error: "Profile not found" };
  return { success: true, data: profile };
}

function profileUpdate({ userId, profile }) {
  const sheet = getSheet(SHEET_NAMES.PROFILES);
  const all = sheetToObjects(sheet);
  const idx = all.findIndex(p => p.userId === userId);
  const now = new Date().toISOString();

  const row = [
    profile.id || generateId(), userId,
    profile.name, profile.ownerName,
    profile.mobile, profile.address,
    profile.logoBase64 || "", now,
  ];

  if (idx === -1) {
    sheet.appendRow(row);
  } else {
    sheet.getRange(idx + 2, 1, 1, row.length).setValues([row]);
  }

  return { success: true, data: { ...profile, userId, updatedAt: now } };
}

// ─── BACKUP / RESTORE ─────────────────────────────────────────────────────────

function handleBackup({ userId }) {
  if (!userId) return { success: false, error: "userId required" };

  const students = studentsGetAll(userId).data || [];
  const payments = paymentsGetAll(userId).data || [];
  const profile  = profileGet(userId).data || null;

  return {
    success: true,
    data: {
      exportedAt: new Date().toISOString(),
      userId,
      students,
      payments,
      profile,
    },
  };
}

function handleRestore({ userId, backup }) {
  if (!userId || !backup) return { success: false, error: "userId and backup required" };

  // Restore profile
  if (backup.profile) {
    profileUpdate({ userId, profile: backup.profile });
  }

  // Restore students
  const studentSheet = getSheet(SHEET_NAMES.STUDENTS);
  const allStudents = sheetToObjects(studentSheet);
  const existingIds = new Set(allStudents.map(s => s.id));

  (backup.students || []).forEach(student => {
    if (!existingIds.has(student.id)) {
      studentSheet.appendRow([
        student.id, userId, student.name, student.parentName, student.mobile,
        student.email || "", student.address || "", student.batch, student.className,
        Number(student.totalFee), student.admissionDate, student.status || "active",
        student.createdAt || new Date().toISOString(), student.updatedAt || new Date().toISOString(),
      ]);
    }
  });

  // Restore payments
  const paymentSheet = getSheet(SHEET_NAMES.PAYMENTS);
  const allPayments = sheetToObjects(paymentSheet);
  const existingPaymentIds = new Set(allPayments.map(p => p.id));

  (backup.payments || []).forEach(payment => {
    if (!existingPaymentIds.has(payment.id)) {
      paymentSheet.appendRow([
        payment.id, userId, payment.studentId,
        payment.receiptNumber, Number(payment.amountPaid),
        payment.paymentDate, payment.paymentType,
        payment.dueDate || "", payment.notes || "",
        payment.createdAt || new Date().toISOString(),
      ]);
    }
  });

  return { success: true, message: "Restore completed" };
}
