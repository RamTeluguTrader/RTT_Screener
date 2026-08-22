import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { stocks } from "@/lib/market-data";
import {
  createAlert,
  describeAlert,
  formatValue,
  readFieldValue,
  FIELD_META,
  OPERATOR_LABEL,
  type AlertField,
  type AlertOperator,
} from "@/lib/alerts-store";
import { cn } from "@/lib/utils";

const fields = Object.keys(FIELD_META) as AlertField[];
const operators = Object.keys(OPERATOR_LABEL) as AlertOperator[];

function defaultValue(symbol: string, field: AlertField) {
  const stock = stocks.find((s) => s.symbol === symbol);
  if (!stock) return 0;
  const v = readFieldValue(stock, field);
  return field === "price" ? Math.round(v * 1.02 * 20) / 20 : Math.round(v);
}

export function CreateAlertDialog({
  symbol: initialSymbol,
  source = "manual",
  trigger,
}: {
  symbol?: string;
  source?: "watchlist" | "scanner" | "manual";
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState(initialSymbol ?? stocks[0]!.symbol);
  const [field, setField] = useState<AlertField>("price");
  const [operator, setOperator] = useState<AlertOperator>("crosses_above");
  const [value, setValue] = useState<string>(String(defaultValue(symbol, "price")));
  const [note, setNote] = useState("");
  const [channels, setChannels] = useState({ toast: true, feed: true });

  useEffect(() => {
    if (open) {
      const s = initialSymbol ?? stocks[0]!.symbol;
      setSymbol(s);
      setField("price");
      setOperator("crosses_above");
      setValue(String(defaultValue(s, "price")));
      setNote("");
      setChannels({ toast: true, feed: true });
    }
  }, [open, initialSymbol]);

  const stock = stocks.find((s) => s.symbol === symbol);
  const current = stock ? readFieldValue(stock, field) : 0;
  const numericValue = Number(value);
  const valid = symbol.length > 0 && Number.isFinite(numericValue) && (channels.toast || channels.feed);

  function submit() {
    if (!valid) return;
    const alert = createAlert({
      symbol,
      field,
      operator,
      value: numericValue,
      note: note.trim(),
      channels,
      source,
    });
    setOpen(false);
    toast.success(`Alert armed on ${symbol}`, { description: describeAlert(alert) });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium transition-colors hover:border-primary/40 hover:text-primary">
            <BellPlus className="h-3.5 w-3.5" />
            New alert
          </button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-lg border-border bg-popover">
        <DialogHeader>
          <DialogTitle className="text-base">Create alert</DialogTitle>
          <DialogDescription className="text-xs">
            Conditions are evaluated on every scanner refresh during market hours.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Instrument
              </span>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger className="num text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stocks.map((s) => (
                    <SelectItem key={s.symbol} value={s.symbol} className="num text-xs">
                      {s.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Condition
              </span>
              <Select
                value={field}
                onValueChange={(v) => {
                  const f = v as AlertField;
                  setField(f);
                  setValue(String(defaultValue(symbol, f)));
                }}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((f) => (
                    <SelectItem key={f} value={f} className="text-xs">
                      {FIELD_META[f].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Operator
              </span>
              <Select value={operator} onValueChange={(v) => setOperator(v as AlertOperator)}>
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operators.map((o) => (
                    <SelectItem key={o} value={o} className="text-xs">
                      {OPERATOR_LABEL[o]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Threshold value
              </span>
              <Input
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="num text-xs"
              />
            </label>
          </div>

          <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground">{FIELD_META[field].help}</p>
            <p className="num mt-1 text-xs">
              Current {FIELD_META[field].label.toLowerCase()}:{" "}
              <span className="font-semibold text-foreground">{formatValue(field, current)}</span>
            </p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Note (optional)
            </span>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={80}
              placeholder="Why this condition matters"
              className="text-xs"
            />
          </label>

          <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Delivery
            </p>
            {(
              [
                ["toast", "In-app toast", "Pop a notification the moment it fires"],
                ["feed", "Alert feed", "Log the trigger on the Alerts page"],
              ] as const
            ).map(([key, label, help]) => (
              <div key={key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium">{label}</p>
                  <p className="text-[11px] text-muted-foreground">{help}</p>
                </div>
                <Switch
                  checked={channels[key]}
                  onCheckedChange={(on) => setChannels((c) => ({ ...c, [key]: on }))}
                />
              </div>
            ))}
            {!channels.toast && !channels.feed && (
              <p className="text-[11px] text-bear">Pick at least one delivery channel.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={!valid}
            className={cn("bg-primary text-primary-foreground hover:bg-primary/90")}
          >
            Arm alert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
