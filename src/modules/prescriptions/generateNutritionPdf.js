import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import officialLogo from "../../assets/mystreelogo-official.svg";
import { sanitizeInlineText, valueOrBlank, wrapTextByWidth } from "./prescriptionTemplateUtils";

const PAGE = {
  width: 595.28,
  height: 841.89,
};

const NOTE_SECTIONS = [
  { key: "medicalHistory", label: "Medical history." },
  { key: "advanSupplements", label: "Advan Supplements." },
  { key: "recall24Hr", label: "24-hr recall." },
  { key: "suggestions", label: "Suggestions." },
  { key: "goal", label: "Goal." },
  { key: "dietPlan", label: "Diet plan." },
];

const SEGMENT_ROWS = [
  { key: "body", label: "Body" },
  { key: "trunk", label: "Trunk" },
  { key: "arm", label: "Arm" },
  { key: "leg", label: "Leg" },
];

const CLINIC_LINES = [
  "MyStree Clinic, #3366, 1st Floor, 13th Main Road",
  "HAL 2nd Stage, Indiranagar, Bengaluru, 560008",
];

function normalizeNutritionistDisplayName(value) {
  const trimmed = valueOrBlank(value);
  if (!trimmed) return "";
  return trimmed.replace(/^(dr|doctor)\.?\s+/i, "").trim();
}

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

function drawTextTop(page, font, text, { x, yTop, size, color = rgb(0, 0, 0) }) {
  if (!text) return;
  const height = getFontHeight(font, size);
  page.drawText(text, {
    x,
    y: toPdfYFromTop(yTop, height),
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

function drawLine(page, x1, yTop1, x2, yTop2, thickness = 0.8, color = rgb(0, 0, 0)) {
  page.drawLine({
    start: { x: x1, y: PAGE.height - yTop1 },
    end: { x: x2, y: PAGE.height - yTop2 },
    thickness,
    color,
  });
}

function fitTextSize(font, text, preferred, minSize, maxWidth) {
  if (!text || !maxWidth) return preferred;
  let size = preferred;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

function drawFittedText(page, font, text, { x, yTop, size, minSize, maxWidth, align = "left", color }) {
  const resolved = sanitizeInlineText(text);
  if (!resolved) return;
  const fittedSize = fitTextSize(font, resolved, size, minSize, maxWidth);
  const width = font.widthOfTextAtSize(resolved, fittedSize);
  const drawX =
    align === "right" ? x + Math.max(0, maxWidth - width) : align === "center" ? x + Math.max(0, (maxWidth - width) / 2) : x;
  drawTextTop(page, font, resolved, {
    x: drawX,
    yTop,
    size: fittedSize,
    color,
  });
}

function wrapParagraph(text, width, font, size) {
  return wrapTextByWidth(text, width, (value) => font.widthOfTextAtSize(value, size));
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
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
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

async function embedDataImage(pdfDoc, dataUrl) {
  const response = await fetch(dataUrl);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const lower = String(dataUrl || "").toLowerCase();
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const isPng =
    contentType.includes("png") || lower.startsWith("data:image/png") || lower.includes(".png");

  if (isPng) return pdfDoc.embedPng(bytes);
  return pdfDoc.embedJpg(bytes);
}

function drawMetricCell(page, boldFont, regularFont, { x, yTop, width, height, label, value }) {
  const splitAt = 150;
  drawRect(page, {
    x,
    yTop,
    width,
    height,
    fillColor: rgb(1, 1, 1),
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.9,
  });
  drawLine(page, x + splitAt, yTop, x + splitAt, yTop + height, 0.9);
  drawTextTop(page, boldFont, label, {
    x: x + 8,
    yTop: yTop + 8,
    size: 11.5,
  });
  drawFittedText(page, regularFont, valueOrBlank(value), {
    x: x + splitAt + 8,
    yTop: yTop + 8,
    size: 11.5,
    minSize: 8.5,
    maxWidth: width - splitAt - 16,
  });
}

function drawNoteBlock(page, boldFont, regularFont, { x, yTop, width, label, note }) {
  drawRect(page, {
    x,
    yTop: yTop + 6,
    width: 12,
    height: 12,
    fillColor: rgb(1, 1, 1),
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.9,
  });

  if (note?.checked) {
    drawRect(page, {
      x: x + 2.5,
      yTop: yTop + 8.5,
      width: 7,
      height: 7,
      fillColor: rgb(0, 0, 0),
      borderColor: rgb(0, 0, 0),
      borderWidth: 0,
    });
  }

  drawTextTop(page, boldFont, label, {
    x: x + 20,
    yTop,
    size: 12.5,
  });

  const noteText = valueOrBlank(note?.text);
  const lines = noteText ? wrapParagraph(noteText, width - 8, regularFont, 10.2).slice(0, 5) : [];
  lines.forEach((line, index) => {
    drawTextTop(page, regularFont, line, {
      x: x,
      yTop: yTop + 24 + index * 12,
      size: 10.2,
    });
  });
}

async function buildA4NutritionPdf({
  doctor,
  patient,
  composition,
  segmentMetrics,
  notes,
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
    fillColor: rgb(0.969, 0.969, 0.965),
    borderColor: undefined,
    borderWidth: 0,
  });

  const logoWidth = 220;
  const logoHeight = 66;
  const logoBytes = await getOfficialLogoPngBytes(logoWidth, logoHeight);
  const logoImage = await pdfDoc.embedPng(logoBytes);
  page.drawImage(logoImage, {
    x: 38,
    y: toPdfYFromTop(24, logoHeight),
    width: logoWidth,
    height: logoHeight,
  });

  drawFittedText(page, regularFont, CLINIC_LINES[0], {
    x: 318,
    yTop: 26,
    size: 11.6,
    minSize: 9,
    maxWidth: 238,
    align: "right",
    color: rgb(0.153, 0.204, 0.306),
  });
  drawFittedText(page, regularFont, CLINIC_LINES[1], {
    x: 318,
    yTop: 42,
    size: 11.6,
    minSize: 9,
    maxWidth: 238,
    align: "right",
    color: rgb(0.153, 0.204, 0.306),
  });
  drawFittedText(page, regularFont, "info@mystree.org | www.my-stree.com", {
    x: 318,
    yTop: 61,
    size: 10.6,
    minSize: 8.5,
    maxWidth: 238,
    align: "right",
    color: rgb(0.929, 0.357, 0.176),
  });
  drawFittedText(page, boldFont, "+91 63665 73772", {
    x: 358,
    yTop: 76,
    size: 13.6,
    minSize: 11,
    maxWidth: 198,
    align: "right",
    color: rgb(0.051, 0.106, 0.212),
  });

  drawTextTop(page, boldFont, "NUTRITION SHEET", {
    x: 238,
    yTop: 100,
    size: 11,
    color: rgb(0.051, 0.106, 0.212),
  });

  const outerX = 46;
  const outerWidth = PAGE.width - outerX * 2;
  drawRect(page, {
    x: outerX,
    yTop: 120,
    width: outerWidth,
    height: 56,
    fillColor: rgb(1, 1, 1),
    borderColor: rgb(0, 0, 0),
    borderWidth: 1.1,
  });
  drawLine(page, 338, 120, 338, 148, 0.9);
  drawLine(page, outerX, 148, outerX + outerWidth, 148, 0.9);
  drawTextTop(page, boldFont, "Patient Name:", {
    x: outerX + 10,
    yTop: 128,
    size: 11.8,
  });
  drawFittedText(page, regularFont, valueOrBlank(patient?.name), {
    x: outerX + 96,
    yTop: 128,
    size: 11.8,
    minSize: 9,
    maxWidth: 188,
  });
  drawTextTop(page, boldFont, "Date:", {
    x: 350,
    yTop: 128,
    size: 11.8,
  });
  drawFittedText(page, regularFont, valueOrBlank(date), {
    x: 388,
    yTop: 128,
    size: 11.8,
    minSize: 9,
    maxWidth: 144,
  });
  drawTextTop(page, boldFont, "Patient Age:", {
    x: outerX + 10,
    yTop: 154,
    size: 11.8,
  });
  drawFittedText(page, regularFont, valueOrBlank(patient?.age), {
    x: outerX + 90,
    yTop: 154,
    size: 11.8,
    minSize: 9,
    maxWidth: 180,
  });

  const leftX = 46;
  const topY = 190;
  const leftWidth = 248;
  const rightX = 309;
  const rightWidth = 240;
  const rowHeight = 28;
  const compositionRows = [
    { label: "Ht:", value: composition?.height },
    { label: "Wt:", value: composition?.weight },
    { label: "Fat:", value: composition?.fat },
    { label: "V. Fat:", value: composition?.visceralFat },
    { label: "BMR:", value: composition?.bmr },
    { label: "BMI:", value: composition?.bmi },
    { label: "B. Age:", value: composition?.bodyAge },
  ];

  compositionRows.forEach((row, index) => {
    drawMetricCell(page, boldFont, regularFont, {
      x: leftX,
      yTop: topY + rowHeight * index,
      width: leftWidth,
      height: rowHeight,
      label: row.label,
      value: row.value,
    });
  });

  const rightHeaderHeight = 28;
  const rightRowHeight = 28;
  drawRect(page, {
    x: rightX,
    yTop: topY,
    width: rightWidth,
    height: rightHeaderHeight + rightRowHeight * SEGMENT_ROWS.length,
    fillColor: rgb(1, 1, 1),
    borderColor: rgb(0, 0, 0),
    borderWidth: 1.1,
  });
  const col1 = 90;
  const col2 = 66;
  drawLine(page, rightX + col1, topY, rightX + col1, topY + rightHeaderHeight + rightRowHeight * SEGMENT_ROWS.length, 0.9);
  drawLine(page, rightX + col1 + col2, topY, rightX + col1 + col2, topY + rightHeaderHeight + rightRowHeight * SEGMENT_ROWS.length, 0.9);
  drawLine(page, rightX, topY + rightHeaderHeight, rightX + rightWidth, topY + rightHeaderHeight, 0.9);
  drawTextTop(page, boldFont, "Segment", {
    x: rightX + 18,
    yTop: topY + 8,
    size: 11.4,
  });
  drawTextTop(page, boldFont, "Fat %", {
    x: rightX + col1 + 15,
    yTop: topY + 8,
    size: 11.4,
  });
  drawTextTop(page, boldFont, "Muscle %", {
    x: rightX + col1 + col2 + 7,
    yTop: topY + 8,
    size: 11.4,
  });

  SEGMENT_ROWS.forEach((segment, index) => {
    const yTop = topY + rightHeaderHeight + index * rightRowHeight;
    if (index < SEGMENT_ROWS.length - 1) {
      drawLine(page, rightX, yTop + rightRowHeight, rightX + rightWidth, yTop + rightRowHeight, 0.9);
    }
    drawTextTop(page, boldFont, segment.label, {
      x: rightX + 18,
      yTop: yTop + 8,
      size: 11.4,
    });
    drawFittedText(page, regularFont, valueOrBlank(segmentMetrics?.[segment.key]?.fat), {
      x: rightX + col1 + 8,
      yTop: yTop + 8,
      size: 11.4,
      minSize: 8.5,
      maxWidth: col2 - 14,
      align: "center",
    });
    drawFittedText(page, regularFont, valueOrBlank(segmentMetrics?.[segment.key]?.muscle), {
      x: rightX + col1 + col2 + 8,
      yTop: yTop + 8,
      size: 11.4,
      minSize: 8.5,
      maxWidth: rightWidth - col1 - col2 - 14,
      align: "center",
    });
  });

  const leftTableHeight = rowHeight * compositionRows.length;
  const rightTableHeight = rightHeaderHeight + rightRowHeight * SEGMENT_ROWS.length;
  const leftNoteX = 46;
  const rightNoteX = 332;
  const noteWidth = 214;
  const noteStartY = topY + Math.max(leftTableHeight, rightTableHeight) + 18;
  const noteGapY = 92;

  NOTE_SECTIONS.forEach((section, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    drawNoteBlock(page, boldFont, regularFont, {
      x: column === 0 ? leftNoteX : rightNoteX,
      yTop: noteStartY + row * noteGapY,
      width: noteWidth,
      label: section.label,
      note: notes?.[section.key],
    });
  });

  const footerX = 46;
  const footerY = 670;
  const footerWidth = 502;
  const footerHeight = 136;
  const footerBorder = rgb(0.843, 0.824, 0.784);
  const footerDivider = rgb(0.894, 0.875, 0.839);
  const footerMuted = rgb(0.369, 0.408, 0.506);
  const footerSoftMuted = rgb(0.424, 0.455, 0.51);
  const footerInk = rgb(0.051, 0.106, 0.212);
  const rightBlockX = footerX + 300;
  const rightBlockWidth = 178;

  drawRect(page, {
    x: footerX,
    yTop: footerY,
    width: footerWidth,
    height: footerHeight,
    fillColor: rgb(1, 1, 1),
    borderColor: footerBorder,
    borderWidth: 1,
  });
  drawRect(page, {
    x: footerX + 12,
    yTop: footerY + 12,
    width: footerWidth - 24,
    height: 44,
    fillColor: rgb(0.988, 0.984, 0.973),
    borderColor: footerDivider,
    borderWidth: 0.8,
  });
  drawTextTop(page, boldFont, "CLINICAL NOTE", {
    x: footerX + 24,
    yTop: footerY + 19,
    size: 8.4,
    color: footerMuted,
  });
  const noticeLines = wrapParagraph(
    "This nutrition sheet records body-composition details, recall, goals, diet plan, and consultation guidance. Final recommendations should always be reviewed by the treating clinician or consulting nutritionist before use.",
    footerWidth - 52,
    regularFont,
    8.9
  ).slice(0, 3);
  noticeLines.forEach((line, index) => {
    drawTextTop(page, regularFont, line, {
      x: footerX + 24,
      yTop: footerY + 30 + index * 10,
      size: 8.9,
      color: rgb(0.122, 0.161, 0.224),
    });
  });

  const doctorName = normalizeNutritionistDisplayName(doctor?.name);

  drawTextTop(page, boldFont, "NUTRITIONIST SIGNATURE", {
    x: footerX + 18,
    yTop: footerY + 78,
    size: 8.5,
    color: footerMuted,
  });
  drawLine(page, footerX + 18, footerY + 119, footerX + 168, footerY + 119, 0.9, rgb(0.596, 0.635, 0.702));
  if (signatureDataUrl) {
    try {
      const image = await embedDataImage(pdfDoc, signatureDataUrl);
      page.drawImage(image, {
        x: footerX + 22,
        y: toPdfYFromTop(footerY + 90, 26),
        width: 120,
        height: 26,
      });
    } catch {
      // Keep export resilient if signature decoding fails.
    }
  }
  drawTextTop(page, regularFont, "Authorized nutrition consultation sign-off.", {
    x: footerX + 18,
    yTop: footerY + 125,
    size: 8,
    color: footerSoftMuted,
  });

  if (doctorName) {
    drawLine(page, footerX + 288, footerY + 78, footerX + 288, footerY + 126, 0.8, footerDivider);
    drawFittedText(page, boldFont, "CONSULTING NUTRITIONIST", {
      x: rightBlockX,
      yTop: footerY + 78,
      size: 7.6,
      minSize: 6.9,
      maxWidth: rightBlockWidth,
      align: "right",
      color: footerSoftMuted,
    });
    drawFittedText(page, regularFont, "MyStree Clinic", {
      x: rightBlockX,
      yTop: footerY + 94,
      size: 9.2,
      minSize: 8,
      maxWidth: rightBlockWidth,
      align: "right",
      color: footerSoftMuted,
    });
    drawFittedText(page, boldFont, doctorName, {
      x: rightBlockX,
      yTop: footerY + 107,
      size: 13,
      minSize: 10,
      maxWidth: rightBlockWidth,
      align: "right",
      color: footerInk,
    });
    drawFittedText(page, regularFont, "Nutrition & lifestyle consultation", {
      x: rightBlockX,
      yTop: footerY + 124,
      size: 7.8,
      minSize: 7.4,
      maxWidth: rightBlockWidth,
      align: "right",
      color: footerSoftMuted,
    });
  }

  return pdfDoc.save();
}

export async function generateNutritionPdfFromTemplate({
  doctor,
  patient,
  composition,
  segmentMetrics,
  notes,
  date,
  signatureDataUrl,
  pageSize = "a4",
}) {
  const a4Bytes = await buildA4NutritionPdf({
    doctor,
    patient,
    composition,
    segmentMetrics,
    notes,
    date,
    signatureDataUrl,
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

  letterPage.drawPage(embeddedPage, {
    x: (612 - drawWidth) / 2,
    y: (792 - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  });

  return letterDoc.save();
}
