// One cell in the 10x10 board grid.
import type { Cell } from '../../types/game';
import { formatCardValue } from '../../types/game';

interface Props {
  cell: Cell;
  row: number;
  col: number;
  isValidTarget: boolean;   // highlighted because selected card can go here
  onClick: (row: number, col: number) => void;
}

export default function BoardCell({ cell, row, col, isValidTarget, onClick }: Props) {
  const { rank, suit, color } = formatCardValue(cell.card);
  const isWild = cell.card === 'W';

  let className = 'board-cell';
  if (isWild) className += ' wild-corner';
  if (isValidTarget) className += ' valid-target';
  if (cell.inSequence) className += ' in-sequence';

  return (
    <div className={className} onClick={() => onClick(row, col)}>
      {/* Card label — small text showing rank+suit */}
      <span className="cell-card-label" style={{ color: isWild ? 'gold' : color }}>
        {isWild ? '★' : `${rank}${suit}`}
      </span>

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
    </div>
  );
}
