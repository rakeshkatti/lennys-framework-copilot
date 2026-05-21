type Token =
  | { type: "path"; path: string[] }
  | { type: "op"; op: ">" | "<" | ">=" | "<=" | "==" | "!=" }
  | { type: "and" }
  | { type: "or" }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "bool"; value: boolean };

type Node =
  | { kind: "or"; left: Node; right: Node }
  | { kind: "and"; left: Node; right: Node }
  | {
      kind: "cmp";
      op: ">" | "<" | ">=" | "<=" | "==" | "!=";
      left: Node;
      right: Node;
    }
  | { kind: "path"; path: string[] }
  | { kind: "literal"; value: number | string | boolean };

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "(") {
      tokens.push({ type: "lparen" });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ type: "rparen" });
      i++;
      continue;
    }
    if (input.startsWith(">=", i)) {
      tokens.push({ type: "op", op: ">=" });
      i += 2;
      continue;
    }
    if (input.startsWith("<=", i)) {
      tokens.push({ type: "op", op: "<=" });
      i += 2;
      continue;
    }
    if (input.startsWith("==", i)) {
      tokens.push({ type: "op", op: "==" });
      i += 2;
      continue;
    }
    if (input.startsWith("!=", i)) {
      tokens.push({ type: "op", op: "!=" });
      i += 2;
      continue;
    }
    if (c === ">") {
      tokens.push({ type: "op", op: ">" });
      i++;
      continue;
    }
    if (c === "<") {
      tokens.push({ type: "op", op: "<" });
      i++;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      while (j < input.length && input[j] !== '"') j++;
      if (j >= input.length) throw new Error("unterminated string literal");
      tokens.push({ type: "string", value: input.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    const numMatch = input.slice(i).match(/^-?\d+(\.\d+)?/);
    if (numMatch && (/[\d-]/.test(c) || c === ".")) {
      tokens.push({ type: "number", value: parseFloat(numMatch[0]) });
      i += numMatch[0].length;
      continue;
    }
    const wordMatch = input.slice(i).match(/^[a-zA-Z_][a-zA-Z0-9_.\-]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      if (word === "and") tokens.push({ type: "and" });
      else if (word === "or") tokens.push({ type: "or" });
      else if (word === "true") tokens.push({ type: "bool", value: true });
      else if (word === "false") tokens.push({ type: "bool", value: false });
      else tokens.push({ type: "path", path: word.split(".") });
      i += word.length;
      continue;
    }
    throw new Error(`Unexpected character at position ${i}: '${c}'`);
  }
  return tokens;
}

export function parse(tokens: Token[]): Node {
  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  function parseOr(): Node {
    let left = parseAnd();
    while (peek()?.type === "or") {
      consume();
      const right = parseAnd();
      left = { kind: "or", left, right };
    }
    return left;
  }

  function parseAnd(): Node {
    let left = parseCmp();
    while (peek()?.type === "and") {
      consume();
      const right = parseCmp();
      left = { kind: "and", left, right };
    }
    return left;
  }

  function parseCmp(): Node {
    if (peek()?.type === "lparen") {
      consume();
      const inner = parseOr();
      const close = consume();
      if (!close || close.type !== "rparen") {
        throw new Error("expected ')'");
      }
      return inner;
    }
    const left = parsePrimary();
    const op = consume();
    if (!op || op.type !== "op") {
      throw new Error(
        `expected comparison operator, got ${op ? JSON.stringify(op) : "end of input"}`,
      );
    }
    const right = parsePrimary();
    return { kind: "cmp", op: op.op, left, right };
  }

  function parsePrimary(): Node {
    const t = consume();
    if (!t) throw new Error("unexpected end of input");
    if (t.type === "path") return { kind: "path", path: t.path };
    if (t.type === "number") return { kind: "literal", value: t.value };
    if (t.type === "string") return { kind: "literal", value: t.value };
    if (t.type === "bool") return { kind: "literal", value: t.value };
    throw new Error(`expected primary, got ${JSON.stringify(t)}`);
  }

  const root = parseOr();
  if (pos !== tokens.length) {
    throw new Error(`trailing tokens starting at position ${pos}`);
  }
  return root;
}

export interface EvalContext {
  inputs: Record<string, unknown>;
  benchmarks?: Record<string, unknown>;
}

function resolvePath(path: string[], ctx: EvalContext): unknown {
  if (path.length < 2) {
    throw new Error(`path too short: ${path.join(".")}`);
  }
  const root = path[0];
  if (root === "inputs") {
    if (path.length < 3) {
      throw new Error(
        `inputs path must be inputs.<stepId>.<field>: ${path.join(".")}`,
      );
    }
    const stepId = path[1];
    const stepInput = ctx.inputs[stepId];
    if (stepInput === undefined || stepInput === null) return undefined;
    let cur: unknown = stepInput;
    for (let i = 2; i < path.length; i++) {
      if (cur === null || typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[path[i]];
    }
    return cur;
  }
  if (root === "benchmarks") {
    if (!ctx.benchmarks) return undefined;
    let cur: unknown = ctx.benchmarks;
    for (let i = 1; i < path.length; i++) {
      if (cur === null || typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[path[i]];
    }
    return cur;
  }
  throw new Error(
    `branching paths must start with 'inputs.' or 'benchmarks.': got ${path.join(".")}`,
  );
}

function evalNode(node: Node, ctx: EvalContext): unknown {
  switch (node.kind) {
    case "literal":
      return node.value;
    case "path":
      return resolvePath(node.path, ctx);
    case "and":
      return Boolean(evalNode(node.left, ctx)) && Boolean(evalNode(node.right, ctx));
    case "or":
      return Boolean(evalNode(node.left, ctx)) || Boolean(evalNode(node.right, ctx));
    case "cmp": {
      const l = evalNode(node.left, ctx);
      const r = evalNode(node.right, ctx);
      switch (node.op) {
        case ">":
          return (l as number) > (r as number);
        case "<":
          return (l as number) < (r as number);
        case ">=":
          return (l as number) >= (r as number);
        case "<=":
          return (l as number) <= (r as number);
        case "==":
          return l === r;
        case "!=":
          return l !== r;
      }
    }
  }
}

export function evalBranch(expr: string, ctx: EvalContext): boolean {
  const node = parse(tokenize(expr));
  return Boolean(evalNode(node, ctx));
}
