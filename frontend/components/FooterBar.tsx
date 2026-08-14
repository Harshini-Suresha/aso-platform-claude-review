import { Info, Trash2, ArrowRight } from "lucide-react";

export default function FooterBar({
  onClear,
  onConfirm,
}: {
  onClear: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 border-t border-[#E5E7EB] bg-white/95 backdrop-blur px-6 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-[11.5px] text-slate-500">
          <Info className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          Please verify the above information before proceeding.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50 transition-all duration-200 hover:border-slate-400 hover:shadow-sm active:translate-y-0"
          >
            <Trash2 className="h-3 w-3" />
            Clear All
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded bg-brand px-4 py-1.5 text-[12px] font-medium text-white hover:bg-brand-dark transition-all duration-200 hover:shadow-md hover:shadow-brand/20 hover:-translate-y-0.5 active:translate-y-0"
          >
            Confirm &amp; Proceed
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
