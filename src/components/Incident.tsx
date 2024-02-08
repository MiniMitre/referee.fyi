import { twMerge } from "tailwind-merge";
import { IncidentOutcome, IncidentWithID } from "~utils/data/incident";
import { IconButton } from "./Button";
import { EditIncidentDialog } from "./dialogs/edit";
import { useState } from "react";
import { PencilSquareIcon } from "@heroicons/react/20/solid";

const IncidentOutcomeClasses: { [O in IncidentOutcome]: string } = {
  Minor: "bg-yellow-400 text-yellow-900",
  Major: "bg-red-400 text-red-900",
  Disabled: "bg-yellow-400 text-yellow-900",
  General: "bg-zinc-300 text-zinc-900",
};

export type IncidentProps = {
  incident: IncidentWithID;
} & React.HTMLProps<HTMLDivElement>;

export const Incident: React.FC<IncidentProps> = ({ incident, ...props }) => {
  const [editIncidentOpen, setEditIncidentOpen] = useState(false);

  return (
    <>
      <EditIncidentDialog
        incident={incident}
        key={incident.revision?.count ?? -1}
        open={editIncidentOpen}
        setOpen={setEditIncidentOpen}
      />
      <div
        {...props}
        className={twMerge(
          IncidentOutcomeClasses[incident.outcome],
          "px-4 py-2 rounded-md mt-2 flex",
          props.className
        )}
      >
        <div className="flex-1">
          <p className="text-sm">
            {[
              incident.team,
              incident.match?.name ?? "Non-Match",
              incident.outcome,
            ].join(" • ")}
          </p>
          <p>{incident.notes}</p>
          <ul>
            {incident.rules.map((r) => (
              <li key={r} className="text-sm font-mono">
                {r}
              </li>
            ))}
          </ul>
        </div>
        <IconButton
          icon={<PencilSquareIcon height={20} />}
          className="bg-transparent text-black/75"
          onClick={() => setEditIncidentOpen(true)}
        />
      </div>
    </>
  );
};
