/**
 * ModelSelector — interactive model picker overlay.
 * Renders a searchable, scrollable list of models with keyboard navigation.
 *
 * Up/Down: move selection
 * Enter:   select model
 * Escape:  cancel
 * Type:    filter models by name/provider
 */
import React from "react";
export interface ModelItem {
    id: string;
    tier: string;
}
export interface ModelSelectorProps {
    models: ModelItem[];
    currentModelId: string;
    onSelect(modelId: string): void;
    onCancel(): void;
    initialQuery?: string;
}
export declare function ModelSelector({ models, currentModelId, onSelect, onCancel, initialQuery, }: ModelSelectorProps): React.JSX.Element;
//# sourceMappingURL=ModelSelector.d.ts.map