import { Link } from "react-router-dom";
import { useEventMatches, useEventTeams } from "../../utils/hooks/robotevents";
import { Spinner } from "../../components/Spinner";
import { Match } from "robotevents/out/endpoints/matches";

import { Tabs } from "../../components/Tabs";
import { Event } from "robotevents/out/endpoints/events";
import { LinkButton } from "../../components/Button";
import { ExclamationTriangleIcon, FlagIcon } from "@heroicons/react/20/solid";
import { MatchContext } from "../../components/Context";
import { useCurrentDivision, useCurrentEvent } from "../../utils/hooks/state";
import { useEventIncidents } from "../../utils/hooks/incident";
import { useMemo } from "react";
import { IncidentOutcome } from "../../utils/data/incident";

export type MainTabProps = {
  event: Event;
};

const EventTeamsTab: React.FC<MainTabProps> = ({ event }) => {
  const { data: teams, isLoading } = useEventTeams(event);

  const { data: incidents } = useEventIncidents(event.sku);

  const majorIncidents = useMemo(() => {
    if (!incidents) return new Map<string, number>();

    const grouped = new Map<string, number>();

    for (const incident of incidents) {
      if (incident.outcome !== IncidentOutcome.Major) continue;
      const key = incident.team ?? "<none>";
      const count = grouped.get(key) ?? 0;
      grouped.set(key, count + 1);
    }

    return grouped;
  }, [incidents]);

  const minorIncidents = useMemo(() => {
    if (!incidents) return new Map<string, number>();

    const grouped = new Map<string, number>();

    for (const incident of incidents) {
      if (incident.outcome === IncidentOutcome.Major) continue;
      const key = incident.team ?? "<none>";
      const count = grouped.get(key) ?? 0;
      grouped.set(key, count + 1);
    }

    return grouped;
  }, [incidents]);

  return (
    <section className="flex-1 flex flex-col gap-4">
      <Spinner show={isLoading} />
      <ul className="flex-1 overflow-y-auto">
        {teams?.map((team) => (
          <li key={team.number}>
            <Link
              to={`/${event.sku}/team/${team.number}`}
              className="flex items-center gap-4 mt-4 h-12 text-zinc-50"
            >
              <div className="flex-1">
                <p className="text-emerald-400 font-mono">{team.number}</p>
                <p>{team.team_name}</p>
              </div>
              <p className="h-full w-32 px-2 flex items-center">
                <span className="text-red-400 mr-4">
                  <FlagIcon height={24} className="inline" />
                  <span className="font-mono ml-2">
                    {majorIncidents.get(team.number) ?? 0}
                  </span>
                </span>
                <span className="text-yellow-400">
                  <ExclamationTriangleIcon height={24} className="inline" />
                  <span className="font-mono ml-2">
                    {minorIncidents.get(team.number) ?? 0}
                  </span>
                </span>
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "numeric",
});

const EventMatchesTab: React.FC<MainTabProps> = ({ event }) => {
  const division = useCurrentDivision();
  const { data: matches, isLoading } = useEventMatches(event, division);

  function matchTime(match: Match) {
    if (match.started) {
      return dateFormatter.format(new Date(match.started));
    }

    return dateFormatter.format(new Date(match.scheduled));
  }

  return (
    <section className="flex-1 flex flex-col gap-4">
      <Spinner show={isLoading} />
      <ul className="flex-1 overflow-y-auto">
        {matches?.map((match) => (
          <li
            key={match.id}
            className="flex items-center gap-4 mt-4 h-12 text-zinc-50"
          >
            <div className="flex-1">
              <p>{match.name}</p>
              <p className="text-sm italic">{matchTime(match)}</p>
            </div>
            <MatchContext match={match} />
          </li>
        ))}
      </ul>
    </section>
  );
};

export type EventPageParams = {
  sku: string;
};

export const EventPage: React.FC = () => {
  const { data: event } = useCurrentEvent();
  const division = useCurrentDivision();

  return event ? (
    <section className="mt-4">
      <LinkButton
        to={`/${event.sku}/${division}/new`}
        className="w-full text-center bg-emerald-600"
      >
        <FlagIcon height={20} className="inline mr-2 " />
        New Entry
      </LinkButton>
      <Tabs className="mt-4">
        {{
          Teams: <EventTeamsTab event={event} />,
          Matches: <EventMatchesTab event={event} />,
        }}
      </Tabs>
    </section>
  ) : null;
};
