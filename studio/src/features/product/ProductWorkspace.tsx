import { useState, type FormEvent } from 'react';

import type {
  ProductCleanupWarning,
  ProductConfiguration,
  ProductDiagnostic,
  ProductDocument,
  ProductExportResult,
  ProductInspection,
  ProductOperationResult,
} from '../../shared/product_api.mjs';
import {
  diagnosticTargetsField,
  draftMatchesDocument,
  editableDraftFrom,
  productDraftFrom,
  type DraftField,
  type EditableProductDraft,
} from './product_state.mjs';

type ProductOperation = 'new' | 'open' | 'validate' | 'save' | 'export' | 'cleanup';

const operationLabels: Record<ProductOperation, string> = {
  new: 'Creating a product draft…',
  open: 'Opening a product…',
  validate: 'Validating the product contract…',
  save: 'Saving the project…',
  export: 'Building and validating the VST3 export…',
  cleanup: 'Cleaning the transaction artifact…',
};

function unexpectedDiagnostic(): ProductDiagnostic {
  return {
    code: 'GARAK_STUDIO_UNEXPECTED_FAILURE',
    path: 'studio.product',
    message: 'The Product workspace could not complete the request.',
  };
}

function shortenHash(value: string): string {
  return value.length > 20 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
}

function mergeCleanupWarnings(
  current: readonly ProductCleanupWarning[],
  incoming: readonly ProductCleanupWarning[],
): readonly ProductCleanupWarning[] {
  const merged = [...current];
  for (const warning of incoming) {
    const duplicate = merged.some(
      (candidate) =>
        candidate.cleanupId === warning.cleanupId &&
        candidate.diagnostic.code === warning.diagnostic.code &&
        candidate.diagnostic.path === warning.diagnostic.path &&
        candidate.diagnostic.message === warning.diagnostic.message,
    );
    if (!duplicate) {
      merged.push(warning);
    }
  }
  return merged;
}

interface CleanupWarningsProps {
  readonly warnings: readonly ProductCleanupWarning[];
  readonly headingId: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly cleanedCleanupIds: ReadonlySet<string>;
  readonly disabled: boolean;
  readonly onCleanup: (warning: ProductCleanupWarning) => void;
}

function CleanupWarnings({
  warnings,
  headingId,
  eyebrow,
  title,
  cleanedCleanupIds,
  disabled,
  onCleanup,
}: CleanupWarningsProps) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="cleanup-warnings" aria-labelledby={headingId}>
      <div>
        <p className="result-label">{eyebrow}</p>
        <h4 id={headingId}>{title}</h4>
      </div>
      {warnings.map((warning, index) => {
        const isCleaned = warning.cleanupId !== null && cleanedCleanupIds.has(warning.cleanupId);
        return (
          <article key={`${warning.diagnostic.code}-${index}`} className="cleanup-warning">
            <div>
              <strong>{warning.diagnostic.code}</strong>
              <code>{warning.diagnostic.path}</code>
              <p>{warning.diagnostic.message}</p>
            </div>
            {warning.cleanupId === null ? (
              <span className="cleanup-unavailable">No safe cleanup action</span>
            ) : (
              <button
                className="button button-secondary button-compact"
                type="button"
                onClick={() => {
                  onCleanup(warning);
                }}
                disabled={disabled || isCleaned}
              >
                {isCleaned ? 'Cleaned' : 'Clean owned artifact…'}
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function ProductWorkspace() {
  const [document, setDocument] = useState<ProductDocument | null>(null);
  const [draft, setDraft] = useState<EditableProductDraft | null>(null);
  const [configuration, setConfiguration] = useState<ProductConfiguration>('Debug');
  const [inspection, setInspection] = useState<ProductInspection | null>(null);
  const [exportResult, setExportResult] = useState<ProductExportResult | null>(null);
  const [diagnostic, setDiagnostic] = useState<ProductDiagnostic | null>(null);
  const [statusMessage, setStatusMessage] = useState(
    'Create a product or open an existing .garak project.',
  );
  const [busy, setBusy] = useState<ProductOperation | null>(null);
  const [cleanedCleanupIds, setCleanedCleanupIds] = useState<ReadonlySet<string>>(() => new Set());
  const [cleanupWarnings, setCleanupWarnings] = useState<readonly ProductCleanupWarning[]>([]);

  const isBusy = busy !== null;
  const isDirty = document !== null && draft !== null && !draftMatchesDocument(draft, document);
  const hasUnsavedWork = document !== null && (!document.saved || isDirty);
  const canExport = document !== null && document.saved && !isDirty && !isBusy;

  function installDocument(nextDocument: ProductDocument, replaceWarnings: boolean): void {
    setDocument(nextDocument);
    setDraft(editableDraftFrom(nextDocument));
    setInspection(null);
    setExportResult(null);
    if (replaceWarnings) {
      setCleanupWarnings(nextDocument.cleanupWarnings);
      setCleanedCleanupIds(new Set());
    } else {
      setCleanupWarnings((current) => mergeCleanupWarnings(current, nextDocument.cleanupWarnings));
    }
  }

  function allowDocumentReplacement(): boolean {
    if (!hasUnsavedWork) {
      return true;
    }

    return window.confirm('Discard the unsaved Product workspace changes and continue?');
  }

  async function performOperation<T>(
    operation: ProductOperation,
    invoke: () => Promise<ProductOperationResult<T>>,
    onSuccess: (value: T) => void,
    successMessage: (value: T) => string,
    cancelledMessage: string,
  ): Promise<void> {
    setBusy(operation);
    setDiagnostic(null);
    if (operation === 'validate') {
      setInspection(null);
    }
    if (operation === 'export') {
      setExportResult(null);
    }
    setStatusMessage(operationLabels[operation]);

    try {
      const result = await invoke();
      if (result.status === 'ok') {
        onSuccess(result.value);
        setStatusMessage(successMessage(result.value));
      } else if (result.status === 'cancelled') {
        setStatusMessage(cancelledMessage);
      } else {
        setDiagnostic(result.diagnostic);
        setStatusMessage('The request failed. Review the diagnostic below.');
      }
    } catch {
      setDiagnostic(unexpectedDiagnostic());
      setStatusMessage('The request failed. Review the diagnostic below.');
    } finally {
      setBusy(null);
    }
  }

  function handleNewProduct(): void {
    if (!allowDocumentReplacement()) {
      setStatusMessage('New product cancelled; unsaved changes were preserved.');
      return;
    }

    void performOperation<ProductDocument>(
      'new',
      () => window.garakStudio.newProduct(),
      (value) => {
        installDocument(value, true);
      },
      () => 'New product draft created. Save it to choose a .garak location.',
      'New product creation cancelled.',
    );
  }

  function handleOpenProduct(): void {
    if (!allowDocumentReplacement()) {
      setStatusMessage('Open cancelled; unsaved changes were preserved.');
      return;
    }

    void performOperation<ProductDocument>(
      'open',
      () => window.garakStudio.openProduct(),
      (value) => {
        installDocument(value, true);
      },
      (value) => `Opened ${value.locationLabel ?? value.draft.name}.`,
      'Open cancelled; the current product was preserved.',
    );
  }

  function convertedDraft() {
    if (draft === null) {
      return null;
    }

    const converted = productDraftFrom(draft);
    if (converted.status === 'error') {
      setDiagnostic(converted.diagnostic);
      setStatusMessage('The request failed. Review the diagnostic below.');
      return null;
    }
    return converted.draft;
  }

  function handleValidate(): void {
    if (document === null) {
      return;
    }
    const productDraft = convertedDraft();
    if (productDraft === null) {
      return;
    }

    void performOperation<ProductInspection>(
      'validate',
      () =>
        window.garakStudio.validateProduct({
          documentId: document.documentId,
          draft: productDraft,
        }),
      setInspection,
      () => 'Product contract is valid.',
      'Validation cancelled.',
    );
  }

  function handleSave(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (document === null) {
      return;
    }
    const productDraft = convertedDraft();
    if (productDraft === null) {
      return;
    }

    void performOperation<ProductDocument>(
      'save',
      () =>
        window.garakStudio.saveProduct({
          documentId: document.documentId,
          draft: productDraft,
        }),
      (value) => {
        installDocument(value, false);
      },
      (value) => `Saved ${value.locationLabel ?? value.draft.name}.`,
      'Save cancelled; the project was not changed.',
    );
  }

  function handleExport(): void {
    if (!canExport || document === null) {
      return;
    }

    void performOperation<ProductExportResult>(
      'export',
      () =>
        window.garakStudio.exportProduct({
          documentId: document.documentId,
          configuration,
        }),
      (value) => {
        setExportResult(value);
        setCleanupWarnings((current) => mergeCleanupWarnings(current, value.cleanupWarnings));
      },
      (value) => `${value.configuration} VST3 export completed and validated.`,
      'Export cancelled; no product bundle was changed.',
    );
  }

  function handleCleanup(warning: ProductCleanupWarning): void {
    if (warning.cleanupId === null) {
      return;
    }
    const cleanupId = warning.cleanupId;

    void performOperation<{ readonly cleaned: true }>(
      'cleanup',
      () => window.garakStudio.cleanupProductArtifact({ cleanupId }),
      () => {
        setCleanedCleanupIds((current) => new Set(current).add(cleanupId));
      },
      () => 'The owned transaction artifact was cleaned.',
      'Cleanup cancelled; the published export remains valid.',
    );
  }

  function updateDraft(field: DraftField, value: string): void {
    setDraft((current) => (current === null ? null : { ...current, [field]: value }));
    setInspection(null);
    setExportResult(null);
    setDiagnostic(null);
    setStatusMessage('Unsaved product changes.');
  }

  return (
    <section
      className="product-workspace"
      aria-labelledby="product-workspace-heading"
      aria-busy={isBusy}
    >
      <header className="product-workspace-header">
        <div>
          <p className="workspace-kicker">Windows product creation</p>
          <h2 id="product-workspace-heading">Product</h2>
          <p className="workspace-description product-intro">
            Shape the minimal Garak product contract, then export the same validated project as an
            independent Windows VST3.
          </p>
        </div>
        <div className="product-primary-actions" aria-label="Project actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={handleOpenProduct}
            disabled={isBusy}
          >
            Open project…
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={handleNewProduct}
            disabled={isBusy}
          >
            New product
          </button>
        </div>
      </header>

      <div className="operation-status" role="status" aria-live="polite">
        <span
          className={isBusy ? 'status-dot status-dot-active' : 'status-dot'}
          aria-hidden="true"
        />
        <span>{isBusy && busy !== null ? operationLabels[busy] : statusMessage}</span>
      </div>

      {diagnostic !== null ? (
        <aside className="diagnostic-panel" role="alert" aria-labelledby="diagnostic-title">
          <div>
            <p className="result-label">Needs attention</p>
            <h3 id="diagnostic-title">{diagnostic.code}</h3>
          </div>
          <code>{diagnostic.path}</code>
          <p>{diagnostic.message}</p>
        </aside>
      ) : null}

      {document === null || draft === null ? (
        <div className="product-empty-state">
          <div className="empty-state-mark" aria-hidden="true">
            G
          </div>
          <div>
            <h3>Start from a product contract</h3>
            <p>
              Create a new identity or open a directory-based <code>.garak</code> project.
              Filesystem access stays behind the protected Studio boundary.
            </p>
          </div>
        </div>
      ) : (
        <>
          <section className="document-strip" aria-label="Current product document">
            <div>
              <p className="result-label">Current project</p>
              <h3>{draft.name.length > 0 ? draft.name : 'Untitled product'}</h3>
              <p className="document-location">{document.locationLabel ?? 'Not saved yet'}</p>
            </div>
            <span
              className={`document-state ${document.saved && !isDirty ? 'document-state-saved' : ''}`}
            >
              {document.saved && !isDirty ? 'Saved' : 'Unsaved'}
            </span>
          </section>

          <CleanupWarnings
            warnings={cleanupWarnings}
            headingId="workspace-cleanup-heading"
            eyebrow="Operation succeeded"
            title="Transaction cleanup needs attention"
            cleanedCleanupIds={cleanedCleanupIds}
            disabled={isBusy}
            onCleanup={handleCleanup}
          />

          <div className="product-grid">
            <form className="product-panel product-editor" onSubmit={handleSave}>
              <div className="panel-heading">
                <div>
                  <p className="result-label">Source contract</p>
                  <h3>Identity &amp; defaults</h3>
                </div>
                <span>Schema {document.schemaVersion}</span>
              </div>

              <div className="field-grid">
                <label className="field field-wide" htmlFor="product-vendor">
                  <span>Artist / vendor</span>
                  <input
                    id="product-vendor"
                    type="text"
                    value={draft.vendor}
                    onChange={(event) => {
                      updateDraft('vendor', event.currentTarget.value);
                    }}
                    aria-invalid={diagnosticTargetsField(diagnostic, 'vendor')}
                    autoComplete="organization"
                    disabled={isBusy}
                  />
                  <small>White-label name shown by the plugin host.</small>
                </label>

                <label className="field field-wide" htmlFor="product-name">
                  <span>Product name</span>
                  <input
                    id="product-name"
                    type="text"
                    value={draft.name}
                    onChange={(event) => {
                      updateDraft('name', event.currentTarget.value);
                    }}
                    aria-invalid={diagnosticTargetsField(diagnostic, 'name')}
                    disabled={isBusy}
                  />
                  <small>Also becomes the Windows VST3 bundle name.</small>
                </label>

                <label className="field" htmlFor="product-version">
                  <span>Version</span>
                  <input
                    id="product-version"
                    type="text"
                    inputMode="numeric"
                    value={draft.version}
                    onChange={(event) => {
                      updateDraft('version', event.currentTarget.value);
                    }}
                    aria-invalid={diagnosticTargetsField(diagnostic, 'version')}
                    disabled={isBusy}
                  />
                  <small>Canonical major.minor.patch.</small>
                </label>

                <label className="field" htmlFor="product-gain">
                  <span>Default gain</span>
                  <div className="input-with-unit">
                    <input
                      id="product-gain"
                      type="number"
                      step="0.1"
                      value={draft.gainDb}
                      onChange={(event) => {
                        updateDraft('gainDb', event.currentTarget.value);
                      }}
                      aria-invalid={diagnosticTargetsField(diagnostic, 'gainDb')}
                      disabled={isBusy}
                    />
                    <span aria-hidden="true">dB</span>
                  </div>
                  <small>Validated range: −60.0 to +12.0 dB.</small>
                </label>
              </div>

              <dl className="contract-facts">
                <div>
                  <dt>Product ID · immutable</dt>
                  <dd>
                    <code>{document.productId}</code>
                  </dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{document.category}</dd>
                </div>
                <div>
                  <dt>Template</dt>
                  <dd>
                    <code>{document.template}</code>
                  </dd>
                </div>
              </dl>

              <div className="panel-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={handleValidate}
                  disabled={isBusy}
                >
                  Validate contract
                </button>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={isBusy || (document.saved && !isDirty)}
                >
                  {document.saved ? 'Save changes' : 'Save project…'}
                </button>
              </div>
            </form>

            <section className="product-panel export-panel" aria-labelledby="export-heading">
              <div className="panel-heading">
                <div>
                  <p className="result-label">Canonical exporter</p>
                  <h3 id="export-heading">Windows VST3</h3>
                </div>
                <span>Local only</span>
              </div>

              <fieldset className="configuration-picker" disabled={isBusy}>
                <legend>Runtime configuration</legend>
                {(['Debug', 'Release'] as const).map((value) => (
                  <label
                    key={value}
                    className={configuration === value ? 'configuration-active' : ''}
                  >
                    <input
                      type="radio"
                      name="product-configuration"
                      value={value}
                      checked={configuration === value}
                      onChange={() => {
                        setConfiguration(value);
                        setExportResult(null);
                      }}
                    />
                    <span>{value}</span>
                  </label>
                ))}
              </fieldset>

              <p className="export-explainer">
                Uses the prebuilt Product Runtime and runs module inspection plus standard and
                extensive VST3 validation before publication.
              </p>

              <button
                className="button button-export"
                type="button"
                onClick={handleExport}
                disabled={!canExport}
              >
                Export &amp; validate {configuration}…
              </button>
              {!document.saved ? (
                <p className="action-hint">Save this project before exporting.</p>
              ) : isDirty ? (
                <p className="action-hint">Save current changes before exporting.</p>
              ) : (
                <p className="action-hint">
                  You will choose a repository-local output folder next.
                </p>
              )}
            </section>
          </div>

          {inspection !== null ? (
            <section
              className="result-panel validation-result"
              aria-labelledby="validation-heading"
            >
              <div className="result-heading">
                <div>
                  <p className="result-label">Validation passed</p>
                  <h3 id="validation-heading">Stable runtime identity</h3>
                </div>
                <span className="result-badge">Valid</span>
              </div>
              <dl className="result-grid">
                <div>
                  <dt>Processor FUID</dt>
                  <dd>
                    <code>{inspection.processorFuid}</code>
                  </dd>
                </div>
                <div>
                  <dt>Controller FUID</dt>
                  <dd>
                    <code>{inspection.controllerFuid}</code>
                  </dd>
                </div>
                <div>
                  <dt>Gain parameter</dt>
                  <dd>
                    ID {inspection.gain.id} · {inspection.gain.defaultDb} dB
                  </dd>
                </div>
                <div>
                  <dt>Bypass parameter</dt>
                  <dd>ID {inspection.bypass.id} · Off</dd>
                </div>
              </dl>
            </section>
          ) : null}

          {exportResult !== null ? (
            <section className="result-panel export-result" aria-labelledby="export-result-heading">
              <div className="result-heading">
                <div>
                  <p className="result-label">Export complete</p>
                  <h3 id="export-result-heading">{exportResult.configuration} VST3 validated</h3>
                  <p className="result-path">{exportResult.bundlePath}</p>
                </div>
                <span className="result-badge">Published</span>
              </div>

              <dl className="export-metrics">
                <div>
                  <dt>Processor FUID</dt>
                  <dd title={exportResult.processorFuid}>
                    <code>{exportResult.processorFuid}</code>
                  </dd>
                </div>
                <div>
                  <dt>Controller FUID</dt>
                  <dd title={exportResult.controllerFuid}>
                    <code>{exportResult.controllerFuid}</code>
                  </dd>
                </div>
                <div>
                  <dt>Runtime SHA-256</dt>
                  <dd title={exportResult.runtimeSha256}>
                    <code>{shortenHash(exportResult.runtimeSha256)}</code>
                  </dd>
                </div>
                <div>
                  <dt>Compiled data</dt>
                  <dd title={exportResult.compiledSha256}>
                    <code>{shortenHash(exportResult.compiledSha256)}</code>
                    <span>{exportResult.compiledBytes.toLocaleString()} bytes</span>
                  </dd>
                </div>
                <div>
                  <dt>Moduleinfo</dt>
                  <dd title={exportResult.moduleInfoSha256}>
                    <code>{shortenHash(exportResult.moduleInfoSha256)}</code>
                    <span>{exportResult.moduleInfoBytes.toLocaleString()} bytes</span>
                  </dd>
                </div>
              </dl>

              <div className="export-evidence-grid">
                <details>
                  <summary>
                    Bundle inventory <span>{exportResult.inventory.length}</span>
                  </summary>
                  <ul className="evidence-list">
                    {exportResult.inventory.map((item) => (
                      <li key={item}>
                        <code>{item}</code>
                      </li>
                    ))}
                  </ul>
                </details>
                <details>
                  <summary>
                    Validation tools <span>{exportResult.childProcesses.length}</span>
                  </summary>
                  <ul className="evidence-list">
                    {exportResult.childProcesses.map((child, index) => (
                      <li key={`${child.tool}-${index}`}>
                        <span>{child.tool}</span>
                        <strong>Exit {child.exitCode}</strong>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}
