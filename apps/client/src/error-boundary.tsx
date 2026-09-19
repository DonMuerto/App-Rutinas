import { Component, type ReactNode } from "react";
import { Button } from "@ritmo/ui";

export interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly message: string;
  readonly onReset?: () => void;
  readonly title: string;
}

interface ErrorBoundaryState {
  readonly failed: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  private reset = () => {
    this.props.onReset?.();
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="app-state" id="main-content" role="alert">
        <section aria-labelledby="boundary-title">
          <h1 id="boundary-title">{this.props.title}</h1>
          <p>{this.props.message}</p>
          <Button onClick={this.reset} variant="primary">
            Reintentar
          </Button>
        </section>
      </main>
    );
  }
}
