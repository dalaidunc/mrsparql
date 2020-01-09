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
   * Boolean to determine if the bundling strategy is unidirectional or not
   */
  get _isUnidirectional() {
    return this.settings.bundlingStrategy.type === "unidirectional";
  }
  /**
   * Get the edge from the current edge map
   * @param {string} id - id of the edge to get
   * @returns {object} an edge
   */
  getEdge(id) {
    if (this._isUnidirectional) {
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
    if (this._isUnidirectional) {
      return [id, count].join("-");
    } else {
      const count = this.edgeIdCounter.get(id) || 0;
      this.edgeIdCounter.set(id, count + 1);
      return id;
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

module.exports = EdgeManager;