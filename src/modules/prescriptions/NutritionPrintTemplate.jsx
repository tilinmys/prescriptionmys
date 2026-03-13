import mystreeLogo from "../../assets/mystreelogo-official.svg";
import { valueOrBlank } from "./prescriptionTemplateUtils";

const SEGMENT_ROWS = [
  { key: "body", label: "Body" },
  { key: "trunk", label: "Trunk" },
  { key: "arm", label: "Arm" },
  { key: "leg", label: "Leg" },
];

const NOTE_SECTIONS = [
  { key: "medicalHistory", label: "Medical history." },
  { key: "advanSupplements", label: "Advan Supplements." },
  { key: "recall24Hr", label: "24-hr recall." },
  { key: "suggestions", label: "Suggestions." },
  { key: "goal", label: "Goal." },
  { key: "dietPlan", label: "Diet plan." },
];

function formatNutritionistDisplayName(value) {
  const trimmed = valueOrBlank(value);
  if (!trimmed) return "";
  return trimmed.replace(/^(dr|doctor)\.?\s+/i, "").trim();
}

function MetricCell({ label, value, hasBottomBorder = true }) {
  return (
    <div
      className={`grid grid-cols-[210px_minmax(0,1fr)] ${hasBottomBorder ? "border-b border-black" : ""}`}
    >
      <div className="border-r border-black px-3 py-2.5 text-[13px] font-semibold leading-6 text-black">
        {label}
      </div>
      <div className="px-3 py-2.5 text-[13px] leading-6 text-black">{valueOrBlank(value)}</div>
    </div>
  );
}

function NoteBlock({ label, note }) {
  return (
    <div className="min-h-[126px]">
      <div className="flex items-start gap-3">
        <div className="mt-1 h-5 w-5 border border-black bg-white">
          {note?.checked ? <div className="m-1 h-3 w-3 bg-black" /> : null}
        </div>
        <p className="text-[18px] font-semibold leading-7 text-black">{label}</p>
      </div>
      <div className="mt-2 min-h-[64px] pl-8 text-[12px] uppercase leading-5 tracking-[0.02em] text-black whitespace-pre-wrap [overflow-wrap:anywhere]">
        {valueOrBlank(note?.text)}
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
          className="h-auto w-[330px] max-w-full object-contain"
        />
      </div>
      <div className="justify-self-end text-right text-[15px] leading-[1.65] text-[#27344E]">
        <p>MyStree Clinic, #3366, 1st Floor, 13th Main Road</p>
        <p>HAL 2nd Stage, Indiranagar, Bengaluru, 560008</p>
        <p className="mt-2 text-[#ED5B2D]">info@mystree.org | www.my-stree.com</p>
        <p className="mt-1 text-[20px] font-bold text-[#0D1B36]">+91 63665 73772</p>
      </div>
    </header>
  );
}

export default function NutritionPrintTemplate({
  doctor,
  patient,
  composition,
  segmentMetrics,
  notes,
  date,
  signatureDataUrl,
  rootId = "nutrition-print-area",
}) {
  const doctorName = formatNutritionistDisplayName(doctor?.name);
  const compositionRows = [
    { label: "Ht:", value: composition?.height },
    { label: "Wt:", value: composition?.weight },
    { label: "Fat:", value: composition?.fat },
    { label: "V. Fat:", value: composition?.visceralFat },
    { label: "BMR:", value: composition?.bmr },
    { label: "BMI:", value: composition?.bmi },
    { label: "B. Age:", value: composition?.bodyAge },
  ];

  return (
    <div
      id={rootId}
      className="mx-auto flex min-h-[1220px] w-[860px] max-w-none flex-col rounded-[18px] bg-[#F7F7F6] px-10 pb-10 pt-8 text-black"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
    >
      <ClinicHeader />

      <div className="mt-5 text-center text-[14px] font-bold uppercase tracking-[0.08em] text-[#0D1B36]">
        Nutrition Sheet
      </div>

      <section className="mt-5 border-[1.5px] border-black bg-white">
        <div className="grid grid-cols-[minmax(0,1fr)_255px] items-start border-b border-black">
          <div className="px-4 py-2.5 text-[15px] font-semibold leading-7 text-black">
            Patient Name: <span className="font-normal">{valueOrBlank(patient?.name)}</span>
          </div>
          <div className="border-l border-black px-4 py-2.5 text-[15px] font-semibold leading-7 text-black">
            Date: <span className="font-normal">{valueOrBlank(date)}</span>
          </div>
        </div>
        <div className="px-4 py-2.5 text-[15px] font-semibold leading-7 text-black">
          Patient Age: <span className="font-normal">{valueOrBlank(patient?.age)}</span>
        </div>
      </section>

      <section className="mt-4 grid items-start grid-cols-[1fr_1.03fr] gap-4">
        <div className="self-start border-[1.5px] border-black bg-white">
          {compositionRows.map((row, index) => (
            <MetricCell
              key={row.label}
              label={row.label}
              value={row.value}
              hasBottomBorder={index < compositionRows.length - 1}
            />
          ))}
        </div>

        <div className="self-start border-[1.5px] border-black bg-white">
          <div className="grid grid-cols-[1.08fr_0.9fr_1fr] border-b border-black">
            <div className="border-r border-black px-3 py-2.5 text-center text-[13px] font-semibold leading-6 text-black">
              Segment
            </div>
            <div className="border-r border-black px-3 py-2.5 text-center text-[13px] font-semibold leading-6 text-black">
              Fat %
            </div>
            <div className="px-3 py-2.5 text-center text-[13px] font-semibold leading-6 text-black">
              Muscle %
            </div>
          </div>
          {SEGMENT_ROWS.map((segment, index) => (
            <div
              key={segment.key}
              className={`grid grid-cols-[1.08fr_0.9fr_1fr] ${index < SEGMENT_ROWS.length - 1 ? "border-b border-black" : ""}`}
            >
              <div className="border-r border-black px-3 py-2.5 text-center text-[13px] font-semibold leading-6 text-black">
                {segment.label}
              </div>
              <div className="border-r border-black px-3 py-2.5 text-center text-[13px] leading-6 text-black">
                {valueOrBlank(segmentMetrics?.[segment.key]?.fat)}
              </div>
              <div className="px-3 py-2.5 text-center text-[13px] leading-6 text-black">
                {valueOrBlank(segmentMetrics?.[segment.key]?.muscle)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid flex-1 grid-cols-2 gap-x-10 gap-y-8">
        {NOTE_SECTIONS.map((section) => (
          <NoteBlock key={section.key} label={section.label} note={notes?.[section.key]} />
        ))}
      </section>

      <footer className="mt-6">
        <div className="overflow-hidden rounded-[16px] border border-[#D8D0C4] bg-[#FFFEFC] px-6 py-6 shadow-[0_14px_32px_rgba(13,27,54,0.04)]">
          <div className="rounded-[12px] border border-[#E7DED0] bg-[#FDFBF7] px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5B6D87]">
              Clinical Note
            </p>
            <p className="mt-2 max-w-[720px] text-[11.5px] leading-[1.55] text-[#1F2937]">
              This nutrition sheet records body-composition details, recall, goals, diet plan, and
              consultation guidance. Final recommendations should always be reviewed by the treating
              clinician or consulting nutritionist before use.
            </p>
          </div>

          <div
            className={`mt-6 grid items-start gap-8 overflow-hidden ${
              doctorName ? "grid-cols-[minmax(0,1fr)_240px]" : "grid-cols-1"
            }`}
          >
            <div className="min-w-0 pr-6 text-black">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.22em] text-[#5B6D87]">
                Nutritionist Signature
              </p>
              <div className="relative mt-5 h-[50px] w-[250px] max-w-full">
                <span className="absolute inset-x-0 bottom-0 border-b border-[#98A2B3]" />
                {signatureDataUrl ? (
                  <img
                    src={signatureDataUrl}
                    alt="Nutritionist signature"
                    className="absolute bottom-[3px] left-1 h-10 max-w-[192px] object-contain"
                  />
                ) : null}
              </div>
              <p className="mt-3 text-[10.5px] leading-5 text-[#6F7B8C]">
                Authorized nutrition consultation sign-off.
              </p>
            </div>

            {doctorName ? (
              <div className="min-w-0 justify-self-end self-stretch overflow-hidden border-l border-[#E7DED0] pl-6 pr-6 text-right text-black">
                <div className="ml-auto w-[190px] max-w-full overflow-hidden">
                  <p className="text-[8.5px] font-semibold uppercase leading-4 tracking-[0.14em] text-[#6F7E94]">
                    Consulting Nutritionist
                  </p>
                  <p className="mt-4 text-[12px] leading-5 text-[#7B8797]">MyStree Clinic</p>
                  <p className="mt-1 text-[21px] font-semibold leading-[1.15] text-[#0D1B36] break-words">
                    {doctorName}
                  </p>
                  <p className="mt-2 text-[9.5px] leading-5 text-[#7B8797]">
                    Nutrition & lifestyle consultation
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
