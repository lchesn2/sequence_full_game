// ─── Shared types (mirror of worker/src/gameEngine.ts) ───────────────────────

export interface Card {
  id: string;
  value: string;  // e.g. 'AS', 'TH', 'JC'
  rank: string;
  suit: string;
}

export interface Cell {
  card: string;
  chip: 'player' | 'ai' | 'wild' | null;
  inSequence: boolean;
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

// ─── Frontend-only helpers ────────────────────────────────────────────────────

export const BOARD_LAYOUT: string[][] = [
  ['W',  '2S', '3S', '4S', '5S', '6S', '7S', '8S', '9S', 'W' ],
  ['6C', '5C', '4C', '3C', '2C', 'AH', 'KH', 'QH', 'TH', 'TS'],
  ['7C', 'AS', '2D', '3D', '4D', '5D', '6D', '7D', '9H', 'QS'],
  ['8C', 'KS', '6C', '5C', '4C', '3C', '2C', '8D', '8H', 'KS'],
  ['9C', 'QS', '7C', '6H', '5H', '4H', 'AH', '9D', '7H', 'AS'],
  ['TC', 'TS', '8C', '7H', '2H', '3H', 'KH', 'TD', '6H', '2D'],
  ['QC', '9S', '9C', '8H', '9H', 'TH', 'QH', 'QD', '5H', '3D'],
  ['KC', '8S', 'TC', 'QC', 'KC', 'AC', 'AD', 'KD', '4H', '4D'],
  ['AC', '7S', '6S', '5S', '4S', '3S', '2S', '2H', '3H', '5D'],
  ['W',  'AD', 'KD', 'QD', 'TD', '9D', '8D', '7D', '6D', 'W' ],
];

export function isOneEyedJack(value: string): boolean {
  return value === 'JS' || value === 'JH';
}

export function isTwoEyedJack(value: string): boolean {
  return value === 'JC' || value === 'JD';
}

export function isJack(value: string): boolean {
  return isOneEyedJack(value) || isTwoEyedJack(value);
}

export function isDeadCard(board: Cell[][], cardValue: string): boolean {
  if (isJack(cardValue)) return false;
  const cells: Cell[] = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (board[r][c].card === cardValue) cells.push(board[r][c]);
    }
  }
  return cells.length > 0 && cells.every(cell => cell.chip !== null);
}

// Returns all board positions where the given card can be placed
export function getValidPositions(board: Cell[][], cardValue: string): { row: number; col: number }[] {
  if (isOneEyedJack(cardValue)) {
    // Highlights opponent chips that can be removed
    const pos: { row: number; col: number }[] = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (board[r][c].chip === 'ai' && !board[r][c].inSequence) pos.push({ row: r, col: c });
      }
    }
    return pos;
  }
  if (isTwoEyedJack(cardValue)) {
    // Any empty cell
    const pos: { row: number; col: number }[] = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (board[r][c].chip === null) pos.push({ row: r, col: c });
      }
    }
    return pos;
  }
  // Regular card
  const pos: { row: number; col: number }[] = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      if (board[r][c].card === cardValue && board[r][c].chip === null) pos.push({ row: r, col: c });
    }
  }
  return pos;
}

export function formatCardValue(value: string): { rank: string; suit: string; display: string; color: string } {
  if (value === 'W') return { rank: '★', suit: '', display: '★', color: 'gold' };
  const rankMap: Record<string, string> = { T: '10', J: 'J', Q: 'Q', K: 'K', A: 'A' };
  const suitMap: Record<string, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const rank = value.slice(0, -1);
  const suit = value.slice(-1);
  const displayRank = rankMap[rank] ?? rank;
  const displaySuit = suitMap[suit] ?? suit;
  const color = suit === 'H' || suit === 'D' ? '#c0392b' : '#1a1a2e';
  return { rank: displayRank, suit: displaySuit, display: `${displayRank}${displaySuit}`, color };
}
