# PDF to Sheet - Chrome Extension

Convert PDF tables to Google Sheets and Excel with one click.

## Features

- 📄 **PDF Parsing** - Extract tables from PDF documents using PDF.js
- 📊 **Google Sheets** - Export directly to Google Sheets via Drive API
- 📁 **Excel Export** - Download as .xlsx file
- 📄 **CSV Export** - Download as .csv file
- 🎨 **Modern UI** - Clean popup interface with drag & drop support
- ⚡ **Fast Processing** - Offscreen Document for optimal performance

## Tech Stack

- **Manifest V3** - Latest Chrome Extension standard
- **TypeScript** - Type-safe development
- **Vite** - Modern build tool with @crxjs/vite-plugin
- **PDF.js** - Mozilla's PDF parser (v4.8)
- **SheetJS (xlsx)** - Excel file generation (v0.18)
- **Google APIs** - Drive & Sheets integration

## Project Structure

```
pdf-to-sheet/
├── manifest.json               # Extension manifest (MV3)
├── src/
│   ├── background/
│   │   └── service-worker.ts   # Background service worker
│   ├── popup/
│   │   ├── popup.html          # Popup UI
│   │   ├── popup.css           # Popup styles
│   │   └── popup.ts            # Popup logic
│   ├── offscreen/
│   │   ├── offscreen.html      # Offscreen document
│   │   └── offscreen.ts        # PDF processing & Excel generation
│   ├── lib/                    # Utility libraries (future)
│   └── types/                  # TypeScript definitions
├── public/
│   └── pdf.worker.min.js       # PDF.js worker
├── icons/                      # Extension icons
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project
3. Enable **Google Drive API** and **Google Sheets API**
4. Create **OAuth 2.0 Client ID**:
   - Application type: Chrome Extension
   - Extension ID: (get from chrome://extensions in developer mode)
5. Copy Client ID to `manifest.json` → `oauth2.client_id`

### 3. Download PDF.js Worker

```bash
# Download pdf.worker.min.js from pdfjs-dist
cp node_modules/pdfjs-dist/build/pdf.worker.min.js public/
```

### 4. Build Extension

```bash
# Development mode (with auto-reload)
npm run dev

# Production build
npm run build
```

### 5. Load Extension in Chrome

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `dist` folder

## Development

### Available Scripts

- `npm run dev` - Start dev server with HMR
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Architecture

#### Service Worker
- Central coordinator for extension
- Handles Google OAuth authentication
- Manages communication between popup and offscreen document
- Provides file download functionality

#### Offscreen Document
- Has DOM access (required by PDF.js)
- Processes PDF files and extracts tables
- Generates Excel files using SheetJS
- Runs in separate context from Service Worker

#### Popup UI
- Main user interface
- Drag & drop file upload
- Progress tracking
- Data preview before export

## Usage

1. Click extension icon in toolbar
2. Drag & drop PDF file or click "Select PDF File"
3. Wait for processing (progress bar shows status)
4. Preview extracted table data
5. Choose export option:
   - **Google Sheets** - Creates new spreadsheet in your Drive
   - **Excel** - Downloads .xlsx file
   - **CSV** - Downloads .csv file

## Limitations

- PDF files must contain text (not scanned images)
- Table structure is inferred from text coordinates
- Complex multi-page tables may require manual adjustment
- Google API has rate limits (60 requests/min for Sheets)

## Future Enhancements

- [ ] OCR support for scanned PDFs (Tesseract.js)
- [ ] Manual table selection tool
- [ ] Batch processing multiple PDFs
- [ ] Custom formatting templates
- [ ] Dark mode
- [ ] History of conversions

## Permissions

- `storage` - Save settings and history
- `identity` - Google OAuth authentication
- `downloads` - Download Excel/CSV files
- `offscreen` - PDF processing in offscreen document
- `host_permissions` - Access Google APIs

## License

MIT

## Credits

Built following the technical architecture from `compass_artifact` documentation.
