import React from 'react';
import { AlertCircle, CheckCircle2, Clock, FileText, HeartPulse } from 'lucide-react';
import type { EmployeeAttendanceStatus, StudentAttendanceStatus } from '../types';

type AnyStatus = EmployeeAttendanceStatus | StudentAttendanceStatus;

export function StatusText({ status }: { status: AnyStatus }) {
  switch (status) {
    case 'Hadir':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Hadir</span>
        </span>
      );
    case 'Terlambat':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>Terlambat</span>
        </span>
      );
    case 'Izin':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 whitespace-nowrap">
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span>Izin</span>
        </span>
      );
    case 'Sakit':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-700 whitespace-nowrap">
          <HeartPulse className="w-3.5 h-3.5 shrink-0" />
          <span>Sakit</span>
        </span>
      );
    case 'Alpha':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Alpha</span>
        </span>
      );
    default:
      return <span className="text-xs font-medium text-slate-600">{status}</span>;
  }
}
