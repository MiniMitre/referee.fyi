import { test, expect } from "vitest";
import { ConsistentMap, mergeMap } from "./map.js";
import { initLWW, updateLWW, WithLWWConsistency } from "./lww.js";

type BaseIncident = {
  id: string;
  event: string;
  team: string;
  note: string;
  rule: string;
};
const ignore = ["id", "event", "team"] as const;

type Incident = WithLWWConsistency<BaseIncident, typeof ignore>;

test("new local entries uploaded", () => {
  const local: ConsistentMap<BaseIncident, typeof ignore> = {
    deleted: [],
    values: {
      incident1: initLWW<BaseIncident, typeof ignore>({
        ignore,
        peer: "LOCAL",
        value: {
          id: "incident1",
          event: "RE-VRC-23-3690",
          team: "3796B",
          rule: "<SG11>",
          note: "Expansion",
        },
      }),
    },
  };

  const remote: ConsistentMap<Incident, typeof ignore> = {
    deleted: ["incident12"],
    values: {},
  };

  const result = mergeMap({ local, remote, ignore });
  expect(result.resolved.deleted).toEqual(["incident12"]);
  expect(result.resolved.values).toEqual(local.values);

  expect(result.local.deleted).toEqual(["incident12"]);
  expect(result.local.values).toEqual([]);

  expect(result.remote.deleted).toEqual([]);
  expect(result.remote.values).toEqual(["incident1"]);
});

test("new remote entries saved", () => {
  const local: ConsistentMap<Incident, typeof ignore> = {
    deleted: ["incident12"],
    values: {},
  };

  const remote: ConsistentMap<BaseIncident, typeof ignore> = {
    deleted: [],
    values: {
      incident1: initLWW<BaseIncident, typeof ignore>({
        ignore,
        peer: "LOCAL",
        value: {
          id: "incident1",
          event: "RE-VRC-23-3690",
          team: "3796B",
          rule: "<SG11>",
          note: "Expansion",
        },
      }),
    },
  };

  const result = mergeMap({ local, remote, ignore });
  expect(result.resolved.deleted).toEqual(["incident12"]);
  expect(result.resolved.values).toEqual(remote.values);

  expect(result.remote.deleted).toEqual(["incident12"]);
  expect(result.remote.values).toEqual([]);

  expect(result.local.deleted).toEqual([]);
  expect(result.local.values).toEqual(["incident1"]);
});

test("local update handled", () => {
  const local: ConsistentMap<BaseIncident, typeof ignore> = {
    deleted: ["incident12"],
    values: {
      incident1: initLWW<BaseIncident, typeof ignore>({
        ignore,
        peer: "REMOTE",
        value: {
          id: "incident1",
          event: "RE-VRC-23-3690",
          team: "3796B",
          rule: "<SG11>",
          note: "Expansion",
        },
      }),
    },
  };
  local.values["incident1"].note += "BMM EDIT";
  local.values["incident1"].consistency.note = {
    count: 1,
    peer: "LOCAL",
    history: [{ prev: "Expansion", peer: "REMOTE" }],
  };

  const remote: ConsistentMap<BaseIncident, typeof ignore> = {
    deleted: [],
    values: {
      incident1: initLWW<BaseIncident, typeof ignore>({
        ignore,
        peer: "REMOTE",
        value: {
          id: "incident1",
          event: "RE-VRC-23-3690",
          team: "3796B",
          rule: "<SG11>",
          note: "Expansion",
        },
      }),
    },
  };

  const result = mergeMap({ local, remote, ignore });
  console.log(result);
  expect(result.resolved.deleted).toEqual(["incident12"]);
  expect(result.resolved.values).toEqual(local.values);

  expect(result.remote.deleted).toEqual(["incident12"]);
  expect(result.remote.values).toEqual(["incident1"]);

  expect(result.local.deleted).toEqual([]);
  expect(result.local.values).toEqual([]);
});

test("remote update handled", () => {
  const local: ConsistentMap<BaseIncident, typeof ignore> = {
    deleted: ["incident12"],
    values: {
      incident1: initLWW<BaseIncident, typeof ignore>({
        ignore,
        peer: "REMOTE",
        value: {
          id: "incident1",
          event: "RE-VRC-23-3690",
          team: "3796B",
          rule: "<SG11>",
          note: "Expansion",
        },
      }),
    },
  };
  local.values["incident1"] = updateLWW(local.values["incident1"], {
    peer: "LOCAL",
    key: "note",
    value: local.values["incident1"].note + " BMM EDIT",
  });

  const remote: ConsistentMap<BaseIncident, typeof ignore> = {
    deleted: [],
    values: {
      incident1: initLWW<BaseIncident, typeof ignore>({
        ignore,
        peer: "REMOTE",
        value: {
          id: "incident1",
          event: "RE-VRC-23-3690",
          team: "3796B",
          rule: "<SG11>",
          note: "Expansion",
        },
      }),
    },
  };
  remote.values["incident1"] = updateLWW(remote.values["incident1"], {
    peer: "REMOTE",
    key: "rule",
    value: "<SG8>",
  });

  const result = mergeMap({ local, remote, ignore });
  expect(result.resolved.deleted).toEqual(["incident12"]);
  expect(result.resolved.values["incident1"]).toEqual({
    id: "incident1",
    event: "RE-VRC-23-3690",
    team: "3796B",
    rule: "<SG8>",
    note: "Expansion BMM EDIT",
    consistency: {
      rule: {
        count: 1,
        peer: "REMOTE",
        history: [{ prev: "<SG11>", peer: "REMOTE" }],
      },
      note: {
        count: 1,
        peer: "LOCAL",
        history: [{ prev: "Expansion", peer: "REMOTE" }],
      },
    },
  });

  expect(result.remote.deleted).toEqual(["incident12"]);
  expect(result.remote.values).toEqual(["incident1"]);

  expect(result.local.deleted).toEqual([]);
  expect(result.local.values).toEqual(["incident1"]);
});

test("deleted values merged", () => {
  const local: ConsistentMap<BaseIncident, typeof ignore> = {
    deleted: ["incident1", "incident2", "incident3"],
    values: {},
  };

  const remote: ConsistentMap<Incident, typeof ignore> = {
    deleted: ["incident3", "incident4", "incident5"],
    values: {},
  };

  const result = mergeMap({ local, remote, ignore });
  expect(result.resolved.deleted).toEqual([
    "incident1",
    "incident2",
    "incident3",
    "incident4",
    "incident5",
  ]);
  expect(result.resolved.values).toEqual({});

  expect(result.local.deleted).toEqual(["incident4", "incident5"]);
  expect(result.local.values).toEqual([]);

  expect(result.remote.deleted).toEqual(["incident1", "incident2"]);
  expect(result.remote.values).toEqual([]);
});
