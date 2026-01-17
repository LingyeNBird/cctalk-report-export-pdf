// PDF 生成工具函数

/**
 * 将 HTML 转换为纯文本
 * @param {string} html - HTML 字符串
 * @returns {string} 纯文本
 */
function htmlToText(html) {
  if (!html) return "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(
    html,
    "text/html",
  );

  // 递归遍历 DOM 树，提取文本并处理图片
  function extractText(node) {
    let result = "";

    if (node.nodeType === Node.TEXT_NODE) {
      result = node.textContent;
    } else if (
      node.nodeType === Node.ELEMENT_NODE
    ) {
      const tagName = node.tagName.toLowerCase();

      // 处理图片标签
      if (tagName === "img") {
        const alt =
          node.getAttribute("alt") || "";
        const src =
          node.getAttribute("src") || "";
        const label = alt || src;
        if (label) {
          result = `[图片: ${label}]`;
        }
      }
      // 处理块级元素（添加换行）
      else if (
        ["p", "div", "li", "br"].includes(tagName)
      ) {
        for (const child of node.childNodes) {
          result += extractText(child);
        }
        result += "\n";
      }
      // 处理其他元素
      else {
        for (const child of node.childNodes) {
          result += extractText(child);
        }
      }
    }

    return result;
  }

  let text = extractText(doc.body);

  // 清理空白字符
  text = text.replace(/\xa0/g, " ");
  text = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n[ \t]+/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

/**
 * HTML 转义
 * @param {string} text - 文本
 * @returns {string} 转义后的 HTML
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 规范化图片 URL
 * @param {string} url - 图片 URL
 * @returns {string} 规范化后的 URL
 */
function normalizeImageUrl(url) {
  if (!url) return "";
  return url.replace(/\s+/g, "");
}

/**
 * 下载图片并转换为 Data URL
 * @param {string} url - 图片 URL
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<string|null>} Data URL 或 null
 */
async function downloadImageAsDataURL(
  url,
  timeout = 30000,
) {
  console.log(
    "[CCTALK Export] downloadImageAsDataURL called with URL:",
    url,
  );

  if (!url || !url.startsWith("http")) {
    console.log(
      "[CCTALK Export] Invalid URL, returning null",
    );
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    timeout,
  );

  try {
    console.log(
      "[CCTALK Export] Fetching image from:",
      url,
    );
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    clearTimeout(timeoutId);

    console.log(
      "[CCTALK Export] Response status:",
      response.status,
    );

    if (!response.ok) {
      console.warn(
        "[CCTALK Export] Image download failed:",
        url,
        response.status,
      );
      return null;
    }

    const blob = await response.blob();
    console.log(
      "[CCTALK Export] Blob received, size:",
      blob.size,
      "type:",
      blob.type,
    );

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        console.log(
          "[CCTALK Export] Data URL created, length:",
          dataUrl ? dataUrl.length : 0,
        );
        resolve(dataUrl);
      };
      reader.onerror = () => {
        console.warn(
          "[CCTALK Export] Failed to convert image to data URL:",
          url,
        );
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn(
      "[CCTALK Export] Failed to download image:",
      url,
      error.message,
    );
    return null;
  }
}

/**
 * 处理包含图片的文本，返回文本和图片的混合数组
 * @param {string} text - 包含 [图片: ...] 占位符的文本
 * @param {number} maxWidth - PDF 最大宽度（pt）
 * @returns {Promise<Array>} 处理后的元素数组
 */
async function processTextWithImages(
  text,
  maxWidth = 400,
) {
  console.log(
    "[CCTALK Export] processTextWithImages called, text length:",
    text.length,
  );

  const elements = [];
  const pattern = /\[图片:\s*([^\]]*)\]/g;
  let lastIndex = 0;
  let match;
  let matchCount = 0;

  while ((match = pattern.exec(text)) !== null) {
    matchCount++;
    console.log(
      `[CCTALK Export] Found image match #${matchCount}:`,
      match[1].trim(),
    );

    // 添加图片前的文本
    const textBefore = text.substring(
      lastIndex,
      match.index,
    );
    if (textBefore) {
      elements.push({
        type: "text",
        value: textBefore,
      });
    }

    // 下载并添加图片
    const imageUrl = normalizeImageUrl(
      match[1].trim(),
    );
    console.log(
      "[CCTALK Export] Normalized image URL:",
      imageUrl,
    );

    const imageDataUrl =
      await downloadImageAsDataURL(imageUrl);

    if (imageDataUrl) {
      console.log(
        "[CCTALK Export] Image download successful, adding to elements",
      );
      elements.push({
        type: "image",
        value: imageDataUrl,
        url: imageUrl,
      });
    } else {
      console.log(
        "[CCTALK Export] Image download failed, adding placeholder",
      );
      // 下载失败，显示占位符文本
      elements.push({
        type: "text",
        value: `[图片: ${match[1].trim()}]`,
        style: { color: "#999999", fontSize: 9 },
      });
    }

    lastIndex = match.index + match[0].length;
  }

  // 添加剩余文本
  const remainingText = text.substring(lastIndex);
  if (remainingText) {
    elements.push({
      type: "text",
      value: remainingText,
    });
  }

  console.log(
    "[CCTALK Export] processTextWithImages completed, total elements:",
    elements.length,
    "images found:",
    matchCount,
  );
  return elements;
}

/**
 * 获取图片尺寸
 * @param {string} dataUrl - 图片的 Data URL
 * @returns {Promise<{width: number, height: number}>} 图片尺寸
 */
function getImageDimensions(dataUrl) {
  console.log(
    "[CCTALK Export] getImageDimensions called, dataUrl length:",
    dataUrl ? dataUrl.length : 0,
  );

  return new Promise((resolve) => {
    const img = new Image();
    const timeout = setTimeout(() => {
      console.warn(
        "[CCTALK Export] Image load timeout, using default dimensions",
      );
      resolve({ width: 400, height: 300 });
    }, 10000);

    img.onload = () => {
      clearTimeout(timeout);
      console.log(
        "[CCTALK Export] Image loaded successfully, dimensions:",
        img.width,
        "x",
        img.height,
      );
      resolve({
        width: img.width,
        height: img.height,
      });
    };

    img.onerror = (error) => {
      clearTimeout(timeout);
      console.warn(
        "[CCTALK Export] Failed to load image, error:",
        error,
      );
      resolve({ width: 400, height: 300 });
    };

    img.src = dataUrl;
    console.log(
      "[CCTALK Export] Image src set, waiting for load...",
    );
  });
}

/**
 * 将处理后的元素数组转换为 pdfmake 内容数组
 * @param {Array} elements - processTextWithImages 返回的元素数组
 * @param {number} maxWidth - PDF 最大宽度（pt）
 * @returns {Promise<Array>} pdfmake 内容数组（异步因为需要等待图片加载）
 */
async function elementsToPdfContent(
  elements,
  maxWidth = 400,
) {
  console.log(
    "[CCTALK Export] elementsToPdfContent called with",
    elements.length,
    "elements",
  );
  const content = [];

  for (const element of elements) {
    if (element.type === "text") {
      if (element.value.trim()) {
        console.log(
          "[CCTALK Export] Adding text element:",
          element.value.substring(0, 50),
        );
        content.push({
          text: element.value,
          ...(element.style || {}),
        });
      }
    } else if (element.type === "image") {
      console.log(
        "[CCTALK Export] Adding image element",
      );
      // 等待图片加载以获取尺寸
      const imgDimensions =
        await getImageDimensions(element.value);

      // 计算图片宽度（保持宽高比）
      let width = imgDimensions.width || maxWidth;
      let height = imgDimensions.height || "auto";

      console.log(
        "[CCTALK Export] Image dimensions:",
        width,
        "x",
        height,
      );

      // 如果图片超过最大宽度，按比例缩放
      if (width > maxWidth) {
        const ratio = width / height;
        width = maxWidth;
        height = width / ratio;
        console.log(
          "[CCTALK Export] Scaled image to:",
          width,
          "x",
          height,
        );
      }

      content.push({
        image: element.value,
        width: width,
        height: height,
        margin: [0, 2, 0, 2],
        alignment: "center",
      });
    }
  }

  console.log(
    "[CCTALK Export] elementsToPdfContent completed, total items:",
    content.length,
  );
  return content;
}

/**
 * 格式化选项文本，正确答案使用绿色
 * @param {string} line - 选项文本
 * @param {boolean} isCorrect - 是否为正确答案
 * @returns {string|Object} pdfmake 文本对象
 */
function formatOptionText(line, isCorrect) {
  if (isCorrect) {
    // 使用 pdfmake 的原生颜色语法
    return {
      text: line,
      color: "#1B8A3B",
    };
  }
  return line;
}

/**
 * 创建带边框的分析框
 * @param {string} text - 分析文本
 * @returns {Object} pdfmake 边框对象
 */
function createAnalysisBox(text) {
  return {
    table: {
      widths: ["*"],
      body: [
        [
          {
            text: text,
            fontSize: 10.5,
            margin: [6, 6, 6, 6],
          },
        ],
      ],
      layout: {
        hLineWidth: function () {
          return 0.6;
        },
        vLineWidth: function () {
          return 0.6;
        },
        hLineColor: function () {
          return "#9AA0A6";
        },
        vLineColor: function () {
          return "#9AA0A6";
        },
        paddingLeft: function () {
          return 0;
        },
        paddingRight: function () {
          return 0;
        },
        paddingTop: function () {
          return 0;
        },
        paddingBottom: function () {
          return 0;
        },
      },
    },
    margin: [4, 4, 0, 8],
  };
}

/**
 * 规范化文件名
 * @param {string} filename - 文件名
 * @returns {string} 规范化后的文件名
 */
function sanitizeFilename(filename) {
  if (!filename) return "paper_report.pdf";
  return (
    filename
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/\s+/g, "_")
      .substring(0, 200) + ".pdf"
  );
}

/**
 * ArrayBuffer 转 Base64
 * @param {ArrayBuffer} arrayBuffer - ArrayBuffer
 * @returns {Promise<string>} Base64 字符串
 */
function arrayBufferToBase64(arrayBuffer) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([arrayBuffer], {
      type: "application/octet-stream",
    });
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const base64 =
          reader.result.split(",")[1];
        resolve(base64);
      } catch (error) {
        reject(
          new Error(
            "Failed to extract base64 from data URL",
          ),
        );
      }
    };

    reader.onerror = () => {
      reject(
        new Error(
          "FileReader failed to read blob",
        ),
      );
    };

    reader.readAsDataURL(blob);
  });
}
