"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import {
  CalendarDays,
  Plus,
  Trash2,
  CheckCircle2,
  Printer,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type {
  Project,
  WeeklyReport,
  WBSTask,
  ProjectPayment,
  ProjectMilestone,
} from "@/lib/types";
import {
  createWeeklyReport,
  updateWeeklyReport,
  deleteWeeklyReport,
  updateWeeklyReportsOrder,
} from "@/app/actions/reports";
import { computeTaskDates } from "@/lib/scheduler";

import type { UserSession } from "@/lib/auth";

interface Props {
  project: Project;
  data: WeeklyReport[];
  tasks: WBSTask[];
  payments: ProjectPayment[];
  milestones: ProjectMilestone[];
  user?: UserSession | null;
}

// Custom natural sort for WBS numbers
function sortWBS(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);
  const maxLen = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLen; i++) {
    const valA = partsA[i] || 0;
    const valB = partsB[i] || 0;
    if (valA !== valB) return valA - valB;
  }
  return 0;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

export function WeeklyReportsTab({
  project,
  data,
  tasks,
  payments,
  milestones,
  user,
}: Props) {
  const [items, setItems] = useState<WeeklyReport[]>(data);
  const [selectedId, setSelectedId] = useState<string | null>(
    data.length > 0 ? data[0].id : null,
  );
  const [isPending, startTransition] = useTransition();
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(
    null,
  );
  const [isCreating, setIsCreating] = useState(false);

  if (JSON.stringify(data) !== JSON.stringify(items) && !isPending) {
    setItems(data);
    if (!selectedId && data.length > 0) setSelectedId(data[0].id);
  }

  const selectedItem = items.find((i) => i.id === selectedId) || null;

  const handleMove = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === items.length - 1) return;

    const newItems = [...items];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    const temp = newItems[index];
    newItems[index] = newItems[swapIndex];
    newItems[swapIndex] = temp;

    const updates = newItems.map((item, idx) => ({
      id: item.id,
      sort_order: idx + 1,
    }));
    setItems(newItems);
    startTransition(async () => {
      await updateWeeklyReportsOrder(project.id, updates);
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("ลบรายงานประจำสัปดาห์นี้ออกจากระบบ?")) return;
    startTransition(async () => {
      await deleteWeeklyReport(id, project.id);
      if (selectedId === id) setSelectedId(null);
    });
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setSelectedId(null);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex h-[calc(100vh-180px)] gap-4 print:h-auto print:block">
      {/* ── Left Sidebar (List) ── */}
      <div className="w-1/3 min-w-[300px] flex flex-col gap-3 print:hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">
            รายงานประจำสัปดาห์
          </h2>
          {user && (user.role === 'admin' || user.role === 'editor') && (
            <button
              onClick={handleCreateNew}
              className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 transition-colors shadow-sm shadow-primary-500/20 cursor-pointer"
            >
              <Plus size={16} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
          {items.length === 0 && !isCreating ? (
            <div className="text-center py-10 bg-slate-50 dark:bg-[#14142a] rounded-2xl border border-slate-200 dark:border-[#252548]">
              <CalendarDays
                size={24}
                className="mx-auto text-slate-300 dark:text-slate-600 mb-2"
              />
              <p className="text-xs font-bold text-slate-500">
                ยังไม่มีรายงานประจำสัปดาห์
              </p>
            </div>
          ) : (
            <>
              {isCreating && (
                <div className="p-3 rounded-xl border-2 border-primary-500 bg-primary-50 dark:bg-primary-500/10 cursor-pointer">
                  <p className="text-sm font-bold text-primary-700 dark:text-primary-400">
                    📝 กำลังสร้างรายงานใหม่...
                  </p>
                </div>
              )}
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedId(item.id);
                    setIsCreating(false);
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                    selectedId === item.id
                      ? "border-primary-500 bg-white dark:bg-[#1e1e38] shadow-sm ring-1 ring-primary-500/20"
                      : "border-slate-200 dark:border-[#252548] bg-slate-50 dark:bg-[#14142a] hover:border-slate-300"
                  }`}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMove(idx, "up");
                      }}
                      disabled={idx === 0 || isPending}
                      className="p-1 text-slate-300 hover:text-primary-500 disabled:opacity-30"
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMove(idx, "down");
                      }}
                      disabled={idx === items.length - 1 || isPending}
                      className="p-1 text-slate-300 hover:text-primary-500 disabled:opacity-30"
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                      {item.date_range || "ไม่ระบุช่วงวันที่"}
                    </p>
                    <p className="text-xs font-medium text-slate-500 truncate mt-0.5">
                      {item.summary || "ไม่มีบทสรุป"}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Right Content (Form & Print Layout) ── */}
      <div className="flex-1 bg-white dark:bg-[#14142a] rounded-2xl border border-slate-200 dark:border-[#252548] overflow-hidden flex flex-col print:border-none print:bg-transparent weekly-report-container">
        {selectedItem || isCreating ? (
          <WeeklyReportForm
            key={isCreating ? "new" : selectedItem?.id}
            project={project}
            item={isCreating ? null : selectedItem}
            tasks={tasks}
            milestones={milestones}
            onClose={() => setIsCreating(false)}
            onDelete={handleDelete}
            onPrint={handlePrint}
            user={user}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 print:hidden">
            <CalendarDays size={48} className="mb-4 opacity-20" />
            <p className="font-bold">เลือกรายงานเพื่อดูหรือแก้ไขข้อมูล</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WeeklyReportForm({
  project,
  item,
  tasks,
  milestones,
  onClose,
  onDelete,
  onPrint,
  user,
}: {
  project: Project;
  item: WeeklyReport | null;
  tasks: WBSTask[];
  milestones: ProjectMilestone[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onPrint: () => void;
  user?: UserSession | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const handleBeforePrint = () => {
      const el = document.querySelector(".gantt-print-section");
      if (el) {
        const style = window.getComputedStyle(el);
        console.log("gantt-print-section break-before:", style.breakBefore || style.pageBreakBefore);
      }
    };
    window.addEventListener("beforeprint", handleBeforePrint);
    return () => window.removeEventListener("beforeprint", handleBeforePrint);
  }, []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    // Compute task stats for snapshot
    const today = new Date();
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let doneCount = 0;
    let delayedCount = 0;
    let futureCount = 0;

    for (const t of scheduledTasks) {
      const tStart = new Date(t.computedStartDate);
      const tEnd = new Date(t.computedEndDate);
      tStart.setHours(0, 0, 0, 0);
      tEnd.setHours(0, 0, 0, 0);

      let plannedProgress = 0;
      if (todayDateOnly >= tEnd) {
        plannedProgress = 100;
      } else if (todayDateOnly < tStart) {
        plannedProgress = 0;
      } else {
        const totalTaskTime = Math.max(1, tEnd.getTime() - tStart.getTime());
        const elapsedTaskTime = todayDateOnly.getTime() - tStart.getTime();
        plannedProgress = (elapsedTaskTime / totalTaskTime) * 100;
      }

      if (t.actual_progress === 100) {
        doneCount++;
      } else if (tStart > todayDateOnly) {
        futureCount++;
      } else if (plannedProgress - (t.actual_progress || 0) >= 5) {
        delayedCount++;
      }
    }

    const end = project.end_date ? new Date(project.end_date) : null;
    let daysRemainingVal = 0;
    if (end) {
      const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      daysRemainingVal = Math.ceil((endDateOnly.getTime() - todayDateOnly.getTime()) / (1000 * 60 * 60 * 24));
    }

    const snapshot = {
      pv: Number(evm.pvCumulative.toFixed(1)),
      ev: Number(evm.evCumulative.toFixed(1)),
      ac: Number(evm.acPercent.toFixed(1)),
      sv: Number(evm.SV_percent.toFixed(1)),
      cv: Number((evm.evCumulative - evm.acPercent).toFixed(1)),
      budget: project.budget || 0,
      paid_amount: evm.AC,
      days_remaining: daysRemainingVal,
      task_stats: {
        total: scheduledTasks.length,
        done: doneCount,
        delayed: delayedCount,
        future: futureCount,
      },
      saved_at: new Date().toISOString(),
      s_curve_data: sCurveData,
    };

    const payload = {
      date_range: fd.get("date_range") || "",
      summary: fd.get("summary") || null,
      delayed_tasks: fd.get("delayed_tasks") || null,
      look_ahead: fd.get("look_ahead") || null,
      snapshot,
    };

    startTransition(async () => {
      if (item) {
        await updateWeeklyReport(item.id, project.id, payload);
      } else {
        await createWeeklyReport(project.id, payload);
        onClose();
      }
    });
  };

  // --- Calculate Dashboard / EVM Data for Print ---
  const scheduledTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => sortWBS(a.wbs_no, b.wbs_no));
    return computeTaskDates(sorted, project.start_date);
  }, [tasks, project.start_date]);

  const evm = useMemo(() => {
    const today = new Date();
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const totalWbsCost = scheduledTasks.reduce((sum, t) => sum + (Number(t.cost) || 0), 0);
    
    let pvCumulative = 0;
    let evCumulative = 0;

    if (totalWbsCost > 0) {
      let totalWeightedPlanned = 0;
      let totalWeightedActual = 0;

      for (const t of scheduledTasks) {
        const tStart = new Date(t.computedStartDate);
        const tEnd = new Date(t.computedEndDate);
        const tCost = Number(t.cost) || 0;
        const weight = tCost / totalWbsCost;

        let plannedProgress = 0;
        if (todayDateOnly >= tEnd) {
          plannedProgress = 100;
        } else if (todayDateOnly < tStart) {
          plannedProgress = 0;
        } else {
          const totalTaskTime = Math.max(1, tEnd.getTime() - tStart.getTime());
          const elapsedTaskTime = todayDateOnly.getTime() - tStart.getTime();
          plannedProgress = (elapsedTaskTime / totalTaskTime) * 100;
        }

        totalWeightedPlanned += weight * plannedProgress;
        totalWeightedActual += weight * (t.actual_progress || 0);
      }

      pvCumulative = totalWeightedPlanned;
      evCumulative = totalWeightedActual;
    } else {
      let totalPlanned = 0;
      let totalActual = 0;
      for (const t of scheduledTasks) {
        const tStart = new Date(t.computedStartDate);
        const tEnd = new Date(t.computedEndDate);
        
        let plannedProgress = 0;
        if (todayDateOnly >= tEnd) {
          plannedProgress = 100;
        } else if (todayDateOnly < tStart) {
          plannedProgress = 0;
        } else {
          const totalTaskTime = Math.max(1, tEnd.getTime() - tStart.getTime());
          const elapsedTaskTime = todayDateOnly.getTime() - tStart.getTime();
          plannedProgress = (elapsedTaskTime / totalTaskTime) * 100;
        }
        totalPlanned += plannedProgress;
        totalActual += t.actual_progress || 0;
      }
      if (scheduledTasks.length > 0) {
        pvCumulative = totalPlanned / scheduledTasks.length;
        evCumulative = totalActual / scheduledTasks.length;
      }
    }

    const paidAmountSum = milestones
      .filter((m) => m.is_paid)
      .reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    const acPercent = (paidAmountSum / (project.budget || 1)) * 100;

    const totalWbsDenominator = totalWbsCost > 0 ? totalWbsCost : (project.budget || 1);
    const PV = totalWbsDenominator * (pvCumulative / 100);
    const EV = totalWbsDenominator * (evCumulative / 100);
    const AC = paidAmountSum;

    const SV = EV - PV;
    const CV = EV - AC;

    const start = project.start_date ? new Date(project.start_date) : null;
    const end = project.end_date ? new Date(project.end_date) : null;
    let totalDays = 0;
    if (start && end) {
      const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      totalDays = Math.max(0, Math.ceil((endDateOnly.getTime() - startDateOnly.getTime()) / (1000 * 60 * 60 * 24)));
    }
    const SV_percent = evCumulative - pvCumulative;
    let svDays = 0;
    if (totalDays > 0) {
      svDays = Math.round((SV_percent / 100) * totalDays);
    }

    return { PV, EV, AC, SV, CV, svDays, pvCumulative, evCumulative, acPercent, SV_percent, totalDays };
  }, [scheduledTasks, milestones, project]);

  const summary = useMemo(() => {
    const totalWBSCost = scheduledTasks.reduce(
      (sum, t) => sum + (Number(t.cost) || 0),
      0,
    );

    // Calculate weighted actual progress
    let cumulativeActualProgress = 0;

    if (totalWBSCost > 0) {
      const totalWeighted = scheduledTasks.reduce((sum, t) => {
        const cost = Number(t.cost) || 0;
        const progress = Number(t.actual_progress) || 0;
        return sum + cost * progress;
      }, 0);
      cumulativeActualProgress = totalWeighted / totalWBSCost;
    } else if (scheduledTasks.length > 0) {
      // Fallback: simple average if cost is 0 on all tasks
      const sumProgress = scheduledTasks.reduce(
        (sum, t) => sum + (Number(t.actual_progress) || 0),
        0,
      );
      cumulativeActualProgress = sumProgress / scheduledTasks.length;
    }

    return {
      totalCost: totalWBSCost,
      actualProgress: Math.round(cumulativeActualProgress),
    };
  }, [scheduledTasks]);

  const dateRange = useMemo(() => {
    if (scheduledTasks.length === 0) {
      const pStart = project.start_date
        ? new Date(project.start_date)
        : new Date();
      const pEnd = project.end_date
        ? new Date(project.end_date)
        : new Date(pStart.getTime() + 30 * 24 * 60 * 60 * 1000);
      return {
        start: pStart,
        end: pEnd,
        durationDays: Math.ceil(
          (pEnd.getTime() - pStart.getTime()) / (24 * 60 * 60 * 1000),
        ),
      };
    }

    let minDate = new Date(scheduledTasks[0].computedStartDate);
    let maxDate = new Date(scheduledTasks[0].computedEndDate);

    for (const t of scheduledTasks) {
      const tStart = new Date(t.computedStartDate);
      const tEnd = new Date(t.computedEndDate);
      if (tStart < minDate) minDate = tStart;
      if (tEnd > maxDate) maxDate = tEnd;
    }

    // Add extra padding days (e.g. 5 days) at the end for visual comfort
    maxDate = new Date(maxDate.getTime() + 5 * 24 * 60 * 60 * 1000);

    const durationDays = Math.max(
      1,
      Math.ceil(
        (maxDate.getTime() - minDate.getTime()) / (24 * 60 * 60 * 1000),
      ),
    );
    return { start: minDate, end: maxDate, durationDays };
  }, [scheduledTasks, project]);

  const todayLeft = useMemo(() => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const { start, end, durationDays } = dateRange;
    if (durationDays === 0) return -1;
    const totalTime = end.getTime() - start.getTime();
    const elapsed = todayDate.getTime() - start.getTime();
    return (elapsed / totalTime) * 100;
  }, [dateRange]);

  const sCurveData = useMemo(() => {
    const { start, durationDays } = dateRange;
    // Dynamic interval based on project length to keep point count balanced (between 10 and 25 points)
    let intervalDays = 7;
    if (durationDays <= 30) {
      intervalDays = 3;
    } else if (durationDays <= 90) {
      intervalDays = 7;
    } else if (durationDays <= 180) {
      intervalDays = 10;
    } else if (durationDays <= 365) {
      intervalDays = 15;
    } else {
      intervalDays = 30;
    }
    const pointsCount = Math.max(4, Math.ceil(durationDays / intervalDays));
    const list: {
      label: string;
      planned: number;
      actual: number | null;
      actualCost: number | null;
    }[] = [];

    if (item?.snapshot?.s_curve_data) {
      return item.snapshot.s_curve_data as typeof list;
    }

    if (scheduledTasks.length === 0 || durationDays === 0) return [];

    const todayDateOnly = new Date();
    todayDateOnly.setHours(0, 0, 0, 0);

    const totalWeightDenominator =
      summary.totalCost > 0 ? summary.totalCost : scheduledTasks.length || 1;

    // Group paid milestones by date and sort chronologically
    const groupedMap = new Map<string, number>();
    for (const m of milestones) {
      if (m.is_paid && m.payment_date && Number(m.amount) > 0) {
        const dStr = m.payment_date;
        groupedMap.set(dStr, (groupedMap.get(dStr) || 0) + Number(m.amount));
      }
    }

    const sortedPayments = Array.from(groupedMap.entries())
      .map(([dateStr, amount]) => ({
        time: new Date(dateStr).getTime(),
        amount,
      }))
      .sort((a, b) => a.time - b.time);

    const keyPoints: { time: number; value: number }[] = [];
    keyPoints.push({ time: start.getTime(), value: 0 });

    let runningSum = 0;
    for (const p of sortedPayments) {
      runningSum += p.amount;
      keyPoints.push({
        time: p.time,
        value: (runningSum / (project.budget || 1)) * 100,
      });
    }

    for (let i = 0; i <= pointsCount; i++) {
      const fraction = i / pointsCount;
      const currTime =
        start.getTime() + fraction * durationDays * 24 * 60 * 60 * 1000;
      const currDate = new Date(currTime);
      currDate.setHours(0, 0, 0, 0);

      // Planned sum (PV)
      let plannedSum = 0;
      for (const t of scheduledTasks) {
        const tStart = new Date(t.computedStartDate);
        const tEnd = new Date(t.computedEndDate);
        const taskWeightValue = summary.totalCost > 0 ? Number(t.cost) || 0 : 1;

        if (currDate >= tEnd) {
          plannedSum += taskWeightValue;
        } else if (currDate >= tStart) {
          const elapsed =
            (currDate.getTime() - tStart.getTime()) / (24 * 60 * 60 * 1000);
          plannedSum += taskWeightValue * (elapsed / t.duration);
        }
      }

      // Actual sum (EV)
      let actualSum = 0;
      const showActual = currDate <= todayDateOnly || i === 0;

      if (showActual) {
        for (const t of scheduledTasks) {
          const tStart = new Date(t.computedStartDate);
          const tEnd = new Date(t.computedEndDate);
          const taskWeightValue =
            summary.totalCost > 0 ? Number(t.cost) || 0 : 1;

          // Boundaries for actual progress calculation
          let progressStart = tStart;
          let progressEnd = tEnd < todayDateOnly ? tEnd : todayDateOnly;

          // If a future task has progress, it started early!
          if (tStart >= todayDateOnly && (t.actual_progress || 0) > 0) {
            progressStart = start;
            progressEnd = todayDateOnly;
          }

          if (currDate >= progressEnd) {
            actualSum += taskWeightValue * ((t.actual_progress || 0) / 100);
          } else if (currDate <= progressStart) {
            // progress at this point is 0
          } else {
            const totalDuration =
              progressEnd.getTime() - progressStart.getTime();
            if (totalDuration > 0) {
              const elapsed = currDate.getTime() - progressStart.getTime();
              const progressAtPoint =
                (t.actual_progress || 0) * (elapsed / totalDuration);
              actualSum += taskWeightValue * (progressAtPoint / 100);
            } else {
              actualSum += taskWeightValue * ((t.actual_progress || 0) / 100);
            }
          }
        }
      }

      // AC cumulative spent from project milestones
      let acVal: number | null = null;
      if (showActual) {
        if (keyPoints.length > 1) {
          if (currTime <= keyPoints[0].time) {
            acVal = 0;
          } else {
            let found = false;
            for (let j = 0; j < keyPoints.length - 1; j++) {
              const pA = keyPoints[j];
              const pB = keyPoints[j + 1];
              if (currTime >= pA.time && currTime <= pB.time) {
                const dt = pB.time - pA.time;
                if (dt > 0) {
                  const ratio = (currTime - pA.time) / dt;
                  acVal = pA.value + (pB.value - pA.value) * ratio;
                } else {
                  acVal = pB.value;
                }
                found = true;
                break;
              }
            }
            if (!found) {
              acVal = keyPoints[keyPoints.length - 1].value;
            }
          }
        } else {
          // Fallback: draw a linear slant from 0 at start date up to totalPaidPercent at today
          const totalPaidPercent =
            ((project.paid_amount || 0) / (project.budget || 1)) * 100;
          if (totalPaidPercent > 0) {
            const projectStart = start.getTime();
            const projectToday = todayDateOnly.getTime();

            if (currTime <= projectStart) {
              acVal = 0;
            } else if (projectToday > projectStart) {
              const ratio = Math.min(
                1,
                Math.max(
                  0,
                  (currTime - projectStart) / (projectToday - projectStart),
                ),
              );
              acVal = totalPaidPercent * ratio;
            } else {
              acVal = totalPaidPercent;
            }
          } else {
            acVal = 0;
          }
        }
      }

      list.push({
        label: currDate.toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
        }),
        planned: Math.min(
          100,
          Math.round((plannedSum / totalWeightDenominator) * 100),
        ),
        actual: showActual
          ? Math.min(
              100,
              Math.round((actualSum / totalWeightDenominator) * 100),
            )
          : null,
        actualCost: acVal !== null ? Math.min(100, Math.round(acVal)) : null,
      });
    }
    return list;
  }, [scheduledTasks, dateRange, summary, project, milestones, item]);

  const ganttHeaders = useMemo(() => {
    const list: string[] = [];
    const { start, durationDays } = dateRange;
    const cols = 6;
    for (let i = 0; i < cols; i++) {
      const d = new Date(
        start.getTime() + (i / (cols - 1)) * durationDays * 24 * 60 * 60 * 1000,
      );
      list.push(
        d.toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
      );
    }
    return list;
  }, [dateRange]);

  const displayEvm = useMemo(() => {
    if (item?.snapshot) {
      const budget = item.snapshot.budget || 0;
      const PV = (item.snapshot.pv / 100) * budget;
      const EV = (item.snapshot.ev / 100) * budget;
      const AC = item.snapshot.paid_amount;
      const SV = EV - PV;
      const CV = EV - AC;
      return {
        PV,
        EV,
        AC,
        SV,
        CV,
        pvCumulative: item.snapshot.pv,
        evCumulative: item.snapshot.ev,
        acPercent: item.snapshot.ac,
        SV_percent: item.snapshot.sv,
        svDays: Math.round((item.snapshot.sv / 100) * (evm.totalDays || 0)),
        isSnapshot: true,
        savedAt: item.snapshot.saved_at,
      };
    }
    return {
      PV: evm.PV,
      EV: evm.EV,
      AC: evm.AC,
      SV: evm.SV,
      CV: evm.CV,
      pvCumulative: evm.pvCumulative,
      evCumulative: evm.evCumulative,
      acPercent: evm.acPercent,
      SV_percent: evm.SV_percent,
      svDays: evm.svDays,
      isSnapshot: false,
      savedAt: null,
    };
  }, [item?.snapshot, evm, project]);

  const formatDateString = (isoString: string | null) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (e) {
      return "";
    }
  };

  const labelCls =
    "text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1.5";
  const inputCls =
    "w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#252548] bg-white dark:bg-[#1e1e38] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500/40";

  return (
    <>
      <style type="text/css" media="print">{`
        @page { size: A4 portrait; margin: 12mm 10mm; }
        
        /* Force paper white background and black text */
        html, body {
          background-color: white !important;
          background: white !important;
          color: #0f172a !important;
        }
        
        div, form, section, main, article, table, tr, td, th {
          background-color: white !important;
          background: white !important;
          color: #0f172a !important;
          border-color: #cbd5e1 !important;
        }

        p, span, label, input, textarea, h1, h2, h3, h4, th, td, select {
          font-size: 11px !important;
          color: #0f172a !important;
        }

        h1 { font-size: 16px !important; }
        h2 { font-size: 13px !important; }
        h3 { font-size: 12px !important; }
        .text-sm { font-size: 11px !important; }
        .text-xs { font-size: 9px !important; }
        .text-[9px] { font-size: 9px !important; }
        .text-[8px] { font-size: 8px !important; }
        textarea { max-height: 50px !important; overflow: hidden !important; }
        
        .gantt-print-section {
          display: none !important;
        }
        
        .weekly-report-container {
          display: block !important;
          width: 100% !important;
          height: auto !important;
          overflow: visible !important;
          border: none !important;
          background: white !important;
        }
        
        .s-curve-container {
          height: 300px;
        }

        /* Color classes override for printable clarity */
        .text-slate-500, .dark\\:text-slate-400 {
          color: #475569 !important;
        }
        .text-primary-600, .dark\\:text-primary-400 {
          color: #a13c9d !important;
        }
        .text-amber-600, .dark\\:text-amber-400 {
          color: #d97706 !important;
        }
        .text-emerald-600, .dark\\:text-emerald-400 {
          color: #059669 !important;
        }

        /* EVM card and status color overrides */
        .bg-emerald-100, .dark\\:bg-emerald-500\\/10 {
          background-color: #ecfdf5 !important;
        }
        .bg-amber-100, .dark\\:bg-amber-500\\/10 {
          background-color: #fef3c7 !important;
        }
        .bg-red-100, .dark\\:bg-red-500\\/10 {
          background-color: #ffeeeb !important;
        }

        @media print {
          .s-curve-container {
            height: 320px !important;
            width: 100% !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Fix S-Curve line colors and dots */
          text {
            fill: #475569 !important;
          }
          line {
            stroke: #cbd5e1 !important;
          }
          .stroke-primary-600, .dark\\:stroke-primary-400 {
            stroke: #a13c9d !important;
          }
          .fill-primary-600, .dark\\:fill-primary-400 {
            fill: #a13c9d !important;
          }
        }
      `}</style>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col h-full print:block"
      >
        {/* Header Toolbar (Hidden in Print) */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-[#1e1e38] print:hidden">
          <h3 className="text-base font-black text-slate-900 dark:text-white">
            {item ? "แก้ไขรายงานประจำสัปดาห์" : "สร้างรายงานประจำสัปดาห์"}
          </h3>
          <div className="flex items-center gap-2">
            {item && user && (
              <button
                type="button"
                onClick={onPrint}
                className="btn-secondary px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border-slate-200 cursor-pointer"
              >
                <Printer size={14} /> พิมพ์รายงาน (รวมกราฟ)
              </button>
            )}
            {item && user && (user.role === 'admin' || user.role === 'editor') && (
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                disabled={isPending}
                className="btn-secondary px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 text-red-500 hover:bg-red-50 border-slate-200 cursor-pointer"
              >
                <Trash2 size={14} /> ลบ
              </button>
            )}
            {user && (user.role === 'admin' || user.role === 'editor') && (
              <button
                type="submit"
                disabled={isPending}
                className="btn-primary px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 size={14} /> บันทึก
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 print:overflow-visible print:p-0 print:space-y-2 print:block print:w-full print:h-auto">
          {item && !item.snapshot && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between print:hidden">
              <span className="flex items-center gap-1.5">
                ⚠️ รายงานนี้สร้างก่อนมีระบบบันทึกประวัติ ระบบกำลังแสดงผลด้วยค่าปัจจุบัน
              </span>
              <span className="bg-amber-500 text-white px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-wider">
                ค่าปัจจุบัน
              </span>
            </div>
          )}

          {/* ============================================================ */}
          {/* PAGE 1: Header + EVM Dashboard + Form Fields + S-Curve        */}
          {/* ============================================================ */}

          {/* --- PRINT HEADER --- */}
          <div className="hidden print:block text-center border-b-2 border-black pb-2 mb-2">
            <h1 className="text-lg font-black mb-0">
              รายงานความก้าวหน้าประจำสัปดาห์ (Weekly Report)
            </h1>
            <h2 className="text-sm font-bold">โครงการ: {project.name}</h2>
            <div className="flex justify-between mt-1 text-xs font-medium">
              <span>ประจำวันที่: {item?.date_range || "-"}</span>
              <span>สถานะโครงการ: {project.status}</span>
            </div>
          </div>

          {/* --- EVM Dashboard Cards (Visible on Screen & Print) --- */}
          <div className="w-full space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 print:text-black">
              {displayEvm.isSnapshot ? "สรุปข้อมูลโครงการ ณ วันที่บันทึก" : "สรุปข้อมูลโครงการ ณ วันนี้"}
            </h4>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:grid-cols-4 print:gap-2 text-center">
              <div className="border border-slate-200 dark:border-[#252548] print:border-black p-3 print:p-1.5 rounded-2xl print:rounded-none bg-slate-50/50 dark:bg-[#1a1a32]/20 print:bg-transparent">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">งบประมาณโครงการ (Budget)</p>
                <p className="text-base font-black text-slate-800 dark:text-white print:text-xs print:font-black mt-1">
                  {(project.budget || 0).toLocaleString()} ฿
                </p>
                {displayEvm.isSnapshot && displayEvm.savedAt && (
                  <p className="text-[8px] text-slate-400 dark:text-slate-500 font-semibold mt-1 print:hidden">
                    บันทึก ณ วันที่ {formatDateString(displayEvm.savedAt)}
                  </p>
                )}
              </div>

              <div className="border border-slate-200 dark:border-[#252548] print:border-black p-3 print:p-1.5 rounded-2xl print:rounded-none bg-slate-50/50 dark:bg-[#1a1a32]/20 print:bg-transparent">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">มูลค่างานตามแผน (PV)</p>
                <p className="text-base font-black text-slate-800 dark:text-white print:text-xs print:font-black mt-1">
                  {displayEvm.pvCumulative.toFixed(1)}% ({displayEvm.PV.toLocaleString(undefined, { maximumFractionDigits: 0 })} ฿)
                </p>
                {displayEvm.isSnapshot && displayEvm.savedAt && (
                  <p className="text-[8px] text-slate-400 dark:text-slate-500 font-semibold mt-1 print:hidden">
                    บันทึก ณ วันที่ {formatDateString(displayEvm.savedAt)}
                  </p>
                )}
              </div>

              <div className="border border-slate-200 dark:border-[#252548] print:border-black p-3 print:p-1.5 rounded-2xl print:rounded-none bg-slate-50/50 dark:bg-[#1a1a32]/20 print:bg-transparent">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">มูลค่างานที่ทำได้ (EV)</p>
                <p className="text-base font-black text-slate-800 dark:text-white print:text-xs print:font-black mt-1">
                  {displayEvm.evCumulative.toFixed(1)}% ({displayEvm.EV.toLocaleString(undefined, { maximumFractionDigits: 0 })} ฿)
                </p>
                {displayEvm.isSnapshot && displayEvm.savedAt && (
                  <p className="text-[8px] text-slate-400 dark:text-slate-500 font-semibold mt-1 print:hidden">
                    บันทึก ณ วันที่ {formatDateString(displayEvm.savedAt)}
                  </p>
                )}
              </div>

              <div className="border border-slate-200 dark:border-[#252548] print:border-black p-3 print:p-1.5 rounded-2xl print:rounded-none bg-slate-50/50 dark:bg-[#1a1a32]/20 print:bg-transparent">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">ต้นทุนจริง (AC)</p>
                <p className="text-base font-black text-slate-800 dark:text-white print:text-xs print:font-black mt-1">
                  {displayEvm.acPercent.toFixed(1)}% ({displayEvm.AC.toLocaleString(undefined, { maximumFractionDigits: 0 })} ฿)
                </p>
                {displayEvm.isSnapshot && displayEvm.savedAt && (
                  <p className="text-[8px] text-slate-400 dark:text-slate-500 font-semibold mt-1 print:hidden">
                    บันทึก ณ วันที่ {formatDateString(displayEvm.savedAt)}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 print:grid-cols-2 print:gap-2 text-center">
              <div className="border border-slate-200 dark:border-[#252548] print:border-black p-3 print:p-1.5 rounded-2xl print:rounded-none bg-slate-50/50 dark:bg-[#1a1a32]/20 print:bg-transparent">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Schedule Variance (SV)</p>
                <p className="text-base font-black text-slate-800 dark:text-white print:text-xs print:font-black mt-1">
                  {displayEvm.SV_percent >= 0 ? "+" : ""}{displayEvm.SV_percent.toFixed(1)}% ({displayEvm.SV_percent >= 0 ? "+" : ""}{displayEvm.svDays} วัน)
                </p>
                <p className="text-[10px] mt-1 font-bold text-slate-600 dark:text-slate-300 print:text-[8px] print:font-bold">
                  {displayEvm.SV_percent >= 0 ? "✅ เร็วกว่าแผน" : "⚠️ ล่าช้ากว่าแผน"}
                </p>
                {displayEvm.isSnapshot && displayEvm.savedAt && (
                  <p className="text-[8px] text-slate-400 dark:text-slate-500 font-semibold mt-1 print:hidden">
                    บันทึก ณ วันที่ {formatDateString(displayEvm.savedAt)}
                  </p>
                )}
              </div>

              <div className="border border-slate-200 dark:border-[#252548] print:border-black p-3 print:p-1.5 rounded-2xl print:rounded-none bg-slate-50/50 dark:bg-[#1a1a32]/20 print:bg-transparent">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Cost Variance (CV)</p>
                <p className="text-base font-black text-slate-800 dark:text-white print:text-xs print:font-black mt-1">
                  {(displayEvm.evCumulative - displayEvm.acPercent) >= 0 ? "+" : ""}{(displayEvm.evCumulative - displayEvm.acPercent).toFixed(1)}% ({displayEvm.CV >= 0 ? "+" : ""}{displayEvm.CV.toLocaleString(undefined, { maximumFractionDigits: 0 })} ฿)
                </p>
                <p className="text-[10px] mt-1 font-bold text-slate-600 dark:text-slate-300 print:text-[8px] print:font-bold">
                  {(displayEvm.evCumulative - displayEvm.acPercent) >= 0 ? "✅ ต่ำกว่างบประมาณ" : "🔴 เกินงบประมาณ"}
                </p>
                {displayEvm.isSnapshot && displayEvm.savedAt && (
                  <p className="text-[8px] text-slate-400 dark:text-slate-500 font-semibold mt-1 print:hidden">
                    บันทึก ณ วันที่ {formatDateString(displayEvm.savedAt)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* --- Form Fields (visible on screen & print) --- */}
          <div>
            <label className={labelCls}>ช่วงวันที่ของรายงาน (Date Range)</label>
            <input
              name="date_range"
              type="text"
              defaultValue={item?.date_range || ""}
              className={`${inputCls} print:border-none print:p-0 print:bg-transparent print:font-bold`}
              placeholder="เช่น 21 มิ.ย. 2026 - 27 มิ.ย. 2026"
              required
            />
          </div>

          <div>
            <label className={labelCls}>
              สรุปภาพรวมความคืบหน้า (Executive Summary)
            </label>
            <textarea
              name="summary"
              rows={4}
              defaultValue={item?.summary || ""}
              className={`${inputCls} print:border-none print:p-0 print:bg-transparent print:min-h-0 print:h-auto print:text-[10px]`}
              placeholder="สรุปสถานะการทำงานในสัปดาห์นี้..."
            />
          </div>

          <div>
            <label className={labelCls}>
              งานที่ล่าช้า และ สาเหตุ (Delayed Tasks & Causes)
            </label>
            <textarea
              name="delayed_tasks"
              rows={3}
              defaultValue={item?.delayed_tasks || ""}
              className={`${inputCls} print:border-none print:p-0 print:bg-transparent print:min-h-0 print:h-auto print:text-[10px]`}
              placeholder="หากไม่มีให้ขีด -"
            />
          </div>

          <div>
            <label className={labelCls}>แผนงานสัปดาห์ถัดไป (Look Ahead)</label>
            <textarea
              name="look_ahead"
              rows={3}
              defaultValue={item?.look_ahead || ""}
              className={`${inputCls} print:border-none print:p-0 print:bg-transparent print:min-h-0 print:h-auto print:text-[10px]`}
              placeholder="แผนการดำเนินงานในสัปดาห์หน้า..."
            />
          </div>

          {/* --- S-Curve --- */}
          <div className="w-full mt-6" style={{ maxHeight: "280px" }}>
            <h3 className="text-sm font-bold border-b border-slate-200 dark:border-[#252548] pb-2 mb-4 print:border-black print:pb-1 print:mb-2 text-slate-900 dark:text-white">
              กราฟ S-Curve ความคืบหน้าสะสม
            </h3>
            {sCurveData.length > 1 ? (
              <div className="space-y-4">
                <div className="relative s-curve-container">
                  <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible" preserveAspectRatio="xMidYMid meet">
                    {/* Grid Lines */}
                    {[0, 25, 50, 75, 100].map((v) => {
                      const y = 10 + (1 - v / 100) * 165;
                      return (
                        <g key={v}>
                          <line x1="40" y1={y} x2="485" y2={y} stroke="#ddd" strokeWidth="0.5" />
                          <text x="32" y={y + 3} fill="#999" fontSize="8" fontWeight="bold" textAnchor="end">
                            {v}%
                          </text>
                        </g>
                      );
                    })}
                    {/* Planned Path (PV) */}
                    <path
                      d={sCurveData.map((d, i) => {
                        const x = 40 + (i / (sCurveData.length - 1)) * 445;
                        const y = 10 + (1 - d.planned / 100) * 165;
                        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                      }).join(" ")}
                      fill="none" stroke="#999" strokeWidth="1.5" strokeDasharray="4 3"
                    />
                    {/* Actual Path (EV) */}
                    <path
                      d={sCurveData.map((d, idx) => {
                        if (d.actual === null) return null;
                        const x = 40 + (idx / (sCurveData.length - 1)) * 445;
                        const y = 10 + (1 - d.actual / 100) * 165;
                        return { x, y };
                      }).filter((pt): pt is { x: number; y: number } => pt !== null)
                        .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`)
                        .join(" ")}
                      fill="none"
                      className="stroke-primary-600 dark:stroke-primary-400"
                      strokeWidth="1.5"
                    />
                    {/* AC Path */}
                    <path
                      d={sCurveData.map((d, idx) => {
                        if (d.actualCost === null) return null;
                        const x = 40 + (idx / (sCurveData.length - 1)) * 445;
                        const y = 10 + (1 - d.actualCost / 100) * 165;
                        return { x, y };
                      }).filter((pt): pt is { x: number; y: number } => pt !== null)
                        .map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`)
                        .join(" ")}
                      fill="none" stroke="#f59e0b" strokeWidth="1.5"
                    />
                    {/* Data Points */}
                    {sCurveData.map((d, i) => {
                      const x = 40 + (i / (sCurveData.length - 1)) * 445;
                      const yP = 10 + (1 - d.planned / 100) * 165;
                      const yA = d.actual !== null ? 10 + (1 - d.actual / 100) * 165 : null;
                      const yAC = d.actualCost !== null ? 10 + (1 - d.actualCost / 100) * 165 : null;
                      return (
                        <g key={i}>
                          <circle cx={x} cy={yP} r="2" fill="#999" />
                          {yA !== null && (
                            <circle
                              cx={x}
                              cy={yA}
                              r="2"
                              className="fill-primary-600 dark:fill-primary-400"
                            />
                          )}
                          {yAC !== null && <circle cx={x} cy={yAC} r="2" fill="#f59e0b" />}
                        </g>
                      );
                    })}
                    {/* X Axis labels */}
                    {sCurveData.map((d, i) => {
                      const labelStep = Math.max(1, Math.ceil(sCurveData.length / 8));
                      if (i % labelStep !== 0 && i !== sCurveData.length - 1) return null;
                      const x = 40 + (i / (sCurveData.length - 1)) * 445;
                      return (
                        <text key={i} x={x} y="193" fill="#999" fontSize="7" fontWeight="bold" textAnchor="middle">
                          {d.label}
                        </text>
                      );
                    })}
                  </svg>
                </div>
                {/* S-Curve Legend */}
                <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-center gap-4 text-xs font-semibold print:flex-row print:justify-center print:gap-6 print:mt-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-8 border-b-2 border-dashed border-slate-400"></span>
                    <span className="text-slate-600 dark:text-slate-400">PV แผนงานสะสม</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-8 border-b-2 border-primary-600 dark:border-primary-400"></span>
                    <span className="text-primary-700 dark:text-primary-400">EV ผลงานจริงสะสม</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-8 border-b-2 border-amber-500"></span>
                    <span className="text-amber-600 dark:text-amber-500">AC ต้นทุนจริงสะสม</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-slate-400 text-xs">
                ต้องการข้อมูลอย่างน้อย 2 รายการเพื่อสร้างกราฟ S-Curve
              </div>
            )}
          </div>



        </div>
      </form>
    </>
  );
}
