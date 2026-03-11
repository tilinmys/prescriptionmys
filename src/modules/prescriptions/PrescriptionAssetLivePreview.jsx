import { useEffect, useMemo, useRef, useState } from "react";
import templatePdf from "../../../assets/Design - Front V1.pdf";
import {
  buildPrescriptionBlocks,
  composePrescriptionBodyLayout,
  sanitizeInlineText,
  valueOrBlank,
  valueOrDash,
} from "./prescriptionTemplateUtils";
import { TEMPLATE_PAGE, TEMPLATE_POS } from "./templateLayout";

const PREVIEW_FONT_FAMILY = "Arial, sans-serif";
const PREVIEW_FONT_WEIGHT = 700;
const measureCanvas =
  typeof document !== "undefined" ? document.createElement("canvas") : null;
const measureContext = measureCanvas?.getContext("2d") || null;

function measureTextWidth(text, size) {
  if (!measureContext) {
    return String(text || "").length * size * 0.56;
  }
  measureContext.font = `${PREVIEW_FONT_WEIGHT} ${size}px ${PREVIEW_FONT_FAMILY}`;
  return measureContext.measureText(String(text || "")).width;
}

function fitPreviewTextSize(text, cfg) {
  if (!cfg.maxWidth) return cfg.size;
  let size = cfg.size;
  const minSize = cfg.minSize || Math.max(cfg.size - 8, 10);
  while (size > minSize && measureTextWidth(text, size) > cfg.maxWidth) {
    size -= 0.5;
  }
  return size;
}

function getVitalsRows(vitals) {
  return [
    { key: "bp", label: "BP", value: valueOrDash(vitals?.bloodPressure) },
    { key: "pulse", label: "Pulse", value: valueOrDash(vitals?.pulse) },
    { key: "spo2", label: "SpO2", value: valueOrDash(vitals?.spo2) },
    { key: "weight", label: "Weight", value: valueOrDash(vitals?.weight) },
  ];
}

export default function PrescriptionAssetLivePreview({
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
}) {
  const frameRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewWidth, setPreviewWidth] = useState(TEMPLATE_PAGE.width);

  useEffect(() => {
    const node = frameRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const width = entry?.contentRect?.width || 0;
      if (!width) return;
      setPreviewWidth(width);
      setPreviewScale(width / TEMPLATE_PAGE.width);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const dateText = valueOrDash(date);
  const patientNameText = valueOrBlank(patient?.name);
  const ageText = valueOrBlank(patient?.age);
  const doctorNameText = doctor?.name ? `Dr. ${doctor.name}` : "";

  const dateSize = useMemo(
    () => fitPreviewTextSize(dateText, TEMPLATE_POS.date),
    [dateText]
  );
  const clinicHeaderNameSize = useMemo(
    () => fitPreviewTextSize("MyStree Clinic", TEMPLATE_POS.clinicHeaderName),
    []
  );
  const clinicHeaderCodeSize = useMemo(
    () => fitPreviewTextSize("#3366", TEMPLATE_POS.clinicHeaderCode),
    []
  );
  const patientNameSize = useMemo(
    () => fitPreviewTextSize(patientNameText, TEMPLATE_POS.patientName),
    [patientNameText]
  );
  const ageSize = useMemo(
    () => fitPreviewTextSize(ageText, TEMPLATE_POS.age),
    [ageText]
  );
  const doctorNameSize = useMemo(
    () => fitPreviewTextSize(doctorNameText, TEMPLATE_POS.doctorNameFooter),
    [doctorNameText]
  );
  const vitalsRows = useMemo(() => getVitalsRows(vitals), [vitals]);

  const bodyLayout = useMemo(() => {
    const blocks = buildPrescriptionBlocks({ patient, vitals, diagnosis, advice, medicines });
    return composePrescriptionBodyLayout({
      blocks,
      area: TEMPLATE_POS.bodyArea,
      columns: TEMPLATE_POS.medicineGrid.columns,
      preferredSize: TEMPLATE_POS.bodyArea.preferredSize,
      minSize: TEMPLATE_POS.bodyArea.minSize,
      measureAtSize: (value, size) => measureTextWidth(value, size),
      gridCellPaddingX: TEMPLATE_POS.medicineGrid.cellPaddingX,
      gridCellPaddingY: TEMPLATE_POS.medicineGrid.cellPaddingY,
      gridMinRowHeight: TEMPLATE_POS.medicineGrid.minRowHeight,
    });
  }, [patient, vitals, diagnosis, advice, medicines]);
  const basePreviewHeight = useMemo(
    () => (previewWidth * TEMPLATE_PAGE.height) / TEMPLATE_PAGE.width,
    [previewWidth]
  );
  const contentBottomInTemplate = useMemo(() => {
    const bodyBottom = bodyLayout.finalY || TEMPLATE_POS.bodyArea.yTop;
    const signatureBottom = TEMPLATE_POS.signature.yTop + TEMPLATE_POS.signature.height;
    const doctorBottom = TEMPLATE_POS.doctorNameFooter.yTop + doctorNameSize * 1.4;
    return Math.max(TEMPLATE_PAGE.height, bodyBottom + 42, signatureBottom + 20, doctorBottom + 20);
  }, [bodyLayout.finalY, doctorNameSize]);
  const previewHeight = useMemo(
    () => Math.max(basePreviewHeight, contentBottomInTemplate * previewScale),
    [basePreviewHeight, contentBottomInTemplate, previewScale]
  );

  return (
    <div
      ref={frameRef}
      className="relative mx-auto w-full max-w-[820px] overflow-hidden rounded-lg border border-[#8BA4BF]/25 bg-white shadow-[0_20px_40px_rgba(0,0,0,0.12)]"
      style={{ height: `${previewHeight}px` }}
    >
      <iframe
        title="Prescription Template PDF"
        src={`${templatePdf}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
        className="pointer-events-none absolute left-0 top-0 w-full select-none"
        style={{ height: `${basePreviewHeight}px` }}
        draggable={false}
      />

      <div className="pointer-events-none absolute inset-0 text-[#1f2937]">
        <div
          className="absolute"
          style={{
            left: `${TEMPLATE_POS.date.x * previewScale}px`,
            top: `${TEMPLATE_POS.date.yTop * previewScale}px`,
            fontSize: `${dateSize * previewScale}px`,
            maxWidth: `${TEMPLATE_POS.date.maxWidth * previewScale}px`,
            whiteSpace: "nowrap",
            overflow: "hidden",
            fontFamily: PREVIEW_FONT_FAMILY,
            fontWeight: PREVIEW_FONT_WEIGHT,
          }}
        >
          {dateText}
        </div>

        <div
          className="absolute text-right"
          style={{
            left: `${TEMPLATE_POS.clinicHeaderName.x * previewScale}px`,
            top: `${TEMPLATE_POS.clinicHeaderName.yTop * previewScale}px`,
            width: `${TEMPLATE_POS.clinicHeaderName.maxWidth * previewScale}px`,
            fontSize: `${clinicHeaderNameSize * previewScale}px`,
            whiteSpace: "nowrap",
            overflow: "hidden",
            fontFamily: PREVIEW_FONT_FAMILY,
            fontWeight: 700,
            color: "#ED5B2D",
          }}
        >
          MyStree Clinic
        </div>

        <div
          className="absolute text-right"
          style={{
            left: `${TEMPLATE_POS.clinicHeaderCode.x * previewScale}px`,
            top: `${TEMPLATE_POS.clinicHeaderCode.yTop * previewScale}px`,
            width: `${TEMPLATE_POS.clinicHeaderCode.maxWidth * previewScale}px`,
            fontSize: `${clinicHeaderCodeSize * previewScale}px`,
            whiteSpace: "nowrap",
            overflow: "hidden",
            fontFamily: PREVIEW_FONT_FAMILY,
            fontWeight: 600,
            color: "#475569",
          }}
        >
          #3366
        </div>

        <div
          className="absolute"
          style={{
            left: `${TEMPLATE_POS.patientName.x * previewScale}px`,
            top: `${TEMPLATE_POS.patientName.yTop * previewScale}px`,
            fontSize: `${patientNameSize * previewScale}px`,
            maxWidth: `${TEMPLATE_POS.patientName.maxWidth * previewScale}px`,
            whiteSpace: "nowrap",
            overflow: "hidden",
            fontFamily: PREVIEW_FONT_FAMILY,
            fontWeight: PREVIEW_FONT_WEIGHT,
          }}
        >
          {patientNameText}
        </div>

        <div
          className="absolute"
          style={{
            left: `${TEMPLATE_POS.age.x * previewScale}px`,
            top: `${TEMPLATE_POS.age.yTop * previewScale}px`,
            fontSize: `${ageSize * previewScale}px`,
            maxWidth: `${TEMPLATE_POS.age.maxWidth * previewScale}px`,
            whiteSpace: "nowrap",
            overflow: "hidden",
            fontFamily: PREVIEW_FONT_FAMILY,
            fontWeight: PREVIEW_FONT_WEIGHT,
          }}
        >
          {ageText}
        </div>

        {vitalsRows.map((row, index) => {
          const yTop = TEMPLATE_POS.vitalsColumn.yTop + index * TEMPLATE_POS.vitalsColumn.rowGap;
          const valueSize = fitPreviewTextSize(row.value, {
            size: TEMPLATE_POS.vitalsColumn.valueSize,
            minSize: TEMPLATE_POS.vitalsColumn.valueMinSize,
            maxWidth: TEMPLATE_POS.vitalsColumn.width - TEMPLATE_POS.vitalsColumn.labelWidth,
          });

          return (
            <div key={row.key}>
              <div
                className="absolute"
                style={{
                  left: `${TEMPLATE_POS.vitalsColumn.x * previewScale}px`,
                  top: `${yTop * previewScale}px`,
                  width: `${TEMPLATE_POS.vitalsColumn.labelWidth * previewScale}px`,
                  fontSize: `${TEMPLATE_POS.vitalsColumn.labelSize * previewScale}px`,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  fontFamily: "Arial, sans-serif",
                  fontWeight: 600,
                  color: "#334155",
                }}
              >
                {row.label}:
              </div>
              <div
                className="absolute"
                style={{
                  left: `${(TEMPLATE_POS.vitalsColumn.x + TEMPLATE_POS.vitalsColumn.labelWidth) * previewScale}px`,
                  top: `${yTop * previewScale}px`,
                  width: `${
                    (TEMPLATE_POS.vitalsColumn.width - TEMPLATE_POS.vitalsColumn.labelWidth) *
                    previewScale
                  }px`,
                  fontSize: `${valueSize * previewScale}px`,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  fontFamily: PREVIEW_FONT_FAMILY,
                  fontWeight: 700,
                  color: "#1f2937",
                }}
              >
                {row.value}
              </div>
            </div>
          );
        })}

        {TEMPLATE_POS.vitalsColumn?.heading ? (
          <div
            className="absolute uppercase tracking-[0.14em]"
            style={{
              left: `${TEMPLATE_POS.vitalsColumn.x * previewScale}px`,
              top: `${(TEMPLATE_POS.vitalsColumn.yTop - 12) * previewScale}px`,
              fontSize: `${(TEMPLATE_POS.vitalsColumn.headingSize || 11) * previewScale}px`,
              fontFamily: PREVIEW_FONT_FAMILY,
              fontWeight: 700,
              color: "#64748b",
            }}
          >
            {TEMPLATE_POS.vitalsColumn.heading}
          </div>
        ) : null}

        {bodyLayout.diagnosis.headingY != null ? (
          <div
            className="absolute"
            style={{
              left: `${TEMPLATE_POS.bodyArea.x * previewScale}px`,
              top: `${bodyLayout.diagnosis.headingY * previewScale}px`,
              fontSize: `${bodyLayout.headingSize * previewScale}px`,
              fontFamily: PREVIEW_FONT_FAMILY,
              fontWeight: 700,
            }}
          >
            {bodyLayout.diagnosis.heading}
          </div>
        ) : null}
        {bodyLayout.diagnosis.lines.map((line, index) => (
          <div
            key={`diag-${index}`}
            className="absolute"
            style={{
              left: `${TEMPLATE_POS.bodyArea.x * previewScale}px`,
              top: `${line.yTop * previewScale}px`,
              fontSize: `${line.size * previewScale}px`,
              maxWidth: `${TEMPLATE_POS.bodyArea.width * previewScale}px`,
              whiteSpace: "nowrap",
              overflow: "hidden",
              fontFamily: "Arial, sans-serif",
              fontWeight: 600,
            }}
          >
            {line.text}
          </div>
        ))}

        {bodyLayout.medicines.headingY != null ? (
          <div
            className="absolute"
            style={{
              left: `${TEMPLATE_POS.bodyArea.x * previewScale}px`,
              top: `${bodyLayout.medicines.headingY * previewScale}px`,
              fontSize: `${bodyLayout.headingSize * previewScale}px`,
              fontFamily: PREVIEW_FONT_FAMILY,
              fontWeight: 700,
            }}
          >
            {bodyLayout.medicines.heading}
          </div>
        ) : null}

        {bodyLayout.medicines.headerY != null && bodyLayout.medicines.bottomY != null ? (
          <div
            className="absolute border border-[#8BA4BF]/75 bg-white/10"
            style={{
              left: `${TEMPLATE_POS.bodyArea.x * previewScale}px`,
              top: `${bodyLayout.medicines.headerY * previewScale}px`,
              width: `${TEMPLATE_POS.bodyArea.width * previewScale}px`,
              height: `${(bodyLayout.medicines.bottomY - bodyLayout.medicines.headerY) * previewScale}px`,
            }}
          >
            <div
              className="absolute left-0 top-0 border-b border-[#8BA4BF]/70 bg-[#BFE2FE]/45"
              style={{
                width: "100%",
                height: `${
                  (bodyLayout.tableLineHeight + TEMPLATE_POS.medicineGrid.cellPaddingY * 2) *
                  previewScale
                }px`,
              }}
            />
            {bodyLayout.medicines.columns.slice(0, -1).map((column, index) => (
              <div
                key={`grid-col-${index}`}
                className="absolute top-0 h-full border-r border-[#8BA4BF]/70"
                style={{
                  left: `${(column.x + column.width - TEMPLATE_POS.bodyArea.x) * previewScale}px`,
                }}
              />
            ))}
            {bodyLayout.medicines.rows.map((row, index) => (
              <div
                key={`grid-row-${index}`}
                className="absolute left-0 w-full border-t border-[#BFE2FE]"
                style={{ top: `${(row.yTop - bodyLayout.medicines.headerY) * previewScale}px` }}
              />
            ))}

            {bodyLayout.medicines.columns.map((column) => (
              <div
                key={`head-${column.key}`}
                className="absolute uppercase tracking-[0.08em] text-[#334155]"
                style={{
                  left: `${(column.x - TEMPLATE_POS.bodyArea.x + TEMPLATE_POS.medicineGrid.cellPaddingX) * previewScale}px`,
                  top: `${TEMPLATE_POS.medicineGrid.cellPaddingY * previewScale}px`,
                  maxWidth: `${
                    (column.width - TEMPLATE_POS.medicineGrid.cellPaddingX * 2) * previewScale
                  }px`,
                  fontSize: `${bodyLayout.tableHeaderSize * previewScale}px`,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  fontFamily: PREVIEW_FONT_FAMILY,
                  fontWeight: 700,
                }}
              >
                {column.label}
              </div>
            ))}

            {bodyLayout.medicines.rows.map((row, rowIndex) =>
              row.cells.map((cell, cellIndex) => {
                const column = bodyLayout.medicines.columns[cellIndex];
                return cell.lines.map((line, lineIndex) => (
                  <div
                    key={`cell-${rowIndex}-${cell.key}-${lineIndex}`}
                    className="absolute text-[#1f2937]"
                    style={{
                      left: `${
                        (column.x - TEMPLATE_POS.bodyArea.x + TEMPLATE_POS.medicineGrid.cellPaddingX) *
                        previewScale
                      }px`,
                      top: `${
                        (row.yTop -
                          bodyLayout.medicines.headerY +
                          TEMPLATE_POS.medicineGrid.cellPaddingY +
                          lineIndex * bodyLayout.tableLineHeight) *
                        previewScale
                      }px`,
                      maxWidth: `${
                        (column.width - TEMPLATE_POS.medicineGrid.cellPaddingX * 2) * previewScale
                      }px`,
                      fontSize: `${bodyLayout.tableTextSize * previewScale}px`,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      fontFamily: "Arial, sans-serif",
                      fontWeight: 600,
                    }}
                  >
                    {line}
                  </div>
                ));
              })
            )}
          </div>
        ) : null}

        {bodyLayout.advice.headingY != null ? (
          <div
            className="absolute"
            style={{
              left: `${TEMPLATE_POS.bodyArea.x * previewScale}px`,
              top: `${bodyLayout.advice.headingY * previewScale}px`,
              fontSize: `${bodyLayout.headingSize * previewScale}px`,
              fontFamily: PREVIEW_FONT_FAMILY,
              fontWeight: 700,
            }}
          >
            {bodyLayout.advice.heading}
          </div>
        ) : null}
        {bodyLayout.advice.lines.map((line, index) => (
          <div
            key={`advice-${index}`}
            className="absolute"
            style={{
              left: `${TEMPLATE_POS.bodyArea.x * previewScale}px`,
              top: `${line.yTop * previewScale}px`,
              fontSize: `${line.size * previewScale}px`,
              maxWidth: `${TEMPLATE_POS.bodyArea.width * previewScale}px`,
              whiteSpace: "nowrap",
              overflow: "hidden",
              fontFamily: "Arial, sans-serif",
              fontWeight: 600,
            }}
          >
            {line.text}
          </div>
        ))}

        {signatureDataUrl ? (
          <img
            src={signatureDataUrl}
            alt="Doctor signature"
            className="absolute object-contain"
            style={{
              left: `${TEMPLATE_POS.signature.x * previewScale}px`,
              top: `${TEMPLATE_POS.signature.yTop * previewScale}px`,
              width: `${TEMPLATE_POS.signature.width * previewScale}px`,
              height: `${TEMPLATE_POS.signature.height * previewScale}px`,
            }}
          />
        ) : null}

        {doctorNameText ? (
          <div
            className="absolute"
            style={{
              left: `${TEMPLATE_POS.doctorNameFooter.x * previewScale}px`,
              top: `${TEMPLATE_POS.doctorNameFooter.yTop * previewScale}px`,
              fontSize: `${doctorNameSize * previewScale}px`,
              width: `${TEMPLATE_POS.doctorNameFooter.maxWidth * previewScale}px`,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textAlign: "right",
              fontFamily: PREVIEW_FONT_FAMILY,
              fontWeight: 800,
            }}
          >
            {doctorNameText}
          </div>
        ) : null}

        {bodyLayout.clipped ? (
          <div className="absolute bottom-[6%] left-[7%] rounded-md bg-[#ED5B2D]/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
            Content trimmed to fit printable area
          </div>
        ) : null}
      </div>
    </div>
  );
}
