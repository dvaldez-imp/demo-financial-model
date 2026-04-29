import { describe, expect, it } from "vitest";
import { compileFormulaExpression } from "@/lib/utils/formula-compiler";

describe("compileFormulaExpression", () => {
  it("valida una formula correcta y extrae variables", () => {
    const result = compileFormulaExpression("ingreso_neto + costo_fijo * 1.2", {
      knownVariables: ["ingreso_neto", "costo_fijo"],
    });

    expect(result.isValid).toBe(true);
    expect(result.variables).toEqual(["ingreso_neto", "costo_fijo"]);
    expect(result.unknownVariables).toEqual([]);
  });

  it("reporta errores de sintaxis", () => {
    const result = compileFormulaExpression("ingreso_neto + ");

    expect(result.isValid).toBe(false);
    expect(result.diagnostics.some((item) => item.level === "error")).toBe(
      true,
    );
  });

  it("reporta variables desconocidas como warning", () => {
    const result = compileFormulaExpression("ingreso_neto + externo", {
      knownVariables: ["ingreso_neto"],
    });

    expect(result.isValid).toBe(true);
    expect(result.unknownVariables).toEqual(["externo"]);
    expect(result.diagnostics.some((item) => item.level === "warning")).toBe(
      true,
    );
  });
});
