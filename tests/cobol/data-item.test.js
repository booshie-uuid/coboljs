import { suite, test, expect } from "../runner.js";
import { DataItem } from "../../scripts/modules/cobol/data-item.js";


function elem(picString, initialValue)
{
    return new DataItem({ level: 1, name: "TEST", picString, initialValue });
}


suite("DataItem", () =>
{
    suite("alphanumeric assign", () =>
    {
        test("exact length", () =>
        {
            const d = elem("X(5)", "HELLO");

            expect(d.getDisplay()).toBe("HELLO");
        });

        test("shorter pads right with spaces", () =>
        {
            const d = elem("X(5)", "HI");

            expect(d.getDisplay()).toBe("HI   ");
        });

        test("longer truncates right", () =>
        {
            const d = elem("X(3)", "HELLO");

            expect(d.getDisplay()).toBe("HEL");
        });

        test("default value is all spaces", () =>
        {
            const d = elem("X(5)");

            expect(d.getDisplay()).toBe("     ");
        });

        test("non-string value coerces", () =>
        {
            const d = elem("X(5)");

            d.assign(123);
            expect(d.getDisplay()).toBe("123  ");
        });
    });

    suite("numeric assign + display", () =>
    {
        test("integer in 9(5)", () =>
        {
            const d = elem("9(5)", 123);

            expect(d.getDisplay()).toBe("00123");
            expect(d.getNumeric()).toBe(123);
        });

        test("default zero", () =>
        {
            const d = elem("9(5)");

            expect(d.getDisplay()).toBe("00000");
        });

        test("decimal scaled in 9(3)V99", () =>
        {
            const d = elem("9(3)V99", 12.5);

            expect(d.getDisplay()).toBe("012.50");
            expect(d.getNumeric()).toBe(12.5);
        });

        test("excess decimal digits truncate", () =>
        {
            const d = elem("9(3)V99", 12.567);

            expect(d.getDisplay()).toBe("012.56");
        });

        test("integer overflow truncates high digits", () =>
        {
            const d = elem("9(3)", 12345);

            expect(d.getDisplay()).toBe("345");
        });

        test("string value parses", () =>
        {
            const d = elem("9(5)", "42");

            expect(d.getNumeric()).toBe(42);
        });

        test("non-numeric string becomes 0", () =>
        {
            const d = elem("9(5)", "abc");

            expect(d.getNumeric()).toBe(0);
        });

        test("unsigned PIC drops negative sign", () =>
        {
            const d = elem("9(5)", -42);

            expect(d.getNumeric()).toBe(42);
            expect(d.getDisplay()).toBe("00042");
        });
    });

    suite("signed numeric", () =>
    {
        test("S9(5) keeps positive", () =>
        {
            const d = elem("S9(5)", 42);

            expect(d.getDisplay()).toBe("00042");
        });

        test("S9(5) keeps negative with - prefix", () =>
        {
            const d = elem("S9(5)", -42);

            expect(d.getNumeric()).toBe(-42);
            expect(d.getDisplay()).toBe("-00042");
        });

        test("S9(3)V99 signed decimal", () =>
        {
            const d = elem("S9(3)V99", -12.5);

            expect(d.getDisplay()).toBe("-012.50");
        });

        test("negative zero displays without sign", () =>
        {
            const d = elem("S9(5)", -0);

            expect(d.getDisplay()).toBe("00000");
        });
    });

    suite("group items", () =>
    {
        test("group has no PIC and no value", () =>
        {
            const group = new DataItem({ level: 1, name: "PERSON" });

            expect(group.isGroup()).toBe(true);
            expect(group.isElementary()).toBe(false);
            expect(group.value).toBe(undefined);
        });

        test("children added via constructor parent param", () =>
        {
            const group = new DataItem({ level: 1, name: "G" });
            const a = new DataItem({ level: 5, name: "A", parent: group, picString: "X(3)", initialValue: "ABC" });
            const b = new DataItem({ level: 5, name: "B", parent: group, picString: "X(3)", initialValue: "XYZ" });

            expect(group.children.length).toBe(2);
            expect(group.children[0]).toBe(a);
            expect(group.children[1]).toBe(b);
        });

        test("group display concatenates children", () =>
        {
            const group = new DataItem({ level: 1, name: "G" });
            new DataItem({ level: 5, name: "A", parent: group, picString: "X(3)", initialValue: "ABC" });
            new DataItem({ level: 5, name: "B", parent: group, picString: "X(3)", initialValue: "XYZ" });

            expect(group.getDisplay()).toBe("ABCXYZ");
        });

        test("group display includes padding from elementary children", () =>
        {
            const group = new DataItem({ level: 1, name: "GREETING" });
            new DataItem({ level: 5, name: "PREFIX", parent: group, picString: "X(7)", initialValue: "HELLO, " });
            new DataItem({ level: 5, name: "NAME",   parent: group, picString: "X(5)", initialValue: "ALICE" });

            expect(group.getDisplay()).toBe("HELLO, ALICE");
        });

        test("nested groups", () =>
        {
            const root = new DataItem({ level: 1, name: "ROOT" });
            const inner = new DataItem({ level: 5, name: "INNER", parent: root });
            new DataItem({ level: 10, name: "X", parent: inner, picString: "X(2)", initialValue: "AB" });
            new DataItem({ level: 10, name: "Y", parent: inner, picString: "X(2)", initialValue: "CD" });

            expect(root.getDisplay()).toBe("ABCD");
            expect(inner.children.length).toBe(2);
        });

        test("assigning to group throws", () =>
        {
            const group = new DataItem({ level: 1, name: "G" });

            expect(() => group.assign("anything")).toThrow("cannot assign to group");
        });

        test("getNumeric on group throws", () =>
        {
            const group = new DataItem({ level: 1, name: "G" });

            expect(() => group.getNumeric()).toThrow("cannot read numeric from group");
        });

        test("nesting under elementary item throws", () =>
        {
            const elementary = elem("X(5)");

            expect(() =>
            {
                new DataItem({ level: 5, name: "BAD", parent: elementary, picString: "X(2)" });
            }).toThrow("cannot nest");
        });
    });

    suite("re-assignment", () =>
    {
        test("alpha can be re-assigned", () =>
        {
            const d = elem("X(5)", "HELLO");

            d.assign("HI");
            expect(d.getDisplay()).toBe("HI   ");

            d.assign("WORLD!!");
            expect(d.getDisplay()).toBe("WORLD");
        });

        test("numeric can be re-assigned", () =>
        {
            const d = elem("9(5)", 100);

            d.assign(42);
            expect(d.getNumeric()).toBe(42);
        });
    });

    suite("getNumeric coercion from alpha", () =>
    {
        test("numeric string parses", () =>
        {
            const d = elem("X(5)", "12345");

            expect(d.getNumeric()).toBe(12345);
        });

        test("non-numeric string returns 0", () =>
        {
            const d = elem("X(5)", "ABCDE");

            expect(d.getNumeric()).toBe(0);
        });

        test("decimal string parses", () =>
        {
            const d = elem("X(8)", "3.14159");

            expect(d.getNumeric()).toBe(3.14159);
        });
    });
});
