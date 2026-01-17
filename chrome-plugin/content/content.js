(function () {
  console.log(
    "[CCTALK Export] === Content Script Loaded ===",
  );
  console.log(
    "[CCTALK Export] Current URL:",
    window.location.href,
  );

  // Function to fetch report data using current page URL parameters
  function fetchReportData(callback) {
    const urlParams = new URLSearchParams(
      window.location.search,
    );
    const paperId = urlParams.get("paperId");
    const recordId = urlParams.get("recordId");
    const signParam = urlParams.get("sign");

    console.log(
      "[CCTALK Export] URL params parsed",
    );
    console.log(
      "[CCTALK Export] paperId:",
      paperId,
    );
    console.log(
      "[CCTALK Export] recordId:",
      recordId,
    );
    console.log(
      "[CCTALK Export] sign:",
      signParam,
    );

    if (!paperId || !recordId) {
      console.error(
        "[CCTALK Export] Missing required URL params",
      );
      callback(null);
      return;
    }

    // Construct API URL with current timestamp
    let requestUrl =
      "https://tiku.cctalk.com/webapi/question/v1/student/paper_report?_timestamp=" +
      Date.now();
    requestUrl +=
      "&paperId=" +
      paperId +
      "&recordId=" +
      recordId;
    if (signParam) {
      requestUrl +=
        "&sign=" + encodeURIComponent(signParam);
    }

    console.log(
      "[CCTALK Export] Fetching data from:",
      requestUrl,
    );

    const headers = {
      Accept: "application/json",
      "huijiang-app-key": "pcweb",
      Referer: window.location.href,
    };

    const xhr = new XMLHttpRequest();
    xhr.open("GET", requestUrl, true);
    xhr.withCredentials = true;

    for (const headerName in headers) {
      xhr.setRequestHeader(
        headerName,
        headers[headerName],
      );
    }

    xhr.onload = function () {
      console.log(
        "[CCTALK Export] XHR status:",
        xhr.status,
      );

      if (xhr.status === 200) {
        try {
          const data = JSON.parse(
            xhr.responseText,
          );
          console.log(
            "[CCTALK Export] Data fetched successfully",
          );

          if (
            data &&
            data.data &&
            data.data.sections
          ) {
            const sectionCount =
              data.data.sections.length;
            let totalQuestions = 0;
            for (
              let i = 0;
              i < sectionCount;
              i++
            ) {
              const questions =
                data.data.sections[i].questions;
              if (questions) {
                totalQuestions +=
                  questions.length;
              }
            }
            console.log(
              "[CCTALK Export] Sections:",
              sectionCount,
              "Questions:",
              totalQuestions,
            );
          }

          callback(data);
        } catch (e) {
          console.error(
            "[CCTALK Export] JSON parse error:",
            e,
          );
          callback(null);
        }
      } else {
        console.error(
          "[CCTALK Export] HTTP error:",
          xhr.status,
        );
        callback(null);
      }
    };

    xhr.onerror = function () {
      console.error(
        "[CCTALK Export] XHR network error",
      );
      callback(null);
    };

    xhr.send();
  }

  // Message listener for popup communication
  chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
      console.log(
        "[CCTALK Export] Received message:",
        request.action,
      );

      if (request.action === "getReportData") {
        const data = window.cctalkReportData;

        if (!data) {
          console.log(
            "[CCTALK Export] No cached data, fetching from API...",
          );
          fetchReportData(function (result) {
            const finalData = result;
            if (finalData) {
              window.cctalkReportData = finalData;
            }
            console.log(
              "[CCTALK Export] Final result:",
              finalData ? "found" : "not found",
            );
            sendResponse({
              data: finalData,
              exists: !!finalData,
            });
          });
        } else {
          console.log(
            "[CCTALK Export] Using cached data",
          );
          console.log(
            "[CCTALK Export] Final result:",
            data ? "found" : "not found",
          );
          sendResponse({
            data: data,
            exists: true,
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
    "[CCTALK Export] Content script initialized",
  );
})();
