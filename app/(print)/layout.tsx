import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rapport — PMO Transformation",
};

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0.8cm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
        body { margin: 0; padding: 0; background: white !important; font-family: system-ui, -apple-system, sans-serif; }
      `}</style>
      {children}
    </>
  );
}
