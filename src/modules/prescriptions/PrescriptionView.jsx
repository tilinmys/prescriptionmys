import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "../../lib/supabaseClient";

const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(import.meta.env.VITE_SUPABASE_URL || "").origin;
  } catch {
    return "";
  }
})();

function isTrustedSupabaseStorageUrl(value) {
  if (!/^https?:\/\//i.test(String(value || ""))) return false;
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
  const normalized = String(path || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/^prescriptions\//i, "");
  if (!normalized) return "";
  if (normalized.includes("..") || normalized.includes("\\")) return "";
  if (!/^[a-zA-Z0-9/_\-.]+$/.test(normalized)) return "";
  return normalized;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatStatus(value) {
  return String(value || "draft")
    .trim()
    .replace(/_/g, " ");
}

function isMissingColumnError(error, columnName) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes(`column "${String(columnName).toLowerCase()}"`);
}

export default function PrescriptionView() {
  const { id } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionStatusMessage, setActionStatusMessage] = useState("");
  const [prescription, setPrescription] = useState(null);
  const [doctorName, setDoctorName] = useState("-");
  const [patientName, setPatientName] = useState("-");
  const [items, setItems] = useState([]);
  const [pdfUrl, setPdfUrl] = useState("");

  if (!isSupabaseConfigured) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-sm">
        Frontend-only mode: database view is disabled.
      </div>
    );
  }

  const loadPrescription = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMessage("");
    try {
      let prescriptionRow = null;
      let prescriptionError = null;
      {
        const response = await supabase
          .from("prescriptions")
          .select(
            "id,doctor_id,patient_id,diagnosis,advice,notes,status,pdf_path,created_at,weight,blood_pressure,pulse,spo2,blood_sugar"
          )
          .eq("id", id)
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
          .select("id,doctor_id,patient_id,diagnosis,advice,notes,status,pdf_path,created_at")
          .eq("id", id)
          .single();
        prescriptionRow = fallbackResponse.data;
        prescriptionError = fallbackResponse.error;
      }
      if (prescriptionError) throw prescriptionError;

      const [doctorResult, patientResult] = await Promise.all([
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
      ]);

      if (doctorResult.error) throw doctorResult.error;
      if (patientResult.error) throw patientResult.error;

      let itemRows = [];
      const { data: modernItems, error: modernItemsError } = await supabase
        .from("prescription_items")
        .select("id,medicine,dosage,frequency,duration,notes,sort_order")
        .eq("prescription_id", id)
        .order("sort_order", { ascending: true });

      if (!modernItemsError && Array.isArray(modernItems)) {
          itemRows = modernItems.map((row) => ({
            id: row.id,
            medicine: row.medicine || "-",
            dosage: row.dosage || "-",
            frequency: row.frequency || "-",
            duration: row.duration || "-",
            notes: row.notes || "-",
          }));
      } else {
        const { data: legacyItems, error: legacyItemsError } = await supabase
          .from("prescription_items")
          .select("id,medicine_name,dosage,frequency,duration,instructions,created_at")
          .eq("prescription_id", id)
          .order("created_at", { ascending: true });
        if (legacyItemsError) throw legacyItemsError;
        itemRows = (legacyItems || []).map((row) => ({
          id: row.id,
          medicine: row.medicine_name || "-",
          dosage: row.dosage || "-",
          frequency: row.frequency || "-",
          duration: row.duration || "-",
          notes: row.instructions || "-",
        }));
      }

      let resolvedPdfUrl = "";
      const rawPath = prescriptionRow.pdf_path;
      if (rawPath) {
        if (isTrustedSupabaseStorageUrl(rawPath)) {
          resolvedPdfUrl = rawPath;
        } else {
          const path = normalizeStoragePath(rawPath);
          if (path) {
            const { data: signedData, error: signedError } = await supabase.storage
              .from("prescriptions")
              .createSignedUrl(path, 60 * 20);
            if (!signedError && signedData?.signedUrl) {
              resolvedPdfUrl = signedData.signedUrl;
            }
          }
        }
      }

      setPrescription(prescriptionRow);
      setDoctorName(doctorResult.data?.name || "-");
      setPatientName(patientResult.data?.name || "-");
      setItems(itemRows);
      setPdfUrl(resolvedPdfUrl);
    } catch (error) {
      setErrorMessage(String(error?.message || "Failed to load prescription."));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadPrescription();
  }, [loadPrescription]);

  async function updatePrescriptionStatus(nextStatus) {
    if (!prescription?.id) return;
    setIsUpdatingStatus(true);
    setActionStatusMessage("");
    try {
      const { error } = await supabase
        .from("prescriptions")
        .update({ status: nextStatus })
        .eq("id", prescription.id);
      if (error) throw error;

      setActionStatusMessage(`Status updated to ${formatStatus(nextStatus)}.`);
      await loadPrescription();
    } catch (error) {
      setActionStatusMessage(String(error?.message || "Failed to update status."));
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  const adviceText = useMemo(() => {
    if (!prescription) return "-";
    return prescription.advice || prescription.notes || "-";
  }, [prescription]);

  if (isLoading) {
    return <div className="p-6 bg-white rounded-xl shadow-sm">Loading prescription...</div>;
  }

  if (errorMessage) {
    return <div className="p-6 bg-white rounded-xl shadow-sm text-red-600">{errorMessage}</div>;
  }

  if (!prescription) {
    return <div className="p-6 bg-white rounded-xl shadow-sm">Prescription not found.</div>;
  }

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Prescription Details</h2>
        <div className="flex items-center gap-2">
          <Link
            to={`/admin/prescriptions/edit/${prescription.id}`}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Edit
          </Link>
          {pdfUrl ? (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Open PDF
            </a>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => updatePrescriptionStatus("admin_verified")}
          disabled={isUpdatingStatus || prescription.status === "admin_verified"}
          className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Mark Admin Verified
        </button>
        <button
          type="button"
          onClick={() => updatePrescriptionStatus("dispensed")}
          disabled={isUpdatingStatus || prescription.status === "dispensed"}
          className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Mark Dispensed
        </button>
        <button
          type="button"
          onClick={() => updatePrescriptionStatus("cancelled")}
          disabled={isUpdatingStatus || prescription.status === "cancelled"}
          className="rounded-md border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {actionStatusMessage ? (
        <p className="text-xs text-slate-600">{actionStatusMessage}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Patient</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{patientName}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Doctor</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{doctorName}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</p>
          <p className="mt-1 text-sm font-medium text-slate-900">{formatDate(prescription.created_at)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
          <p className="mt-1 text-sm font-medium capitalize text-slate-900">
            {formatStatus(prescription.status)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Blood Pressure</p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {prescription.blood_pressure || "-"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pulse</p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {prescription.pulse || "-"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">SpO2</p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {prescription.spo2 || prescription.blood_sugar || "-"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Weight</p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {prescription.weight || "-"}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Diagnosis</p>
        <p className="mt-1 text-sm text-slate-900">{prescription.diagnosis || "-"}</p>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Advice</p>
        <p className="mt-1 text-sm text-slate-900">{adviceText}</p>
      </div>

      <div className="rounded-lg border border-slate-200 p-3">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Medicines</p>
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Medicine
                </th>
                <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Dosage
                </th>
                <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Frequency
                </th>
                <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Duration
                </th>
                <th className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2 pr-4 text-sm text-slate-900">{item.medicine}</td>
                  <td className="py-2 pr-4 text-sm text-slate-900">{item.dosage}</td>
                  <td className="py-2 pr-4 text-sm text-slate-900">{item.frequency}</td>
                  <td className="py-2 pr-4 text-sm text-slate-900">{item.duration}</td>
                  <td className="py-2 pr-4 text-sm text-slate-900">{item.notes}</td>
                </tr>
              ))}
              {!items.length ? (
                <tr>
                  <td colSpan={5} className="py-3 text-sm text-slate-500">
                    No medicines found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
