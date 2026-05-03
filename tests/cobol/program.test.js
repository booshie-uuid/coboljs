import { suite, test, expect } from "../runner.js";
import { Program, Paragraph } from "../../scripts/modules/cobol/program.js";


suite("Program", () =>
{
    suite("constructor", () =>
    {
        test("starts with a single anonymous paragraph", () =>
        {
            const program = new Program();

            expect(program.paragraphs.length).toBe(1);
            expect(program.paragraphs[0].name).toBe(null);
        });

        test("data items map starts empty", () =>
        {
            const program = new Program();

            expect(program.dataItems.size).toBe(0);
        });

        test("programId starts as null", () =>
        {
            const program = new Program();

            expect(program.programId).toBe(null);
        });
    });

    suite("addParagraph", () =>
    {
        test("appends a named paragraph", () =>
        {
            const program = new Program();
            const para = program.addParagraph("MAIN");

            expect(program.paragraphs.length).toBe(2);
            expect(program.paragraphs[1].name).toBe("MAIN");
            expect(para.name).toBe("MAIN");
        });

        test("returns the new paragraph for chaining", () =>
        {
            const program = new Program();
            const para = program.addParagraph("SUB");

            expect(para instanceof Paragraph).toBe(true);
        });

        test("multiple paragraphs preserve insertion order", () =>
        {
            const program = new Program();
            program.addParagraph("ALPHA");
            program.addParagraph("BETA");
            program.addParagraph("GAMMA");

            expect(program.paragraphs.map(p => p.name)).toEqual([null, "ALPHA", "BETA", "GAMMA"]);
        });
    });

    suite("currentParagraph", () =>
    {
        test("returns the anonymous paragraph initially", () =>
        {
            const program = new Program();

            expect(program.currentParagraph().name).toBe(null);
        });

        test("returns the most recently added paragraph", () =>
        {
            const program = new Program();
            program.addParagraph("FIRST");
            program.addParagraph("SECOND");

            expect(program.currentParagraph().name).toBe("SECOND");
        });
    });
});


suite("Paragraph", () =>
{
    test("constructor sets name and starts with empty statements", () =>
    {
        const para = new Paragraph("MAIN");

        expect(para.name).toBe("MAIN");
        expect(para.statements).toEqual([]);
    });

    test("anonymous paragraph carries name=null", () =>
    {
        const para = new Paragraph(null);

        expect(para.name).toBe(null);
    });

    test("addStatement appends to the statements array", () =>
    {
        const para = new Paragraph("MAIN");

        para.addStatement({ kind: "DISPLAY", line: 1 });
        para.addStatement({ kind: "STOP_RUN", line: 2 });

        expect(para.statements.length).toBe(2);
        expect(para.statements[0].kind).toBe("DISPLAY");
        expect(para.statements[1].kind).toBe("STOP_RUN");
    });

    test("statements preserve insertion order", () =>
    {
        const para = new Paragraph("MAIN");

        para.addStatement({ kind: "A" });
        para.addStatement({ kind: "B" });
        para.addStatement({ kind: "C" });

        expect(para.statements.map(s => s.kind)).toEqual(["A", "B", "C"]);
    });
});
