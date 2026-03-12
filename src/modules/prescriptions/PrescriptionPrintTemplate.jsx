import mystreeLogo from "../../assets/mystreelogo-official.svg";
import {
  getVisibleVitalsRows,
  normalizeMedicineGridRows,
  valueOrBlank,
} from "./prescriptionTemplateUtils";

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

function FieldLine({ label, value, widthClass = "", lineClassName = "", valueClassName = "" }) {
  const resolvedValue = valueOrBlank(value);

  return (
    <div className={`grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 ${widthClass}`}>
      <span className="whitespace-nowrap text-[14px] font-semibold leading-none text-[#27344e] sm:text-[15px]">
        {label}
      </span>
      <div
        className={`min-w-0 border-b border-dotted border-[#98A3B3] pb-1 text-[14px] font-medium text-[#1F2A40] sm:text-[15px] ${lineClassName}`}
        title={resolvedValue || undefined}
      >
        <span className={`block truncate leading-none ${valueClassName}`}>{resolvedValue}</span>
      </div>
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.32em] text-[#5E6E86] sm:text-[12px]">
      {children}
    </div>
  );
}

const MEDICINE_COLUMN_CONFIG = [
  { key: "medicine", label: "Medicine", ratio: 1.9 },
  { key: "dosage", label: "Dosage", ratio: 0.78 },
  { key: "frequency", label: "Frequency", ratio: 0.92 },
  { key: "duration", label: "Duration", ratio: 0.8 },
  { key: "notes", label: "Remarks", ratio: 1.25 },
];

function getVisibleMedicineColumns(rows) {
  return MEDICINE_COLUMN_CONFIG.filter((column) =>
    rows.some((row) => String(row?.[column.key] || "").trim())
  );
}

function VitalsPanel({ rows }) {
  if (!rows.length) return null;

  return (
    <aside className="w-full max-w-[112px]">
      <div className="mb-1 text-[6.5px] font-semibold uppercase tracking-[0.22em] text-[#5E6E86]">
        Vitals
      </div>
      <div className="overflow-hidden rounded-[10px] border border-[#D6DEE8] bg-white/92 shadow-[0_4px_10px_rgba(15,23,42,0.04)]">
        <div className="divide-y divide-[#E6EBF1]">
          {rows.map((item) => (
            <div
              key={item.key}
              className="grid grid-cols-[30px_minmax(0,1fr)] items-center gap-1.5 bg-[#F8FAFC] px-2 py-1.5"
            >
              <p className="text-[5.8px] font-semibold uppercase tracking-[0.14em] text-[#7B8AA3]">
                {item.label}
              </p>
              <p className="break-words text-right text-[7.5px] font-semibold text-[#1D2940]">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function MedicineTable({ rows }) {
  if (!rows.length) return null;
  const columns = getVisibleMedicineColumns(rows);
  if (!columns.length) return null;
  const totalRatio = columns.reduce((sum, column) => {
    const matched = MEDICINE_COLUMN_CONFIG.find((item) => item.key === column.key);
    return sum + (matched?.ratio || 1);
  }, 0);

  return (
    <section>
      <SectionHeading>Medicines</SectionHeading>
      <div className="w-full overflow-hidden rounded-[20px] border border-[#D6DEE8] bg-white/94 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            {columns.map((column) => {
              const matched = MEDICINE_COLUMN_CONFIG.find((item) => item.key === column.key);
              const widthPercent = ((matched?.ratio || 1) / totalRatio) * 100;
              return <col key={column.key} style={{ width: `${widthPercent}%` }} />;
            })}
          </colgroup>
          <thead className="border-b border-[#DDE5EE] bg-[#F5F8FC]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6B7A92]"
                >
                  <span className="block truncate">{column.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E7EDF4]">
            {rows.map((item, index) => (
              <tr key={`${item.medicine}-${index}`} className="align-middle">
                {columns.map((column) => {
                  const value = String(item?.[column.key] || "").trim();
                  const isMedicineColumn = column.key === "medicine";
                  const displayValue = isMedicineColumn && value ? `${index + 1}. ${value}` : value;

                  return (
                    <td
                      key={`${column.key}-${index}`}
                      className={`px-4 py-3 text-[14px] leading-6 text-[#24324B] ${isMedicineColumn ? "font-semibold text-[#18243A]" : ""}`}
                      title={displayValue || undefined}
                    >
                      <span className="block truncate">{displayValue}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
  rootId = "print-area",
}) {
  const vitalsRows = getVisibleVitalsRows(vitals, visibleVitalFields).filter(
    (item) => String(item.value || "").trim() && item.value !== "-"
  );
  const medicineRows = normalizeMedicineGridRows(medicines);
  const diagnosisParagraphs = splitParagraphs(diagnosis);
  const adviceParagraphs = splitParagraphs(advice);
  const hasMainTextContent = diagnosisParagraphs.length || medicineRows.length || adviceParagraphs.length;
  const hasBodyContent = hasMainTextContent || vitalsRows.length;
  const hasVitalsPanel = vitalsRows.length > 0;
  const doctorName = formatDoctorDisplayName(doctor?.name);
  const doctorRegistration = valueOrBlank(doctor?.registration);

  return (
    <div
      id={rootId}
      className="mx-auto flex min-h-[1220px] w-[860px] max-w-none flex-col rounded-[18px] bg-[#F7F7F6] px-10 pb-8 pt-8 text-[#27344E]"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <header className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.14fr)_minmax(360px,0.86fr)] lg:items-start lg:gap-10">
        <div className="flex items-start">
          <img
            src={mystreeLogo}
            alt="My Stree Logo"
            className="h-auto w-[360px] max-w-full object-contain sm:w-[430px] xl:w-[470px]"
          />
        </div>

        <div className="justify-self-end text-right text-[15px] leading-[1.75] text-[#27344E] sm:max-w-[440px] sm:text-[16px]">
          <p>MyStree Clinic, #3366, 1st Floor, 13th Main Road</p>
          <p>HAL 2nd Stage, Indiranagar, Bengaluru, 560008</p>
          <p className="mt-3 text-[#ED5B2D]">info@mystree.org | www.my-stree.com</p>
          <p className="mt-2 text-[20px] font-bold text-[#0D1B36]">+91 63665 73772</p>
        </div>
      </header>

      <section className="mt-10 space-y-5 sm:mt-12">
        <div className="grid grid-cols-[96px_minmax(0,1fr)] items-end gap-5 sm:grid-cols-[118px_minmax(0,1fr)] sm:gap-8">
          <div className="text-[70px] font-serif font-bold leading-none text-[#253249] sm:text-[82px]">
            &#8478;
          </div>
          <div className="justify-self-center w-full max-w-[420px]">
            <FieldLine label="Date :" value={date} lineClassName="font-semibold" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_112px] md:items-end md:gap-8">
            <FieldLine label="Patient's name:" value={patient?.name} />
            <div className="justify-self-center w-full max-w-[96px]">
              <FieldLine label="Age:" value={patient?.age} />
            </div>
          </div>
          {hasVitalsPanel ? (
            <div className="flex justify-end">
              <VitalsPanel rows={vitalsRows} />
            </div>
          ) : null}
        </div>
      </section>

      <main className="mt-6 flex-1 sm:mt-8">
        {hasBodyContent ? (
          <div className="min-h-[560px] min-w-0 space-y-10">
            {diagnosisParagraphs.length ? (
              <section>
                <SectionHeading>Diagnosis</SectionHeading>
                <div className="space-y-2 text-[15px] leading-8 sm:text-[16px]">
                  {diagnosisParagraphs.map((paragraph, index) => (
                    <p key={`${paragraph}-${index}`}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ) : null}

            <MedicineTable rows={medicineRows} />

            {adviceParagraphs.length ? (
              <section>
                <SectionHeading>Advice</SectionHeading>
                <div className="space-y-2 text-[15px] leading-8 sm:text-[16px]">
                  {adviceParagraphs.map((paragraph, index) => (
                    <p key={`${paragraph}-${index}`}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ) : null}

            {!hasMainTextContent ? <div className="min-h-[520px]" /> : null}
          </div>
        ) : (
          <div className="min-h-[700px]" />
        )}
      </main>

      <footer className="mt-auto pt-10">
        {(doctorName || doctorRegistration) ? (
          <div className="mb-8 flex justify-end">
            <div className="min-w-[220px] max-w-[280px] text-right">
              <div className="border-b border-dotted border-[#98A3B3] pb-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#7B8AA3]">
                  Consulting Doctor
                </p>
                {doctorName ? (
                  <p className="mt-2 text-[16px] font-semibold text-[#1D2940]">
                    {doctorName}
                  </p>
                ) : null}
                {doctorRegistration ? (
                  <p className="mt-1 text-[10px] font-medium text-[#5E6E86]">
                    Reg. No. {doctorRegistration}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        <div className="h-[2px] w-full bg-[#ED5B2D]" />
        <div className="mx-auto max-w-4xl pt-6 text-center text-[10px] leading-5 text-[#9AA3B1] sm:text-[11px] sm:leading-6">
          <p>
            Do not self-medicate. This medication is intended for use only as prescribed by your
            healthcare provider.
          </p>
          <p>
            Always consult your doctor before taking any medication, including this one, to ensure
            it is appropriate for your individual needs.
          </p>
        </div>
      </footer>
    </div>
  );
}
