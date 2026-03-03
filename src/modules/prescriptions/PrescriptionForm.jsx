import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useNavigate, useParams } from "react-router-dom";
import PrescriptionAssetLivePreview from "./PrescriptionAssetLivePreview";
import { generatePrescriptionPdfFromTemplate } from "./generateTemplatePdf";

function createMedicineRow() {
  return { medicine: "", dosage: "", frequency: "", duration: "", notes: "" };
}

const inputClassName =
  "w-full rounded-xl border border-[#8BA4BF]/50 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:border-[#ED5B2D] focus:ring-2 focus:ring-[#BFE2FE]";

const sectionTitleClassName =
  "mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#8BA4BF]";

const DEFAULT_CLINIC_HOURS = "Mon-Sat: 9:00 AM - 7:00 PM";
const DEFAULT_CLOSED_DAYS = "Sunday";

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
    .map((item) => ({
      medicine: String(item?.medicine || "").trim(),
      dosage: String(item?.dosage || "").trim(),
      frequency: String(item?.frequency || "").trim(),
      duration: String(item?.duration || "").trim(),
      notes: String(item?.notes || "").trim(),
    }))
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

  const today = useMemo(
    () =>
      new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    []
  );

  const [doctor, setDoctor] = useState({
    name: "",
    registration: "",
  });
  const [patient, setPatient] = useState({
    name: "",
    age: "",
    gender: "",
  });
  const [vitals, setVitals] = useState({
    weight: "",
    bloodPressure: "",
    bloodSugar: "",
  });
  const [clinicMeta, setClinicMeta] = useState({
    hours: DEFAULT_CLINIC_HOURS,
    closedDays: DEFAULT_CLOSED_DAYS,
  });
  const [diagnosis, setDiagnosis] = useState("");
  const [advice, setAdvice] = useState("");
  const [medicines, setMedicines] = useState([createMedicineRow()]);
  const [pdfPageSize, setPdfPageSize] = useState("a4");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [autoSignatureSource, setAutoSignatureSource] = useState("");
  const [signatureDoctorName, setSignatureDoctorName] = useState("");
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

  const canRemoveMedicine = medicines.length > 1;
  const effectiveSignatureSource = signatureDataUrl || autoSignatureSource;
  const debouncedDiagnosis = useDebouncedValue(diagnosis);
  const debouncedAdvice = useDebouncedValue(advice);
  const debouncedMedicines = useDebouncedValue(medicines);
  const debouncedVitals = useDebouncedValue(vitals);

  useEffect(() => {
    setPrescriptionId(routePrescriptionId || "");
    if (!routePrescriptionId) {
      setPrescriptionStatus("draft");
    }
  }, [routePrescriptionId]);

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void openApproveModal();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [doctor.name, signatureDataUrl, autoSignatureSource, signatureDoctorName]);

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

  function updateDoctor(field, value) {
    setDoctor((prev) => ({ ...prev, [field]: value }));
  }

  function updatePatient(field, value) {
    setPatient((prev) => ({ ...prev, [field]: value }));
  }

  function updateVitals(field, value) {
    setVitals((prev) => ({ ...prev, [field]: value }));
  }

  function updateClinicMeta(field, value) {
    setClinicMeta((prev) => ({ ...prev, [field]: value }));
  }

  function updateMedicine(index, field, value) {
    setMedicines((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function addMedicineRow() {
    setMedicines((prev) => [...prev, createMedicineRow()]);
  }

  function removeMedicineRow(index) {
    if (!canRemoveMedicine) return;
    setMedicines((prev) => prev.filter((_, i) => i !== index));
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
      setSignatureDataUrl(String(reader.result || ""));
      setSignatureStatus("Using manually uploaded signature.");
    };
    reader.readAsDataURL(file);
  }

  function clearSignature() {
    setSignatureDataUrl("");
    setAutoSignatureSource("");
    setSignatureDoctorName("");
    setSignatureStatus("Signature cleared.");
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

    return generatePrescriptionPdfFromTemplate({
      doctor,
      patient,
      diagnosis,
      advice,
      medicines,
      vitals,
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
      advice: toCleanText(advice),
      weight: toCleanText(vitals.weight),
      blood_pressure: toCleanText(vitals.bloodPressure),
      blood_sugar: toCleanText(vitals.bloodSugar),
      status,
    };
    if (pdfPath !== undefined) {
      primaryPayload.pdf_path = pdfPath;
    }

    const legacyPayload = {
      doctor_id: doctorId,
      patient_id: patientId,
      diagnosis: toCleanText(diagnosis),
      notes: toCleanText(advice),
      prescribed_on: new Date().toISOString().slice(0, 10),
    };

    if (prescriptionId) {
      const { error } = await supabase
        .from("prescriptions")
        .update(primaryPayload)
        .eq("id", prescriptionId);

      if (error) {
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
      medicine: row.medicine,
      dosage: toCleanText(row.dosage),
      frequency: toCleanText(row.frequency),
      duration: toCleanText(row.duration),
      notes: toCleanText(row.notes),
      sort_order: index + 1,
    }));

    const { error: modernInsertError } = await supabase
      .from("prescription_items")
      .insert(modernRows);

    if (!modernInsertError) return;

    const legacyRows = cleanedRows.map((row) => ({
      prescription_id: targetPrescriptionId,
      medicine_name: row.medicine,
      dosage: toCleanText(row.dosage),
      frequency: toCleanText(row.frequency),
      duration: toCleanText(row.duration),
      instructions: toCleanText(row.notes),
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
      medicine: row.medicine_name || "",
      dosage: row.dosage || "",
      frequency: row.frequency || "",
      duration: row.duration || "",
      notes: row.instructions || "",
    }));
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
            "id,doctor_id,patient_id,diagnosis,advice,notes,status,pdf_path,weight,blood_pressure,blood_sugar"
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
        supabase
          .from("doctors")
          .select("id,name")
          .eq("id", prescriptionRow.doctor_id)
          .maybeSingle(),
        supabase
          .from("patients")
          .select("id,name")
          .eq("id", prescriptionRow.patient_id)
          .maybeSingle(),
        fetchPrescriptionItemsForEdit(targetId),
      ]);

      if (doctorResult.error) throw doctorResult.error;
      if (patientResult.error) throw patientResult.error;

      setDoctor((prev) => ({
        ...prev,
        name: doctorResult.data?.name || "",
      }));
      setPatient((prev) => ({
        ...prev,
        name: patientResult.data?.name || "",
      }));
      setDiagnosis(prescriptionRow.diagnosis || "");
      setAdvice(prescriptionRow.advice || prescriptionRow.notes || "");
      setVitals({
        weight: prescriptionRow.weight || "",
        bloodPressure: prescriptionRow.blood_pressure || "",
        bloodSugar: prescriptionRow.blood_sugar || "",
      });
      setMedicines(itemRows.length ? itemRows : [createMedicineRow()]);
      setPrescriptionStatus(prescriptionRow.status || "draft");
      setFormStatus("Prescription loaded.");
    } catch (error) {
      setFormStatus(String(error?.message || "Failed to load prescription."));
    } finally {
      setIsLoadingExisting(false);
    }
  }

  async function saveDraft() {
    try {
      setIsSavingDraft(true);
      setFormStatus("");
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
    void loadPrescriptionForEdit(routePrescriptionId);
  }, [routePrescriptionId]);

  async function approveAndDownloadPDF() {
    try {
      setIsDownloading(true);
      setFormStatus("");
      const pdfBytes = await createCurrentPdfBytes();
      triggerPdfDownload(pdfBytes);

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
    try {
      setIsResavingPdf(true);
      setFormStatus("");
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
        advice,
        medicines,
        vitals,
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
              <p className={sectionTitleClassName}>Doctor</p>
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

                <div className="rounded-xl border border-dashed border-[#8BA4BF]/60 bg-[#BFE2FE]/20 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#8BA4BF]">
                    Signature
                  </p>
                  <div className="mb-2 flex items-center justify-between gap-2">
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
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <img
                        src={effectiveSignatureSource}
                        alt="Signature preview"
                        className="h-12 w-40 rounded-md border border-[#8BA4BF]/40 bg-white object-contain p-1"
                      />
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

            <div className="rounded-2xl border border-[#8BA4BF]/30 bg-white p-4 shadow-sm">
              <p className={sectionTitleClassName}>Patient</p>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Patient Name"
                  value={patient.name}
                  onChange={(e) => updatePatient("name", e.target.value)}
                  className={inputClassName}
                />
                <div className="grid grid-cols-2 gap-3">
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
              <p className={sectionTitleClassName}>Vitals</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  placeholder="Weight (e.g. 64 kg)"
                  value={vitals.weight}
                  onChange={(e) => updateVitals("weight", e.target.value)}
                  className={inputClassName}
                />
                <input
                  type="text"
                  placeholder="Blood Pressure (e.g. 120/80)"
                  value={vitals.bloodPressure}
                  onChange={(e) => updateVitals("bloodPressure", e.target.value)}
                  className={inputClassName}
                />
                <input
                  type="text"
                  placeholder="Blood Sugar (e.g. 98 mg/dL)"
                  value={vitals.bloodSugar}
                  onChange={(e) => updateVitals("bloodSugar", e.target.value)}
                  className={inputClassName}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-[#8BA4BF]/30 bg-white p-4 shadow-sm">
              <p className={sectionTitleClassName}>Clinic Timings</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  placeholder="Operating Hours"
                  value={clinicMeta.hours}
                  onChange={(e) => updateClinicMeta("hours", e.target.value)}
                  className={inputClassName}
                />
                <input
                  type="text"
                  placeholder="Closed Days"
                  value={clinicMeta.closedDays}
                  onChange={(e) => updateClinicMeta("closedDays", e.target.value)}
                  className={inputClassName}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-[#8BA4BF]/30 bg-white p-4 shadow-sm">
              <p className={sectionTitleClassName}>Diagnosis</p>
              <textarea
                rows={5}
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="Clinical diagnosis"
                className={`${inputClassName} min-h-[120px] resize-y leading-relaxed`}
              />
            </div>

            <div className="rounded-2xl border border-[#8BA4BF]/30 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className={sectionTitleClassName}>Medicines</p>
                <button
                  type="button"
                  onClick={addMedicineRow}
                  className="rounded-lg bg-[#FF833C] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#ED5B2D]"
                >
                  + Add Row
                </button>
              </div>

              <div className="space-y-3">
                {medicines.map((medicine, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-[#BFE2FE] bg-[#FCF4D9]/35 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-600">Medicine {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => removeMedicineRow(index)}
                        disabled={!canRemoveMedicine}
                        className="text-xs font-semibold text-[#ED5B2D] disabled:cursor-not-allowed disabled:text-slate-300"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        type="text"
                        placeholder="Medicine Name"
                        value={medicine.medicine}
                        onChange={(e) => updateMedicine(index, "medicine", e.target.value)}
                        className={inputClassName}
                      />
                      <input
                        type="text"
                        placeholder="Dosage"
                        value={medicine.dosage}
                        onChange={(e) => updateMedicine(index, "dosage", e.target.value)}
                        className={inputClassName}
                      />
                      <input
                        type="text"
                        placeholder="Frequency"
                        value={medicine.frequency}
                        onChange={(e) => updateMedicine(index, "frequency", e.target.value)}
                        className={inputClassName}
                      />
                      <input
                        type="text"
                        placeholder="Duration"
                        value={medicine.duration}
                        onChange={(e) => updateMedicine(index, "duration", e.target.value)}
                        className={inputClassName}
                      />
                      <textarea
                        rows={2}
                        placeholder="Medication remark (e.g. after food, avoid driving, with warm water)"
                        value={medicine.notes}
                        onChange={(e) => updateMedicine(index, "notes", e.target.value)}
                        className={`${inputClassName} sm:col-span-2`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#8BA4BF]/30 bg-white p-4 shadow-sm">
              <p className={sectionTitleClassName}>Advice</p>
              <textarea
                rows={5}
                value={advice}
                onChange={(e) => setAdvice(e.target.value)}
                placeholder="Advice / follow-up instructions"
                className={`${inputClassName} min-h-[120px] resize-y leading-relaxed`}
              />
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
                Live Preview (Template Linked)
              </p>
              <p className="text-xs text-slate-500">Asset PDF with live overlay</p>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Export size: {pdfPageSize === "letter" ? "US Letter (fitted)" : "A4"}
            </p>
          </header>

          <div className="flex-1 p-3 sm:p-5 lg:min-h-0 lg:overflow-y-auto xl:p-8">
            <PrescriptionAssetLivePreview
              doctor={doctor}
              patient={patient}
              diagnosis={debouncedDiagnosis}
              advice={debouncedAdvice}
              medicines={debouncedMedicines}
              vitals={debouncedVitals}
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
                <p className="text-sm text-slate-500">Template matched. Verify content and download.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="max-h-[58vh] overflow-auto bg-[#BFE2FE]/25 p-3 sm:max-h-[70vh] sm:p-4">
              <PrescriptionAssetLivePreview
                doctor={doctor}
                patient={patient}
                diagnosis={debouncedDiagnosis}
                advice={debouncedAdvice}
                medicines={debouncedMedicines}
                vitals={debouncedVitals}
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
