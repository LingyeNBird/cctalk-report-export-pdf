function htmlToText(html) {
  if (!html) return '';
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  let text = doc.body.textContent || '';
  
  text = text.replace(/\xa0/g, ' ');
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  text = text.replace(/[ \t]+\n/g, '\n');
  text = text.replace(/\n[ \t]+/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  
  return text.trim();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function normalizeImageUrl(url) {
  if (!url) return '';
  return url.replace(/\s+/g, '');
}

async function downloadImageAsDataURL(url, timeout = 30000) {
  if (!url || !url.startsWith('http')) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('[CCTALK Export] Failed to download image:', url, error);
    return null;
  }
}

function splitTextWithImages(text) {
  const pattern = /\[图片:\s*([^\]]*)\]/g;
  const parts = [];
  let pos = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > pos) {
      parts.push({ type: 'text', value: text.substring(pos, match.index) });
    }
    parts.push({ type: 'image', value: match[1].trim() });
    pos = match.index + match[0].length;
  }

  if (pos < text.length) {
    parts.push({ type: 'text', value: text.substring(pos) });
  }

  return parts;
}

function sanitizeFilename(filename) {
  if (!filename) return 'paper_report.pdf';
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 200) + '.pdf';
}

function formatOptionText(line, isCorrect) {
  const escaped = escapeHtml(line);
  if (isCorrect) {
    return `<font color="#1B8A3B">${escaped}</font>`;
  }
  return escaped;
}
