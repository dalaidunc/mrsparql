class PrefixRegister {
  constructor() {
    this.lookup = new Map();
    this._allPrefixes = [];
  }
  loadPrefixStrings(prefixStrings) {
    prefixStrings.map(prefixString => {
      const prefix = new Prefix(prefixString);
      this.lookup.set(prefix.short, prefix);
      this.lookup.set(prefix.long, prefix);
      this._allPrefixes.push(prefix.short, prefix.long);
    });
  }
  getPrefix(...uris) {
    let found = [];
    for (let i = 0; i < this._allPrefixes.length || found.length === uris.length; i++) {
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
  qualify(uri) {
    const prefix = this.getPrefix(uri);
    if (uri.startsWith(prefix.short)) {
      return prefix.long + uri.substring(prefix.short.length + 1);
    }
    return uri;
  }
  isPrefixMatch(uri1, uri2) {
    const prefixes = this.getPrefix(uri1, uri2);
    return prefixes[0] === prefixes[1];
  }
  isUriMatch(uri1, uri2) {
    if (uri1 === uri2) {
      return true;
    }
    return this.qualify(uri1) === this.qualify(uri2);
  }
}

class Prefix {

  constructor(prefixString) {
    this.prefixString = prefixString;
    this._prefixRegex = /([^:\s]+)\s*:\s*(.+)/; 
    this.representations = [];
    this.parsePrefixString();
  }

  parsePrefixString() {
    const matches = this.prefixString.trim().match(this._prefixRegex);
    this.short = matches[1];
    this.long = matches[2];
    this.representations.push(matches[1], matches[2]);
  }

  toString() {
    return this.prefixString;
  }
}

module.exports = {
  Prefix,
  PrefixRegister
};