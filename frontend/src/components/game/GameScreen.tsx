import { useState, useCallback } from 'react';
import type { GameState, Card, Move, Sequence } from '../../types/game';
import { getValidPositions, isOneEyedJack, formatCardValue } from '../../types/game';
import { apiStartGame, apiMove } from '../../api/client';
import Board from './Board';
import CardHand from './CardHand';
import PlayingCard from './PlayingCard';

interface Props {
  username: string;
  onLogout: () => void;
}

export default function GameScreen({ username, onLogout }: Props) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastPlayedInfo, setLastPlayedInfo] = useState<{ value: string; by: 'player' | 'ai' } | null>(null);
  const [highlightedCells, setHighlightedCells] = useState<Set<string>>(new Set());
  const [overlayDismissed, setOverlayDismissed] = useState(false);

  // ─── Start a new game ─────────────────────────────────────────────────────

  async function startGame() {
    setIsLoading(true);
    setErrorMsg('');
    setSelectedCard(null);
    setLastPlayedInfo(null);
    setOverlayDismissed(false);
    try {
      const { gameState: gs } = await apiStartGame();
      setGameState(gs as GameState);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to start game');
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Send a move to the worker ─────────────────────────────────────────────

  // stateSnapshot is passed explicitly so the API always receives the pre-move
  // board, even if an optimistic setGameState() fires a re-render first.
  const submitMove = useCallback(async (stateSnapshot: GameState, move: Move, triggersAI: boolean): Promise<GameState | null> => {
    setIsLoading(true);
    setErrorMsg('');
    setSelectedCard(null);
    const start = Date.now();
    try {
      const { gameState: gs } = await apiMove(stateSnapshot, move);
      const nextState = gs as GameState;
      // Pad time when an AI move followed — not for dead card swaps or pending sequence choices.
      // Note: by the time the response arrives the AI has already moved, so currentTurn is
      // back to 'player'. We detect "AI ran" by the absence of pendingSequenceChoice.
      if (triggersAI && !nextState.pendingSequenceChoice) {
        const elapsed = Date.now() - start;
        const MIN_DELAY = 1500;
        if (elapsed < MIN_DELAY) {
          await new Promise(res => setTimeout(res, MIN_DELAY - elapsed));
        }
      }
      setGameState(nextState);
      return nextState;
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Move failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ─── Card selection ────────────────────────────────────────────────────────

  function handleSelectCard(card: Card) {
    // Toggle: clicking the same card deselects it
    setSelectedCard(prev => prev?.id === card.id ? null : card);
  }

  // ─── Dead card swap (free action — does not end the player's turn) ─────────

  async function handleSwapDeadCard(card: Card) {
    if (!gameState) return;
    const snapshot = gameState;
    await submitMove(snapshot, { type: 'deadcard', cardId: card.id }, false);
  }

  // ─── Cell click ───────────────────────────────────────────────────────────

  async function handleCellClick(row: number, col: number) {
    if (!selectedCard || !gameState || isLoading) return;
    if (gameState.currentTurn !== 'player') return;
    if (!validTargets.some(t => t.row === row && t.col === col)) return;

    // Capture state before any mutation — this is what gets sent to the API.
    const snapshot = gameState;
    const cardPlayed = selectedCard;
    const moveType = isOneEyedJack(cardPlayed.value) ? 'remove' : 'place';

    // Show the player's chip and their card instantly before the API round-trip.
    const optimistic = JSON.parse(JSON.stringify(snapshot)) as GameState;
    optimistic.board[row][col].chip = moveType === 'place' ? 'player' : null;
    optimistic.currentTurn = 'ai'; // lets the status bar show "AI is thinking…"
    setGameState(optimistic);
    setLastPlayedInfo({ value: cardPlayed.value, by: 'player' });

    const gs = await submitMove(snapshot, { type: moveType, cardId: cardPlayed.id, row, col }, true);

    // After the AI delay, switch the display to the AI's card.
    if (gs && gs.discardPile.length > 0) {
      const aiCard = gs.discardPile[gs.discardPile.length - 1];
      setLastPlayedInfo({ value: aiCard.value, by: 'ai' });
    }
  }

  // ─── Sequence choice (when 6+ chips in a row) ─────────────────────────────

  const pendingChoice = gameState?.pendingSequenceChoice ?? null;

  async function handleChooseSequence(seq: Sequence) {
    if (!gameState) return;
    setHighlightedCells(new Set());
    const snapshot = gameState;
    await submitMove(snapshot, { type: 'chooseSequence', cells: seq.cells }, true);
  }

  function seqLabel(seq: Sequence): string {
    return seq.cells
      .map(({ row, col }) => {
        const card = gameState!.board[row][col].card;
        if (card === 'W') return '★';
        const { rank, suit } = formatCardValue(card);
        return `${rank}${suit}`;
      })
      .join(' · ');
  }

  // ─── Compute valid targets for the selected card ───────────────────────────

  const validTargets = (gameState && selectedCard && !pendingChoice && !gameState.gameOver && !isLoading)
    ? getValidPositions(gameState.board, selectedCard.value)
    : [];

  const isPlayerTurn = gameState?.currentTurn === 'player' && !gameState.gameOver && !isLoading && !pendingChoice;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="game-screen">
      {/* Header */}
      <header className="game-header">
        <div className="header-left">
          <span className="logo-text">Sequence</span>
          <span className="welcome-text">Welcome, {username}</span>
        </div>
        <div className="header-right">
          <div className="sequence-counts">
            <span className="seq-count player">You: {gameState?.playerSequences.length ?? 0}/2 seq</span>
            <span className="seq-count ai">AI: {gameState?.aiSequences.length ?? 0}/2 seq</span>
          </div>
          <button className="btn-secondary" onClick={startGame} disabled={isLoading}>
            {gameState ? 'New Game' : 'Start Game'}
          </button>
          <button className="btn-ghost" onClick={onLogout}>Log Out</button>
        </div>
      </header>

      {/* Error banner */}
      {errorMsg && <div className="error-banner">{errorMsg}</div>}

      {/* Game over overlay */}
      {gameState?.gameOver && !overlayDismissed && (
        <div className="gameover-overlay">
          <div className="gameover-card">
            <h2>
              {gameState.winner === 'player'
                ? 'You Win!'
                : gameState.winner === 'ai'
                ? 'AI Wins!'
                : 'Tie — No Winner!'}
            </h2>
            <p>{gameState.message}</p>
            {gameState.winner === 'ai' && (
              <button className="btn-secondary" onClick={() => setOverlayDismissed(true)}>
                View Board
              </button>
            )}
            <button className="btn-primary" onClick={startGame}>
              {gameState.winner === 'ai' ? 'New Game' : 'Play Again'}
            </button>
          </div>
        </div>
      )}

      {/* Dismissed overlay — sticky new game bar */}
      {gameState?.gameOver && overlayDismissed && (
        <div className="gameover-banner">
          <span>AI wins! Inspect the board, then start a new game.</span>
          <button className="btn-primary" onClick={startGame}>New Game</button>
        </div>
      )}

      {/* Status message */}
      {gameState && !gameState.gameOver && (
        <div className={`status-bar ${isLoading ? 'loading' : ''}`}>
          {isLoading
            ? (gameState.currentTurn === 'ai' ? 'AI is thinking…' : 'Swapping card…')
            : gameState.message}
        </div>
      )}

      {/* Main game area */}
      {gameState ? (
        <div className="game-area">
          {/* Board */}
          <div className="board-wrapper">
            <Board
              board={gameState.board}
              validTargets={validTargets}
              highlightedCells={highlightedCells}
              onCellClick={handleCellClick}
            />
          </div>

          {/* Info sidebar */}
          <div className="game-sidebar">
            <div className="info-block">
              <h3>Deck</h3>
              <p>{gameState.deck.length} cards remaining</p>
            </div>

            <div className="info-block">
              <h3>AI Hand</h3>
              <div className="ai-hand-backs">
                {Array.from({ length: gameState.aiHand.length }).map((_, i) => (
                  <div key={i} className="card-back" />
                ))}
              </div>
            </div>

            <div className="info-block legend">
              <h3>Legend</h3>
              <div className="legend-row"><div className="chip player-chip small" /> You (blue)</div>
              <div className="legend-row"><div className="chip ai-chip small" /> AI (green)</div>
              <div className="legend-row"><div className="chip wild-chip small" /> Free corner</div>
            </div>

            {lastPlayedInfo && (
              <div className="info-block last-played-block">
                <h3>Last Played</h3>
                <p className={`played-by-label ${lastPlayedInfo.by}`}>
                  {lastPlayedInfo.by === 'player' ? 'You played' : 'AI played'}
                </p>
                <div className="last-played-card-wrap">
                  <PlayingCard
                    key={`${lastPlayedInfo.value}-${lastPlayedInfo.by}`}
                    value={lastPlayedInfo.value}
                  />
                </div>
              </div>
            )}

            {pendingChoice && (
              <div className="info-block sequence-picker">
                <h3>Choose Your Sequence</h3>
                <p className="hint-text">Hover to preview, click to lock in.</p>
                {pendingChoice.map((seq, i) => (
                  <button
                    key={i}
                    className="btn-secondary sequence-option"
                    onMouseEnter={() => setHighlightedCells(new Set(seq.cells.map(c => `${c.row},${c.col}`)))}
                    onMouseLeave={() => setHighlightedCells(new Set())}
                    onClick={() => handleChooseSequence(seq)}
                    disabled={isLoading}
                  >
                    Option {i + 1}: {seqLabel(seq)}
                  </button>
                ))}
              </div>
            )}

            {!pendingChoice && selectedCard && (
              <div className="info-block selected-info">
                <h3>Selected</h3>
                <p>{selectedCard.value}</p>
                <p className="hint-text">
                  {isOneEyedJack(selectedCard.value)
                    ? 'Click a green chip to remove it'
                    : `Click a highlighted cell to place`}
                </p>
                <button className="btn-ghost small" onClick={() => setSelectedCard(null)}>
                  Deselect
                </button>
              </div>
            )}
          </div>

          {/* Player hand */}
          <CardHand
            hand={gameState.playerHand}
            board={gameState.board}
            selectedCardId={selectedCard?.id ?? null}
            onSelectCard={handleSelectCard}
            onSwapDeadCard={handleSwapDeadCard}
            disabled={!isPlayerTurn || !!pendingChoice}
          />
        </div>
      ) : (
        <div className="start-screen">
          <div className="start-card">
            <h2>Ready to play?</h2>
            <p>Be the first to complete <strong>2 sequences</strong> of 5 chips in a row.</p>
            <ul className="rules-summary">
              <li>Select a card from your hand</li>
              <li>Click a highlighted cell to place your chip</li>
              <li>One-eyed Jack (J♠ J♥) removes an opponent chip</li>
              <li>Two-eyed Jack (J♣ J♦) is a wildcard — place anywhere</li>
              <li>Dead card? Click it to swap for a new one</li>
            </ul>
            <button className="btn-primary large" onClick={startGame} disabled={isLoading}>
              {isLoading ? 'Starting…' : 'Start Game'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
