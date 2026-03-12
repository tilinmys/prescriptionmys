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
  // Repaint the full right-side clinic contact block to avoid template text crossover.
  clinicHeaderMask: { x: 500, yTop: 14, width: 508, height: 118 },
  clinicHeaderBlock: {
    x: 592,
    yTop: 22,
    width: 360,
    lineGap: 21,
    lines: [
      { text: "MyStree #3366, 1st Floor, 13th Main Road,", size: 15.8, bold: true },
      { text: "HAL 2nd Stage", size: 14.2 },
      { text: "Indiranagar, Bengaluru, 560008", size: 14.2 },
      { text: "info@mystree.org | www.my-stree.com", size: 13.7 },
      { text: "+91 6366573772", size: 13.7 },
    ],
  },
  date: { x: 736, yTop: 170, size: 20, minSize: 15, maxWidth: 245 },
  patientName: { x: 286, yTop: 219, size: 22, minSize: 15, maxWidth: 470 },
  age: { x: 818, yTop: 224, size: 22, minSize: 15, maxWidth: 115 },
  vitalsColumn: {
    x: 832,
    yTop: 268,
    width: 186,
    heading: "Vitals",
    headingSize: 13,
    labelWidth: 72,
    rowGap: 14,
    labelSize: 14,
    valueSize: 15,
    valueMinSize: 10,
  },
  bodyArea: {
    x: 72,
    yTop: 336,
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
    yTop: 336,
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
