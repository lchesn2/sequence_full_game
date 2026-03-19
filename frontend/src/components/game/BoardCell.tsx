// One cell in the 10x10 board grid.
import type { Cell } from '../../types/game';
import { formatCardValue } from '../../types/game';

interface Props {
  cell: Cell;
  row: number;
  col: number;
  isValidTarget: boolean;   // highlighted because selected card can go here
  isHighlighted: boolean;   // highlighted as a sequence choice candidate
  onClick: (row: number, col: number) => void;
}

export default function BoardCell({ cell, row, col, isValidTarget, isHighlighted, onClick }: Props) {
  const { rank, suit, color } = formatCardValue(cell.card);
  const isWild = cell.card === 'W';

  let className = 'board-cell';
  if (isWild) className += ' wild-corner';
  if (isValidTarget) className += ' valid-target';
  if (isHighlighted) className += ' sequence-candidate';
  if (cell.inSequence) className += ' in-sequence';

  return (
    <div className={className} onClick={() => onClick(row, col)}>
      {/* Card label — stacked rank + suit in top-left corner */}
      {!isWild && (
        <span className="cell-card-label" style={{ color }}>
          <span className="cell-rank">{rank}</span>
          <span className="cell-suit">{suit}</span>
        </span>
      )}
      {isWild && (
        <span className="cell-card-label" style={{ color: 'gold' }}>★</span>
      )}

      {/* Chip overlay */}
      {cell.chip === 'player' && (
        <div className={`chip player-chip${cell.inSequence ? ' sequence-chip' : ''}`} />
      )}
      {cell.chip === 'ai' && (
        <div className={`chip ai-chip${cell.inSequence ? ' sequence-chip' : ''}`} />
      )}
      {cell.chip === 'wild' && (
        <div className="chip wild-chip" />
      )}

      {/* Valid target pulse ring */}
      {isValidTarget && <div className="target-ring" />}

      {/* Sequence candidate highlight ring */}
      {isHighlighted && <div className="candidate-ring" />}
    </div>
  );
}
