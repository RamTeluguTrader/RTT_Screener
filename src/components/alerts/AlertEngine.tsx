import { useEffect } from "react";
import { toast } from "sonner";
import { describeAlert, evaluateAlerts, formatValue, hydrateAlerts } from "@/lib/alerts-store";

/** Hydrates stored alerts and evaluates them against the live snapshot. */
export function AlertEngine() {
  useEffect(() => {
    hydrateAlerts();

    const run = () => {
      for (const alert of evaluateAlerts()) {
        if (!alert.channels.toast) continue;
        toast.success(`${alert.symbol} alert triggered`, {
          description: `${describeAlert(alert)} · now ${formatValue(
            alert.field,
            alert.triggeredValue ?? alert.value,
          )}`,
        });
      }
    };

    const first = window.setTimeout(run, 1200);
    const interval = window.setInterval(run, 20000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
