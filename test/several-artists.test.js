const fs = require("fs");
const MrSparql = require("../src/index");

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

const queryConfigSimple = {
  prefixes: ["cmno: http://purl.org/ontology/classicalmusicnav#"],
  groups: {
    composer: {
      properties: {
        color: "blue"
      }
    }
  },
  // TODO: better to simplify structure and separate literal vs parsed props
  nodes: {
    s: {
      label: {
        matches: {
          key: 'predicate',
          value: 'foaf:name'
        }
      },
      group: "composer"
    },
    o: {
      label: {
        matches: {
          key: "predicate",
          value: "foaf:name"
        }
      },
      group: "composer"
    }
  },
  // TODO: edges should probably mimic nodes in terms of structure (be a object with variable as key instead of an array)
  // May not be possible as we have 2 separate definitions for the same variable key
  edges: [
    {
      variable: "p",
      matches: ["cmno:influencedBy"],
      properties: {
        arrow: 'from'
      }
    },
    {
      variable: "p",
      matches: ["cmno:hasInfluenced"],
      properties: {
        arrow: 'to'
      }
    }
  ]
};

const queryConfig = {
  verbose: true,
  prefixes: [
    "cmno: http://purl.org/ontology/classicalmusicnav#",
    "cmn: http://purl.org/NET/classicalmusicnav#",
    "foaf: http://xmlns.com/foaf/0.1/"
  ],
  groups: {
    composer: {
      properties: {
        color: "blue"
      }
    }
  },
  nodes: [
    {
      variable: "s",
      group: "composer",
      properties: [
        {
          name: "label",
          variable: "o",
          condition: {
            variable: "p",
            equals: "foaf:name"
          }
        }
      ]
    },
    {
      variable: "o",
      group: "composer",
      condition: {
        prefix: "cmn"
      },
      properties: [
        {
          name: "label",
          variable: "otherName"
        }
      ]
    }
  ],
  edges: [
    {
      from: "s",
      to: "o",
      condition: {
        variable: "p",
        equals: "cmno:influencedBy"
      },
      properties: [
        {
          name: "arrow",
          value: "from"
        }
      ]
    },
    {
      from: "s",
      to: "o",
      condition: {
        variable: "p",
        equals: "cmno:hasInfluenced"
      },
      properties: [
        {
          name: "arrow",
          value: "to"
        }
      ]
    }
  ]
};

test("can parse query response, verbose config", () => {
  const raw = fs.readFileSync(
    __dirname + "/data/several-composers-other-name.json"
  );
  const queryResponse = JSON.parse(raw);
  const mrsparql = new MrSparql(queryConfig);
  const json = mrsparql.transform(queryResponse);
  expect(typeof json).toBe("object");
  expect(json).toHaveProperty("nodes");
  expect(json).toHaveProperty("edges");
  expect(json.edges.length).toBe(21);
  expect(json.nodes.length).toBe(18);
});

test("can parse query response, simple config", () => {
  const raw = fs.readFileSync(
    __dirname + "/data/several-composers-other-name.json"
  );
  const queryResponse = JSON.parse(raw);
  const mrsparql = new MrSparql(queryConfigSimple, query);
  const json = mrsparql.transform(queryResponse);
  expect(typeof json).toBe("object");
  expect(json).toHaveProperty("nodes");
  expect(json).toHaveProperty("edges");
  expect(json.edges.length).toBe(21);
  expect(json.nodes.length).toBe(18);
  const foundNode = json.nodes.find(
    node => node.id === "http://purl.org/NET/classicalmusicnav#SATI"
  );
  expect(foundNode.label).toBe("Erik Satie");
});

test("findRelationship: check if triple defines a relationship", () => {
  const row = {
    s: {
      type: "uri",
      value: "http://purl.org/NET/classicalmusicnav#ALAI"
    },
    p: {
      type: "uri",
      value: "http://purl.org/ontology/classicalmusicnav#hasInfluenced"
    },
    o: {
      type: "uri",
      value: "http://purl.org/NET/classicalmusicnav#TURI"
    },
    otherName: {
      type: "literal",
      value: "Joaqu&iacute;n Turina"
    }
  };
  const mrsparql = new MrSparql(queryConfigSimple, query);
  const triples = mrsparql.getProcessedTriples(row);
  expect(!!mrsparql.findRelationship(triples[0])).toBe(true);
  expect(!!mrsparql.findRelationship(triples[1])).toBe(false);
});

test("Processes triples correctly", () => {
  const row = {
    s: {
      type: "uri",
      value: "http://purl.org/NET/classicalmusicnav#ALAI"
    },
    p: {
      type: "uri",
      value: "http://purl.org/ontology/classicalmusicnav#hasInfluenced"
    },
    o: {
      type: "uri",
      value: "http://purl.org/NET/classicalmusicnav#TURI"
    },
    otherName: {
      type: "literal",
      value: "Joaqu&iacute;n Turina"
    }
  };
  const mrsparql = new MrSparql(queryConfigSimple, query);
  const triples = mrsparql.getProcessedTriples(row);
  triples.forEach(triple => {
    expect(triple).toEqual(
      expect.objectContaining({
        subject: expect.any(Object),
        predicate: expect.any(Object),
        object: expect.any(Object)
      })
    );
  });
  const relationshipTriple = triples[0];
  expect(relationshipTriple.subject.variable).toBe("s");
  expect(relationshipTriple.predicate.variable).toBe("p");
  expect(relationshipTriple.object.variable).toBe("o");
  expect(relationshipTriple.subject.part).toBe("?s");
  expect(relationshipTriple.predicate.part).toBe("?p");
  expect(relationshipTriple.object.part).toBe("?o");
  expect(relationshipTriple.subject.value).toBe(row.s.value);
  expect(relationshipTriple.predicate.value).toBe(row.p.value);
  expect(relationshipTriple.object.value).toBe(row.o.value);
  expect(relationshipTriple.subject.isVariable).toBe(true);
  expect(relationshipTriple.predicate.isVariable).toBe(true);
  expect(relationshipTriple.object.isVariable).toBe(true);
  const propertyTriple = triples[1];
  expect(propertyTriple.subject.variable).toBe("o");
  expect(propertyTriple.predicate.variable).toBe("foaf:name");
  expect(propertyTriple.object.variable).toBe("otherName");
  expect(propertyTriple.subject.part).toBe("?o");
  expect(propertyTriple.predicate.part).toBe("foaf:name");
  expect(propertyTriple.object.part).toBe("?otherName");
  expect(propertyTriple.subject.value).toBe(row.o.value);
  expect(propertyTriple.predicate.value).toBe("foaf:name");
  expect(propertyTriple.object.value).toBe(row.otherName.value);
  expect(propertyTriple.subject.isVariable).toBe(true);
  expect(propertyTriple.predicate.isVariable).toBe(false);
  expect(propertyTriple.object.isVariable).toBe(true);
});

test("simple and verbose setups both produce the same end result JSON", () => {
  const raw = fs.readFileSync(
    __dirname + "/data/several-composers-other-name.json"
  );
  const queryResponse = JSON.parse(raw);
  const mrsparqlVerbose = new MrSparql(queryConfig);
  const jsonFromVerbose = mrsparqlVerbose.transform(queryResponse);
  const mrsparqlSimple = new MrSparql(queryConfigSimple, query);
  const jsonFromSimple = mrsparqlSimple.transform(queryResponse);
  // verbose mode does not add extra found properties yet and maybe hard to implement
  // TODO: revisit if this difference between simple and verbose is ok or not
  jsonFromSimple.nodes.forEach(node => {
    delete node.properties;
  });
  expect(jsonFromVerbose).toStrictEqual(jsonFromSimple);
});
