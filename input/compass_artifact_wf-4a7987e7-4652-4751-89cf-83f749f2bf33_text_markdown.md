# Технический отчёт: создание PDF-to-Sheet браузерного расширения

Браузерные расширения обладают полным набором возможностей для создания инструмента конвертации PDF в таблицы с загрузкой в Google Drive. Manifest V3 стал обязательным стандартом с июня 2024 года, предлагая событийную архитектуру на основе Service Workers и улучшенную безопасность. Ключевые технологии для реализации — **PDF.js** для парсинга документов, **SheetJS** для генерации Excel, и **chrome.identity API** для OAuth-аутентификации с Google. Расширение может читать содержимое страниц через Content Scripts, анализировать PDF-файлы с извлечением таблиц, генерировать XLSX/CSV и загружать результаты напрямую в Google Drive или Google Sheets.

---

## Архитектура браузерных расширений в 2024-2025

### Типы компонентов и их назначение

Современное расширение состоит из нескольких изолированных компонентов, каждый из которых имеет доступ к определённому набору API.

**Service Worker (background script)** — центральный компонент в Manifest V3, заменивший background pages. Выполняется событийно: запускается при получении события и завершается через **30 секунд** бездействия. Не имеет доступа к DOM, но координирует работу всего расширения.

```json
{
  "manifest_version": 3,
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
}
```

**Content Scripts** выполняются в контексте веб-страниц с полным доступом к DOM, но в изолированном JavaScript-окружении. Это означает, что переменные страницы недоступны скрипту и наоборот. Инъекция возможна статически через манифест или программно через `chrome.scripting.executeScript()`.

**Popup** — HTML-страница, появляющаяся при клике на иконку расширения. Popup закрывается при потере фокуса, поэтому долгие операции следует делегировать Service Worker.

### Жизненный цикл Service Worker в MV3

Service Worker не сохраняет состояние между активациями — **глобальные переменные теряются**. Для персистентности необходимо использовать `chrome.storage`:

```javascript
// НЕПРАВИЛЬНО: данные потеряются
let cachedData = {};

// ПРАВИЛЬНО: использование storage.session
const cache = {};
chrome.storage.session.get().then(items => Object.assign(cache, items));

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  cache.lastRequest = msg;
  chrome.storage.session.set(cache);
  respond({ status: 'ok' });
  return true;
});
```

Максимальное время обработки одного события — **5 минут**. Для периодических задач используется `chrome.alarms` с минимальным интервалом 30 секунд.

---

## Система разрешений и permissions

### Типы разрешений в manifest.json

Разрешения делятся на **обязательные** (запрашиваются при установке) и **опциональные** (запрашиваются во время работы). Для PDF-to-Sheet расширения требуется:

```json
{
  "permissions": [
    "storage",       // chrome.storage API
    "identity",      // OAuth для Google APIs  
    "downloads",     // chrome.downloads API
    "scripting",     // программная инъекция скриптов
    "activeTab"      // доступ к активной вкладке
  ],
  "optional_permissions": [
    "tabs"           // полный доступ к URL всех вкладок
  ],
  "host_permissions": [
    "https://www.googleapis.com/*",
    "https://sheets.googleapis.com/*"
  ]
}
```

**ActiveTab vs Tabs** — критическое различие. `activeTab` не показывает предупреждений при установке и даёт временный доступ только к текущей вкладке при взаимодействии пользователя. `tabs` показывает предупреждение о доступе ко всем вкладкам, но позволяет получить URL любой вкладки через `chrome.tabs.query()`.

### OAuth2 для Google API

Конфигурация OAuth в манифесте для доступа к Drive и Sheets:

```json
{
  "oauth2": {
    "client_id": "YOUR_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/spreadsheets"
    ]
  },
  "key": "YOUR_EXTENSION_PUBLIC_KEY"
}
```

Scope `drive.file` даёт доступ только к файлам, созданным приложением — это **рекомендуемый минимум**, не требующий верификации в Google. Полный scope `drive` требует прохождения Google Security Assessment.

---

## Интеграция с Google Drive и Sheets API

### Да, расширение может изменять файлы на Google Drive

Браузерное расширение имеет полный доступ к Google Drive через REST API v3 после OAuth-авторизации пользователя. Поддерживаются все операции: создание, чтение, изменение, удаление файлов и управление правами доступа.

**Получение токена авторизации:**

```javascript
async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, token => {
      chrome.runtime.lastError 
        ? reject(chrome.runtime.lastError) 
        : resolve(token);
    });
  });
}
```

**Создание Google Sheets с данными:**

```javascript
async function createSpreadsheet(token, title, data) {
  // Создание таблицы
  const createResponse = await fetch(
    'https://sheets.googleapis.com/v4/spreadsheets',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties: { title } })
    }
  );
  const { spreadsheetId } = await createResponse.json();

  // Запись данных (data — двумерный массив)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values: data })
    }
  );

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}
```

**Загрузка файла в Google Drive (multipart upload):**

```javascript
async function uploadFile(token, content, filename, mimeType) {
  const metadata = { name: filename, mimeType };
  const boundary = '-------boundary314159';
  
  const body = 
    `--${boundary}\r\n` +
    `Content-Type: application/json\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;

  const blobParts = [body, content, `\r\n--${boundary}--`];
  
  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: new Blob(blobParts)
    }
  );
  return response.json();
}
```

### Квоты и rate limits

- **Sheets API**: 300 запросов/мин на чтение, 60 запросов/мин на запись
- **Drive API**: 1,000,000 запросов/день, 1,000 запросов/100 сек на пользователя

При превышении лимитов API возвращает статус **429**. Рекомендуется реализовать exponential backoff с начальной задержкой 1 секунда.

---

## Content Scripts: чтение и обработка веб-страниц

### Да, расширение может читать содержимое любой страницы

Content Scripts имеют полный доступ к DOM загруженной страницы. Они могут читать текст, извлекать таблицы, модифицировать элементы и отслеживать изменения.

**Извлечение таблиц со страницы:**

```javascript
function extractTableData(selector) {
  const table = document.querySelector(selector);
  if (!table) return null;
  
  return Array.from(table.querySelectorAll('tr')).map(row =>
    Array.from(row.querySelectorAll('td, th'))
      .map(cell => cell.textContent.trim())
  );
}
```

**Отслеживание динамического контента (SPA):**

```javascript
function waitForElement(selector) {
  return new Promise(resolve => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    const observer = new MutationObserver((_, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}
```

### Генерация PDF из содержимого страницы

**Да, расширение может создать PDF из страницы и загрузить в Google Drive.** Для этого используется комбинация **html2canvas** (рендеринг HTML в canvas) и **jsPDF** (генерация PDF).

```javascript
async function pageToGoogleDrive(token) {
  // 1. Рендерим страницу в canvas
  const canvas = await html2canvas(document.body, {
    scale: 2,           // высокое разрешение
    useCORS: true,      // загрузка cross-origin изображений
    backgroundColor: '#ffffff'
  });

  // 2. Создаём PDF
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const ratio = pdfWidth / canvas.width;
  
  pdf.addImage(imgData, 'JPEG', 0, 0, 
    canvas.width * ratio, canvas.height * ratio);

  // 3. Загружаем в Drive
  const pdfBlob = pdf.output('blob');
  return uploadFile(token, pdfBlob, 'page.pdf', 'application/pdf');
}
```

**Ограничения html2canvas:**
- Не все CSS свойства поддерживаются (сложные фильтры, анимации)
- Cross-origin изображения требуют CORS или предварительной конвертации в base64
- Максимальный размер canvas: **32,767×32,767 px** в Chrome

---

## Обработка PDF файлов

### Да, расширение может анализировать загруженные PDF

Библиотека **PDF.js** от Mozilla (версия 5.4.449 на декабрь 2024) позволяет полноценно парсить PDF в браузере без серверной обработки.

**Установка и конфигурация:**

```javascript
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = 
  chrome.runtime.getURL('pdf.worker.min.js');
```

В manifest.json необходимо добавить worker в `web_accessible_resources`:

```json
{
  "web_accessible_resources": [{
    "resources": ["pdf.worker.min.js"],
    "matches": ["<all_urls>"]
  }]
}
```

**Загрузка PDF из файла (drag-drop или input):**

```javascript
async function loadPdfFromFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  return pdfjsLib.getDocument({ 
    data: new Uint8Array(arrayBuffer) 
  }).promise;
}
```

**Извлечение текста с координатами:**

```javascript
async function extractTextWithCoords(pdf, pageNum) {
  const page = await pdf.getPage(pageNum);
  const textContent = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });

  return textContent.items.map(item => ({
    text: item.str,
    x: item.transform[4],
    y: viewport.height - item.transform[5],
    width: item.width,
    height: item.transform[0]
  }));
}
```

### Извлечение таблиц из PDF

PDF не хранит структуру таблиц — необходимо реконструировать их по координатам текстовых элементов:

```javascript
class TableExtractor {
  constructor(items, rowThreshold = 5, colThreshold = 10) {
    this.items = items;
    this.rowThreshold = rowThreshold;
    this.colThreshold = colThreshold;
  }

  extract() {
    // Группировка по строкам (по Y-координате)
    const rows = this.groupByRows();
    // Определение колонок по X-координатам
    const columns = this.detectColumns(rows);
    // Размещение текста в ячейках
    return this.buildTable(rows, columns);
  }

  groupByRows() {
    const sorted = [...this.items].sort((a, b) => a.y - b.y);
    const rows = [];
    let currentRow = [];
    let lastY = null;

    for (const item of sorted) {
      if (lastY !== null && Math.abs(item.y - lastY) > this.rowThreshold) {
        rows.push(currentRow.sort((a, b) => a.x - b.x));
        currentRow = [];
      }
      currentRow.push(item);
      lastY = item.y;
    }
    if (currentRow.length) rows.push(currentRow);
    return rows;
  }

  detectColumns(rows) {
    const xPositions = rows.flat().map(i => i.x).sort((a, b) => a - b);
    return xPositions.reduce((cols, x) => {
      if (!cols.length || x - cols[cols.length - 1] > this.colThreshold) {
        cols.push(x);
      }
      return cols;
    }, []);
  }

  buildTable(rows, columns) {
    return rows.map(row => {
      const tableRow = new Array(columns.length).fill('');
      for (const item of row) {
        const colIdx = columns.findIndex((c, i) => 
          i === columns.length - 1 || 
          Math.abs(item.x - c) <= Math.abs(item.x - columns[i + 1])
        );
        tableRow[colIdx] += (tableRow[colIdx] ? ' ' : '') + item.text;
      }
      return tableRow;
    });
  }
}
```

### OCR для отсканированных PDF

Когда `getTextContent()` возвращает пустой результат — PDF содержит изображения. Используйте **Tesseract.js** (v6.0.0, WebAssembly):

```javascript
import Tesseract from 'tesseract.js';

async function ocrPdfPage(pdf, pageNum) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2.0 });
  
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  await page.render({
    canvasContext: canvas.getContext('2d'),
    viewport
  }).promise;

  const worker = await Tesseract.createWorker();
  await worker.loadLanguage('rus+eng');
  await worker.initialize('rus+eng');
  
  const { data } = await worker.recognize(canvas);
  await worker.terminate();
  
  return data.text;
}
```

Производительность OCR: **2-10 секунд** на страницу, первая инициализация загружает ~15MB языковых данных.

---

## Генерация Excel и CSV файлов

### SheetJS (xlsx) — рекомендуемая библиотека

**Размер**: ~500KB (полная версия), ~200KB (mini). Поддерживает XLSX, CSV, XLS, ODS.

```javascript
import * as XLSX from 'xlsx';

function createExcelFromData(tableData, filename) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(tableData);

  // Автоматическая ширина колонок
  const maxWidths = tableData[0].map((_, colIdx) =>
    Math.max(...tableData.map(row => 
      String(row[colIdx] || '').length
    ))
  );
  ws['!cols'] = maxWidths.map(w => ({ wch: Math.min(w + 2, 50) }));

  XLSX.utils.book_append_sheet(wb, ws, 'Данные');
  
  // Экспорт в Blob
  const wbout = XLSX.write(wb, { 
    bookType: 'xlsx', 
    type: 'array',
    compression: true 
  });
  
  return new Blob([wbout], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
}
```

**Стилизация ячеек** требует форка **xlsx-js-style**:

```javascript
import XLSX from 'xlsx-js-style';

const ws = XLSX.utils.aoa_to_sheet(data);
ws['A1'].s = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '4472C4' } },
  alignment: { horizontal: 'center' }
};
```

### CSV с поддержкой кириллицы

```javascript
function generateCSV(data) {
  const BOM = '\uFEFF'; // для корректного отображения в Excel
  
  const escapeValue = (val) => {
    const str = String(val ?? '');
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const rows = data.map(row => row.map(escapeValue).join(','));
  return BOM + rows.join('\n');
}
```

---

## Предлагаемая архитектура расширения

### Компоненты и их взаимодействие

```
┌─────────────────────────────────────────────────────────────┐
│                       POPUP UI                              │
│  - Drag-drop зона для PDF                                   │
│  - Прогресс обработки                                       │
│  - Выбор формата (Sheets/Excel/CSV)                         │
│  - Кнопка авторизации Google                                │
└──────────────────────┬──────────────────────────────────────┘
                       │ chrome.runtime.sendMessage
                       ▼
┌─────────────────────────────────────────────────────────────┐
│               SERVICE WORKER (background.js)                │
│  - Координация процесса                                     │
│  - OAuth через chrome.identity                              │
│  - Загрузка в Google Drive/Sheets                           │
│  - Управление состоянием через chrome.storage               │
└──────────────────────┬──────────────────────────────────────┘
                       │ 
                       ▼
┌─────────────────────────────────────────────────────────────┐
│            OFFSCREEN DOCUMENT (offscreen.html)              │
│  - PDF.js парсинг (требует DOM)                             │
│  - Tesseract.js OCR                                         │
│  - SheetJS генерация Excel                                  │
└─────────────────────────────────────────────────────────────┘
```

### Offscreen API для PDF обработки

Service Worker не имеет доступа к DOM, но PDF.js и canvas-операции его требуют. Решение — **Offscreen Document** (MV3):

```javascript
// background.js
async function processPdfInOffscreen(pdfData) {
  // Создаём offscreen document если не существует
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  
  if (!contexts.length) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['DOM_PARSER', 'WORKERS'],
      justification: 'PDF parsing requires DOM access'
    });
  }

  // Отправляем PDF на обработку
  return chrome.runtime.sendMessage({
    target: 'offscreen',
    action: 'parsePdf',
    data: pdfData
  });
}
```

```json
// manifest.json
{
  "permissions": ["offscreen"]
}
```

### Workflow обработки

1. **Drag-drop PDF** → Popup читает файл как ArrayBuffer
2. **Передача в Service Worker** → через `chrome.runtime.sendMessage`
3. **PDF парсинг в Offscreen** → PDF.js извлекает текст и таблицы
4. **OCR при необходимости** → Tesseract.js для сканов
5. **Генерация Excel/CSV** → SheetJS в Offscreen
6. **Загрузка в облако** → Service Worker использует Drive/Sheets API
7. **Уведомление пользователя** → ссылка на созданный файл

---

## Функционал PDF-to-Sheet расширения

### Базовый функционал (must-have)

- Загрузка PDF через drag-drop или file picker
- Автоматическое определение таблиц на страницах
- Конвертация в Google Sheets с форматированием заголовков
- Экспорт в локальный XLSX/CSV файл
- Прогресс-индикатор с отменой операции
- История последних конвертаций

### Расширенный функционал (nice-to-have)

- OCR для отсканированных документов
- Ручной выбор области таблицы на preview
- Пакетная обработка нескольких PDF
- Настройка разделителя колонок (порог группировки)
- Шаблоны форматирования для разных типов документов
- Автоматическое определение типов данных (даты, числа, валюта)

### UX улучшения

- Preview извлечённых данных перед экспортом
- Редактирование ячеек перед сохранением
- Keyboard shortcuts (Ctrl+V для вставки PDF из буфера)
- Dark mode popup
- Автосохранение в выбранную папку Google Drive

---

## Технический стек и инструменты

### Manifest V3 — обязательный стандарт

С июня 2024 Chrome **не принимает** расширения на MV2. Firefox поддерживает MV3 с версии 109, но сохраняет MV2. Edge полностью совместим с Chrome.

| Аспект | Manifest V2 | Manifest V3 |
|--------|-------------|-------------|
| Background | Persistent page | Service Worker |
| Remote code | Разрешён | Запрещён |
| Web Request | Blocking | declarativeNetRequest |
| API стиль | Callbacks | Promises |

### Рекомендуемые библиотеки

| Задача | Библиотека | Размер | Примечание |
|--------|-----------|--------|------------|
| PDF парсинг | pdfjs-dist 5.4 | ~500KB | Mozilla, стандарт |
| Таблицы из PDF | pdf-table-extractor | ~50KB | Автоопределение |
| OCR | tesseract.js 6.0 | ~15MB langs | WebAssembly |
| Excel генерация | xlsx 0.20 | ~500KB | SheetJS |
| Стили Excel | xlsx-js-style | ~550KB | Fork SheetJS |
| PDF генерация | jspdf 2.5 | ~300KB | Из canvas |
| Screenshot | html2canvas 1.4 | ~40KB | DOM → canvas |

### Build tools

**Vite** — рекомендуется для современной разработки:

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        popup: 'popup.html',
        offscreen: 'offscreen.html'
      }
    }
  }
});
```

**TypeScript** настоятельно рекомендуется — установите `@types/chrome` для типизации API.

---

## Пошаговые инструкции для реализации

### Структура проекта

```
pdf-to-sheet/
├── manifest.json
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.ts
│   │   └── popup.css
│   ├── offscreen/
│   │   ├── offscreen.html
│   │   └── offscreen.ts
│   ├── lib/
│   │   ├── pdf-processor.ts
│   │   ├── table-extractor.ts
│   │   ├── excel-generator.ts
│   │   └── google-api.ts
│   └── types/
│       └── index.d.ts
├── public/
│   └── pdf.worker.min.js
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### manifest.json (полная конфигурация)

```json
{
  "manifest_version": 3,
  "name": "PDF to Sheet Converter",
  "version": "1.0.0",
  "description": "Конвертация PDF таблиц в Google Sheets и Excel",
  
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icons/icon48.png"
  },
  
  "background": {
    "service_worker": "src/background/service-worker.js",
    "type": "module"
  },
  
  "permissions": [
    "storage",
    "identity",
    "downloads",
    "offscreen"
  ],
  
  "host_permissions": [
    "https://www.googleapis.com/*",
    "https://sheets.googleapis.com/*"
  ],
  
  "oauth2": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/spreadsheets"
    ]
  },
  
  "web_accessible_resources": [{
    "resources": ["pdf.worker.min.js"],
    "matches": ["<all_urls>"]
  }],
  
  "key": "YOUR_EXTENSION_PUBLIC_KEY"
}
```

### Настройка Google Cloud Console

1. Создайте проект на console.cloud.google.com
2. Включите **Google Drive API** и **Google Sheets API**
3. Создайте **OAuth Client ID** типа "Chrome Extension"
4. Укажите **Extension ID** (получите из `chrome://extensions` в developer mode)
5. Скопируйте Client ID в manifest.json

### Основной класс PDF процессора

```typescript
// src/lib/pdf-processor.ts
import * as pdfjsLib from 'pdfjs-dist';
import { TableExtractor } from './table-extractor';

export class PDFProcessor {
  private pdf: pdfjsLib.PDFDocumentProxy | null = null;

  async init() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
      chrome.runtime.getURL('pdf.worker.min.js');
  }

  async load(data: ArrayBuffer): Promise<number> {
    this.pdf = await pdfjsLib.getDocument({ 
      data: new Uint8Array(data) 
    }).promise;
    return this.pdf.numPages;
  }

  async extractTables(pageNum: number): Promise<string[][]> {
    if (!this.pdf) throw new Error('PDF not loaded');
    
    const page = await this.pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });

    const items = textContent.items.map((item: any) => ({
      text: item.str,
      x: item.transform[4],
      y: viewport.height - item.transform[5],
      width: item.width,
      height: item.transform[0]
    }));

    const extractor = new TableExtractor(items);
    return extractor.extract();
  }

  async processAllPages(
    onProgress?: (current: number, total: number) => void
  ): Promise<string[][][]> {
    if (!this.pdf) throw new Error('PDF not loaded');
    
    const tables: string[][][] = [];
    for (let i = 1; i <= this.pdf.numPages; i++) {
      tables.push(await this.extractTables(i));
      onProgress?.(i, this.pdf.numPages);
    }
    return tables;
  }
}
```

### Service Worker с Google API

```typescript
// src/background/service-worker.ts
import { GoogleAPI } from '../lib/google-api';

const api = new GoogleAPI();

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg.action === 'createSheet') {
    handleCreateSheet(msg.data).then(respond);
    return true; // async response
  }
});

async function handleCreateSheet(data: {
  title: string;
  tables: string[][][];
}) {
  const token = await api.getAuthToken();
  const url = await api.createSpreadsheetWithData(
    token, 
    data.title, 
    data.tables.flat()
  );
  return { success: true, url };
}
```

### Тестирование и отладка

1. Загрузите расширение: `chrome://extensions` → Developer mode → Load unpacked
2. Service Worker логи: клик на "Service worker" в карточке расширения
3. Popup DevTools: правый клик на popup → Inspect
4. Offscreen DevTools: `chrome://extensions` → Background page (при активном offscreen)

### Публикация в Chrome Web Store

1. Создайте ZIP-архив директории сборки
2. Зарегистрируйтесь как разработчик ($5 единоразово)
3. Загрузите на https://chrome.google.com/webstore/devconsole
4. Заполните Store listing (описание, скриншоты, политика конфиденциальности)
5. Пройдите review (1-3 дня для обычных расширений)

**Важно**: для scopes `drive` или `spreadsheets` потребуется верификация приложения Google. Scope `drive.file` этого не требует.

---

## Заключение

Браузерные расширения в 2024-2025 году предоставляют полноценный инструментарий для создания PDF-to-Sheet конвертера. Ключевые выводы:

- **PDF.js** надёжно парсит документы, но таблицы требуют эвристической реконструкции по координатам
- **Tesseract.js** решает проблему сканированных PDF, но добавляет **2-10 секунд** на страницу
- **SheetJS** — оптимальный баланс размера и функциональности для Excel генерации
- **Offscreen API** необходим для DOM-операций в MV3 (PDF.js, canvas)
- **drive.file scope** достаточен для работы и не требует Google Security Assessment

Рекомендуемый MVP включает drag-drop загрузку, автоматическое извлечение таблиц, preview данных и экспорт в Google Sheets одним кликом. Расширение OCR и пакетную обработку стоит добавить итеративно после валидации базового функционала.