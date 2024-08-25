import { Match, MatchData } from "robotevents";
import { useEvent } from "~utils/hooks/robotevents";
import { twMerge } from "tailwind-merge";
import { IdInfo } from "robotevents";
import { useMemo } from "react";

export type AllianceListProps = {
  teams: IdInfo[];
  color: "red" | "blue";
  reverse?: boolean;
  score?: number;
} & React.HTMLProps<HTMLDivElement>;

export const AllianceList: React.FC<AllianceListProps> = ({
  teams,
  reverse,
  color,
  score,
  ...props
}) => {
  const colorClass = color === "red" ? "bg-red-400" : "bg-blue-400";

  return (
    <div
      {...props}
      className={twMerge(
        "flex items-center justify-between w-28 px-1 rounded-md",
        reverse ? "flex-row-reverse" : "",
        colorClass,
        props.className
      )}
    >
      <ul className={twMerge("rounded-md font-mono w-16 h-12")}>
        {teams.map((team) => (
          <li key={team.id} className={reverse ? "text-right" : "text-left"}>
            {team.name}
          </li>
        ))}
      </ul>
      <p className={twMerge("font-mono text-xl")}>{score}</p>
    </div>
  );
};

export type MatchContextProps = {
  match: MatchData;
  allianceClassName?: string;
} & React.HTMLProps<HTMLDivElement>;

export const MatchContext: React.FC<MatchContextProps> = ({
  match: matchData,
  allianceClassName,
  ...props
}) => {
  const match = useMemo(() => new Match(matchData), [matchData]);
  const { data: event } = useEvent(match.event.code);

  if (!event) return null;

  if (event.program.code === "VIQRC") {
    const teams = match.alliances
      .map((a) => a.teams)
      .flat()
      .map((t) => t.team!);

    return (
      <div {...props}>
        <AllianceList
          teams={teams}
          color="blue"
          score={match.alliances[0].score}
          className={allianceClassName}
        />
      </div>
    );
  }

  const red = match.alliance("red");
  const blue = match.alliance("blue");

  return (
    <div {...props} className={twMerge("flex gap-2", props.className)}>
      <AllianceList
        teams={red.teams.map((t) => t.team!)}
        color="red"
        className={allianceClassName}
        score={red.score}
      />
      <AllianceList
        teams={blue.teams.map((t) => t.team!)}
        color="blue"
        reverse
        className={allianceClassName}
        score={blue.score}
      />
    </div>
  );
};
