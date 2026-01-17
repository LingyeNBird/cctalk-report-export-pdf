(function() {
  console.log('[CCTALK Export] === Content Script Loaded ===');
  console.log('[CCTALK Export] Current URL:', window.location.href);

  function fetchReportData(callback) {
    var urlParams = new URLSearchParams(window.location.search);
    var paperId = urlParams.get('paperId');
    var recordId = urlParams.get('recordId');
    var signParam = urlParams.get('sign');

    console.log('[CCTALK Export] URL params parsed');
    console.log('[CCTALK Export] paperId:', paperId);
    console.log('[CCTALK Export] recordId:', recordId);
    console.log('[CCTALK Export] sign:', signParam);

    if (!paperId || !recordId) {
      console.error('[CCTALK Export] Missing required URL params');
      callback(null);
      return;
    }

    var requestUrl = 'https://tiku.cctalk.com/webapi/question/v1/student/paper_report?paperId=' + paperId + '&recordId=' + recordId;
    if (signParam) {
      requestUrl += '&sign=' + encodeURIComponent(signParam);
    }
    requestUrl += '&_timestamp=' + Date.now();

    console.log('[CCTALK Export] Fetching data from:', requestUrl);

    var headers = {
      'Accept': 'application/json',
      'huijiang-app-key': 'pcweb',
      'Referer': window.location.href
    };

    var xhr = new XMLHttpRequest();
    xhr.open('GET', requestUrl, true);
    xhr.withCredentials = true;

    for (var headerName in headers) {
      xhr.setRequestHeader(headerName, headers[headerName]);
    }

    xhr.onload = function() {
      console.log('[CCTALK Export] XHR status:', xhr.status);
      
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          console.log('[CCTALK Export] Data fetched successfully');

          if (data && data.data && data.data.sections) {
            var sectionCount = data.data.sections.length;
            var totalQuestions = 0;
            for (var i = 0; i < sectionCount; i++) {
              var questions = data.data.sections[i].questions;
              if (questions) {
                totalQuestions += questions.length;
              }
            }
            console.log('[CCTALK Export] Sections:', sectionCount, 'Questions:', totalQuestions);
          }

          callback(data);
        } catch (e) {
          console.error('[CCTALK Export] JSON parse error:', e);
          callback(null);
        }
      } else {
        console.error('[CCTALK Export] HTTP error:', xhr.status);
        tryFallback(paperId, recordId, signParam, callback);
      }
    };

    xhr.onerror = function() {
      console.error('[CCTALK Export] XHR network error');
      tryFallback(paperId, recordId, signParam, callback);
    };

    xhr.send();
  }

  function tryFallback(paperId, recordId, signParam, callback) {
    console.log('[CCTALK Export] Trying alternative URL...');

    var altUrl = 'https://tiku.cctalk.com/ams/api/paper_report?paperId=' + paperId + '&recordId=' + recordId;
    if (signParam) {
      altUrl += '&sign=' + encodeURIComponent(signParam);
    }

    console.log('[CCTALK Export] Alternative URL:', altUrl);

    var headers = {
      'Accept': 'application/json',
      'huijiang-app-key': 'pcweb',
      'Referer': window.location.href
    };

    var xhr = new XMLHttpRequest();
    xhr.open('GET', altUrl, true);
    xhr.withCredentials = true;

    for (var headerName in headers) {
      xhr.setRequestHeader(headerName, headers[headerName]);
    }

    xhr.onload = function() {
      console.log('[CCTALK Export] Alt XHR status:', xhr.status);
      
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          console.log('[CCTALK Export] Alt URL succeeded');
          callback(data);
        } catch (e) {
          console.error('[CCTALK Export] Alt JSON parse error:', e);
          callback(null);
        }
      } else {
        console.error('[CCTALK Export] Alt HTTP error:', xhr.status);
        callback(null);
      }
    };

    xhr.onerror = function() {
      console.error('[CCTALK Export] Alt XHR network error');
      callback(null);
    };

    xhr.send();
  }

  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('[CCTALK Export] Received message:', request.action);

    if (request.action === 'getReportData') {
      if (window.cctalkReportData) {
        console.log('[CCTALK Export] Using cached data');
        sendResponse({ data: window.cctalkReportData, exists: true });
      } else {
        console.log('[CCTALK Export] No cached data, fetching from API...');
        fetchReportData(function(data) {
          if (data) {
            window.cctalkReportData = data;
            sendResponse({ data: data, exists: true });
          } else {
            console.log('[CCTALK Export] Failed to fetch data');
            sendResponse({ data: null, exists: false });
          }
        });
      }
      return true;
    } else if (request.action === 'generatePDF') {
      console.log('[CCTALK Export] Handling generatePDF');
      if (typeof generatePDF === 'function') {
        generatePDF(request.data)
          .then(function() {
            console.log('[CCTALK Export] PDF generated successfully');
            sendResponse({ success: true });
          })
          .catch(function(error) {
            console.error('[CCTALK Export] PDF generation error:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true;
      } else {
        console.error('[CCTALK Export] generatePDF function not found');
        sendResponse({ success: false, error: 'generatePDF function not found' });
      }
    }
  });

  console.log('[CCTALK Export] Message listener installed');

})();
