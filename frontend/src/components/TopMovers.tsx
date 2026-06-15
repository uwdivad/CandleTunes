import { useTopMovers } from "../api/queries";
import type { MoverItem } from "../api/types";
import { MAX_TICKERS } from "../constants";

interface MoverRowProps {
  item: MoverItem;
  isAdded: boolean;
  atLimit: boolean;
  onAddTicker: (symbol: string) => void;
}

function MoverRow({ item, isAdded, atLimit, onAddTicker }: MoverRowProps) {
  const isGain = item.change_percent >= 0;
  const sign = isGain ? "+" : "";
  const disabled = isAdded || atLimit;
  const title = isAdded
    ? `${item.symbol} already added`
    : atLimit
      ? `Limit of ${MAX_TICKERS} tickers reached`
      : `Add ${item.symbol} to tickers`;
  return (
    <div className="mover-row">
      <button
        type="button"
        className="mover-symbol"
        onClick={() => onAddTicker(item.symbol)}
        disabled={disabled}
        title={title}
      >
        {item.symbol}
      </button>
      <span className="mover-name">{item.name}</span>
      <span className="mover-price">{item.price.toFixed(2)}</span>
      <span className={`mover-change ${isGain ? "gain" : "loss"}`}>
        {sign}
        {item.change.toFixed(2)} ({sign}
        {item.change_percent.toFixed(2)}%)
      </span>
    </div>
  );
}

interface TopMoversProps {
  tickers: string[];
  onAddTicker: (symbol: string) => void;
}

export function TopMovers({ tickers, onAddTicker }: TopMoversProps) {
  const { data, isLoading, isError, error } = useTopMovers();
  const atLimit = tickers.length >= MAX_TICKERS;

  if (isLoading) {
    return <div className="movers-panel chart-panel-status">Loading top movers…</div>;
  }

  if (isError || !data) {
    return (
      <div className="movers-panel chart-panel-status error">
        Failed to load top movers: {(error as Error)?.message ?? "unknown error"}
      </div>
    );
  }

  return (
    <div className="movers-panel">
      <div className="movers-section">
        <h3 className="movers-heading">Top Gainers</h3>
        {data.gainers.map((item) => (
          <MoverRow
            key={item.symbol}
            item={item}
            isAdded={tickers.includes(item.symbol)}
            atLimit={atLimit}
            onAddTicker={onAddTicker}
          />
        ))}
      </div>
      <div className="movers-section">
        <h3 className="movers-heading">Top Losers</h3>
        {data.losers.map((item) => (
          <MoverRow
            key={item.symbol}
            item={item}
            isAdded={tickers.includes(item.symbol)}
            atLimit={atLimit}
            onAddTicker={onAddTicker}
          />
        ))}
      </div>
    </div>
  );
}
