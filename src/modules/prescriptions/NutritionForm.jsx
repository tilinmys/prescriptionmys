import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import DocumentTypeTabs from "./DocumentTypeTabs";
import NutritionAssetLivePreview from "./NutritionAssetLivePreview";
import { generateNutritionPdfFromTemplate } from "./generateNutritionPdf";

const inputClassName =
  "w-full rounded-xl border border-[#8BA4BF]/50 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-[#ED5B2D] focus:ring-2 focus:ring-[#BFE2FE]";
const compactMetricInputClassName =
  "h-10 w-full rounded-[16px] border border-[#D6DFE9] bg-white px-3 text-[15px] font-semibold tracking-[-0.02em] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.82)] outline-none placeholder:text-slate-400 focus:border-[#ED5B2D] focus:ring-4 focus:ring-[#FFE0D1]";
const metricCardClassName =
  "rounded-[26px] border border-[#D4DEE8] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFE_100%)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]";
const segmentInputClassName =
  "h-13 w-full rounded-2xl border border-[#D7E2EE] bg-white px-4 text-base font-semibold text-slate-900 shadow-[0_8px_18px_rgba(15,23,42,0.05)] outline-none placeholder:text-slate-400 focus:border-[#ED5B2D] focus:ring-4 focus:ring-[#FFE0D1]";
const sectionTitleClassName =
  "mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#8BA4BF]";
const LOCAL_STORAGE_DOCTOR_DEFAULTS_KEY = "prescription:doctor-defaults";
const LOCAL_STORAGE_LAST_SIGNATURE_KEY = "prescription:last-signature";
const DEFAULT_DOCTOR = Object.freeze({
  name: "Priyanka Savina",
  registration: "",
});

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

function createEmptyComposition() {
  return {
    height: "",
    weight: "",
    fat: "",
    visceralFat: "",
    bmr: "",
    bmi: "",
    bodyAge: "",
  };
}

function createEmptySegmentMetrics() {
  return {
    body: { fat: "", muscle: "" },
    trunk: { fat: "", muscle: "" },
    arm: { fat: "", muscle: "" },
    leg: { fat: "", muscle: "" },
  };
}

function createEmptyNotes() {
  return {
    medicalHistory: { checked: false, text: "" },
    advanSupplements: { checked: false, text: "" },
    recall24Hr: { checked: false, text: "" },
    suggestions: { checked: false, text: "" },
    goal: { checked: false, text: "" },
    dietPlan: { checked: false, text: "" },
  };
}

function safeParseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function hasValue(value) {
  return !!String(value || "").trim();
}

export default function NutritionForm() {
  const location = useLocation();
  const today = useMemo(
    () =>
      new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    []
  );

  const [doctor, setDoctor] = useState(() => ({ ...DEFAULT_DOCTOR }));
  const [rememberDoctorInfo, setRememberDoctorInfo] = useState(true);
  const [isDoctorSectionExpanded, setIsDoctorSectionExpanded] = useState(true);
  const [patient, setPatient] = useState({
    name: "",
    age: "",
  });
  const [composition, setComposition] = useState(createEmptyComposition);
  const [segmentMetrics, setSegmentMetrics] = useState(createEmptySegmentMetrics);
  const [notes, setNotes] = useState(createEmptyNotes);
  const [pdfPageSize, setPdfPageSize] = useState("a4");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [signatureDoctorName, setSignatureDoctorName] = useState("");
  const [useLastSignature, setUseLastSignature] = useState(true);
  const [mobileView, setMobileView] = useState("form");
  const [isDownloading, setIsDownloading] = useState(false);
  const [formStatus, setFormStatus] = useState("");

  const doctorSummary = doctor.name.trim()
    ? `Using saved doctor: Dr. ${doctor.name.trim()}`
    : "Doctor details";
  const hasCompositionValue = useMemo(
    () => Object.values(composition).some((value) => hasValue(value)),
    [composition]
  );

  useEffect(() => {
    const storedDoctorDefaults = safeParseJson(
      window.localStorage.getItem(LOCAL_STORAGE_DOCTOR_DEFAULTS_KEY),
      null
    );
    if (storedDoctorDefaults) {
      setDoctor((prev) => ({
        ...prev,
        name: storedDoctorDefaults.name || prev.name,
        registration: storedDoctorDefaults.registration || prev.registration,
      }));
      setRememberDoctorInfo(storedDoctorDefaults.remember !== false);
      if (storedDoctorDefaults.name || storedDoctorDefaults.registration) {
        setIsDoctorSectionExpanded(false);
      }
    }

    const storedSignature = safeParseJson(
      window.localStorage.getItem(LOCAL_STORAGE_LAST_SIGNATURE_KEY),
      null
    );
    if (storedSignature?.dataUrl && storedSignature?.doctorName) {
      setSignatureDataUrl(storedSignature.dataUrl);
      setSignatureDoctorName(storedSignature.doctorName);
    }
  }, []);

  useEffect(() => {
    if (!rememberDoctorInfo) {
      window.localStorage.removeItem(LOCAL_STORAGE_DOCTOR_DEFAULTS_KEY);
      return;
    }

    if (!doctor.name.trim() && !doctor.registration.trim()) return;
    window.localStorage.setItem(
      LOCAL_STORAGE_DOCTOR_DEFAULTS_KEY,
      JSON.stringify({
        name: doctor.name.trim(),
        registration: doctor.registration.trim(),
        remember: true,
      })
    );
  }, [doctor, rememberDoctorInfo]);

  useEffect(() => {
    if (!useLastSignature) return;
    const storedSignature = safeParseJson(
      window.localStorage.getItem(LOCAL_STORAGE_LAST_SIGNATURE_KEY),
      null
    );
    if (!storedSignature?.doctorName || !storedSignature?.dataUrl) return;
    if (storedSignature.doctorName.toLowerCase() !== doctor.name.trim().toLowerCase()) return;
    setSignatureDataUrl(storedSignature.dataUrl);
    setSignatureDoctorName(storedSignature.doctorName);
  }, [doctor.name, useLastSignature]);

  function updateDoctor(field, value) {
    setDoctor((prev) => ({ ...prev, [field]: value }));
  }

  function updatePatient(field, value) {
    setPatient((prev) => ({ ...prev, [field]: value }));
  }

  function updateComposition(field, value) {
    setComposition((prev) => ({ ...prev, [field]: value }));
  }

  function updateSegmentMetric(segmentKey, field, value) {
    setSegmentMetrics((prev) => ({
      ...prev,
      [segmentKey]: {
        ...prev[segmentKey],
        [field]: value,
      },
    }));
  }

  function updateNoteSection(sectionKey, field, value) {
    setNotes((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        [field]: value,
      },
    }));
  }

  function clearForm() {
    setPatient({ name: "", age: "" });
    setComposition(createEmptyComposition());
    setSegmentMetrics(createEmptySegmentMetrics());
    setNotes(createEmptyNotes());
    setFormStatus("Nutrition form cleared.");
  }

  function onSignatureChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      window.alert("Please upload PNG or JPG signature image.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const nextSignature = String(reader.result || "");
      setSignatureDataUrl(nextSignature);
      setSignatureDoctorName(doctor.name.trim());
      if (useLastSignature && doctor.name.trim()) {
        window.localStorage.setItem(
          LOCAL_STORAGE_LAST_SIGNATURE_KEY,
          JSON.stringify({
            doctorName: doctor.name.trim(),
            dataUrl: nextSignature,
          })
        );
      }
    };
    reader.readAsDataURL(file);
  }

  function clearSignature() {
    setSignatureDataUrl("");
    setSignatureDoctorName("");
    window.localStorage.removeItem(LOCAL_STORAGE_LAST_SIGNATURE_KEY);
  }

  async function downloadNutritionPdf() {
    try {
      setIsDownloading(true);
      setFormStatus("");
      const pdfBytes = await generateNutritionPdfFromTemplate({
        doctor,
        patient,
        composition,
        segmentMetrics,
        notes,
        date: today,
        signatureDataUrl,
        pageSize: pdfPageSize,
      });

      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `${(patient.name || "nutrition-sheet").toLowerCase().replace(/\s+/g, "-")}.pdf`;
      anchor.click();
      URL.revokeObjectURL(blobUrl);
      setFormStatus("Nutrition PDF downloaded.");
    } catch (error) {
      setFormStatus(String(error?.message || "Failed to download nutrition PDF."));
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FCF4D9] lg:h-screen lg:overflow-hidden">
      <div className="sticky top-0 z-20 border-b border-[#8BA4BF]/30 bg-[#FCF4D9]/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#8BA4BF]/40 bg-white/70 p-1">
          <button
            type="button"
            onClick={() => setMobileView("form")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mobileView === "form"
                ? "bg-[#ED5B2D] text-white"
                : "text-slate-700 hover:bg-[#BFE2FE]/40"
            }`}
          >
            Form
          </button>
          <button
            type="button"
            onClick={() => setMobileView("preview")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              mobileView === "preview"
                ? "bg-[#ED5B2D] text-white"
                : "text-slate-700 hover:bg-[#BFE2FE]/40"
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-1 lg:h-full lg:grid-cols-2">
        <section
          className={`min-h-0 flex-col border-b border-[#8BA4BF]/30 bg-[#FCF4D9] lg:flex lg:h-full lg:border-b-0 lg:border-r ${
            mobileView === "form" ? "flex" : "hidden"
          }`}
        >
          <header className="shrink-0 border-b border-[#8BA4BF]/30 bg-[#FCF4D9]/95 px-4 py-4 backdrop-blur sm:px-6 sm:py-5">
            <DocumentTypeTabs pathname={location.pathname} className="mb-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8BA4BF]">
              My Stree Admin Desk
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">
              Create Nutrition Sheet
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Fill the same body-composition and clinic-note structure shown in your sample.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#8BA4BF]/50 bg-white px-3 py-2 text-xs font-semibold text-slate-700 sm:w-auto sm:justify-start">
                PDF Size
                <select
                  value={pdfPageSize}
                  onChange={(e) => setPdfPageSize(e.target.value)}
                  className="rounded-md border border-[#8BA4BF]/50 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-[#ED5B2D]"
                >
                  <option value="a4">A4</option>
                  <option value="letter">US Letter</option>
                </select>
              </label>
              <button
                type="button"
                onClick={downloadNutritionPdf}
                disabled={isDownloading}
                className="w-full rounded-xl bg-[#ED5B2D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#EF6A40] sm:w-auto"
              >
                {isDownloading ? "Preparing..." : "Download Nutrition PDF"}
              </button>
              <button
                type="button"
                onClick={clearForm}
                className="w-full rounded-xl border border-[#8BA4BF]/60 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-[#BFE2FE]/30 sm:w-auto"
              >
                Clear Form
              </button>
            </div>
            {formStatus ? <p className="mt-2 text-xs text-slate-600">{formStatus}</p> : null}
          </header>

          <div className="space-y-5 px-4 py-4 sm:px-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:py-5">
            <div className="rounded-2xl border border-[#8BA4BF]/30 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className={`${sectionTitleClassName} mb-0`}>Doctor</p>
                  {!isDoctorSectionExpanded ? (
                    <p className="mt-1 text-sm text-slate-600">{doctorSummary}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {hasValue(doctor.name) ? (
                    <span className="rounded-full bg-[#F3FAF4] px-2.5 py-1 text-[11px] font-semibold text-[#2F7A35]">
                      Complete
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setIsDoctorSectionExpanded((prev) => !prev)}
                    className="rounded-lg border border-[#8BA4BF]/50 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-[#BFE2FE]/25"
                  >
                    {isDoctorSectionExpanded ? "Collapse" : "Change Doctor"}
                  </button>
                </div>
              </div>

              {isDoctorSectionExpanded ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Doctor Name"
                    value={doctor.name}
                    onChange={(e) => updateDoctor("name", e.target.value)}
                    className={inputClassName}
                  />
                  <input
                    type="text"
                    placeholder="License / Registration Number"
                    value={doctor.registration}
                    onChange={(e) => updateDoctor("registration", e.target.value)}
                    className={inputClassName}
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberDoctorInfo}
                      onChange={(e) => setRememberDoctorInfo(e.target.checked)}
                    />
                    Remember my doctor info
                  </label>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-[#8BA4BF]/30 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className={`${sectionTitleClassName} mb-0`}>Patient Details</p>
                {hasValue(patient.name) ? (
                  <span className="rounded-full bg-[#F3FAF4] px-2.5 py-1 text-[11px] font-semibold text-[#2F7A35]">
                    Complete
                  </span>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                <input
                  type="text"
                  placeholder="Patient Name"
                  value={patient.name}
                  onChange={(e) => updatePatient("name", e.target.value)}
                  className={inputClassName}
                />
                <input
                  type="text"
                  placeholder="Patient Age"
                  value={patient.age}
                  onChange={(e) => updatePatient("age", e.target.value)}
                  className={inputClassName}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <div className={metricCardClassName}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className={`${sectionTitleClassName} mb-0`}>Body Composition</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Compact entry for the key body metrics.
                    </p>
                  </div>
                  {hasCompositionValue ? (
                    <span className="rounded-full border border-[#D8EAD9] bg-[#F3FAF4] px-3 py-1 text-[11px] font-semibold text-[#2F7A35] shadow-sm">
                      Complete
                    </span>
                  ) : null}
                </div>
                <div className="rounded-[24px] border border-[#E3EAF2] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFE_100%)] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <div className="grid grid-cols-1 gap-2.5">
                  {[
                    ["height", "Ht"],
                    ["weight", "Wt"],
                    ["fat", "Fat"],
                    ["visceralFat", "V. Fat"],
                    ["bmr", "BMR"],
                    ["bmi", "BMI"],
                    ["bodyAge", "B. Age"],
                  ].map(([field, label]) => (
                    <label
                      key={field}
                      className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 rounded-[18px] border border-[#E6EDF4] bg-white px-3 py-2.5 shadow-[0_6px_14px_rgba(15,23,42,0.04)]"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {label}
                      </p>
                      <input
                        type="text"
                        value={composition[field]}
                        onChange={(e) => updateComposition(field, e.target.value)}
                        placeholder="Enter"
                        className={compactMetricInputClassName}
                      />
                    </label>
                  ))}
                  </div>
                </div>
              </div>

              <div className={metricCardClassName}>
                <div className="mb-5">
                  <p className={`${sectionTitleClassName} mb-0`}>Segment Analysis</p>
                  <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">
                    Record fat percentage and muscle percentage for each body segment.
                  </p>
                </div>
                <div className="space-y-4">
                  {SEGMENT_ROWS.map((segment) => (
                    <div
                      key={segment.key}
                      className="rounded-[24px] border border-[#D9E7F4] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] p-4 shadow-[0_14px_32px_rgba(15,23,42,0.05)]"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <p className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900">
                          {segment.label}
                        </p>
                        <span className="rounded-full bg-[#EFF5FB] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Segment
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="rounded-2xl border border-[#E4EBF2] bg-white p-3">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Fat %
                          </p>
                          <input
                            type="text"
                            value={segmentMetrics[segment.key].fat}
                            onChange={(e) => updateSegmentMetric(segment.key, "fat", e.target.value)}
                            placeholder="Fat %"
                            className={segmentInputClassName}
                          />
                        </label>
                        <label className="rounded-2xl border border-[#E4EBF2] bg-white p-3">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Muscle %
                          </p>
                          <input
                            type="text"
                            value={segmentMetrics[segment.key].muscle}
                            onChange={(e) => updateSegmentMetric(segment.key, "muscle", e.target.value)}
                            placeholder="Muscle %"
                            className={segmentInputClassName}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#8BA4BF]/30 bg-white p-4 shadow-sm">
              <div className="mb-3">
                <p className={`${sectionTitleClassName} mb-0`}>Clinic Notes</p>
                <p className="mt-1 text-sm text-slate-600">These sections follow the same two-column note layout as the sample image.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {NOTE_SECTIONS.map((section) => (
                  <div key={section.key} className="rounded-xl border border-[#BFE2FE] bg-[#F8FBFF] p-3">
                    <label className="mb-3 flex items-center gap-3 text-sm font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={notes[section.key].checked}
                        onChange={(e) => updateNoteSection(section.key, "checked", e.target.checked)}
                      />
                      <span>{section.label}</span>
                    </label>
                    <textarea
                      rows={4}
                      value={notes[section.key].text}
                      onChange={(e) => updateNoteSection(section.key, "text", e.target.value)}
                      placeholder="[TO BE FILLED IN CLINIC]"
                      className={`${inputClassName} min-h-[110px] resize-y leading-relaxed`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#8BA4BF]/30 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className={`${sectionTitleClassName} mb-0`}>Signature</p>
                  <p className="mt-1 text-sm text-slate-600">Reuse the last signature or upload a fresh one for the nutrition printout.</p>
                </div>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={useLastSignature}
                    onChange={(e) => setUseLastSignature(e.target.checked)}
                  />
                  Use last signature
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={onSignatureChange}
                  className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#ED5B2D] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-[#EF6A40]"
                />
                {signatureDataUrl ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#8BA4BF]/30 bg-white/80 p-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={signatureDataUrl}
                        alt="Signature preview"
                        className="h-12 w-40 rounded-md border border-[#8BA4BF]/40 bg-white object-contain p-1"
                      />
                      <div className="text-xs text-slate-600">
                        <p className="font-semibold text-slate-700">
                          {signatureDoctorName ? `Signature ready for Dr. ${signatureDoctorName}` : "Signature ready"}
                        </p>
                        <p className="mt-1">This signature will be used in the nutrition PDF.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="rounded-lg border border-[#8BA4BF]/50 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-[#BFE2FE]/30"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section
          className={`min-h-0 flex-col bg-[#BFE2FE]/35 lg:flex lg:h-full ${
            mobileView === "preview" ? "flex" : "hidden"
          }`}
        >
          <header className="shrink-0 border-b border-[#8BA4BF]/20 px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8BA4BF]">
                Live Nutrition Preview
              </p>
              <p className="text-xs text-slate-500">Nutrition print layout with live updates</p>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Export size: {pdfPageSize === "letter" ? "US Letter (fitted)" : "A4"}
            </p>
          </header>

          <div className="flex-1 p-2 sm:p-4 lg:min-h-0 lg:overflow-y-auto xl:p-6">
            <NutritionAssetLivePreview
              doctor={doctor}
              patient={patient}
              composition={composition}
              segmentMetrics={segmentMetrics}
              notes={notes}
              date={today}
              signatureDataUrl={signatureDataUrl}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
