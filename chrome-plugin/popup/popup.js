document.addEventListener('DOMContentLoaded', () => {
  console.log('[CCTALK Export Popup] Popup loaded');
  
  const exportBtn = document.getElementById('exportBtn');
  const statusEl = document.getElementById('status');

  function setStatus(text, type = '') {
    console.log('[CCTALK Export Popup] Status changed:', text, type);
    statusEl.textContent = text;
    statusEl.className = 'status ' + type;
  }

  function setButtonEnabled(enabled) {
    console.log('[CCTALK Export Popup] Button enabled:', enabled);
    exportBtn.disabled = !enabled;
  }

  async function checkDataAvailability() {
    console.log('[CCTALK Export Popup] Checking data availability...');
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        console.error('[CCTALK Export Popup] No active tab found');
        setStatus('未找到活动标签页', 'error');
        setButtonEnabled(false);
        return;
      }
      
      console.log('[CCTALK Export Popup] Current tab:', tab.url);
      console.log('[CCTALK Export Popup] Sending getReportData message to tab:', tab.id);
      
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getReportData' });
      
      console.log('[CCTALK Export Popup] Received response:', response);
      
      if (response && response.exists && response.data) {
        console.log('[CCTALK Export Popup] ✓ Data found!');
        setStatus('准备就绪');
        setButtonEnabled(true);
        window.currentReportData = response.data;
      } else {
        console.error('[CCTALK Export Popup] ✗ No data found, response:', response);
        setStatus('未找到作业数据', 'error');
        setButtonEnabled(false);
      }
    } catch (error) {
      console.error('[CCTALK Export Popup] Check data error:', error);
      setStatus('无法连接到页面', 'error');
      setButtonEnabled(false);
    }
  }

  async function exportPDF() {
    console.log('[CCTALK Export Popup] Export PDF clicked');
    
    if (!window.currentReportData) {
      console.error('[CCTALK Export Popup] No cached data available');
      setStatus('未找到作业数据', 'error');
      return;
    }

    setButtonEnabled(false);
    setStatus('正在生成PDF...', 'loading');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        console.error('[CCTALK Export Popup] No active tab found');
        setStatus('未找到活动标签页', 'error');
        setButtonEnabled(true);
        return;
      }

      console.log('[CCTALK Export Popup] Sending generatePDF message');
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'generatePDF',
        data: window.currentReportData 
      });

      console.log('[CCTALK Export Popup] Generate PDF response:', response);

      if (response && response.success) {
        setStatus('PDF已下载', 'success');
        setTimeout(() => setStatus('准备就绪'), 2000);
      } else {
        console.error('[CCTALK Export Popup] PDF generation failed:', response);
        setStatus('生成失败: ' + (response?.error || '未知错误'), 'error');
      }
    } catch (error) {
      console.error('[CCTALK Export Popup] Export error:', error);
      setStatus('导出失败: ' + error.message, 'error');
    } finally {
      setButtonEnabled(true);
    }
  }

  exportBtn.addEventListener('click', exportPDF);
  
  console.log('[CCTALK Export Popup] Event listeners attached');
  checkDataAvailability();
});
