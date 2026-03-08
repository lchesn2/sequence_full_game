import type { Cell } from '../../types/game';
import BoardCell from './BoardCell';

interface Props {
  board: Cell[][];
  validTargets: { row: number; col: number }[];
  highlightedCells: Set<string>;
  onCellClick: (row: number, col: number) => void;
}

export default function Board({ board, validTargets, highlightedCells, onCellClick }: Props) {
  // Build a Set of "row,col" strings for O(1) lookup
  const targetSet = new Set(validTargets.map(p => `${p.row},${p.col}`));

  return (
    <div className="board-grid">
      {board.map((row, rIdx) =>
        row.map((cell, cIdx) => (
          <BoardCell
            key={`${rIdx}-${cIdx}`}
            cell={cell}
            row={rIdx}
            col={cIdx}
            isValidTarget={targetSet.has(`${rIdx},${cIdx}`)}
            isHighlighted={highlightedCells.has(`${rIdx},${cIdx}`)}
            onClick={onCellClick}
          />
        ))
      )}
    </div>
  );
}
