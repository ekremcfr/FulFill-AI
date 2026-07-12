import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import {
  generateAndDownloadReport,
  type ExportFormat,
  type ExportSections,
} from "@/lib/export-report";

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

const SECTIONS: Array<{ key: keyof ExportSections; label: string; desc: string }> = [
  { key: "executiveSummary",       label: "Executive Summary",         desc: "AI-written narrative of the optimization pass." },
  { key: "kpis",                   label: "Optimization KPIs",         desc: "Pick rate, travel, accuracy, labor cost." },
  { key: "aiRecommendations",      label: "AI Recommendations",        desc: "Prioritized insights with business impact." },
  { key: "slottingRecommendations",label: "Slotting Recommendations",  desc: "SKU-level from → to moves and savings." },
  { key: "pickingRoute",           label: "Picking Route",             desc: "Waypoint tour with distance stats." },
];

const FORMATS: Array<{ id: ExportFormat; label: string; ext: string; desc: string; icon: string }> = [
  { id: "pdf",  label: "PDF",         ext: ".pdf",  desc: "Branded executive report",   icon: "PDF"  },
  { id: "csv",  label: "CSV",         ext: ".csv",  desc: "Structured data for BI",     icon: "CSV"  },
  { id: "pptx", label: "PowerPoint",  ext: ".pptx", desc: "Investor-ready deck",        icon: "PPT"  },
];

export function ExportModal({ open, onClose }: ExportModalProps) {
  const [sections, setSections] = useState<ExportSections>({
    executiveSummary: true,
    kpis: true,
    aiRecommendations: true,
    slottingRecommendations: true,
    pickingRoute: true,
  });
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [busy, setBusy] = useState(false);

  // Escape key + body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  const toggle = (k: keyof ExportSections) =>
    setSections((s) => ({ ...s, [k]: !s[k] }));

  const anySelected = Object.values(sections).some(Boolean);

  const submit = async () => {
    if (!anySelected || busy) return;
    setBusy(true);
    const t = toast.loading("Generating your report…", {
      description: "FulfillAI is assembling the document.",
    });
    try {
      const filename = await generateAndDownloadReport(format, sections);
      toast.success("Export completed successfully.", {
        id: t,
        description: `${filename} downloaded to your device.`,
      });
      onClose();
    } catch (err) {
      console.error("[export] failed", err);
      toast.error("Export failed", {
        id: t,
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const node = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      onClick={busy ? undefined : onClose}
    >

      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-white shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative overflow-hidden bg-[#183B6B] px-6 py-5 text-white">
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-emerald-500" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#CADCFC]">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 font-bold text-white">
                  F
                </span>
                FulfillAI · Decision Intelligence
              </div>
              <h2 className="mt-1.5 text-xl font-semibold leading-tight">
                Export Warehouse Optimization Report
              </h2>
              <p className="mt-1 text-[12px] text-[#CADCFC]">
                Reno DC-04 · pick your sections and format.
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="rounded-md p-1 text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Sections to include
              </h3>
              <button
                onClick={() =>
                  setSections({
                    executiveSummary: true,
                    kpis: true,
                    aiRecommendations: true,
                    slottingRecommendations: true,
                    pickingRoute: true,
                  })
                }
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Select all
              </button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {SECTIONS.map((s) => {
                const checked = sections[s.key];
                return (
                  <label
                    key={s.key}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition ${
                      checked
                        ? "border-emerald-400/60 bg-emerald-50/50"
                        : "border-border bg-surface-muted/30 hover:bg-surface-muted/60"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(s.key)}
                      className="mt-0.5 h-4 w-4 accent-emerald-600"
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-foreground">{s.label}</div>
                      <div className="text-[11px] leading-snug text-muted-foreground">{s.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Format
            </h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {FORMATS.map((f) => {
                const active = format === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition ${
                      active
                        ? "border-primary/70 bg-primary/[0.05] ring-2 ring-primary/20"
                        : "border-border bg-surface-muted/30 hover:bg-surface-muted/60"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold ${
                        active
                          ? "bg-[#183B6B] text-white"
                          : "bg-white text-foreground/70 ring-1 ring-border"
                      }`}
                    >
                      {f.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-foreground">{f.label}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{f.ext}</span>
                      </div>
                      <div className="text-[11px] leading-snug text-muted-foreground">{f.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-muted/40 px-6 py-4">
          <div className="text-[11px] text-muted-foreground">
            Report will download automatically once generated.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-border bg-white px-3 py-2 text-[12px] font-medium text-foreground/80 transition hover:bg-surface-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!anySelected || busy}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-[12px] font-semibold text-white shadow-[0_6px_20px_-6px_rgba(16,185,129,0.6)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Generating…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 3v13m0 0l-5-5m5 5l5-5M4 21h16" />
                  </svg>
                  Generate & download
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
