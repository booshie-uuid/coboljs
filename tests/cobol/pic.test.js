import { suite, test, expect } from "../runner.js";
import * as Pic from "../../scripts/modules/cobol/pic.js";


suite("parsePic", () =>
{
    suite("happy paths", () =>
    {
        test("X(20) → alphanumeric, length 20", () =>
        {
            expect(Pic.parsePic("X(20)")).toEqual({ kind: "alphanumeric", length: 20, decimalLength: 0, signed: false });
        });

        test("XXX → alphanumeric, length 3", () =>
        {
            expect(Pic.parsePic("XXX")).toEqual({ kind: "alphanumeric", length: 3, decimalLength: 0, signed: false });
        });

        test("9(5) → numeric, length 5", () =>
        {
            expect(Pic.parsePic("9(5)")).toEqual({ kind: "numeric", length: 5, decimalLength: 0, signed: false });
        });

        test("99999 → numeric, length 5", () =>
        {
            expect(Pic.parsePic("99999")).toEqual({ kind: "numeric", length: 5, decimalLength: 0, signed: false });
        });

        test("S9(5) → signed numeric", () =>
        {
            expect(Pic.parsePic("S9(5)")).toEqual({ kind: "numeric", length: 5, decimalLength: 0, signed: true });
        });

        test("9(5)V99 → 5 integer + 2 decimal", () =>
        {
            expect(Pic.parsePic("9(5)V99")).toEqual({ kind: "numeric", length: 5, decimalLength: 2, signed: false });
        });

        test("9(3)V9(2) → 3 integer + 2 decimal", () =>
        {
            expect(Pic.parsePic("9(3)V9(2)")).toEqual({ kind: "numeric", length: 3, decimalLength: 2, signed: false });
        });

        test("S9(3)V99 → signed with decimal", () =>
        {
            expect(Pic.parsePic("S9(3)V99")).toEqual({ kind: "numeric", length: 3, decimalLength: 2, signed: true });
        });

        test("A(10) → alphabetic", () =>
        {
            expect(Pic.parsePic("A(10)")).toEqual({ kind: "alphabetic", length: 10, decimalLength: 0, signed: false });
        });

        test("lowercase pic is normalised", () =>
        {
            expect(Pic.parsePic("x(5)").kind).toBe("alphanumeric");
        });
    });

    suite("errors", () =>
    {
        test("empty PIC throws", () =>
        {
            expect(() => Pic.parsePic("")).toThrow("empty PIC");
        });

        test("mixed kinds throws", () =>
        {
            expect(() => Pic.parsePic("X9")).toThrow("mixes types");
        });

        test("unclosed paren throws", () =>
        {
            expect(() => Pic.parsePic("X(20")).toThrow("unclosed paren");
        });

        test("invalid repeat count throws", () =>
        {
            expect(() => Pic.parsePic("X(abc)")).toThrow("invalid repeat");
        });

        test("zero repeat throws", () =>
        {
            expect(() => Pic.parsePic("X(0)")).toThrow("invalid repeat");
        });

        test("S without digits throws", () =>
        {
            expect(() => Pic.parsePic("SX(5)")).toThrow("S is only valid in numeric");
        });

        test("V outside numeric throws", () =>
        {
            expect(() => Pic.parsePic("X(5)V99")).toThrow("V is only valid in numeric");
        });

        test("garbage characters throw", () =>
        {
            expect(() => Pic.parsePic("Z(5)")).toThrow("unexpected character");
        });
    });

    suite("error line context", () =>
    {
        test("line is attached to the thrown error", () =>
        {
            try
            {
                Pic.parsePic("Z(5)", 42);
                throw new Error("should have thrown");
            }
            catch(error)
            {
                expect(error.line).toBe(42);
            }
        });
    });
});
