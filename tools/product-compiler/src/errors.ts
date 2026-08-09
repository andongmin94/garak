export interface Diagnostic {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export class ProductCompilerError extends Error {
  readonly diagnostic: Diagnostic;

  constructor(code: string, path: string, message: string) {
    super(message);
    this.name = "ProductCompilerError";
    this.diagnostic = { code, path, message };
  }
}

export function fail(code: string, path: string, message: string): never {
  throw new ProductCompilerError(code, path, message);
}

export function diagnosticFor(error: unknown): Diagnostic {
  if (error instanceof ProductCompilerError) {
    return error.diagnostic;
  }

  if (error instanceof Error && error.message.length > 0) {
    return {
      code: "GARAK_INTERNAL_ERROR",
      path: "product-compiler",
      message: error.message,
    };
  }

  return {
    code: "GARAK_INTERNAL_ERROR",
    path: "product-compiler",
    message: "The product compiler failed unexpectedly.",
  };
}
