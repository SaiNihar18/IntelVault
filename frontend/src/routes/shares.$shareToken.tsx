import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText, ShieldCheck, Lock } from "lucide-react";
import { Brand } from "@/components/Brand";
import { usePublicShare } from "@/hooks/api";
import { apiClient } from "@/lib/apiClient";
import { toast } from "sonner";

export const Route = createFileRoute("/shares/$shareToken")({
  component: PublicSharePage,
});

function formatSize(bytes?: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function PublicSharePage() {
  const { shareToken } = Route.useParams();
  const { data, isLoading, isError } = usePublicShare(shareToken);

  async function handleDownload() {
    try {
      // 1. Fetch file as arraybuffer to process decryption
      const res = await apiClient.get(`/shares/${shareToken}/download`, {
        responseType: "arraybuffer",
      });
      const encryptedBuffer = res.data as ArrayBuffer;

      // 2. Parse key from window.location.hash
      const hash = window.location.hash;
      const keyMatch = hash.match(/[#&]key=([^&]+)/);
      const base64Key = keyMatch ? keyMatch[1] : null;

      let finalBlob: Blob;

      if (base64Key) {
        try {
          // 3. Decode base64Key (URL-safe base64)
          const binaryString = atob(
            base64Key.replace(/-/g, "+").replace(/_/g, "/")
          );
          const keyBytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            keyBytes[i] = binaryString.charCodeAt(i);
          }

          // 4. Import Cryptographic Key
          const key = await window.crypto.subtle.importKey(
            "raw",
            keyBytes,
            "AES-GCM",
            true,
            ["decrypt"]
          );

          // 5. Slice IV (first 12 bytes) and ciphertext (rest)
          const iv = new Uint8Array(encryptedBuffer.slice(0, 12));
          const ciphertext = encryptedBuffer.slice(12);

          // 6. Decrypt ciphertext
          const decryptedBuffer = await window.crypto.subtle.decrypt(
            {
              name: "AES-GCM",
              iv: iv,
            },
            key,
            ciphertext
          );

          finalBlob = new Blob([decryptedBuffer], {
            type: data?.document.content_type || "application/octet-stream",
          });
        } catch (decryptErr) {
          console.error("Decryption failed:", decryptErr);
          toast.error("Decryption failed. Check if your share link has the correct key.");
          return;
        }
      } else {
        // Fallback for legacy unencrypted files
        finalBlob = new Blob([encryptedBuffer], {
          type: data?.document.content_type || "application/octet-stream",
        });
      }

      // 7. Trigger browser download
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data?.document.filename ?? "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("Failed to download the shared file.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center iv-grid-bg p-6">
      <div className="w-full max-w-md flex flex-col items-center text-center space-y-6 animate-fade-up">
        <Brand size="lg" />

        <div className="w-full bg-surface border border-border rounded-xl p-8 shadow-lg space-y-6">
          <div className="mx-auto w-16 h-16 rounded-xl border border-brand/40 bg-brand/10 flex items-center justify-center">
            <Lock size={28} className="text-brand" strokeWidth={2.25} />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold tracking-[0.2em] text-brand uppercase">
              Secure Share
            </div>
            <div className="font-mono text-sm break-all">
              {isLoading
                ? "Verifying share…"
                : isError
                  ? "Share unavailable"
                  : data?.document.filename}
            </div>
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <FileText size={14} />
              <span>{data?.document.content_type ?? "Document"}</span>
              <span className="opacity-50">•</span>
              <span>{formatSize(data?.document.file_size_bytes)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownload}
            disabled={isLoading || isError}
            className="w-full bg-brand text-brand-foreground rounded-md py-3 font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-base"
          >
            <Download size={18} />
            Download Securely
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck size={14} />
            End-to-end encrypted
          </div>
        </div>
      </div>
    </div>
  );
}
