import io
from datetime import datetime
from typing import List, Dict, Any, Optional

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
)
from reportlab.pdfgen import canvas


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to dynamically compute and render total page count
    in the format 'Page X of Y'.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_footer(num_pages)
            super().showPage()
        super().save()

    def draw_page_footer(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        
        # Bottom divider line
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(36, 32, 595.27 - 36, 32)
        
        # Left footer note
        self.drawString(36, 20, "Venner Hisab • Khatabook Ledger Statement")
        
        # Right footer page number
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(595.27 - 36, 20, page_text)
        self.restoreState()


def format_inr(val: float) -> str:
    """Format float into standard Indian Rupee notation string with 2 decimals."""
    if val is None:
        return "0.00"
    is_neg = val < 0
    val = abs(val)
    parts = f"{val:.2f}".split(".")
    integer_part = parts[0]
    decimal_part = parts[1]
    
    if len(integer_part) <= 3:
        formatted = integer_part
    else:
        last_three = integer_part[-3:]
        remaining = integer_part[:-3]
        groups = []
        while len(remaining) > 2:
            groups.insert(0, remaining[-2:])
            remaining = remaining[:-2]
        if remaining:
            groups.insert(0, remaining)
        groups.append(last_three)
        formatted = ",".join(groups)
    
    res = f"Rs. {formatted}.{decimal_part}"
    return f"-{res}" if is_neg else res


def generate_khatabook_ledger_pdf(
    account: Any,
    entries: List[Dict[str, Any]],
    period_title: str,
    summary: Dict[str, Any],
) -> bytes:
    """
    Generates a PDF bytes buffer containing the Khatabook ledger for an account.
    """
    buffer = io.BytesIO()
    
    # Page setup: A4 with 36pt (0.5 in) margins
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=45
    )

    styles = getSampleStyleSheet()

    # Custom styles
    brand_title_style = ParagraphStyle(
        'BrandTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#1E293B')
    )
    
    brand_sub_style = ParagraphStyle(
        'BrandSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#64748B')
    )

    report_title_style = ParagraphStyle(
        'ReportTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        alignment=2,  # Right aligned
        textColor=colors.HexColor('#4F46E5')
    )

    report_sub_style = ParagraphStyle(
        'ReportSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        alignment=2,  # Right aligned
        textColor=colors.HexColor('#64748B')
    )

    label_style = ParagraphStyle(
        'MetaLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#475569')
    )

    val_style = ParagraphStyle(
        'MetaVal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#0F172A')
    )

    th_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white
    )

    th_style_right = ParagraphStyle(
        'TableHeaderRight',
        parent=th_style,
        alignment=2
    )

    td_style_date = ParagraphStyle(
        'TableBodyDate',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#1E293B')
    )

    td_style_desc = ParagraphStyle(
        'TableBodyDesc',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#334155')
    )

    td_style_gave = ParagraphStyle(
        'TableBodyGave',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        alignment=2,
        textColor=colors.HexColor('#DC2626')
    )

    td_style_got = ParagraphStyle(
        'TableBodyGot',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        alignment=2,
        textColor=colors.HexColor('#16A34A')
    )

    td_style_bal = ParagraphStyle(
        'TableBodyBal',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        alignment=2,
        textColor=colors.HexColor('#1E293B')
    )

    elements = []

    # ── 1. Top Header Banner ──────────────────────────────────
    header_left = [
        Paragraph("<b>VENNER HISAB</b>", brand_title_style),
        Paragraph("Khatabook Multi-Account Statement & Ledger", brand_sub_style),
    ]
    
    now_str = datetime.now().strftime("%d %b %Y, %I:%M %p")
    header_right = [
        Paragraph("KHATABOOK LEDGER", report_title_style),
        Paragraph(f"Period: <b>{period_title}</b>", report_sub_style),
        Paragraph(f"Generated: {now_str}", report_sub_style),
    ]

    header_table = Table(
        [[header_left, header_right]],
        colWidths=[310, 213]
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 10))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#4F46E5'), spaceBefore=2, spaceAfter=10))

    # ── 2. Account Information Card ───────────────────────────
    acc_name = getattr(account, 'name', 'Customer Account')
    acc_holder = getattr(account, 'account_holder', None) or acc_name
    acc_bank = getattr(account, 'bank_name', 'General Ledger')
    acc_phone = getattr(account, 'phone_number', None) or "N/A"
    acc_masked = getattr(account, 'masked_account_number', None) or getattr(account, 'account_number', 'N/A')

    info_data = [
        [
            Paragraph("Account / Customer:", label_style),
            Paragraph(f"<b>{acc_name}</b> ({acc_holder})", val_style),
            Paragraph("Statement Period:", label_style),
            Paragraph(f"<b>{period_title}</b>", val_style),
        ],
        [
            Paragraph("Phone Number:", label_style),
            Paragraph(f"{acc_phone}", val_style),
            Paragraph("Bank / Reference:", label_style),
            Paragraph(f"{acc_bank} ({acc_masked})", val_style),
        ]
    ]

    info_table = Table(info_data, colWidths=[110, 160, 100, 153])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#E2E8F0')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#F1F5F9')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 10))

    # ── 3. Summary KPI Cards ───────────────────────────────────
    total_gave = summary.get("total_gave", 0.0)
    total_got = summary.get("total_got", 0.0)
    net_bal = summary.get("net_balance", 0.0)
    status_text = summary.get("status", "YOU'LL GET" if net_bal >= 0 else "YOU'LL GIVE")
    tx_count = summary.get("count", len(entries))

    status_bg = colors.HexColor('#DCFCE7') if net_bal >= 0 else colors.HexColor('#FFE4E6')
    status_border = colors.HexColor('#86EFAC') if net_bal >= 0 else colors.HexColor('#FDA4AF')
    status_color_hex = '#15803D' if net_bal >= 0 else '#B91C1C'

    kpi_card_1 = [
        Paragraph("TOTAL YOU GAVE (DEBIT)", ParagraphStyle('KpiTitle1', fontName='Helvetica-Bold', fontSize=7.5, textColor=colors.HexColor('#DC2626'))),
        Paragraph(f"<b>{format_inr(total_gave)}</b>", ParagraphStyle('KpiVal1', fontName='Helvetica-Bold', fontSize=11, textColor=colors.HexColor('#991B1B'))),
    ]

    kpi_card_2 = [
        Paragraph("TOTAL YOU GOT (CREDIT)", ParagraphStyle('KpiTitle2', fontName='Helvetica-Bold', fontSize=7.5, textColor=colors.HexColor('#16A34A'))),
        Paragraph(f"<b>{format_inr(total_got)}</b>", ParagraphStyle('KpiVal2', fontName='Helvetica-Bold', fontSize=11, textColor=colors.HexColor('#166534'))),
    ]

    kpi_card_3 = [
        Paragraph(f"NET CLOSING BALANCE • {status_text}", ParagraphStyle('KpiTitle3', fontName='Helvetica-Bold', fontSize=7.5, textColor=colors.HexColor(status_color_hex))),
        Paragraph(f"<b>{format_inr(abs(net_bal))}</b>", ParagraphStyle('KpiVal3', fontName='Helvetica-Bold', fontSize=11, textColor=colors.HexColor(status_color_hex))),
    ]

    kpi_table = Table(
        [[kpi_card_1, kpi_card_2, kpi_card_3]],
        colWidths=[170, 170, 183]
    )
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#FEF2F2')),
        ('BOX', (0, 0), (0, 0), 1, colors.HexColor('#FECACA')),
        ('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#F0FDF4')),
        ('BOX', (1, 0), (1, 0), 1, colors.HexColor('#BBF7D0')),
        ('BACKGROUND', (2, 0), (2, 0), status_bg),
        ('BOX', (2, 0), (2, 0), 1.5, status_border),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 12))

    # ── 4. Transactions Ledger Table ───────────────────────────
    # Columns: Date (85pt), Description (198pt), You Gave (80pt), You Got (80pt), Balance (80pt) -> Total 523pt
    table_data = [
        [
            Paragraph("DATE & TIME", th_style),
            Paragraph("DESCRIPTION / REMARKS", th_style),
            Paragraph("YOU GAVE (Rs.)", th_style_right),
            Paragraph("YOU GOT (Rs.)", th_style_right),
            Paragraph("BALANCE (Rs.)", th_style_right),
        ]
    ]

    if not entries:
        empty_p = Paragraph("<i>No transactions recorded for the selected period.</i>", td_style_desc)
        table_data.append([empty_p, "", "", "", ""])
    else:
        for idx, entry in enumerate(entries):
            d_time = entry.get("formatted_date_time") or entry.get("entry_date", "")
            desc_text = entry.get("description", "") or "—"
            gave_amt = entry.get("you_gave", 0.0)
            got_amt = entry.get("you_got", 0.0)
            bal_amt = entry.get("running_balance", 0.0)

            gave_str = format_inr(gave_amt) if gave_amt > 0 else "-"
            got_str = format_inr(got_amt) if got_amt > 0 else "-"
            bal_str = format_inr(bal_amt)

            table_data.append([
                Paragraph(str(d_time), td_style_date),
                Paragraph(str(desc_text), td_style_desc),
                Paragraph(gave_str, td_style_gave if gave_amt > 0 else td_style_desc),
                Paragraph(got_str, td_style_got if got_amt > 0 else td_style_desc),
                Paragraph(bal_str, td_style_bal),
            ])

    # Add Summary / Total Row
    tot_row = [
        Paragraph("<b>PERIOD TOTALS</b>", td_style_date),
        Paragraph(f"<b>{tx_count} Transactions</b>", td_style_desc),
        Paragraph(f"<b>{format_inr(total_gave)}</b>", td_style_gave),
        Paragraph(f"<b>{format_inr(total_got)}</b>", td_style_got),
        Paragraph(f"<b>{format_inr(abs(net_bal))}</b>", td_style_bal),
    ]
    table_data.append(tot_row)

    ledger_table = Table(
        table_data,
        colWidths=[90, 193, 80, 80, 80],
        repeatRows=1
    )

    t_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
    ]

    # Alternating row colors
    for r in range(1, len(table_data) - 1):
        if r % 2 == 0:
            t_style.append(('BACKGROUND', (0, r), (-1, r), colors.HexColor('#F8FAFC')))

    # Total row styling
    last_idx = len(table_data) - 1
    t_style.extend([
        ('BACKGROUND', (0, last_idx), (-1, last_idx), colors.HexColor('#F1F5F9')),
        ('LINEABOVE', (0, last_idx), (-1, last_idx), 1.5, colors.HexColor('#475569')),
        ('TOPPADDING', (0, last_idx), (-1, last_idx), 6),
        ('BOTTOMPADDING', (0, last_idx), (-1, last_idx), 6),
    ])

    ledger_table.setStyle(TableStyle(t_style))
    elements.append(ledger_table)

    # Build the document
    doc.build(elements, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.getvalue()
