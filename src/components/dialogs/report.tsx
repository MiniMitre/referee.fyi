import { useEffect, useState } from "react";
import { Button } from "~components/Button";
import { ClickToCopy } from "~components/ClickToCopy";
import { Dialog, DialogBody, DialogHeader } from "~components/Dialog";
import { Input, Select, TextArea } from "~components/Input";
import { Spinner } from "~components/Spinner";
import { Error } from "~components/Warning";
import { ErrorReport } from "~utils/data/report";
import { useRecentEvents } from "~utils/hooks/history";
import { useReportIssue } from "~utils/hooks/report";
import { useCurrentEvent } from "~utils/hooks/state";

export type ReportIssueDialogProps = {
  open: boolean;
  setOpen: (value: boolean) => void;
  comment?: string;
  context?: string;
  error?: ErrorReport;
};

export const ReportIssueDialog: React.FC<ReportIssueDialogProps> = ({
  open,
  setOpen,
  comment: initComment,
  context,
  error: causedError,
}) => {
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState(initComment ?? "");

  const { data: currentEvent } = useCurrentEvent();
  const { data: recentEvents } = useRecentEvents();

  const [sku, setSKU] = useState<string | null>(currentEvent?.sku ?? null);

  const {
    mutate: reportIssue,
    data: response,
    error,
    isPending,
    isSuccess,
    isError,
    reset,
  } = useReportIssue(sku, {
    email,
    comment,
    context: context ?? "",
    error: causedError,
  });

  useEffect(() => {
    if (!open) {
      reset();
      setComment(initComment ?? "");
    }
  }, [reset, open, initComment]);

  return (
    <Dialog mode="modal" open={open} onClose={() => setOpen(false)}>
      <DialogHeader
        onClose={() => setOpen(false)}
        title="Report Issues with Referee FYI"
      />
      <DialogBody className="px-2">
        {causedError ? (
          <section className="mb-4">
            <Error message="Referee FYI encountered a fatal error!">
              {import.meta.env.DEV ? (
                <div className="mt-4">
                  <p className="font-mono text-sm">{`${causedError.error}`}</p>
                  <pre className="font-mono text-sm">{`${causedError.componentStack}`}</pre>
                </div>
              ) : null}
            </Error>
          </section>
        ) : null}
        <p>
          Please give a brief description of what went wrong. If you provide an
          email, we may reach out to clarify or to notify you of resolution.
          Information about your device and your session will be included with
          your report, including the contents of incidents.
        </p>
        <label>
          <h2 className="font-bold mt-4">Event</h2>
          <Select
            value={sku ?? ""}
            className="w-full"
            onChange={(e) => setSKU(e.currentTarget.value)}
          >
            <option value="">Pick An Event</option>
            {currentEvent &&
            recentEvents?.every((e) => e.sku !== currentEvent.sku) ? (
              <option value={currentEvent.sku}>{}</option>
            ) : null}
            {recentEvents?.map((event) => (
              <option value={event.sku} key={event.id}>
                {event.name} [{event.sku}]
              </option>
            ))}
          </Select>
        </label>
        <label>
          <h2 className="font-bold mt-4">Email</h2>
          <Input
            className="w-full mt-2"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
        </label>
        <label>
          <h2 className="font-bold mt-4">Comment</h2>
          <TextArea
            className="w-full mt-2"
            value={comment}
            onChange={(e) => setComment(e.currentTarget.value)}
          />
        </label>
        <Button mode="primary" className="mt-4" onClick={() => reportIssue()}>
          Report Issue
        </Button>
        <Spinner show={isPending} />
        {isSuccess ? (
          <section className="mt-4">
            <p className="mt-2">
              Your report has been successfully submitted. Please reference this
              Correlation ID when communicating with the developers about this
              issue.
            </p>
            <ClickToCopy
              className="mt-2"
              message={response?.correlation ?? ""}
            />
          </section>
        ) : null}
        {isError ? (
          <Error message={`Could Not Submit Report! ${error}`} />
        ) : null}
      </DialogBody>
    </Dialog>
  );
};
