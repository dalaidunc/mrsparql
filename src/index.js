const { PrefixRegister } = require("./prefix.js");
const EdgeManager = require("./edge-manager.js");

const defaultConfig = {
  edgeSettings: {
    bundlingStrategy: {
      type: "bidirectional", // allow, unidirectional, bidirectional
      count: true
    }
  }
};

class MrSparql {
  /**
   * @constructor
   */
  constructor(config) {
    this.updateConfig(config);
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
   * @param {object} response - a SPARQL JSON response
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
   * @param {object} def - the definition object containing the condition for the parameter under scrutiny
   * @param {object} row  - a result row (object within an array) from the SPARQL response
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
   * @param {object} itemDef - the definition object for the item (will eventually represent a node or edge)
   * @param {object} row - a result row (object within an array) from the SPARQL response
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
   * @param {object} row - a result row (object within an array) from the SPARQL response
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
   * @param {object} row - a result row (object within an array) from the SPARQL response
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

module.exports = MrSparql;
