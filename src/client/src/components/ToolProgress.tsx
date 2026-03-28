import { useState } from "react";
import type { ToolEvent } from "../types";

interface ToolProgressProps {
  events: ToolEvent[];
  isLive?: boolean;
}

// Group events by toolCallId into execution chains
interface ToolExecution {
  toolCallId?: string;
  toolName?: string;
  mcpServerName?: string;
  agentName?: string;
  events: ToolEvent[];
  status: "running" | "complete" | "failed";
}

function groupExecutions(events: ToolEvent[]): ToolExecution[] {
  const byId = new Map<string, ToolExecution>();
  const ordered: string[] = [];

  for (const evt of events) {
    const id = evt.toolCallId ?? `anon-${evt.timestamp}`;

    if (!byId.has(id)) {
      ordered.push(id);
      byId.set(id, {
        toolCallId: evt.toolCallId,
        toolName: evt.toolName,
        mcpServerName: evt.mcpServerName,
        agentName: evt.agentName,
        events: [],
        status: "running",
      });
    }

    const exec = byId.get(id)!;
    exec.events.push(evt);

    if (evt.toolName) exec.toolName = evt.toolName;
    if (evt.mcpServerName) exec.mcpServerName = evt.mcpServerName;
    if (evt.agentName) exec.agentName = evt.agentName;

    if (evt.type === "complete" || evt.type === "subagent_end") {
      exec.status = evt.success !== false ? "complete" : "failed";
    }
  }

  return ordered.map((id) => byId.get(id)!);
}

function StatusIcon({ status }: { status: "running" | "complete" | "failed" }) {
  if (status === "running") {
    return (
      <div className="animate-spin h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full" />
    );
  }
  if (status === "complete") {
    return (
      <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ExecutionRow({ exec }: { exec: ToolExecution }) {
  const [expanded, setExpanded] = useState(false);

  const label = exec.agentName
    ? `🤖 ${exec.agentName}`
    : exec.toolName
      ? `🔧 ${exec.toolName}`
      : "Processing...";

  const server = exec.mcpServerName ? (
    <span className="text-xs text-gray-500 ml-2">via {exec.mcpServerName}</span>
  ) : null;

  const progressMessages = exec.events
    .filter((e) => e.type === "progress" && e.message)
    .map((e) => e.message!);

  const result = exec.events.find((e) => e.type === "complete" || e.type === "subagent_end");
  const errorMsg = result?.error;
  const hasDetails = progressMessages.length > 0 || result?.content || errorMsg;

  return (
    <div className="group">
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={`flex items-center gap-2 w-full text-left py-1 px-2 rounded text-sm
          ${hasDetails ? "hover:bg-gray-700/50 cursor-pointer" : "cursor-default"}
          ${exec.status === "running" ? "text-blue-300" : "text-gray-400"}`}
      >
        <StatusIcon status={exec.status} />
        <span className="font-medium truncate">{label}</span>
        {server}
        {hasDetails && (
          <svg
            className={`h-3 w-3 ml-auto text-gray-500 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>

      {expanded && (
        <div className="ml-8 mt-1 mb-2 text-xs space-y-1">
          {progressMessages.map((msg, i) => (
            <div key={i} className="text-gray-500 italic">
              {msg}
            </div>
          ))}
          {result?.content && (
            <pre className="bg-gray-800/50 rounded p-2 text-gray-400 overflow-x-auto max-h-32 text-[11px]">
              {result.content}
            </pre>
          )}
          {errorMsg && (
            <div className="text-red-400 bg-red-950/30 rounded p-2 text-[11px]">
              ⚠ {errorMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ToolProgress({ events, isLive }: ToolProgressProps) {
  const [collapsed, setCollapsed] = useState(!isLive);

  if (events.length === 0) return null;

  const executions = groupExecutions(events);

  return (
    <div
      className={`my-2 mx-4 rounded-lg border transition-colors ${
        isLive
          ? "border-blue-500/30 bg-blue-950/20"
          : "border-gray-700/50 bg-gray-800/30"
      }`}
    >
      <button
        onClick={() => !isLive && setCollapsed(!collapsed)}
        className={`w-full px-3 py-2 flex items-center gap-2 text-xs text-gray-400 ${
          !collapsed ? "border-b border-gray-700/30" : ""
        } ${!isLive ? "hover:text-gray-300 cursor-pointer" : "cursor-default"}`}
      >
        {isLive ? (
          <>
            <div className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            Working...
          </>
        ) : (
          <>
            <svg
              className={`h-3 w-3 transition-transform ${collapsed ? "" : "rotate-90"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            {executions.length} tool{executions.length !== 1 ? "s" : ""} used
          </>
        )}
      </button>
      {(!collapsed || isLive) && (
        <div className="px-1 py-1">
          {executions.map((exec, i) => (
            <ExecutionRow key={exec.toolCallId ?? i} exec={exec} />
          ))}
        </div>
      )}
    </div>
  );
}
