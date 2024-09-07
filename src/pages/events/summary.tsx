import { useCallback, useEffect, useMemo, useState } from "react";
import { Spinner } from "~components/Spinner";
import { useAddEventVisited } from "~utils/hooks/history";
import { useCurrentEvent } from "~utils/hooks/state";
import { Button, IconButton } from "~components/Button";
import {
  AdjustmentsHorizontalIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { useEventIncidents } from "~utils/hooks/incident";
import { Incident } from "~components/Incident";
import { Rule, useRulesForEvent } from "~utils/hooks/rules";
import { Dialog, DialogBody } from "~components/Dialog";
import { XMarkIcon } from "@heroicons/react/20/solid";
import { Checkbox, RulesMultiSelect, Select } from "~components/Input";
import { twMerge } from "tailwind-merge";
import { useMutation } from "@tanstack/react-query";
import { ReadyState, useShareConnection } from "~models/ShareConnection";
import { useShareProfile } from "~utils/hooks/share";
import { IncidentOutcome } from "@referee-fyi/share";
import { VirtualizedList } from "~components/VirtualizedList";

export type Filters = {
  outcomes: Record<IncidentOutcome, boolean>;
  rules: Rule[];
  division?: number;
};

const DEFAULT_FILTERS: Filters = {
  outcomes: { Disabled: true, General: true, Major: true, Minor: true },
  rules: [],
};

const OUTCOMES: IncidentOutcome[] = ["General", "Minor", "Major", "Disabled"];

type FilterDialogProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
  apply: (filters: Filters) => void;
};

const FilterDialog: React.FC<FilterDialogProps> = ({
  open,
  setOpen,
  apply,
}) => {
  const { data: event } = useCurrentEvent();
  const divisions = useMemo(() => event?.divisions ?? [], [event]);
  const game = useRulesForEvent(event);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const setFiltersField = useCallback(
    <T extends keyof Filters>(key: T, value: Filters[T]) => {
      setFilters((filters) => ({ ...filters, [key]: value }));
    },
    []
  );

  const onClickApply = useCallback(() => {
    setOpen(false);
    apply(filters);
  }, [apply, setOpen, filters]);

  if (!game) {
    return null;
  }

  return (
    <Dialog
      mode="modal"
      open={open}
      onClose={() => setOpen(false)}
      className="p-4"
    >
      <DialogBody>
        <nav className="w-full flex pt-1 gap-2">
          <IconButton
            className="bg-transparent"
            onClick={() => setOpen(false)}
            icon={<XMarkIcon height={24} />}
          />
        </nav>
        <label>
          <p className="mt-4">Include Rules</p>
          <RulesMultiSelect
            game={game}
            value={filters.rules}
            onChange={(rules) => setFiltersField("rules", rules)}
          />
        </label>
        <p>Outcomes</p>
        {OUTCOMES.map((outcome) => (
          <Checkbox
            key={outcome}
            label={outcome}
            checked={filters.outcomes[outcome]}
            onChange={(e) =>
              setFiltersField("outcomes", {
                ...filters.outcomes,
                [outcome]: e.currentTarget.checked,
              })
            }
          />
        ))}
        {divisions.length > 0 ? (
          <label>
            <p className="mt-4">Division</p>
            <Select
              value={filters.division}
              onChange={(e) =>
                setFiltersField(
                  "division",
                  isNaN(Number.parseInt(e.currentTarget.value))
                    ? undefined
                    : Number.parseInt(e.currentTarget.value)
                )
              }
              className="w-full"
            >
              <option value={undefined}>Pick Division</option>
              {divisions
                .sort((a, b) => a.order! - b.order!)
                .map((div) => (
                  <option value={div.id} key={div.id}>
                    {div.name}
                  </option>
                ))}
            </Select>
          </label>
        ) : null}
      </DialogBody>
      <Button mode="primary" onClick={onClickApply}>
        Apply
      </Button>
    </Dialog>
  );
};

export const ForceSyncButton: React.FC = () => {
  const connection = useShareConnection(["readyState", "forceSync"]);
  const isConnected = connection.readyState === ReadyState.Open;

  const { mutateAsync: forceSync, isPending: isForceSyncPending } = useMutation(
    {
      mutationFn: connection.forceSync,
    }
  );

  if (!isConnected) {
    return null;
  }

  return (
    <IconButton
      className={twMerge(
        "bg-transparent",
        isForceSyncPending ? "animate-spin" : "animate-none"
      )}
      onClick={() => forceSync()}
      icon={<ArrowPathIcon height={24} />}
    />
  );
};

export const ExportButton: React.FC = () => {
  const { name, key } = useShareProfile();

  const { data: event } = useCurrentEvent();
  const { data: incidents, isLoading } = useEventIncidents(event?.sku);

  const onClick = useCallback(() => {
    const sku = event?.sku ?? "";
    const timestamp = new Date().toISOString();

    const data = JSON.stringify(
      {
        meta: {
          version: __REFEREE_FYI_VERSION__,
          sku,
          timestamp,
          user: { name, key },
        },
        incidents,
      },
      null,
      4
    );

    const blob = new Blob([data], { type: "text/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", `incidents-${sku}-${timestamp}.json`);
    a.click();
  }, [event?.sku, incidents, key, name]);

  return !isLoading ? (
    <IconButton
      className={twMerge("bg-transparent")}
      onClick={onClick}
      icon={<ArrowDownTrayIcon height={24} />}
    />
  ) : null;
};

export const EventSummaryPage: React.FC = () => {
  const { data: event } = useCurrentEvent();
  const game = useRulesForEvent(event);
  const { mutateAsync: addEvent, isSuccess } = useAddEventVisited();

  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const { data: allIncidents } = useEventIncidents(event?.sku);

  const incidents = useMemo(() => {
    const results = allIncidents?.filter((incident) => {
      if (!filters.outcomes[incident.outcome]) {
        return false;
      }

      const hasRule =
        filters.rules.length < 1 ||
        filters.rules.some((rule) => incident.rules.includes(rule.rule));
      if (!hasRule) {
        return false;
      }

      if (typeof filters.division !== "number") {
        return true;
      }

      // Division Filter
      if (!incident.match) {
        return false;
      }

      if (incident.match.type !== "match") {
        return false;
      }

      return incident.match.division === filters.division;
    });

    return results ?? [];
  }, [allIncidents, filters]);

  const commonRules = useMemo(() => {
    if (!incidents) {
      return [];
    }

    const ruleCounts: Record<string, number> = {};
    for (const { rules } of incidents) {
      for (const rule of rules) {
        if (ruleCounts[rule]) {
          ruleCounts[rule]++;
        } else {
          ruleCounts[rule] = 1;
        }
      }
    }

    return Object.entries(ruleCounts).sort((a, b) => b[1] - a[1]);
  }, [incidents]);

  useEffect(() => {
    if (event && !isSuccess) {
      addEvent(event);
    }
  }, [event, isSuccess, addEvent]);

  if (!event || !game) {
    return <Spinner show />;
  }

  return (
    <>
      <FilterDialog
        open={filterDialogOpen}
        setOpen={setFilterDialogOpen}
        apply={(filters) => setFilters(filters)}
      />
      <section className="mt-4 flex flex-col max-h-full">
        <nav className="flex gap-4 p-2 rounded-md">
          <p className="flex-1">{incidents?.length} Incidents</p>
          <ForceSyncButton />
          <ExportButton />
          <IconButton
            className="bg-transparent"
            onClick={() => setFilterDialogOpen(true)}
            icon={<AdjustmentsHorizontalIcon height={24} />}
          />
        </nav>
        <section className="flex gap-1 flex-wrap">
          {commonRules.slice(0, 5).map(([rule, count]) => (
            <p
              className="font-mono bg-emerald-900 rounded-lg px-2 py-1 text-sm text-center"
              key={rule}
            >
              {rule.replace(/[<>]/g, "")}{" "}
              <span className="text-emerald-400">{count}</span>
            </p>
          ))}
        </section>
        <VirtualizedList
          data={incidents}
          options={{ estimateSize: () => 64 }}
          className="flex-1 mt-4"
        >
          {(incident) => (
            <Incident
              incident={incident}
              key={incident.id}
              className="h-14 overflow-hidden"
            />
          )}
        </VirtualizedList>
      </section>
    </>
  );
};

export default EventSummaryPage;
