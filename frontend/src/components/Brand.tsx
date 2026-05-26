import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({
  className,
  size = "md",
  showSubtitle = false,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  showSubtitle?: boolean;
}) {
  const sizes = {
    sm: { icon: 18, text: "text-base" },
    md: { icon: 22, text: "text-xl" },
    lg: { icon: 28, text: "text-2xl" },
  } as const;
  const s = sizes[size];

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-2">
        <ShieldCheck className="text-brand" size={s.icon} strokeWidth={2.25} />
        <span className={cn("font-semibold tracking-tight text-brand", s.text)}>
          IntelVault
        </span>
      </div>
      {showSubtitle && (
        <span className="mt-1 text-xs text-muted-foreground pl-7">
          Workspace Switcher
        </span>
      )}
    </div>
  );
}
