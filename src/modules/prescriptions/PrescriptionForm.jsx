import { useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";
import { useNavigate, useParams } from "react-router-dom";
import PrescriptionAssetLivePreview from "./PrescriptionAssetLivePreview";
import { generatePrescriptionPdfFromTemplate } from "./generateTemplatePdf";
import { VITAL_FIELDS } from "./prescriptionTemplateUtils";

function createMedicineRow() {
  return {
    type: "",
    medicine: "",
    dosage: "",
    frequency: "",
    duration: "",
    mealTiming: "After Food",
    notes: "",
    visibleFields: ["type", "medicine", "dosage", "frequency", "duration", "mealTiming", "notes"],
  };
}

function createEmptyVitals() {
  return {
    weight: "",
    bloodPressure: "",
    pulse: "",
    spo2: "",
  };
}

const ALL_VITAL_FIELD_KEYS = VITAL_FIELDS.map((field) => field.key);
const MEDICINE_FIELD_CONFIG = [
  {
    key: "type",
    label: "Type",
    defaultValue: "",
    clearValue: "",
    span: "sm:col-span-1",
  },
  {
    key: "medicine",
    label: "Medicine Name",
    defaultValue: "",
    clearValue: "",
    span: "sm:col-span-1",
  },
  {
    key: "dosage",
    label: "Dosage",
    defaultValue: "",
    clearValue: "",
    span: "sm:col-span-1",
  },
  {
    key: "frequency",
    label: "Frequency",
    defaultValue: "",
    clearValue: "",
    span: "sm:col-span-1",
  },
  {
    key: "duration",
    label: "Duration",
    defaultValue: "",
    clearValue: "",
    span: "sm:col-span-1",
  },
  {
    key: "mealTiming",
    label: "Meal Timing",
    defaultValue: "After Food",
    clearValue: "",
    span: "sm:col-span-1",
  },
  {
    key: "notes",
    label: "Medication Remark",
    defaultValue: "",
    clearValue: "",
    span: "sm:col-span-2",
  },
];
const ALL_MEDICINE_FIELD_KEYS = MEDICINE_FIELD_CONFIG.map((field) => field.key);

function normalizeMedicineInputRow(item) {
  const nextVisibleFields = Array.isArray(item?.visibleFields)
    ? ALL_MEDICINE_FIELD_KEYS.filter((key) => item.visibleFields.includes(key))
    : ALL_MEDICINE_FIELD_KEYS;

  return {
    ...createMedicineRow(),
    ...item,
    visibleFields: nextVisibleFields,
  };
}

const inputClassName =
  "w-full rounded-xl border border-[#8BA4BF]/50 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-[#ED5B2D] focus:ring-2 focus:ring-[#BFE2FE]";

const sectionTitleClassName =
  "mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#8BA4BF]";

const DEFAULT_CLINIC_HOURS = "Mon-Sat: 9:00 AM - 7:00 PM";
const DEFAULT_CLOSED_DAYS = "Sunday";
const DEFAULT_DOCTOR = Object.freeze({
  name: "",
  registration: "",
});
const LOCAL_STORAGE_DOCTOR_DEFAULTS_KEY = "prescription:doctor-defaults";
const LOCAL_STORAGE_RECENT_MEDICINES_KEY = "prescription:recent-medicines";
const LOCAL_STORAGE_LAST_VITALS_KEY = "prescription:last-vitals";
const LOCAL_STORAGE_RECENT_DIAGNOSES_KEY = "prescription:recent-diagnoses";
const LOCAL_STORAGE_RECENT_ADVICE_KEY = "prescription:recent-advice";
const LOCAL_STORAGE_LAST_SIGNATURE_KEY = "prescription:last-signature";
const MEDICINE_TYPE_OPTIONS = ["Tab", "Cap", "Syr", "Inj", "Oint"];
const MEAL_TIMING_OPTIONS = ["After Food", "Before Food", "Empty Stomach", "With Food"];
const COMMON_DIAGNOSES = [
  "Viral Fever",
  "Upper Respiratory Tract Infection",
  "Acidity / Gastritis",
  "Migraine",
  "Hypertension",
  "Allergic Rhinitis",
  "Acute Pharyngitis",
  "Gastroenteritis",
  "Type 2 Diabetes Follow-up",
  "General Weakness / Fatigue",
];
const ADVICE_SNIPPETS = [
  "Take adequate rest",
  "Drink plenty of fluids",
  "Monitor temperature and symptoms",
  "Avoid oily and spicy food",
  "Avoid smoke and dust exposure",
  "Complete the full course of medicines",
  "Return immediately if symptoms worsen",
  "Review after 3 days",
];
const FOLLOW_UP_OPTIONS = [
  { label: "3 Days", days: 3 },
  { label: "1 Week", days: 7 },
  { label: "2 Weeks", days: 14 },
  { label: "1 Month", days: 30 },
];
const QUICK_MEDICINE_PRESETS = [
  {
    key: "paracetamol-650",
    label: "Paracetamol 650",
    row: {
      type: "Tab",
      medicine: "Paracetamol 650 mg",
      dosage: "1 tab",
      frequency: "TID",
      duration: "3 days",
      mealTiming: "After Food",
      notes: "For fever and body ache",
    },
  },
  {
    key: "cetirizine-10",
    label: "Cetirizine 10",
    row: {
      type: "Tab",
      medicine: "Cetirizine 10 mg",
      dosage: "1 tab",
      frequency: "HS",
      duration: "3 days",
      mealTiming: "After Food",
      notes: "For allergy / cold symptoms",
    },
  },
  {
    key: "pantoprazole-40",
    label: "Pantoprazole 40",
    row: {
      type: "Tab",
      medicine: "Pantoprazole 40 mg",
      dosage: "1 tab",
      frequency: "OD",
      duration: "5 days",
      mealTiming: "Before Food",
      notes: "Take before breakfast",
    },
  },
  {
    key: "ors-sachet",
    label: "ORS Sachet",
    row: {
      type: "Syr",
      medicine: "ORS Sachet",
      dosage: "1 sachet",
      frequency: "SOS",
      duration: "2 days",
      mealTiming: "After Food",
      notes: "Sip frequently",
    },
  },
];
const MEDICINE_SUGGESTION_MAP = QUICK_MEDICINE_PRESETS.reduce((accumulator, preset) => {
  accumulator[preset.row.medicine.toLowerCase()] = preset.row;
  return accumulator;
}, {});
const BASIC_ALLERGY_KEYWORDS = {
  paracetamol: ["paracetamol", "acetaminophen"],
  cetirizine: ["cetirizine"],
  azithromycin: ["azithromycin", "macrolide"],
  amoxicillin: ["amoxicillin", "penicillin"],
  ibuprofen: ["ibuprofen", "nsaid"],
};
const COMMON_MEDICINES = [
  "Paracetamol 500 mg",
  "Azithromycin 500 mg",
  "Pantoprazole 40 mg",
  "Cetirizine 10 mg",
  "Levocetirizine 5 mg",
  "Ondansetron 4 mg",
  "Dolo 650",
  "Crocin 650",
  "Amoxicillin 500 mg",
  "Ibuprofen 400 mg",
  "ORS Sachet",
  "Meftal Spas",
  "Montek LC",
  "Rabeprazole 20 mg",
  "Becosules",
  "Benadryl Syrup",
];

function safeParseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeQuickMedicineRow(item) {
  return normalizeMedicineInputRow({
    ...createMedicineRow(),
    ...item,
  });
}

function normalizeDoctorDetails(doctorLike) {
  return {
    ...DEFAULT_DOCTOR,
    ...doctorLike,
    name: String(doctorLike?.name || DEFAULT_DOCTOR.name),
    registration: String(
      doctorLike?.registration ??
        doctorLike?.registration_number ??
        doctorLike?.reg_no ??
        DEFAULT_DOCTOR.registration
    ),
  };
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getFollowUpDateFromDays(days) {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + days);
  return formatDateInput(nextDate);
}

function normalizePatientKey(value) {
  return String(value || "").trim().toLowerCase();
}

function buildRecentTextList(nextValue, existingValues, limit = 8) {
  const normalizedNext = String(nextValue || "").trim();
  const filteredExisting = (existingValues || []).filter(
    (item) => String(item || "").trim() && String(item || "").trim() !== normalizedNext
  );
  return normalizedNext ? [normalizedNext, ...filteredExisting].slice(0, limit) : filteredExisting.slice(0, limit);
}

function hasValue(value) {
  return !!String(value || "").trim();
}

function serializeMedicineRowForHistory(item) {
  return {
    type: String(item?.type || "").trim(),
    medicine: String(item?.medicine || "").trim(),
    dosage: String(item?.dosage || "").trim(),
    frequency: String(item?.frequency || "").trim(),
    duration: String(item?.duration || "").trim(),
    mealTiming: String(item?.mealTiming || "").trim(),
    notes: String(item?.notes || "").trim(),
  };
}

function buildSafetyWarnings({ medicines, patientAllergies, age }) {
  const warnings = [];
  const normalizedAge = Number.parseInt(String(age || "").trim(), 10);
  const rows = (medicines || [])
    .map((item) => serializeMedicineRowForHistory(item))
    .filter((item) => item.medicine);
  const allergyText = String(patientAllergies || "").toLowerCase();
  const medicineNames = rows.map((row) => row.medicine.toLowerCase());

  const seenMedicines = new Set();
  rows.forEach((row) => {
    const normalizedMedicine = row.medicine.toLowerCase();
    if (seenMedicines.has(normalizedMedicine)) {
      warnings.push(`Duplicate medicine entry detected: ${row.medicine}`);
    }
    seenMedicines.add(normalizedMedicine);
  });

  Object.entries(BASIC_ALLERGY_KEYWORDS).forEach(([medicineKey, keywords]) => {
    const matchesMedicine = medicineNames.some((name) => name.includes(medicineKey));
    const matchesAllergy = keywords.some((keyword) => allergyText.includes(keyword));
    if (matchesMedicine && matchesAllergy) {
      warnings.push(`Potential allergy warning: review ${medicineKey} against the recorded allergy list.`);
    }
  });

  if (Number.isFinite(normalizedAge) && normalizedAge <= 12) {
    rows.forEach((row) => {
      const dosageText = `${row.dosage} ${row.notes}`.toLowerCase();
      if (/(650|500)\s*mg/.test(dosageText) || /(650|500)\s*mg/.test(row.medicine.toLowerCase())) {
        warnings.push(`Pediatric caution: verify adult-strength dosage for ${row.medicine}.`);
      }
    });
  }

  if (Number.isFinite(normalizedAge) && normalizedAge >= 65) {
    rows.forEach((row) => {
      if (row.medicine.toLowerCase().includes("ibuprofen")) {
        warnings.push(`Senior caution: review NSAID use and renal risk for ${row.medicine}.`);
      }
    });
  }

  return Array.from(new Set(warnings));
}
const PRESCRIPTION_TEMPLATES = [
  {
    key: "viral-fever",
    label: "Viral Fever",
    diagnosis: "Viral fever with body ache and mild throat discomfort.",
    advice:
      "Take adequate rest, drink warm fluids, monitor temperature, and return if symptoms worsen or persist beyond 3 days.",
    medicines: [
      {
        type: "Tab",
        medicine: "Paracetamol 650 mg",
        dosage: "1 tab",
        frequency: "TID",
        duration: "3 days",
        mealTiming: "After Food",
        notes: "For fever and body ache",
      },
      {
        type: "Tab",
        medicine: "Cetirizine 10 mg",
        dosage: "1 tab",
        frequency: "HS",
        duration: "3 days",
        mealTiming: "After Food",
        notes: "For cold symptoms",
      },
    ],
  },
  {
    key: "acidity",
    label: "Acidity / Gastritis",
    diagnosis: "Acute gastritis with acidity and bloating.",
    advice:
      "Avoid oily and spicy food, take small meals, stay hydrated, and do not skip breakfast.",
    medicines: [
      {
        type: "Tab",
        medicine: "Pantoprazole 40 mg",
        dosage: "1 tab",
        frequency: "OD",
        duration: "5 days",
        mealTiming: "Before Food",
        notes: "Take before breakfast",
      },
      {
        type: "Syr",
        medicine: "Antacid Gel",
        dosage: "10 ml",
        frequency: "TID",
        duration: "5 days",
        mealTiming: "After Food",
        notes: "For burning sensation",
      },
    ],
  },
  {
    key: "migraine",
    label: "Migraine",
    diagnosis: "Migraine headache with light sensitivity.",
    advice:
      "Sleep well, avoid screen strain, maintain hydration, and return if headache becomes severe or recurrent.",
    medicines: [
      {
        type: "Tab",
        medicine: "Paracetamol 650 mg",
        dosage: "1 tab",
        frequency: "SOS",
        duration: "3 days",
        mealTiming: "After Food",
        notes: "At onset of pain",
      },
      {
        type: "Tab",
        medicine: "Pantoprazole 40 mg",
        dosage: "1 tab",
        frequency: "OD",
        duration: "3 days",
        mealTiming: "Before Food",
        notes: "For gastric protection",
      },
    ],
  },
];

const DOCTOR_SIGNATURE_SELECT =
  "name, signature_url, signature_path, image_url, image_path";

const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(import.meta.env.VITE_SUPABASE_URL || "").origin;
  } catch {
    return "";
  }
})();

function isTrustedSupabaseStorageUrl(value) {
  if (!/^https?:\/\//i.test(value)) return false;

  try {
    const parsed = new URL(value);
    return (
      !!SUPABASE_ORIGIN &&
      parsed.origin === SUPABASE_ORIGIN &&
      parsed.pathname.includes("/storage/v1/object/")
    );
  } catch {
    return false;
  }
}

function normalizeStoragePath(path) {
  const normalized = path.trim().replace(/^\/+/, "").replace(/^prescriptions\//i, "");
  if (!normalized) return "";
  if (normalized.includes("..") || normalized.includes("\\")) return "";
  if (!/^[a-zA-Z0-9/_\-.]+$/.test(normalized)) return "";
  return normalized;
}

function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function pickDoctorSignatureReference(doctorRow) {
  const candidates = [
    doctorRow?.signature_url,
    doctorRow?.signatureUrl,
    doctorRow?.signature_path,
    doctorRow?.signaturePath,
    doctorRow?.image_url,
    doctorRow?.imageUrl,
    doctorRow?.image_path,
    doctorRow?.imagePath,
  ];

  return candidates.find((value) => typeof value === "string" && value.trim()) || "";
}

function findDoctorByNameFromRows(rows, inputName) {
  const lowerName = inputName.toLowerCase();
  const exactMatch = rows.find(
    (row) => String(row?.name || "").trim().toLowerCase() === lowerName
  );
  if (exactMatch) return exactMatch;
  return rows.find((row) => String(row?.name || "").trim().toLowerCase().includes(lowerName));
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toCleanText(value) {
  const text = String(value || "").trim();
  return text || null;
}

function isMissingColumnError(error, columnName) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes(`column "${String(columnName).toLowerCase()}"`);
}

function normalizeMedicineRows(rows) {
  return rows
    .map((item) => {
      const visibleFields = Array.isArray(item?.visibleFields) ? item.visibleFields : null;
      const isVisible = (fieldKey) => !visibleFields || visibleFields.includes(fieldKey);

      return {
        type: isVisible("type") ? String(item?.type || "").trim() : "",
        medicine: isVisible("medicine") ? String(item?.medicine || "").trim() : "",
        dosage: isVisible("dosage") ? String(item?.dosage || "").trim() : "",
        frequency: isVisible("frequency") ? String(item?.frequency || "").trim() : "",
        duration: isVisible("duration") ? String(item?.duration || "").trim() : "",
        mealTiming: isVisible("mealTiming") ? String(item?.mealTiming || "").trim() : "",
        notes: isVisible("notes") ? String(item?.notes || "").trim() : "",
      };
    })
    .filter((item) => item.medicine);
}

function useDebouncedValue(value, delayMs = 140) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}

export default function PrescriptionForm() {
  const navigate = useNavigate();
  const { id: routePrescriptionId } = useParams();
  const templateSelectRef = useRef(null);

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
    gender: "",
  });
  const [vitals, setVitals] = useState(createEmptyVitals);
  const [showVitals, setShowVitals] = useState(true);
  const [clinicMeta, setClinicMeta] = useState({
    hours: DEFAULT_CLINIC_HOURS,
    closedDays: DEFAULT_CLOSED_DAYS,
  });
  const [diagnosis, setDiagnosis] = useState("");
  const [advice, setAdvice] = useState("");
  const [medicines, setMedicines] = useState([createMedicineRow()]);
  const [recentMedicines, setRecentMedicines] = useState([]);
  const [pdfPageSize, setPdfPageSize] = useState("a4");
  const [selectedTemplateKey, setSelectedTemplateKey] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [autoSignatureSource, setAutoSignatureSource] = useState("");
  const [signatureDoctorName, setSignatureDoctorName] = useState("");
  const [useLastSignature, setUseLastSignature] = useState(true);
  const [isFetchingSignature, setIsFetchingSignature] = useState(false);
  const [signatureStatus, setSignatureStatus] = useState("");
  const [prescriptionId, setPrescriptionId] = useState(routePrescriptionId || "");
  const [prescriptionStatus, setPrescriptionStatus] = useState("draft");
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isResavingPdf, setIsResavingPdf] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [formStatus, setFormStatus] = useState("");
  const [mobileView, setMobileView] = useState("form");
  const [visibleVitalFields, setVisibleVitalFields] = useState(ALL_VITAL_FIELD_KEYS);
  const [expandedMedicineRemarks, setExpandedMedicineRemarks] = useState({});

  const effectiveSignatureSource = signatureDataUrl || autoSignatureSource;
  const debouncedDiagnosis = useDebouncedValue(diagnosis);
  const debouncedAdvice = useDebouncedValue(advice);
  const debouncedMedicines = useDebouncedValue(medicines);
  const debouncedVitals = useDebouncedValue(vitals);
  const visibleVitals = useMemo(
    () => VITAL_FIELDS.filter((field) => visibleVitalFields.includes(field.key)),
    [visibleVitalFields]
  );
  const effectiveVisibleVitalFields = useMemo(
    () => (showVitals ? visibleVitalFields : []),
    [showVitals, visibleVitalFields]
  );
  const hasAnyVitalValue = useMemo(
    () => ALL_VITAL_FIELD_KEYS.some((fieldKey) => hasValue(vitals[fieldKey])),
    [vitals]
  );
  const doctorSummary = doctor.name.trim()
    ? `Using saved doctor: Dr. ${doctor.name.trim()}`
    : "Doctor details";

  useEffect(() => {
    setPrescriptionId(routePrescriptionId || "");
    if (!routePrescriptionId) {
      setPrescriptionStatus("draft");
    }
  }, [routePrescriptionId]);

  useEffect(() => {
    const storedDoctorDefaults = safeParseJson(
      window.localStorage.getItem(LOCAL_STORAGE_DOCTOR_DEFAULTS_KEY),
      null
    );
    if (storedDoctorDefaults) {
      setDoctor((prev) =>
        normalizeDoctorDetails({
          ...prev,
          name: storedDoctorDefaults.name || prev.name,
          registration: storedDoctorDefaults.registration || prev.registration,
        })
      );
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
      setSignatureStatus(`Using cached signature for Dr. ${storedSignature.doctorName}.`);
    }

    setRecentMedicines(
      safeParseJson(window.localStorage.getItem(LOCAL_STORAGE_RECENT_MEDICINES_KEY), []).map(
        (item) => normalizeQuickMedicineRow(item)
      )
    );
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
        remember: rememberDoctorInfo,
      })
    );
  }, [doctor.name, doctor.registration, rememberDoctorInfo]);

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void openApproveModal();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && String(event.key || "").toLowerCase() === "m") {
        event.preventDefault();
        addMedicineRow();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && String(event.key || "").toLowerCase() === "j") {
        event.preventDefault();
        handleLoadTemplate();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    doctor.name,
    signatureDataUrl,
    autoSignatureSource,
    signatureDoctorName,
    selectedTemplateKey,
  ]);

  useEffect(() => {
    if (signatureDataUrl) return;

    const currentDoctorName = doctor.name.trim().toLowerCase();
    const cachedDoctorName = signatureDoctorName.trim().toLowerCase();
    if (!cachedDoctorName) return;

    if (cachedDoctorName !== currentDoctorName) {
      setAutoSignatureSource("");
      setSignatureDoctorName("");
      setSignatureStatus("");
    }
  }, [doctor.name, signatureDataUrl, signatureDoctorName]);

  useEffect(() => {
    if (!useLastSignature || signatureDataUrl) return;
    const cachedSignature = safeParseJson(
      window.localStorage.getItem(LOCAL_STORAGE_LAST_SIGNATURE_KEY),
      null
    );
    if (!cachedSignature?.doctorName || !cachedSignature?.dataUrl) return;
    if (cachedSignature.doctorName.toLowerCase() !== doctor.name.trim().toLowerCase()) return;
    setSignatureDataUrl(cachedSignature.dataUrl);
    setSignatureStatus(`Using cached signature for Dr. ${cachedSignature.doctorName}.`);
  }, [doctor.name, signatureDataUrl, useLastSignature]);

  useEffect(() => {
    const patientKey = normalizePatientKey(patient.name);
    if (!patientKey) return;

    const vitalsHistory = safeParseJson(
      window.localStorage.getItem(LOCAL_STORAGE_LAST_VITALS_KEY),
      {}
    );
    const historyEntry = vitalsHistory[patientKey];
    if (!historyEntry?.vitals) return;
  }, [patient.name]);

  function updateDoctor(field, value) {
    setDoctor((prev) => ({ ...prev, [field]: value }));
  }

  function updatePatient(field, value) {
    setPatient((prev) => ({ ...prev, [field]: value }));
  }

  function updateVitals(field, value) {
    setVitals((prev) => ({ ...prev, [field]: value }));
  }

  function removeAllVitalFields() {
    setVitals(createEmptyVitals());
    setShowVitals(false);
  }

  function restoreAllVitalFields() {
    setVitals(createEmptyVitals());
    setShowVitals(true);
  }

  function updateMedicine(index, field, value) {
    setMedicines((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const nextItem = { ...item, [field]: value };
        if (field !== "medicine") return nextItem;

        const suggestedRow = MEDICINE_SUGGESTION_MAP[String(value || "").trim().toLowerCase()];
        if (!suggestedRow) return nextItem;

        return {
          ...nextItem,
          type: nextItem.type || suggestedRow.type,
          dosage: nextItem.dosage || suggestedRow.dosage,
          frequency: nextItem.frequency || suggestedRow.frequency,
          duration: nextItem.duration || suggestedRow.duration,
          mealTiming:
            nextItem.mealTiming && nextItem.mealTiming !== "After Food"
              ? nextItem.mealTiming
              : suggestedRow.mealTiming,
          notes: nextItem.notes || suggestedRow.notes,
        };
      })
    );
  }

  function removeMedicineField(index, fieldKey) {
    const config = MEDICINE_FIELD_CONFIG.find((field) => field.key === fieldKey);
    if (!config) return;

    setMedicines((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              [fieldKey]: config.clearValue,
            }
          : item
      )
    );
  }

  function addMedicineRow() {
    setMedicines((prev) => [...prev, createMedicineRow()]);
  }

  function removeMedicineRow(index) {
    if (!window.confirm(`Remove Medicine ${index + 1} from this prescription?`)) return;
    setMedicines((prev) => prev.filter((_, i) => i !== index));
  }

  function handleLoadTemplate() {
    if (!selectedTemplateKey) {
      templateSelectRef.current?.focus();
      setFormStatus("Select a template first, then load it into the form.");
      return;
    }

    applySelectedTemplate();
  }

  function applySelectedTemplate() {
    if (!selectedTemplateKey) {
      setFormStatus("Select a template first to load diagnosis, medicines, and advice.");
      return;
    }
    const selectedTemplate = PRESCRIPTION_TEMPLATES.find((item) => item.key === selectedTemplateKey);
    if (!selectedTemplate) return;

    setDiagnosis(selectedTemplate.diagnosis);
    setAdvice(selectedTemplate.advice);
    setMedicines(selectedTemplate.medicines.map((item) => normalizeMedicineInputRow(item)));
    setFormStatus(`${selectedTemplate.label} template loaded.`);
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
      setSignatureStatus("Using manually uploaded signature.");
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
    setAutoSignatureSource("");
    setSignatureDoctorName("");
    setSignatureStatus("Signature cleared.");
    window.localStorage.removeItem(LOCAL_STORAGE_LAST_SIGNATURE_KEY);
  }

  async function resolveSignatureSource(rawReference) {
    if (!rawReference || typeof rawReference !== "string") return "";
    const trimmedReference = rawReference.trim();
    if (!trimmedReference) return "";

    if (trimmedReference.startsWith("data:")) return "";
    if (/^https?:\/\//i.test(trimmedReference)) {
      return isTrustedSupabaseStorageUrl(trimmedReference) ? trimmedReference : "";
    }

    if (!supabase?.storage?.from) return "";

    const storagePath = normalizeStoragePath(trimmedReference);
    if (!storagePath) return "";

    const { data, error } = await supabase.storage
      .from("prescriptions")
      .createSignedUrl(storagePath, 60 * 30);

    if (error || !data?.signedUrl) return "";
    return data.signedUrl;
  }

  async function fetchSignatureFromDoctorProfile(doctorName, { silent = false } = {}) {
    if (!isSupabaseConfigured) {
      if (!silent) setSignatureStatus("Frontend-only mode: auto signature fetch is disabled.");
      return "";
    }

    const normalizedName = doctorName?.trim();
    if (!normalizedName) {
      setAutoSignatureSource("");
      setSignatureDoctorName("");
      if (!silent) setSignatureStatus("Type doctor name to auto-fetch signature.");
      return "";
    }

    if (!silent) setSignatureStatus("Fetching signature from doctor profile...");
    setIsFetchingSignature(true);

    try {
      const likeValue = `%${escapeLikePattern(normalizedName)}%`;
      let matchedDoctor = null;

      const baseQuery = supabase.from("doctors").select(DOCTOR_SIGNATURE_SELECT);

      // Prefer server-side filtering when available; fallback kept for local env fallback client.
      if (typeof baseQuery.ilike === "function") {
        const { data, error } = await supabase
          .from("doctors")
          .select(DOCTOR_SIGNATURE_SELECT)
          .ilike("name", likeValue)
          .limit(25);

        if (error || !Array.isArray(data)) {
          if (!silent) setSignatureStatus("Could not read doctors table.");
          return "";
        }

        matchedDoctor = findDoctorByNameFromRows(data, normalizedName) || null;
      } else {
        const { data, error } = await supabase
          .from("doctors")
          .select(DOCTOR_SIGNATURE_SELECT)
          .limit(200);

        if (error || !Array.isArray(data)) {
          if (!silent) setSignatureStatus("Could not read doctors table.");
          return "";
        }

        matchedDoctor = findDoctorByNameFromRows(data, normalizedName) || null;
      }

      if (!matchedDoctor) {
        setAutoSignatureSource("");
        setSignatureDoctorName(normalizedName);
        if (!silent) setSignatureStatus("No matching doctor found in database.");
        return "";
      }

      const signatureReference = pickDoctorSignatureReference(matchedDoctor);
      if (!signatureReference) {
        setAutoSignatureSource("");
        setSignatureDoctorName(normalizedName);
        if (!silent) setSignatureStatus("Doctor profile found, but signature is not stored yet.");
        return "";
      }

      const resolvedSignature = await resolveSignatureSource(signatureReference);
      if (!resolvedSignature) {
        setAutoSignatureSource("");
        setSignatureDoctorName(normalizedName);
        if (!silent) setSignatureStatus("Signature reference found, but file could not be loaded.");
        return "";
      }

      setAutoSignatureSource(resolvedSignature);
      setSignatureDoctorName(normalizedName);
      if (!silent) setSignatureStatus(`Signature loaded for Dr. ${matchedDoctor.name}.`);
      return resolvedSignature;
    } catch {
      if (!silent) setSignatureStatus("Signature fetch failed.");
      return "";
    } finally {
      setIsFetchingSignature(false);
    }
  }

  async function openApproveModal() {
    setFormStatus("");
    const currentDoctorName = doctor.name.trim();
    const hasMatchingAutoSignature =
      !!autoSignatureSource &&
      currentDoctorName &&
      signatureDoctorName.toLowerCase() === currentDoctorName.toLowerCase();

    if (!signatureDataUrl && !hasMatchingAutoSignature) {
      try {
        await fetchSignatureFromDoctorProfile(doctor.name, { silent: true });
      } catch {
        // Keep modal flow responsive even when signature auto-fetch fails.
      }
    }
    setIsApproveModalOpen(true);
  }

  function triggerPdfDownload(pdfBytes) {
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${(patient.name || "prescription")
      .toLowerCase()
      .replace(/\s+/g, "-")}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function persistWorkflowMemory() {
    if (rememberDoctorInfo && (doctor.name.trim() || doctor.registration.trim())) {
      window.localStorage.setItem(
        LOCAL_STORAGE_DOCTOR_DEFAULTS_KEY,
        JSON.stringify({
          name: doctor.name.trim(),
          registration: doctor.registration.trim(),
          remember: true,
        })
      );
    }

    const patientKey = normalizePatientKey(patient.name);
    if (patientKey && showVitals) {
      const hasAnyVitalValue = ALL_VITAL_FIELD_KEYS.some((fieldKey) => String(vitals[fieldKey] || "").trim());
      if (hasAnyVitalValue) {
        const vitalsHistory = safeParseJson(
          window.localStorage.getItem(LOCAL_STORAGE_LAST_VITALS_KEY),
          {}
        );
        vitalsHistory[patientKey] = {
          vitals: { ...vitals },
          updatedAt: new Date().toISOString(),
        };
        window.localStorage.setItem(LOCAL_STORAGE_LAST_VITALS_KEY, JSON.stringify(vitalsHistory));
      }
    }

    const nonEmptyMedicineRows = medicines
      .map((item) => serializeMedicineRowForHistory(item))
      .filter((item) => item.medicine);
    const nextRecentMedicines = [
      ...nonEmptyMedicineRows,
      ...recentMedicines.map((item) => serializeMedicineRowForHistory(item)),
    ].filter((item, index, source) => {
      const key = `${item.type}|${item.medicine}|${item.dosage}|${item.frequency}|${item.duration}|${item.mealTiming}|${item.notes}`;
      return source.findIndex((entry) => {
        const entryKey = `${entry.type}|${entry.medicine}|${entry.dosage}|${entry.frequency}|${entry.duration}|${entry.mealTiming}|${entry.notes}`;
        return entryKey === key;
      }) === index;
    });
    const trimmedRecentMedicines = nextRecentMedicines.slice(0, 8).map((item) => normalizeQuickMedicineRow(item));
    setRecentMedicines(trimmedRecentMedicines);
    window.localStorage.setItem(
      LOCAL_STORAGE_RECENT_MEDICINES_KEY,
      JSON.stringify(trimmedRecentMedicines.map((item) => serializeMedicineRowForHistory(item)))
    );
  }

  function buildAdviceWithFollowUp() {
    return String(advice || "").trim();
  }

  async function createCurrentPdfBytes() {
    const currentDoctorName = doctor.name.trim();
    const hasMatchingAutoSignature =
      !!autoSignatureSource &&
      currentDoctorName &&
      signatureDoctorName.toLowerCase() === currentDoctorName.toLowerCase();

    const resolvedSignature =
      signatureDataUrl ||
      (hasMatchingAutoSignature ? autoSignatureSource : "") ||
      (await fetchSignatureFromDoctorProfile(doctor.name, { silent: true }));

    persistWorkflowMemory();

    return generatePrescriptionPdfFromTemplate({
      doctor,
      patient,
      diagnosis,
      advice: buildAdviceWithFollowUp(),
      medicines,
      vitals,
      visibleVitalFields: effectiveVisibleVitalFields,
      date: today,
      signatureDataUrl: resolvedSignature,
      clinicHours: clinicMeta.hours,
      closedDays: clinicMeta.closedDays,
      pageSize: pdfPageSize,
    });
  }

  async function resolveDoctorAndPatientIds() {
    const doctorName = doctor.name.trim();
    const patientName = patient.name.trim();

    if (!doctorName) {
      throw new Error("Doctor name is required.");
    }
    if (!patientName) {
      throw new Error("Patient name is required.");
    }

    let doctorRow = null;
    let patientRow = null;

    {
      const { data, error } = await supabase
        .from("doctors")
        .select("id,name")
        .eq("name", doctorName)
        .limit(1);
      if (error) throw error;
      doctorRow = Array.isArray(data) && data.length ? data[0] : null;
    }
    if (!doctorRow) {
      const { data, error } = await supabase
        .from("doctors")
        .select("id,name")
        .ilike("name", `%${escapeLikePattern(doctorName)}%`)
        .limit(25);
      if (error) throw error;
      doctorRow = findDoctorByNameFromRows(data || [], doctorName) || null;
    }

    {
      const { data, error } = await supabase
        .from("patients")
        .select("id,name")
        .eq("name", patientName)
        .limit(1);
      if (error) throw error;
      patientRow = Array.isArray(data) && data.length ? data[0] : null;
    }
    if (!patientRow) {
      const { data, error } = await supabase
        .from("patients")
        .select("id,name")
        .ilike("name", `%${escapeLikePattern(patientName)}%`)
        .limit(25);
      if (error) throw error;
      patientRow = findDoctorByNameFromRows(data || [], patientName) || null;
    }

    if (!doctorRow) {
      throw new Error("Doctor not found in database. Please use an existing doctor name.");
    }
    if (!patientRow) {
      throw new Error("Patient not found in database. Please use an existing patient name.");
    }

    return { doctorId: doctorRow.id, patientId: patientRow.id };
  }

  async function upsertPrescriptionRow({ doctorId, patientId, status, pdfPath }) {
    const primaryPayload = {
      doctor_id: doctorId,
      patient_id: patientId,
      diagnosis: toCleanText(diagnosis),
      advice: toCleanText(buildAdviceWithFollowUp()),
      weight: toCleanText(vitals.weight),
      blood_pressure: toCleanText(vitals.bloodPressure),
      pulse: toCleanText(vitals.pulse),
      spo2: toCleanText(vitals.spo2),
      // Backward-compatible fallback for older schemas that still have blood_sugar.
      blood_sugar: toCleanText(vitals.spo2),
      status,
    };
    const fallbackPayload = {
      doctor_id: doctorId,
      patient_id: patientId,
      diagnosis: toCleanText(diagnosis),
      advice: toCleanText(buildAdviceWithFollowUp()),
      weight: toCleanText(vitals.weight),
      blood_pressure: toCleanText(vitals.bloodPressure),
      blood_sugar: toCleanText(vitals.spo2),
      status,
    };
    if (pdfPath !== undefined) {
      primaryPayload.pdf_path = pdfPath;
      fallbackPayload.pdf_path = pdfPath;
    }

    const legacyPayload = {
      doctor_id: doctorId,
      patient_id: patientId,
      diagnosis: toCleanText(diagnosis),
      notes: toCleanText(buildAdviceWithFollowUp()),
      prescribed_on: new Date().toISOString().slice(0, 10),
    };

    if (prescriptionId) {
      const { error } = await supabase
        .from("prescriptions")
        .update(primaryPayload)
        .eq("id", prescriptionId);

      if (error) {
        const retryWithoutModernVitalsColumns =
          isMissingColumnError(error, "pulse") || isMissingColumnError(error, "spo2");
        if (retryWithoutModernVitalsColumns) {
          const { error: fallbackError } = await supabase
            .from("prescriptions")
            .update(fallbackPayload)
            .eq("id", prescriptionId);
          if (!fallbackError) return prescriptionId;
          const fallbackNeedsLegacy =
            isMissingColumnError(fallbackError, "advice") ||
            isMissingColumnError(fallbackError, "status") ||
            isMissingColumnError(fallbackError, "pdf_path") ||
            isMissingColumnError(fallbackError, "weight") ||
            isMissingColumnError(fallbackError, "blood_pressure") ||
            isMissingColumnError(fallbackError, "blood_sugar");
          if (!fallbackNeedsLegacy) {
            throw fallbackError;
          }

          const { error: legacyError } = await supabase
            .from("prescriptions")
            .update(legacyPayload)
            .eq("id", prescriptionId);
          if (legacyError) throw legacyError;
          return prescriptionId;
        }

        const retryWithLegacy =
          isMissingColumnError(error, "advice") ||
          isMissingColumnError(error, "status") ||
          isMissingColumnError(error, "pdf_path") ||
          isMissingColumnError(error, "weight") ||
          isMissingColumnError(error, "blood_pressure") ||
          isMissingColumnError(error, "blood_sugar");
        if (!retryWithLegacy) throw error;

        const { error: legacyError } = await supabase
          .from("prescriptions")
          .update(legacyPayload)
          .eq("id", prescriptionId);
        if (legacyError) throw legacyError;
      }

      return prescriptionId;
    }

    const { data, error } = await supabase
      .from("prescriptions")
      .insert(primaryPayload)
      .select("id")
      .single();

    if (error) {
      const retryWithoutModernVitalsColumns =
        isMissingColumnError(error, "pulse") || isMissingColumnError(error, "spo2");
      if (retryWithoutModernVitalsColumns) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("prescriptions")
          .insert(fallbackPayload)
          .select("id")
          .single();
        if (!fallbackError) {
          setPrescriptionId(fallbackData.id);
          navigate(`/admin/prescriptions/edit/${fallbackData.id}`, { replace: true });
          return fallbackData.id;
        }
        const fallbackNeedsLegacy =
          isMissingColumnError(fallbackError, "advice") ||
          isMissingColumnError(fallbackError, "status") ||
          isMissingColumnError(fallbackError, "pdf_path") ||
          isMissingColumnError(fallbackError, "weight") ||
          isMissingColumnError(fallbackError, "blood_pressure") ||
          isMissingColumnError(fallbackError, "blood_sugar");
        if (!fallbackNeedsLegacy) {
          throw fallbackError;
        }

        const { data: legacyData, error: legacyError } = await supabase
          .from("prescriptions")
          .insert(legacyPayload)
          .select("id")
          .single();
        if (legacyError) throw legacyError;

        setPrescriptionId(legacyData.id);
        navigate(`/admin/prescriptions/edit/${legacyData.id}`, { replace: true });
        return legacyData.id;
      }

      const retryWithLegacy =
        isMissingColumnError(error, "advice") ||
        isMissingColumnError(error, "status") ||
        isMissingColumnError(error, "pdf_path") ||
        isMissingColumnError(error, "weight") ||
        isMissingColumnError(error, "blood_pressure") ||
        isMissingColumnError(error, "blood_sugar");
      if (!retryWithLegacy) throw error;

      const { data: legacyData, error: legacyError } = await supabase
        .from("prescriptions")
        .insert(legacyPayload)
        .select("id")
        .single();
      if (legacyError) throw legacyError;

      setPrescriptionId(legacyData.id);
      navigate(`/admin/prescriptions/edit/${legacyData.id}`, { replace: true });
      return legacyData.id;
    }

    setPrescriptionId(data.id);
    navigate(`/admin/prescriptions/edit/${data.id}`, { replace: true });
    return data.id;
  }

  async function replacePrescriptionItemsRows(targetPrescriptionId) {
    const cleanedRows = normalizeMedicineRows(medicines);

    const { error: deleteError } = await supabase
      .from("prescription_items")
      .delete()
      .eq("prescription_id", targetPrescriptionId);
    if (deleteError) throw deleteError;

    if (!cleanedRows.length) return;

    const modernRows = cleanedRows.map((row, index) => ({
      prescription_id: targetPrescriptionId,
      medicine: [row.type, row.medicine].filter(Boolean).join(" "),
      dosage: toCleanText(row.dosage),
      frequency: toCleanText(row.frequency),
      duration: toCleanText(row.duration),
      notes: toCleanText([row.mealTiming, row.notes].filter(Boolean).join(" | ")),
      sort_order: index + 1,
    }));

    const { error: modernInsertError } = await supabase
      .from("prescription_items")
      .insert(modernRows);

    if (!modernInsertError) return;

    const legacyRows = cleanedRows.map((row) => ({
      prescription_id: targetPrescriptionId,
      medicine_name: [row.type, row.medicine].filter(Boolean).join(" "),
      dosage: toCleanText(row.dosage),
      frequency: toCleanText(row.frequency),
      duration: toCleanText(row.duration),
      instructions: toCleanText([row.mealTiming, row.notes].filter(Boolean).join(" | ")),
    }));

    const { error: legacyInsertError } = await supabase
      .from("prescription_items")
      .insert(legacyRows);

    if (legacyInsertError) throw legacyInsertError;
  }

  async function persistPrescription({ status, pdfPath }) {
    const { doctorId, patientId } = await resolveDoctorAndPatientIds();
    const savedId = await upsertPrescriptionRow({
      doctorId,
      patientId,
      status,
      pdfPath,
    });
    await replacePrescriptionItemsRows(savedId);
    return savedId;
  }

  async function fetchPrescriptionItemsForEdit(targetPrescriptionId) {
    const { data: modernData, error: modernError } = await supabase
      .from("prescription_items")
      .select("id,medicine,dosage,frequency,duration,notes,sort_order")
      .eq("prescription_id", targetPrescriptionId)
      .order("sort_order", { ascending: true });

    if (!modernError && Array.isArray(modernData)) {
      return modernData.map((row) => ({
        medicine: row.medicine || "",
        dosage: row.dosage || "",
        frequency: row.frequency || "",
        duration: row.duration || "",
        notes: row.notes || "",
      }));
    }

    const { data: legacyData, error: legacyError } = await supabase
      .from("prescription_items")
      .select("id,medicine_name,dosage,frequency,duration,instructions,created_at")
      .eq("prescription_id", targetPrescriptionId)
      .order("created_at", { ascending: true });

    if (legacyError) throw legacyError;

    return (legacyData || []).map((row) => ({
      type: "",
      medicine: row.medicine_name || "",
      dosage: row.dosage || "",
      frequency: row.frequency || "",
      duration: row.duration || "",
      mealTiming: "",
      notes: row.instructions || "",
    }));
  }

  async function fetchDoctorForEdit(targetDoctorId) {
    const doctorSelectOptions = [
      "id,name,registration",
      "id,name,registration_number",
      "id,name,reg_no",
      "id,name",
    ];

    let lastError = null;
    for (const selectClause of doctorSelectOptions) {
      const response = await supabase
        .from("doctors")
        .select(selectClause)
        .eq("id", targetDoctorId)
        .maybeSingle();

      if (!response.error) {
        return response;
      }
      lastError = response.error;
      const isRegistrationColumnMismatch =
        isMissingColumnError(response.error, "registration") ||
        isMissingColumnError(response.error, "registration_number") ||
        isMissingColumnError(response.error, "reg_no");
      if (!isRegistrationColumnMismatch) {
        return response;
      }
    }

    return { data: null, error: lastError };
  }

  async function loadPrescriptionForEdit(targetId) {
    setIsLoadingExisting(true);
    setFormStatus("");
    try {
      let prescriptionRow = null;
      let prescriptionError = null;

      {
        const response = await supabase
          .from("prescriptions")
          .select(
            "id,doctor_id,patient_id,diagnosis,advice,notes,status,pdf_path,weight,blood_pressure,pulse,spo2,blood_sugar"
          )
          .eq("id", targetId)
          .single();
        prescriptionRow = response.data;
        prescriptionError = response.error;
      }

      if (
        prescriptionError &&
        (isMissingColumnError(prescriptionError, "weight") ||
          isMissingColumnError(prescriptionError, "blood_pressure") ||
          isMissingColumnError(prescriptionError, "pulse") ||
          isMissingColumnError(prescriptionError, "spo2") ||
          isMissingColumnError(prescriptionError, "blood_sugar"))
      ) {
        const fallbackResponse = await supabase
          .from("prescriptions")
          .select("id,doctor_id,patient_id,diagnosis,advice,notes,status,pdf_path")
          .eq("id", targetId)
          .single();
        prescriptionRow = fallbackResponse.data;
        prescriptionError = fallbackResponse.error;
      }

      if (prescriptionError) throw prescriptionError;

      const [doctorResult, patientResult, itemRows] = await Promise.all([
        fetchDoctorForEdit(prescriptionRow.doctor_id),
        supabase
          .from("patients")
          .select("id,name")
          .eq("id", prescriptionRow.patient_id)
          .maybeSingle(),
        fetchPrescriptionItemsForEdit(targetId),
      ]);

      if (doctorResult.error) throw doctorResult.error;
      if (patientResult.error) throw patientResult.error;

      setDoctor((prev) =>
        normalizeDoctorDetails({
          ...prev,
          name: doctorResult.data?.name || "",
          registration:
            doctorResult.data?.registration ??
            doctorResult.data?.registration_number ??
            doctorResult.data?.reg_no ??
            prev.registration,
        })
      );
      setPatient((prev) => ({
        ...prev,
        name: patientResult.data?.name || "",
      }));
      setDiagnosis(prescriptionRow.diagnosis || "");
      setAdvice(prescriptionRow.advice || prescriptionRow.notes || "");
      const nextVitals = {
        weight: prescriptionRow.weight || "",
        bloodPressure: prescriptionRow.blood_pressure || "",
        pulse: prescriptionRow.pulse || "",
        spo2: prescriptionRow.spo2 || prescriptionRow.blood_sugar || "",
      };
      const hasLoadedVitals = ALL_VITAL_FIELD_KEYS.some((fieldKey) =>
        String(nextVitals[fieldKey] || "").trim()
      );
      setVitals(nextVitals);
      setShowVitals(hasLoadedVitals);
      setVisibleVitalFields(ALL_VITAL_FIELD_KEYS);
      setMedicines(itemRows.map((item) => normalizeMedicineInputRow(item)));
      setPrescriptionStatus(prescriptionRow.status || "draft");
      setFormStatus("Prescription loaded.");
    } catch (error) {
      setFormStatus(String(error?.message || "Failed to load prescription."));
    } finally {
      setIsLoadingExisting(false);
    }
  }

  async function saveDraft() {
    if (!isSupabaseConfigured) {
      persistWorkflowMemory();
      setPrescriptionStatus("draft");
      setFormStatus("Frontend-only mode: draft is not saved to database.");
      return;
    }

    try {
      setIsSavingDraft(true);
      setFormStatus("");
      persistWorkflowMemory();
      const effectiveStatus =
        routePrescriptionId && prescriptionStatus ? prescriptionStatus : "draft";
      await persistPrescription({ status: effectiveStatus });
      setPrescriptionStatus(effectiveStatus);
      setFormStatus("Draft saved.");
    } catch (error) {
      setFormStatus(String(error?.message || "Failed to save draft."));
    } finally {
      setIsSavingDraft(false);
    }
  }

  useEffect(() => {
    if (!routePrescriptionId) return;
    if (!isSupabaseConfigured) {
      setFormStatus("Frontend-only mode: loading saved prescriptions is disabled.");
      return;
    }
    void loadPrescriptionForEdit(routePrescriptionId);
  }, [routePrescriptionId]);

  async function approveAndDownloadPDF() {
    try {
      setIsDownloading(true);
      setFormStatus("");
      const pdfBytes = await createCurrentPdfBytes();
      triggerPdfDownload(pdfBytes);

      if (!isSupabaseConfigured) {
        setPrescriptionStatus("doctor_approved");
        setIsApproveModalOpen(false);
        setFormStatus("Prescription approved locally and PDF downloaded.");
        return;
      }

      try {
        const savedDraftId = await persistPrescription({ status: "draft" });
        const fileDate = new Date().toISOString().slice(0, 10);
        const patientSlug = slugify(patient.name) || "patient";
        const targetPath = `generated/${fileDate}/${patientSlug}-${savedDraftId}.pdf`;
        const uploadFile = new Blob([pdfBytes], { type: "application/pdf" });

        const { error: uploadError } = await supabase.storage
          .from("prescriptions")
          .upload(targetPath, uploadFile, {
            contentType: "application/pdf",
            upsert: true,
          });
        if (uploadError) throw uploadError;

        await persistPrescription({ status: "doctor_approved", pdfPath: targetPath });
        setPrescriptionStatus("doctor_approved");
        setIsApproveModalOpen(false);
        setFormStatus("Prescription doctor-approved, saved, and downloaded.");
      } catch (persistError) {
        setFormStatus(
          `PDF downloaded. Save/approve sync failed: ${String(
            persistError?.message || "Unknown error"
          )}`
        );
      }
    } catch (error) {
      setFormStatus(String(error?.message || "Failed to approve prescription."));
    } finally {
      setIsDownloading(false);
    }
  }

  async function downloadPreviewPdf() {
    try {
      setIsDownloading(true);
      setFormStatus("");
      const pdfBytes = await createCurrentPdfBytes();
      triggerPdfDownload(pdfBytes);
      setFormStatus("PDF downloaded.");
    } catch (error) {
      setFormStatus(String(error?.message || "Failed to download PDF."));
    } finally {
      setIsDownloading(false);
    }
  }

  async function resaveAndDownloadPdf() {
    if (!isSupabaseConfigured) {
      try {
        setIsResavingPdf(true);
        setFormStatus("");
        const pdfBytes = await createCurrentPdfBytes();
        triggerPdfDownload(pdfBytes);
        setFormStatus("Frontend-only mode: PDF downloaded (no database sync).");
      } catch (error) {
        setFormStatus(String(error?.message || "Failed to download PDF."));
      } finally {
        setIsResavingPdf(false);
      }
      return;
    }

    try {
      setIsResavingPdf(true);
      setFormStatus("");
      persistWorkflowMemory();
      const currentDoctorName = doctor.name.trim();
      const hasMatchingAutoSignature =
        !!autoSignatureSource &&
        currentDoctorName &&
        signatureDoctorName.toLowerCase() === currentDoctorName.toLowerCase();

      const resolvedSignature =
        signatureDataUrl ||
        (hasMatchingAutoSignature ? autoSignatureSource : "") ||
        (await fetchSignatureFromDoctorProfile(doctor.name, { silent: true }));

      const pdfBytes = await generatePrescriptionPdfFromTemplate({
        doctor,
        patient,
        diagnosis,
        advice: buildAdviceWithFollowUp(),
        medicines,
        vitals,
        visibleVitalFields: effectiveVisibleVitalFields,
        date: today,
        signatureDataUrl: resolvedSignature,
        clinicHours: clinicMeta.hours,
        closedDays: clinicMeta.closedDays,
        pageSize: pdfPageSize,
      });

      const effectiveStatus =
        routePrescriptionId && prescriptionStatus ? prescriptionStatus : "draft";
      const savedId = await persistPrescription({ status: effectiveStatus });
      const fileDate = new Date().toISOString().slice(0, 10);
      const patientSlug = slugify(patient.name) || "patient";
      const targetPath = `generated/${fileDate}/${patientSlug}-${savedId}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("prescriptions")
        .upload(targetPath, new Blob([pdfBytes], { type: "application/pdf" }), {
          contentType: "application/pdf",
          upsert: true,
        });
      if (uploadError) throw uploadError;

      await persistPrescription({ status: effectiveStatus, pdfPath: targetPath });
      setPrescriptionStatus(effectiveStatus);

      const blobUrl = URL.createObjectURL(new Blob([pdfBytes], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `${(patient.name || "prescription")
        .toLowerCase()
        .replace(/\s+/g, "-")}.pdf`;
      anchor.click();
      URL.revokeObjectURL(blobUrl);

      setFormStatus("Prescription re-saved and PDF updated.");
    } catch (error) {
      setFormStatus(String(error?.message || "Failed to re-save and download PDF."));
    } finally {
      setIsResavingPdf(false);
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8BA4BF]">
              My Stree Admin Desk
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">
              Create Prescription
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Fill quickly, review instantly, approve with confidence.
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
              <label className="flex w-full items-center justify-between gap-2 rounded-xl border border-[#8BA4BF]/50 bg-white px-3 py-2 text-xs font-semibold text-slate-700 sm:w-auto sm:min-w-[230px]">
                Template
                <select
                  ref={templateSelectRef}
                  value={selectedTemplateKey}
                  onChange={(e) => setSelectedTemplateKey(e.target.value)}
                  className="min-w-[140px] rounded-md border border-[#8BA4BF]/50 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-[#ED5B2D]"
                >
                  <option value="">Select template</option>
                  {PRESCRIPTION_TEMPLATES.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={handleLoadTemplate}
                className={`w-full rounded-xl border px-4 py-2.5 text-sm font-semibold transition sm:w-auto ${
                  selectedTemplateKey
                    ? "border-[#ED5B2D]/30 bg-[#FFF2EC] text-[#A6401E] hover:bg-[#FFE6DA]"
                    : "border-dashed border-[#8BA4BF]/60 bg-white text-slate-700 hover:bg-[#BFE2FE]/30"
                }`}
              >
                {selectedTemplateKey ? "Load Template" : "Select Template First"}
              </button>
              <button
                type="button"
                onClick={openApproveModal}
                disabled={isDownloading || isSavingDraft}
                className="w-full rounded-xl bg-[#ED5B2D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#EF6A40] sm:w-auto"
              >
                Review & Approve Prescription
              </button>
              <button
                type="button"
                onClick={saveDraft}
                disabled={isSavingDraft || isDownloading || isResavingPdf}
                className="w-full rounded-xl border border-[#8BA4BF]/60 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-[#BFE2FE]/30 sm:w-auto"
              >
                {isSavingDraft ? "Saving..." : "Save Draft"}
              </button>
              {routePrescriptionId ? (
                <button
                  type="button"
                  onClick={resaveAndDownloadPdf}
                  disabled={isResavingPdf || isSavingDraft || isDownloading}
                  className="w-full rounded-xl border border-[#8BA4BF]/60 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-[#BFE2FE]/30 sm:w-auto"
                >
                  {isResavingPdf ? "Processing..." : "Re-save & Download PDF"}
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-slate-500">Shortcut: Ctrl/Cmd + Enter</p>
            {isLoadingExisting ? (
              <p className="mt-2 text-xs text-slate-600">Loading prescription...</p>
            ) : null}
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
                    placeholder="Registration Number"
                    value={doctor.registration}
                    onChange={(e) => updateDoctor("registration", e.target.value)}
                    className={inputClassName}
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={rememberDoctorInfo}
                      onChange={(e) => setRememberDoctorInfo(e.target.checked)}
                      className="h-4 w-4 rounded border-[#8BA4BF]/60 text-[#ED5B2D] focus:ring-[#BFE2FE]"
                    />
                    Remember my doctor info for this clinic session
                  </label>

                  <div className="rounded-xl border border-dashed border-[#8BA4BF]/60 bg-[#BFE2FE]/20 p-3">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8BA4BF]">
                          Signature
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Reuse the last signature by default and upload only if the doctor changes.
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                        <input
                          type="checkbox"
                          checked={useLastSignature}
                          onChange={(e) => setUseLastSignature(e.target.checked)}
                          className="h-4 w-4 rounded border-[#8BA4BF]/60 text-[#ED5B2D] focus:ring-[#BFE2FE]"
                        />
                        Use last signature
                      </label>
                    </div>

                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fetchSignatureFromDoctorProfile(doctor.name)}
                        disabled={isFetchingSignature}
                        className="rounded-lg border border-[#8BA4BF]/60 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-[#BFE2FE]/30 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isFetchingSignature ? "Fetching..." : "Auto Fetch Signature"}
                      </button>
                      {signatureStatus ? (
                        <span className="text-[11px] font-medium text-slate-500">{signatureStatus}</span>
                      ) : null}
                    </div>

                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      onChange={onSignatureChange}
                      className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#ED5B2D] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-[#EF6A40]"
                    />

                    {effectiveSignatureSource ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#8BA4BF]/30 bg-white/80 p-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={effectiveSignatureSource}
                            alt="Signature preview"
                            className="h-12 w-40 rounded-md border border-[#8BA4BF]/40 bg-white object-contain p-1"
                          />
                          <div className="text-xs text-slate-600">
                            <p className="font-semibold text-slate-700">
                              {signatureDoctorName ? `Signature ready for Dr. ${signatureDoctorName}` : "Signature ready"}
                            </p>
                            <p className="mt-1">This signature will be reused until you replace it.</p>
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
              ) : null}
            </div>

            <div className="rounded-2xl border border-[#8BA4BF]/30 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className={`${sectionTitleClassName} mb-0`}>Patient</p>
                {hasValue(patient.name) ? (
                  <span className="rounded-full bg-[#F3FAF4] px-2.5 py-1 text-[11px] font-semibold text-[#2F7A35]">
                    Complete
                  </span>
                ) : null}
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Patient Name"
                  value={patient.name}
                  onChange={(e) => updatePatient("name", e.target.value)}
                  className={inputClassName}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                  <input
                    type="text"
                    placeholder="Age"
                    value={patient.age}
                    onChange={(e) => updatePatient("age", e.target.value)}
                    className={inputClassName}
                  />
                  <input
                    type="text"
                    placeholder="Gender"
                    value={patient.gender}
                    onChange={(e) => updatePatient("gender", e.target.value)}
                    className={inputClassName}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#8BA4BF]/30 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className={`${sectionTitleClassName} mb-0`}>Vitals</p>
                  <p className="mt-1 text-sm text-slate-600">Keep vitals only when they are needed for this prescription.</p>
                </div>
                {showVitals && hasAnyVitalValue ? (
                  <span className="rounded-full bg-[#F3FAF4] px-2.5 py-1 text-[11px] font-semibold text-[#2F7A35]">
                    Complete
                  </span>
                ) : null}
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={showVitals ? removeAllVitalFields : restoreAllVitalFields}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    showVitals
                      ? "border border-[#F3C3B2] bg-[#FFF5F0] text-[#B74722] hover:bg-[#FFE9DE]"
                      : "bg-[#ED5B2D] text-white hover:bg-[#EF6A40]"
                  }`}
                >
                  {showVitals ? "Remove Vitals" : "Add Vitals"}
                </button>
              </div>
              {showVitals ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {VITAL_FIELDS.map((field) => (
                    <div key={field.key} className="rounded-xl border border-[#BFE2FE] bg-[#F8FBFF] p-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {field.label}
                      </p>
                      <input
                        type="text"
                        placeholder={field.placeholder}
                        value={vitals[field.key]}
                        onChange={(e) => updateVitals(field.key, e.target.value)}
                        className={inputClassName}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Vitals are removed from this prescription and will not appear in the PDF.</p>
              )}
            </div>

            <div className="rounded-2xl border border-[#8BA4BF]/30 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className={`${sectionTitleClassName} mb-0`}>Diagnosis</p>
                  <p className="mt-1 text-sm text-slate-600">Write the diagnosis directly with no extra suggestions.</p>
                </div>
                <div className="flex items-center gap-2">
                  {hasValue(diagnosis) ? (
                    <span className="rounded-full bg-[#F3FAF4] px-2.5 py-1 text-[11px] font-semibold text-[#2F7A35]">
                      Complete
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setDiagnosis("")}
                    className="rounded-lg border border-[#8BA4BF]/60 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-[#BFE2FE]/30"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <textarea
                rows={4}
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="Write clinical diagnosis"
                className={`${inputClassName} min-h-[110px] resize-y leading-relaxed`}
              />
            </div>

            <div className="rounded-2xl border border-[#8BA4BF]/30 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className={`${sectionTitleClassName} mb-0`}>Medicines</p>
                  <p className="mt-1 text-sm text-slate-600">Each row stays simple, and every field can be cleared on its own.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {medicines.some((item) => hasValue(item?.medicine)) ? (
                    <span className="rounded-full bg-[#F3FAF4] px-2.5 py-1 text-[11px] font-semibold text-[#2F7A35]">
                      Complete
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={addMedicineRow}
                    className="rounded-lg bg-[#FF833C] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#ED5B2D]"
                  >
                    + Add Medicine
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {medicines.length ? (
                  medicines.map((medicine, index) => (
                    <div
                      key={index}
                      className={`rounded-xl border p-3 ${
                        index % 2 === 0
                          ? "border-[#BFE2FE] bg-[#FCF4D9]/35"
                          : "border-[#DCE8F3] bg-[#F8FBFF]"
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ED5B2D] text-sm font-semibold text-white">
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">Medicine {index + 1}</p>
                            <p className="text-xs text-slate-500">Clear any subsection without affecting the rest of the row.</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMedicineRow(index)}
                          className="rounded-lg border border-[#F3C3B2] bg-[#FFF5F0] px-3 py-1.5 text-xs font-semibold text-[#B74722] transition hover:bg-[#FFE9DE]"
                        >
                          Remove medicine
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {MEDICINE_FIELD_CONFIG.map((field) => (
                          <div
                            key={field.key}
                            className={`rounded-xl border border-[#BFE2FE]/80 bg-white/90 p-2.5 ${field.span}`}
                          >
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                {field.label}
                              </p>
                              <button
                                type="button"
                                onClick={() => removeMedicineField(index, field.key)}
                                className="text-[11px] font-semibold text-slate-400 transition hover:text-[#B74722]"
                              >
                                Clear
                              </button>
                            </div>

                            {field.key === "type" ? (
                              <select
                                value={medicine.type || ""}
                                onChange={(e) => updateMedicine(index, "type", e.target.value)}
                                className={inputClassName}
                              >
                                <option value="">Select Type</option>
                                {MEDICINE_TYPE_OPTIONS.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : null}

                            {field.key === "medicine" ? (
                              <input
                                type="text"
                                placeholder="Medicine Name"
                                value={medicine.medicine}
                                onChange={(e) => updateMedicine(index, "medicine", e.target.value)}
                                list="common-medicine-options"
                                className={inputClassName}
                              />
                            ) : null}

                            {field.key === "dosage" ? (
                              <input
                                type="text"
                                placeholder="Dosage"
                                value={medicine.dosage}
                                onChange={(e) => updateMedicine(index, "dosage", e.target.value)}
                                className={inputClassName}
                              />
                            ) : null}

                            {field.key === "frequency" ? (
                              <input
                                type="text"
                                placeholder="Frequency"
                                value={medicine.frequency}
                                onChange={(e) => updateMedicine(index, "frequency", e.target.value)}
                                className={inputClassName}
                              />
                            ) : null}

                            {field.key === "duration" ? (
                              <input
                                type="text"
                                placeholder="Duration"
                                value={medicine.duration}
                                onChange={(e) => updateMedicine(index, "duration", e.target.value)}
                                className={inputClassName}
                              />
                            ) : null}

                            {field.key === "mealTiming" ? (
                              <select
                                value={medicine.mealTiming || ""}
                                onChange={(e) => updateMedicine(index, "mealTiming", e.target.value)}
                                className={inputClassName}
                              >
                                <option value="">Select Meal Timing</option>
                                {MEAL_TIMING_OPTIONS.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            ) : null}

                            {field.key === "notes" ? (
                              <textarea
                                rows={2}
                                placeholder="Medication remark"
                                value={medicine.notes}
                                onChange={(e) => updateMedicine(index, "notes", e.target.value)}
                                className={`${inputClassName} min-h-[84px] resize-y`}
                              />
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-[#BFE2FE] bg-[#FCF4D9]/20 p-4 text-sm text-slate-500">
                    No medicine sections added.
                  </div>
                )}
              </div>
              <datalist id="common-medicine-options">
                {COMMON_MEDICINES.map((medicineName) => (
                  <option key={medicineName} value={medicineName} />
                ))}
              </datalist>
            </div>

            <div className="rounded-2xl border border-[#8BA4BF]/30 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className={`${sectionTitleClassName} mb-0`}>Advice</p>
                  <p className="mt-1 text-sm text-slate-600">A single writing area keeps advice fast and friendly for doctors.</p>
                </div>
                <div className="flex items-center gap-2">
                  {hasValue(advice) ? (
                    <span className="rounded-full bg-[#F3FAF4] px-2.5 py-1 text-[11px] font-semibold text-[#2F7A35]">
                      Complete
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setAdvice("")}
                    className="rounded-lg border border-[#8BA4BF]/60 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-[#BFE2FE]/30"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <textarea
                rows={5}
                value={advice}
                onChange={(e) => setAdvice(e.target.value)}
                placeholder="Write advice or follow-up instructions"
                className={`${inputClassName} min-h-[140px] resize-y leading-relaxed`}
              />
              <p className="mt-3 text-sm text-slate-500">This advice appears directly in the prescription PDF.</p>
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
                Live Print Preview
              </p>
              <p className="text-xs text-slate-500">Frontend print layout with live section updates</p>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Export size: {pdfPageSize === "letter" ? "US Letter (fitted)" : "A4"}
            </p>
          </header>

          <div className="flex-1 p-2 sm:p-4 lg:min-h-0 lg:overflow-y-auto xl:p-6">
            <PrescriptionAssetLivePreview
              doctor={doctor}
              patient={patient}
              diagnosis={diagnosis}
              advice={buildAdviceWithFollowUp()}
              medicines={medicines}
              vitals={vitals}
              visibleVitalFields={effectiveVisibleVitalFields}
              date={today}
              signatureDataUrl={effectiveSignatureSource}
              clinicHours={clinicMeta.hours}
              closedDays={clinicMeta.closedDays}
            />
          </div>
        </section>
      </div>

      {isApproveModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#8BA4BF]/45 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-[#8BA4BF]/40 bg-white shadow-2xl">
            <div className="flex flex-col gap-2 border-b border-[#BFE2FE] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Approve Prescription PDF</h3>
                <p className="text-sm text-slate-500">Verify the live print layout and download the PDF.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="max-h-[58vh] overflow-auto bg-[#BFE2FE]/25 p-2 sm:max-h-[70vh] sm:p-4">
              <PrescriptionAssetLivePreview
                doctor={doctor}
                patient={patient}
                diagnosis={diagnosis}
                advice={buildAdviceWithFollowUp()}
                medicines={medicines}
                vitals={vitals}
                visibleVitalFields={effectiveVisibleVitalFields}
                date={today}
                signatureDataUrl={effectiveSignatureSource}
                clinicHours={clinicMeta.hours}
                closedDays={clinicMeta.closedDays}
              />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#BFE2FE] px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-5">
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                className="w-full rounded-lg border border-[#8BA4BF]/60 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-[#BFE2FE]/30 sm:w-auto"
                disabled={isDownloading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={downloadPreviewPdf}
                className="w-full rounded-lg border border-[#8BA4BF]/70 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-[#BFE2FE]/25 disabled:opacity-60 sm:w-auto"
                disabled={isDownloading}
              >
                {isDownloading ? "Preparing..." : "Download PDF"}
              </button>
              <button
                type="button"
                onClick={approveAndDownloadPDF}
                className="w-full rounded-lg bg-[#ED5B2D] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#EF6A40] disabled:opacity-60 sm:w-auto"
                disabled={isDownloading}
              >
                {isDownloading ? "Preparing PDF..." : "Approve & Download"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
