import { run } from "./runner.js";

import "./cobol/lexer.test.js";
import "./cobol/pic.test.js";
import "./cobol/data-item.test.js";
import "./cobol/expression.test.js";
import "./cobol/parser.test.js";
import "./cobol/interpreter.test.js";
import "./examples.test.js";

await run();
