"""
Mise en page PDF (reportlab, pur Python) : équivalent serveur de printDoc() du front.

En-tête (titre, organisme, date de génération, auteur, normes actives), tableaux à
en-tête répété, pagination « Page n / N » en pied de page.
"""

import io
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

BRAND = colors.HexColor("#17693F")
INK = colors.HexColor("#15201A")
MUTED = colors.HexColor("#6D7772")
LINE = colors.HexColor("#D5DBD7")
HEAD = colors.HexColor("#E6F2EB")

_base = getSampleStyleSheet()
STYLES = {
    "title": ParagraphStyle("t", parent=_base["Title"], fontSize=16, leading=20, alignment=0, textColor=INK),
    "meta": ParagraphStyle("m", parent=_base["Normal"], fontSize=8.5, leading=11, textColor=MUTED),
    "meta_r": ParagraphStyle(
        "mr", parent=_base["Normal"], fontSize=8.5, leading=11, textColor=MUTED, alignment=TA_RIGHT
    ),
    "h2": ParagraphStyle(
        "h2", parent=_base["Heading2"], fontSize=12, leading=15, textColor=BRAND, spaceBefore=10
    ),
    "body": ParagraphStyle("b", parent=_base["Normal"], fontSize=9.5, leading=13, textColor=INK),
    "cell": ParagraphStyle("c", parent=_base["Normal"], fontSize=8, leading=10, textColor=INK),
    "th": ParagraphStyle("th", parent=_base["Normal"], fontSize=8, leading=10, fontName="Helvetica-Bold"),
}

# Les polices standard PDF sont en WinAnsi (cp1252) : remplacements des autres caractères.
_SUBST = {"→": "->", "←": "<-", "≥": ">=", "≤": "<=", "≠": "!=", "‑": "-", " ": " ", "✓": "OK"}


def clean(text) -> str:
    s = "" if text is None else str(text)
    out = []
    for ch in s:
        ch = _SUBST.get(ch, ch)
        try:
            ch.encode("cp1252")
        except UnicodeEncodeError:
            ch = "?"
        out.append(ch)
    return "".join(out)


def para(text, style="body") -> Paragraph:
    return Paragraph(escape(clean(text)).replace("\n", "<br/>"), STYLES[style])


def h2(text) -> Paragraph:
    return para(text, "h2")


def bullets(items) -> ListFlowable:
    return ListFlowable(
        [ListItem(para(i), leftIndent=12) for i in items], bulletType="1", leftIndent=14, bulletFontSize=9
    )


def _widths(headers, rows, width: float) -> list[float]:
    """
    Largeurs de colonnes : chacune reçoit au moins la largeur de son mot le plus long
    (pour ne pas couper « Probabilité » en deux), le reste est réparti selon la longueur
    moyenne du contenu.
    """
    pad = 14  # marges internes des cellules (6 pt de chaque côté) + tolérance
    mins, avgs = [], []
    for i, h in enumerate(headers):
        head_words = [stringWidth(clean(w), "Helvetica-Bold", 8) for w in str(h).split()]
        cell_words = [stringWidth(clean(w), "Helvetica", 8) for r in rows for w in str(r[i]).split()]
        mins.append(min(max(head_words + cell_words + [12]) + pad, width * 0.3))
        cells = [str(h)] + [str(r[i]) for r in rows]
        avgs.append(sum(min(len(c), 120) for c in cells) / len(cells))
    free = width - sum(mins)
    if free <= 0:
        return [width * m / sum(mins) for m in mins]
    total = sum(avgs) or 1
    return [m + free * a / total for m, a in zip(mins, avgs, strict=True)]


def table(headers, rows, width: float, weights=None) -> Table:
    """Tableau à en-tête répété ; largeurs proportionnelles au contenu (ou à `weights`)."""
    widths = _widths(headers, rows, width) if not weights else [width * w / sum(weights) for w in weights]
    data = [[para(h, "th") for h in headers]] + [[para(c, "cell") for c in r] for r in rows]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), HEAD),
                ("GRID", (0, 0), (-1, -1), 0.5, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    return t


def key_values(rows, width: float) -> Table:
    """Fiche « libellé : valeur »."""
    t = Table(
        [[para(k, "th"), para(v, "cell")] for k, v in rows],
        colWidths=[width * 0.28, width * 0.72],
    )
    t.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, LINE),
                ("BACKGROUND", (0, 0), (0, -1), HEAD),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return t


class _NumberedCanvas(rl_canvas.Canvas):
    """Canvas à deux passes : « Page n / N » en pied de page."""

    footer_left = ""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved = []

    def showPage(self):  # noqa: N802 (API reportlab)
        self._saved.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._saved)
        for state in self._saved:
            self.__dict__.update(state)
            w, _ = self._pagesize
            self.setFont("Helvetica", 7.5)
            self.setFillColor(MUTED)
            self.setStrokeColor(LINE)
            self.line(15 * mm, 12 * mm, w - 15 * mm, 12 * mm)
            self.drawString(15 * mm, 8 * mm, clean(self.footer_left))
            self.drawRightString(w - 15 * mm, 8 * mm, f"Page {self._pageNumber} / {total}")
            super().showPage()
        super().save()


class Document:
    """
    Document PDF de la plateforme :

        doc = Document("PV RD-2026-S1", org, user, stamp="21 sept. 2026")
        doc.add(h2("Ordre du jour"), bullets([...]))
        pdf_bytes = doc.render()
    """

    def __init__(self, title: str, org, user, stamp: str, wide: bool = False):
        self.title = title
        self.org = org
        self.user = user
        self.stamp = stamp
        self.pagesize = landscape(A4) if wide else A4
        self.width = self.pagesize[0] - 30 * mm
        self.story = [self._header()]

    def _header(self) -> Table:
        norms = " · ".join(f"ISO {n}" for n in (self.org.active_norms or []))
        left = [
            para(self.title, "title"),
            para(f"{self.org.nom} — généré le {self.stamp} par {self.user.nom or self.user.email}", "meta"),
        ]
        right = [para("Système de Management intégré", "meta_r"), para(norms, "meta_r")]
        t = Table([[left, right]], colWidths=[self.width * 0.68, self.width * 0.32])
        t.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LINEBELOW", (0, 0), (-1, -1), 1.5, BRAND),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        return t

    def add(self, *flowables):
        for f in flowables:
            self.story.append(f)
        return self

    def spacer(self, h=4):
        self.story.append(Spacer(1, h * mm))
        return self

    def render(self) -> bytes:
        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=self.pagesize,
            leftMargin=15 * mm,
            rightMargin=15 * mm,
            topMargin=14 * mm,
            bottomMargin=18 * mm,
            title=clean(self.title),
            author=clean(self.org.nom),
            creator="SM Intégré",
        )
        footer = f"{self.org.nom} — {self.title}"
        canvas_cls = type("Canvas", (_NumberedCanvas,), {"footer_left": footer})
        doc.build(self.story, canvasmaker=canvas_cls)
        return buf.getvalue()
