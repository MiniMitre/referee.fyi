import { get, getMany, set, setMany, update } from "~utils/data/keyval";
import {
  BaseMatchScratchpad,
  EditScratchpad,
  HighStakesMatchScratchpad,
  MatchScratchpad,
  RapidRelayMatchScratchpad,
  SupportedGame,
  UnchangeableProperties,
} from "~share/MatchScratchpad";
import { getSender } from "./share";
import { Change } from "~share/revision";
import { MatchData } from "robotevents/out/endpoints/matches";
import { WebSocketSender } from "~share/api";
import { seasons } from "robotevents";
import { useShareConnection } from "~models/ShareConnection";

export function getScratchpadID(match: MatchData) {
  return `scratchpad_${match.event.code}_${
    match.division.id
  }_${match.name.replace(/ /g, "")}`;
}

export async function getMatchScratchpad<T extends BaseMatchScratchpad>(
  id: string
): Promise<T | undefined> {
  const data = await get<T>(id);
  return data;
}

export async function getManyMatchScratchpads<T extends BaseMatchScratchpad>(
  ids: string[]
): Promise<Record<string, T>> {
  const values = await getMany<T>(ids);
  return Object.fromEntries(ids.map((id, i) => [id, values[i]!]));
}

export async function setMatchScratchpad<T extends BaseMatchScratchpad>(
  id: string,
  scratchpad: T
) {
  await update<Set<string>>(
    `scratchpad_${scratchpad.event}_idx`,
    (old) => old?.add(id) ?? new Set([id])
  );
  return set(id, scratchpad);
}

export async function getScratchpadIdsForEvent(sku: string) {
  const data = await get<Set<string>>(`scratchpad_${sku}_idx`);
  return data ?? new Set();
}

export async function setManyMatchScratchpad<T extends BaseMatchScratchpad>(
  entries: [id: string, scratchpad: T][]
) {
  return setMany(entries);
}

export async function editScratchpad<T extends MatchScratchpad>(
  id: string,
  scratchpad: EditScratchpad<T>
) {
  const current = await getMatchScratchpad<T>(id);

  if (!current) {
    return;
  }

  const changes: Change<MatchScratchpad, UnchangeableProperties>[] = [];
  for (const [key, currentValue] of Object.entries(scratchpad)) {
    if (["event", "match", "revision", "game"].includes(key)) continue;

    const newValue = current[key as keyof MatchScratchpad];

    if (JSON.stringify(currentValue) != JSON.stringify(newValue)) {
      changes.push({
        property: key,
        old: currentValue,
        new: newValue,
      } as Change<MatchScratchpad, UnchangeableProperties>);
    }
  }

  if (changes.length < 1) {
    return;
  }

  const user = await getSender();

  const revision = current.revision ?? {
    count: 0,
    user,
    history: [],
  };

  revision.count += 1;
  revision.history.push({
    user,
    date: new Date(),
    changes,
  });

  const value = {
    ...current,
    ...scratchpad,
    revision,
  };

  useShareConnection.getState().updateScratchpad(id, value);
  await setMatchScratchpad(id, value);
}

export function getGameForSeason(seasonId: number): SupportedGame | null {
  switch (seasonId) {
    case seasons.get("V5RC", "2024-2025")!: {
      return "High Stakes";
    }
    case seasons.get("V5RC", "2023-2024")!: {
      return "High Stakes";
    }
    case seasons.get("VURC", "2024-2025")!: {
      return "High Stakes";
    }
    case seasons.get("VAIRC", "2024-2025")!: {
      return "High Stakes";
    }
    case seasons.get("VIQRC", "2024-2025")!: {
      return "Rapid Relay";
    }
    default: {
      return null;
    }
  }
}

export function getDefaultScratchpad(
  match: MatchData,
  user: WebSocketSender,
  game: SupportedGame
): MatchScratchpad {
  const base: BaseMatchScratchpad = {
    event: match.event.code,
    match: {
      type: "match",
      division: match.division.id,
      name: match.name,
      id: match.id,
    },
    game,
    notes: "",
  };

  const revision = { count: 0, user, history: [] };

  switch (game) {
    case "High Stakes": {
      const data: HighStakesMatchScratchpad = {
        ...base,
        game,
        revision,
        awp: { red: false, blue: false },
        auto: "none",
      };
      return data;
    }
    case "Rapid Relay": {
      const data: RapidRelayMatchScratchpad = {
        ...base,
        game,
        revision,
      };
      return data;
    }
  }
}
