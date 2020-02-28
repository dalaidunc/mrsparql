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
  prefixes: [
    "cmno: http://purl.org/ontology/classicalmusicnav#"
  ],
  nodes: {
    's': {
      label: 'foaf:name',
      group: 'composer'
    },
    'o': {
      label: 'foaf:name',
      group: 'composer'
    }
  },
  edges: [{
    variable: 'p',
    matches: ['cmno:influencedBy', 'cmno:hasInfluenced']
  }]
}

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
  expect(typeof json).toBe('object');
  expect(json).toHaveProperty('nodes');
  expect(json).toHaveProperty('edges');
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
  expect(typeof json).toBe('object');
  expect(json).toHaveProperty('nodes');
  expect(json).toHaveProperty('edges');
  expect(json.edges.length).toBe(21);
  expect(json.nodes.length).toBe(18);
})
