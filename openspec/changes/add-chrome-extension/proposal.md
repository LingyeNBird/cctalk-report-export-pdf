# Proposal: Add Chrome Extension for CCTALK Report Export

## Summary
Add a Chrome extension (`chrome-plugin/`) that allows users to export CCTALK homework reports directly from the browser. Users can click "导出解析" (Export Analysis) from the extension to automatically fetch the report JSON and download it as a PDF.

## Problem Statement
Currently, users must:
1. Manually find the `paper_report?_timestamp=xxx` request in DevTools
2. Open the request in a new tab
3. Save the JSON file manually
4. Run a Python script to generate the PDF

This multi-step process is error-prone and requires technical knowledge of browser developer tools.

## Goals
- Provide one-click export functionality within the CCTALK homework report page
- Eliminate the need for manual DevTools usage
- Generate PDF with same styling as the Python script (questions, options with color-coded correct answers, analysis)

## Out of Scope
- Editing or modifying homework data
- Exporting other types of CCTALK content (videos, courses, etc.)
- Customization of PDF styling (initially use existing Python script styling)
- Offline functionality

## Success Criteria
1. Extension installs without errors
2. "导出解析" button appears on CCTALK homework report pages
3. Clicking the button fetches the report JSON automatically
4. PDF is generated and downloaded automatically
5. PDF styling matches the Python script output (question numbering, green correct answers, analysis box)

## Alternatives Considered
1. **Native Messaging to Python script**: Reuse existing Python code, but requires native messaging setup and platform-specific code (Windows/Mac/Linux)
2. **Server-based PDF generation**: Move PDF generation to a web service, but introduces privacy concerns and requires a backend
3. **Browser print dialog**: Use `window.print()`, but gives user less control over output format

**Chosen Approach**: JavaScript PDF generation (jsPDF/pdfmake) keeps everything client-side and avoids platform complexity, at the cost of reimplementing PDF generation logic.

## Implementation Approach
1. Create Chrome extension manifest (V3) with:
   - Content script injected into `*.cctalk.com` domain
   - Page action or context menu for "导出解析"
   - Background service worker (if needed)

2. Content script:
   - Detect when user is on homework report page
   - Intercept the `paper_report?_timestamp=xxx` XHR response or extract from page data
   - Transform the JSON data
   - Generate PDF using JavaScript library
   - Trigger download

3. PDF Generation:
   - Use `pdfmake` library (better Chinese support than jsPDF)
   - Include 仓耳华新体 font from https://tsanger.cn/download/仓耳华新体.ttf
   - Replicate the Python script's styling:
     - Question headers (sequence + content)
     - Options with correct answers in green (#1B8A3B)
     - Analysis in bordered box

## Dependencies
- Chrome Extension Manifest V3
- `pdfmake` library for PDF generation
- Chinese font 仓耳华新体 (https://tsanger.cn/download/仓耳华新体.ttf)
- Access to CCTALK homework report page XHR requests

## Risks and Mitigations
| Risk | Mitigation |
|------|------------|
| XHR interception may be blocked by site policies | Use `fetch` or try to extract data from window/page if interception fails |
| PDF generation in browser may be slow for large reports | Show loading indicator during generation |
| Chinese font file size (~10MB) makes extension large | Use subset font or compress; font available from https://tsanger.cn/download/仓耳华新体.ttf |
| CCTALK may change API response format | Write robust parsing with fallbacks; document expected format |
| Browser compatibility | Test on Chrome/Edge (primary), consider Firefox/Brave if requested |
| Font license/copyright | Verify 仓耳华新体 font license allows distribution or load from official source |

## Open Questions
1. **Data extraction method**: Should we intercept XHR requests or extract from the already-loaded page data?
   - *Recommendation*: Try XHR interception first (more reliable), fallback to page extraction
2. **Font distribution**: Should 仓耳华新体 font be bundled or loaded from official source?
   - *Recommendation*: Bundle font for privacy and reliability; alternative is to download from https://tsanger.cn/download/仓耳华新体.ttf dynamically
3. **User feedback**: Should we show progress during PDF generation?
   - *Recommendation*: Yes, show loading indicator and success/error messages

## Related Changes
None - this is a new capability

## Impact Assessment
- **Code Impact**: New `chrome-plugin/` directory with ~500-800 lines of code
- **User Impact**: Simplifies export from 4 steps to 1 click
- **Maintenance Impact**: Need to maintain JavaScript version of PDF generation alongside Python script
- **Performance Impact**: Minimal - only runs when user clicks export
