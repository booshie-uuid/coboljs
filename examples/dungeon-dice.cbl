 IDENTIFICATION DIVISION.
 PROGRAM-ID. DUNGEON-DICE.

*> Turn-based combat with a flee option. Pick your hero
*> name, fate picks the monster, and each turn you choose
*> to fight or flee. Fleeing rolls a d20 — succeed and
*> you escape, fail and the monster gets a free swing.
*>
*> Showcases group items (HERO / MONSTER), signed PICs
*> (HP can dip below zero), compound conditions in
*> PERFORM UNTIL, period-less IF bodies, and most of the
*> intrinsic toolkit (RANDOM, INTEGER, UPPER-CASE, TRIM,
*> LENGTH).

 DATA DIVISION.
 WORKING-STORAGE SECTION.
 01 HERO.
    02 HERO-NAME PIC X(20).
    02 HERO-HP   PIC S9(3) VALUE 30.
    02 HERO-ATK  PIC 9(2)  VALUE 8.

 01 MONSTER.
    02 MONSTER-NAME PIC X(20).
    02 MONSTER-HP   PIC S9(3).
    02 MONSTER-ATK  PIC 9(2).

 01 ROUND       PIC 9(2) VALUE 0.
 01 PICK        PIC 9.
 01 ROLL        PIC 9(2).
 01 DAMAGE      PIC 9(2).
 01 CHOICE      PIC X(10).
 01 CHOICE-NORM PIC X(10).
 01 ESCAPED     PIC 9    VALUE 0.

 PROCEDURE DIVISION.
 MAIN.
     DISPLAY "*** DUNGEON-DICE ***".
     DISPLAY "ENTER YOUR HERO NAME: " WITH NO ADVANCING.
     ACCEPT HERO-NAME.

     IF FUNCTION LENGTH(FUNCTION TRIM(HERO-NAME)) = 0
         MOVE "BRAVE-ONE" TO HERO-NAME
     END-IF.

*> Normalise the name to upper-case once, so every later
*> DISPLAY can just TRIM and have the dungeon's voice
*> ring out consistently — "MATT HITS FOR 08" vs the
*> oddly-cased "matt hits for 08" you'd otherwise get.
     MOVE FUNCTION UPPER-CASE(FUNCTION TRIM(HERO-NAME)) TO HERO-NAME.

     PERFORM PICK-MONSTER.

     DISPLAY " ".
     DISPLAY FUNCTION TRIM(HERO-NAME) " ENTERS THE DUNGEON...".
     DISPLAY "A WILD " FUNCTION TRIM(MONSTER-NAME) " APPEARS!".

     PERFORM TURN UNTIL HERO-HP < 1 OR MONSTER-HP < 1 OR ESCAPED = 1.

     DISPLAY " ".
     IF ESCAPED = 1
         DISPLAY "*** YOU LIVED TO TELL THE TALE ***"
     ELSE
         IF HERO-HP > 0
             DISPLAY "*** VICTORY AFTER " ROUND " ROUNDS ***"
             DISPLAY "    FINAL HP: " HERO-HP
         ELSE
             DISPLAY "*** DEFEAT ***"
             DISPLAY "    " FUNCTION TRIM(HERO-NAME) " HAS FALLEN."
         END-IF
     END-IF.

     STOP RUN.

 PICK-MONSTER.
*> Roll a d4 and assign the matching foe's stats.
     COMPUTE PICK = FUNCTION INTEGER(FUNCTION RANDOM * 4) + 1.

     IF PICK = 1
         MOVE "GOBLIN"   TO MONSTER-NAME
         MOVE 22         TO MONSTER-HP
         MOVE 6          TO MONSTER-ATK
     END-IF.
     IF PICK = 2
         MOVE "KOBOLD"   TO MONSTER-NAME
         MOVE 18         TO MONSTER-HP
         MOVE 5          TO MONSTER-ATK
     END-IF.
     IF PICK = 3
         MOVE "ORC"      TO MONSTER-NAME
         MOVE 35         TO MONSTER-HP
         MOVE 9          TO MONSTER-ATK
     END-IF.
     IF PICK = 4
         MOVE "SKELETON" TO MONSTER-NAME
         MOVE 28         TO MONSTER-HP
         MOVE 7          TO MONSTER-ATK
     END-IF.

 TURN.
     DISPLAY " ".
     DISPLAY "FIGHT (Y/N)? " WITH NO ADVANCING.
     ACCEPT CHOICE.
     MOVE FUNCTION UPPER-CASE(FUNCTION TRIM(CHOICE)) TO CHOICE-NORM.

     IF CHOICE-NORM = "N" OR CHOICE-NORM = "NO"
         PERFORM ATTEMPT-ESCAPE
     ELSE
         IF CHOICE-NORM = "Y" OR CHOICE-NORM = "YES"
             PERFORM COMBAT-ROUND
         ELSE
             DISPLAY "  STOP MUMBLING... YOU ARE OUT OF TIME — THE FIGHT CONTINUES!"
             PERFORM COMBAT-ROUND
         END-IF
     END-IF.

 ATTEMPT-ESCAPE.
*> Roll a d20 — 11+ slips away clean, otherwise the
*> monster gets a free swing as you trip over yourself.
     DISPLAY "  ATTEMPTING TO FLEE...".
     COMPUTE ROLL = FUNCTION INTEGER(FUNCTION RANDOM * 20) + 1.

     IF ROLL >= 11
         DISPLAY "  YOU SLIP INTO THE SHADOWS — ESCAPED!"
         MOVE 1 TO ESCAPED
     ELSE
         DISPLAY "  THE " FUNCTION TRIM(MONSTER-NAME) " BLOCKS YOUR PATH!"
         PERFORM MONSTER-TURN
         DISPLAY "  HP -- " FUNCTION TRIM(HERO-NAME) ": " HERO-HP "  " FUNCTION TRIM(MONSTER-NAME) ": " MONSTER-HP
     END-IF.

 COMBAT-ROUND.
     ADD 1 TO ROUND.
     DISPLAY "  -- ROUND " ROUND " --".

     PERFORM HERO-TURN.

*> Skip the monster's swing if our hero just felled it.
     IF MONSTER-HP > 0
         PERFORM MONSTER-TURN
     END-IF.

     DISPLAY "  HP -- " FUNCTION TRIM(HERO-NAME) ": " HERO-HP "  " FUNCTION TRIM(MONSTER-NAME) ": " MONSTER-HP.

 HERO-TURN.
     COMPUTE ROLL = FUNCTION INTEGER(FUNCTION RANDOM * 20) + 1.

     IF ROLL = 1
         DISPLAY "  " FUNCTION TRIM(HERO-NAME) " STUMBLES!"
     ELSE
         IF ROLL = 20
             COMPUTE DAMAGE = HERO-ATK * 2
             SUBTRACT DAMAGE FROM MONSTER-HP
             DISPLAY "  " FUNCTION TRIM(HERO-NAME) " CRITS! " DAMAGE " DAMAGE."
         ELSE
             MOVE HERO-ATK TO DAMAGE
             SUBTRACT DAMAGE FROM MONSTER-HP
             DISPLAY "  " FUNCTION TRIM(HERO-NAME) " HITS FOR " DAMAGE "."
         END-IF
     END-IF.

 MONSTER-TURN.
     COMPUTE ROLL = FUNCTION INTEGER(FUNCTION RANDOM * 20) + 1.

     IF ROLL = 1
         DISPLAY "  " FUNCTION TRIM(MONSTER-NAME) " STUMBLES!"
     ELSE
         IF ROLL = 20
             COMPUTE DAMAGE = MONSTER-ATK * 2
             SUBTRACT DAMAGE FROM HERO-HP
             DISPLAY "  " FUNCTION TRIM(MONSTER-NAME) " CRITS! " DAMAGE " DAMAGE."
         ELSE
             MOVE MONSTER-ATK TO DAMAGE
             SUBTRACT DAMAGE FROM HERO-HP
             DISPLAY "  " FUNCTION TRIM(MONSTER-NAME) " HITS FOR " DAMAGE "."
         END-IF
     END-IF.
