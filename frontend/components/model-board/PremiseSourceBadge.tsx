import { Badge } from "@/components/ui/Badge";
import type { PremiseSource } from "@/lib/types/api";

type PremiseSourceBadgeProps = {
  source: PremiseSource;
  label: string;
};

export default function PremiseSourceBadge({
  label,
  source,
}: PremiseSourceBadgeProps) {
  const tone =
    source === "library"
      ? "accent"
      : source === "model_output"
        ? "warning"
        : "neutral";

  return <Badge tone={tone}>{label}</Badge>;
}
