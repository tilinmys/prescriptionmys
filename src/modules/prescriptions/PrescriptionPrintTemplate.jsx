import mystreeLogo from "../../assets/mystree-logo.svg";

function valueOrDash(value) {
  return value && String(value).trim() ? value : "-";
}

export default function PrescriptionPrintTemplate({
  doctor,
  patient,
  diagnosis,
  advice,
  medicines,
  date,
  rootId = "print-area",
}) {
  const filledMedicines =
    medicines?.filter(
      (item) => item.medicine || item.dosage || item.frequency || item.duration
    ) || [];

  return (
    <div id={rootId} style={{ fontFamily: "Outfit, sans-serif", color: "#0f172a" }}>
      <header className="mb-6 rounded-xl border border-[#BFE2FE] bg-[#FCF4D9]/55 px-5 py-4">
        <div className="flex items-start justify-between gap-6">
          <div>
            <img
              src={mystreeLogo}
              alt="My Stree Logo"
              className="h-auto w-[260px] max-w-full"
            />
          </div>

          <div className="text-right text-sm leading-relaxed text-slate-600">
            <p>#3366, 1st Floor, 13th Main Road, HAL 2nd Stage</p>
            <p>Indiranagar, Bengaluru, 560008</p>
            <p className="text-[#EF6A40]">info@mystree.org | www.my-stree.com</p>
            <p className="text-[#EF6A40]">+91 6366573772</p>
          </div>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[#BFE2FE] bg-white px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#8BA4BF]">Doctor</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{valueOrDash(doctor?.name)}</p>
          <p className="mt-1 text-sm text-slate-600">Reg: {valueOrDash(doctor?.registration)}</p>
        </div>

        <div className="rounded-lg border border-[#BFE2FE] bg-white px-4 py-3 text-right">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#8BA4BF]">Date</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">{valueOrDash(date)}</p>
        </div>
      </section>

      <section className="mb-6">
        <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#8BA4BF]">Patient Details</p>
        <div className="grid grid-cols-3 gap-3 rounded-lg border border-[#BFE2FE] bg-white p-4 text-sm">
          <p>
            <span className="font-semibold text-slate-500">Name:</span> {valueOrDash(patient?.name)}
          </p>
          <p>
            <span className="font-semibold text-slate-500">Age:</span> {valueOrDash(patient?.age)}
          </p>
          <p>
            <span className="font-semibold text-slate-500">Gender:</span> {valueOrDash(patient?.gender)}
          </p>
        </div>
      </section>

      <section className="mb-6">
        <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#8BA4BF]">Diagnosis</p>
        <div className="min-h-14 rounded-lg border border-[#BFE2FE] bg-white px-4 py-3 text-sm whitespace-pre-wrap">
          {valueOrDash(diagnosis)}
        </div>
      </section>

      <section className="mb-6">
        <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#8BA4BF]">Medicines</p>
        <div className="overflow-hidden rounded-lg border border-[#BFE2FE] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#BFE2FE]/45">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Medicine</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Dosage</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Frequency</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Duration</th>
              </tr>
            </thead>
            <tbody>
              {filledMedicines.length ? (
                filledMedicines.map((item, index) => (
                  <tr key={index} className="border-t border-[#BFE2FE] odd:bg-[#FCF4D9]/20">
                    <td className="px-3 py-2">{valueOrDash(item.medicine)}</td>
                    <td className="px-3 py-2">{valueOrDash(item.dosage)}</td>
                    <td className="px-3 py-2">{valueOrDash(item.frequency)}</td>
                    <td className="px-3 py-2">{valueOrDash(item.duration)}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-t border-[#BFE2FE]">
                  <td className="px-3 py-2 text-slate-500" colSpan={4}>
                    No medicines added.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6">
        <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[#8BA4BF]">Advice</p>
        <div className="min-h-16 rounded-lg border border-[#BFE2FE] bg-white px-4 py-3 text-sm whitespace-pre-wrap">
          {valueOrDash(advice)}
        </div>
      </section>

      <footer className="mt-16 border-t border-[#BFE2FE] pt-3 text-xs leading-relaxed text-slate-400">
        Do not self-medicate. This medication is intended for use only as prescribed by your healthcare provider.
        Always consult your doctor before taking any medication, including this one, to ensure it is appropriate
        for your individual needs.
      </footer>
    </div>
  );
}
