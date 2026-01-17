# Design: Chrome Extension for CCTALK Report Export

## Architecture Overview

```
chrome-plugin/
├── manifest.json              # Extension manifest (V3)
├── background/               # Service worker (if needed)
│   └── service-worker.js     # Background script for event handling
├── content/
│   ├── content.js            # Injected into CCTALK pages
│   └── content.css           # Optional: styles for UI elements
├── popup/                    # Optional: popup UI (if using action button)
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── lib/                      # Third-party libraries
│   └── pdfmake/
│       ├── pdfmake.min.js
│       ├── vfs_fonts.js      # Virtual file system (includes fonts)
│       └── fonts/
│           └── 仓耳华新体.ttf # Chinese font
└── pdf-generator/            # PDF generation logic
    └── generate.js           # Main PDF generation (port of Python logic)
```

## Component Design

### 1. Manifest (`manifest.json`)

```json
{
  "manifest_version": 3,
  "name": "CCTALK作业导出",
  "version": "1.0.0",
  "description": "一键导出CCTALK作业解析为PDF",
  "permissions": ["activeTab", "downloads"],
  "host_permissions": ["https://*.cctalk.com/*"],
  "content_scripts": [
    {
      "matches": ["https://*.cctalk.com/*"],
      "js": ["content/content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

**Key Design Decisions:**
- **Manifest V3**: Current standard for Chrome extensions
- **activeTab permission**: Allows script injection on current tab
- **downloads permission**: Required for triggering file downloads
- **document_idle**: Run script after page fully loaded but before user interaction
- **Action button**: Simpler than context menu; shows popup with "导出解析" button

### 2. Content Script (`content/content.js`)

**Responsibilities:**
1. Detect if current page is a homework report page
2. Intercept `paper_report?_timestamp=xxx` XHR requests
3. Extract and cache the JSON response
4. Provide an API for the popup to trigger PDF generation

**Data Extraction Strategy:**

**Method 1: XHR Interception (Preferred)**
```javascript
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const [url] = args;
  if (url.includes('paper_report')) {
    return originalFetch.apply(this, args).then(response => {
      const clonedResponse = response.clone();
      clonedResponse.json().then(data => {
        window.cctalkReportData = data; // Cache for popup
      });
      return response;
    });
  }
  return originalFetch.apply(this, args);
};
```

**Method 2: Page Data Extraction (Fallback)**
```javascript
function extractFromPage() {
  // Try to find data in window object or embedded scripts
  if (window.__INITIAL_STATE__?.reportData) {
    return window.__INITIAL_STATE__.reportData;
  }
  // Alternative: find script tags with JSON data
  const scripts = document.querySelectorAll('script[type="application/json"]');
  // ... parse and return relevant data
  return null;
}
```

**API for Popup:**
```javascript
window.chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getReportData') {
    sendResponse({ data: window.cctalkReportData || extractFromPage() });
  } else if (request.action === 'generatePDF') {
    generatePDF(request.data).then(blob => {
      // Trigger download
    });
  }
});
```

### 3. Popup (`popup/popup.html` + `popup.js`)

**UI Design:**
```
┌─────────────────────────┐
│  CCTALK作业导出         │
├─────────────────────────┤
│  ┌───────────────────┐  │
│  │  导出解析 PDF      │  │
│  └───────────────────┘  │
│                          │
│  状态: 准备就绪          │
├─────────────────────────┘
```

**Event Flow:**
1. User clicks extension icon → Popup opens
2. Popup sends message to content script: `{ action: 'getReportData' }`
3. Content script returns cached data or extracts from page
4. If data exists, enable "导出解析" button; otherwise show "未找到作业数据"
5. User clicks button → Popup sends: `{ action: 'generatePDF', data: ... }`
6. Content script generates PDF and triggers download

### 4. PDF Generation (`pdf-generator/generate.js`)

**Library Choice: pdfmake**
- Better Chinese font support than jsPDF
- Declarative document definition (similar to ReportLab's flowables)
- Built-in image handling

**Font Setup:**
```javascript
pdfMake.vfs = {
  "仓耳华新体.ttf": base64FontData, // ~8-10MB base64
  // or load dynamically: pdfMake.fonts = { ... }
};

pdfMake.fonts = {
  Roboto: { normal: 'Roboto-Regular.ttf' },
  仓耳华新体: { normal: '仓耳华新体.ttf' }
};
```

**Document Definition (Mapped from Python Script):**

```javascript
function buildDocDefinition(data) {
  const docDefinition = {
    content: [
      { text: data.title || "题目与解析", style: 'docTitle' },
    ],
    styles: {
      docTitle: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
      sectionTitle: { fontSize: 14, bold: true, margin: [0, 12, 0, 6] },
      question: { fontSize: 11.5, margin: [0, 8, 0, 4] },
      option: { fontSize: 10.5, margin: [12, 1, 0, 1] },
      analysis: {
        fontSize: 10.5,
        margin: [12, 4, 0, 8],
        border: [0.6, '#9AA0A6'],
        borderRadius: 2
      }
    },
    defaultStyle: { font: '仓耳华新体' }
  };

  // Add sections and questions (port from Python logic)
  for (const section of data.sections || []) {
    if (section.title) {
      docDefinition.content.push({ text: section.title, style: 'sectionTitle' });
    }

    for (const question of section.questions || []) {
      addQuestion(docDefinition.content, question);
    }
  }

  return docDefinition;
}
```

**Key Differences from Python:**
- HTML parsing: Use `DOMParser` or simple regex for stripping HTML tags
- Image handling: Download as Data URLs to embed in PDF
- Color coding: Use `color: '#1B8A3B'` for correct answers
- Analysis box: Use `border` property instead of custom border drawing

### 5. HTML Text Processing

**Python → JavaScript Mapping:**

| Python Function | JavaScript Equivalent |
|-----------------|----------------------|
| `HTMLToText` class | `htmlToText()` function using `DOMParser` |
| `escape()` | `escapeHtml()` or use template literals |
| `re.sub()` | `String.replace()` with regex |
| `urllib.request` | `fetch()` API |

```javascript
// Example: Download font from official source
async function downloadCangerHuaxinFont() {
  const response = await fetch('https://tsanger.cn/download/仓耳华新体.ttf');
  const arrayBuffer = await response.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  return base64;
}

function htmlToText(html) {
  if (!html) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.body.textContent
    .replace(/\xa0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
```

### 6. Image Handling

**Download and Convert to Data URL:**
```javascript
async function downloadImageAsDataURL(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const blob = await response.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}
```

**Embed in PDF:**
```javascript
{
  image: imageDataUrl,
  width: 400,  // Scale if too wide
  margin: [0, 2, 0, 0]
}
```

### 7. Download Handling

**Trigger Browser Download:**
```javascript
function downloadPDF(pdfBlob, filename = 'paper_report.pdf') {
  const url = URL.createObjectURL(pdfBlob);
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: false  // Direct download, no save dialog
  }, (downloadId) => {
    // Clean up object URL after download starts
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
```

## Data Flow Diagram

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   CCTALK    │     │  Content     │     │    Popup     │
│    Page     │────▶│   Script     │◀────│   Action     │
└─────────────┘     └──────┬───────┘     └──────────────┘
                          │
                          │ Intercepts XHR
                          │ paper_report?timestamp=xxx
                          ▼
                   ┌──────────────┐
                   │  Extract     │
                   │  JSON Data   │
                   └──────┬───────┘
                          │
                          │ Cache data
                          ▼
                   ┌──────────────┐
                   │  PDF Make    │
                   │  Generate    │
                   └──────┬───────┘
                          │
                          │ pdfMake.createPdf()
                          ▼
                   ┌──────────────┐
                   │   Download   │
                   │  (blob)      │
                   └──────────────┘
```

## Error Handling

| Scenario | Detection | Recovery |
|----------|-----------|----------|
| XHR request not found | Timeout after 5s | Fallback to page extraction or show error |
| Invalid JSON data | `try-catch` during parsing | Show user-friendly error message |
| PDF generation fails | Exception in pdfmake | Log error, show message with support link |
| Download fails | chrome.downloads.onError | Show "重试" button in popup |
| Network timeout | fetch timeout > 30s | Retry once, then fail with message |

## Performance Considerations

1. **Font Loading**: Base64 font adds ~8-10MB to bundle size
   - Mitigation: Use font subset (only characters needed for typical reports)
   - Alternative: Load from CDN if CORS permits (仓耳华新体 available at https://tsanger.cn/download/仓耳华新体.ttf)

2. **Large Reports**: 100+ questions may cause browser slowdown
   - Mitigation: Show progress indicator, consider chunked generation
   - Alternative: Stream PDF if pdfmake supports (limited support)

3. **Memory Usage**: Images and PDF generation consume memory
   - Mitigation: Clean up object URLs, limit image resolution

## Security Considerations

1. **CORS**: XHR interception may trigger CORS issues
   - Mitigation: Content scripts run in page context, so same-origin requests work

2. **User Privacy**: Report data may contain personal info
   - Mitigation: No data sent to external servers; all processing local

3. **Content Script Injection**: Extension has access to page content
   - Mitigation: Minimal permissions (only activeTab), no cross-site scripting

## Testing Strategy

1. **Unit Tests** (Jest or similar):
   - `htmlToText()` - HTML to plain text conversion
   - `escapeHtml()` - HTML entity escaping
   - `parseQuestion()` - Question data parsing

2. **Integration Tests**:
   - Load sample `paper_report.json`
   - Generate PDF
   - Verify output structure (not pixel-perfect comparison)

3. **Manual Testing**:
   - Install extension on Chrome/Edge
   - Navigate to real CCTALK homework report
   - Click export button
   - Verify PDF download and styling

## Deployment

1. **Development**: Load unpacked extension in `chrome://extensions/`
2. **Distribution**:
   - Option A: Upload to Chrome Web Store ($5 fee)
   - Option B: Distribute ZIP file for sideloading
   - Option C: Host source on GitHub with installation instructions

## Future Enhancements (Out of Scope for Initial Release)

- Custom PDF styling (fonts, colors, layout)
- Batch export (multiple reports at once)
- Export to other formats (Word, Excel)
- Dark mode support in popup
- Keyboard shortcuts
- Support for CCTALK app (mobile not possible with Chrome Extension API)
