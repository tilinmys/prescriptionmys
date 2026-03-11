export function valueOrDash(value) {
  return value && String(value).trim() ? String(value).trim() : "-";
}

export function valueOrBlank(value) {
  return value && String(value).trim() ? String(value).trim() : "";
}

export function sanitizeInlineText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function wrapTextByWidth(text, maxWidth, measureWidth) {
  if (!text || !String(text).trim()) return [""];

  const words = String(text).trim().split(/\s+/);
  const rows = [];
  let current = "";

  function splitLongWordByWidth(word) {
    if (measureWidth(word) <= maxWidth) return [word];

    const parts = [];
    let chunk = "";
    for (const char of word) {
      const trial = `${chunk}${char}`;
      if (!chunk || measureWidth(trial) <= maxWidth) {
        chunk = trial;
      } else {
        parts.push(chunk);
        chunk = char;
      }
    }
    if (chunk) parts.push(chunk);
    return parts;
  }

  for (const word of words) {
    const fragments = splitLongWordByWidth(word);
    for (let index = 0; index < fragments.length; index += 1) {
      const fragment = fragments[index];
      if (!current) {
        current = fragment;
        continue;
      }

      const needsSpace = index === 0;
      const trial = needsSpace ? `${current} ${fragment}` : `${current}${fragment}`;
      if (measureWidth(trial) <= maxWidth) {
        current = trial;
      } else {
        rows.push(current);
        current = fragment;
      }
    }
  }

  if (current) rows.push(current);
  return rows;
}

function trimLineToWidthWithEllipsis(line, maxWidth, measureWidth) {
  const ellipsis = "...";
  if (!line) return ellipsis;
  if (measureWidth(line) <= maxWidth) return line;

  let output = line;
  while (output && measureWidth(`${output}${ellipsis}`) > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output || ""}${ellipsis}`;
}

export function fitWrappedLinesToTemplate({
  rawLines,
  preferredSize,
  minSize,
  maxWidth,
  maxLines,
  measureAtSize,
  widthSafety = 0.88,
}) {
  const floorSize = Math.min(preferredSize, Math.max(minSize, 10));
  const safeWidth = Math.max(20, maxWidth * widthSafety);
  let size = preferredSize;
  let lines = [];

  while (size >= floorSize) {
    lines = rawLines.flatMap((line) =>
      wrapTextByWidth(line, safeWidth, (value) => measureAtSize(value, size))
    );
    if (lines.length <= maxLines) break;
    size -= 1;
  }

  // Compact mode: remove intentional spacer rows before clipping.
  if (lines.length > maxLines) {
    const compactRawLines = rawLines.filter((line) => String(line || "").trim());
    const compactLines = compactRawLines.flatMap((line) =>
      wrapTextByWidth(line, safeWidth, (value) => measureAtSize(value, size))
    );
    if (compactLines.length <= maxLines) {
      lines = compactLines;
    } else {
      lines = compactLines;
    }
  }

  let isClipped = false;
  if (lines.length > maxLines) {
    const clipped = lines.slice(0, maxLines);
    const lastIndex = clipped.length - 1;
    clipped[lastIndex] = trimLineToWidthWithEllipsis(
      clipped[lastIndex],
      safeWidth,
      (value) => measureAtSize(value, size)
    );
    lines = clipped;
    isClipped = true;
  }

  return { lines, size, isClipped };
}

function compactMedicineLine(item, index) {
  const parts = [];
  if (item.medicine) parts.push(item.medicine);
  if (item.dosage) parts.push(item.dosage);
  if (item.frequency) parts.push(item.frequency);
  if (item.duration) parts.push(item.duration);
  if (item.notes) parts.push(`Remark: ${item.notes}`);
  if (!parts.length) return null;
  return `${index + 1}. ${parts.join(" | ")}`;
}

function splitClinicalParagraphs(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function normalizeMedicineGridRows(medicines) {
  return (medicines || [])
    .map((item) => {
      const type = sanitizeInlineText(item?.type);
      const medicine = sanitizeInlineText(item?.medicine);
      const mealTiming = sanitizeInlineText(item?.mealTiming);
      const notes = [mealTiming, sanitizeInlineText(item?.notes)].filter(Boolean).join(" | ");

      return {
      medicine: [type, medicine].filter(Boolean).join(" "),
      dosage: sanitizeInlineText(item?.dosage),
      frequency: sanitizeInlineText(item?.frequency),
      duration: sanitizeInlineText(item?.duration),
      notes,
    };
    })
    .filter((item) => item.medicine || item.dosage || item.frequency || item.duration || item.notes);
}

export function buildPrescriptionBlocks({ patient, vitals, diagnosis, advice, medicines }) {
  return {
    diagnosisParagraphs: splitClinicalParagraphs(diagnosis),
    adviceParagraphs: splitClinicalParagraphs(advice),
    medicineRows: normalizeMedicineGridRows(medicines),
  };
}

function trimLinesToFitWithEllipsis(lines, maxWidth, measureWidth) {
  if (!lines.length) return lines;
  const output = [...lines];
  output[output.length - 1] = trimLineToWidthWithEllipsis(
    output[output.length - 1],
    maxWidth,
    measureWidth
  );
  return output;
}

function buildColumnBounds(columns, startX, totalWidth) {
  let cursor = startX;
  return columns.map((column, index) => {
    const isLast = index === columns.length - 1;
    const width = isLast ? startX + totalWidth - cursor : Math.round(totalWidth * column.ratio);
    const bound = {
      ...column,
      x: cursor,
      width,
    };
    cursor += width;
    return bound;
  });
}

function buildBodyLayoutAtSize({
  blocks,
  area,
  columns,
  size,
  measureAtSize,
  gridCellPaddingX,
  gridCellPaddingY,
  gridMinRowHeight,
}) {
  const headingSize = Math.max(Math.round(size * 0.96), 11);
  const textSize = size;
  const lineHeight = Math.max(textSize * 1.25, textSize + 5);
  const sectionGap = Math.max(size * 0.48, 10);
  const paragraphGap = Math.max(size * 0.3, 7);
  const tableHeaderSize = Math.max(Math.round(size * 0.54), 10);
  const tableTextSize = Math.max(Math.round(size * 0.74), 11);
  const tableLineHeight = Math.max(tableTextSize * 1.2, tableTextSize + 2);
  const tableHeaderHeight = tableLineHeight + gridCellPaddingY * 2;
  const maxY = area.maxY;

  const layout = {
    clipped: false,
    finalY: area.yTop,
    size: textSize,
    headingSize,
    lineHeight,
    tableHeaderSize,
    tableTextSize,
    tableLineHeight,
    diagnosis: { headingY: null, lines: [] },
    medicines: { headingY: null, columns: [], headerY: null, rows: [], bottomY: null },
    advice: { headingY: null, lines: [] },
  };

  let y = area.yTop;

  function fits(height) {
    return y + height <= maxY;
  }

  function addTextLine(sectionLines, text, fontSize, maxWidth) {
    if (!fits(lineHeight)) {
      layout.clipped = true;
      if (sectionLines.length) {
        sectionLines[sectionLines.length - 1].text = trimLineToWidthWithEllipsis(
          sectionLines[sectionLines.length - 1].text,
          maxWidth,
          (value) => measureAtSize(value, sectionLines[sectionLines.length - 1].size)
        );
      }
      return false;
    }

    sectionLines.push({ yTop: y, text, size: fontSize });
    y += lineHeight;
    return true;
  }

  function addSectionHeading(target, label) {
    const headingHeight = headingSize + 2;
    if (!fits(headingHeight)) {
      layout.clipped = true;
      return false;
    }
    target.headingY = y;
    target.heading = label;
    y += headingHeight;
    return true;
  }

  if (blocks.diagnosisParagraphs.length) {
    if (addSectionHeading(layout.diagnosis, "Diagnosis")) {
      for (const paragraph of blocks.diagnosisParagraphs) {
        const wrapped = wrapTextByWidth(paragraph, area.width, (value) =>
          measureAtSize(value, textSize)
        );
        for (const line of wrapped) {
          if (!addTextLine(layout.diagnosis.lines, line, textSize, area.width)) break;
        }
        if (layout.clipped) break;
        if (fits(paragraphGap)) {
          y += paragraphGap;
        } else {
          layout.clipped = true;
          break;
        }
      }
      y += sectionGap;
    }
  }

  if (!layout.clipped && blocks.medicineRows.length) {
    const medicinesSection = layout.medicines;
    if (addSectionHeading(medicinesSection, "Medicines")) {
      const columnBounds = buildColumnBounds(columns, area.x, area.width);
      medicinesSection.columns = columnBounds;

      if (!fits(tableHeaderHeight)) {
        layout.clipped = true;
      } else {
        medicinesSection.headerY = y;
        y += tableHeaderHeight;
      }

      for (const row of blocks.medicineRows) {
        if (layout.clipped) break;
        const cellLayouts = columnBounds.map((column) => {
          const content = sanitizeInlineText(row[column.key]) || "-";
          const wrapped = wrapTextByWidth(
            content,
            Math.max(column.width - gridCellPaddingX * 2, 20),
            (value) => measureAtSize(value, tableTextSize)
          );
          return { key: column.key, lines: wrapped.length ? wrapped : ["-"] };
        });
        const maxCellLines = Math.max(...cellLayouts.map((cell) => cell.lines.length));
        const rowHeight = Math.max(
          gridMinRowHeight,
          maxCellLines * tableLineHeight + gridCellPaddingY * 2
        );

        if (!fits(rowHeight)) {
          layout.clipped = true;
          break;
        }

        medicinesSection.rows.push({
          yTop: y,
          height: rowHeight,
          cells: cellLayouts,
        });
        y += rowHeight;
      }

      medicinesSection.bottomY = y;
      y += sectionGap;
    }
  }

  if (!layout.clipped && blocks.adviceParagraphs.length) {
    if (addSectionHeading(layout.advice, "Advice")) {
      for (const paragraph of blocks.adviceParagraphs) {
        const wrapped = wrapTextByWidth(paragraph, area.width, (value) =>
          measureAtSize(value, textSize)
        );
        const renderedLines = [];
        for (const line of wrapped) {
          if (!fits(lineHeight)) {
            layout.clipped = true;
            break;
          }
          renderedLines.push(line);
          layout.advice.lines.push({ yTop: y, text: line, size: textSize });
          y += lineHeight;
        }
        if (layout.clipped) {
          if (renderedLines.length) {
            const currentLines = layout.advice.lines.slice(-renderedLines.length).map((l) => l.text);
            const clippedLines = trimLinesToFitWithEllipsis(
              currentLines,
              area.width,
              (value) => measureAtSize(value, textSize)
            );
            for (let i = 0; i < clippedLines.length; i += 1) {
              layout.advice.lines[layout.advice.lines.length - renderedLines.length + i].text =
                clippedLines[i];
            }
          }
          break;
        }
        if (fits(paragraphGap)) {
          y += paragraphGap;
        } else {
          layout.clipped = true;
          break;
        }
      }
    }
  }

  layout.finalY = y;
  return layout;
}

export function composePrescriptionBodyLayout({
  blocks,
  area,
  columns,
  preferredSize,
  minSize,
  measureAtSize,
  gridCellPaddingX,
  gridCellPaddingY,
  gridMinRowHeight,
}) {
  const normalizedColumns = columns.filter((column) => column.ratio > 0);
  const ceiling = Math.max(preferredSize, minSize);
  const floor = Math.min(preferredSize, minSize);
  let best = null;

  for (let size = ceiling; size >= floor; size -= 1) {
    const attempt = buildBodyLayoutAtSize({
      blocks,
      area,
      columns: normalizedColumns,
      size,
      measureAtSize,
      gridCellPaddingX,
      gridCellPaddingY,
      gridMinRowHeight,
    });

    best = attempt;
    if (!attempt.clipped) {
      return attempt;
    }
  }

  return best;
}

function buildVitalsLine(vitals) {
  const chunks = [];
  const weight = String(vitals?.weight || "").trim();
  const bloodPressure = String(vitals?.bloodPressure || "").trim();
  const pulse = String(vitals?.pulse || "").trim();
  const spo2 = String(vitals?.spo2 || "").trim();

  if (bloodPressure) chunks.push(`BP ${bloodPressure}`);
  if (pulse) chunks.push(`Pulse ${pulse}`);
  if (spo2) chunks.push(`SpO2 ${spo2}`);
  if (weight) chunks.push(`Wt ${weight}`);
  if (!chunks.length) return "";
  return `Vitals: ${chunks.join(" | ")}`;
}

export function buildPrescriptionLines({ diagnosis, medicines, advice, vitals }) {
  const lines = [];
  const vitalsLine = buildVitalsLine(vitals);

  if (vitalsLine) {
    lines.push(vitalsLine);
    lines.push("");
  }

  if (diagnosis && diagnosis.trim()) {
    const diagnosisParagraphs = splitClinicalParagraphs(diagnosis);
    lines.push("Diagnosis:");
    lines.push(...(diagnosisParagraphs.length ? diagnosisParagraphs : [diagnosis.trim()]));
    lines.push("");
  }

  const medLines =
    medicines
      ?.map((item, index) => compactMedicineLine(item, index))
      .filter(Boolean) || [];

  if (medLines.length) {
    lines.push("Medicines:");
    lines.push(...medLines);
  }

  if (advice && advice.trim()) {
    const adviceParagraphs = splitClinicalParagraphs(advice);
    if (medLines.length) lines.push("");
    lines.push("Advice:");
    lines.push(...(adviceParagraphs.length ? adviceParagraphs : [advice.trim()]));
  }

  return lines;
}
