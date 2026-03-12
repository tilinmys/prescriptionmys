import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import officialLogo from "../../assets/mystreelogo-official.svg";
import {
  getVisibleVitalsRows,
  normalizeMedicineGridRows,
  sanitizeInlineText,
  valueOrBlank,
  wrapTextByWidth,
} from "./prescriptionTemplateUtils";

const PAGE = {
  width: 595.28,
  height: 841.89,
};

const LAYOUT = {
  left: 38,
  right: 38,
  top: 28,
  bottom: 36,
  headerRightWidth: 255,
  vitalsWidth: 84,
  vitalsGapTop: 10,
  bodyGapAfterVitals: 8,
  vitalsBodyReserve: 112,
  footerLineOffset: 78,
  footerTextOffset: 70,
};

const COLORS = {
  page: rgb(0.968, 0.968, 0.965),
  text: rgb(0.153, 0.204, 0.306),
  muted: rgb(0.369, 0.431, 0.525),
  line: rgb(0.596, 0.639, 0.702),
  border: rgb(0.839, 0.871, 0.91),
  panel: rgb(1, 1, 1),
  panelMuted: rgb(0.972, 0.98, 0.988),
  orange: rgb(0.929, 0.357, 0.176),
  footer: rgb(0.455, 0.518, 0.604),
};

const MEDICINE_COLUMNS = [
  { key: "medicine", label: "Medicine", ratio: 1.9 },
  { key: "dosage", label: "Dosage", ratio: 0.78 },
  { key: "frequency", label: "Frequency", ratio: 0.92 },
  { key: "duration", label: "Duration", ratio: 0.8 },
  { key: "notes", label: "Remarks", ratio: 1.25 },
];

function toPdfYFromTop(yTop, height, pageHeight = PAGE.height) {
  return pageHeight - yTop - height;
}

function getFontHeight(font, size) {
  try {
    return font.heightAtSize(size, { descender: false });
  } catch {
    return font.heightAtSize(size);
  }
}

function drawTextTop(page, font, text, { x, yTop, size, color = COLORS.text, pageHeight = PAGE.height }) {
  if (!text) return;
  const textHeight = getFontHeight(font, size);
  page.drawText(text, {
    x,
    y: toPdfYFromTop(yTop, textHeight, pageHeight),
    size,
    font,
    color,
  });
}

function drawRect(page, { x, yTop, width, height, fillColor, borderColor, borderWidth = 0.8 }) {
  page.drawRectangle({
    x,
    y: toPdfYFromTop(yTop, height),
    width,
    height,
    color: fillColor,
    borderColor,
    borderWidth,
  });
}

function fitTextSize(font, text, preferred, minSize, maxWidth) {
  if (!maxWidth || !text) return preferred;
  let size = preferred;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

function drawFittedText(page, font, text, { x, yTop, size, minSize, maxWidth, color, align = "left" }) {
  const resolved = sanitizeInlineText(text);
  if (!resolved) return;
  const fittedSize = fitTextSize(font, resolved, size, minSize, maxWidth);
  let drawX = x;
  if (align === "right" && maxWidth) {
    const textWidth = font.widthOfTextAtSize(resolved, fittedSize);
    drawX = x + Math.max(0, maxWidth - textWidth);
  }
  drawTextTop(page, font, resolved, {
    x: drawX,
    yTop,
    size: fittedSize,
    color,
  });
}

function drawCenteredText(page, font, text, { x, yTop, size, maxWidth, color }) {
  const resolved = sanitizeInlineText(text);
  if (!resolved) return;
  const textWidth = font.widthOfTextAtSize(resolved, size);
  const drawX = x + Math.max(0, (maxWidth - textWidth) / 2);
  drawTextTop(page, font, resolved, {
    x: drawX,
    yTop,
    size,
    color,
  });
}

function drawCenteredWrappedParagraph(page, font, text, { x, yTop, width, size, lineGap, color }) {
  const lines = wrapParagraph(text, width, font, size);
  lines.forEach((line, index) => {
    drawCenteredText(page, font, line, {
      x,
      yTop: yTop + index * lineGap,
      size,
      maxWidth: width,
      color,
    });
  });
  return lines.length;
}

function drawFieldLine(
  page,
  labelFont,
  valueFont,
  { label, value, x, yTop, width, labelGap = 6, labelWidth = null, valueInset = 4 }
) {
  const labelSize = 11.5;
  const valueSize = 11.5;
  const measuredLabelWidth = labelFont.widthOfTextAtSize(label, labelSize);
  const resolvedLabelWidth = labelWidth == null ? measuredLabelWidth : labelWidth;
  drawTextTop(page, labelFont, label, {
    x,
    yTop,
    size: labelSize,
    color: COLORS.text,
  });

  const lineStartX = x + resolvedLabelWidth + labelGap;
  const lineY = PAGE.height - yTop - 12;
  page.drawLine({
    start: { x: lineStartX, y: lineY },
    end: { x: x + width, y: lineY },
    thickness: 0.7,
    color: COLORS.line,
    dashArray: [1.4, 1.8],
  });

  const resolvedValue = valueOrBlank(value);
  if (resolvedValue) {
    const availableWidth = Math.max(20, width - resolvedLabelWidth - labelGap - valueInset - 2);
    drawFittedText(page, valueFont, resolvedValue, {
      x: lineStartX + valueInset,
      yTop: yTop - 2,
      size: valueSize,
      minSize: 9,
      maxWidth: availableWidth,
      color: COLORS.text,
    });
  }
}

function wrapParagraph(text, maxWidth, font, size) {
  return wrapTextByWidth(text, maxWidth, (value) => font.widthOfTextAtSize(value, size));
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

let cachedLogoPngBytes = null;

async function getOfficialLogoPngBytes(width, height) {
  if (cachedLogoPngBytes) return cachedLogoPngBytes;

  const svgText = await fetch(officialLogo).then((response) => response.text());
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const svgBlobUrl = URL.createObjectURL(svgBlob);

  const image = await loadImageElement(svgBlobUrl);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * 2));
  canvas.height = Math.max(1, Math.round(height * 2));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    URL.revokeObjectURL(svgBlobUrl);
    throw new Error("Canvas context not available");
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(svgBlobUrl);

  cachedLogoPngBytes = dataUrlToUint8Array(canvas.toDataURL("image/png"));
  return cachedLogoPngBytes;
}

function getVisibleMedicineColumns(rows) {
  return MEDICINE_COLUMNS.filter((column) =>
    rows.some((row) => String(row?.[column.key] || "").trim())
  );
}

function drawSectionHeading(page, font, label, x, yTop) {
  drawTextTop(page, font, String(label).toUpperCase(), {
    x,
    yTop,
    size: 9.5,
    color: COLORS.muted,
  });
}

function drawVitalsBox(page, regularFont, boldFont, rows, startYTop) {
  if (!rows.length) return startYTop;

  const boxWidth = LAYOUT.vitalsWidth;
  const boxX = PAGE.width - LAYOUT.right - boxWidth;
  drawSectionHeading(page, boldFont, "Vitals", boxX, startYTop);

  const containerY = startYTop + LAYOUT.vitalsGapTop;
  const rowHeight = 19;
  const gap = 4;
  const padding = 5;
  const containerHeight = padding * 2 + rows.length * rowHeight + (rows.length - 1) * gap;

  drawRect(page, {
    x: boxX,
    yTop: containerY,
    width: boxWidth,
    height: containerHeight,
    fillColor: COLORS.panel,
    borderColor: COLORS.border,
  });

  rows.forEach((row, index) => {
    const rowY = containerY + padding + index * (rowHeight + gap);
    drawRect(page, {
      x: boxX + 6,
      yTop: rowY,
      width: boxWidth - 12,
      height: rowHeight,
      fillColor: COLORS.panelMuted,
      borderColor: COLORS.border,
    });
    drawTextTop(page, boldFont, row.label, {
      x: boxX + 10,
      yTop: rowY + 3,
      size: 5.2,
      color: COLORS.muted,
    });
    drawFittedText(page, boldFont, row.value, {
      x: boxX + 10,
      yTop: rowY + 9,
      size: 7.6,
      minSize: 6.2,
      maxWidth: boxWidth - 20,
      color: COLORS.text,
    });
  });

  return containerY + containerHeight;
}

function drawWrappedParagraphs(page, regularFont, boldFont, heading, paragraphs, x, yTop, width, maxYTop) {
  if (!paragraphs.length) return yTop;

  drawSectionHeading(page, boldFont, heading, x, yTop);
  let cursorY = yTop + 18;
  const lineSize = 11.5;
  const lineGap = 15;

  for (const paragraph of paragraphs) {
    const wrapped = wrapParagraph(paragraph, width, regularFont, lineSize);
    for (const line of wrapped) {
      if (cursorY + lineGap > maxYTop) return cursorY;
      drawTextTop(page, regularFont, line, {
        x,
        yTop: cursorY,
        size: lineSize,
        color: COLORS.text,
      });
      cursorY += lineGap;
    }
    cursorY += 6;
  }

  return cursorY + 8;
}

function drawMedicineTable(page, regularFont, boldFont, rows, x, yTop, width, maxYTop) {
  if (!rows.length) return yTop;

  const columns = getVisibleMedicineColumns(rows);
  if (!columns.length) return yTop;

  drawSectionHeading(page, boldFont, "Medicines", x, yTop);
  const tableY = yTop + 18;
  const headerHeight = 22;
  const totalRatio = columns.reduce((sum, column) => sum + column.ratio, 0);

  let currentX = x;
  const bounds = columns.map((column, index) => {
    const isLast = index === columns.length - 1;
    const columnWidth = isLast ? x + width - currentX : (width * column.ratio) / totalRatio;
    const bound = { ...column, x: currentX, width: columnWidth };
    currentX += columnWidth;
    return bound;
  });

  const rowLineSize = 10.5;
  const rowLineGap = 13;
  const cellPaddingX = 7;
  const cellPaddingY = 7;
  let cursorY = tableY + headerHeight;
  const rowLayouts = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const cells = bounds.map((column) => {
      const rawValue = sanitizeInlineText(row[column.key]);
      const displayValue =
        column.key === "medicine"
          ? rawValue
            ? `${rowIndex + 1}. ${rawValue}`
            : ""
          : rawValue;
      const lines = displayValue
        ? wrapParagraph(displayValue, Math.max(24, column.width - cellPaddingX * 2), column.key === "medicine" ? boldFont : regularFont, rowLineSize)
        : [];
      return { key: column.key, lines };
    });

    const maxLines = Math.max(1, ...cells.map((cell) => Math.max(1, cell.lines.length)));
    const rowHeight = Math.max(24, maxLines * rowLineGap + cellPaddingY * 2);
    if (cursorY + rowHeight > maxYTop) break;

    rowLayouts.push({ yTop: cursorY, height: rowHeight, cells });
    cursorY += rowHeight;
  }

  const tableHeight = headerHeight + rowLayouts.reduce((sum, row) => sum + row.height, 0);
  drawRect(page, {
    x,
    yTop: tableY,
    width,
    height: tableHeight,
    fillColor: COLORS.panel,
    borderColor: COLORS.border,
  });
  drawRect(page, {
    x,
    yTop: tableY,
    width,
    height: headerHeight,
    fillColor: COLORS.panelMuted,
    borderColor: COLORS.border,
  });

  bounds.forEach((column, index) => {
    drawTextTop(page, boldFont, column.label.toUpperCase(), {
      x: column.x + cellPaddingX,
      yTop: tableY + 7,
      size: 7.8,
      color: COLORS.muted,
    });

    if (index < bounds.length - 1) {
      page.drawLine({
        start: { x: column.x + column.width, y: PAGE.height - tableY },
        end: { x: column.x + column.width, y: PAGE.height - (tableY + tableHeight) },
        thickness: 0.7,
        color: COLORS.border,
      });
    }
  });

  rowLayouts.forEach((row) => {
    page.drawLine({
      start: { x, y: PAGE.height - row.yTop },
      end: { x: x + width, y: PAGE.height - row.yTop },
      thickness: 0.7,
      color: COLORS.border,
    });

    row.cells.forEach((cell, cellIndex) => {
      const column = bounds[cellIndex];
      const font = column.key === "medicine" ? boldFont : regularFont;
      cell.lines.forEach((line, lineIndex) => {
        drawTextTop(page, font, line, {
          x: column.x + cellPaddingX,
          yTop: row.yTop + cellPaddingY + lineIndex * rowLineGap,
          size: rowLineSize,
          color: COLORS.text,
        });
      });
    });
  });

  return tableY + tableHeight + 16;
}

async function embedDataImage(pdfDoc, dataUrl) {
  const response = await fetch(dataUrl);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const lower = String(dataUrl || "").toLowerCase();

  const isPng =
    contentType.includes("png") || lower.startsWith("data:image/png") || lower.includes(".png");
  const isJpg =
    contentType.includes("jpeg") ||
    contentType.includes("jpg") ||
    lower.startsWith("data:image/jpeg") ||
    lower.startsWith("data:image/jpg") ||
    lower.includes(".jpeg") ||
    lower.includes(".jpg");

  if (isPng) return pdfDoc.embedPng(bytes);
  if (isJpg) return pdfDoc.embedJpg(bytes);

  try {
    return await pdfDoc.embedPng(bytes);
  } catch {
    return pdfDoc.embedJpg(bytes);
  }
}

async function buildA4PrescriptionPdf({
  doctor,
  patient,
  diagnosis,
  advice,
  medicines,
  vitals,
  visibleVitalFields,
  date,
  signatureDataUrl,
}) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE.width, PAGE.height]);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  drawRect(page, {
    x: 0,
    yTop: 0,
    width: PAGE.width,
    height: PAGE.height,
    fillColor: COLORS.page,
    borderColor: undefined,
    borderWidth: 0,
  });

  const logoWidth = 220;
  const logoHeight = 72;
  const logoBytes = await getOfficialLogoPngBytes(logoWidth, logoHeight);
  const logoImage = await pdfDoc.embedPng(logoBytes);
  page.drawImage(logoImage, {
    x: LAYOUT.left - 10,
    y: toPdfYFromTop(LAYOUT.top, logoHeight),
    width: logoWidth,
    height: logoHeight,
  });

  const headerWidth = LAYOUT.headerRightWidth;
  const headerX = PAGE.width - LAYOUT.right - headerWidth;
  drawFittedText(page, regularFont, "MyStree Clinic, #3366, 1st Floor, 13th Main Road", {
    x: headerX,
    yTop: LAYOUT.top + 8,
    size: 11.5,
    minSize: 9.5,
    maxWidth: headerWidth,
    color: COLORS.text,
    align: "right",
  });
  drawFittedText(page, regularFont, "HAL 2nd Stage, Indiranagar, Bengaluru, 560008", {
    x: headerX,
    yTop: LAYOUT.top + 26,
    size: 11.5,
    minSize: 9.5,
    maxWidth: headerWidth,
    color: COLORS.text,
    align: "right",
  });
  drawFittedText(page, regularFont, "info@mystree.org | www.my-stree.com", {
    x: headerX,
    yTop: LAYOUT.top + 48,
    size: 11,
    minSize: 9,
    maxWidth: headerWidth,
    color: COLORS.orange,
    align: "right",
  });
  drawFittedText(page, boldFont, "+91 63665 73772", {
    x: headerX,
    yTop: LAYOUT.top + 68,
    size: 14,
    minSize: 11,
    maxWidth: headerWidth,
    color: rgb(0.051, 0.106, 0.212),
    align: "right",
  });

  drawTextTop(page, boldFont, "Rx", {
    x: LAYOUT.left + 2,
    yTop: 148,
    size: 38,
    color: COLORS.text,
  });

  drawFieldLine(page, boldFont, boldFont, {
    label: "Date :",
    value: date,
    x: PAGE.width - LAYOUT.right - 236,
    yTop: 182,
    width: 232,
    labelWidth: 40,
    valueInset: 8,
  });

  drawFieldLine(page, boldFont, boldFont, {
    label: "Patient's name:",
    value: patient?.name,
    x: LAYOUT.left,
    yTop: 236,
    width: 334,
    labelWidth: 96,
    valueInset: 8,
  });

  drawFieldLine(page, boldFont, boldFont, {
    label: "Age:",
    value: patient?.age,
    x: PAGE.width - LAYOUT.right - 162,
    yTop: 236,
    width: 160,
    labelWidth: 28,
    valueInset: 8,
  });

  const vitalsRows = getVisibleVitalsRows(vitals, visibleVitalFields).filter(
    (item) => sanitizeInlineText(item.value) && item.value !== "-"
  );
  const vitalsBottom = vitalsRows.length ? drawVitalsBox(page, regularFont, boldFont, vitalsRows, 252) : 252;

  const footerLineY = PAGE.height - LAYOUT.footerLineOffset;
  const footerTopY = PAGE.height - LAYOUT.footerTextOffset;
  const bodyMaxYTop = footerLineY - 28;
  const bodyWidth =
    PAGE.width -
    LAYOUT.left -
    LAYOUT.right -
    (vitalsRows.length ? LAYOUT.vitalsBodyReserve : 0);
  let cursorY = 286;

  const diagnosisParagraphs = String(diagnosis || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const adviceParagraphs = String(advice || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const medicineRows = normalizeMedicineGridRows(medicines);

  cursorY = drawWrappedParagraphs(
    page,
    regularFont,
    boldFont,
    "Diagnosis",
    diagnosisParagraphs,
    LAYOUT.left,
    cursorY,
    bodyWidth,
    bodyMaxYTop
  );
  cursorY = drawMedicineTable(
    page,
    regularFont,
    boldFont,
    medicineRows,
    LAYOUT.left,
    cursorY,
    bodyWidth,
    bodyMaxYTop
  );
  cursorY = drawWrappedParagraphs(
    page,
    regularFont,
    boldFont,
    "Advice",
    adviceParagraphs,
    LAYOUT.left,
    cursorY,
    bodyWidth,
    bodyMaxYTop
  );

  if (signatureDataUrl) {
    try {
      const signatureImage = await embedDataImage(pdfDoc, signatureDataUrl);
      const signatureWidth = 110;
      const signatureHeight = 34;
      page.drawImage(signatureImage, {
        x: PAGE.width - LAYOUT.right - signatureWidth,
        y: toPdfYFromTop(footerLineY - 48, signatureHeight),
        width: signatureWidth,
        height: signatureHeight,
      });
      if (doctor?.name) {
        drawFittedText(page, boldFont, `Dr. ${sanitizeInlineText(doctor.name)}`, {
          x: PAGE.width - 200,
          yTop: footerLineY - 8,
          size: 10.5,
          minSize: 8.5,
          maxWidth: 162,
          color: COLORS.text,
          align: "right",
        });
      }
    } catch {
      // Keep PDF generation resilient even when signature decoding fails.
    }
  }

  page.drawLine({
    start: { x: LAYOUT.left, y: PAGE.height - footerLineY },
    end: { x: PAGE.width - LAYOUT.right, y: PAGE.height - footerLineY },
    thickness: 1.1,
    color: COLORS.orange,
  });

  const footerText =
    "Do not self-medicate. This medication is intended for use only as prescribed by your healthcare provider.";
  const footerText2 =
    "Always consult your doctor before taking any medication, including this one, to ensure it is appropriate for your individual needs.";
  const footerSize = 7.4;
  const footerWidth = PAGE.width - LAYOUT.left - LAYOUT.right - 32;
  const footerX = (PAGE.width - footerWidth) / 2;
  drawCenteredWrappedParagraph(page, regularFont, footerText, {
    x: footerX,
    yTop: footerTopY,
    width: footerWidth,
    size: footerSize,
    lineGap: 9,
    color: COLORS.footer,
  });
  drawCenteredWrappedParagraph(page, regularFont, footerText2, {
    x: footerX,
    yTop: footerTopY + 10,
    width: footerWidth,
    size: footerSize,
    lineGap: 9,
    color: COLORS.footer,
  });

  return pdfDoc.save();
}

export async function generatePrescriptionPdfFromTemplate({
  doctor,
  patient,
  diagnosis,
  advice,
  medicines,
  vitals,
  visibleVitalFields,
  date,
  signatureDataUrl,
  clinicHours,
  closedDays,
  pageSize = "a4",
}) {
  const a4Bytes = await buildA4PrescriptionPdf({
    doctor,
    patient,
    diagnosis,
    advice,
    medicines,
    vitals,
    visibleVitalFields,
    date,
    signatureDataUrl,
    clinicHours,
    closedDays,
  });

  if (String(pageSize).toLowerCase() !== "letter") {
    return a4Bytes;
  }

  const letterDoc = await PDFDocument.create();
  const [embeddedPage] = await letterDoc.embedPdf(a4Bytes, [0]);
  const letterPage = letterDoc.addPage([612, 792]);
  const scale = Math.min(612 / embeddedPage.width, 792 / embeddedPage.height);
  const drawWidth = embeddedPage.width * scale;
  const drawHeight = embeddedPage.height * scale;
  const x = (612 - drawWidth) / 2;
  const y = (792 - drawHeight) / 2;

  letterPage.drawPage(embeddedPage, {
    x,
    y,
    width: drawWidth,
    height: drawHeight,
  });

  return letterDoc.save();
}
