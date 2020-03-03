(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.MrSparql = factory());
}(this, (function () { 'use strict';

  /**
   * This class manages prefixes, managing short/long and method to expand prefixes and expand namespaces
   * e.g. foaf:name gets expanded to http://xmlns.com/foaf/0.1/name
   * @class
   */
  class PrefixRegister {
    /**
     * @constructor
     */
    constructor() {
      this.lookup = new Map();
      this._allPrefixes = [];
    }
    /**
     * Load a prefix object into the register
     * @param {Prefix} prefix a prefix object
     */
    loadPrefix(prefix) {
      this.lookup.set(prefix.short, prefix);
      this.lookup.set(prefix.long, prefix);
      this._allPrefixes.push(prefix.short, prefix.long);
    }
    /**
     * load the prefixes into the register
     * @param {Array} prefixStrings - array of strings of prefixes
     */
    loadPrefixStrings(prefixStrings) {
      prefixStrings.map(prefixString => {
        const prefix = new Prefix(prefixString);
        this.loadPrefix(prefix);
      });
    }
    /**
     * get the prefixes for one or more URIs
     * @param  {...any} uris - get the prefix for a list of URIs
     * @returns {object | Array} one or more found prefixes
     */
    getPrefix(...uris) {
      let found = [];
      for (
        let i = 0;
        i < this._allPrefixes.length || found.length === uris.length;
        i++
      ) {
        const prefixString = this._allPrefixes[i];
        uris = uris.filter((uri, index) => {
          if (uri.startsWith(prefixString)) {
            found.push(this.lookup.get(prefixString));
            return false;
          }
          return true;
        });
      }
      return found.length === 1 ? found[0] : found;
    }
    /**
     * Qualifies the URI with a full prefix
     * @param {string} uri - a URI
     * @returns {string} the full URI with expanded prefix
     */
    qualify(uri) {
      const prefix = this.getPrefix(uri);
      if (uri.startsWith(prefix.short)) {
        return prefix.long + uri.substring(prefix.short.length + 1);
      }
      return uri;
    }
    /**
     * Checks to see if 2 URIs are using the same prefix
     * @param {string} uri1
     * @param {string} uri2
     * @returns {boolean}
     */
    isPrefixMatch(uri1, uri2) {
      const prefixes = this.getPrefix(uri1, uri2);
      return prefixes[0] === prefixes[1];
    }
    /**
     * Checks to see if 2 uris are the same (whether they have expanded prefix or not)
     * @param {string} uri1
     * @param {string} uri2
     * @returns {boolean}
     */
    isUriMatch(uri1, uri2) {
      if (uri1 === uri2) {
        return true;
      }
      return this.qualify(uri1) === this.qualify(uri2);
    }
  }

  /**
   * A SPARQL prefix object created from a prefix string representation
   * TODO: should handle blank prefix label (becomes the default prefix)
   * @class
   */
  class Prefix {
    /**
     * @param {string} prefixString - the string representing the prefix (as would be displayed at the top of a turtle file)
     * @constructor
     */
    constructor(prefixString) {
      this.prefixString = prefixString;
      this._prefixRegex = /([^:\s]+)\s*:\s*(.+)/;
      this.representations = [];
      this.parsePrefixString();
    }
    /**
     * Parses a prefix string into an object representing the long and short forms of the prefix
     */
    parsePrefixString() {
      const matches = this.prefixString.trim().match(this._prefixRegex);
      this.short = matches[1];
      this.long = matches[2].replace(/[<>]/g, "");
      this.representations.push(matches[1], matches[2]);
    }
    /**
     * @returns {string} the string representation of the prefix
     */
    toString() {
      return this.prefixString;
    }
  }

  /**
   * Manages a collection of edges
   * @class
   */
  class EdgeManager {
    /**
     * @param {object} settings - settings defining the edge settings
     * @constructor
     */
    constructor(settings) {
      this.updateSettings(settings);
      this.edgeMap = new Map();
      this.edgeIdCounter = new Map();
    }
    /**
     * Update the edge settings
     * @param {object} settings - object defining edge settings
     */
    updateSettings(settings) {
      this.settings = Object.assign(
        {
          bundlingStrategy: {
            type: "bidirectional", // allow, unidirectional, bidirectional
            count: true
          }
        },
        settings
      );
    }
    /**
     * Reverse the ID of and edge so id1-id2 becomes id2-id1
     * @param {string} id - the ID for an edge
     * @returns {string}
     */
    _reverseId(id) {
      return id
        .split("-")
        .reverse()
        .join("-");
    }
    /**
     * Shorthand syntax to get the bundling strategy type
     */
    get strategyType() {
      return this.settings.bundlingStrategy.type;
    }
    /**
     * Get the edge from the current edge map
     * @param {string} id - id of the edge to get
     * @returns {object} an edge
     */
    getEdge(id) {
      // TODO: consider how this should take into account count suffixes on IDs
      if (this.strategyType === 'unidirectional') {
        return this.edgeMap.get(id) || this.edgeMap.get(this._reverseId(id));
      } else {
        return this.edgeMap.get(id);
      }
    }
    /**
     * 
     * @param {string} id - current ID
     * @returns {string} whatever the next ID should be 
     */
    nextId(id) {
      // unidirectional: id1-id2 is the same as id2-id1, next id should be id1-id2-count
      // bidirectional id1-id2-count or id2-id1-count
      // allow: id1-id2-count
      if (this.strategyType === 'unidirectional') {
        const reverseId = this._reverseId(id);
        const safeId = this.edgeIdCounter.has(id) ? id : (this.edgeIdCounter.has(reverseId) ? reverseId : id);
        const count = this.edgeIdCounter.get(safeId) || 0;
        this.edgeIdCounter.set(safeId, count + 1);
        return safeId;
      } else if (this.strategyType === 'bidirectional') {
        const count = this.edgeIdCounter.get(id) || 0;
        this.edgeIdCounter.set(id, count + 1);
        return id;
      } else {
        const count = (this.edgeIdCounter.get(id) || 0) + 1;
        this.edgeIdCounter.set(id, count);
        return [id, count].join("-");
      }
    }
    /**
     * Add an edge to the manager
     * @param {object} edge - an object representing an edge to add to the manager
     */
    addEdge(edge) {
      const id = this.nextId(edge.id);
      edge.id = id;
      if (this.settings.bundlingStrategy.count) {
        edge._count = this.edgeIdCounter.get(id) || 1;
      }
      this.edgeMap.set(id, edge);
    }
    getEdges() {
      return Array.from(this.edgeMap.values());
    }
  }

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
    let mode;
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
          modes.pop();
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

  const defaultConfig = {
    edgeSettings: {
      bundlingStrategy: {
        type: "bidirectional", // allow, unidirectional, bidirectional
        count: true
      }
    }
  };

  /**
   * @class
   */
  class MrSparql {
    static sparql() {
      return parser.apply(null, arguments);
    }
    /**
     * @constructor
     * @param {object} config a verbose or simple MrSparql JSON config
     * @param {string} query for simple mode only, the query string of the entire SPARQL query relating to the response to be parsed
     */
    constructor(config, query) {
      this.updateConfig(config, query);
    }
    /**
     * Update the configuration to be used by MrSparql
     * @param {object} config - configuration for transforming a SPARQL response into visualisation-friendly JSON
     */
    updateConfig(config) {
      this.rawConfig = Object.assign({}, config);
      this.config = Object.assign({}, defaultConfig, config);
      this.prefixRegister = new PrefixRegister();
      if (Array.isArray(this.config.prefixes)) {
        this.prefixRegister.loadPrefixStrings(this.config.prefixes);
      }
    }
    /**
     * Transform the SPARQL response into an object with an array for nodes and an array for edges
     * @param {object} response a SPARQL JSON response
     */
    transform(response) {
      this.nodesMap = new Map();
      this.edgeManager = new EdgeManager();
      this.processRows(response);
      const json = {
        nodes: Array.from(this.nodesMap.values()),
        edges: this.edgeManager.getEdges()
      };
      return json;
    }
  }

  /**
   * @class
   */
  class MrSparqlSimple extends MrSparql {
    /**
     * @constructor
     * @param {object} config a simple MrSparql JSON config
     * @param {string} query the query string of the entire SPARQL query relating to the response to be parsed
     */
    constructor(config, query) {
      super(config, query);
      this.updateConfig(config, query);
    }
    /**
     * Update the configuration to be used by MrSparql
     * @param {object} config  configuration for transforming a SPARQL response into visualisation-friendly JSON
     * @param {string} query the query string of the entire SPARQL query relating to the response to be parsed
     */
    updateConfig(config, query) {
      super.updateConfig(config);
      this.rawQuery = query;
      this.parsedQuery = parser(query);
      this.parsedQuery.prefixes.forEach(prefix => {
        this.prefixRegister.loadPrefix(prefix);
      });
    }
    /**
     * parses the SPARQL response and creates visualisation-friendly JSON
     * @param {object} response A SPARQL JSON response
     */
    processRows(response) {
      response.results.bindings.forEach(row => {
        this.getItems(row);
      });
    }
    /**
     * Using the parsed query and SPARQL row, transform the row to an array of processed triples,
     * @param {object} row A row defining variable keys and response values from the SPARQL response
     * @returns {object} a processed triple containing the row value paired with corresponding variable name for each part
     */
    getProcessedTriples(row) {
      const processedTriples = [];
      const keys = ["subject", "predicate", "object"];
      this.parsedQuery.triples.forEach(queryTriple => {
        const processed = {};
        queryTriple.forEach((part, index) => {
          const key = keys[index];
          let variable, value;
          const isVariable = part.charAt(0) === "?";
          if (isVariable) {
            variable = part.substring(1);
            const sparqlObjectResult = row[part.substring(1)];
            value =
              typeof sparqlObjectResult === "object"
                ? sparqlObjectResult.value
                : null;
          } else {
            variable = part;
            value = part;
          }
          processed[key] = {
            value,
            variable,
            part,
            isVariable
          };
        });
        // validate
        const isValid = keys.every(key => {
          const rowHasKey = row.hasOwnProperty(processed[key].variable);
          const rowHasValue =
            rowHasKey && row[processed[key].variable].hasOwnProperty("value");
          return rowHasValue || !processed[key].isVariable;
        });
        if (isValid) {
          processedTriples.push(processed);
        }
      });
      return processedTriples;
    }
    /**
     * Is the processed triple defining a relationship (with a node at each end) or is it defining
     * properties of a node?
     * @param {object} triple a processed triple often from a SPARQL response row
     * @returns {boolean}
     */
    findRelationship(triple) {
      const foundRelationship = this.config.edges.find(edgeConfig => {
        return edgeConfig.matches.some(match => {
          // expand prefix
          const containsNodes =
            this.config.nodes.hasOwnProperty(triple.subject.variable) &&
            this.config.nodes.hasOwnProperty(triple.object.variable);
          return (
            containsNodes &&
            this.prefixRegister.isUriMatch(triple.predicate.value, match)
          );
        });
      });
      return foundRelationship;
    }
    /**
     * create nodes and edges from the current row in the SPARQL response
     * @param {object} row a row from the SPARQL response array
     */
    getItems(row) {
      // check, is this row defining relationships or properties?
      const triples = this.getProcessedTriples(row);
      triples.forEach(triple => {
        const foundRelationship = this.findRelationship(triple);
        if (foundRelationship) {
          ["subject", "object"].forEach(key => {
            const { variable, value } = triple[key];
            const nodeDef = this.config.nodes[variable];
            if (nodeDef && !this.nodesMap.has(value)) {
              const groupDef = this.config.groups[nodeDef.group];
              const groupProperties = groupDef.properties || {};
              const node = Object.assign({}, groupProperties, {
                id: value,
                group: nodeDef.group
              });
              this.nodesMap.set(value, node);
            }
          });
          const edgeId = [triple.subject.value, triple.object.value].join("-");
          const edgeProperties = foundRelationship.properties || {};
          const edge = Object.assign({}, edgeProperties, {
            id: edgeId,
            from: triple.subject.value,
            to: triple.object.value
          });
          this.edgeManager.addEdge(edge);
        } else {
          // o is a property (p) of s
          const id = triple.subject.value;
          const node = this.nodesMap.get(id) || { id, properties: {} };
          // check if property is defined in config then we can define on node object first-level (otheriwse dump on properties object)
          const config = this.config.nodes[triple.subject.variable];
          let assigned = false;
          for (let key in config) {
            const val = config[key];
            if (typeof val === 'object') {
              if (val.matches) {
                const isMatch = this.prefixRegister.isUriMatch(triple[val.matches.key].value, val.matches.value);
                if (isMatch) {
                  node[key] = triple.object.value;
                  assigned = true;
                  break;
                }
              }
            }
          }
          if (!assigned) {
            if (!node.properties) {
              node.properties = {};
            }
            node.properties[triple.predicate.value] = triple.object.value;
          }
          this.nodesMap.set(id, node);
        }
      });
    }
  }

  /**
   * @class
   */
  class MrSparqlVerbose extends MrSparql {
    static sparql() {
      return parser.apply(null, arguments);
    }
    /**
     * @constructor
     * @param {object} config the MrSparql JSON config explaining how to map from a SPARQL response to nodes/edges
     */
    constructor(config) {
      super(config);
      this.updateConfig(config);
    }
    /**
     * process a SPARQL response into nodes and edges
     * @param {object} response a SPARQL JSON response
     */
    processRows(response) {
      response.results.bindings.forEach(row => {
        this.getNodes(row);
        this.getEdges(row);
      });
    }
    /**
     * Transform the SPARQL response into an object with an array for nodes and an array for edges
     * @param {object} response a SPARQL JSON response
     */
    transform(response) {
      this.nodesMap = new Map();
      this.edgeManager = new EdgeManager();
      response.results.bindings.forEach(row => {
        this.getNodes(row);
        this.getEdges(row);
      });
      const json = {
        nodes: Array.from(this.nodesMap.values()),
        edges: this.edgeManager.getEdges()
      };
      return json;
    }
    /**
     * Checks to see if a SPARQL row passes the conditions set out in the definition
     * @param {object} def the definition object containing the condition for the parameter under scrutiny
     * @param {object} row  a result row (object within an array) from the SPARQL response
     */
    passesCondition(def, row) {
      const { condition } = def;
      if (condition) {
        if (condition.prefix) {
          const item = row[def.variable];
          // find prefix
          const prefix = this.prefixRegister.lookup.get(condition.prefix);
          if (!prefix) {
            throw new Error(
              `Prefix for condition is not defined in config prefixes: ${condition.prefix}`
            );
          }
          if (!(this.prefixRegister.getPrefix(item.value) === prefix)) {
            return false;
          }
        } else if (condition.equals) {
          // see if 2 uris are the same
          const v1 = row[condition.variable].value;
          const v2 = condition.equals;
          if (!this.prefixRegister.isUriMatch(v1, v2)) {
            return false;
          }
        }
      }
      return true;
    }
    /**
     * Get all the properties for a specified node or edge
     * @param {object} itemDef the definition object for the item (will eventually represent a node or edge)
     * @param {object} row a result row (object within an array) from the SPARQL response
     */
    getProperties(itemDef, row) {
      const props = {};
      if (Array.isArray(itemDef.properties)) {
        itemDef.properties.forEach(propDef => {
          if (this.passesCondition(propDef, row)) {
            if (propDef.value) {
              props[propDef.name] = propDef.value;
            } else {
              const value = row[propDef.variable];
              if (value) {
                props[propDef.name] = value.value;
              }
            }
          }
        });
      }
      return props;
    }
    /**
     * Extract all nodes and their properties from a SPARQL result row
     * @param {object} row a result row (object within an array) from the SPARQL response
     */
    getNodes(row) {
      this.config.nodes.forEach(nodeDef => {
        const nodeItem = row[nodeDef.variable];
        let foundNode;
        if (nodeItem && this.passesCondition(nodeDef, row)) {
          if (!this.nodesMap.has(nodeItem.value)) {
            foundNode = {};
            this.nodesMap.set(nodeItem.value, foundNode);
          } else {
            foundNode = this.nodesMap.get(nodeItem.value);
          }
          const groupDef = this.config.groups[nodeDef.group];
          const groupProperties = groupDef.properties || {};
          const props = this.getProperties(nodeDef, row);
          Object.assign(foundNode, groupProperties, props, {
            id: nodeItem.value,
            group: nodeDef.group
          });
        }
      });
    }
    /**
     * Extract all edges and their properties from a SPARQL result row
     * @param {object} row a result row (object within an array) from the SPARQL response
     */
    getEdges(row) {
      this.config.edges.forEach(edgeDef => {
        const from = row[edgeDef.from];
        const to = row[edgeDef.to];
        if (typeof from === "object" && typeof to === "object") {
          const fromId = from.value;
          const toId = to.value;
          const id = [fromId, toId].join("-");
          if (this.passesCondition(edgeDef, row)) {
            const props = this.getProperties(edgeDef, row);
            const edge = {
              from: fromId,
              to: toId,
              id,
              ...props
            };
            this.edgeManager.addEdge(edge);
          }
        }
      });
    }
  }

  // This is to inherit static methods
  Object.setPrototypeOf(MrSparqlSimple, MrSparql);
  Object.setPrototypeOf(MrSparqlVerbose, MrSparql);

  function index(config, query) {
    return config.verbose
      ? new MrSparqlVerbose(config)
      : new MrSparqlSimple(config, query);
  }

  return index;

})));
