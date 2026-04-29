import { describe, expect, it } from "vitest";
import { parsePastedGrid } from "@/lib/utils/paste-grid";

describe("parsePastedGrid", () => {
  it("parses TSV copied from Excel and infers zones", () => {
    const preview = parsePastedGrid(
      "Premisa\tene-25\tabr-25\t2025\nGasolina\t34\t35\t420",
      "2025-03",
      "2025-12",
    );

    expect(preview).not.toBeNull();
    expect(preview?.periods[0]).toMatchObject({
      normalizedLabel: "ene-25",
      zone: "historical",
    });
    expect(preview?.periods[1]).toMatchObject({
      normalizedLabel: "abr-25",
      zone: "forecast",
    });
    expect(preview?.periods[2]).toMatchObject({
      normalizedLabel: "2025",
      zone: "summary",
    });
  });
});
