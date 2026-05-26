import { motion } from "framer-motion";
import { Shield } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Shield className="h-10 w-10 text-primary" />
        </motion.div>
        <p className="text-sm text-muted-foreground">Loading IntelVault…</p>
      </motion.div>
    </div>
  );
}
