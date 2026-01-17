async function generatePDF(data) {
  if (!data) {
    throw new Error('No data provided');
  }

  const actualData = data.data || data;
  const docDefinition = buildDocDefinition(actualData);

  if (typeof pdfMake === 'undefined') {
    throw new Error('pdfMake library not loaded');
  }

  return new Promise((resolve, reject) => {
    const pdf = pdfMake.createPdf(docDefinition);
    const filename = sanitizeFilename(actualData.title) || 'paper_report.pdf';

    pdf.getBuffer((buffer) => {
      try {
        const blob = new Blob([buffer], { type: 'application/pdf' });
        downloadPDF(blob, filename);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

function downloadPDF(pdfBlob, filename) {
  const url = URL.createObjectURL(pdfBlob);
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: false
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('[CCTALK Export] Download error:', chrome.runtime.lastError);
    } else {
      console.log('[CCTALK Export] Download started:', downloadId);
    }
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

function buildDocDefinition(data) {
  const docDefinition = {
    content: [],
    styles: {
      docTitle: {
        fontSize: 18,
        bold: true,
        margin: [0, 0, 0, 10]
      },
      sectionTitle: {
        fontSize: 14,
        bold: true,
        margin: [0, 12, 0, 6]
      },
      question: {
        fontSize: 11.5,
        margin: [0, 8, 0, 4]
      },
      option: {
        fontSize: 10.5,
        margin: [12, 1, 0, 1]
      },
      analysisLabel: {
        fontSize: 10.5,
        margin: [4, 2, 0, 2]
      },
      analysis: {
        fontSize: 10.5,
        margin: [12, 4, 0, 8],
        border: [0.6, '#9AA0A6'],
        borderRadius: 2
      }
    },
    defaultStyle: {
      font: 'Roboto'
    }
  };

  const title = data.title || '题目与解析';
  docDefinition.content.push({ text: title, style: 'docTitle' });

  const sections = data.sections || [];
  for (const section of sections) {
    if (section.title) {
      docDefinition.content.push({ text: section.title, style: 'sectionTitle' });
    }

    const questions = section.questions || [];
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      
      if (question.subQuestions && question.subQuestions.length > 0) {
        addMaterialQuestion(docDefinition.content, question);
      } else {
        addQuestion(docDefinition.content, question);
      }

      if (i < questions.length - 1) {
        addQuestionGap(docDefinition.content);
      }
    }
  }

  return docDefinition;
}

function addMaterialQuestion(content, question) {
  const stemHtml = question.questionContent?.text || question.title || '';
  const stemText = htmlToText(stemHtml);
  
  if (stemText) {
    content.push({ text: '材料：' + stemText, style: 'question' });
  }

  const subQuestions = question.subQuestions || [];
  for (let i = 0; i < subQuestions.length; i++) {
    addQuestion(content, subQuestions[i]);
    if (i < subQuestions.length - 1) {
      addQuestionGap(content);
    }
  }
}

function addQuestion(content, question) {
  const seq = question.sequence || question.questionId || '';
  const contentHtml = question.questionContent?.text || question.title || '';
  const contentText = htmlToText(contentHtml);
  
  if (contentText) {
    const header = seq ? `${seq}. ${contentText}` : contentText;
    content.push({ text: header, style: 'question' });
  }

  const options = question.options || [];
  const answers = new Set();
  if (question.standardAnswer) {
    question.standardAnswer.forEach(a => {
      if (a.text) answers.add(a.text.trim());
    });
  }

  for (const opt of options) {
    const value = opt.value?.trim();
    const optText = htmlToText(opt.text || '');
    const line = `${value}. ${optText}`.trim();
    const isCorrect = value && answers.has(value);
    
    content.push({
      text: formatOptionText(line, isCorrect),
      style: 'option'
    });
  }

  const analysisHtml = question.analysis?.text || '';
  const analysisText = htmlToText(analysisHtml);
  
  if (analysisText) {
    let finalAnalysis = analysisText;
    if (!/^\s*\d*\s*\.?\s*解析/.test(analysisText)) {
      finalAnalysis = '解析：\n' + analysisText;
    }
    content.push({ text: finalAnalysis, style: 'analysis' });
  }
}

function addQuestionGap(content) {
  content.push({ text: '', margin: [0, 8, 0, 0] });
}
