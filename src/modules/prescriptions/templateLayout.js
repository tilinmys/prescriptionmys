export const TEMPLATE_PAGE = {
  width: 1008,
  height: 1296,
};

// Coordinates are based on the provided "Design - Front V1.pdf" template.
// yTop values are measured from the top edge of the template.
export const TEMPLATE_POS = {
  // Precise logo cleanup zones for PDF export.
  // corner mask removes the tiny top-left remnant from the base template logo.
  logoCornerMask: { x: 0, yTop: 0, width: 112, height: 48 },
  logoMask: { x: 20, yTop: 10, width: 382, height: 112 },
  logo: { x: 42, yTop: 22, width: 270, height: 79 },
  // Calibrated against text matrix coordinates from Design - Front V1.pdf
  date: { x: 736, yTop: 170, size: 20, minSize: 15, maxWidth: 245 },
  doctorHeaderName: { x: 286, yTop: 166, size: 19, minSize: 14, maxWidth: 360 },
  doctorHeaderReg: { x: 286, yTop: 190, size: 15, minSize: 12, maxWidth: 360 },
  patientName: { x: 286, yTop: 219, size: 22, minSize: 15, maxWidth: 470 },
  age: { x: 818, yTop: 224, size: 22, minSize: 15, maxWidth: 115 },
  bodyArea: {
    x: 72,
    yTop: 300,
    width: 812,
    maxY: 1028,
    preferredSize: 24,
    minSize: 14,
  },
  medicineGrid: {
    columns: [
      { key: "medicine", label: "Medicine", ratio: 0.3 },
      { key: "dosage", label: "Dosage", ratio: 0.14 },
      { key: "frequency", label: "Frequency", ratio: 0.16 },
      { key: "duration", label: "Duration", ratio: 0.14 },
      { key: "notes", label: "Remarks", ratio: 0.26 },
    ],
    cellPaddingX: 8,
    cellPaddingY: 5,
    minRowHeight: 24,
  },
  medicineStart: {
    x: 72,
    yTop: 300,
    size: 22,
    minSize: 12,
    maxWidth: 812,
    lineHeight: 34,
    maxLines: 24,
  },
  signature: { x: 712, yTop: 1058, width: 238, height: 66 },
  doctorNameFooter: { x: 640, yTop: 1122, size: 28, minSize: 18, maxWidth: 320 },
  // Keep timings below patient/date line zone to avoid any header overlap.
  clinicTimingsHours: { x: 286, yTop: 245, size: 12.5, minSize: 11, maxWidth: 430 },
  clinicTimingsClosed: { x: 286, yTop: 261, size: 12.5, minSize: 11, maxWidth: 430 },
};
