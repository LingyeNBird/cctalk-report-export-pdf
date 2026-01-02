import argparse
import hashlib
import json
import os
import re
import urllib.request
from html.parser import HTMLParser
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer


class HTMLToText(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in {"br", "p", "div", "li"}:
            self.parts.append("\n")
        elif tag == "img":
            src = ""
            alt = ""
            for k, v in attrs:
                if k == "src":
                    src = v
                elif k == "alt":
                    alt = v
            label = alt or src
            if label:
                self.parts.append(f"[图片: {label}]")
                self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"p", "div", "li"}:
            self.parts.append("\n")

    def handle_data(self, data):
        self.parts.append(data)


def html_to_text(html: str) -> str:
    parser = HTMLToText()
    parser.feed(html or "")
    text = "".join(parser.parts)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n[ \t]+", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def pick_cjk_font() -> str:
    candidates = [
        ("MicrosoftYaHei", r"C:\Windows\Fonts\msyh.ttc", 0),
        ("MicrosoftYaHeiUI", r"C:\Windows\Fonts\msyh.ttc", 1),
        ("SimSun", r"C:\Windows\Fonts\simsun.ttc", 0),
        ("SimHei", r"C:\Windows\Fonts\simhei.ttf", None),
    ]
    for name, path, idx in candidates:
        if not os.path.exists(path):
            continue
        try:
            if idx is None:
                pdfmetrics.registerFont(TTFont(name, path))
            else:
                pdfmetrics.registerFont(TTFont(name, path, subfontIndex=idx))
            return name
        except Exception:
            continue
    return "Helvetica"


def to_paragraph_text(text: str) -> str:
    return escape(text).replace("\n", "<br/>")


def build_styles(font_name: str):
    styles = getSampleStyleSheet()
    base = ParagraphStyle(
        "Base",
        parent=styles["Normal"],
        fontName=font_name,
        fontSize=10.5,
        leading=15,
        spaceAfter=2,
    )
    styles.add(
        ParagraphStyle(
            "DocTitle",
            parent=base,
            fontSize=18,
            leading=24,
            alignment=TA_LEFT,
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            "SectionTitle",
            parent=base,
            fontSize=14,
            leading=18,
            spaceBefore=12,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            "Question",
            parent=base,
            fontSize=11.5,
            leading=16,
            spaceBefore=8,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            "Option",
            parent=base,
            leftIndent=12,
            spaceBefore=1,
            spaceAfter=1,
        )
    )
    styles.add(
        ParagraphStyle(
            "AnalysisLabel",
            parent=base,
            spaceBefore=4,
            spaceAfter=2,
        )
    )
    styles.add(
        ParagraphStyle(
            "Analysis",
            parent=base,
            leftIndent=12,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            "AnalysisBox",
            parent=base,
            borderWidth=0.6,
            borderColor=colors.HexColor("#9AA0A6"),
            borderPadding=6,
            borderRadius=2,
            spaceBefore=4,
            spaceAfter=8,
        )
    )
    return styles


def split_text_with_images(text: str):
    pattern = re.compile(r"\[图片:\s*(.*?)\]")
    parts = []
    pos = 0
    for match in pattern.finditer(text):
        if match.start() > pos:
            parts.append(("text", text[pos:match.start()]))
        parts.append(("image", match.group(1)))
        pos = match.end()
    if pos < len(text):
        parts.append(("text", text[pos:]))
    return parts


def normalize_image_target(value: str) -> str:
    return re.sub(r"\s+", "", value or "")


def download_image(url: str, cache_dir: str, image_cache: dict) -> str:
    if url in image_cache:
        return image_cache[url]
    os.makedirs(cache_dir, exist_ok=True)
    ext = os.path.splitext(url.split("?")[0])[1]
    if not ext:
        ext = ".img"
    name = hashlib.sha1(url.encode("utf-8")).hexdigest() + ext
    path = os.path.join(cache_dir, name)
    if os.path.exists(path) and os.path.getsize(path) > 0:
        image_cache[url] = path
        return path
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = resp.read()
        with open(path, "wb") as f:
            f.write(data)
        image_cache[url] = path
        return path
    except Exception:
        return ""


def add_rich_text(story, styles, text, style_name, image_cache, cache_dir, max_width):
    for kind, value in split_text_with_images(text):
        if kind == "text":
            if value.strip():
                story.append(Paragraph(to_paragraph_text(value), styles[style_name]))
            continue
        target = normalize_image_target(value)
        if target.startswith("http://") or target.startswith("https://"):
            image_path = download_image(target, cache_dir, image_cache)
            if image_path:
                img = Image(image_path)
                if img.imageWidth > max_width:
                    ratio = max_width / img.imageWidth
                    img.drawWidth = img.imageWidth * ratio
                    img.drawHeight = img.imageHeight * ratio
                story.append(img)
                story.append(Spacer(1, 2 * mm))
                continue
        story.append(Paragraph(to_paragraph_text(f"[图片: {value}]"), styles[style_name]))


def add_question_gap(story, styles):
    story.append(Spacer(1, styles["Question"].leading * 2))


def format_option_text(line: str, is_correct: bool) -> str:
    escaped = escape(line)
    if is_correct:
        return f'<font color="#1B8A3B">{escaped}</font>'
    return escaped


def add_question(story, styles, question, image_cache, cache_dir, max_width):
    seq = question.get("sequence") or question.get("questionId") or ""
    content_html = question.get("questionContent", {}).get("text", "")
    content_text = html_to_text(content_html) or question.get("title", "")
    if seq:
        header = f"{seq}. {content_text}"
    else:
        header = content_text
    if header:
        add_rich_text(story, styles, header, "Question", image_cache, cache_dir, max_width)

    options = question.get("options") or []
    answers = {a.get("text", "").strip() for a in question.get("standardAnswer") or []}
    for opt in options:
        value = opt.get("value", "").strip()
        opt_text = html_to_text(opt.get("text", ""))
        line = f"{value}. {opt_text}".strip()
        story.append(
            Paragraph(format_option_text(line, value in answers), styles["Option"])
        )

    analysis_html = question.get("analysis", {}).get("text", "")
    analysis_text = html_to_text(analysis_html)
    if analysis_text:
        needs_label = not re.match(r"^\s*\d*\s*\.?\s*解析", analysis_text)
        if needs_label:
            analysis_text = f"解析：\n{analysis_text}"
        story.append(Paragraph(to_paragraph_text(analysis_text), styles["AnalysisBox"]))


def build_pdf(data: dict, output_path: str) -> None:
    font_name = pick_cjk_font()
    styles = build_styles(font_name)

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
    )
    story = []
    image_cache = {}
    cache_dir = os.path.join(os.path.dirname(output_path) or ".", ".image_cache")
    max_width = doc.width

    title = data.get("title") or "题目与解析"
    story.append(Paragraph(to_paragraph_text(title), styles["DocTitle"]))

    for section in data.get("sections") or []:
        section_title = section.get("title")
        if section_title:
            story.append(Paragraph(to_paragraph_text(section_title), styles["SectionTitle"]))

        questions = section.get("questions") or []
        for idx, q in enumerate(questions):
            if q.get("subQuestions"):
                stem = html_to_text(q.get("questionContent", {}).get("text", "")) or q.get(
                    "title", ""
                )
                if stem:
                    add_rich_text(
                        story,
                        styles,
                        f"材料：{stem}",
                        "Question",
                        image_cache,
                        cache_dir,
                        max_width,
                    )
                sub_questions = q.get("subQuestions") or []
                for sub_idx, sub in enumerate(sub_questions):
                    add_question(story, styles, sub, image_cache, cache_dir, max_width)
                    if sub_idx < len(sub_questions) - 1:
                        add_question_gap(story, styles)
                if idx < len(questions) - 1:
                    add_question_gap(story, styles)
                continue
            add_question(story, styles, q, image_cache, cache_dir, max_width)
            if idx < len(questions) - 1:
                add_question_gap(story, styles)

    doc.build(story)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate PDF from paper_report.json")
    parser.add_argument("input", nargs="?", default="paper_report.json")
    parser.add_argument("output", nargs="?", default="paper_report.pdf")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        payload = json.load(f)
    data = payload.get("data") or payload
    build_pdf(data, args.output)
    print(f"PDF written to: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
