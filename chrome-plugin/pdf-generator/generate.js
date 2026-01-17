// PDF 生成主函数
async function generatePDF(data) {
  console.log(
    "[CCTALK Export] generatePDF called with data:",
    data,
  );

  if (!data) {
    throw new Error("No data provided");
  }

  const actualData = data.data || data;
  console.log(
    "[CCTALK Export] actualData:",
    actualData,
  );

  if (typeof pdfMake === "undefined") {
    throw new Error("pdfMake library not loaded");
  }

  // 加载中文字体
  if (typeof loadChineseFont !== "undefined") {
    const fontLoaded = await loadChineseFont();
    if (!fontLoaded) {
      console.warn(
        "[CCTALK Export] 字体加载失败，使用默认字体",
      );
    }
  } else {
    console.warn(
      "[CCTALK Export] loadChineseFont 函数未定义",
    );
  }

  console.log(
    "[CCTALK Export] Calling buildDocDefinition...",
  );
  const docDefinition =
    await buildDocDefinition(actualData);
  console.log(
    "[CCTALK Export] docDefinition:",
    JSON.stringify(docDefinition, null, 2),
  );

  return new Promise((resolve) => {
    console.log(
      "[CCTALK Export] Creating PDF...",
    );
    const pdf = pdfMake.createPdf(docDefinition);
    const filename =
      sanitizeFilename(actualData.title) ||
      "paper_report.pdf";

    pdf.getBuffer((buffer) => {
      try {
        const blob = new Blob([buffer], {
          type: "application/pdf",
        });
        console.log(
          "[CCTALK Export] Buffer created, size:",
          buffer.byteLength,
        );
        downloadPDF(blob, filename);
        resolve();
      } catch (error) {
        console.error(
          "[CCTALK Export] Error creating blob:",
          error,
        );
        throw error;
      }
    });
  });
}

function addCustomFontToPdfMake() {
  if (
    pdfMake &&
    pdfMake.fonts &&
    pdfMake.fonts["仓耳华新体"]
  ) {
    console.log(
      "[CCTALK Export] Using Chinese font: 仓耳华新体",
    );
  } else {
    console.log(
      "[CCTALK Export] Using default pdfMake fonts",
    );
  }
}

function downloadPDF(pdfBlob, filename) {
  const url = URL.createObjectURL(pdfBlob);
  chrome.downloads.download(
    {
      url: url,
      filename: filename,
      saveAs: false,
    },
    (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[CCTALK Export] Download error:",
          chrome.runtime.lastError,
        );
      } else {
        console.log(
          "[CCTALK Export] Download started:",
          downloadId,
        );
      }
      setTimeout(
        () => URL.revokeObjectURL(url),
        1000,
      );
    },
  );
}

async function buildDocDefinition(data) {
  console.log(
    "[CCTALK Export] buildDocDefinition called",
  );

  const docDefinition = {
    content: [],
    styles: {
      docTitle: {
        fontSize: 18,
        bold: true,
        margin: [0, 0, 0, 10],
      },
      sectionTitle: {
        fontSize: 14,
        bold: true,
        margin: [0, 12, 0, 6],
      },
      question: {
        fontSize: 11.5,
        margin: [0, 8, 0, 4],
      },
      option: {
        fontSize: 10.5,
        margin: [12, 1, 0, 1],
      },
      analysisLabel: {
        fontSize: 10.5,
        margin: [4, 2, 0, 2],
      },
      analysis: {
        fontSize: 10.5,
        margin: [12, 4, 0, 8],
        border: [0.6, "#9AA0A6"],
        borderRadius: 2,
      },
    },
    defaultStyle: {
      font: "仓耳华新体",
    },
  };

  const title = data.title || "题目与解析";
  console.log(
    "[CCTALK Export] Adding title:",
    title,
  );
  docDefinition.content.push({
    text: title,
    style: "docTitle",
  });
  console.log(
    "[CCTALK Export] Content length after title:",
    docDefinition.content.length,
  );

  const sections = data.sections || [];
  console.log(
    "[CCTALK Export] Number of sections:",
    sections.length,
  );

  for (const section of sections) {
    console.log(
      "[CCTALK Export] Processing section:",
      section.title,
    );
    if (section.title) {
      docDefinition.content.push({
        text: section.title,
        style: "sectionTitle",
      });
    }

    const questions = section.questions || [];
    console.log(
      "[CCTALK Export] Number of questions in section:",
      questions.length,
    );

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      console.log(
        "[CCTALK Export] Processing question",
        i,
        ":",
        question.sequence || question.questionId,
      );

      if (
        question.subQuestions &&
        question.subQuestions.length > 0
      ) {
        await addMaterialQuestion(
          docDefinition.content,
          question,
        );
      } else {
        await addQuestion(
          docDefinition.content,
          question,
        );
      }

      if (i < questions.length - 1) {
        addQuestionGap(docDefinition.content);
      }
    }
  }

  console.log(
    "[CCTALK Export] Final content length:",
    docDefinition.content.length,
  );
  return docDefinition;
}

async function addMaterialQuestion(
  content,
  question,
) {
  const stemHtml =
    question.questionContent?.text ||
    question.title ||
    "";
  const stemText = htmlToText(stemHtml);

  if (stemText) {
    const elements = await processTextWithImages(
      stemText,
      400,
    );
    const pdfContent = await elementsToPdfContent(
      elements,
      400,
    );

    // 添加"材料："前缀
    if (pdfContent.length > 0) {
      const firstElement = pdfContent[0];
      if (firstElement.text) {
        firstElement.text =
          "材料：" + firstElement.text;
      }
    }

    content.push(...pdfContent);
  }

  const subQuestions =
    question.subQuestions || [];
  for (let i = 0; i < subQuestions.length; i++) {
    await addQuestion(content, subQuestions[i]);
    if (i < subQuestions.length - 1) {
      addQuestionGap(content);
    }
  }
}

async function addQuestion(content, question) {
  const seq =
    question.sequence ||
    question.questionId ||
    "";
  const contentHtml =
    question.questionContent?.text ||
    question.title ||
    "";
  const contentText = htmlToText(contentHtml);

  if (contentText) {
    const header = seq
      ? `${seq}. ${contentText}`
      : contentText;

    const elements = await processTextWithImages(
      header,
      400,
    );
    const pdfContent = await elementsToPdfContent(
      elements,
      400,
    );

    content.push(...pdfContent);
  }

  const options = question.options || [];
  const answers = new Set();
  if (question.standardAnswer) {
    question.standardAnswer.forEach((a) => {
      if (a.text) answers.add(a.text.trim());
    });
  }

  // 检测是否有图片选项
  const hasImageOptions = options.some((opt) => {
    const optText = opt.text || "";
    // 如果选项文本是 URL，或者只有图片标签，则认为是图片选项
    return (
      optText.startsWith("http") ||
      (optText.includes("<img") &&
        !optText.replace(/<[^>]+>/g, "").trim())
    );
  });

  // 构建选项内容数组
  const optionItems = [];

  for (const opt of options) {
    const value = opt.value?.trim();
    const optText = htmlToText(opt.text || "");
    const isCorrect = value && answers.has(value);

    // 检测是否为图片选项
    const isImageOption =
      optText.startsWith("http") ||
      (opt.text &&
        opt.text.includes("<img") &&
        !opt.text.replace(/<[^>]+>/g, "").trim());

    if (isImageOption) {
      // 图片选项
      const imageUrl = opt.text.startsWith("http")
        ? opt.text.trim()
        : opt.text.match(
            /src=["']([^"']+)["']/,
          )?.[1] || "";

      optionItems.push({
        type: "image",
        value: value,
        url: imageUrl,
        isCorrect: isCorrect,
      });
    } else {
      // 文本选项
      const line = `${value}. ${optText}`.trim();
      optionItems.push({
        type: "text",
        value: line,
        isCorrect: isCorrect,
      });
    }
  }

  // 渲染选项
  if (hasImageOptions) {
    // 图片选项：使用两列表格布局
    const tableBody = [];
    for (
      let i = 0;
      i < optionItems.length;
      i += 2
    ) {
      const row = [];

      for (
        let j = 0;
        j < 2 && i + j < optionItems.length;
        j++
      ) {
        const item = optionItems[i + j];

        if (item.type === "image") {
          // 图片选项
          const imageDataUrl =
            await downloadImageAsDataURL(
              item.url,
            );
          if (imageDataUrl) {
            const imgDimensions =
              await getImageDimensions(
                imageDataUrl,
              );
            const maxWidth = 180; // 每列最大宽度
            let width =
              imgDimensions.width || maxWidth;
            let height =
              imgDimensions.height || "auto";

            // 缩放图片
            if (width > maxWidth) {
              const ratio = width / height;
              width = maxWidth;
              height = width / ratio;
            }

            row.push({
              stack: [
                {
                  text: `${item.value}.`,
                  fontSize: 10.5,
                  margin: [0, 0, 0, 4],
                },
                {
                  image: imageDataUrl,
                  width: width,
                  height: height,
                  alignment: "center",
                  border: item.isCorrect
                    ? [1, 1, 1, 1]
                    : undefined,
                  borderColor: item.isCorrect
                    ? "#1B8A3B"
                    : undefined,
                },
              ],
              alignment: "center",
            });
          } else {
            // 图片下载失败，显示占位符
            row.push({
              text: `${item.value}. [图片: ${item.url}]`,
              fontSize: 9,
              color: "#999999",
              margin: [12, 4, 0, 4],
            });
          }
        } else {
          // 文本选项（在图片选项混用的情况下）
          const text = formatOptionText(
            item.value,
            item.isCorrect,
          );
          row.push({
            text: text,
            style: "option",
            margin: [12, 4, 0, 4],
          });
        }
      }

      tableBody.push(row);
    }

    content.push({
      table: {
        widths: ["*", "*"],
        body: tableBody,
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: function (i) {
          // 第一列不添加左边距，第二列添加 20pt
          return i === 0 ? 0 : 20;
        },
      },
      margin: [0, 4, 0, 8],
    });
  } else {
    // 全是文本选项，逐个添加
    for (const item of optionItems) {
      const optionContent = formatOptionText(
        item.value,
        item.isCorrect,
      );
      if (
        typeof optionContent === "object" &&
        optionContent.text
      ) {
        content.push({
          text: optionContent,
          style: "option",
        });
      } else {
        content.push({
          text: optionContent,
          color: item.isCorrect
            ? "#1B8A3B"
            : undefined,
          style: "option",
        });
      }
    }
  }

  const analysisHtml =
    question.analysis?.text || "";
  const analysisText = htmlToText(analysisHtml);

  if (analysisText) {
    let finalAnalysis = analysisText;
    if (
      !/^\s*\d*\s*\.?\s*解析/.test(analysisText)
    ) {
      finalAnalysis = "解析：\n" + analysisText;
    }

    // 处理分析文本中的图片
    const elements = await processTextWithImages(
      finalAnalysis,
      400,
    );
    const pdfContent = await elementsToPdfContent(
      elements,
      400,
    );

    // 创建带边框的分析框
    content.push({
      table: {
        widths: ["*"],
        body: [
          [
            {
              stack: pdfContent,
              fontSize: 10.5,
              margin: [6, 6, 6, 6],
              lineHeight: 1.3,
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
          paddingTop: function () {
            return 0;
          },
          paddingBottom: function () {
            return 0;
          },
          paddingLeft: function () {
            return 0;
          },
          paddingRight: function () {
            return 0;
          },
        },
      },
      margin: [4, 4, 0, 8],
    });
  }
}

function addQuestionGap(content) {
  content.push({
    text: "",
    margin: [0, 8, 0, 0],
  });
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
