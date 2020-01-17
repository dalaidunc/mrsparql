const MrSparql = require("../src/index");
const { sparql } = MrSparql;

describe("parses prefixes", () => {

  const query = `
  PREFIX cmn: <http://purl.org/NET/classicalmusicnav#>
  PREFIX  foaf: <http://xmlns.com/foaf/0.1/>

  SELECT * WHERE {
    VALUES ?s {
      cmn:ADAM1 cmn:ADAM2 cmn:ALAI
    }
    ?s ?p ?o .
    OPTIONAL {
        ?o foaf:name ?otherName
    }
  }
  LIMIT 100
  `;

  const parsed = sparql(query);

  test("gets prefixes from query", () => {
    expect(Array.isArray(parsed.prefixes)).toBe(true)
    expect(parsed.prefixes[0].short).toBe('cmn');
    expect(parsed.prefixes[0].long).toBe('http://purl.org/NET/classicalmusicnav#');
    expect(parsed.prefixes[1].short).toBe('foaf');
    expect(parsed.prefixes[1].long).toBe('http://xmlns.com/foaf/0.1/');
  });

});