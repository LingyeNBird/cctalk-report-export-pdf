# CCTALK题目报告 PDF 生成器

本程序用于将 CCTALK的作业解析转换为包含题干、选项、正确答案颜色标注和解析的 PDF。

本项目提供了python脚本和chrome浏览器插件两种形式

## chrome插件使用步骤

1. clone本项目或者从release下载：
```
git clone https://github.com/LingyeNBird/cctalk-report-export-pdf.git
```
或者下载release中的chrome-plugin.zip并解压

2. 导入chrome

进入chrome扩展程序页面：
```
chrome://extensions/
```

打开开发者模式，点击“加载未打包的扩展程序”
![img03](readme_img/img03.png)

选择chrome-plugin文件夹

3. 使用

进入cctalk的作业详情页面，点击插件图标，点击导出解析pdf即可
![img04](readme_img/img04.png)


## python脚本使用步骤

### 1. 打开 cctalk 的“作业-查看报告”页面。
### 2. 按照下图在开发者工具中找到 `paper_report?_timestamp=xxx` 的请求。

![img01](readme_img/img01.png)
### 3. 点击该请求并在新标签页中打开。
### 4. 按照下图将内容另存为 `paper_report.json`，放到本项目目录。

![img02](readme_img/img02.png)
### 5. 安装依赖：

```bash
uv sync
```

### 6. 生成 PDF：

```bash
uv run python generate_pdf.py
```

输出文件为 `paper_report.pdf`。
