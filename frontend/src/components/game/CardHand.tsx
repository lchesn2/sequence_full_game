// The player's hand of cards displayed at the bottom of the screen.
import type { Card, Cell } from '../../types/game';
import { isDeadCard } from '../../types/game';
import PlayingCard from './PlayingCard';

interface Props {
  hand: Card[];
  board: Cell[][];
  selectedCardId: string | null;
  onSelectCard: (card: Card) => void;
  onSwapDeadCard: (card: Card) => void;
  disabled: boolean;
}

export default function CardHand({ hand, board, selectedCardId, onSelectCard, onSwapDeadCard, disabled }: Props) {
  return (
    <div className="card-hand">
      <p className="hand-label">Your Hand ({hand.length} cards)</p>
      <div className="hand-cards">
        {hand.map(card => {
          const dead = isDeadCard(board, card.value);
          return (
            <PlayingCard
              key={card.id}
              value={card.value}
              selected={selectedCardId === card.id}
              isDead={dead}
              onClick={() => {
                if (disabled) return;
                if (dead) {
                  onSwapDeadCard(card);
                } else {
                  onSelectCard(card);
                }
              }}
            />
          );
        })}
      </div>
      <p className="hand-hint">
        {disabled
          ? 'Waiting for AI…'
          : 'Click a card to select it, then click a highlighted cell on the board.'}
      </p>
    </div>
  );
}
