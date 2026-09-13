import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Preformatted, PageBreak, HRFlowable, KeepTogether
)

SRC = "GUARDIAN_BACKEND_DOCUMENTATION.md"
OUT = "Guardian_Backend_Documentation.pdf"

DARK = colors.HexColor("#0f172a")
ACCENT = colors.HexColor("#059669")
GRAY = colors.HexColor("#475569")
LIGHT_BG = colors.HexColor("#f1f5f9")
CODE_BG = colors.HexColor("#0f172a")
CODE_FG = colors.HexColor("#e2e8f0")

styles = getSampleStyleSheet()

styles.add(ParagraphStyle(
    name="DocTitle", fontName="Helvetica-Bold", fontSize=26, leading=32,
    textColor=DARK, spaceAfter=6, alignment=TA_LEFT,
))
styles.add(ParagraphStyle(
    name="DocSubtitle", fontName="Helvetica", fontSize=11, leading=15,
    textColor=GRAY, spaceAfter=24,
))
styles.add(ParagraphStyle(
    name="H1", fontName="Helvetica-Bold", fontSize=18, leading=22,
    textColor=DARK, spaceBefore=22, spaceAfter=10,
))
styles.add(ParagraphStyle(
    name="H2", fontName="Helvetica-Bold", fontSize=13.5, leading=17,
    textColor=ACCENT, spaceBefore=14, spaceAfter=6,
))
styles.add(ParagraphStyle(
    name="H3", fontName="Helvetica-Bold", fontSize=11.5, leading=15,
    textColor=DARK, spaceBefore=10, spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="Body", fontName="Helvetica", fontSize=9.7, leading=14.5,
    textColor=DARK, spaceAfter=7, alignment=TA_LEFT,
))
styles.add(ParagraphStyle(
    name="BulletItem", fontName="Helvetica", fontSize=9.7, leading=14,
    textColor=DARK, spaceAfter=4, leftIndent=14, bulletIndent=4,
))
styles.add(ParagraphStyle(
    name="CodeBlock", fontName="Courier", fontSize=8.3, leading=11.5,
    textColor=CODE_FG, backColor=CODE_BG, borderPadding=8,
))
styles.add(ParagraphStyle(
    name="TableCell", fontName="Helvetica", fontSize=8.6, leading=11.5, textColor=DARK,
))
styles.add(ParagraphStyle(
    name="TableHeader", fontName="Helvetica-Bold", fontSize=8.8, leading=11.5, textColor=colors.white,
))


EMOJI_LABELS = {
    "\U0001F7E0": "[MOYEN] ",   # orange circle
    "\U0001F7E1": "[FAIBLE] ",  # yellow circle
    "\U0001F7E2": "[OK] ",      # green circle
}

BOX_DRAWING = str.maketrans({
    "│": "|", "├": "+", "└": "+", "─": "-", "┌": "+", "┐": "+", "┘": "+", "┬": "+", "┴": "+", "┼": "+",
})


def strip_emoji(text):
    for emoji, label in EMOJI_LABELS.items():
        text = text.replace(emoji, label)
    return text


def inline(text):
    text = strip_emoji(text)
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = re.sub(r"&lt;br&gt;", "<br/>", text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"`([^`]+)`", r'<font face="Courier" size="8.6" color="#0f172a" backColor="#e2e8f0"> \1 </font>', text)
    return text


def parse_table(lines):
    rows = []
    for line in lines:
        if re.match(r"^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$", line.strip()):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        rows.append(cells)
    return rows


def build_table(rows, col_widths=None):
    data = []
    for i, row in enumerate(rows):
        style = "TableHeader" if i == 0 else "TableCell"
        data.append([Paragraph(inline(c), styles[style]) for c in row])
    n_cols = len(rows[0])
    if col_widths is None:
        avail = 17.2 * cm
        col_widths = [avail / n_cols] * n_cols
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), DARK),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def main():
    with open(SRC, "r", encoding="utf-8") as f:
        text = f.read()

    lines = text.split("\n")
    story = []
    i = 0
    first_h1 = True

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped == "" :
            i += 1
            continue

        if stripped == "---":
            story.append(Spacer(1, 4))
            i += 1
            continue

        if stripped.startswith("```"):
            i += 1
            code_lines = []
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            i += 1
            code_text = "\n".join(code_lines).translate(BOX_DRAWING)
            story.append(Preformatted(code_text, styles["CodeBlock"]))
            story.append(Spacer(1, 8))
            continue

        if stripped.startswith("### "):
            story.append(Paragraph(inline(stripped[4:].strip()), styles["H3"]))
            i += 1
            continue

        if stripped.startswith("## "):
            story.append(Paragraph(inline(stripped[3:].strip()), styles["H2"]))
            i += 1
            continue

        if stripped.startswith("# "):
            title = stripped[2:].strip()
            if first_h1:
                story.append(Paragraph(inline(title), styles["DocTitle"]))
                story.append(Paragraph(
                    "Documentation technique complète — architecture, packages, flux, tests, audit de sécurité",
                    styles["DocSubtitle"],
                ))
                first_h1 = False
            else:
                story.append(HRFlowable(width="100%", thickness=1.2, color=ACCENT, spaceBefore=4, spaceAfter=2))
                story.append(Paragraph(inline(title), styles["H1"]))
            i += 1
            continue

        if stripped.startswith("|"):
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i])
                i += 1
            rows = parse_table(table_lines)
            if rows:
                story.append(build_table(rows))
                story.append(Spacer(1, 10))
            continue

        if stripped.startswith("- "):
            item_lines = []
            while i < len(lines) and lines[i].strip().startswith("- "):
                item_lines.append(lines[i].strip()[2:])
                i += 1
            for item in item_lines:
                story.append(Paragraph("&bull;&nbsp;&nbsp;" + inline(item), styles["BulletItem"]))
            story.append(Spacer(1, 4))
            continue

        if re.match(r"^\d+\.\s", stripped):
            item_lines = []
            while i < len(lines) and re.match(r"^\d+\.\s", lines[i].strip()):
                item_lines.append(lines[i].strip())
                i += 1
            for item in item_lines:
                num, rest = item.split(".", 1)
                story.append(Paragraph(f"{num}.&nbsp;&nbsp;" + inline(rest.strip()), styles["BulletItem"]))
            story.append(Spacer(1, 4))
            continue

        para_lines = [stripped]
        i += 1
        while i < len(lines) and lines[i].strip() != "" and not lines[i].strip().startswith(("#", "-", "|", "```", "---")) and not re.match(r"^\d+\.\s", lines[i].strip()):
            para_lines.append(lines[i].strip())
            i += 1
        story.append(Paragraph(inline(" ".join(para_lines)), styles["Body"]))

    doc = SimpleDocTemplate(
        OUT, pagesize=A4,
        leftMargin=2.0 * cm, rightMargin=2.0 * cm,
        topMargin=1.8 * cm, bottomMargin=1.8 * cm,
        title="Guardian — Documentation technique du backend",
        author="Guardian Project",
    )

    def on_page(canvas, doc_):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(GRAY)
        canvas.drawString(2.0 * cm, 1.2 * cm, "Guardian — Documentation backend")
        canvas.drawRightString(A4[0] - 2.0 * cm, 1.2 * cm, f"Page {doc_.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
