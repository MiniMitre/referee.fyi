import { KeyArray } from "~types";
import { mergeLWW, WithLWWConsistency } from "./lww.js";
import { mergeGrowSet } from "./gset.js";

// July 2024 - Samsung Internet does not support Set.prototype.intersection or Set.prototype.difference
import "core-js/actual/set";

export type HasId = { id: string };
export type ConsistentMapElement<
  T extends HasId,
  U extends KeyArray<T>,
> = WithLWWConsistency<T, U>;

export type ConsistentMap<T extends HasId, U extends KeyArray<T>> = {
  deleted: string[];
  values: Record<string, ConsistentMapElement<T, U>>;
};

export type ConsistentMapMergeOptions<
  T extends HasId,
  U extends KeyArray<T>,
> = {
  local: ConsistentMap<T, U>;
  remote: ConsistentMap<T, U>;
  ignore: U;
};

export type ConsistentMapMergeResult<T extends HasId, U extends KeyArray<T>> = {
  // Resolved state of the map
  resolved: ConsistentMap<T, U>;

  // Values to save
  local: {
    // Should delete all of these locally
    deleted: string[];

    // Should set all of these locally to the resolved value
    values: string[];
  };

  // Values to notify opposing client
  remote: {
    // Should notify remote that all of these should be deleted
    deleted: string[];

    // Should notify remote of the resolved value for each of these
    values: string[];
  };
};

export function mergeMap<T extends HasId, const U extends KeyArray<T>>({
  local,
  remote,
  ignore,
}: ConsistentMapMergeOptions<T, U>): ConsistentMapMergeResult<T, U> {
  const localIds = new Set(Object.keys(local.values));
  const remoteIds = new Set(Object.keys(remote.values));

  const localOnlyIds = localIds.difference(remoteIds);
  const remoteOnlyIds = remoteIds.difference(localIds);

  const sharedIds = [...localIds.intersection(remoteIds)];
  const mergeResults = sharedIds.map((id) =>
    mergeLWW({ ignore, local: local.values[id], remote: remote.values[id] })
  );

  // Notify remote about results where we reject remote for being outdated (not just ties)
  const notifyRemote = mergeResults.filter(
    (result) => result.rejected.length > 0
  );

  // Values we need to update locally
  const updateLocal = mergeResults.filter(
    (result) => result.changed.length > 0
  );

  // Deleted Set
  const deleted = mergeGrowSet({
    local: local.deleted,
    remote: remote.deleted,
  });

  // Build resolved values
  const localOnlyValues = Object.fromEntries(
    [...localOnlyIds].map((id) => [id, local.values[id]])
  );
  const remoteOnlyValues = Object.fromEntries(
    [...remoteOnlyIds].map((id) => [id, remote.values[id]])
  );
  const sharedValues = Object.fromEntries(
    mergeResults.map((result) => [result.resolved!.id, result.resolved!])
  );

  return {
    resolved: {
      deleted: deleted.resolved,
      values: { ...localOnlyValues, ...remoteOnlyValues, ...sharedValues },
    },
    local: {
      values: [
        ...remoteOnlyIds,
        ...updateLocal.map((result) => result.resolved!.id),
      ],
      deleted: deleted.remoteOnly,
    },
    remote: {
      values: [
        ...localOnlyIds,
        ...notifyRemote.map((result) => result.resolved!.id),
      ],
      deleted: deleted.localOnly,
    },
  };
}
