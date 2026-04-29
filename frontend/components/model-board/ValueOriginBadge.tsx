import { Badge } from "@/components/ui/Badge";
import type { ValueOrigin } from "@/lib/types/api";

type ValueOriginBadgeProps = {
  origin: ValueOrigin;
  label: string;
};

export default function ValueOriginBadge({
  label,
  origin,
}: ValueOriginBadgeProps) {
  const tone =
    origin === "actual"
      ? "neutral"
      : origin === "forecast_generated"
        ? "accent"
        : origin === "forecast_manual"
          ? "success"
          : "warning";

  return <Badge tone={tone}>{label}</Badge>;
}
