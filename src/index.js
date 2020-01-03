const { Prefix, PrefixRegister } = require("./prefix.js");
const EdgeManager = require("./edge-manager.js");
/*
groups,
nodes,
edges,
styling,
custom rules?
root node
TODO: split into different files
TODO: new way of managing prefixes, with methods to expand prefixes
Need to create a new class or module for prefixes, managing short/long and method to expand prefixes and expand namespaces
e.g. foaf:name gets expanded to http://xmlns.com/foaf/0.1/name
*/

const defaultConfig = {
  edgeSettings: {
    bundlingStrategy: {
      type: "bidirectional", // allow, unidirectional, bidirectional
      count: true
    }
  }
};

class MrSparql {
  constructor(config) {
    this.updateConfig(config);
  }
  updateConfig(config) {
    this.rawConfig = Object.assign({}, config);
    this.config = Object.assign({}, defaultConfig, config);
    this.prefixRegister = new PrefixRegister();
    if (Array.isArray(this.config.prefixes)) {
      this.prefixRegister.loadPrefixStrings(this.config.prefixes);
    }
  }
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
  getEdges(row) {
    this.config.edges.forEach(edgeDef => {
      const from = row[edgeDef.from];
      const to = row[edgeDef.to];
      if (typeof from === "object" && typeof to === "object") {
        const fromId = from.value;
        const toId = to.value;
        const id = [fromId, toId].join("-"); // TODO: take action depending on edge settings in config
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
