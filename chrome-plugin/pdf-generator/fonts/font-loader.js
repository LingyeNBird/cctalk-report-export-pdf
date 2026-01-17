// Font Loader for pdfmake - 使用 addVirtualFileSystem + 预生成 + 懒加载

// 全局字体缓存
window.fontCache = {
  base64Font: null,
  isLoaded: false,
  isLoading: false,
};

// 更高效的 ArrayBuffer 转 base64（使用 FileReader）
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

// 使用 addVirtualFileSystem 注册字体
function registerFontToPdfMake(base64Font) {
  // 确保 pdfmake 已加载
  if (typeof pdfMake === "undefined") {
    throw new Error("pdfMake 未加载");
  }

  // 使用 addVirtualFileSystem API（更可靠的官方 API）
  pdfMake.addVirtualFileSystem({
    fonts: {
      "仓耳华新体.ttf": base64Font,
    },
  });

  // 配置字体（只配置仓耳华新体）
  pdfMake.fonts = {
    仓耳华新体: {
      normal: "仓耳华新体.ttf",
      bold: "仓耳华新体.ttf",
      italics: "仓耳华新体.ttf",
      bolditalics: "仓耳华新体.ttf",
    },
  };

  console.log(
    "[Font Loader] ✅ pdfMake.fonts 已配置（使用 addVirtualFileSystem）",
  );
}

async function loadChineseFont() {
  // 如果已经加载，直接使用缓存
  if (
    window.fontCache.isLoaded &&
    window.fontCache.base64Font
  ) {
    console.log(
      "[Font Loader] ✅ 使用缓存的字体",
    );
    registerFontToPdfMake(
      window.fontCache.base64Font,
    );
    return true;
  }

  // 如果正在加载，等待加载完成
  if (window.fontCache.isLoading) {
    console.log(
      "[Font Loader] ⏳ 等待字体加载...",
    );
    while (window.fontCache.isLoading) {
      await new Promise((resolve) =>
        setTimeout(resolve, 100),
      );
    }

    if (window.fontCache.isLoaded) {
      console.log(
        "[Font Loader] ✅ 使用缓存的字体",
      );
      registerFontToPdfMake(
        window.fontCache.base64Font,
      );
      return true;
    }
    return false;
  }

  // 开始加载
  try {
    window.fontCache.isLoading = true;
    console.log(
      "[Font Loader] 🔄 开始加载中文字体...",
    );

    // 尝试多种方式获取字体文件 URL
    let fontUrl;
    const fontPath =
      "lib/pdfmake/fonts/仓耳华新体.ttf";

    try {
      // 方法1: chrome.runtime.getURL (新 API)
      fontUrl = chrome.runtime.getURL(fontPath);
      console.log(
        "[Font Loader] 使用 chrome.runtime.getURL:",
        fontUrl,
      );
    } catch (e1) {
      console.warn(
        "[Font Loader] chrome.runtime.getURL 失败:",
        e1.message,
      );
      try {
        // 方法2: chrome.extension.getURL (旧 API)
        fontUrl =
          chrome.extension.getURL(fontPath);
        console.log(
          "[Font Loader] 使用 chrome.extension.getURL:",
          fontUrl,
        );
      } catch (e2) {
        console.error(
          "[Font Loader] 获取字体 URL 失败:",
          e2.message,
        );
        throw new Error("无法获取字体文件 URL");
      }
    }

    // 尝试多种方式加载字体（XHR + fetch 备用）
    console.log(
      "[Font Loader] 尝试加载字体:",
      fontUrl,
    );
    const arrayBuffer = await loadFont(fontUrl);

    // 转换为 base64
    console.log("[Font Loader] 转换为 base64...");
    const base64Font =
      await arrayBufferToBase64(arrayBuffer);

    console.log(
      `[Font Loader] ✅ 字体加载成功，原始大小: ${arrayBuffer.byteLength} bytes，base64 长度: ${base64Font.length} 字符`,
    );

    // 缓存字体
    window.fontCache.base64Font = base64Font;
    window.fontCache.isLoaded = true;
    window.fontCache.isLoading = false;

    // 注册字体到 pdfmake
    registerFontToPdfMake(base64Font);

    console.log(
      "[Font Loader] ✅ 字体已注册到 pdfmake 并缓存",
    );

    return true;
  } catch (error) {
    console.error(
      "[Font Loader] ❌ 字体加载失败:",
      error.message,
    );
    console.error(
      "[Font Loader] 错误堆栈:",
      error.stack,
    );

    // 额外的调试信息
    console.log("[Font Loader] 调试信息:");
    console.log(
      "  - fontCache:",
      window.fontCache,
    );
    console.log(
      "  - chrome.runtime available:",
      typeof chrome !== "undefined" &&
        chrome.runtime,
    );
    console.log(
      "  - chrome.extension available:",
      typeof chrome !== "undefined" &&
        chrome.extension,
    );

    window.fontCache.isLoading = false;
    window.fontCache.isLoaded = false;
    return false;
  }
}

// 使用 XMLHttpRequest 加载字体（在某些情况下比 fetch 更可靠）
function loadFontViaXHR(url) {
  return new Promise((resolve, reject) => {
    console.log(
      "[Font Loader] XHR: 开始请求",
      url,
    );
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";

    xhr.onload = () => {
      console.log(
        "[Font Loader] XHR: onload",
        xhr.status,
        xhr.statusText,
      );
      if (xhr.status === 200) {
        console.log(
          "[Font Loader] XHR: 成功，接收",
          xhr.response.byteLength,
          "bytes",
        );
        resolve(xhr.response);
      } else {
        reject(
          new Error(
            `XHR failed with status ${xhr.status} ${xhr.statusText}`,
          ),
        );
      }
    };

    xhr.onerror = (e) => {
      console.error(
        "[Font Loader] XHR: onerror",
        e,
      );
      console.error(
        "[Font Loader] XHR: readyState",
        xhr.readyState,
      );
      console.error(
        "[Font Loader] XHR: status",
        xhr.status,
      );
      reject(new Error("XHR request failed"));
    };

    xhr.ontimeout = () => {
      console.error(
        "[Font Loader] XHR: ontimeout",
      );
      reject(new Error("XHR request timed out"));
    };

    xhr.timeout = 30000; // 30秒超时
    xhr.send();
  });
}

// 使用 fetch 加载字体（备用方法）
async function loadFontViaFetch(url) {
  console.log(
    "[Font Loader] Fetch: 开始请求",
    url,
  );

  const response = await fetch(url);

  console.log(
    "[Font Loader] Fetch: 响应",
    response.status,
    response.statusText,
  );

  if (!response.ok) {
    throw new Error(
      `Fetch failed with status ${response.status} ${response.statusText}`,
    );
  }

  const arrayBuffer =
    await response.arrayBuffer();

  console.log(
    "[Font Loader] Fetch: 成功，接收",
    arrayBuffer.byteLength,
    "bytes",
  );

  return arrayBuffer;
}

// 尝试多种方式加载字体
async function loadFont(url) {
  // 先尝试 XHR
  try {
    return await loadFontViaXHR(url);
  } catch (xhrError) {
    console.warn(
      "[Font Loader] XHR 失败，尝试使用 fetch:",
      xhrError.message,
    );

    // 尝试 fetch 作为备用
    try {
      return await loadFontViaFetch(url);
    } catch (fetchError) {
      console.error(
        "[Font Loader] Fetch 也失败了:",
        fetchError.message,
      );
      throw new Error(
        `字体加载失败 (XHR: ${xhrError.message}, Fetch: ${fetchError.message})`,
      );
    }
  }
}

// 测试字体文件是否可以访问
async function testFontFileAccess() {
  console.log(
    "[Font Loader] ========== 字体文件访问测试 ==========",
  );

  try {
    const fontPath =
      "lib/pdfmake/fonts/仓耳华新体.ttf";

    // 测试 chrome.runtime.getURL
    console.log(
      "[Font Loader] 1. 测试 chrome.runtime.getURL...",
    );
    try {
      const url = chrome.runtime.getURL(fontPath);
      console.log("[Font Loader]    ✓ URL:", url);

      // 测试 fetch
      console.log(
        "[Font Loader] 2. 测试 fetch...",
      );
      const response = await fetch(url);
      console.log(
        "[Font Loader]    ✓ Status:",
        response.status,
        response.statusText,
      );
      console.log(
        "[Font Loader]    ✓ Content-Type:",
        response.headers.get("content-type"),
      );
      console.log(
        "[Font Loader]    ✓ Content-Length:",
        response.headers.get("content-length"),
      );

      if (response.ok) {
        const blob = await response.blob();
        console.log(
          "[Font Loader]    ✓ Blob size:",
          blob.size,
          "bytes",
        );
        console.log(
          "[Font Loader]    ✓ Blob type:",
          blob.type,
        );
        console.log(
          "[Font Loader] ========== 测试成功 ==========",
        );
        return true;
      }
    } catch (error) {
      console.error(
        "[Font Loader]    ✗ 错误:",
        error.message,
      );
    }
  } catch (error) {
    console.error(
      "[Font Loader] 测试失败:",
      error,
    );
  }

  console.log(
    "[Font Loader] ========== 测试失败 ==========",
  );
  return false;
}

// 导出函数
window.loadChineseFont = loadChineseFont;
window.testFontFileAccess = testFontFileAccess;
