// A standalone playing card — used in the player's hand.
import { formatCardValue } from '../../types/game';

interface Props {
  value: string;
  selected?: boolean;
  isDead?: boolean;
  onClick?: () => void;
}

export default function PlayingCard({ value, selected, isDead, onClick }: Props) {
  const { rank, suit, color } = formatCardValue(value);

  let className = 'playing-card';
  if (selected) className += ' selected';
  if (isDead) className += ' dead';

  return (
    <div className={className} style={{ color }} onClick={onClick} title={isDead ? 'Dead card — click to swap' : value}>
      <span className="card-corner top-left">
        <span className="card-rank">{rank}</span>
        <span className="card-suit">{suit}</span>
      </span>
      <span className="card-center-suit">{suit}</span>
      <span className="card-corner bottom-right">
        <span className="card-rank">{rank}</span>
        <span className="card-suit">{suit}</span>
      </span>
      {isDead && <span className="dead-badge">DEAD</span>}
    </div>
  );
}
