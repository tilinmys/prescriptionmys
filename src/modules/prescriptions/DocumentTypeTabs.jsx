import { NavLink } from "react-router-dom";

const tabs = [
  {
    label: "Prescription",
    to: "/admin/prescriptions/new",
    match: (pathname) => !pathname.includes("/nutrition"),
  },
  {
    label: "Nutrition",
    to: "/admin/prescriptions/nutrition/new",
    match: (pathname) => pathname.includes("/nutrition"),
  },
];

export default function DocumentTypeTabs({ pathname, className = "" }) {
  return (
    <div className={`grid grid-cols-2 gap-2 rounded-2xl border border-[#8BA4BF]/35 bg-white/80 p-1 ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.match(pathname);
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={`rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition ${
              isActive
                ? "bg-[#ED5B2D] text-white shadow-sm"
                : "text-slate-700 hover:bg-[#BFE2FE]/35"
            }`}
          >
            {tab.label}
          </NavLink>
        );
      })}
    </div>
  );
}
