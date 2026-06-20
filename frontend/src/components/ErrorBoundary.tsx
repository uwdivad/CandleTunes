import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

// Catches render-time throws anywhere below it so a single component error
// renders an inline message instead of unmounting the whole app (a blank
// screen). Without this, any throw in HomePage or a chart/audio child takes
// the entire React tree down.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the component stack for display, and log the full error so it's
    // also visible in the console with its stack trace.
    this.setState({ componentStack: info.componentStack ?? null });
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  handleReset = () => this.setState({ error: null, componentStack: null });

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          padding: "24px",
          margin: "24px",
          border: "1px solid #e07a5f",
          borderRadius: "8px",
          background: "#1b1b1f",
          color: "#f4f4f5",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          maxWidth: "900px",
        }}
      >
        <h2 style={{ marginTop: 0, color: "#e07a5f" }}>Something broke while rendering.</h2>
        <p style={{ fontWeight: 600 }}>{error.message}</p>
        {error.stack && (
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px", opacity: 0.85 }}>
            {error.stack}
          </pre>
        )}
        {componentStack && (
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px", opacity: 0.7 }}>
            {componentStack}
          </pre>
        )}
        <button type="button" onClick={this.handleReset} style={{ marginTop: "12px" }}>
          Try again
        </button>
      </div>
    );
  }
}
