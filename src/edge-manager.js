class EdgeManager {
  constructor(settings) {
    this.updateSettings(settings);
    this.edgeMap = new Map();
    this.edgeIdCounter = new Map();
  }
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
  _reverseId(id) {
    return id
      .split("-")
      .reverse()
      .join("-");
  }
  get _isUnidirectional() {
    return this.settings.bundlingStrategy.type === "unidirectional";
  }
  getEdge(id) {
    if (this._isUnidirectional) {
      return this.edgeMap.get(id) || this.edgeMap.get(this._reverseId(id));
    } else {
      return this.edgeMap.get(id);
    }
  }
  nextId(id) {
    if (this._isUnidirectional) {
      return [id, count].join("-");
    } else {
      const count = this.edgeIdCounter.get(id) || 0;
      this.edgeIdCounter.set(id, count + 1);
      return id;
    }
  }
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