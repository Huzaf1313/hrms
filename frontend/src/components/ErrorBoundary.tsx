import { Component, type ErrorInfo, type ReactNode } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;

  /**
   * Names the area that failed, e.g. "Employee details", so the message tells
   * the user which page broke rather than just that something did.
   */
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-time errors so a single broken component shows a message
 * instead of blanking the whole screen.
 *
 * Must be a class component: there is no hook equivalent of
 * getDerivedStateFromError / componentDidCatch.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[ErrorBoundary]${this.props.label ? ` ${this.props.label}` : ""} crashed:`,
      error,
      errorInfo.componentStack,
    );
  }

  handleTryAgain = () => {
    this.setState({ error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    const { children, label } = this.props;

    if (!error) {
      return children;
    }

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 py-10">
        <div className="w-full max-w-lg rounded-[2px] border border-amber-200 bg-white p-8 text-center shadow-none">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[2px] bg-amber-50">
            <TriangleAlert className="h-6 w-6 text-amber-600" />
          </div>

          <h2 className="text-xl font-bold text-gray-900">
            {label ? `${label} could not be displayed` : "This page could not be displayed"}
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Something went wrong while rendering. The rest of the app is still
            working &mdash; you can retry or move to another page.
          </p>

          <pre className="mt-4 max-h-40 overflow-auto rounded-[2px] bg-gray-50 p-3 text-left text-xs text-gray-600">
            {error.message}
          </pre>

          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={this.handleTryAgain}
              className="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <RotateCw className="h-4 w-4" />
              Try again
            </button>

            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-full bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;