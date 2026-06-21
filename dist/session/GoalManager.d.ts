/**
 * GoalManager — cross-session persistent goal tracking. (#12)
 *
 * Goals set in one session survive restarts and are injected into the
 * system prompt on every subsequent session. This gives the agent
 * continuity — it knows what it was asked to watch or do.
 *
 * Stored in ~/.jelly/goals.json
 * Tools: set_goal, complete_goal, list_goals, update_goal_notes
 * Commands: /goals, /goal add <text>, /goal done <id>
 */
import { type Static } from "@sinclair/typebox";
export interface Goal {
    id: string;
    text: string;
    createdAt: number;
    updatedAt: number;
    status: "active" | "completed" | "paused";
    notes: string[];
}
export declare class GoalManager {
    private goals;
    constructor();
    private load;
    private save;
    add(text: string): Goal;
    complete(id: string): boolean;
    pause(id: string): boolean;
    addNote(id: string, note: string): boolean;
    getActive(): Goal[];
    getAll(): Goal[];
    get(id: string): Goal | undefined;
    /** Build an active goals block for injection into the system prompt */
    buildContextBlock(): string;
    readonly setGoalParams: import("@sinclair/typebox").TObject<{
        text: import("@sinclair/typebox").TString;
    }>;
    setGoalTool(_id: string, params: Static<typeof this.setGoalParams>): Promise<{
        content: {
            type: "text";
            text: string;
        }[];
        details: {
            goalId: string;
            text: string;
        };
    }>;
    readonly completeGoalParams: import("@sinclair/typebox").TObject<{
        id: import("@sinclair/typebox").TString;
        note: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    }>;
    completeGoalTool(_id: string, params: Static<typeof this.completeGoalParams>): Promise<{
        content: {
            type: "text";
            text: string;
        }[];
        details: {
            goalId: string;
            success: boolean;
        };
    }>;
    readonly listGoalsParams: import("@sinclair/typebox").TObject<{
        status: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    }>;
    listGoalsTool(_id: string, params: Static<typeof this.listGoalsParams>): Promise<{
        content: {
            type: "text";
            text: string;
        }[];
        details: {
            count?: undefined;
            goals?: undefined;
        };
    } | {
        content: {
            type: "text";
            text: string;
        }[];
        details: {
            count: number;
            goals: Goal[];
        };
    }>;
    readonly addGoalNoteParams: import("@sinclair/typebox").TObject<{
        id: import("@sinclair/typebox").TString;
        note: import("@sinclair/typebox").TString;
    }>;
    addGoalNoteTool(_id: string, params: Static<typeof this.addGoalNoteParams>): Promise<{
        content: {
            type: "text";
            text: string;
        }[];
        details: {
            goalId: string;
            success: boolean;
        };
    }>;
}
/** Singleton */
export declare const goalManager: GoalManager;
//# sourceMappingURL=GoalManager.d.ts.map