import { BOARD_LAYOUT } from './board';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Card {
  id: string;     // unique: 'AS_0', 'AS_1' (two copies per card in 2-deck set)
  value: string;  // e.g. 'AS', 'TH', 'JC'
  rank: string;   // '2'..'9','T','J','Q','K','A'
  suit: string;   // 'S','H','D','C'
}

export interface Cell {
  card: string;                          // board card value, 'W' for corners
  chip: 'player' | 'ai' | 'wild' | null; // 'wild' = permanent free corner
  inSequence: boolean;                   // locked — cannot be removed by Jack
}

export interface Sequence {
  cells: { row: number; col: number }[];
  owner: 'player' | 'ai';
}

export interface GameState {
  board: Cell[][];
  playerHand: Card[];
  aiHand: Card[];
  deck: Card[];
  discardPile: Card[];
  currentTurn: 'player' | 'ai';
  playerSequences: Sequence[];
  aiSequences: Sequence[];
  gameOver: boolean;
  winner: 'player' | 'ai' | null;
  message: string;
}

export type Move =
  | { type: 'place';    cardId: string; row: number; col: number }
  | { type: 'remove';   cardId: string; row: number; col: number }
  | { type: 'deadcard'; cardId: string };

// ─── Card helpers ─────────────────────────────────────────────────────────────

const SUITS = ['S', 'H', 'D', 'C'] as const;
const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'] as const;

export function isOneEyedJack(value: string): boolean {
  return value === 'JS' || value === 'JH';
}

export function isTwoEyedJack(value: string): boolean {
  return value === 'JC' || value === 'JD';
}

export function isJack(value: string): boolean {
  return isOneEyedJack(value) || isTwoEyedJack(value);
}

// ─── Deck ─────────────────────────────────────────────────────────────────────

function createDeck(): Card[] {
  const cards: Card[] = [];
  for (let deck = 0; deck < 2; deck++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: `${rank}${suit}_${deck}`, value: `${rank}${suit}`, rank, suit });
      }
    }
  }
  return shuffle(cards);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Board ────────────────────────────────────────────────────────────────────

function createInitialBoard(): Cell[][] {
  return BOARD_LAYOUT.map(row =>
    row.map(card => ({
      card,
      chip: card === 'W' ? 'wild' : null,
      inSequence: false,
    }))
  );
}

// ─── Valid move queries ───────────────────────────────────────────────────────

export function getValidPositions(board: Cell[][], cardValue: string): { row: number; col: number }[] {
  const positions: { row: number; col: number }[] = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (board[r][c].card === cardValue && board[r][c].chip === null) {
        positions.push({ row: r, col: c });
      }
    }
  }
  return positions;
}

export function getEmptyPositions(board: Cell[][]): { row: number; col: number }[] {
  const positions: { row: number; col: number }[] = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (board[r][c].chip === null) positions.push({ row: r, col: c });
    }
  }
  return positions;
}

export function getRemovablePositions(board: Cell[][], target: 'player' | 'ai'): { row: number; col: number }[] {
  const positions: { row: number; col: number }[] = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const cell = board[r][c];
      if (cell.chip === target && !cell.inSequence) positions.push({ row: r, col: c });
    }
  }
  return positions;
}

export function isDeadCard(board: Cell[][], cardValue: string): boolean {
  if (isJack(cardValue)) return false;
  const cells = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (board[r][c].card === cardValue) cells.push(board[r][c]);
    }
  }
  return cells.length > 0 && cells.every(cell => cell.chip !== null);
}

// ─── Sequence detection ───────────────────────────────────────────────────────

const DIRECTIONS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 10 && c >= 0 && c < 10;
}

function detectAllSequences(board: Cell[][]): { player: Sequence[]; ai: Sequence[] } {
  const player: Sequence[] = [];
  const ai: Sequence[] = [];

  for (const [dr, dc] of DIRECTIONS) {
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        for (const owner of ['player', 'ai'] as const) {
          const cells: { row: number; col: number }[] = [];
          let valid = true;

          for (let i = 0; i < 5; i++) {
            const r = row + dr * i;
            const c = col + dc * i;
            if (!inBounds(r, c)) { valid = false; break; }
            const cell = board[r][c];
            if (cell.chip === owner || cell.chip === 'wild') {
              cells.push({ row: r, col: c });
            } else {
              valid = false; break;
            }
          }

          if (valid && cells.length === 5) {
            if (owner === 'player') player.push({ cells, owner });
            else ai.push({ cells, owner });
          }
        }
      }
    }
  }

  return { player, ai };
}

// Count chips shared between two sequences.
function countSharedCells(a: Sequence, b: Sequence): number {
  const setA = new Set(a.cells.map(c => `${c.row},${c.col}`));
  return b.cells.filter(c => setA.has(`${c.row},${c.col}`)).length;
}

// Return the sequences that legitimately count toward the win.
// Two sequences may share AT MOST 1 chip (the official rule).
// A 6-in-a-row only counts as 1 sequence because any two windows of 5
// within it share 4 chips.
function getValidSequencesForCount(all: Sequence[]): Sequence[] {
  if (all.length <= 1) return all;

  // Find any pair sharing ≤ 1 chip — that's the 2-sequence win.
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      if (countSharedCells(all[i], all[j]) <= 1) {
        return [all[i], all[j]];
      }
    }
  }

  // All detected sequences heavily overlap — only 1 counts.
  return [all[0]];
}

function updateSequences(state: GameState): void {
  const detected = detectAllSequences(state.board);

  // Only store sequences that legitimately count toward the win.
  state.playerSequences = getValidSequencesForCount(detected.player);
  state.aiSequences = getValidSequencesForCount(detected.ai);

  // Lock only the exact 5 chips that belong to each counted sequence.
  // Adjacent chips outside the sequence remain unlocked and removable.
  for (const seq of [...state.playerSequences, ...state.aiSequences]) {
    for (const { row, col } of seq.cells) {
      state.board[row][col].inSequence = true;
    }
  }
}

// ─── Game initialisation ──────────────────────────────────────────────────────

export function createInitialGameState(): GameState {
  const deck = createDeck();
  const playerHand = deck.splice(0, 7);
  const aiHand = deck.splice(0, 7);

  return {
    board: createInitialBoard(),
    playerHand,
    aiHand,
    deck,
    discardPile: [],
    currentTurn: 'player',
    playerSequences: [],
    aiSequences: [],
    gameOver: false,
    winner: null,
    message: 'Your turn — select a card then click a board cell.',
  };
}

// ─── Deep clone ───────────────────────────────────────────────────────────────

export function deepClone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

// ─── Apply player move ────────────────────────────────────────────────────────

export function applyPlayerMove(state: GameState, move: Move): GameState {
  const s = deepClone(state);

  // Locate the card in player hand
  const cardIdx = s.playerHand.findIndex((c: Card) => c.id === move.cardId);
  if (cardIdx === -1) throw new Error('Card not found in player hand');
  const [card] = s.playerHand.splice(cardIdx, 1);

  if (move.type === 'deadcard') {
    if (!isDeadCard(s.board, card.value)) throw new Error('Card is not dead');
    s.discardPile.push(card);
    if (s.deck.length > 0) s.playerHand.push(s.deck.shift()!);
    // Dead card swap is a free action — player keeps their turn.
    s.currentTurn = 'player';
    s.message = 'Dead card swapped — now select a card to play.';
    return s;
  }

  const { row, col } = move as { type: 'place' | 'remove'; cardId: string; row: number; col: number };

  if (move.type === 'remove') {
    // One-eyed Jack: validate target
    if (!isOneEyedJack(card.value)) throw new Error('Only one-eyed Jacks can remove chips');
    const cell = s.board[row][col];
    if (cell.chip !== 'ai') throw new Error('Can only remove opponent chips');
    if (cell.inSequence) throw new Error('Cannot remove a chip that is part of a completed sequence');
    s.board[row][col].chip = null;
  } else {
    // Place chip — regular card or two-eyed Jack
    if (isTwoEyedJack(card.value)) {
      if (s.board[row][col].chip !== null) throw new Error('Cell is already occupied');
    } else {
      if (s.board[row][col].card !== card.value) throw new Error('Card does not match cell');
      if (s.board[row][col].chip !== null) throw new Error('Cell is already occupied');
    }
    s.board[row][col].chip = 'player';
  }

  s.discardPile.push(card);
  if (s.deck.length > 0) s.playerHand.push(s.deck.shift()!);

  updateSequences(s);

  if (s.playerSequences.length >= 2) {
    s.gameOver = true;
    s.winner = 'player';
    s.message = 'You win! Congratulations!';
    return s;
  }

  s.currentTurn = 'ai';
  s.message = 'AI is thinking…';
  return s;
}

// ─── Apply AI move ────────────────────────────────────────────────────────────

export function applyAIMove(state: GameState): GameState {
  const s = deepClone(state);

  // Import AI here to avoid circular deps — call getBestAIMove externally
  // This function applies whatever move is passed in
  return s; // placeholder — AI move is applied via applyAITurn below
}

export function applyAITurn(state: GameState, aiMove: Move): GameState {
  const s = deepClone(state);

  const cardIdx = s.aiHand.findIndex((c: Card) => c.id === aiMove.cardId);
  if (cardIdx === -1) throw new Error('AI card not found');
  const [card] = s.aiHand.splice(cardIdx, 1);

  if (aiMove.type === 'deadcard') {
    s.discardPile.push(card);
    if (s.deck.length > 0) s.aiHand.push(s.deck.shift()!);
    s.currentTurn = 'player';
    s.message = 'Your turn — select a card then click a board cell.';
    return s;
  }

  const { row, col } = aiMove as { type: 'place' | 'remove'; cardId: string; row: number; col: number };

  let aiActionMessage: string;

  if (aiMove.type === 'remove') {
    const cellCard = s.board[row][col].card;
    const cardLabel = formatBoardCard(cellCard);
    s.board[row][col].chip = null;
    aiActionMessage = `AI played a one-eyed Jack and removed your chip from the ${cardLabel} cell!`;
  } else {
    s.board[row][col].chip = 'ai';
    aiActionMessage = '';
  }

  s.discardPile.push(card);
  if (s.deck.length > 0) s.aiHand.push(s.deck.shift()!);

  updateSequences(s);

  if (s.aiSequences.length >= 2) {
    s.gameOver = true;
    s.winner = 'ai';
    s.message = 'AI wins! Better luck next time.';
    return s;
  }

  s.currentTurn = 'player';
  s.message = aiActionMessage
    ? `${aiActionMessage} Your turn.`
    : 'Your turn — select a card then click a board cell.';
  return s;
}

// Human-readable label for a board cell card (e.g. "10♠", "A♥")
function formatBoardCard(card: string): string {
  if (card === 'W') return 'corner';
  const rankMap: Record<string, string> = { T: '10', Q: 'Q', K: 'K', A: 'A' };
  const suitMap: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  return `${rankMap[rank] ?? rank}${suitMap[suit] ?? suit}`;
}

// Re-export helpers needed by AI
export { inBounds, DIRECTIONS };
