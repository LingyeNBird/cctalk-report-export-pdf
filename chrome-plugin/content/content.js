(function () {
  console.log(
    "[CCTALK Export] === Content Script Loaded ===",
  );
  console.log(
    "[CCTALK Export] Current URL:",
    window.location.href,
  );

  // Intercept XMLHttpRequest to capture paper_report API calls
  (function () {
    const originalOpen =
      XMLHttpRequest.prototype.open;
    const originalSend =
      XMLHttpRequest.prototype.send;
    const originalSetRequestHeader =
      XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function (
      method,
      url,
      ...args
    ) {
      this._cctalkUrl = url;
      this._cctalkMethod = method;
      this._cctalkHeaders = {};
      return originalOpen.apply(this, [
        method,
        url,
        ...args,
      ]);
    };

    XMLHttpRequest.prototype.setRequestHeader =
      function (header, value) {
        if (this._cctalkHeaders) {
          this._cctalkHeaders[header] = value;
        }
        return originalSetRequestHeader.apply(
          this,
          [header, value],
        );
      };

    XMLHttpRequest.prototype.send = function (
      ...args
    ) {
      const xhr = this;

      // Check if this is a paper_report request
      if (
        xhr._cctalkUrl &&
        xhr._cctalkUrl.includes("paper_report")
      ) {
        console.log(
          "[CCTALK Export] Intercepting XHR request:",
          xhr._cctalkUrl,
        );

        xhr.addEventListener("load", function () {
          if (xhr.status === 200) {
            try {
              const data = JSON.parse(
                xhr.responseText,
              );
              console.log(
                "[CCTALK Export] Successfully intercepted paper_report data",
              );

              if (data && data.data) {
                window.cctalkReportData = data;

                // Log summary
                if (data.data.sections) {
                  const sectionCount =
                    data.data.sections.length;
                  let totalQuestions = 0;
                  for (
                    let i = 0;
                    i < sectionCount;
                    i++
                  ) {
                    const questions =
                      data.data.sections[i]
                        .questions;
                    if (questions) {
                      totalQuestions +=
                        questions.length;
                    }
                  }
                  console.log(
                    "[CCTALK Export] Cached data - Sections:",
                    sectionCount,
                    "Questions:",
                    totalQuestions,
                  );
                }
              }
            } catch (e) {
              console.error(
                "[CCTALK Export] Failed to parse intercepted response:",
                e,
              );
            }
          } else {
            console.warn(
              "[CCTALK Export] Intercepted request returned status:",
              xhr.status,
            );
          }
        });

        xhr.addEventListener(
          "error",
          function () {
            console.error(
              "[CCTALK Export] Intercepted request failed:",
              xhr._cctalkUrl,
            );
          },
        );
      }

      return originalSend.apply(this, args);
    };
  })();

  // Also intercept fetch API as a backup
  (function () {
    const originalFetch = window.fetch;

    window.fetch = function (...args) {
      const [urlOrRequest, options] = args;
      const url =
        typeof urlOrRequest === "string"
          ? urlOrRequest
          : urlOrRequest.url;

      if (url && url.includes("paper_report")) {
        console.log(
          "[CCTALK Export] Intercepting fetch request:",
          url,
        );

        return originalFetch
          .apply(this, args)
          .then((response) => {
            const clonedResponse =
              response.clone();

            clonedResponse
              .json()
              .then((data) => {
                if (data && data.data) {
                  window.cctalkReportData = data;
                  console.log(
                    "[CCTALK Export] Successfully intercepted fetch paper_report data",
                  );
                }
              })
              .catch((e) => {
                console.warn(
                  "[CCTALK Export] Failed to parse fetch response:",
                  e,
                );
              });

            return response;
          });
      }

      return originalFetch.apply(this, args);
    };
  })();

  // Message listener for popup communication
  chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
      console.log(
        "[CCTALK Export] Received message:",
        request.action,
      );

      if (request.action === "getReportData") {
        const data = window.cctalkReportData;

        if (data) {
          console.log(
            "[CCTALK Export] Returning cached data",
          );
          sendResponse({
            data: data,
            exists: true,
          });
        } else {
          console.log(
            "[CCTALK Export] No data available yet",
          );
          sendResponse({
            data: null,
            exists: false,
          });
        }

        return true;
      } else if (
        request.action === "generatePDF"
      ) {
        console.log(
          "[CCTALK Export] Handling generatePDF",
        );

        if (typeof generatePDF === "function") {
          generatePDF(request.data)
            .then(function () {
              console.log(
                "[CCTALK Export] PDF generated successfully",
              );
              sendResponse({ success: true });
            })
            .catch(function (error) {
              console.error(
                "[CCTALK Export] PDF generation error:",
                error,
              );
              sendResponse({
                success: false,
                error: error.message,
              });
            });
          return true;
        } else {
          console.error(
            "[CCTALK Export] generatePDF function not found",
          );
          sendResponse({
            success: false,
            error:
              "generatePDF function not found",
          });
          return true;
        }
      }
    },
  );

  console.log(
    "[CCTALK Export] XHR/Fetch interception installed",
  );
  console.log(
    "[CCTALK Export] Message listener installed",
  );
})();
