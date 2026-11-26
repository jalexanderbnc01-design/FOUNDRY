import {
  BoardElement,
  BoardOperation,
  CreateElementOp,
  UpdateElementOp,
  DeleteElementOp,
  BatchCreateOp,
  BatchUpdateOp,
  BatchDeleteOp,
  ConflictResolutionResult,
} from "../types";

/**
 * Generate unique operation & transaction identifiers
 */
export function createOperationId(): string {
  return "op_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now().toString(36);
}

export function createTransactionId(): string {
  return "tx_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now().toString(36);
}

/**
 * Generates the deterministic inverse operation of any given BoardOperation.
 * When applied, the inverse returns the affected elements to their previous state.
 */
export function generateInverseOperation(
  op: BoardOperation,
  actorId: string,
  actorName?: string
): BoardOperation {
  const timestamp = Date.now();
  const operationId = createOperationId();
  const transactionId = op.transactionId; // keeps same transaction grouping if chained

  switch (op.type) {
    case "create": {
      // Inverse of create is delete
      const inverse: DeleteElementOp = {
        type: "delete",
        operationId,
        transactionId,
        boardId: op.boardId,
        actorId,
        actorName,
        timestamp,
        description: `Undo create ${op.element.type}`,
        elementId: op.element.id,
        before: JSON.parse(JSON.stringify(op.element)),
        baseRevision: op.element.revision,
      };
      return inverse;
    }

    case "delete": {
      // Inverse of delete is recreate
      const inverse: CreateElementOp = {
        type: "create",
        operationId,
        transactionId,
        boardId: op.boardId,
        actorId,
        actorName,
        timestamp,
        description: `Undo delete ${op.before.type}`,
        element: JSON.parse(JSON.stringify(op.before)),
      };
      return inverse;
    }

    case "update": {
      // Inverse of update restores the 'before' state
      const inverse: UpdateElementOp = {
        type: "update",
        operationId,
        transactionId,
        boardId: op.boardId,
        actorId,
        actorName,
        timestamp,
        description: `Undo ${op.description}`,
        elementId: op.elementId,
        before: JSON.parse(JSON.stringify(op.after)),
        after: JSON.parse(JSON.stringify(op.before)),
        baseRevision: op.baseRevision,
      };
      return inverse;
    }

    case "batch_create": {
      // Inverse of batch create is batch delete
      const inverse: BatchDeleteOp = {
        type: "batch_delete",
        operationId,
        transactionId,
        boardId: op.boardId,
        actorId,
        actorName,
        timestamp,
        description: `Undo create ${op.elements.length} items`,
        elements: JSON.parse(JSON.stringify(op.elements)),
      };
      return inverse;
    }

    case "batch_delete": {
      // Inverse of batch delete is batch create
      const inverse: BatchCreateOp = {
        type: "batch_create",
        operationId,
        transactionId,
        boardId: op.boardId,
        actorId,
        actorName,
        timestamp,
        description: `Undo delete ${op.elements.length} items`,
        elements: JSON.parse(JSON.stringify(op.elements)),
      };
      return inverse;
    }

    case "batch_update": {
      // Inverse of batch update restores each item's 'before' state
      const inverse: BatchUpdateOp = {
        type: "batch_update",
        operationId,
        transactionId,
        boardId: op.boardId,
        actorId,
        actorName,
        timestamp,
        description: `Undo ${op.description}`,
        updates: op.updates.map((u) => ({
          id: u.id,
          before: JSON.parse(JSON.stringify(u.after)),
          after: JSON.parse(JSON.stringify(u.before)),
          baseRevision: u.baseRevision,
        })),
      };
      return inverse;
    }
  }
}

/**
 * Three-way field-aware conflict reconciliation.
 * Given:
 * - current: The latest authoritative state on the board right now
 * - before: The state the element had before User A's operation
 * - after: The state User A produced (which User A now wants to undo back to before)
 *
 * Checks which fields User A modified, and whether User B has concurrently modified
 * those same fields. If User B modified unrelated fields (e.g. content while User A moved coordinates),
 * User B's modifications are safely preserved! If User B modified the exact same field (e.g. color),
 * we flag the conflict and protect User B's newer edits.
 */
export function reconcileUpdateWithConflict(
  current: BoardElement | undefined,
  before: BoardElement,
  after: BoardElement
): ConflictResolutionResult {
  // Case 1: Target element was deleted by another user
  if (!current) {
    return {
      hasConflict: true,
      canApplyPartial: false,
      reason: "Element was deleted by another collaborator",
    };
  }

  // Find fields that the operation being undone had changed (from before to after)
  const allKeys = new Set([
    ...Object.keys(before),
    ...Object.keys(after),
  ]) as Set<keyof BoardElement>;

  const changedKeys: (keyof BoardElement)[] = [];
  allKeys.forEach((key) => {
    if (key === "revision") return;
    const bVal = (before as any)[key];
    const aVal = (after as any)[key];
    if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
      changedKeys.push(key);
    }
  });

  // If no fields were changed, no-op
  if (changedKeys.length === 0) {
    return {
      hasConflict: false,
      canApplyPartial: true,
      reconciledElement: { ...current },
    };
  }

  const conflictingFields: string[] = [];
  const safeFieldsToRevert: (keyof BoardElement)[] = [];

  changedKeys.forEach((key) => {
    const curVal = (current as any)[key];
    const afterVal = (after as any)[key];

    // If current value equals after value, User B did NOT modify this field!
    // It is safe to revert to before value.
    if (JSON.stringify(curVal) === JSON.stringify(afterVal)) {
      safeFieldsToRevert.push(key);
    } else {
      // User B modified this field after User A. Conflict detected!
      conflictingFields.push(String(key));
    }
  });

  // Case 2: All modified fields were also modified by someone else -> Full conflict
  if (safeFieldsToRevert.length === 0) {
    return {
      hasConflict: true,
      canApplyPartial: false,
      conflictingFields,
      reason: `Properties (${conflictingFields.join(", ")}) were modified by another collaborator`,
    };
  }

  // Case 3: Some or all fields are safe to revert
  const reconciledElement: BoardElement = { ...current };
  safeFieldsToRevert.forEach((key) => {
    const bVal = (before as any)[key];
    if (bVal === undefined) {
      delete (reconciledElement as any)[key];
    } else {
      (reconciledElement as any)[key] = JSON.parse(JSON.stringify(bVal));
    }
  });

  return {
    hasConflict: conflictingFields.length > 0,
    canApplyPartial: true,
    conflictingFields,
    reason:
      conflictingFields.length > 0
        ? `Reverted non-conflicting fields, preserved newer collaborator edits on (${conflictingFields.join(", ")})`
        : undefined,
    reconciledElement,
  };
}
