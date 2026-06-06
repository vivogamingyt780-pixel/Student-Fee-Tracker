# Student Fee Tracker — Google Sheets + Apps Script Setup Guide

Complete setup guide for connecting your Fee Tracker app to Google Sheets.

---

## Step 1: Create a Google Spreadsheet

1. Go to [sheets.google.com](https://sheets.google.com) and sign in.
2. Click **Blank** to create a new spreadsheet.
3. Rename it to **"Fee Tracker Database"** (click the title at top).

---

## Step 2: Open Google Apps Script

1. In your spreadsheet, click **Extensions** → **Apps Script**.
2. A new tab will open with the script editor.
3. Delete any existing code in the editor (the default `function myFunction() {}`).

---

## Step 3: Paste the Backend Code

1. Open the file `Code.gs` from this folder.
2. Copy **all** the contents.
3. Paste it into the Apps Script editor.
4. Click **Save** (Ctrl+S / Cmd+S). Name the project **"Fee Tracker Backend"**.

---

## Step 4: Deploy as a Web App

1. Click **Deploy** → **New deployment**.
2. Click the gear icon ⚙️ next to "Select type" and choose **Web app**.
3. Fill in the settings:
   - **Description**: Fee Tracker API v1
   - **Execute as**: Me (your Google account)
   - **Who has access**: **Anyone** ← (important! The app needs this to work)
4. Click **Deploy**.
5. Click **Authorize access** and sign in with your Google account.
6. Grant the required permissions.
7. Copy the **Web App URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

---

## Step 5: Connect to Your Fee Tracker App

1. Open your Fee Tracker app.
2. Go to **Settings**.
3. Paste the Web App URL into the **Google Apps Script URL** field.
4. Click **Test Connection** to verify.
5. Click **Save**.

Once connected:
- All your data will automatically sync to Google Sheets.
- Students, payments, and profiles are stored in separate sheets.
- Each user's data is isolated by their User ID.

---

## Sheet Structure (auto-created)

When you first use the app after connecting, these sheets are created automatically:

### `Users` Sheet
| id | username | passwordHash | coachingId | createdAt |

### `Students` Sheet
| id | userId | name | parentName | mobile | email | address | batch | className | totalFee | admissionDate | status | createdAt | updatedAt |

### `Payments` Sheet
| id | userId | studentId | receiptNumber | amountPaid | paymentDate | paymentType | dueDate | notes | createdAt |

### `Profiles` Sheet
| id | userId | name | ownerName | mobile | address | logoBase64 | updatedAt |

---

## How Data Sync Works

- The app works **100% offline** using your browser's localStorage.
- When a Google Apps Script URL is configured, every data change is also sent to Google Sheets.
- This gives you a cloud backup of all your data.
- You can view/edit data directly in Google Sheets if needed.

---

## Updating the Web App (after code changes)

If you edit `Code.gs` later:
1. Click **Deploy** → **Manage deployments**.
2. Click the pencil ✏️ icon on your deployment.
3. Change **Version** to **New version**.
4. Click **Deploy**.

---

## Troubleshooting

**"Test Connection" fails:**
- Make sure "Who has access" is set to **Anyone**.
- Try opening the Web App URL directly in your browser — you should see `{"status":"ok","message":"Fee Tracker API is running."}`.
- Re-deploy and try again.

**Data not appearing in Sheets:**
- Check that the URL in Settings is the correct `/exec` URL (not the `/dev` URL).
- The `/dev` URL is for testing only and requires Google sign-in.

**Permissions error:**
- Go to Apps Script → Run → Run function → Select `doGet` → Authorize again.

---

## Deploying to Netlify

1. Build your app:
   ```bash
   npm run build
   ```
2. The build output is in the `dist/` folder.
3. Go to [netlify.com](https://netlify.com) → **Add new site** → **Deploy manually**.
4. Drag and drop the `dist/public/` folder.
5. Your app is live! Share the URL with your team.

For automatic deploys, connect your GitHub repository instead.

### Netlify `_redirects` file

The app already includes a `_redirects` file in `public/` for SPA routing:
```
/*    /index.html   200
```
This ensures page refreshes work correctly.

---

## Security Notes

- Passwords are stored as SHA-256 hashes — never in plain text.
- Each user can only access their own data (filtered by userId).
- The Google Apps Script URL should be kept private — don't share it publicly.
- For production use, consider adding an additional API key/secret to the script.

---

## Data Backup & Restore

The app has built-in backup/restore:
- **Settings → Backup Data** — downloads all your data as a `.json` file.
- **Settings → Restore Data** — uploads a backup file to restore.
- If connected to Google Sheets, backup also syncs to the cloud.
