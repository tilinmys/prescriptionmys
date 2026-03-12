import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import PrescriptionsModule from "./modules/prescriptions/PrescriptionsModule";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/prescriptions/*" element={<PrescriptionsModule />} />
        <Route path="*" element={<Navigate to="/admin/prescriptions" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
