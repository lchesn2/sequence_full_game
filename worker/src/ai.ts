import {
  GameState, Cell, Card, Move,
  isOneEyedJack, isTwoEyedJack, isJack, isDeadCard,
  getValidPositions, getEmptyPositions, getRemovablePositions,
  deepClone, inBounds, DIRECTIONS,
} from './gameEngine';

// ─── Public entry point ───────────────────────────────────────────────────────

export function getBestAIMove(state: GameState): Move {
  const moves = getAllLegalAIMoves(state);

  if (moves.length === 0) {
    // Fallback: swap a dead card (counts as turn)
    const dead = state.aiHand.find(c => isDeadCard(state.board, c.value));
    if (dead) return { type: 'deadcard', cardId: dead.id };
    // Absolute fallback — should not happen
    return { type: 'deadcard', cardId: state.aiHand[0].id };
  }

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    const score = scoreMove(state, move) + Math.random() * 2; // small noise
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

// ─── Enumerate all legal AI moves ────────────────────────────────────────────

function getAllLegalAIMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  const { board, aiHand } = state;

  for (const card of aiHand) {
    if (isOneEyedJack(card.value)) {
      // Remove any non-locked player chip
      for (const pos of getRemovablePositions(board, 'player')) {
        moves.push({ type: 'remove', cardId: card.id, ...pos });
      }
    } else if (isTwoEyedJack(card.value)) {
      // Place on any empty cell
      for (const pos of getEmptyPositions(board)) {
        moves.push({ type: 'place', cardId: card.id, ...pos });
      }
    } else {
      // Regular card — find matching board positions that are empty
      for (const pos of getValidPositions(board, card.value)) {
        moves.push({ type: 'place', cardId: card.id, ...pos });
      }
    }
  }

  return moves;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreMove(state: GameState, move: Move): number {
  const { board } = state;

  if (move.type === 'remove') {
    // One-eyed Jack: break up the longest player chain at this position
    const playerChain = longestChainAt(board, move as { row: number; col: number }, 'player');
    let score = playerChain * 15;
    // Extra bonus for breaking a chain of 4 (near-sequence)
    if (playerChain >= 4) score += 40;
    return score;
  }

  // Simulate placing AI chip (move.type is 'place' here — row/col exist)
  const placeMove = move as { type: 'place'; cardId: string; row: number; col: number };
  const simBoard = deepClone(board);
  (simBoard[placeMove.row][placeMove.col] as Cell).chip = 'ai';

  // Reward for building AI's own chain
  const aiChain = longestChainAt(simBoard, placeMove, 'ai');
  let score = aiChain * aiChain * 5; // quadratic — longer chains are exponentially better

  // Massive bonus for completing a sequence
  if (aiChain >= 5) score += 200;

  // Reward for blocking the player's chains
  const playerChain = longestChainAt(board, placeMove, 'player');
  if (playerChain >= 4) score += 80;  // block a near-sequence
  else if (playerChain >= 3) score += 30;
  else if (playerChain >= 2) score += 10;

  return score;
}

// ─── Chain length helper ──────────────────────────────────────────────────────
// Returns the maximum number of chips (owner + wild corners) in any window of 5
// passing through `pos`, excluding windows blocked by the opponent.

function longestChainAt(
  board: Cell[][],
  pos: { row: number; col: number },
  owner: 'player' | 'ai',
): number {
  let max = 0;

  for (const [dr, dc] of DIRECTIONS) {
    // Try all 5-cell windows that include pos
    for (let start = -4; start <= 0; start++) {
      let count = 0;
      let valid = true;

      for (let i = 0; i < 5; i++) {
        const r = pos.row + (start + i) * dr;
        const c = pos.col + (start + i) * dc;

        if (!inBounds(r, c)) { valid = false; break; }
        const cell = board[r][c];

        if (cell.chip === owner || cell.chip === 'wild') {
          count++;
        } else if (cell.chip !== null) {
          // Opponent chip blocks this window
          valid = false; break;
        }
        // null = empty — valid but contributes 0
      }

      if (valid) max = Math.max(max, count);
    }
  }

  return max;
}
