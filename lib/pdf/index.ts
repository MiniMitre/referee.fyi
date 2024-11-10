import { CellConfig, jsPDF } from "jspdf";
import { Incident, IncidentMatch, User } from "@referee-fyi/share";
import { RobotEventsClient } from "robotevents";

export type GenerateIncidentReportPDFOptions = {
  sku: string;
  users: User[];
  client: RobotEventsClient;
  incidents: Incident[];
};

type IncidentRow = {
  team: string;
  match: string;
  rule: string;
  contact: string;
  notes: string;
};

export function teamComparison(a: string, b: string): number {
  const baseA = a.slice(0, -1);
  const baseB = b.slice(0, -1);

  if (baseA !== baseB) {
    const numA = parseInt(baseA);
    const numB = parseInt(baseB);

    if (isNaN(numA) || isNaN(numB)) {
      return baseA.localeCompare(baseB);
    }

    if (numA < numB) {
      return -1;
    } else if (numA > numB) {
      return 1;
    }
  }

  const letterA = a.slice(-1);
  const letterB = b.slice(-1);

  if (letterA !== letterB) {
    return letterA.localeCompare(letterB);
  }

  return 0;
}

// The proper thing to do would be to fetch the actual round information from robotevents and compare them, but this is a good enough approximation for now.
const matchNameOrder = [
  "Practice",
  "Qualifier",
  "R16",
  "QF",
  "SF",
  "F",
  "Match",
];

export function matchComparison(
  a: IncidentMatch | undefined,
  b: IncidentMatch | undefined
) {
  if (!a && !b) {
    return 0;
  }

  if (!a) {
    return -1;
  }

  if (!b) {
    return 1;
  }

  if (a.type === "skills" && b.type === "skills") {
    return `${a.skillsType}${a.attempt}`.localeCompare(
      `${b.skillsType}${b.attempt}`
    );
  }

  if (a.type === "match" && b.type === "skills") {
    return -1;
  }

  if (a.type === "skills" && b.type === "match") {
    return 1;
  }

  if (a.type === "match" && b.type === "match") {
    if (a.division !== b.division) {
      return a.division - b.division;
    }

    const roundA = matchNameOrder.findIndex((name) => a.name.includes(name));
    const roundB = matchNameOrder.findIndex((name) => b.name.includes(name));

    if (roundA !== roundB) {
      return roundA - roundB;
    }

    const instanceA = parseInt(a.name.match(/\d+$/)?.[0] ?? "0");
    const instanceB = parseInt(b.name.match(/\d+$/)?.[0] ?? "0");

    if (instanceA !== instanceB) {
      return instanceA - instanceB;
    }

    return a.name.localeCompare(b.name);
  }

  return 0;
}

export function incidentComparison(a: Incident, b: Incident): number {
  const teamComparisonResult = teamComparison(a.team, b.team);
  if (teamComparisonResult !== 0) {
    return teamComparisonResult;
  }

  const matchComparisonResult = matchComparison(a.match, b.match);
  if (matchComparisonResult !== 0) {
    return matchComparisonResult;
  }

  return (
    new Date(a.consistency.outcome.instant).getTime() -
    new Date(b.consistency.outcome.instant).getTime()
  );
}

export async function generateIncidentReportPDF({
  sku,
  users,
  client,
  incidents,
}: GenerateIncidentReportPDFOptions): Promise<ArrayBuffer | null> {
  const event = await client.events.getBySKU(sku);
  if (!event.data) {
    return null;
  }

  const document = new jsPDF({
    unit: "px",
    orientation: "portrait",
    compress: true,
    format: "letter",
  });

  // Header
  document.setFont("helvetica", "bold");
  document.setFontSize(18);
  document.text("Referee Match Anomaly Log", 16, 16);

  document.setFont("helvetica", "italic");
  document.setFontSize(12);
  document.text(event.data.name, 16, 30);

  document.setFont("helvetica", "normal");
  document.setFontSize(12);
  document.text(
    `This anomaly log was generated by Referee FYI at ${new Date().toLocaleString()}.`,
    16,
    44
  );

  const data: IncidentRow[] = [];

  const incidentsInOrder = incidents.sort(incidentComparison);

  for (const incident of incidentsInOrder) {
    const contact = users.find(
      (user) => user.key === incident.consistency.outcome.peer
    );

    data.push({
      team: incident.team,
      match: incident.match?.type === "match" ? incident.match.name : "Skills",
      rule: incident.outcome + " " + incident.rules.join(", "),
      contact: contact?.name ?? "",
      notes: incident.notes,
    });
  }

  const headers: CellConfig[] = [
    {
      name: "team",
      prompt: "Team",
      align: "left",
      width: 60,
      padding: 2,
    },
    {
      name: "match",
      prompt: "Match",
      align: "left",
      width: 90,
      padding: 2,
    },
    {
      name: "rule",
      prompt: "Rule",
      align: "left",
      width: 120,
      padding: 2,
    },
    {
      name: "contact",
      prompt: "Contact",
      align: "left",
      width: 120,
      padding: 2,
    },
    {
      name: "notes",
      prompt: "Notes",
      align: "left",
      width: 180,
      padding: 2,
    },
  ];
  document.table(16, 56, data, headers, {
    autoSize: false,
  });

  return document.output("arraybuffer");
}
