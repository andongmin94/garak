import { useRef, useState, type KeyboardEvent } from 'react';

import { ControlWorkspace } from './features/control/ControlWorkspace';
import { InterfaceWorkspace } from './features/interface/InterfaceWorkspace';
import { ProductWorkspace } from './features/product/ProductWorkspace';
import { SoundWorkspace } from './features/sound/SoundWorkspace';

const workspaces = [
  { id: 'sound', label: 'Sound', content: <SoundWorkspace /> },
  { id: 'control', label: 'Control', content: <ControlWorkspace /> },
  { id: 'interface', label: 'Interface', content: <InterfaceWorkspace /> },
  { id: 'product', label: 'Product', content: <ProductWorkspace /> },
] as const;

type WorkspaceId = (typeof workspaces)[number]['id'];

export function App() {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('sound');
  const tabElements = useRef<Array<HTMLButtonElement | null>>([]);

  function selectAdjacentWorkspace(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ): void {
    let nextIndex: number | undefined;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % workspaces.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + workspaces.length) % workspaces.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = workspaces.length - 1;
    }

    if (nextIndex === undefined) {
      return;
    }

    const nextWorkspace = workspaces[nextIndex];

    if (nextWorkspace === undefined) {
      return;
    }

    event.preventDefault();
    setActiveWorkspace(nextWorkspace.id);
    tabElements.current[nextIndex]?.focus();
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Garak Studio</p>
          <h1>Product authoring workspace</h1>
        </div>
        <p className="phase-badge">Phase 0B scaffold</p>
      </header>

      <div className="workspace-layout">
        <nav className="workspace-navigation" aria-label="Studio workspaces">
          <p className="navigation-label">Workspaces</p>
          <div className="workspace-tabs" role="tablist" aria-orientation="vertical">
            {workspaces.map((workspace, index) => {
              const isActive = activeWorkspace === workspace.id;

              return (
                <button
                  key={workspace.id}
                  ref={(element) => {
                    tabElements.current[index] = element;
                  }}
                  id={`workspace-tab-${workspace.id}`}
                  className="workspace-tab"
                  type="button"
                  role="tab"
                  aria-controls={`workspace-panel-${workspace.id}`}
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => {
                    setActiveWorkspace(workspace.id);
                  }}
                  onKeyDown={(event) => {
                    selectAdjacentWorkspace(event, index);
                  }}
                >
                  <span>{workspace.label}</span>
                  <span className="tab-status">Placeholder</span>
                </button>
              );
            })}
          </div>
        </nav>

        <main className="workspace-content">
          {workspaces.map((workspace) => (
            <div
              key={workspace.id}
              id={`workspace-panel-${workspace.id}`}
              role="tabpanel"
              aria-labelledby={`workspace-tab-${workspace.id}`}
              hidden={activeWorkspace !== workspace.id}
              tabIndex={0}
            >
              {workspace.content}
            </div>
          ))}
        </main>
      </div>
    </div>
  );
}
