import {
  GameState, Cell, Card, Move,
  isOneEyedJack, isTwoEyedJack, isJack, isDeadCard,
  getValidPositions, getEmptyPositions, getRemovablePositions,
  deepClone, inBounds, DIRECTIONS,
} from './gameEngine';

// ─── Public entry point ───────────────────────────────────────────────────────

export function getBestAIMove(state: GameState): Exclude<Move, { type: 'chooseSequence' }> {
  const moves = getAllLegalAIMoves(state);

  if (moves.length === 0) {
    // Fallback: swap a dead card (counts as turn)
    const dead = state.aiHand.find(c => isDeadCard(state.board, c.value));
    if (dead) return { type: 'deadcard', cardId: dead.id };
    // Absolute fallback — should not happen
    return { type: 'deadcard', cardId: state.aiHand[0].id };
  }

  // Build cardId → cardValue from the AI's hand (aiHand is intact; only
  // playerHand is stripped for privacy before this function is called).
  const cardValueById = new Map(state.aiHand.map(c => [c.id, c.value]));

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    const cardValue = cardValueById.get((move as { cardId: string }).cardId) ?? '';
    const score = scoreMove(state, move, cardValue) + Math.random() * 2; // small noise
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

// ─── Enumerate all legal AI moves ────────────────────────────────────────────

function getAllLegalAIMoves(state: GameState): Exclude<Move, { type: 'chooseSequence' }>[] {
  const moves: Exclude<Move, { type: 'chooseSequence' }>[] = [];
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

function scoreMove(state: GameState, move: Move, cardValue: string): number {
  const { board } = state;

  if (move.type === 'remove') {
    // One-eyed Jack: score using multi-directional threat analysis.
    //
    // The old approach (longestChainAt → single max) was blind to double-blocks:
    // a chip at the intersection of two 4-chains scored the same as one in a
    // single 4-chain. We now score each direction independently and apply a large
    // bonus when the target chip sits on multiple threatening axes simultaneously.
    const removePos = move as { row: number; col: number };
    const chains = directionalChainsAt(board, removePos, 'player');
    const maxChain = Math.max(...chains);
    const threateningAxes = chains.filter(c => c >= 3).length;

    let score = 0;
    // Sum of squares across all 4 directions — rewards multi-threat geometrically.
    for (const c of chains) score += c * c * 8;
    // Bonus for breaking a near-sequence (chain of 4) on any axis.
    if (maxChain >= 4) score += 50;
    // Double-block bonus: chip sits on 2+ dangerous axes at once.
    if (threateningAxes >= 2) score += 120;
    // Conservation penalty: prevent burning a 1EJ on an isolated or weak chip.
    // Effect: chain-of-1 → ~-62, chain-of-2 → ~-38, chain-of-3 → ~2,
    //         chain-of-4 single → ~108, double 4-chain → ~406.
    score -= 70;

    return score;
  }

  // ── Place move (regular card or two-eyed Jack) ────────────────────────────

  const placeMove = move as { type: 'place'; cardId: string; row: number; col: number };
  const simBoard = deepClone(board);
  (simBoard[placeMove.row][placeMove.col] as Cell).chip = 'ai';

  // Multi-axis AI build: sum chain² across all 4 directions (not just the max).
  // This rewards placements that simultaneously build two lines at once.
  const aiChains = directionalChainsAt(simBoard, placeMove, 'ai');
  let score = 0;
  for (const c of aiChains) score += c * c * 4; // weight 4 per axis (was 5 single-axis)

  // Massive bonus for completing a sequence on any axis.
  if (Math.max(...aiChains) >= 5) score += 200;

  // Multi-axis player blocking: credit each threatening axis independently.
  // Old approach only counted the single worst axis; dual-threat blocks are
  // now worth proportionally more.
  const playerChains = directionalChainsAt(board, placeMove, 'player');
  for (const c of playerChains) {
    if (c >= 4) score += 65;
    else if (c >= 3) score += 25;
    else if (c >= 2) score += 8;
  }

  // Open window potential + dead placement detection.
  // openWindowCount counts how many 5-cell windows through this position
  // have no opponent chips — each is a realistic future sequence path.
  // Zero open windows means the chip can never be part of a sequence.
  const openWindows = openWindowCount(simBoard, placeMove, 'ai');
  if (openWindows === 0) {
    score = Math.min(score, -10); // dead placement: deprioritize strongly
  } else {
    score += openWindows * 1.5;   // future potential bonus (small but distinguishing)
  }

  // Conservation penalty for two-eyed Jack: prefer regular cards for routine
  // placements. The 2EJ should only win when no regular card achieves comparable
  // value at that position (e.g. completing a sequence or blocking a 4-chain).
  if (isTwoEyedJack(cardValue)) score -= 30;

  return score;
}

// ─── Per-direction chain helper ───────────────────────────────────────────────
// Returns an array of 4 chain lengths — one per DIRECTION — through `pos`.
// Each value is the longest unblocked run of owner+wild chips in that axis.
// Unlike longestChainAt (which returns only the max), this preserves per-axis
// information so multi-threat positions can be scored accurately.

function directionalChainsAt(
  board: Cell[][],
  pos: { row: number; col: number },
  owner: 'player' | 'ai',
): number[] {
  return DIRECTIONS.map(([dr, dc]) => {
    let max = 0;
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
          valid = false; break;
        }
      }
      if (valid) max = Math.max(max, count);
    }
    return max;
  });
}

// ─── Open window helper ───────────────────────────────────────────────────────
// Counts how many distinct 5-cell windows through `pos` contain no opponent chips.
// Each open window represents a realistically achievable future sequence path.
// A count of zero means the placement is "dead" — it can never be part of a sequence.

function openWindowCount(
  board: Cell[][],
  pos: { row: number; col: number },
  owner: 'player' | 'ai',
): number {
  const opponent: 'player' | 'ai' = owner === 'ai' ? 'player' : 'ai';
  let count = 0;
  for (const [dr, dc] of DIRECTIONS) {
    for (let start = -4; start <= 0; start++) {
      let blocked = false;
      for (let i = 0; i < 5; i++) {
        const r = pos.row + (start + i) * dr;
        const c = pos.col + (start + i) * dc;
        if (!inBounds(r, c)) { blocked = true; break; }
        if (board[r][c].chip === opponent) { blocked = true; break; }
      }
      if (!blocked) count++;
    }
  }
  return count;
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
