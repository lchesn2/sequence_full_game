import { Context } from 'hono';
import { createInitialGameState, applyPlayerMove, applyAITurn, applyChooseSequence, Move } from './gameEngine';
import { getBestAIMove } from './ai';

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  FRONTEND_URL: string;
}

// POST /api/game/start — create a fresh game state and return it
export async function handleStart(c: Context<{ Bindings: Env }>): Promise<Response> {
  const gameState = createInitialGameState();
  return c.json({ gameState });
}

// POST /api/game/move — player submits a move; worker validates, applies player
// move, then immediately runs the AI move, returns the updated state.
export async function handleMove(c: Context<{ Bindings: Env }>): Promise<Response> {
  let body: { gameState?: unknown; move?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.gameState || !body.move) {
    return c.json({ error: 'Missing gameState or move' }, 400);
  }

  const move = body.move as Move;
  let state = body.gameState as ReturnType<typeof createInitialGameState>;

  if (state.gameOver) {
    return c.json({ error: 'Game is already over' }, 400);
  }

  if (state.currentTurn !== 'player') {
    return c.json({ error: 'Not your turn' }, 400);
  }

  // Handle sequence choice (no card played — player is locking in their sequence)
  if (move.type === 'chooseSequence') {
    try {
      state = applyChooseSequence(state, move);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid sequence choice';
      return c.json({ error: message }, 400);
    }
    if (state.gameOver) return c.json({ gameState: state });
  } else {
    // Apply regular player move
    try {
      state = applyPlayerMove(state, move);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid move';
      return c.json({ error: message }, 400);
    }

    // If game ended after player move, return immediately
    if (state.gameOver) {
      return c.json({ gameState: state });
    }

    // If player must choose a sequence, return immediately (no AI turn yet)
    if (state.pendingSequenceChoice) {
      return c.json({ gameState: state });
    }
  }

  // Run AI move only if the player's move ended their turn
  // (dead card swaps are free and keep currentTurn = 'player')
  if (state.currentTurn === 'ai') {
    try {
      // Pass only what the AI is allowed to know — strip the player's hand.
      const aiMove = getBestAIMove({ ...state, playerHand: [] });
      state = applyAITurn(state, aiMove);
    } catch (err: unknown) {
      // AI error shouldn't crash the game — just return state as-is
      console.error('AI error:', err);
      state.currentTurn = 'player';
      state.message = 'Your turn — select a card then click a board cell.';
    }
  }

  return c.json({ gameState: state });
}
