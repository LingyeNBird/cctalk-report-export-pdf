# Implementation Tasks

## Task 1: Create Chrome Extension Structure
Create the basic directory structure and manifest file for the Chrome extension.

**Acceptance Criteria:**
- `chrome-plugin/` directory exists with all subdirectories
- `chrome-plugin/manifest.json` is valid JSON with Manifest V3 format
- Extension can be loaded in Chrome via `chrome://extensions/` in developer mode
- Extension icon displays in the browser toolbar

**Files to Create:**
- `chrome-plugin/manifest.json`
- `chrome-plugin/icons/icon16.png` (placeholder 16x16 icon)
- `chrome-plugin/icons/icon48.png` (placeholder 48x48 icon)
- `chrome-plugin/icons/icon128.png` (placeholder 128x128 icon)

**Validation:** Load extension in Chrome, verify no errors

---

## Task 2: Implement Content Script Data Interception
Implement XHR interception and page data extraction in the content script.

**Acceptance Criteria:**
- Content script injects into CCTALK pages
- XHR requests to `paper_report?timestamp=xxx` are intercepted
- JSON response is cached in `window.cctalkReportData`
- Fallback extraction from page data works if XHR interception fails
- Message listener responds to `{ action: 'getReportData' }`

**Files to Modify/Create:**
- `chrome-plugin/content/content.js` (new file)

**Dependencies:** Task 1

**Validation:**
- Manually test on a CCTALK homework report page
- Open console and verify `window.cctalkReportData` contains data
- Test fallback extraction by disabling XHR interception

---

## Task 3: Implement Popup UI
Create the popup interface with export button and status display.

**Acceptance Criteria:**
- Popup displays when extension icon is clicked
- Export button is labeled "导出解析"
- Status message shows current state (准备就绪, 未找到作业数据, 正在生成PDF...)
- Button is disabled when no data is available
- Button sends `{ action: 'generatePDF', data: ... }` message on click

**Files to Create:**
- `chrome-plugin/popup/popup.html`
- `chrome-plugin/popup/popup.js`
- `chrome-plugin/popup/popup.css`

**Dependencies:** Task 1, Task 2

**Validation:**
- Click extension icon, verify popup appears
- Navigate to CCTALK page, verify button is enabled
- Navigate to non-CCTALK page, verify button is disabled

---

## Task 4: Set Up PDF Generation Library
Integrate pdfmake library and Chinese font into the extension.

**Acceptance Criteria:**
- `pdfmake.min.js` is included in the extension bundle
- Chinese font "仓耳华新体" is downloaded from https://tsanger.cn/download/仓耳华新体.ttf
- Chinese font is available to pdfmake
- pdfmake can generate a simple test PDF with Chinese text
- PDF generation does not exceed reasonable memory limits

**Files to Create:**
- `chrome-plugin/lib/pdfmake/pdfmake.min.js` (download from CDN)
- `chrome-plugin/lib/pdfmake/vfs_fonts.js` (or generate from font)
- `chrome-plugin/lib/pdfmake/fonts/仓耳华新体.ttf` (or base64)

**Dependencies:** Task 1

**Validation:**
- Download font from https://tsanger.cn/download/仓耳华新体.ttf
- Create test script that generates a PDF with Chinese characters
- Verify Chinese characters render correctly with 仓耳华新体 font
- Check bundle size is acceptable (< 15MB)

---

## Task 5: Implement HTML to Text Conversion
Port the Python HTML parsing logic to JavaScript.

**Acceptance Criteria:**
- `htmlToText()` function converts HTML to plain text
- Handles `<p>`, `<br>`, `<div>`, `<li>` tags
- Handles `<img>` tags with `[图片: label]` placeholder
- Strips HTML entities and converts to Unicode
- Collapses multiple spaces and newlines

**Files to Create:**
- `chrome-plugin/pdf-generator/utils.js`

**Dependencies:** Task 1

**Validation:**
- Write unit tests for `htmlToText()` function
- Test with various HTML inputs from sample report data

---

## Task 6: Implement Image Download and Embedding
Implement image downloading and conversion to data URLs for PDF embedding.

**Acceptance Criteria:**
- `downloadImageAsDataURL()` function fetches images from URLs
- Converts images to base64 data URLs
- Handles timeouts and network errors gracefully
- Returns placeholder if download fails

**Files to Modify:**
- `chrome-plugin/pdf-generator/utils.js`

**Dependencies:** Task 1

**Validation:**
- Test downloading various image formats (jpg, png, gif)
- Test with invalid URLs and timeout scenarios
- Verify no memory leaks from object URLs

---

## Task 7: Implement PDF Document Builder
Port the Python `build_pdf()` logic to JavaScript using pdfmake.

**Acceptance Criteria:**
- `buildDocDefinition()` creates valid pdfmake document definition
- Includes title, sections, and questions
- Handles material questions with sub-questions
- Applies correct styling (fonts, margins, colors)
- Correct answers are colored green (#1B8A3B)
- Analysis boxes have gray borders

**Files to Create:**
- `chrome-plugin/pdf-generator/generate.js`

**Dependencies:** Task 4, Task 5, Task 6

**Validation:**
- Generate PDF from sample `paper_report.json`
- Compare output visually with Python-generated PDF
- Verify all questions, options, and analysis are present

---

## Task 8: Implement PDF Download Trigger
Implement the final PDF download using Chrome downloads API.

**Acceptance Criteria:**
- `downloadPDF()` function triggers browser download
- Filename defaults to "paper_report.pdf" or uses sanitized title
- Save dialog is not shown (direct download)
- Object URLs are cleaned up after download

**Files to Modify:**
- `chrome-plugin/pdf-generator/generate.js`
- `chrome-plugin/content/content.js` (add message handler)

**Dependencies:** Task 7

**Validation:**
- Click export button on popup
- Verify PDF downloads automatically
- Check filename is correct
- Verify object URLs are revoked

---

## Task 9: Add Loading and Error States
Enhance popup UI with loading indicators and error messages.

**Acceptance Criteria:**
- Popup shows loading state during PDF generation
- Error messages are displayed for:
  - No data found
  - Invalid JSON
  - Download failure
  - Network timeout
- Retry button appears on error (if applicable)

**Files to Modify:**
- `chrome-plugin/popup/popup.js`
- `chrome-plugin/popup/popup.css`

**Dependencies:** Task 3, Task 8

**Validation:**
- Trigger various error scenarios
- Verify appropriate error messages appear
- Verify retry functionality works

---

## Task 10: Comprehensive Testing
Perform end-to-end testing and fix any issues.

**Acceptance Criteria:**
- Extension works on real CCTALK homework report pages
- PDF styling matches Python-generated PDF
- All requirements from spec are satisfied
- No console errors during normal operation
- Extension loads and unloads cleanly

**Files to Modify:**
- Any files requiring fixes

**Dependencies:** All previous tasks

**Validation:**
- Manual testing on 5+ different report types (different question counts, with/without images, material questions)
- Performance testing with large reports (100+ questions)
- Cross-browser testing (Chrome, Edge)
- Check for memory leaks with repeated exports

---

## Task 11: Documentation
Create user documentation and installation instructions.

**Acceptance Criteria:**
- README.md explains extension purpose and features
- Installation instructions are clear for non-technical users
- Screenshots demonstrate the workflow
- Troubleshooting section covers common issues

**Files to Create:**
- `chrome-plugin/README.md`
- `chrome-plugin/screenshots/` (optional)

**Dependencies:** Task 10

**Validation:**
- Have a non-technical user follow instructions to install and use extension
- Verify they can successfully export a PDF

---

## Task 12: Code Review and Polish
Perform final code review, add comments, and polish UI.

**Acceptance Criteria:**
- Code follows project conventions
- All functions have comments explaining purpose
- No unused code or dependencies
- Popup UI is polished and professional
- Extension icon is high-quality

**Files to Modify:**
- All source files

**Dependencies:** Task 11

**Validation:**
- Peer review or self-review checklist
- Linting (if applicable)
- Bundle size optimization

---

## Parallelizable Work
The following tasks can be done in parallel:
- Task 2, Task 3, Task 4 (all depend only on Task 1)
- Task 5, Task 6 (depend only on Task 1)
- Task 12 can be done incrementally alongside other tasks

## Estimated Timeline
- Quick path (experienced developer): 4-6 hours
- Typical path: 8-12 hours
- Including testing and documentation: 12-16 hours

## Blocked By External Factors
- None (no external API calls required)
- Chinese font availability (can use open-source font)
- CCTALK website structure (may need adjustments if site changes)
