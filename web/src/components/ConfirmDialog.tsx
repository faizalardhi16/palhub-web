import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Custom confirm dialog — state-based, works di browser + Tauri WebView
 * (window.confirm() tidak didukung di Tauri → selalu return false).
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Hapus",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onClick={() => !busy && onCancel()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_32px_64px_rgba(15,23,42,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <button
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                onClick={onCancel}
                disabled={busy}
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <h3 className="mt-4 font-display text-xl font-bold tracking-[-0.04em] text-slate-950">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button className="action-secondary !px-5 !py-2.5" onClick={onCancel} disabled={busy}>
                Batal
              </button>
              <button className="action-danger !px-5 !py-2.5" onClick={onConfirm} disabled={busy}>
                {busy ? "Menghapus..." : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
