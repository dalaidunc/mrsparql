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

module.exports = EdgeManager;