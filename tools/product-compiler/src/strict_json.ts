import { ProductCompilerError, fail } from "./errors.ts";

export interface StrictJsonOptions {
  readonly sourcePath: string;
  readonly syntaxCode: string;
  readonly duplicateCode: string;
}

const DEFAULT_OPTIONS: StrictJsonOptions = {
  sourcePath: "product.json",
  syntaxCode: "GARAK_PROJECT_JSON_SYNTAX",
  duplicateCode: "GARAK_PROJECT_DUPLICATE_KEY",
};

class DuplicateKeyScanner {
  readonly #text: string;
  readonly #options: StrictJsonOptions;
  #offset = 0;

  constructor(text: string, options: StrictJsonOptions) {
    this.#text = text;
    this.#options = options;
  }

  scan(): void {
    this.#skipWhitespace();
    this.#scanValue(this.#options.sourcePath);
    this.#skipWhitespace();
    if (this.#offset !== this.#text.length) {
      this.#syntaxFailure();
    }
  }

  #scanValue(path: string): void {
    const character = this.#text[this.#offset];
    if (character === "{") {
      this.#scanObject(path);
      return;
    }
    if (character === "[") {
      this.#scanArray(path);
      return;
    }
    if (character === '"') {
      this.#scanString();
      return;
    }
    if (character === "t") {
      this.#consumeLiteral("true");
      return;
    }
    if (character === "f") {
      this.#consumeLiteral("false");
      return;
    }
    if (character === "n") {
      this.#consumeLiteral("null");
      return;
    }
    if (character === "-" || this.#isDigit(character)) {
      this.#scanNumber();
      return;
    }
    this.#syntaxFailure();
  }

  #scanObject(path: string): void {
    this.#offset += 1;
    this.#skipWhitespace();
    if (this.#take("}")) {
      return;
    }

    const keys = new Set<string>();
    for (;;) {
      if (this.#text[this.#offset] !== '"') {
        this.#syntaxFailure();
      }
      const key = this.#scanString();
      const keyPath = this.#appendKey(path, key);
      if (keys.has(key)) {
        fail(
          this.#options.duplicateCode,
          keyPath,
          `Duplicate JSON key '${key}' is not allowed.`,
        );
      }
      keys.add(key);

      this.#skipWhitespace();
      if (!this.#take(":")) {
        this.#syntaxFailure();
      }
      this.#skipWhitespace();
      this.#scanValue(keyPath);
      this.#skipWhitespace();
      if (this.#take("}")) {
        return;
      }
      if (!this.#take(",")) {
        this.#syntaxFailure();
      }
      this.#skipWhitespace();
    }
  }

  #scanArray(path: string): void {
    this.#offset += 1;
    this.#skipWhitespace();
    if (this.#take("]")) {
      return;
    }

    let index = 0;
    for (;;) {
      this.#scanValue(`${path}[${index}]`);
      index += 1;
      this.#skipWhitespace();
      if (this.#take("]")) {
        return;
      }
      if (!this.#take(",")) {
        this.#syntaxFailure();
      }
      this.#skipWhitespace();
    }
  }

  #scanString(): string {
    const start = this.#offset;
    this.#offset += 1;
    for (;;) {
      if (this.#offset >= this.#text.length) {
        this.#syntaxFailure();
      }
      const code = this.#text.charCodeAt(this.#offset);
      if (code === 0x22) {
        this.#offset += 1;
        const token = this.#text.slice(start, this.#offset);
        let parsed: unknown;
        try {
          parsed = JSON.parse(token);
        } catch {
          this.#syntaxFailure();
        }
        if (typeof parsed !== "string") {
          this.#syntaxFailure();
        }
        return parsed;
      }
      if (code < 0x20) {
        this.#syntaxFailure();
      }
      if (code === 0x5c) {
        this.#offset += 1;
        const escaped = this.#text[this.#offset];
        if (escaped === "u") {
          for (let index = 1; index <= 4; index += 1) {
            const hexadecimal = this.#text[this.#offset + index];
            if (hexadecimal === undefined || !/[0-9a-f]/iu.test(hexadecimal)) {
              this.#syntaxFailure();
            }
          }
          this.#offset += 5;
          continue;
        }
        if (escaped === undefined || !/["\\/bfnrt]/u.test(escaped)) {
          this.#syntaxFailure();
        }
      }
      this.#offset += 1;
    }
  }

  #scanNumber(): void {
    if (this.#take("-") && this.#offset >= this.#text.length) {
      this.#syntaxFailure();
    }

    if (this.#take("0")) {
      if (this.#isDigit(this.#text[this.#offset])) {
        this.#syntaxFailure();
      }
    } else {
      const first = this.#text[this.#offset];
      if (first === undefined || first < "1" || first > "9") {
        this.#syntaxFailure();
      }
      this.#offset += 1;
      while (this.#isDigit(this.#text[this.#offset])) {
        this.#offset += 1;
      }
    }

    if (this.#take(".")) {
      if (!this.#isDigit(this.#text[this.#offset])) {
        this.#syntaxFailure();
      }
      while (this.#isDigit(this.#text[this.#offset])) {
        this.#offset += 1;
      }
    }

    const exponent = this.#text[this.#offset];
    if (exponent === "e" || exponent === "E") {
      this.#offset += 1;
      const sign = this.#text[this.#offset];
      if (sign === "+" || sign === "-") {
        this.#offset += 1;
      }
      if (!this.#isDigit(this.#text[this.#offset])) {
        this.#syntaxFailure();
      }
      while (this.#isDigit(this.#text[this.#offset])) {
        this.#offset += 1;
      }
    }
  }

  #consumeLiteral(literal: string): void {
    if (
      this.#text.slice(this.#offset, this.#offset + literal.length) !== literal
    ) {
      this.#syntaxFailure();
    }
    this.#offset += literal.length;
  }

  #skipWhitespace(): void {
    for (;;) {
      const character = this.#text[this.#offset];
      if (
        character !== "\u0009" &&
        character !== "\u000a" &&
        character !== "\u000d" &&
        character !== "\u0020"
      ) {
        return;
      }
      this.#offset += 1;
    }
  }

  #take(character: string): boolean {
    if (this.#text[this.#offset] !== character) {
      return false;
    }
    this.#offset += 1;
    return true;
  }

  #isDigit(character: string | undefined): boolean {
    return character !== undefined && character >= "0" && character <= "9";
  }

  #appendKey(path: string, key: string): string {
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(key)) {
      return `${path}.${key}`;
    }
    return `${path}[${JSON.stringify(key)}]`;
  }

  #syntaxFailure(): never {
    throw new ProductCompilerError(
      this.#options.syntaxCode,
      this.#options.sourcePath,
      "Malformed JSON.",
    );
  }
}

export function parseStrictJson(
  text: string,
  options: StrictJsonOptions = DEFAULT_OPTIONS,
): unknown {
  new DuplicateKeyScanner(text, options).scan();
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch {
    fail(options.syntaxCode, options.sourcePath, "Malformed JSON.");
  }
}
