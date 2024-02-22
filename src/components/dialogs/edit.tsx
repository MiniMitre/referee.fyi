import { useCallback, useMemo, useState } from "react";
import { MatchData } from "robotevents/out/endpoints/matches";
import { Button } from "~components/Button";
import { Dialog, DialogBody, DialogHeader } from "~components/Dialog";
import { Input, RulesMultiSelect, Select, TextArea } from "~components/Input";
import { toast } from "~components/Toast";
import { IncidentOutcome, IncidentWithID } from "~utils/data/incident";
import { useDeleteIncident, useEditIncident } from "~utils/hooks/incident";
import { useEventMatchesForTeam, useEventTeam } from "~utils/hooks/robotevents";
import { Rule, useRulesForProgram } from "~utils/hooks/rules";
import { useCurrentEvent } from "~utils/hooks/state";

export type EditIncidentDialogProps = {
  open: boolean;
  setOpen: (value: boolean) => void;
  incident: IncidentWithID;
};

export const EditIncidentDialog: React.FC<EditIncidentDialogProps> = ({
  open,
  setOpen,
  incident: initialIncident,
}) => {
  const [incident, setIncident] = useState(initialIncident);
  const { mutateAsync: deleteIncident } = useDeleteIncident();
  const { mutateAsync: editIncident } = useEditIncident();

  const mostRecentUser = useMemo(() => {
    if (!incident.revision) {
      return null;
    }

    switch (incident.revision.user.type) {
      case "client": {
        return incident.revision.user.name;
      }
      case "server": {
        return "System";
      }
    }
  }, [incident]);

  const { data: eventData } = useCurrentEvent();
  const teamData = useEventTeam(eventData, incident.team);
  const { data: teamMatches } = useEventMatchesForTeam(eventData, teamData);

  const teamMatchesByDivision = useMemo(() => {
    const divisions: Record<string, MatchData[]> = {};

    if (!teamMatches) {
      return [];
    }

    for (const match of teamMatches) {
      if (divisions[match.division.name]) {
        divisions[match.division.name].push(match);
      } else {
        divisions[match.division.name] = [match];
      }
    }

    return Object.entries(divisions);
  }, [teamMatches]);

  const game = useRulesForProgram(eventData?.program.code ?? "VRC");

  const onChangeIncidentMatch = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const [division, name] = e.target.value.split("@");
      const match = teamMatches?.find((match) => {
        return (
          match.division.id === Number.parseInt(division) && match.name === name
        );
      });
      setIncident((incident) => ({
        ...incident,
        division: Number.parseInt(division),
        match: match ? { id: match.id, name: match.name } : undefined,
      }));
    },
    [teamMatches]
  );

  const onChangeIncidentOutcome = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setIncident((incident) => ({
        ...incident,
        outcome: e.target.value as IncidentOutcome,
      }));
    },
    []
  );

  const initialRichRules = useMemo(() => {
    const gameRules = game?.ruleGroups.flatMap((group) => group.rules) ?? [];
    return incident.rules.map(
      (rule) => gameRules.find((r) => r.rule === rule)!
    );
  }, [game?.ruleGroups, incident.rules]);

  const [incidentRules, setIncidentRules] = useState(initialRichRules);

  const onChangeIncidentRules = useCallback((rules: Rule[]) => {
    setIncidentRules(rules);
    setIncident((incident) => ({
      ...incident,
      rules: rules.map((r) => r.rule),
    }));
  }, []);

  const onChangeIncidentNotes = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setIncident((incident) => ({ ...incident, notes: e.target.value }));
    },
    []
  );

  const onClickDelete = useCallback(async () => {
    setOpen(false);
    await deleteIncident(incident.id);
    toast({ type: "info", message: "Deleted Incident" });
  }, [deleteIncident, setOpen, incident.id]);

  const onClickSave = useCallback(async () => {
    setOpen(false);
    try {
      await editIncident(incident);
      toast({ type: "info", message: "Saved Incident" });
    } catch (e) {
      toast({ type: "error", message: `${e}` });
    }
  }, [incident, setOpen]);

  return (
    <Dialog mode="modal" onClose={() => setOpen(false)} open={open}>
      <DialogHeader onClose={() => setOpen(false)} title="Edit Incident" />
      <DialogBody>
        <label>
          <p className="mt-4">Team</p>
          <Input value={incident.team} readOnly className="w-full" />
        </label>
        <label>
          <p className="mt-4">Match</p>
          <Select
            className="w-full"
            onChange={onChangeIncidentMatch}
            value={
              incident.match
                ? incident.division + "@" + incident.match.name
                : undefined
            }
          >
            <option value={undefined}>Non-Match</option>
            {teamMatchesByDivision.map(([name, matches]) => {
              return (
                <optgroup key={name} label={name}>
                  {matches.map((match) => (
                    <option
                      key={match.id}
                      value={match.division.id + "@" + match.name}
                    >
                      {match.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </Select>
        </label>
        <label>
          <p className="mt-4">Outcome</p>
          <Select
            value={incident.outcome}
            onChange={onChangeIncidentOutcome}
            className="max-w-full w-full"
          >
            <option value="General">General</option>
            <option value="Minor">Minor</option>
            <option value="Major">Major</option>
            <option value="Disabled">Disabled</option>
          </Select>
        </label>
        {game ? (
          <label>
            <p className="mt-4">Associated Rules</p>
            <RulesMultiSelect
              game={game}
              value={incidentRules}
              onChange={onChangeIncidentRules}
            />
          </label>
        ) : null}
        <label>
          <p className="mt-4">Notes</p>
          <TextArea
            className="w-full mt-2 h-32"
            value={incident.notes}
            onChange={onChangeIncidentNotes}
          />
        </label>
        {incident.revision ? (
          <section className="p-2">
            <h3 className="font-bold">Revision History</h3>
            <p>Edit Count: {incident.revision.count}</p>
            <p>Last User: {mostRecentUser}</p>
          </section>
        ) : null}
      </DialogBody>
      <nav className="flex gap-4 p-2">
        <Button mode="dangerous" onClick={onClickDelete}>
          Delete Incident
        </Button>
        <Button mode="primary" onClick={onClickSave}>
          Save Incident
        </Button>
      </nav>
    </Dialog>
  );
};
