const EdgeManager = require("../src/edge-manager");

function createBundlingStrategy(type, count = true) {
  return {
    bundlingStrategy: {
      type,
      count
    }
  };
}

test("will get next ID correctly (unidirectional)", () => {
  const strategy = createBundlingStrategy("unidirectional");
  const em = new EdgeManager(strategy);
  const ids = ["1-2", "2-1", "3-1"];
  ids.forEach(id => {
    em.addEdge({ id });
  });
  const nextId = em.nextId(ids[0]);
  expect(nextId).toBe(ids[0]);
  // use already saved ID for unidirectional
  expect(em.nextId(ids[1])).toBe(ids[0]);
  expect(em.nextId("newId")).toBe("newId");
});

test("will get next ID correctly (allow)", () => {
  const em = new EdgeManager(createBundlingStrategy("allow"));
  const ids = ["1-2", "2-1", "3-1"];
  ids.forEach(id => {
    em.addEdge({ id });
  });
  expect(em.nextId(ids[0])).toBe("1-2-2");
  expect(em.nextId(ids[1])).toBe("2-1-2");
  expect(em.nextId("newId")).toBe("newId-1");
});

test("will get next ID correctly (bidirectional)", () => {
  const em = new EdgeManager(createBundlingStrategy("bidirectional"));
  const ids = ["1-2", "2-1", "3-1"];
  ids.forEach(id => {
    em.addEdge({ id });
  });
  expect(em.nextId(ids[0])).toBe(ids[0]);
  expect(em.nextId(ids[1])).toBe(ids[1]);
  expect(em.nextId("newId")).toBe("newId");
});

describe("adding edges", () => {
  function createEdges(type) {
    const em = new EdgeManager(createBundlingStrategy(type));
    const ids = ["1-2", "1-2", "2-1", "3-1"];
    ids.forEach(id => {
      em.addEdge({ id });
    });
    return em.getEdges();
  }
  test("unidirectional", () => {
    const edges = createEdges("unidirectional");
    expect(edges.length).toBe(2);
  });
  test("bidirectional", () => {
    const edges = createEdges("bidirectional");
    expect(edges.length).toBe(3);
  });
  test("allow", () => {
    const edges = createEdges("allow");
    expect(edges.length).toBe(4);
  });
});
