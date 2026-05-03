 IDENTIFICATION DIVISION.
 PROGRAM-ID. FIZZBUZZ.

*> Print FizzBuzz for 1-20: "Fizz" if divisible by 3,
*> "Buzz" by 5, "FizzBuzz" by both. Remainders are
*> computed via repeated subtraction (no MOD operator).

 DATA DIVISION.
 WORKING-STORAGE SECTION.
 01 N  PIC 9(2).
 01 R3 PIC 9(2).
 01 R5 PIC 9(2).

 PROCEDURE DIVISION.
 MAIN.
     PERFORM CHECK VARYING N FROM 1 BY 1 UNTIL N > 20.
     STOP RUN.

*> COBOL has FUNCTION MOD — `COMPUTE R3 = FUNCTION MOD(N, 3)`
*> would replace the two CALC-MOD-* paragraphs below. The
*> manual subtract-loop version is kept here because it's a
*> nice showcase of MOVE and PERFORM UNTIL.
 CHECK.
     PERFORM CALC-MOD-3.
     PERFORM CALC-MOD-5.
     IF R3 = 0
         IF R5 = 0
             DISPLAY "FIZZBUZZ".
         ELSE
             DISPLAY "FIZZ".
         END-IF
     ELSE
         IF R5 = 0
             DISPLAY "BUZZ".
         ELSE
             DISPLAY N.
         END-IF
     END-IF.

 CALC-MOD-3.
     MOVE N TO R3.
     PERFORM SUB-3 UNTIL R3 < 3.

 SUB-3.
     SUBTRACT 3 FROM R3.

 CALC-MOD-5.
     MOVE N TO R5.
     PERFORM SUB-5 UNTIL R5 < 5.

 SUB-5.
     SUBTRACT 5 FROM R5.
