document.addEventListener(
  "DOMContentLoaded",
  () => {
    console.log(
      "[CCTALK Export Popup] Popup loaded",
    );

    const exportBtn =
      document.getElementById("exportBtn");
    const statusEl =
      document.getElementById("status");

    // 字体缓存（在 popup 中）
    window.fontCache = {
      base64Font: null,
      isLoaded: false,
      isLoading: false,
    };

    function setStatus(text, type = "") {
      console.log(
        "[CCTALK Export Popup] Status changed:",
        text,
        type,
      );
      statusEl.textContent = text;
      statusEl.className = "status " + type;
    }

    function setButtonEnabled(enabled) {
      console.log(
        "[CCTALK Export Popup] Button enabled:",
        enabled,
      );
      exportBtn.disabled = !enabled;
    }

    // 预加载字体（在 popup 中，有权限访问扩展资源）
    async function preloadFont() {
      if (window.fontCache.isLoaded) {
        console.log(
          "[CCTALK Export Popup] 字体已加载",
        );
        return true;
      }

      if (window.fontCache.isLoading) {
        console.log(
          "[CCTALK Export Popup] 等待字体加载...",
        );
        return new Promise((resolve) => {
          const checkInterval = setInterval(
            () => {
              if (window.fontCache.isLoaded) {
                clearInterval(checkInterval);
                resolve(true);
              } else if (
                !window.fontCache.isLoading
              ) {
                clearInterval(checkInterval);
                resolve(false);
              }
            },
            100,
          );
        });
      }

      try {
        window.fontCache.isLoading = true;
        console.log(
          "[CCTALK Export Popup] 开始预加载字体...",
        );

        const fontPath =
          "lib/pdfmake/fonts/仓耳华新体.ttf";
        const fontUrl =
          chrome.runtime.getURL(fontPath);
        console.log(
          "[CCTALK Export Popup] 字体 URL:",
          fontUrl,
        );

        const response = await fetch(fontUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch font: ${response.status}`,
          );
        }

        const arrayBuffer =
          await response.arrayBuffer();
        console.log(
          "[CCTALK Export Popup] 字体大小:",
          arrayBuffer.byteLength,
          "bytes",
        );

        // 转换为 base64
        const base64Font =
          await arrayBufferToBase64(arrayBuffer);

        // 注册到 pdfmake（使用兼容旧版本的方式）
        if (!pdfMake.vfs) {
          pdfMake.vfs = {};
        }
        pdfMake.vfs["仓耳华新体.ttf"] =
          base64Font;

        pdfMake.fonts = {
          仓耳华新体: {
            normal: "仓耳华新体.ttf",
            bold: "仓耳华新体.ttf",
            italics: "仓耳华新体.ttf",
            bolditalics: "仓耳华新体.ttf",
          },
        };

        window.fontCache.base64Font = base64Font;
        window.fontCache.isLoaded = true;
        window.fontCache.isLoading = false;

        console.log(
          "[CCTALK Export Popup] ✅ 字体加载成功",
        );
        return true;
      } catch (error) {
        console.error(
          "[CCTALK Export Popup] ❌ 字体加载失败:",
          error,
        );
        window.fontCache.isLoading = false;
        return false;
      }
    }

    async function arrayBufferToBase64(
      arrayBuffer,
    ) {
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
                "Failed to extract base64",
              ),
            );
          }
        };

        reader.onerror = () =>
          reject(new Error("FileReader failed"));
        reader.readAsDataURL(blob);
      });
    }

    async function checkDataAvailability() {
      console.log(
        "[CCTALK Export Popup] Checking data availability...",
      );

      try {
        const [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (!tab) {
          console.error(
            "[CCTALK Export Popup] No active tab found",
          );
          setStatus("未找到活动标签页", "error");
          setButtonEnabled(false);
          return;
        }

        console.log(
          "[CCTALK Export Popup] Current tab:",
          tab.url,
        );
        console.log(
          "[CCTALK Export Popup] Sending getReportData message to tab:",
          tab.id,
        );

        const response =
          await chrome.tabs.sendMessage(tab.id, {
            action: "getReportData",
          });

        console.log(
          "[CCTALK Export Popup] Received response:",
          response,
        );

        if (
          response &&
          response.exists &&
          response.data
        ) {
          console.log(
            "[CCTALK Export Popup] ✓ Data found!",
          );
          setStatus("准备就绪");
          setButtonEnabled(true);
          window.currentReportData =
            response.data;

          // 后台预加载字体
          preloadFont().catch((err) => {
            console.warn(
              "[CCTALK Export Popup] 字体预加载失败，将在导出时重试:",
              err,
            );
          });
        } else {
          console.error(
            "[CCTALK Export Popup] ✗ No data found, response:",
            response,
          );
          setStatus("未找到作业数据", "error");
          setButtonEnabled(false);
        }
      } catch (error) {
        console.error(
          "[CCTALK Export Popup] Check data error:",
          error,
        );
        setStatus("无法连接到页面", "error");
        setButtonEnabled(false);
      }
    }

    async function exportPDF() {
      console.log(
        "[CCTALK Export Popup] Export PDF clicked",
      );

      if (!window.currentReportData) {
        console.error(
          "[CCTALK Export Popup] No cached data available",
        );
        setStatus("未找到作业数据", "error");
        return;
      }

      setButtonEnabled(false);
      setStatus("正在加载字体...", "loading");

      try {
        // 确保字体已加载
        const fontLoaded = await preloadFont();
        if (!fontLoaded) {
          throw new Error("字体加载失败");
        }

        setStatus("正在生成PDF...", "loading");
        console.log(
          "[CCTALK Export Popup] 开始生成 PDF",
        );

        // 在 popup 中生成 PDF
        const actualData =
          window.currentReportData.data ||
          window.currentReportData;

        console.log(
          "[CCTALK Export Popup] Calling buildDocDefinition...",
        );
        const docDefinition =
          await buildDocDefinition(actualData);
        console.log(
          "[CCTALK Export Popup] buildDocDefinition returned, docDefinition:",
          docDefinition,
        );

        console.log(
          "[CCTALK Export Popup] Creating pdfMake PDF...",
        );
        const pdf = pdfMake.createPdf(
          docDefinition,
        );
        console.log(
          "[CCTALK Export Popup] PDF created",
        );
        const filename =
          sanitizeFilename(actualData.title) ||
          "paper_report.pdf";

        console.log(
          "[CCTALK Export Popup] Getting PDF buffer...",
        );
        pdf.getBuffer((buffer) => {
          console.log(
            "[CCTALK Export Popup] PDF buffer received, size:",
            buffer ? buffer.byteLength : "null",
          );
          try {
            const blob = new Blob([buffer], {
              type: "application/pdf",
            });
            console.log(
              "[CCTALK Export Popup] Blob created, size:",
              blob.size,
            );

            // 使用 chrome.downloads API 下载
            const url = URL.createObjectURL(blob);
            chrome.downloads.download(
              {
                url: url,
                filename: filename,
                saveAs: false,
              },
              (downloadId) => {
                if (chrome.runtime.lastError) {
                  console.error(
                    "[CCTALK Export Popup] Download error:",
                    chrome.runtime.lastError,
                  );
                  setStatus(
                    "下载失败: " +
                      chrome.runtime.lastError
                        .message,
                    "error",
                  );
                } else {
                  console.log(
                    "[CCTALK Export Popup] Download started:",
                    downloadId,
                  );
                  setStatus(
                    "PDF已下载",
                    "success",
                  );
                  setTimeout(
                    () => setStatus("准备就绪"),
                    2000,
                  );
                }
                setTimeout(
                  () => URL.revokeObjectURL(url),
                  1000,
                );
              },
            );
          } catch (error) {
            console.error(
              "[CCTALK Export Popup] PDF generation error:",
              error,
            );
            setStatus(
              "生成失败: " + error.message,
              "error",
            );
          } finally {
            setButtonEnabled(true);
          }
        });
      } catch (error) {
        console.error(
          "[CCTALK Export Popup] Export error:",
          error,
        );
        setStatus(
          "导出失败: " + error.message,
          "error",
        );
        setButtonEnabled(true);
      }
    }

    exportBtn.addEventListener(
      "click",
      exportPDF,
    );

    console.log(
      "[CCTALK Export Popup] Event listeners attached",
    );
    checkDataAvailability();
  },
);
