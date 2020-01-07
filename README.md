# MrSparql

MrSparql is a JavaScript library to parse standard SPARQL JSON responses into a simpler JSON format which can be used directly by graph visualisation software (such as Vis.js, KeyLines, D3, Linkurious etc.). MrSparql is isomorphic, so can be run both in node.js and in the web browser.

To use MrSparql, you can write any SPARQL query against your endpoint which returns some data that could be represented as nodes and edges (i.e. not just a single column result). You then write a JSON config to define which fields from the SPARQL response should become nodes, edges and properties. MrSparql contains code to handle edge bundling strategies, conditional configuration and qualifying SPARQL prefixes.

See [this test file](./test/several-artists.test.js) for an example of the JSON configuration you can write with MrSparql.

In your JavaScript, you can use MrSparql as follows:

```javascript
// use a JSON config for MrSparql
const mrsparql = new MrSparql(queryConfig);
// transform JSON where queryResponse is a standard SPARQL JSON response
const json = mrsparql.transform(queryResponse);
```