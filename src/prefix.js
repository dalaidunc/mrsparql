/**
 * This class manages prefixes, managing short/long and method to expand prefixes and expand namespaces
 * e.g. foaf:name gets expanded to http://xmlns.com/foaf/0.1/name
 * @class
 */
export class PrefixRegister {
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
export class Prefix {
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