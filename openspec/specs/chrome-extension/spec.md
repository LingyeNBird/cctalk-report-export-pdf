# chrome-extension Specification

## Purpose
TBD - created by archiving change add-chrome-extension. Update Purpose after archive.
## Requirements
### Requirement: Chrome Extension Manifest Configuration
The extension MUST provide a valid Chrome Extension Manifest V3 configuration that enables content script injection into CCTALK domains.

#### Scenario: Extension installs successfully
Given the extension manifest file is valid
When a user installs the extension in Chrome/Edge
Then the extension should load without errors
And the extension should be visible in the extension list

#### Scenario: Content script is injected
Given the extension is installed
When a user navigates to a CCTALK domain (*.cctalk.com)
Then the content script should be injected into the page
And the content script should have access to the page DOM and window object

#### Scenario: Required permissions are declared
Given the extension manifest
When inspecting the permissions field
Then it should include "activeTab" permission for script injection
And it should include "downloads" permission for file downloads
And host_permissions should include "https://*.cctalk.com/*"

---

### Requirement: Data Interception and Extraction
The extension MUST be able to capture homework report data from CCTALK pages either through XHR interception or page data extraction.

#### Scenario: XHR interception captures paper_report request
Given the content script is running on a CCTALK homework report page
When the page makes a request to `paper_report?timestamp=xxx`
Then the content script should intercept the response
And the response body should be cached in `window.cctalkReportData`

#### Scenario: Fallback extraction from page
Given the content script could not intercept XHR requests
When the content script attempts to extract data from the page
Then it should search for data in `window.__INITIAL_STATE__`
Or it should search for JSON data in embedded `<script>` tags
And it should return the report data or null if not found

#### Scenario: Popup requests data from content script
Given the popup is open
When the popup sends a message `{ action: 'getReportData' }`
Then the content script should respond with the cached report data
Or it should respond with data extracted from the page
Or it should respond with null if no data is available

---

### Requirement: User Interface
The extension MUST provide a user interface for triggering the export action.

#### Scenario: Popup displays export button
Given a user clicks the extension icon
When the popup opens
Then it should display a button labeled "导出解析"
And it should display a status message showing the current state

#### Scenario: Button is disabled when no data is available
Given the content script has no report data available
When the popup receives the data status
Then the export button should be disabled
And the status message should indicate "未找到作业数据"

#### Scenario: Button is enabled when data is available
Given the content script has cached report data
When the popup receives the data status
Then the export button should be enabled
And the status message should indicate "准备就绪"

#### Scenario: Button click triggers export
Given the export button is enabled
When the user clicks the button
Then the popup should send a message `{ action: 'generatePDF', data: ... }` to the content script
And the button should be disabled during generation
And the status should show "正在生成PDF..."

---

### Requirement: Error Handling
The extension MUST handle errors gracefully and provide user feedback.

#### Scenario: XHR interception timeout
Given the content script is waiting for XHR interception
When no request is intercepted within 5 seconds
Then the script should attempt page data extraction as fallback
Or it should show an error message if extraction fails

#### Scenario: Invalid JSON data
Given the intercepted XHR response contains invalid JSON
When the script attempts to parse the JSON
Then it should catch the parsing error
And it should show an error message in the popup
And it should not attempt PDF generation

#### Scenario: Download fails
Given the PDF generation succeeded
When the `chrome.downloads.download()` call fails
Then the popup should show an error message
And it should offer a "重试" button to the user

#### Scenario: Network timeout during image download
Given the PDF generation is downloading an image from a URL
When the download times out after 30 seconds
Then the script should skip the image and continue generation
Or it should show a placeholder text "[图片: ...]" in the PDF

