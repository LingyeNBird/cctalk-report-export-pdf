# pdf-export Specification

## Purpose
TBD - created by archiving change add-chrome-extension. Update Purpose after archive.
## Requirements
### Requirement: PDF Generation from Report JSON
The extension MUST be able to convert CCTALK homework report JSON data into a PDF document.

#### Scenario: Generate PDF from valid report data
Given valid report data with title, sections, and questions
When the PDF generation function is called
Then it should create a PDF document
And the document should start with the report title as a header
And each section should have its own title if present
And all questions should be included in the document

#### Scenario: PDF includes question numbering and content
Given a question with sequence "1" and content "总体国家安全观..."
When generating the PDF
Then the question should appear as "1. 总体国家安全观..."
And the text should use a font size of 11.5pt
And there should be 8pt margin before the question

---

### Requirement: Question Options Formatting
The extension MUST format question options with color-coding for correct answers.

#### Scenario: Options are listed with letter prefixes
Given a question with options:
  - Option A: "人民安全"
  - Option B: "防范化解国家安全风险"
  - Option C: "坚守维护国家利益准则"
  - Option D: "政治安全" (correct answer)
When generating the PDF
Then each option should be prefixed with its letter (A, B, C, D)
And options should have 12pt left indentation
And the correct option (D) should be colored green (#1B8A3B)
And incorrect options should use the default text color

#### Scenario: Multiple correct answers are all highlighted
Given a question with multiple correct answers (e.g., A and C)
When generating the PDF
Then both options A and C should be colored green
And incorrect options should use the default text color

#### Scenario: Options contain HTML formatting
Given an option with HTML like "<span style='font-size: 14px'>人民安全</span>"
When generating the PDF
Then the HTML tags should be stripped
And only the text "人民安全" should appear in the PDF

---

### Requirement: Analysis Box Formatting
The extension MUST format question analysis in a bordered box.

#### Scenario: Analysis appears in bordered box
Given a question with analysis: "解析：D。国务院新闻办公室于..."
When generating the PDF
Then the analysis should appear after the options
And the analysis should be enclosed in a box with 0.6pt gray border (#9AA0A6)
And the box should have 6pt padding
And the border should have 2pt corner radius

#### Scenario: Analysis text is properly converted
Given analysis in HTML format like "<p>解析：D。国务院新闻办公室...</p>"
When generating the PDF
Then the HTML tags should be stripped
And the text should preserve newlines
And the analysis should start with "解析：" if not already present

#### Scenario: Analysis box margin
Given an analysis box in the PDF
When calculating spacing
Then there should be 4pt margin before the analysis box
And there should be 8pt margin after the analysis box
And there should be 12pt left indentation for the text

---

### Requirement: Image Handling
The extension MUST handle images in question content and analysis.

#### Scenario: Images in question content are included
Given a question with an image tag: `<img src="https://example.com/image.png" alt="题目图片">`
When generating the PDF
Then the extension should download the image
And the image should be converted to a data URL
And the image should be embedded in the PDF at the appropriate location
And there should be 2pt margin after the image

#### Scenario: Images are scaled to fit page width
Given an image with width 800px
And the page content width is 400pt
When generating the PDF
Then the image should be scaled proportionally to fit the page width
And the aspect ratio should be preserved

#### Scenario: Image download fails gracefully
Given an image URL that cannot be downloaded
When the image download fails or times out
Then the extension should skip the image
And it should include a placeholder text "[图片: 题目图片]" in the PDF
And PDF generation should continue without errors

#### Scenario: Image URL includes query parameters
Given an image URL with query string like "https://example.com/image.jpg?width=800&height=600"
When extracting the file extension
Then the extension should correctly identify ".jpg" as the file type
And ignore query parameters when determining the extension

---

### Requirement: Material Questions (Questions with Sub-questions)
The extension MUST handle material questions that contain multiple sub-questions.

#### Scenario: Material stem is displayed once
Given a material question with stem "材料：根据以下材料回答1-3题"
And 3 sub-questions
When generating the PDF
Then the material stem should appear once before the sub-questions
And it should be prefixed with "材料："

#### Scenario: Sub-questions are numbered sequentially
Given a material question with sub-questions numbered 1, 2, 3
When generating the PDF
Then each sub-question should appear with its own sequence number
And the numbering should continue from the material (e.g., "1.1", "1.2", "1.3" or "1", "2", "3")

#### Scenario: Gap between questions
Given two consecutive questions in the same section
When generating the PDF
Then there should be a gap between them (approximately 32pt, or 2x question leading)

#### Scenario: Gap between sub-questions
Given two consecutive sub-questions in the same material
When generating the PDF
Then there should be a smaller gap between them compared to separate questions

---

### Requirement: Chinese Font Support
The extension MUST properly render Chinese characters in PDF.

#### Scenario: Chinese font is loaded
Given the PDF generation library is initialized
When loading fonts
Then the extension should load the Chinese font "仓耳华新体"
And the font should be downloaded from https://tsanger.cn/download/仓耳华新体.ttf
And the font should support Simplified Chinese characters
And the font should be set as the default font for the document

#### Scenario: Chinese text renders correctly
Given a PDF document containing Chinese text "人民安全是总体国家安全观坚持的宗旨"
When the PDF is generated
Then all Chinese characters should display correctly without garbling
Or without fallback to a system font that may not support Chinese

#### Scenario: Font file is included in extension
Given the extension package
When inspecting the bundle
Then the "仓耳华新体.ttf" font file should be included in the extension
Or a base64-encoded version of the font should be embedded
And the font should be accessible to the PDF generation library

---

### Requirement: PDF Download
The extension MUST trigger browser download of the generated PDF.

#### Scenario: PDF is downloaded automatically
Given PDF generation is complete
And the PDF is generated as a blob
When triggering the download
Then `chrome.downloads.download()` should be called with the PDF blob URL
And the filename should default to "paper_report.pdf"
And the download should not show a save dialog (saveAs: false)

#### Scenario: User can specify custom filename
Given the report data includes a title field with value "国家安全知识竞赛"
When triggering the download
Then the filename should use the sanitized title: "国家安全知识竞赛.pdf"
And invalid filename characters should be removed or replaced

#### Scenario: Object URL is cleaned up
Given the download has started
When the download callback is triggered
Then the object URL should be revoked after a short delay
To prevent memory leaks

---

### Requirement: HTML Text Processing
The extension MUST convert HTML content to plain text for PDF rendering.

#### Scenario: Paragraph tags are converted to newlines
Given HTML content: "<p>第一段</p><p>第二段</p>"
When converting to text
Then the result should be "第一段\n\n第二段"

#### Scenario: Line breaks are preserved
Given HTML content: "第一行<br>第二行"
When converting to text
Then the result should be "第一行\n第二行"

#### Scenario: HTML entities are decoded
Given HTML content: "&nbsp;特殊字符&nbsp;&lt;&gt;"
When converting to text
Then the result should be " 特殊字符 <>"

#### Scenario: Multiple spaces are collapsed
Given HTML content: "第一句     第二句"
When converting to text
Then the result should be "第一句 第二句"

#### Scenario: Multiple newlines are collapsed to two
Given HTML content: "第一句\n\n\n\n第二句"
When converting to text
Then the result should be "第一句\n\n第二句"

#### Scenario: Non-breaking spaces are converted to regular spaces
Given HTML content: "第一句\xa0\xa0第二句"
When converting to text
Then the result should be "第一句  第二句"

---

### Requirement: Performance and User Feedback
The extension MUST provide feedback during PDF generation and handle large reports.

#### Scenario: Loading indicator is shown during generation
Given the user clicks the export button
And PDF generation is in progress
Then the popup should show a loading indicator or message
And the export button should be disabled

#### Scenario: Success message is shown after generation
Given PDF generation completes successfully
When the download is triggered
Then the popup should show a success message
And the status should update to "PDF已下载"

#### Scenario: Large reports show progress (optional)
Given a report with 100+ questions
And PDF generation takes more than 2 seconds
Then the popup should show a progress indicator if possible
Or it should at least show "正在生成PDF (已处理X/100题)"

#### Scenario: Generation time is reasonable
Given a typical report with 50-100 questions
When measuring generation time
Then the PDF generation should complete within 10 seconds
To avoid user frustration

