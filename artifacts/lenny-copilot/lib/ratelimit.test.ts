import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  consume,
  extractIp,
  extractIpFromHeaders,
  _resetForTests,
  _setClockForTests,
} from "./ratelimit";

beforeEach(() => {
  _resetForTests();
});

afterEach(() => {
  _setClockForTests(() => new Date());
});

describe("consume — per-IP limit (default 5/day)", () => {
  it("allows the first 5 calls from a single IP", () => {
    for (let i = 0; i < 5; i++) {
      const r = consume("1.2.3.4");
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(4 - i);
    }
  });

  it("blocks the 6th call from the same IP with reason='per_ip'", () => {
    for (let i = 0; i < 5; i++) consume("1.2.3.4");
    const r = consume("1.2.3.4");
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("per_ip");
    expect(r.remaining).toBe(0);
  });

  it("counts each IP independently", () => {
    for (let i = 0; i < 5; i++) consume("1.2.3.4");
    expect(consume("1.2.3.4").allowed).toBe(false);
    // Different IP starts fresh.
    expect(consume("9.9.9.9").allowed).toBe(true);
  });

  it("returns a resetAt timestamp that is midnight UTC of the next day", () => {
    _setClockForTests(() => new Date("2026-06-08T12:34:56Z"));
    const r = consume("1.2.3.4");
    expect(r.resetAt).toBe("2026-06-09T00:00:00.000Z");
  });
});

describe("consume — day rollover", () => {
  it("resets the per-IP counter when the UTC day changes", () => {
    _setClockForTests(() => new Date("2026-06-08T23:50:00Z"));
    for (let i = 0; i < 5; i++) consume("1.2.3.4");
    expect(consume("1.2.3.4").allowed).toBe(false);

    // Cross midnight UTC.
    _setClockForTests(() => new Date("2026-06-09T00:01:00Z"));
    const after = consume("1.2.3.4");
    expect(after.allowed).toBe(true);
    expect(after.remaining).toBe(4);
  });
});

describe("consume — global cap (default 50/day) protects total spend", () => {
  it("blocks any IP once the global cap is reached", () => {
    // Use 50 distinct IPs to exhaust the global counter without tripping
    // per-IP caps. Each IP gets exactly 1 call, total = 50.
    for (let i = 0; i < 50; i++) {
      const ip = `10.0.0.${i}`;
      expect(consume(ip).allowed).toBe(true);
    }
    // 51st call from a fresh IP — global cap should refuse.
    const r = consume("10.0.0.99");
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("global");
  });
});

describe("extractIp / extractIpFromHeaders", () => {
  it("takes the leftmost value from x-forwarded-for", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "203.0.113.5, 198.51.100.10, 10.0.0.1" },
    });
    expect(extractIp(req)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-real-ip": "203.0.113.5" },
    });
    expect(extractIp(req)).toBe("203.0.113.5");
  });

  it("returns 'unknown' when no proxy headers are present", () => {
    const req = new Request("http://localhost/");
    expect(extractIp(req)).toBe("unknown");
  });

  it("works on a Headers instance for server components", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.5" });
    expect(extractIpFromHeaders(h)).toBe("203.0.113.5");
  });
});
