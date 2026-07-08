import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import PptxGenJS from "pptxgenjs";

import {
  INSIGHTS,
  KPIS,
  OPTIMIZED_ROUTE,
  NAIVE_ROUTE,
} from "@/lib/warehouse-data";

export type ExportFormat = "pdf" | "csv" | "pptx";

export interface ExportSections {
  executiveSummary: boolean;
  kpis: boolean;
  aiRecommendations: boolean;
  slottingRecommendations: boolean;
  pickingRoute: boolean;
}

// FulfillAI brand palette
const BRAND = {
  primary: "#183B6B",
  accent: "#10B981",
  ink: "#0B1220",
  muted: "#5B6472",
  soft: "#F1F5F9",
};

const REPORT_META = {
  title: "Warehouse Optimization Report",
  facility: "Reno DC-04",
  brand: "FulfillAI",
  tagline: "Every warehouse decision, optimized.",
};

const EXECUTIVE_SUMMARY = [
  "FulfillAI ran a full optimization pass across Reno DC-04, spanning slotting, routing, and labor allocation.",
  "The current picking model reduces travel distance by 33% and pick time by 36% vs. the pre-optimization baseline, unlocking an estimated $1,420/day in labor savings across the picking team.",
  "Slotting adjustments across three high-velocity SKUs cut 2.4 miles of daily walking. Wave 3 batching lifts throughput by 31% with an 18-minute completion reduction.",
  "No capital expenditure is required to capture these gains — the model deploys directly to the floor via the existing WMS.",
];

const SLOTTING_RECS = [
  { sku: "SKU-K7B", from: "Aisle K · Zone C", to: "Aisle B · Zone A", impact: "−2.4 mi/day walk", savings: "$1,820 / mo" },
  { sku: "SKU-F1A", from: "Aisle F · Zone B", to: "Aisle C · Zone A", impact: "+9% pick rate", savings: "$940 / mo" },
  { sku: "SKU-H3A", from: "Aisle H · Zone C", to: "Aisle D · Zone B", impact: "−14% travel", savings: "$620 / mo" },
];

function today() {
  return new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fileStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ============================================================
 * PDF
 * ==========================================================*/
function generatePdf(sections: ExportSections): Blob {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = 0;

  const drawHeader = () => {
    // Brand band
    doc.setFillColor(BRAND.primary);
    doc.rect(0, 0, pageW, 88, "F");
    doc.setFillColor(BRAND.accent);
    doc.rect(0, 88, pageW, 3, "F");

    // Logo mark
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, 22, 42, 42, 8, 8, "F");
    doc.setTextColor(BRAND.primary);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("F", margin + 15, 52);

    // Wordmark
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(REPORT_META.brand, margin + 58, 45);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(200, 220, 255);
    doc.text("DECISION INTELLIGENCE", margin + 58, 60);

    // Right meta
    doc.setFontSize(9);
    doc.setTextColor(210, 225, 245);
    doc.text(`Generated ${today()}`, pageW - margin, 45, { align: "right" });
    doc.text(REPORT_META.facility, pageW - margin, 60, { align: "right" });

    y = 130;
  };

  const drawFooter = (pageNum: number, pageCount: number) => {
    doc.setDrawColor(220);
    doc.line(margin, pageH - 44, pageW - margin, pageH - 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `${REPORT_META.brand}  ·  Confidential — For internal ops review`,
      margin,
      pageH - 28,
    );
    doc.text(`Page ${pageNum} of ${pageCount}`, pageW - margin, pageH - 28, { align: "right" });
  };

  const sectionTitle = (label: string) => {
    if (y > pageH - 140) {
      doc.addPage();
      drawHeader();
    }
    doc.setFillColor(BRAND.accent);
    doc.rect(margin, y - 10, 3, 16, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(BRAND.ink);
    doc.text(label, margin + 12, y + 2);
    y += 22;
  };

  const paragraph = (text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(60);
    const lines = doc.splitTextToSize(text, pageW - margin * 2);
    if (y + lines.length * 14 > pageH - 60) {
      doc.addPage();
      drawHeader();
    }
    doc.text(lines, margin, y);
    y += lines.length * 14 + 6;
  };

  drawHeader();

  // Report title card
  doc.setFillColor(BRAND.soft);
  doc.roundedRect(margin, y, pageW - margin * 2, 82, 10, 10, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(BRAND.ink);
  doc.text(REPORT_META.title, margin + 20, y + 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(BRAND.muted);
  doc.text(
    `${REPORT_META.facility}  ·  ${REPORT_META.tagline}`,
    margin + 20,
    y + 54,
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(BRAND.accent);
  doc.text("OPTIMIZATION SNAPSHOT", margin + 20, y + 72);
  y += 110;

  if (sections.executiveSummary) {
    sectionTitle("Executive Summary");
    EXECUTIVE_SUMMARY.forEach(paragraph);
    y += 8;
  }

  if (sections.kpis) {
    sectionTitle("Optimization KPIs");
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Metric", "Value", "Change"]],
      body: KPIS.map((k) => [k.label, `${k.value}${k.unit}`, k.delta]),
      styles: { font: "helvetica", fontSize: 10, cellPadding: 8 },
      headStyles: { fillColor: BRAND.primary, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      columnStyles: { 2: { textColor: [16, 129, 90], fontStyle: "bold" } },
    });
    // @ts-expect-error jspdf-autotable adds this
    y = (doc.lastAutoTable?.finalY ?? y) + 20;
  }

  if (sections.aiRecommendations) {
    sectionTitle("AI Recommendations");
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Priority", "Recommendation", "Detail", "Impact"]],
      body: INSIGHTS.map((i) => [
        i.severity === "warning" ? "High" : i.severity === "opportunity" ? "High" : "Info",
        i.title,
        i.detail,
        i.impact,
      ]),
      styles: { font: "helvetica", fontSize: 9.5, cellPadding: 7, valign: "top" },
      headStyles: { fillColor: BRAND.primary, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: "bold" },
        1: { cellWidth: 140, fontStyle: "bold" },
        3: { cellWidth: 85, textColor: [16, 129, 90], fontStyle: "bold" },
      },
    });
    // @ts-expect-error jspdf-autotable adds this
    y = (doc.lastAutoTable?.finalY ?? y) + 20;
  }

  if (sections.slottingRecommendations) {
    sectionTitle("Slotting Recommendations");
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["SKU", "From", "To", "Impact", "Savings"]],
      body: SLOTTING_RECS.map((s) => [s.sku, s.from, s.to, s.impact, s.savings]),
      styles: { font: "helvetica", fontSize: 10, cellPadding: 7 },
      headStyles: { fillColor: BRAND.primary, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 248, 252] },
      columnStyles: {
        0: { fontStyle: "bold" },
        4: { textColor: [16, 129, 90], fontStyle: "bold" },
      },
    });
    // @ts-expect-error jspdf-autotable adds this
    y = (doc.lastAutoTable?.finalY ?? y) + 20;
  }

  if (sections.pickingRoute) {
    sectionTitle("Optimized Picking Route");
    paragraph(
      `The optimizer produced a ${OPTIMIZED_ROUTE.length}-waypoint route across the pick face, ` +
        `replacing the naive ${NAIVE_ROUTE.length}-waypoint tour. Travel distance drops from 17.8 km ` +
        `to 11.9 km per wave, recovering 38.5 hours/day of labor across the picking team.`,
    );
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Step", "X (m)", "Y (m)", "Segment"]],
      body: OPTIMIZED_ROUTE.map(([x, ry], i) => [
        String(i + 1),
        String(x),
        String(ry),
        i === 0
          ? "Dock start"
          : i === OPTIMIZED_ROUTE.length - 1
            ? "Return to dock"
            : `Waypoint ${i}`,
      ]),
      styles: { font: "helvetica", fontSize: 9.5, cellPadding: 6 },
      headStyles: { fillColor: BRAND.primary, textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 248, 252] },
    });
  }

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(p, total);
  }

  return doc.output("blob");
}

/* ============================================================
 * CSV
 * ==========================================================*/
function csvEscape(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function csvRow(cells: Array<string | number>): string {
  return cells.map(csvEscape).join(",");
}

function generateCsv(sections: ExportSections): Blob {
  const lines: string[] = [];
  lines.push(`# ${REPORT_META.brand} — ${REPORT_META.title}`);
  lines.push(`# Facility,${REPORT_META.facility}`);
  lines.push(`# Generated,${today()}`);
  lines.push("");

  if (sections.executiveSummary) {
    lines.push("## Executive Summary");
    EXECUTIVE_SUMMARY.forEach((p) => lines.push(csvRow([p])));
    lines.push("");
  }
  if (sections.kpis) {
    lines.push("## Optimization KPIs");
    lines.push(csvRow(["Metric", "Value", "Unit", "Change"]));
    KPIS.forEach((k) => lines.push(csvRow([k.label, k.value, k.unit, k.delta])));
    lines.push("");
  }
  if (sections.aiRecommendations) {
    lines.push("## AI Recommendations");
    lines.push(csvRow(["Severity", "Title", "Detail", "Impact"]));
    INSIGHTS.forEach((i) =>
      lines.push(csvRow([i.severity, i.title, i.detail, i.impact])),
    );
    lines.push("");
  }
  if (sections.slottingRecommendations) {
    lines.push("## Slotting Recommendations");
    lines.push(csvRow(["SKU", "From", "To", "Impact", "Savings"]));
    SLOTTING_RECS.forEach((s) =>
      lines.push(csvRow([s.sku, s.from, s.to, s.impact, s.savings])),
    );
    lines.push("");
  }
  if (sections.pickingRoute) {
    lines.push("## Optimized Picking Route");
    lines.push(csvRow(["Step", "X (m)", "Y (m)", "Segment"]));
    OPTIMIZED_ROUTE.forEach(([x, ry], i) =>
      lines.push(
        csvRow([
          i + 1,
          x,
          ry,
          i === 0
            ? "Dock start"
            : i === OPTIMIZED_ROUTE.length - 1
              ? "Return to dock"
              : `Waypoint ${i}`,
        ]),
      ),
    );
  }

  return new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
}

/* ============================================================
 * PowerPoint
 * ==========================================================*/
async function generatePptx(sections: ExportSections): Promise<Blob> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 × 7.5
  pptx.title = REPORT_META.title;
  pptx.company = REPORT_META.brand;

  const brandNavy = BRAND.primary.replace("#", "");
  const brandGreen = BRAND.accent.replace("#", "");
  const ink = BRAND.ink.replace("#", "");
  const muted = BRAND.muted.replace("#", "");

  const addBrandBar = (slide: PptxGenJS.Slide) => {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 13.33, h: 0.45, fill: { color: brandNavy },
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0.45, w: 13.33, h: 0.05, fill: { color: brandGreen },
    });
    slide.addText("FulfillAI", {
      x: 0.4, y: 0.05, w: 3, h: 0.35,
      fontFace: "Calibri", fontSize: 14, bold: true, color: "FFFFFF",
    });
    slide.addText(REPORT_META.facility, {
      x: 10, y: 0.05, w: 3, h: 0.35, align: "right",
      fontFace: "Calibri", fontSize: 10, color: "CADCFC",
    });
  };

  const addFooter = (slide: PptxGenJS.Slide) => {
    slide.addText(`${REPORT_META.brand}  ·  Confidential — For internal ops review`, {
      x: 0.4, y: 7.05, w: 8, h: 0.3,
      fontFace: "Calibri", fontSize: 9, color: muted,
    });
    slide.addText(today(), {
      x: 10, y: 7.05, w: 2.9, h: 0.3, align: "right",
      fontFace: "Calibri", fontSize: 9, color: muted,
    });
  };

  // Cover
  const cover = pptx.addSlide();
  cover.background = { color: brandNavy };
  cover.addShape(pptx.ShapeType.rect, {
    x: 0, y: 6.9, w: 13.33, h: 0.15, fill: { color: brandGreen },
  });
  cover.addText("FulfillAI", {
    x: 0.7, y: 0.7, w: 5, h: 0.5,
    fontFace: "Calibri", fontSize: 20, bold: true, color: "FFFFFF",
  });
  cover.addText("DECISION INTELLIGENCE", {
    x: 0.7, y: 1.15, w: 5, h: 0.3,
    fontFace: "Calibri", fontSize: 11, color: "CADCFC", charSpacing: 4,
  });
  cover.addText(REPORT_META.title, {
    x: 0.7, y: 2.6, w: 12, h: 1.4,
    fontFace: "Calibri", fontSize: 44, bold: true, color: "FFFFFF",
  });
  cover.addText(REPORT_META.tagline, {
    x: 0.7, y: 4.1, w: 12, h: 0.6,
    fontFace: "Calibri", fontSize: 20, italic: true, color: "CADCFC",
  });
  cover.addText(
    [
      { text: "Facility: ", options: { bold: true, color: "FFFFFF" } },
      { text: `${REPORT_META.facility}    `, options: { color: "CADCFC" } },
      { text: "Generated: ", options: { bold: true, color: "FFFFFF" } },
      { text: today(), options: { color: "CADCFC" } },
    ],
    {
      x: 0.7, y: 6.1, w: 12, h: 0.4,
      fontFace: "Calibri", fontSize: 12,
    },
  );

  if (sections.executiveSummary) {
    const s = pptx.addSlide();
    addBrandBar(s);
    s.addText("Executive Summary", {
      x: 0.5, y: 0.75, w: 12, h: 0.6,
      fontFace: "Calibri", fontSize: 30, bold: true, color: ink,
    });
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.35, w: 0.6, h: 0.08, fill: { color: brandGreen },
    });
    s.addText(
      EXECUTIVE_SUMMARY.map((p) => ({ text: p, options: { bullet: { code: "25CF" }, paraSpaceAfter: 10 } })),
      {
        x: 0.6, y: 1.8, w: 12.2, h: 5,
        fontFace: "Calibri", fontSize: 18, color: ink, valign: "top",
      },
    );
    addFooter(s);
  }

  if (sections.kpis) {
    const s = pptx.addSlide();
    addBrandBar(s);
    s.addText("Optimization KPIs", {
      x: 0.5, y: 0.75, w: 12, h: 0.6,
      fontFace: "Calibri", fontSize: 30, bold: true, color: ink,
    });
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.35, w: 0.6, h: 0.08, fill: { color: brandGreen },
    });
    // Big-stat callouts
    const cardW = 2.9;
    const gap = 0.25;
    const totalW = cardW * 4 + gap * 3;
    const startX = (13.33 - totalW) / 2;
    KPIS.forEach((k, i) => {
      const x = startX + i * (cardW + gap);
      s.addShape(pptx.ShapeType.roundRect, {
        x, y: 1.9, w: cardW, h: 2.4,
        fill: { color: "F1F5F9" }, line: { color: "E2E8F0", width: 1 }, rectRadius: 0.12,
      });
      s.addText(k.label.toUpperCase(), {
        x, y: 2.05, w: cardW, h: 0.35, align: "center",
        fontFace: "Calibri", fontSize: 11, bold: true, color: muted, charSpacing: 2,
      });
      s.addText(k.value, {
        x, y: 2.4, w: cardW, h: 1.2, align: "center",
        fontFace: "Calibri", fontSize: 60, bold: true, color: ink,
      });
      s.addText(k.unit, {
        x, y: 3.55, w: cardW, h: 0.3, align: "center",
        fontFace: "Calibri", fontSize: 13, color: muted,
      });
      s.addText(k.delta, {
        x, y: 3.85, w: cardW, h: 0.4, align: "center",
        fontFace: "Calibri", fontSize: 15, bold: true, color: brandGreen,
      });
    });
    addFooter(s);
  }

  if (sections.aiRecommendations) {
    const s = pptx.addSlide();
    addBrandBar(s);
    s.addText("AI Recommendations", {
      x: 0.5, y: 0.75, w: 12, h: 0.6,
      fontFace: "Calibri", fontSize: 30, bold: true, color: ink,
    });
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.35, w: 0.6, h: 0.08, fill: { color: brandGreen },
    });
    const rows: PptxGenJS.TableRow[] = [
      [
        { text: "Priority", options: { bold: true, color: "FFFFFF", fill: { color: brandNavy } } },
        { text: "Recommendation", options: { bold: true, color: "FFFFFF", fill: { color: brandNavy } } },
        { text: "Detail", options: { bold: true, color: "FFFFFF", fill: { color: brandNavy } } },
        { text: "Impact", options: { bold: true, color: "FFFFFF", fill: { color: brandNavy } } },
      ],
      ...INSIGHTS.map<PptxGenJS.TableRow>((i) => [
        { text: i.severity, options: { bold: true, color: ink } },
        { text: i.title, options: { bold: true, color: ink } },
        { text: i.detail, options: { color: ink } },
        { text: i.impact, options: { bold: true, color: brandGreen } },
      ]),
    ];
    s.addTable(rows, {
      x: 0.5, y: 1.8, w: 12.3,
      colW: [1.3, 3.4, 5.6, 2.0],
      fontFace: "Calibri", fontSize: 12,
      border: { type: "solid", pt: 0.5, color: "E2E8F0" },
      rowH: 0.55,
    });
    addFooter(s);
  }

  if (sections.slottingRecommendations) {
    const s = pptx.addSlide();
    addBrandBar(s);
    s.addText("Slotting Recommendations", {
      x: 0.5, y: 0.75, w: 12, h: 0.6,
      fontFace: "Calibri", fontSize: 30, bold: true, color: ink,
    });
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.35, w: 0.6, h: 0.08, fill: { color: brandGreen },
    });
    const rows: PptxGenJS.TableRow[] = [
      [
        { text: "SKU", options: { bold: true, color: "FFFFFF", fill: { color: brandNavy } } },
        { text: "From", options: { bold: true, color: "FFFFFF", fill: { color: brandNavy } } },
        { text: "To", options: { bold: true, color: "FFFFFF", fill: { color: brandNavy } } },
        { text: "Impact", options: { bold: true, color: "FFFFFF", fill: { color: brandNavy } } },
        { text: "Savings", options: { bold: true, color: "FFFFFF", fill: { color: brandNavy } } },
      ],
      ...SLOTTING_RECS.map<PptxGenJS.TableRow>((r) => [
        { text: r.sku, options: { bold: true, color: ink } },
        { text: r.from, options: { color: ink } },
        { text: r.to, options: { color: ink } },
        { text: r.impact, options: { color: ink } },
        { text: r.savings, options: { bold: true, color: brandGreen } },
      ]),
    ];
    s.addTable(rows, {
      x: 0.5, y: 1.8, w: 12.3,
      colW: [1.8, 3.1, 3.1, 2.5, 1.8],
      fontFace: "Calibri", fontSize: 13,
      border: { type: "solid", pt: 0.5, color: "E2E8F0" },
      rowH: 0.6,
    });
    addFooter(s);
  }

  if (sections.pickingRoute) {
    const s = pptx.addSlide();
    addBrandBar(s);
    s.addText("Optimized Picking Route", {
      x: 0.5, y: 0.75, w: 12, h: 0.6,
      fontFace: "Calibri", fontSize: 30, bold: true, color: ink,
    });
    s.addShape(pptx.ShapeType.rect, {
      x: 0.5, y: 1.35, w: 0.6, h: 0.08, fill: { color: brandGreen },
    });

    // Route visualization (schematic)
    const mapX = 0.6, mapY = 1.9, mapW = 7.6, mapH = 4.6;
    s.addShape(pptx.ShapeType.roundRect, {
      x: mapX, y: mapY, w: mapW, h: mapH,
      fill: { color: "F8FAFC" }, line: { color: "E2E8F0", width: 1 }, rectRadius: 0.1,
    });
    // Scale route into map box
    const xs = OPTIMIZED_ROUTE.map((p) => p[0]);
    const ys = OPTIMIZED_ROUTE.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 0.3;
    const scaleX = (v: number) =>
      mapX + pad + ((v - minX) / (maxX - minX || 1)) * (mapW - pad * 2);
    const scaleY = (v: number) =>
      mapY + pad + ((v - minY) / (maxY - minY || 1)) * (mapH - pad * 2);
    for (let i = 0; i < OPTIMIZED_ROUTE.length - 1; i++) {
      const [x1, y1] = OPTIMIZED_ROUTE[i];
      const [x2, y2] = OPTIMIZED_ROUTE[i + 1];
      s.addShape(pptx.ShapeType.line, {
        x: Math.min(scaleX(x1), scaleX(x2)),
        y: Math.min(scaleY(y1), scaleY(y2)),
        w: Math.abs(scaleX(x2) - scaleX(x1)),
        h: Math.abs(scaleY(y2) - scaleY(y1)),
        line: { color: brandGreen, width: 2.5, endArrowType: "triangle" },
        flipH: scaleX(x2) < scaleX(x1),
        flipV: scaleY(y2) < scaleY(y1),
      });
    }
    OPTIMIZED_ROUTE.forEach(([x, ry], i) => {
      const isEndpoint = i === 0 || i === OPTIMIZED_ROUTE.length - 1;
      s.addShape(pptx.ShapeType.ellipse, {
        x: scaleX(x) - 0.09, y: scaleY(ry) - 0.09, w: 0.18, h: 0.18,
        fill: { color: isEndpoint ? brandNavy : brandGreen },
        line: { color: "FFFFFF", width: 1.5 },
      });
    });

    // Right side stats
    const sx = 8.5;
    s.addText("ROUTE STATS", {
      x: sx, y: 1.95, w: 4.3, h: 0.3,
      fontFace: "Calibri", fontSize: 11, bold: true, color: muted, charSpacing: 2,
    });
    const stats = [
      ["Distance", "11.9 km", "−33%"],
      ["Pick time", "58 min", "−36%"],
      ["Waypoints", String(OPTIMIZED_ROUTE.length), ""],
      ["Labor recovered", "38.5 h/day", "+"],
    ];
    stats.forEach((row, i) => {
      const yy = 2.4 + i * 0.9;
      s.addShape(pptx.ShapeType.roundRect, {
        x: sx, y: yy, w: 4.3, h: 0.75,
        fill: { color: "F1F5F9" }, line: { color: "E2E8F0", width: 0.75 }, rectRadius: 0.08,
      });
      s.addText(row[0], {
        x: sx + 0.2, y: yy + 0.08, w: 2.5, h: 0.3,
        fontFace: "Calibri", fontSize: 11, color: muted,
      });
      s.addText(row[1], {
        x: sx + 0.2, y: yy + 0.32, w: 2.5, h: 0.4,
        fontFace: "Calibri", fontSize: 20, bold: true, color: ink,
      });
      if (row[2]) {
        s.addText(row[2], {
          x: sx + 2.8, y: yy + 0.22, w: 1.4, h: 0.4, align: "right",
          fontFace: "Calibri", fontSize: 16, bold: true, color: brandGreen,
        });
      }
    });
    addFooter(s);
  }

  const blob = (await pptx.write({ outputType: "blob" })) as Blob;
  return blob;
}

/* ============================================================
 * Public API
 * ==========================================================*/
export async function generateAndDownloadReport(
  format: ExportFormat,
  sections: ExportSections,
): Promise<string> {
  const stamp = fileStamp();
  const base = `FulfillAI-Warehouse-Optimization-${stamp}`;

  if (format === "pdf") {
    const blob = generatePdf(sections);
    const filename = `${base}.pdf`;
    download(blob, filename);
    return filename;
  }
  if (format === "csv") {
    const blob = generateCsv(sections);
    const filename = `${base}.csv`;
    download(blob, filename);
    return filename;
  }
  const blob = await generatePptx(sections);
  const filename = `${base}.pptx`;
  download(blob, filename);
  return filename;
}
