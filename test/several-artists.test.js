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
      arrow: "from"
    },
    {
      from: "s",
      to: "o",
      condition: {
        variable: "p",
        equals: "cmno:hasInfluenced"
      },
      arrow: "to"
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
});
