import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[workspace] uncaught render error", error, info);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div role="alert" data-testid="error-boundary" className="sdm-error-screen">
          <h1>Something went wrong</h1>
          <pre>{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
