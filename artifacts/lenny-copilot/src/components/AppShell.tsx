"use client";

import { useState } from "react";
import type { FrameworkSpec } from "@lib/spec";
import { EntryScreen } from "./EntryScreen";
import { WorkflowRunner } from "./WorkflowRunner";

export function AppShell({ spec }: { spec: FrameworkSpec }) {
  const [started, setStarted] = useState(false);
  if (!started) {
    return <EntryScreen spec={spec} onStart={() => setStarted(true)} />;
  }
  return <WorkflowRunner spec={spec} onExit={() => setStarted(false)} />;
}
