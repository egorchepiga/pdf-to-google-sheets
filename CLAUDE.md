# Agent Orchestration Rules

> **IMPORTANT**: This file overrides default Claude Code behavior. Follow these rules strictly.

## Main Pattern: You Are The Orchestrator

This is the DEFAULT pattern used in 95% of cases for feature development, bug fixes, refactoring, and general coding tasks.

### Core Rules

**1. GATHER FULL CONTEXT FIRST (MANDATORY)**

Before delegating or implementing any task:
- Read existing code in related files
- Search codebase for similar patterns
- Review relevant documentation (specs, design docs, ADRs)
- Check recent commits in related areas
- Understand dependencies and integration points

NEVER delegate or implement blindly.

**2. DELEGATE TO SUBAGENTS**

Before delegation:
- Provide complete context (code snippets, file paths, patterns, docs)
- Specify exact expected output and validation criteria

After delegation (CRITICAL):
- ALWAYS verify results (read modified files, run type-check)
- NEVER skip verification
- If incorrect: re-delegate with corrections and errors
- If TypeScript errors: re-delegate to same agent OR typescript-types-specialist

**3. EXECUTE DIRECTLY (MINIMAL ONLY)**

Direct execution only for:
- Single dependency install
- Single-line fixes (typos, obvious bugs)
- Simple imports
- Minimal config changes

Everything else: delegate.

**4. TRACK PROGRESS**

- Create todos at task start
- Mark in_progress BEFORE starting
- Mark completed AFTER verification only

**5. COMMIT STRATEGY**

Run `/push patch` after EACH completed task:
- Mark task [X] in tasks.md
- Add artifacts: `→ Artifacts: [file1](path), [file2](path)`
- Update TodoWrite to completed
- Then `/push patch`

**6. EXECUTION PATTERN**

```
FOR EACH TASK:
1. Read task description
2. GATHER FULL CONTEXT (code + docs + patterns + history)
3. Delegate to subagent OR execute directly (trivial only)
4. VERIFY results (read files + run type-check) - NEVER skip
5. Accept/reject loop (re-delegate if needed)
6. Update TodoWrite to completed
7. Mark task [X] in tasks.md + add artifacts
8. Run /push patch
9. Move to next task
```

**7. HANDLING CONTRADICTIONS**

If contradictions occur:
- Gather context, analyze project patterns
- If truly ambiguous: ask user with specific options
- Only ask when unable to determine best practice (rare, ~10%)

**8. LIBRARY-FIRST APPROACH (MANDATORY)**

Before writing new code (>20 lines), ALWAYS search for existing libraries:
- WebSearch: "npm {functionality} library 2024" or "python {functionality} package"
- Context7: documentation for candidate libraries
- Check: weekly downloads >1000, commits in last 6 months, TypeScript/types support

**Use library when**:
- Covers >70% of required functionality
- Actively maintained, no critical vulnerabilities
- Reasonable bundle size (check bundlephobia.com)

**Write custom code when**:
- <20 lines of simple logic
- All libraries abandoned or insecure
- Core business logic requiring full control

### Planning Phase (ALWAYS First)

Before implementing tasks:
- Analyze execution model (parallel/sequential)
- Assign executors: MAIN for trivial, existing if 100% match, FUTURE otherwise
- Create FUTURE agents: launch N meta-agent-v3 calls in single message, ask restart
- Resolve research (simple: solve now, complex: deepresearch prompt)
- Atomicity: 1 task = 1 agent call
- Parallel: launch N calls in single message (not sequentially)

See speckit.implement.md for details.

---

## Health Workflows Pattern (5% of cases)

Slash commands: `/health-bugs`, `/health-security`, `/health-cleanup`, `/health-deps`

Follow command-specific instructions. See `docs/Agents Ecosystem/AGENT-ORCHESTRATION.md`.

---

## Project Conventions

**File Organization**:
- Agents: `.claude/agents/{domain}/{orchestrators|workers}/`
- Commands: `.claude/commands/`
- Skills: `.claude/skills/{skill-name}/SKILL.md`
- Temporary: `.tmp/current/` (git ignored)
- Reports: `docs/reports/{domain}/{YYYY-MM}/`

**Code Standards**:
- Type-check must pass before commit
- Build must pass before commit
- No hardcoded credentials

**Agent Selection**:
- Worker: Plan file specifies nextAgent (health workflows only)
- Skill: Reusable utility, no state, <100 lines

**Supabase Operations**:
- Use Supabase MCP when `.mcp.json` includes supabase server

**MCP Configuration**:
- BASE (`.mcp.base.json`): context7 + sequential-thinking (~600 tokens)
- FULL (`.mcp.full.json`): + supabase + playwright + n8n + shadcn (~5000 tokens)
- Switch: `./switch-mcp.sh`

---

## Reference Docs

- Agent orchestration: `docs/Agents Ecosystem/AGENT-ORCHESTRATION.md`
- Architecture: `docs/Agents Ecosystem/ARCHITECTURE.md`
- Quality gates: `docs/Agents Ecosystem/QUALITY-GATES-SPECIFICATION.md`
- Report templates: `docs/Agents Ecosystem/REPORT-TEMPLATE-STANDARD.md`

---

# Project-Specific Context: PDF to Google Sheets Extension

This file provides comprehensive context and guidance for Claude Code when working with this Chrome Extension project.

---

## Project Overview

**PDF to Google Sheets Extension** - Chrome browser extension (Manifest V3) that converts PDF tables to Google Sheets, Excel, or CSV format.

**Key Features:**
- 📄 Extract tables from text-based PDFs
- 📊 Export to Google Sheets (via Drive API)
- 📁 Download as Excel (.xlsx)
- 📄 Download as CSV
- 🎨 Modern drag-and-drop UI
- ⚡ Offscreen Document for optimal performance

**Technology Stack:**
- Manifest V3 (Chrome Extension standard)
- TypeScript
- Vite + @crxjs/vite-plugin (build tool)
- PDF.js v4.8 (PDF parsing)
- SheetJS v0.18 (Excel generation)
- Google Drive/Sheets API

---

## Project Structure

```
pdf-to-google-sheets/
├── .git/                      # Git repository
├── .gitignore                 # Git ignore rules
├── CLAUDE.md                  # THIS FILE - context for Claude Code
├── README.md                  # User-facing documentation
├── DEVELOPMENT_LOG.md         # Development progress tracking
├── TEST_SPEC.md               # Test specifications (not implemented yet)
│
├── manifest.json              # Chrome Extension manifest (MV3)
├── package.json               # NPM dependencies
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite build configuration
│
├── src/                       # Source code (TypeScript)
│   ├── background/
│   │   └── service-worker.ts  # Background service worker
│   ├── popup/
│   │   ├── popup.html         # Popup UI
│   │   ├── popup.css          # Popup styles
│   │   └── popup.ts           # Popup logic
│   ├── offscreen/
│   │   ├── offscreen.html     # Offscreen document
│   │   └── offscreen.ts       # PDF processing & Excel generation
│   ├── lib/
│   │   └── table-extractor.ts # Table extraction library (tested)
│   └── types/                 # TypeScript definitions
│
├── tests/                     # Test suite (71 tests)
│   ├── unit/
│   │   └── table-extractor.test.ts  # 30 unit tests
│   ├── integration/
│   │   └── pdf-parsing.test.ts      # 41 integration tests
│   ├── fixtures/              # Test PDF files (8 files)
│   ├── setup.ts               # Jest setup & Chrome API mocks
│   └── generate-test-pdfs.cjs # PDF generator script
│
├── public/
│   └── pdf.worker.min.js      # PDF.js worker (1.4MB)
│
├── dist/                      # Built extension (generated by Vite)
│   ├── manifest.json          # Compiled manifest
│   ├── assets/                # Compiled JS/CSS
│   ├── src/                   # Compiled HTML
│   └── pdf.worker.min.js      # Copied worker
│
├── input/                     # Research materials (from previous project)
│   ├── compass_artifact...md  # Technical design document
│   ├── summary.md             # Niche analysis
│   └── extensions/            # Competitor analysis
│
├── demo.html                  # Standalone demo (with real PDF parsing!)
├── test.html                  # Simple UI test page
├── test-build.cjs             # Build verification script
│
├── jest.config.cjs            # Jest configuration
├── Dockerfile                 # Multi-stage Docker build
├── docker-compose.yml         # Docker services (dev, test, build)
├── DOCKER.md                  # Docker documentation
│
├── .claude/                   # Claude Code orchestration (from orchestrator-kit)
├── mcp/                       # MCP server configurations
├── switch-mcp.sh              # MCP configuration switcher
├── .env.local                 # Environment variables
│
└── node_modules/              # NPM packages (gitignored)
```

---

## Quick Start

### First Time Setup

```bash
# Navigate to project
cd pdf-to-google-sheets

# Install dependencies
npm install

# Copy PDF.js worker (if not present)
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.js
```

### Development Commands

```bash
# Start dev server (with HMR)
npm run dev

# Build for production
npm run build

# Run build verification tests
node test-build.cjs

# Run all tests (71 tests)
npm test

# Run unit tests only (30 tests)
npm run test:unit

# Run integration tests only (41 tests)
npm run test:integration

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Generate test PDF fixtures
npm run test:generate-pdfs

# Docker commands
docker-compose up dev           # Dev server
docker-compose up test          # Run tests
docker-compose up build         # Build production
docker-compose up test-coverage # Tests with coverage
```

### Testing in Chrome

1. Build the extension: `npm run build`
2. Open Chrome: `chrome://extensions`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `dist/` folder
6. Extension appears in toolbar!

### Testing Demo Page

```bash
# Open demo.html in browser
# Has full PDF parsing functionality
# Works standalone without Chrome Extension APIs
```

---

## Architecture Details

### Manifest V3 Components

#### 1. **Service Worker** (`src/background/service-worker.ts`)
- Runs in background (event-driven, not persistent)
- Handles:
  - Google OAuth authentication (`chrome.identity.getAuthToken`)
  - File downloads (`chrome.downloads.download`)
  - Offscreen Document management
  - Message passing between popup and offscreen
- **IMPORTANT**: No DOM access, cannot use PDF.js directly

#### 2. **Popup** (`src/popup/popup.*`)
- Main user interface
- Features:
  - Drag & drop file upload
  - Progress tracking
  - Data preview (first 10 rows)
  - Export buttons
- Sends messages to Service Worker for processing

#### 3. **Offscreen Document** (`src/offscreen/offscreen.*`)
- Hidden document with DOM access
- Reasons: `DOM_PARSER`, `WORKERS`
- Handles:
  - PDF.js initialization and parsing
  - Table extraction from text coordinates
  - Excel file generation with SheetJS
- Created on-demand by Service Worker

### Message Flow

```
User uploads PDF in Popup
    ↓
Popup → Service Worker: { action: 'processPdf', data: ArrayBuffer }
    ↓
Service Worker → Offscreen: { target: 'offscreen', action: 'parsePdf' }
    ↓
Offscreen processes PDF with PDF.js
    ↓
Offscreen → Service Worker: { success: true, tables: string[][] }
    ↓
Service Worker → Popup: { success: true, tables: string[][] }
    ↓
Popup displays preview and export buttons
```

---

## Key Algorithms

### Table Extraction Algorithm

Located in `src/offscreen/offscreen.ts` and `demo.html`

**How it works:**

1. **PDF.js Parsing**
   ```javascript
   const textContent = await page.getTextContent();
   // Returns array of text items with coordinates
   ```

2. **Coordinate Extraction**
   ```javascript
   items = textContent.items.map(item => ({
     text: item.str,
     x: item.transform[4],        // X position
     y: viewport.height - item.transform[5],  // Y position (flipped)
     width: item.width,
     height: item.transform[0]
   }));
   ```

3. **Row Grouping** (Y-axis clustering)
   ```javascript
   const rowThreshold = 5; // pixels
   // Group items with Y difference < 5px into same row
   ```

4. **Column Detection** (X-axis analysis)
   ```javascript
   const colThreshold = 10; // pixels
   // Detect unique X positions as column boundaries
   ```

5. **Cell Assignment**
   ```javascript
   // Find closest column for each text item
   // Merge multiple text items in same cell with space
   ```

**Thresholds:**
- `rowThreshold: 5px` - Max Y difference for same row
- `colThreshold: 10px` - Min X difference for different column
- **Adjustable** for different PDF layouts!

---

## Data Types & Validation

### Core Data Structure

```typescript
// Table data is always 2D array of strings
type TableData = string[][];

// Example:
const exportedData: TableData = [
  ['Name', 'Email', 'Phone'],        // Header row
  ['John', 'john@example.com', '555-0123'],
  ['Jane', 'jane@example.com', '555-0456']
];
```

### Validation Rules (See TEST_SPEC.md)

1. **Type**: Must be `Array<Array<string>>`
2. **Consistency**: All rows must have same column count
3. **Sanitization**: Null/undefined → empty string
4. **Escaping**: Commas and quotes in CSV export

---

## Google API Configuration

### Required APIs
- Google Drive API
- Google Sheets API

### OAuth Scopes
```json
{
  "scopes": [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/spreadsheets"
  ]
}
```

**Note:** `drive.file` scope does NOT require Google Security Assessment (unlike `drive` scope)

### Setup Steps (Not Yet Done)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project
3. Enable APIs: Drive + Sheets
4. Create OAuth 2.0 Client ID:
   - Type: Chrome Extension
   - Extension ID: Get from `chrome://extensions` in dev mode
5. Update `manifest.json`:
   ```json
   "oauth2": {
     "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
     "scopes": [...]
   }
   ```

---

## Build System

### Vite + CRXJS

**Why Vite?**
- Fast HMR (Hot Module Replacement)
- ES modules support
- TypeScript out of the box
- Optimized production builds

**Why CRXJS?**
- Chrome Extension-specific Vite plugin
- Handles Manifest V3 complexities
- Auto-reloads extension on code changes
- Transforms TS imports in manifest

### Build Output

```
dist/
├── manifest.json              # Transformed from src
├── service-worker-loader.js   # CRXJS-generated loader
├── assets/
│   ├── popup-*.js             # Compiled popup code
│   ├── popup-*.css            # Compiled styles
│   ├── offscreen-*.js         # Compiled offscreen code
│   └── service-worker.ts-*.js # Compiled background script
├── src/
│   ├── popup/popup.html       # Copied HTML
│   └── offscreen/offscreen.html
└── pdf.worker.min.js          # Copied from public/
```

---

## Common Development Tasks

### Add New Feature

1. **Plan architecture** (create task list with TodoWrite)
2. **Update relevant files**:
   - `src/popup/` for UI changes
   - `src/background/` for API calls
   - `src/offscreen/` for heavy processing
3. **Test in dev mode**: `npm run dev` → load in Chrome
4. **Update DEVELOPMENT_LOG.md**
5. **Commit with proper message format**

### Debug Issues

**Popup Issues:**
- Right-click extension icon → "Inspect popup"
- Console logs visible in DevTools

**Service Worker Issues:**
- `chrome://extensions` → Click "service worker" link
- Console logs appear in new DevTools window

**Offscreen Document Issues:**
- `chrome://extensions` → "Inspect views: offscreen.html"
- Check console for PDF.js errors

### Update Dependencies

```bash
# Check for updates
npm outdated

# Update specific package
npm install pdfjs-dist@latest

# Update all (risky!)
npm update
```

---

## OCR Integration (Future)

### Architecture for OCR

Already implemented in `demo.html`:

```javascript
const ExtractionMethod = {
  TEXT: 'text',      // Current: PDF.js text extraction
  OCR: 'ocr',        // Future: Tesseract.js
  HYBRID: 'hybrid'   // Future: Try text, fallback to OCR
};
```

### Implementation Plan

1. **Add Tesseract.js**:
   ```bash
   npm install tesseract.js
   ```

2. **Detect PDF type**:
   ```javascript
   async function detectPdfType(arrayBuffer) {
     const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
     const page = await pdf.getPage(1);
     const textContent = await page.getTextContent();

     if (textContent.items.length === 0) {
       return 'scanned'; // No text → probably scanned
     }
     return 'text';
   }
   ```

3. **Implement OCR extraction**:
   ```javascript
   async function extractWithOcr(arrayBuffer) {
     // 1. Convert PDF page to image
     // 2. Run Tesseract.js
     // 3. Parse OCR output into table structure
     // 4. Return string[][]
   }
   ```

4. **Hybrid mode**:
   ```javascript
   async function parsePdf(arrayBuffer, method = 'hybrid') {
     if (method === 'hybrid') {
       try {
         const result = await parsePdfText(arrayBuffer);
         if (result.length > 0) return result;
       } catch (e) {
         // Fallback to OCR
       }
       return await extractWithOcr(arrayBuffer);
     }
   }
   ```

---

## Performance Considerations

### PDF.js Worker

- **Size**: 1.4MB (large!)
- **Loading**: Async via `workerSrc`
- **Memory**: Can spike for large PDFs
- **Solution**: Process pages sequentially, not all at once

### Large Tables

- **Preview limit**: Show only first 10 rows in UI
- **Full data**: Export all rows to file
- **Memory**: Clear `exportedData` on reset()

### Build Size

Current production build:
- `offscreen-*.js`: ~650KB (PDF.js + SheetJS)
- `popup-*.js`: ~5KB
- `service-worker-*.js`: ~3KB
- Total: ~660KB (acceptable for extension)

**Optimization ideas:**
- Code splitting (dynamic imports)
- Tree shaking (remove unused PDF.js features)
- Compression (already enabled in Vite)

---

## Testing Strategy

### Test Suite (71 Tests ✅)

**Current status**: Comprehensive test suite implemented and passing

- **30 Unit Tests** - Complete coverage of table extraction algorithm
  - File: `tests/unit/table-extractor.test.ts`
  - Module: `src/lib/table-extractor.ts`

- **41 Integration Tests** - PDF fixture validation
  - File: `tests/integration/pdf-parsing.test.ts`
  - Fixtures: 8 different test PDFs in `tests/fixtures/`

### Test Coverage

Exceeds all thresholds:
- **Statements**: 100% (required 80%)
- **Branches**: 94.59% (required 75%)
- **Functions**: 100% (required 85%)
- **Lines**: 100% (required 80%)

### Running Tests

```bash
# Run all tests
npm test

# Run unit tests only (30 tests)
npm run test:unit

# Run integration tests only (41 tests)
npm run test:integration

# Run with coverage report
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### Test Fixtures

8 test PDF files covering various scenarios:
- `simple-3x3.pdf` - Basic 3x3 table
- `wide-table.pdf` - 10 columns (landscape)
- `long-table.pdf` - 50 rows with page breaks
- `special-chars.pdf` - Quotes, dollar signs, special characters
- `multi-page.pdf` - Table split across 2 pages
- `empty.pdf` - PDF without tables
- `misaligned.pdf` - Slightly offset columns
- `numeric.pdf` - Decimal numbers, commas, currency

### Docker Testing

```bash
docker-compose up test          # Run all tests
docker-compose up test-coverage # Tests with coverage
```

See `DOCKER.md` for detailed Docker documentation.

### Manual Testing Checklist

1. ✅ Build verification: `node test-build.cjs`
2. ✅ Demo page: Open `demo.html`, upload PDF
3. ✅ Unit tests: `npm run test:unit`
4. ✅ Integration tests: `npm run test:integration`
5. ⏭️ Extension in Chrome: Load `dist/` folder, test with real PDFs

---

## Git Workflow

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation only
- `refactor/` - Code refactoring

### Commit Message Format

```
<type>: <short description>

<detailed description>

<optional metadata>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

**Types**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

---

## Troubleshooting

### Common Issues

#### 1. "Could not resolve entry module"
**Problem**: TypeScript file referenced in `manifest.json`
**Solution**: CRXJS expects `.ts` extensions in manifest

#### 2. "pdf.worker.min.js not found"
**Problem**: Worker not copied to `public/`
**Solution**:
```bash
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.js
```

#### 3. "Extension failed to load"
**Problem**: Syntax error in built files
**Solution**: Check console, rebuild with `npm run build`

#### 4. "No tables found in PDF"
**Problem**: PDF is scanned image or complex layout
**Solution**: Adjust thresholds in `extractTable()` or wait for OCR

#### 5. OAuth errors
**Problem**: Google Cloud not configured
**Solution**: See "Google API Configuration" section above

#### 6. "The PDF file is empty" error (FIXED in v0.0.1)
**Problem**: ArrayBuffer loses data when passed via chrome.runtime.sendMessage in MV3
**Solution**: Convert to base64 string for transmission
**Location**: `src/popup/popup.ts`, `src/background/service-worker.ts`, `src/offscreen/offscreen.ts`

#### 7. "URL.createObjectURL is not a function" (FIXED in v0.0.1)
**Problem**: URL APIs not available in Service Workers (MV3)
**Solution**: Use data URLs with base64 encoding
**Location**: `src/background/service-worker.ts` (handleExportToExcel, handleExportToCsv)

---

## Manifest V3 Considerations

### Known Limitations & Solutions

**1. ArrayBuffer Serialization**
- Chrome doesn't properly serialize ArrayBuffer in structured clone
- **Solution**: Convert to base64 string before sending
- **Implementation**: All binary data transmitted as base64

**2. Service Worker Context**
- No access to DOM APIs (URL.createObjectURL, Blob URLs, etc.)
- **Solution**: Use data URLs or offscreen documents
- **Implementation**: File downloads use data URLs, PDF parsing in offscreen

**3. Message Passing**
- Large data can fail silently
- **Solution**: Base64 encoding + chunking if needed
- **Current limit**: ~100MB files work (tested with 83KB)

**4. Offscreen Documents**
- Required for DOM-dependent libraries (PDF.js, canvas)
- **Implementation**: Created on-demand, handles PDF.js worker

---

## TODO / Roadmap

### Immediate (Current Sprint) ✅ COMPLETED
- [x] Basic PDF parsing
- [x] Table extraction
- [x] Demo page with real parsing
- [x] Download CSV/Excel
- [x] Test with real PDF files (8 test PDFs generated)
- [x] Unit test suite (30 tests, 100% coverage)
- [x] Integration test suite (41 tests)
- [x] Docker support (dev, test, build)
- [x] Fix Manifest V3 ArrayBuffer serialization issues
- [x] Fix Manifest V3 Service Worker file download issues
- [x] Extension fully functional in Chrome (v0.0.1)

### Short-term (Next 2 weeks)
- [ ] Create extension icons (16x16, 48x48, 128x128)
- [ ] Configure Google Cloud OAuth
- [ ] Test Google Sheets export
- [ ] Improve error messages
- [ ] Add loading states

### Medium-term (Next month)
- [ ] Implement OCR for scanned PDFs (Tesseract.js)
- [ ] Add table selection tool (manual correction)
- [ ] Support multi-page tables
- [ ] Custom formatting options
- [ ] Settings page

### Long-term (Future)
- [ ] Batch processing (multiple PDFs)
- [ ] History of conversions
- [ ] Dark mode
- [ ] Export templates
- [ ] Chrome Web Store publication

---

## Important Notes for Claude Code

### When Starting a New Session

1. **Read this file first** (`CLAUDE.md`)
2. **Check `DEVELOPMENT_LOG.md`** for latest progress
3. **Review git status**: `git status` and `git log -5`
4. **Check todos**: Look at "TODO / Roadmap" above
5. **Ask user** what they want to work on

### Best Practices

1. **Always use TodoWrite** for tracking progress on complex tasks
2. **Update DEVELOPMENT_LOG.md** after significant changes
3. **Test changes**: `npm run build && node test-build.cjs`
4. **Commit frequently** with descriptive messages
5. **Keep types strict**: Validate `exportedData` is `string[][]`

### Code Style

- **TypeScript**: Use strict types
- **Async/await**: Prefer over promises
- **Error handling**: Always try/catch async functions
- **Comments**: Explain WHY, not WHAT
- **Naming**: Descriptive names (no `x`, `tmp`, `data1`)

### Files to NEVER Edit

- `node_modules/`
- `dist/` (auto-generated)
- `package-lock.json` (auto-generated)
- `.git/`

### Files to Always Update Together

- `manifest.json` + `vite.config.ts` (when adding new entry points)
- `package.json` + imports (when adding dependencies)
- `CLAUDE.md` + `DEVELOPMENT_LOG.md` (when major changes)

---

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
node test-build.cjs      # Verify build

# Git
git status              # Check changes
git log -5              # Recent commits
git diff                # See changes

# Chrome Extension
chrome://extensions     # Extension management
chrome://inspect        # Debug tools

# Node
npm install             # Install deps
npm outdated            # Check updates
npm list --depth=0      # List top-level deps
```

---

## Resources

- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/mv3/)
- [PDF.js API](https://mozilla.github.io/pdf.js/api/)
- [SheetJS Docs](https://docs.sheetjs.com/)
- [Vite Docs](https://vitejs.dev/)
- [CRXJS Plugin](https://crxjs.dev/vite-plugin/)

---

## Contact / Maintenance

**Project Owner**: @egorchepiga
**Repository**: https://github.com/egorchepiga/pdf-to-google-sheets
**Created**: 2025-12-12
**Last Updated**: 2025-12-12

---

**Remember**: This is a working prototype. The goal is to validate the concept before investing in production-ready features like OCR, advanced error handling, and Chrome Web Store publication.
