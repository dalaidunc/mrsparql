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

function parser(queryString) {
  let index = 0;
  let mode = null;
  let currentToken;
  let currentChar;
  const queryVariables = [];
  const prefixes = [];
  // mode can be seekingToken (null), comment, or other mode

  const modes = {
    comment() {
      if (c === "\n") {
        mode = null;
      }
    },
    token() {
      if (isWord(currentChar)) {
        currentToken += currentChar;
      } else if (isWhitespace(currentChar)) {
        mode = currentToken.toLowerCase();
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
        mode = null;
        submode = null;
        prefixes.push(new Prefix(currentToken));
      }
    }
  };

  while (index !== queryString.length) {
    currentChar = queryString.charAt(index);
    if (!mode) {
      // looking for next token
      if (currentChar === "#") {
        mode = "comment";
      } else if (isWord(currentChar)) {
        currentToken = currentChar;
        mode = "token";
      }
    } else {
      if (modes[mode]) {
        modes[mode]();
      }
    }
    index++;
  }
  return {
    prefixes
  };
}

module.exports = parser;
