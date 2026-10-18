import { Component, type ErrorInfo, type ReactNode } from "react";
import { AppShell } from "../components/layout/AppShell.tsx";
import { DatasetProvider } from "./dataset.tsx";

export function App() {
  return (
    <ChartBoundary>
      <DatasetProvider>
        <AppShell />
      </DatasetProvider>
    </ChartBoundary>
  );
}

class ChartBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (this.state.message) {
      return (
        <div className="flex h-svh items-center justify-center bg-canvas px-6 text-center text-ink">
          <div>
            <h1 className="font-display text-[2rem] leading-[1.19] font-bold tracking-tight">A view stopped rendering</h1>
            <p className="mx-auto mt-3 max-w-[36rem] text-pretty text-sm leading-relaxed text-muted">{this.state.message}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
