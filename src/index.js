const { Prefix, PrefixRegister } = require("./prefix.js");
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

class MrSparql {
  constructor(config) {
    this.rawConfig = Object.assign({}, config);
    this.config = config;
    this.prefixRegister = new PrefixRegister();
    this.nodesMap = new Map();
    if (Array.isArray(this.config.prefixes)) {
      this.prefixRegister.loadPrefixStrings(this.config.prefixes);
    }
  }
  transform(response) {
    const json = {};
    response.results.bindings.forEach(row => {
      this.getNodes(row);
    });
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
        Object.assign(foundNode, groupProperties, {
          id: nodeItem.value,
          group: nodeDef.group
        });
        nodeDef.properties.forEach(propDef => {
          if (this.passesCondition(propDef, row)) {
            const value = row[propDef.variable];
            if (value) {
              foundNode[propDef.name] = value.value;
            }
          }
        });
      }
    });
  }
}

module.exports = MrSparql;
