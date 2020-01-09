const fs = require("fs");
const MrSparql = require("../src/index");

const queryConfig = {
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

test("can parse query response", () => {
  const raw = fs.readFileSync(
    __dirname + "/data/several-composers-other-name.json"
  );
  const queryResponse = JSON.parse(raw);
  const mrsparql = new MrSparql(queryConfig);
  const json = mrsparql.transform(queryResponse);
  expect(typeof json).toBe('object');
  expect(json).toHaveProperty('nodes');
  expect(json).toHaveProperty('edges');
});
