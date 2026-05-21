import { assign, createActor, setup, type ActorRefFrom } from "xstate";
import type { FrameworkSpec, Step } from "../spec";
import { evalBranch } from "./branching";
import { validateStepInput } from "./validate";
import {
  loadSnapshot,
  saveSnapshot,
  clearSnapshot,
  type PersistedSnapshot,
  type Storage,
} from "./persist";

export const ARTIFACT_CURSOR = "artifact" as const;

export interface EngineContext {
  cursor: string;
  inputs: Record<string, unknown>;
  benchmarks: Record<string, unknown>;
}

type AdvanceEvent = { type: "ADVANCE"; stepId: string; input: unknown };
type SetBenchmarksEvent = { type: "SET_BENCHMARKS"; benchmarks: Record<string, unknown> };
type EngineEvent = AdvanceEvent | SetBenchmarksEvent;

function computeNextCursor(
  spec: FrameworkSpec,
  step: Step,
  allInputs: Record<string, unknown>,
  benchmarks: Record<string, unknown>,
): string {
  if (step.branching) {
    for (const branch of step.branching) {
      if (evalBranch(branch.if, { inputs: allInputs, benchmarks })) {
        return branch.next === ARTIFACT_CURSOR ? ARTIFACT_CURSOR : branch.next;
      }
    }
  }
  const idx = spec.steps.findIndex((s) => s.id === step.id);
  if (idx >= 0 && idx + 1 < spec.steps.length) {
    return spec.steps[idx + 1].id;
  }
  return ARTIFACT_CURSOR;
}

function isValidCursor(spec: FrameworkSpec, cursor: string): boolean {
  if (cursor === ARTIFACT_CURSOR) return true;
  return spec.steps.some((s) => s.id === cursor);
}

export function buildMachine(spec: FrameworkSpec) {
  return setup({
    types: {} as {
      context: EngineContext;
      events: EngineEvent;
      input: EngineContext | undefined;
    },
  }).createMachine({
    id: spec.id,
    initial: "running",
    context: ({ input }) =>
      input ?? { cursor: spec.steps[0].id, inputs: {}, benchmarks: {} },
    states: {
      running: {
        on: {
          ADVANCE: {
            actions: assign(({ context, event }) => {
              if (event.type !== "ADVANCE") return context;
              if (context.cursor === ARTIFACT_CURSOR) return context;
              const step = spec.steps.find((s) => s.id === context.cursor);
              if (!step) return context;
              const newInputs = {
                ...context.inputs,
                [step.id]: event.input,
              };
              const nextCursor = computeNextCursor(
                spec,
                step,
                newInputs,
                context.benchmarks,
              );
              return {
                inputs: newInputs,
                cursor: nextCursor,
                benchmarks: context.benchmarks,
              };
            }),
          },
          SET_BENCHMARKS: {
            actions: assign(({ context, event }) => {
              if (event.type !== "SET_BENCHMARKS") return context;
              return { ...context, benchmarks: event.benchmarks };
            }),
          },
        },
      },
    },
  });
}

export type EngineMachine = ReturnType<typeof buildMachine>;
export type EngineActor = ActorRefFrom<EngineMachine>;

export interface EngineOptions {
  storage?: Storage;
}

export interface CreateEngineResult {
  engine: Engine;
  notice: string | null;
}

export class Engine {
  private actor: EngineActor;
  public readonly spec: FrameworkSpec;
  private storage: Storage | null;

  constructor(spec: FrameworkSpec, opts: EngineOptions = {}, initial?: EngineContext) {
    this.spec = spec;
    this.storage = opts.storage ?? null;
    const machine = buildMachine(spec);
    this.actor = createActor(machine, { input: initial });
    this.actor.start();
  }

  static load(spec: FrameworkSpec, opts: EngineOptions = {}): CreateEngineResult {
    let initial: EngineContext | undefined;
    let notice: string | null = null;
    if (opts.storage) {
      const result = loadSnapshot(opts.storage, spec.id, spec.spec_version);
      notice = result.notice;
      if (result.snapshot) {
        if (!isValidCursor(spec, result.snapshot.cursor)) {
          clearSnapshot(opts.storage, spec.id);
          notice =
            "Saved progress referenced an unknown step and has been discarded.";
        } else if (
          !result.snapshot.inputs ||
          typeof result.snapshot.inputs !== "object"
        ) {
          clearSnapshot(opts.storage, spec.id);
          notice =
            "Saved progress had an invalid input shape and has been discarded.";
        } else {
          initial = {
            cursor: result.snapshot.cursor,
            inputs: result.snapshot.inputs,
            benchmarks: {},
          };
        }
      }
    }
    return { engine: new Engine(spec, opts, initial), notice };
  }

  setBenchmarks(benchmarks: Record<string, unknown>): void {
    this.actor.send({ type: "SET_BENCHMARKS", benchmarks });
  }

  benchmarks(): Record<string, unknown> {
    return this.actor.getSnapshot().context.benchmarks;
  }

  currentStep(): Step | null {
    const cursor = this.actor.getSnapshot().context.cursor;
    if (cursor === ARTIFACT_CURSOR) return null;
    return this.spec.steps.find((s) => s.id === cursor) ?? null;
  }

  cursor(): string {
    return this.actor.getSnapshot().context.cursor;
  }

  isDone(): boolean {
    return this.cursor() === ARTIFACT_CURSOR;
  }

  inputs(): Record<string, unknown> {
    return this.actor.getSnapshot().context.inputs;
  }

  advance(input: unknown): void {
    const step = this.currentStep();
    if (!step) {
      throw new Error("Workflow is already at artifact; cannot advance further.");
    }
    const allInputs = this.inputs();
    const cleaned = validateStepInput(step, input, allInputs);
    this.actor.send({ type: "ADVANCE", stepId: step.id, input: cleaned });
    if (this.storage) {
      saveSnapshot(this.storage, this.snapshot());
    }
  }

  snapshot(): PersistedSnapshot {
    return {
      specId: this.spec.id,
      specVersion: this.spec.spec_version,
      cursor: this.cursor(),
      inputs: this.inputs(),
    };
  }

  reset(): void {
    if (this.storage) clearSnapshot(this.storage, this.spec.id);
    const machine = buildMachine(this.spec);
    this.actor = createActor(machine, { input: undefined });
    this.actor.start();
  }
}
