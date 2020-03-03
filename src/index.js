import { PrefixRegister } from './prefix';
import EdgeManager from './edge-manager';
import parser from './parser';

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

export default function(config, query) {
  return config.verbose
    ? new MrSparqlVerbose(config)
    : new MrSparqlSimple(config, query);
};
