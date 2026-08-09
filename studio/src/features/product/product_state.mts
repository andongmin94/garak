import type {
  ProductDiagnostic,
  ProductDocument,
  ProductDraft,
} from '../../shared/product_api.mjs';

export interface EditableProductDraft {
  readonly vendor: string;
  readonly name: string;
  readonly version: string;
  readonly gainDb: string;
}

export type DraftConversionResult =
  | { readonly status: 'ok'; readonly draft: ProductDraft }
  | { readonly status: 'error'; readonly diagnostic: ProductDiagnostic };

export function editableDraftFrom(document: ProductDocument): EditableProductDraft {
  return {
    vendor: document.draft.vendor,
    name: document.draft.name,
    version: document.draft.version,
    gainDb: String(document.draft.gainDb),
  };
}

export function productDraftFrom(editable: EditableProductDraft): DraftConversionResult {
  if (editable.gainDb.trim().length === 0) {
    return {
      status: 'error',
      diagnostic: {
        code: 'GARAK_STUDIO_GAIN_NUMBER',
        path: 'product.json.defaults.gainDb',
        message: 'Gain default must be a finite number.',
      },
    };
  }

  const gainDb = Number(editable.gainDb);
  if (!Number.isFinite(gainDb)) {
    return {
      status: 'error',
      diagnostic: {
        code: 'GARAK_STUDIO_GAIN_NUMBER',
        path: 'product.json.defaults.gainDb',
        message: 'Gain default must be a finite number.',
      },
    };
  }

  return {
    status: 'ok',
    draft: {
      vendor: editable.vendor,
      name: editable.name,
      version: editable.version,
      gainDb: Object.is(gainDb, -0) ? 0 : gainDb,
    },
  };
}

export function draftMatchesDocument(
  editable: EditableProductDraft,
  document: ProductDocument,
): boolean {
  const converted = productDraftFrom(editable);
  if (converted.status === 'error') {
    return false;
  }

  return (
    converted.draft.vendor === document.draft.vendor &&
    converted.draft.name === document.draft.name &&
    converted.draft.version === document.draft.version &&
    converted.draft.gainDb === document.draft.gainDb
  );
}

export type DraftField = 'vendor' | 'name' | 'version' | 'gainDb';

export function diagnosticTargetsField(
  diagnostic: ProductDiagnostic | null,
  field: DraftField,
): boolean {
  if (diagnostic === null) {
    return false;
  }

  const suffix = field === 'gainDb' ? 'defaults.gainDb' : field;
  return diagnostic.path === suffix || diagnostic.path.endsWith(`.${suffix}`);
}
