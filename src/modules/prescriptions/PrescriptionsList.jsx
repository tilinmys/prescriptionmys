import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatStatus(value) {
  const raw = String(value || "draft").trim();
  return raw.replace(/_/g, " ");
}

export default function PrescriptionsList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadRows() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const { data: prescriptionRows, error: prescriptionError } = await supabase
          .from("prescriptions")
          .select("id,doctor_id,patient_id,status,created_at")
          .order("created_at", { ascending: false })
          .limit(200);
        if (prescriptionError) throw prescriptionError;

        const doctorIds = [...new Set((prescriptionRows || []).map((row) => row.doctor_id).filter(Boolean))];
        const patientIds = [...new Set((prescriptionRows || []).map((row) => row.patient_id).filter(Boolean))];

        const [doctorResult, patientResult] = await Promise.all([
          doctorIds.length
            ? supabase.from("doctors").select("id,name").in("id", doctorIds)
            : Promise.resolve({ data: [], error: null }),
          patientIds.length
            ? supabase.from("patients").select("id,name").in("id", patientIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (doctorResult.error) throw doctorResult.error;
        if (patientResult.error) throw patientResult.error;

        const doctorMap = new Map((doctorResult.data || []).map((item) => [item.id, item.name]));
        const patientMap = new Map((patientResult.data || []).map((item) => [item.id, item.name]));

        const mergedRows = (prescriptionRows || []).map((row) => ({
          ...row,
          doctor_name: doctorMap.get(row.doctor_id) || "-",
          patient_name: patientMap.get(row.patient_id) || "-",
        }));

        setRows(mergedRows);
      } catch (error) {
        setErrorMessage(String(error?.message || "Failed to load prescriptions."));
      } finally {
        setIsLoading(false);
      }
    }

    void loadRows();
  }, []);

  const emptyMessage = useMemo(() => {
    if (isLoading) return "Loading prescriptions...";
    if (errorMessage) return errorMessage;
    return "No prescriptions found.";
  }, [isLoading, errorMessage]);

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Prescriptions</h2>
        <button
          type="button"
          onClick={() => navigate("new")}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          Create Prescription
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="table-auto w-full">
          <thead>
            <tr className="text-left border-b">
              <th className="py-3 pr-4">Patient</th>
              <th className="py-3 pr-4">Doctor</th>
              <th className="py-3 pr-4">Date</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="py-3 pr-4">{row.patient_name}</td>
                <td className="py-3 pr-4">{row.doctor_name}</td>
                <td className="py-3 pr-4">{formatDate(row.created_at)}</td>
                <td className="py-3 pr-4">
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold capitalize text-slate-700">
                    {formatStatus(row.status)}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`view/${row.id}`)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`edit/${row.id}`)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="py-6 text-sm text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
