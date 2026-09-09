"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import PageHeader from "@/components/dashboard/PageHeader";
import { GeneratedKey, TopupTx } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function buildGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  // Monday-first offset
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { day: number; current: boolean }[] = [];
  for (let i = offset; i > 0; i--) cells.push({ day: daysInPrevMonth - i + 1, current: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, current: true });
  let nextMonthDay = 1;
  while (cells.length % 7 !== 0) cells.push({ day: nextMonthDay++, current: false });
  return cells;
}

export default function CalendarView({
  activityDays,
  keyHistory,
  topupHistory,
}: {
  activityDays: number[];
  keyHistory: GeneratedKey[];
  topupHistory: TopupTx[];
}) {
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selectedDay, setSelectedDay] = useState(today.getDate());

  const cells = useMemo(() => buildGrid(cursor.y, cursor.m), [cursor]);
  const isCurrentMonth = cursor.y === today.getFullYear() && cursor.m === today.getMonth();

  const dayActivities = useMemo(() => {
    if (!isCurrentMonth) return [];
    const keyActs = keyHistory
      .filter((k) => new Date(k.createdAt).getDate() === selectedDay)
      .map((k) => ({ id: k.id, label: `${k.productName} · ${k.duration}`, time: formatDateTime(k.createdAt) }));
    const topupActs = topupHistory
      .filter((t) => new Date(t.createdAt).getDate() === selectedDay)
      .map((t) => ({ id: t.id, label: `Top up Rp ${t.nominal.toLocaleString("id-ID")}`, time: formatDateTime(t.createdAt) }));
    return [...keyActs, ...topupActs];
  }, [selectedDay, isCurrentMonth, keyHistory, topupHistory]);


  return (
    <div className="mx-auto max-w-[640px]">
      <PageHeader title="Activity" eyebrow="Kalender" back="/dashboard" />

      <div className="rounded-xl2 border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[16px] font-bold">
            {MONTHS[cursor.m]} {cursor.y}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { ...c, m: c.m - 1 }))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border-strong text-ink-dim hover:text-ink"
              aria-label="Bulan sebelumnya"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { ...c, m: c.m + 1 }))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border-strong text-ink-dim hover:text-ink"
              aria-label="Bulan berikutnya"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-y-2 text-center">
          {WEEKDAYS.map((w) => (
            <span key={w} className="text-[10.5px] font-semibold text-ink-faint">
              {w}
            </span>
          ))}
          {cells.map((c, i) => {
            const active = c.current && isCurrentMonth && c.day === selectedDay;
            const hasActivity = c.current && isCurrentMonth && activityDays.includes(c.day);
            return (
              <button
                key={i}
                disabled={!c.current}
                onClick={() => setSelectedDay(c.day)}
                className={`mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-full text-[13px] transition-colors ${
                  !c.current
                    ? "text-ink-faint/40"
                    : active
                    ? "bg-primary font-bold text-white"
                    : "text-ink hover:bg-surface-2"
                }`}
              >
                {c.day}
                {hasActivity && !active && (
                  <span className="mt-0.5 h-1 w-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h2 className="font-display text-[14px] font-bold">
          {MONTHS[cursor.m]} {selectedDay} Activity
        </h2>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-dim">
          {dayActivities.length} Items
        </span>
      </div>

      {dayActivities.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-3 rounded-xl2 border border-border bg-surface py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-dim text-primary">
            <CalendarDays size={24} />
          </span>
          <p className="text-[13px] text-ink-faint">No activity on this day</p>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          {dayActivities.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-surface px-4 py-3">
              <p className="text-[13px] font-semibold">{a.label}</p>
              <p className="mt-0.5 text-[11px] text-ink-faint">{a.time}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
