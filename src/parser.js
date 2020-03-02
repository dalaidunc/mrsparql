const { Prefix } = require("./prefix.js");
/**
 * Parses a SPARQL query to get variables, prefixes and IRIs.
 * No validation to SPARQL spec is done, too big a task for now
 * And we can consider that a SPARQL query is valid, otherwise we wouldn't have a response to convert
 * Future could implement SPARQL spec: https://www.w3.org/TR/sparql11-query/#sparqlGrammar
 */

/**
 * Check if the character is a whitespace character or not
 * @param {string} c a single char
 * @returns {boolean}
 */
function isWhitespace(c) {
  const wsCodes = [0x20, 0x9, 0xd, 0xa];
  for (let i = 0; i < wsCodes.length; i++) {
    if (c.charCodeAt(0) === wsCodes[i]) {
      return true;
    }
  }
  return false;
}

// Only matches english words, so only to be used for SPARQL keywords (PREFIX, SELECT etc.)
function isWord(c) {
  return /\w/.test(c);
}

function isTripleEnd(c) {
  return c === ";" || c === "." || c === '}';
}

class SparqlParseError extends Error {
  constructor(...params) {
    // Pass remaining arguments (including vendor specific ones) to parent constructor
    super(...params);

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CustomError);
    }

    this.name = "SparqlParseError";
  }
}

function parser(queryString) {
  let index = 0;
  let modes = [];
  let submode = null;
  let currentToken;
  let currentChar;
  const queryVariables = [];
  const prefixes = [];
  const triples = [];
  let triple = [];
  const values = [];
  let valuesIndex = 0;

  function flushTriple(endChar) {
    if (triple.length === 3) {
      triples.push(triple);
    }
    const newTriple = [];
    if (endChar === ";") {
      newTriple.push(triple[0]);
    }
    triple = newTriple;
  }

  function tripleProcessMode() {
    if (currentChar === "}") {
      modes.pop();
      currentToken = "";
      flushTriple(currentChar);
    } else {
      if (isWhitespace(currentChar)) {
        // a where clause is composed of a series of triples (variables and IRIS, some with prefixes)
        // remember . and ; line endings
        // sub-clauses should enter new modes which return to where mode after exiting
        // a triple will always end with ; or . or }
        const endChar = currentToken.charAt(currentToken.length - 1);
        if (currentToken.length > 0) {
          if (isTripleEnd(endChar)) {
            currentToken = currentToken.substring(0, currentToken.length - 1);
            if (currentToken) {
              triple.push(currentToken);
            }
            currentToken = "";
            flushTriple(endChar);
          } else if (
            ["union", "optional", "values"].some(
              key => currentToken.toLowerCase() === key
            )
          ) {
            // new mode (UNION, OPTIONAL, VALUES etc.)
            modes.push(currentToken.toLowerCase());
            currentToken = "";
          } else {
            triple.push(currentToken);
            currentToken = "";
          }
        }
      } else if (isTripleEnd(currentToken)) {
        // TODO: not sure if this path is reached
        flushTriple(currentToken);
        currentToken = "";
      } else if (currentChar !== "{") {
        currentToken += currentChar;
      }
    }
  }

  const modeFns = {
    comment() {
      if (c === "\n") {
        mode.pop();
      }
    },
    token() {
      if (isWord(currentChar)) {
        currentToken += currentChar;
      } else if (isWhitespace(currentChar)) {
        modes.push(currentToken.toLowerCase());
        currentToken = "";
      } else {
        throw new SparqlParseError(
          `Invalid token found: ${currentChar} in ${currentToken}`
        );
      }
    },
    prefix() {
      currentToken += currentChar;
      if (currentChar === ">") {
        modes.pop();
        prefixes.push(new Prefix(currentToken));
        currentToken = "";
      }
    },
    select() {
      if (currentToken.toLowerCase() === "where") {
        modes.pop();
        modes.push("where");
        currentToken = "";
      } else {
        // TODO variables could be delimited by comma and no space?
        if (isWhitespace(currentChar)) {
          if (currentToken.startsWith("?")) {
            queryVariables.push(currentToken.replace(",", ""));
          }
          currentToken = "";
        } else {
          currentToken += currentChar;
        }
      }
    },
    where: tripleProcessMode,
    union: tripleProcessMode,
    values() {
      if (isWhitespace(currentChar)) {
        values.push([currentToken]);
        currentToken = "";
      } else if (currentChar === "{") {
        if (currentToken.length > 1) {
          values.push([currentToken]);
          currentToken = "";
        }
        modes.push("valuesvalues");
      } else if (currentChar !== ")" && currentChar !== "(") {
        currentToken += currentChar;
      }
    },
    valuesvalues() {
      if (currentChar === "}") {
        if (currentToken.length > 1) {
          values[0].push(currentToken);
        }
        modes.pop(); // return to values mode
        modes.pop(); // return to where mode
        currentToken = "";
      }
      if (isWhitespace(currentChar)) {
        if (currentToken.length > 0) {
          if (currentToken.toLowerCase() !== "undef") {
            values[valuesIndex].push(currentToken);
          }
          if (values.length > 1) {
            valuesIndex++;
          }
        }
        currentToken = "";
      } else if (currentChar === "(") {
        valuesIndex = 0;
      } else if (currentChar === ")") {
        if (currentToken.length > 0) {
          if (currentToken.toLowerCase() !== "undef") {
            values[valuesIndex].push(currentToken);
          }
          currentToken = "";
        }
        valuesIndex = 0;
      } else {
        currentToken += currentChar;
      }
    },
    optional: tripleProcessMode
  };

  while (index !== queryString.length) {
    currentChar = queryString.charAt(index);
    mode = modes[modes.length - 1];
    if (!mode) {
      // looking for next token
      if (currentChar === "#") {
        modes.push("comment");
      } else if (isWord(currentChar)) {
        currentToken = currentChar;
        modes.push("token");
      }
    } else {
      if (modeFns[mode]) {
        modeFns[mode]();
      }
    }
    index++;
  }
  return {
    prefixes,
    triples,
    values
  };
}

module.exports = parser;
