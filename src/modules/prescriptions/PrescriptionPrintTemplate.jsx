import mystreeLogo from "../../assets/mystreelogo-official.svg";
import {
  getVisibleVitalsRows,
  normalizeMedicineGridRows,
  valueOrBlank,
} from "./prescriptionTemplateUtils";

const MAX_MEDICINE_ROWS = 4;

function splitParagraphs(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatDoctorDisplayName(value) {
  const trimmed = valueOrBlank(value);
  if (!trimmed) return "";
  return /^dr\.?\s+/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
}

function buildVitalsSummary(patient, vitalsRows) {
  const map = Object.fromEntries(vitalsRows.map((item) => [item.key, item.value]));
  return [
    { label: "Age:", value: patient?.age },
    { label: "Gender:", value: patient?.gender },
    { label: "BP:", value: map.bloodPressure },
    { label: "Pulse:", value: map.pulse },
    { label: "SpO2:", value: map.spo2 },
    { label: "Weight:", value: map.weight },
  ];
}

function buildMedicineTableRows(medicines) {
  return normalizeMedicineGridRows(medicines)
    .slice(0, MAX_MEDICINE_ROWS)
    .map((row) => ({
      medicine: valueOrBlank(row.medicine),
      dosage: valueOrBlank(row.dosage),
      schedule: [valueOrBlank(row.frequency), valueOrBlank(row.duration)].filter(Boolean).join(" / "),
    }));
}

function buildMedicineNoteBlocks(medicines) {
  return normalizeMedicineGridRows(medicines)
    .slice(0, 4)
    .map((row, index) => {
      const pieces = [row.medicine, row.dosage, row.frequency, row.duration, row.notes].filter(Boolean);
      return {
        label: `Medicine ${index + 1}.`,
        text: pieces.join(" | "),
      };
    });
}

function MetricCell({ label, value, hasBottomBorder = true }) {
  return (
    <div
      className={`grid grid-cols-[170px_minmax(0,1fr)] ${hasBottomBorder ? "border-b border-black" : ""}`}
    >
      <div className="border-r border-black px-4 py-3 text-[15px] font-semibold leading-6 text-black">
        {label}
      </div>
      <div className="px-4 py-3 text-[15px] leading-6 text-black">{valueOrBlank(value)}</div>
    </div>
  );
}

function NoteBlock({ label, text }) {
  return (
    <div className="min-h-[138px]">
      <div className="flex items-start gap-3">
        <div className="mt-1 h-5 w-5 border border-black bg-white" />
        <p className="text-[20px] font-semibold leading-8 text-black">{label}</p>
      </div>
      <div className="mt-2 min-h-[72px] pl-8 text-[14px] leading-6 tracking-[0.01em] text-black whitespace-pre-wrap [overflow-wrap:anywhere]">
        {valueOrBlank(text)}
      </div>
    </div>
  );
}

function ClinicHeader() {
  return (
    <header className="grid grid-cols-[minmax(0,1.08fr)_minmax(290px,0.92fr)] items-start gap-8">
      <div className="flex items-start">
        <img
          src={mystreeLogo}
          alt="My Stree Logo"
          className="h-auto w-[350px] max-w-full object-contain"
        />
      </div>
      <div className="justify-self-end text-right text-[16px] leading-[1.7] text-[#27344E]">
        <p>MyStree Clinic, #3366, 1st Floor, 13th Main Road</p>
        <p>HAL 2nd Stage, Indiranagar, Bengaluru, 560008</p>
        <p className="mt-2 text-[#ED5B2D]">info@mystree.org | www.my-stree.com</p>
        <p className="mt-1 text-[22px] font-bold text-[#0D1B36]">+91 63665 73772</p>
      </div>
    </header>
  );
}

export default function PrescriptionPrintTemplate({
  doctor,
  patient,
  diagnosis,
  advice,
  medicines,
  vitals,
  visibleVitalFields,
  date,
  signatureDataUrl,
  rootId = "print-area",
}) {
  const vitalsRows = getVisibleVitalsRows(vitals, visibleVitalFields).filter(
    (item) => String(item.value || "").trim() && item.value !== "-"
  );
  const summaryRows = buildVitalsSummary(patient, vitalsRows);
  const medicineTableRows = buildMedicineTableRows(medicines);
  const noteBlocks = [
    { label: "Diagnosis.", text: splitParagraphs(diagnosis).join("\n") },
    { label: "Advice.", text: splitParagraphs(advice).join("\n") },
    ...buildMedicineNoteBlocks(medicines),
  ];

  while (noteBlocks.length < 6) {
    noteBlocks.push({ label: `Notes ${noteBlocks.length - 1}.`, text: "" });
  }

  const doctorName = formatDoctorDisplayName(doctor?.name);
  const doctorRegistration = valueOrBlank(doctor?.registration);

  return (
    <div
      id={rootId}
      className="mx-auto flex min-h-[1220px] w-[860px] max-w-none flex-col bg-[#F7F7F6] px-10 pb-10 pt-8 text-black"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <ClinicHeader />

      <section className="mt-5 border-[1.5px] border-black bg-white">
        <div className="grid grid-cols-[minmax(0,1fr)_255px] items-start border-b border-black">
          <div className="px-4 py-3 text-[17px] font-semibold leading-8 text-black">
            Patient Name: <span className="font-normal">{valueOrBlank(patient?.name)}</span>
          </div>
          <div className="border-l border-black px-4 py-3 text-[17px] font-semibold leading-8 text-black">
            Date: <span className="font-normal">{valueOrBlank(date)}</span>
          </div>
        </div>
        <div className="px-4 py-3 text-[17px] font-semibold leading-8 text-black">
          Patient Details:{" "}
          <span className="font-normal">
            {[valueOrBlank(patient?.age), valueOrBlank(patient?.gender)].filter(Boolean).join(" / ")}
          </span>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-[1fr_1.03fr] gap-4">
        <div className="border-[1.5px] border-black bg-white">
          {summaryRows.map((row, index) => (
            <MetricCell
              key={row.label}
              label={row.label}
              value={row.value}
              hasBottomBorder={index < summaryRows.length - 1}
            />
          ))}
        </div>

        <div className="border-[1.5px] border-black bg-white">
          <div className="grid grid-cols-[1.3fr_0.75fr_1fr] border-b border-black">
            <div className="border-r border-black px-3 py-3 text-center text-[15px] font-semibold leading-6 text-black">
              Medicine
            </div>
            <div className="border-r border-black px-3 py-3 text-center text-[15px] font-semibold leading-6 text-black">
              Dose
            </div>
            <div className="px-3 py-3 text-center text-[15px] font-semibold leading-6 text-black">
              Schedule
            </div>
          </div>
          {Array.from({ length: MAX_MEDICINE_ROWS }).map((_, index) => {
            const row = medicineTableRows[index] || { medicine: "", dosage: "", schedule: "" };
            return (
              <div
                key={`med-table-${index}`}
                className={`grid grid-cols-[1.3fr_0.75fr_1fr] ${index < MAX_MEDICINE_ROWS - 1 ? "border-b border-black" : ""}`}
              >
                <div className="border-r border-black px-3 py-3 text-center text-[15px] font-semibold leading-6 text-black">
                  {row.medicine}
                </div>
                <div className="border-r border-black px-3 py-3 text-center text-[15px] leading-6 text-black">
                  {row.dosage}
                </div>
                <div className="px-3 py-3 text-center text-[15px] leading-6 text-black">
                  {row.schedule}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-6 grid flex-1 grid-cols-2 gap-x-10 gap-y-8">
        {noteBlocks.slice(0, 6).map((section) => (
          <NoteBlock key={section.label} label={section.label} text={section.text} />
        ))}
      </section>

      <footer className="mt-6">
        <div className="border-[1.5px] border-black bg-white px-4 py-3 text-[13px] leading-6 text-black">
          <span className="font-semibold">NOTICE:</span> This prescription is intended for use only
          as documented by the consulting doctor. Please follow dosage, duration, and advice exactly
          as written on this sheet.
        </div>

        <div className="mt-8 flex items-end justify-between gap-8">
          <div className="text-[16px] leading-8 text-black">
            <p>
              Clinician Signature:{" "}
              {signatureDataUrl ? (
                <img
                  src={signatureDataUrl}
                  alt="Clinician signature"
                  className="inline-block h-10 max-w-[160px] align-middle object-contain"
                />
              ) : null}
            </p>
            <p>
              License No: <span className="font-medium">{doctorRegistration}</span>
            </p>
          </div>
          {(doctorName || doctorRegistration) ? (
            <div className="text-right text-[14px] leading-7 text-black">
              {doctorName ? <p className="font-semibold text-[16px]">{doctorName}</p> : null}
              {doctorRegistration ? <p>{doctorRegistration}</p> : null}
            </div>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
