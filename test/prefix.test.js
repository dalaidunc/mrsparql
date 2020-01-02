const { Prefix, PrefixRegister } = require("../src/prefix.js");

const prefixes = [
  "cmno: http://purl.org/ontology/classicalmusicnav#",
  "cmn: http://purl.org/NET/classicalmusicnav#",
  "foaf: http://xmlns.com/foaf/0.1/"
];

test("parses prefix string", () => {
  const ps = "cmno: http://purl.org/ontology/classicalmusicnav#";
  const prefix = new Prefix(ps);
  expect(prefix.short).toBe("cmno");
  expect(prefix.long).toBe("http://purl.org/ontology/classicalmusicnav#");
});

test("find if uris match", () => {
  const matchingUris = ["foaf:name", "http://xmlns.com/foaf/0.1/name"];
  const notMatching = ["foaf:name", "http://xmlns.com/foaf/0.1/age"];
  const pr = new PrefixRegister();
  pr.loadPrefixStrings(prefixes);
  expect(pr.isUriMatch(...matchingUris)).toBe(true);
  expect(pr.isUriMatch(...notMatching)).toBe(false);
});

test("find if prefixes of uris match", () => {
  const matching1 = ["foaf:name", "http://xmlns.com/foaf/0.1/name"];
  const matching2 = ["foaf:name", "http://xmlns.com/foaf/0.1/age"];
  const matching3 = ["http://xmlns.com/foaf/0.1/name", "http://xmlns.com/foaf/0.1/age"];
  const notMatching = ["cmn:name", "http://xmlns.com/foaf/0.1/age"];
  const pr = new PrefixRegister();
  pr.loadPrefixStrings(prefixes);
  expect(pr.isPrefixMatch(...matching1)).toBe(true);
  expect(pr.isPrefixMatch(...matching2)).toBe(true);
  expect(pr.isPrefixMatch(...matching3)).toBe(true);
  expect(pr.isPrefixMatch(...notMatching)).toBe(false);
})
