import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import templatePdf from "../../../assets/Design - Front V1.pdf";
import officialLogo from "../../assets/mystreelogo-official.svg";
import {
  buildPrescriptionBlocks,
  composePrescriptionBodyLayout,
  sanitizeInlineText,
  valueOrBlank,
  valueOrDash,
} from "./prescriptionTemplateUtils";
import { TEMPLATE_PAGE, TEMPLATE_POS } from "./templateLayout";

function toPdfYFromTop(yTop, textHeight) {
  return TEMPLATE_PAGE.height - yTop - textHeight;
}

function getFontHeight(font, size) {
  try {
    return font.heightAtSize(size, { descender: false });
  } catch {
    return font.heightAtSize(size);
  }
}

function toPdfRectY(yTop, height) {
  return TEMPLATE_PAGE.height - yTop - height;
}

function drawRect(page, { x, yTop, width, height, borderColor, fillColor, borderWidth = 1 }) {
  page.drawRectangle({
    x,
    y: toPdfRectY(yTop, height),
    width,
    height,
    borderColor,
    borderWidth,
    color: fillColor,
  });
}

function drawLine(page, font, text, x, yTop, size) {
  const textHeight = getFontHeight(font, size);
  page.drawText(text, {
    x,
    y: toPdfYFromTop(yTop, textHeight),
    size,
    font,
    color: rgb(0.12, 0.16, 0.23),
  });
}

function fitTextSize(font, text, preferred, minSize, maxWidth) {
  if (!maxWidth) return preferred;
  let size = preferred;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size -= 0.5;
  }
  return size;
}

function drawFittedLine(
  page,
  font,
  text,
  cfg,
  { blankIfEmpty = false, align = "left" } = {}
) {
  const resolved = blankIfEmpty ? valueOrBlank(text) : valueOrDash(text);
  if (!resolved) return;
  const size = fitTextSize(
    font,
    resolved,
    cfg.size,
    cfg.minSize || Math.max(cfg.size - 8, 10),
    cfg.maxWidth
  );
  let drawX = cfg.x;
  if (align === "right" && cfg.maxWidth) {
    const textWidth = font.widthOfTextAtSize(resolved, size);
    drawX = cfg.x + Math.max(0, cfg.maxWidth - textWidth);
  }
  drawLine(page, font, resolved, drawX, cfg.yTop, size);
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

async function getOfficialLogoPngBytes() {
  if (cachedLogoPngBytes) return cachedLogoPngBytes;

  const svgText = await fetch(officialLogo).then((response) => response.text());
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const svgBlobUrl = URL.createObjectURL(svgBlob);

  const image = await loadImageElement(svgBlobUrl);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(TEMPLATE_POS.logo.width * 2);
  canvas.height = Math.round(TEMPLATE_POS.logo.height * 2);
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

export async function generatePrescriptionPdfFromTemplate({
  doctor,
  patient,
  diagnosis,
  advice,
  medicines,
  vitals,
  date,
  signatureDataUrl,
  clinicHours,
  closedDays,
  pageSize = "a4",
}) {
  const templateBytes = await fetch(templatePdf).then((response) => response.arrayBuffer());
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPage(0);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Replace template logo with the official My Stree logo without affecting nearby content.
  const headerBg = rgb(0.945, 0.945, 0.945);
  if (TEMPLATE_POS.logoCornerMask) {
    page.drawRectangle({
      x: TEMPLATE_POS.logoCornerMask.x,
      y: toPdfRectY(TEMPLATE_POS.logoCornerMask.yTop, TEMPLATE_POS.logoCornerMask.height),
      width: TEMPLATE_POS.logoCornerMask.width,
      height: TEMPLATE_POS.logoCornerMask.height,
      color: headerBg,
    });
  }
  page.drawRectangle({
    x: TEMPLATE_POS.logoMask.x,
    y: toPdfRectY(TEMPLATE_POS.logoMask.yTop, TEMPLATE_POS.logoMask.height),
    width: TEMPLATE_POS.logoMask.width,
    height: TEMPLATE_POS.logoMask.height,
    color: headerBg,
  });

  const logoPngBytes = await getOfficialLogoPngBytes();
  const logoImage = await pdfDoc.embedPng(logoPngBytes);
  page.drawImage(logoImage, {
    x: TEMPLATE_POS.logo.x,
    y: toPdfRectY(TEMPLATE_POS.logo.yTop, TEMPLATE_POS.logo.height),
    width: TEMPLATE_POS.logo.width,
    height: TEMPLATE_POS.logo.height,
  });

  drawFittedLine(page, boldFont, date, TEMPLATE_POS.date);
  drawFittedLine(
    page,
    boldFont,
    doctor?.name ? `Dr. ${sanitizeInlineText(doctor.name)}` : "",
    TEMPLATE_POS.doctorHeaderName,
    { blankIfEmpty: true }
  );
  drawFittedLine(
    page,
    regularFont,
    doctor?.registration ? `Reg No: ${sanitizeInlineText(doctor.registration)}` : "",
    TEMPLATE_POS.doctorHeaderReg,
    { blankIfEmpty: true }
  );
  drawFittedLine(page, boldFont, patient?.name, TEMPLATE_POS.patientName, {
    blankIfEmpty: true,
  });
  drawFittedLine(page, boldFont, patient?.age, TEMPLATE_POS.age, {
    blankIfEmpty: true,
  });

  const blocks = buildPrescriptionBlocks({ patient, vitals, diagnosis, advice, medicines });
  const bodyLayout = composePrescriptionBodyLayout({
    blocks,
    area: TEMPLATE_POS.bodyArea,
    columns: TEMPLATE_POS.medicineGrid.columns,
    preferredSize: TEMPLATE_POS.bodyArea.preferredSize,
    minSize: TEMPLATE_POS.bodyArea.minSize,
    measureAtSize: (value, size) => boldFont.widthOfTextAtSize(value, size),
    gridCellPaddingX: TEMPLATE_POS.medicineGrid.cellPaddingX,
    gridCellPaddingY: TEMPLATE_POS.medicineGrid.cellPaddingY,
    gridMinRowHeight: TEMPLATE_POS.medicineGrid.minRowHeight,
  });

  if (bodyLayout.vitals?.length) {
    for (const line of bodyLayout.vitals) {
      drawLine(page, regularFont, line.text, TEMPLATE_POS.bodyArea.x, line.yTop, line.size);
    }
  }

  if (bodyLayout.diagnosis.headingY != null) {
    drawLine(
      page,
      boldFont,
      bodyLayout.diagnosis.heading,
      TEMPLATE_POS.bodyArea.x,
      bodyLayout.diagnosis.headingY,
      bodyLayout.headingSize
    );
    for (const line of bodyLayout.diagnosis.lines) {
      drawLine(page, regularFont, line.text, TEMPLATE_POS.bodyArea.x, line.yTop, line.size);
    }
  }

  if (bodyLayout.medicines.headingY != null) {
    drawLine(
      page,
      boldFont,
      bodyLayout.medicines.heading,
      TEMPLATE_POS.bodyArea.x,
      bodyLayout.medicines.headingY,
      bodyLayout.headingSize
    );

    if (bodyLayout.medicines.headerY != null && bodyLayout.medicines.bottomY != null) {
      const tableTop = bodyLayout.medicines.headerY;
      const tableHeight = bodyLayout.medicines.bottomY - bodyLayout.medicines.headerY;
      const headerHeight = bodyLayout.tableLineHeight + TEMPLATE_POS.medicineGrid.cellPaddingY * 2;

      drawRect(page, {
        x: TEMPLATE_POS.bodyArea.x,
        yTop: tableTop,
        width: TEMPLATE_POS.bodyArea.width,
        height: tableHeight,
        borderColor: rgb(0.56, 0.64, 0.75),
        fillColor: undefined,
        borderWidth: 1,
      });
      drawRect(page, {
        x: TEMPLATE_POS.bodyArea.x,
        yTop: tableTop,
        width: TEMPLATE_POS.bodyArea.width,
        height: headerHeight,
        borderColor: rgb(0.74, 0.82, 0.9),
        fillColor: rgb(0.92, 0.95, 0.99),
        borderWidth: 1,
      });

      for (const column of bodyLayout.medicines.columns.slice(0, -1)) {
        page.drawLine({
          start: { x: column.x + column.width, y: toPdfYFromTop(tableTop, 0) },
          end: {
            x: column.x + column.width,
            y: toPdfYFromTop(bodyLayout.medicines.bottomY, 0),
          },
          thickness: 0.8,
          color: rgb(0.74, 0.82, 0.9),
        });
      }

      for (const row of bodyLayout.medicines.rows) {
        page.drawLine({
          start: { x: TEMPLATE_POS.bodyArea.x, y: toPdfYFromTop(row.yTop, 0) },
          end: { x: TEMPLATE_POS.bodyArea.x + TEMPLATE_POS.bodyArea.width, y: toPdfYFromTop(row.yTop, 0) },
          thickness: 0.8,
          color: rgb(0.82, 0.87, 0.93),
        });
      }

      for (const column of bodyLayout.medicines.columns) {
        const headerMaxWidth = Math.max(
          column.width - TEMPLATE_POS.medicineGrid.cellPaddingX * 2,
          20
        );
        const headerSize = fitTextSize(
          boldFont,
          column.label,
          bodyLayout.tableHeaderSize,
          Math.max(bodyLayout.tableHeaderSize - 3, 8),
          headerMaxWidth
        );
        drawLine(
          page,
          boldFont,
          column.label,
          column.x + TEMPLATE_POS.medicineGrid.cellPaddingX,
          tableTop + TEMPLATE_POS.medicineGrid.cellPaddingY,
          headerSize
        );
      }

      for (const row of bodyLayout.medicines.rows) {
        for (let cellIndex = 0; cellIndex < bodyLayout.medicines.columns.length; cellIndex += 1) {
          const column = bodyLayout.medicines.columns[cellIndex];
          const cell = row.cells[cellIndex];
          for (let lineIndex = 0; lineIndex < cell.lines.length; lineIndex += 1) {
            drawLine(
              page,
              regularFont,
              cell.lines[lineIndex],
              column.x + TEMPLATE_POS.medicineGrid.cellPaddingX,
              row.yTop +
                TEMPLATE_POS.medicineGrid.cellPaddingY +
                lineIndex * bodyLayout.tableLineHeight,
              bodyLayout.tableTextSize
            );
          }
        }
      }
    }
  }

  if (bodyLayout.advice.headingY != null) {
    drawLine(
      page,
      boldFont,
      bodyLayout.advice.heading,
      TEMPLATE_POS.bodyArea.x,
      bodyLayout.advice.headingY,
      bodyLayout.headingSize
    );
    for (const line of bodyLayout.advice.lines) {
      drawLine(page, regularFont, line.text, TEMPLATE_POS.bodyArea.x, line.yTop, line.size);
    }
  }

  if (signatureDataUrl) {
    const signatureResponse = await fetch(signatureDataUrl);
    const signatureBytes = await signatureResponse.arrayBuffer();
    const signatureUint8 = new Uint8Array(signatureBytes);
    const contentType = (signatureResponse.headers.get("content-type") || "").toLowerCase();
    const sourceLower = String(signatureDataUrl).toLowerCase();

    const looksLikePng =
      contentType.includes("png") ||
      sourceLower.startsWith("data:image/png") ||
      sourceLower.includes(".png");

    const looksLikeJpg =
      contentType.includes("jpeg") ||
      contentType.includes("jpg") ||
      sourceLower.startsWith("data:image/jpeg") ||
      sourceLower.startsWith("data:image/jpg") ||
      sourceLower.includes(".jpeg") ||
      sourceLower.includes(".jpg");

    let signatureImage;
    if (looksLikePng) {
      signatureImage = await pdfDoc.embedPng(signatureUint8);
    } else if (looksLikeJpg) {
      signatureImage = await pdfDoc.embedJpg(signatureUint8);
    } else {
      try {
        signatureImage = await pdfDoc.embedPng(signatureUint8);
      } catch {
        signatureImage = await pdfDoc.embedJpg(signatureUint8);
      }
    }

    page.drawImage(signatureImage, {
      x: TEMPLATE_POS.signature.x,
      y: toPdfRectY(TEMPLATE_POS.signature.yTop, TEMPLATE_POS.signature.height),
      width: TEMPLATE_POS.signature.width,
      height: TEMPLATE_POS.signature.height,
    });
  }

  if (doctor?.name) {
    drawFittedLine(page, boldFont, `Dr. ${sanitizeInlineText(doctor.name)}`, TEMPLATE_POS.doctorNameFooter, {
      align: "right",
    });
  }

  // Timings intentionally suppressed on final prescription output.

  if (String(pageSize).toLowerCase() !== "letter") {
    return pdfDoc.save();
  }

  const renderedBytes = await pdfDoc.save();
  const letterDoc = await PDFDocument.create();
  const [embeddedPage] = await letterDoc.embedPdf(renderedBytes, [0]);
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
