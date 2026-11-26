import { z } from "zod";
export const periodDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value &&
      !value.startsWith("0000")
    );
  }, "Invalid calendar date");
export function currentIstPeriod() {
  const month = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(new Date());
  const y = Number(month.find((p) => p.type === "year")!.value);
  const m = Number(month.find((p) => p.type === "month")!.value);
  return {
    periodFrom: `${y}-${String(m).padStart(2, "0")}-01`,
    periodTo: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  };
}
