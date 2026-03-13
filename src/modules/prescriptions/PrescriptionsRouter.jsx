import { Navigate, Route, Routes } from "react-router-dom";
import NutritionForm from "./NutritionForm";
import PrescriptionForm from "./PrescriptionForm";
import PrescriptionsList from "./PrescriptionsList";
import PrescriptionView from "./PrescriptionView";

export function PrescriptionsRouter() {
  return (
    <Routes>
      <Route index element={<PrescriptionsList />} />
      <Route path="new" element={<PrescriptionForm />} />
      <Route path="edit/:id" element={<PrescriptionForm />} />
      <Route path="view/:id" element={<PrescriptionView />} />
      <Route path="nutrition" element={<Navigate to="new" replace />} />
      <Route path="nutrition/new" element={<NutritionForm />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}

export default PrescriptionsRouter;
