# Setup Guide: Chrome Web Store & Google OAuth

This guide explains how to publish the extension to Chrome Web Store and configure Google OAuth authentication.

---

## Prerequisites

- Google Account
- $5 for Chrome Web Store developer registration (one-time fee)
- Extension built and tested locally

---

## Part 1: Publish to Chrome Web Store (Get Extension ID)

### Step 1: Register as Chrome Web Store Developer

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Accept the terms of service
3. **Pay the $5 registration fee** (one-time)
4. Complete registration

### Step 2: Build Extension for Publication

```bash
cd pdf-to-google-sheets

# Update version in manifest.json (already done: v0.0.1)

# Build production version
npm run build

# Create ZIP archive
powershell -Command "Compress-Archive -Path dist/* -DestinationPath pdf-to-sheet-v0.0.1.zip -Force"
```

**Result:** `pdf-to-sheet-v0.0.1.zip` (~600KB)

### Step 3: Upload to Chrome Web Store

1. Open [Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Click **"New Item"**
3. Upload ZIP file:
   ```
   C:\Users\George\Desktop\startup\cws_ideator\pdf-to-google-sheets\pdf-to-sheet-v0.0.1.zip
   ```
4. Wait for upload to complete

### Step 4: Get Extension ID

After upload, the Extension ID will appear in the URL:
```
https://chrome.google.com/webstore/devconsole/.../YOUR_EXTENSION_ID
```

**Extension ID format:** 32 characters (e.g., `dgkjakmbfiniapfghejhccflmcnlbhak`)

**Copy this ID** - you'll need it for Google OAuth setup!

### Step 5: Configure Listing (Optional for now)

For testing, you can:
- Leave in **Draft** status
- Set Visibility to **Private** or **Unlisted**
- Skip store listing details (can fill later)

This allows you to use the Extension ID for OAuth without publishing publicly.

---

## Part 2: Configure Google Cloud OAuth

### Step 1: Create Google Cloud Project

1. Go to https://console.cloud.google.com/
2. Click **"Select a project"** → **"New Project"**
3. Project name: `PDF to Sheet Extension`
4. Click **"Create"**
5. Wait for project creation (takes ~30 seconds)

### Step 2: Enable Required APIs

1. In your project, go to **"APIs & Services"** → **"Enable APIs and Services"**
2. Search for and enable:
   - ✅ **Google Drive API**
     - Click "Enable"
     - Wait for confirmation
   - ✅ **Google Sheets API**
     - Click "Enable"
     - Wait for confirmation

### Step 3: Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. User Type: **External** (select and click "Create")
3. Fill in App Information:
   - App name: `PDF to Sheet Converter`
   - User support email: your email
   - App logo: (skip for now)
   - App domain: (skip for now)
   - Developer contact information: your email
4. Click **"Save and Continue"**

5. **Scopes** page:
   - Click **"Add or Remove Scopes"**
   - Search and add:
     - `https://www.googleapis.com/auth/drive.file`
     - `https://www.googleapis.com/auth/spreadsheets`
   - Click **"Update"**
   - Click **"Save and Continue"**

6. **Test users** page:
   - Click **"Add Users"**
   - Add your email address
   - Click **"Add"**
   - Click **"Save and Continue"**

7. Review and click **"Back to Dashboard"**

### Step 4: Create OAuth 2.0 Client ID

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. Application type: **Chrome Extension**
4. Fill in details:
   - Name: `PDF to Sheet Extension`
   - Item ID (Extension ID): `dgkjakmbfiniapfghejhccflmcnlbhak`
   - (Use your actual Extension ID from Part 1)
5. Click **"Create"**

### Step 5: Copy Client ID

A popup will show your credentials:
- **Client ID:** `XXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com`

**Copy the Client ID** - you need it for the next step!

---

## Part 3: Update Extension with OAuth Client ID

### Update manifest.json

Replace `YOUR_CLIENT_ID` in `manifest.json` with your actual Client ID:

```json
{
  "oauth2": {
    "client_id": "XXXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/spreadsheets"
    ]
  }
}
```

### Rebuild and Reload

```bash
# Rebuild extension
npm run build

# Reload extension in Chrome
# 1. Go to chrome://extensions
# 2. Find "PDF to Sheet Converter"
# 3. Click reload button (🔄)
```

---

## Part 4: Test OAuth Flow

1. Open the extension
2. Upload a PDF file
3. Click **"Export to Google Sheets"**
4. You should see Google OAuth consent screen
5. Grant permissions
6. Extension should create a new Google Sheet

---

## Troubleshooting

### "OAuth client ID not configured"
- Verify Client ID is correctly copied to manifest.json
- Rebuild extension: `npm run build`
- Reload extension in chrome://extensions

### "Access blocked: This app's request is invalid"
- Check Extension ID matches in both:
  - Chrome Web Store listing
  - Google Cloud OAuth client
- Verify scopes are exactly:
  - `https://www.googleapis.com/auth/drive.file`
  - `https://www.googleapis.com/auth/spreadsheets`

### "This app is blocked"
- Add your email to Test Users in OAuth consent screen
- App must be in "Testing" mode for external users

### "Redirect URI mismatch"
- For Chrome Extensions, no redirect URI needed
- Verify Application type is "Chrome Extension" not "Web application"

---

## Publishing to Production (Later)

When ready to publish publicly:

1. Complete Chrome Web Store listing:
   - Add 128x128 icon
   - Screenshots (1280x800 or 640x400)
   - Detailed description
   - Privacy policy (if collecting data)

2. Submit Google OAuth verification:
   - Required for apps requesting sensitive scopes
   - Requires privacy policy and homepage
   - Can take 3-7 days

3. Publish extension:
   - Change visibility to "Public"
   - Submit for review
   - Review takes 1-3 days

---

## Current Status

- ✅ Extension built: `pdf-to-sheet-v0.0.1.zip`
- ✅ Extension ID: `dgkjakmbfiniapfghejhccflmcnlbhak`
- ⏳ Client ID: (waiting for setup)
- ⏳ OAuth testing: (pending Client ID)

---

## References

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Chrome Extension OAuth](https://developer.chrome.com/docs/extensions/mv3/tut_oauth/)
- [Google Drive API](https://developers.google.com/drive/api/guides/about-sdk)
- [Google Sheets API](https://developers.google.com/sheets/api/guides/concepts)
