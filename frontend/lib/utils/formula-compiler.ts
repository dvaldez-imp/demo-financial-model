export type FormulaTokenType =
  | "number"
  | "variable"
  | "operator"
  | "paren"
  | "whitespace"
  | "invalid";

export type FormulaToken = {
  type: FormulaTokenType;
  value: string;
  start: number;
  end: number;
};

export type FormulaDiagnostic = {
  level: "error" | "warning";
  message: string;
  start?: number;
  end?: number;
};

export type FormulaCompileResult = {
  tokens: FormulaToken[];
  diagnostics: FormulaDiagnostic[];
  variables: string[];
  knownVariables: string[];
  unknownVariables: string[];
  isValid: boolean;
};

type CompileOptions = {
  knownVariables?: string[];
};

const OPERATORS = new Set(["+", "-", "*", "/"]);

export function compileFormulaExpression(
  expression: string,
  options: CompileOptions = {},
): FormulaCompileResult {
  const tokens: FormulaToken[] = [];
  const diagnostics: FormulaDiagnostic[] = [];
  const variablesByOrder = new Set<string>();
  const knownVariablesSet = new Set(options.knownVariables || []);

  let cursor = 0;

  while (cursor < expression.length) {
    const char = expression[cursor];

    if (/\s/.test(char)) {
      const start = cursor;
      while (cursor < expression.length && /\s/.test(expression[cursor])) {
        cursor += 1;
      }
      tokens.push({
        type: "whitespace",
        value: expression.slice(start, cursor),
        start,
        end: cursor,
      });
      continue;
    }

    if (OPERATORS.has(char)) {
      tokens.push({
        type: "operator",
        value: char,
        start: cursor,
        end: cursor + 1,
      });
      cursor += 1;
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({
        type: "paren",
        value: char,
        start: cursor,
        end: cursor + 1,
      });
      cursor += 1;
      continue;
    }

    if (
      /\d/.test(char) ||
      (char === "." && /\d/.test(expression[cursor + 1] || ""))
    ) {
      const start = cursor;
      let hasDot = false;

      while (cursor < expression.length) {
        const current = expression[cursor];
        if (current === ".") {
          if (hasDot) {
            break;
          }
          hasDot = true;
          cursor += 1;
          continue;
        }

        if (!/\d/.test(current)) {
          break;
        }

        cursor += 1;
      }

      tokens.push({
        type: "number",
        value: expression.slice(start, cursor),
        start,
        end: cursor,
      });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = cursor;
      cursor += 1;
      while (
        cursor < expression.length &&
        /[A-Za-z0-9_]/.test(expression[cursor])
      ) {
        cursor += 1;
      }

      const variable = expression.slice(start, cursor);
      variablesByOrder.add(variable);
      tokens.push({
        type: "variable",
        value: variable,
        start,
        end: cursor,
      });
      continue;
    }

    diagnostics.push({
      level: "error",
      message: `Caracter invalido '${char}'.`,
      start: cursor,
      end: cursor + 1,
    });
    tokens.push({
      type: "invalid",
      value: char,
      start: cursor,
      end: cursor + 1,
    });
    cursor += 1;
  }

  const significantTokens = tokens.filter(
    (token) => token.type !== "whitespace",
  );
  const parenStack: FormulaToken[] = [];
  let expectOperand = true;

  significantTokens.forEach((token) => {
    if (token.type === "invalid") {
      return;
    }

    if (expectOperand) {
      if (token.type === "number" || token.type === "variable") {
        expectOperand = false;
        return;
      }

      if (token.type === "paren" && token.value === "(") {
        parenStack.push(token);
        return;
      }

      diagnostics.push({
        level: "error",
        message: "Se esperaba un numero, variable o parentesis de apertura.",
        start: token.start,
        end: token.end,
      });
      return;
    }

    if (token.type === "operator") {
      expectOperand = true;
      return;
    }

    if (token.type === "paren" && token.value === ")") {
      if (parenStack.length === 0) {
        diagnostics.push({
          level: "error",
          message: "Parentesis de cierre sin apertura.",
          start: token.start,
          end: token.end,
        });
        return;
      }

      parenStack.pop();
      return;
    }

    diagnostics.push({
      level: "error",
      message: "Se esperaba un operador o parentesis de cierre.",
      start: token.start,
      end: token.end,
    });
  });

  if (expectOperand && significantTokens.length > 0) {
    diagnostics.push({
      level: "error",
      message: "La formula no puede terminar en operador.",
    });
  }

  if (parenStack.length > 0) {
    diagnostics.push({
      level: "error",
      message: "Falta parentesis de cierre.",
      start: parenStack[parenStack.length - 1].start,
      end: parenStack[parenStack.length - 1].end,
    });
  }

  const variables = Array.from(variablesByOrder);
  const unknownVariables = variables.filter(
    (variable) =>
      knownVariablesSet.size > 0 && !knownVariablesSet.has(variable),
  );

  if (unknownVariables.length > 0) {
    diagnostics.push({
      level: "warning",
      message: `Variables no encontradas en el modelo: ${unknownVariables.join(", ")}.`,
    });
  }

  return {
    tokens,
    diagnostics,
    variables,
    knownVariables: Array.from(knownVariablesSet),
    unknownVariables,
    isValid: diagnostics.every((diagnostic) => diagnostic.level !== "error"),
  };
}
