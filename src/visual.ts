"use strict";

import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import FilterAction = powerbi.FilterAction;
import { AdvancedFilter, IAdvancedFilterCondition } from "powerbi-models";

const TARGET_TABLE = "Snowflake Query";
const TARGET_COLUMN = "SERIAL_NUMBER";

export class Visual implements IVisual {
    private host: IVisualHost;
    private rootElement: HTMLElement;
    private textareaElement: HTMLTextAreaElement;
    private searchButton: HTMLButtonElement;
    private clearButton: HTMLButtonElement;
    private counterElement: HTMLElement;
    private statusElement: HTMLElement;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.rootElement = options.element;
        this.rootElement.innerHTML = "";

        const container = document.createElement("div");
        container.className = "ni-serial-slicer";

        const header = document.createElement("div");
        header.className = "ni-serial-slicer__header";

        const titleSpan = document.createElement("span");
        titleSpan.textContent = "Bulk Serial Search";

        this.counterElement = document.createElement("span");
        this.counterElement.textContent = "0 unique serials";

        header.appendChild(titleSpan);
        header.appendChild(this.counterElement);

        this.textareaElement = document.createElement("textarea");
        this.textareaElement.className = "ni-serial-slicer__textarea";
        this.textareaElement.placeholder = "Paste serial numbers from Excel (one per line or tab-separated)...";
        this.textareaElement.setAttribute("aria-label", "Serial numbers input");

        const actions = document.createElement("div");
        actions.className = "ni-serial-slicer__actions";

        this.searchButton = document.createElement("button");
        this.searchButton.type = "button";
        this.searchButton.className = "ni-serial-slicer__btn ni-serial-slicer__btn--primary";
        this.searchButton.textContent = "Search";

        this.clearButton = document.createElement("button");
        this.clearButton.type = "button";
        this.clearButton.className = "ni-serial-slicer__btn ni-serial-slicer__btn--secondary";
        this.clearButton.textContent = "Clear";

        actions.appendChild(this.searchButton);
        actions.appendChild(this.clearButton);

        this.statusElement = document.createElement("div");
        this.statusElement.className = "ni-serial-slicer__status";
        this.statusElement.textContent = "Ready. Paste serial numbers and click Search.";

        container.appendChild(header);
        container.appendChild(this.textareaElement);
        container.appendChild(actions);
        container.appendChild(this.statusElement);

        this.rootElement.appendChild(container);

        this.bindEvents();
        this.refreshCounter();
    }

    public update(options: VisualUpdateOptions): void {
        // Render-independent: UI remains visible even when dataViews is empty or unassigned.
        this.refreshCounter();
    }

    private bindEvents(): void {
        this.textareaElement.addEventListener("input", () => {
            this.refreshCounter();
        });

        this.textareaElement.addEventListener("paste", () => {
            window.setTimeout(() => {
                this.refreshCounter();
            }, 0);
        });

        this.searchButton.addEventListener("click", () => {
            this.applySerialFilter();
        });

        this.clearButton.addEventListener("click", () => {
            this.clearSerialFilter();
        });
    }

    private parseSerialNumbers(rawText: string): string[] {
        if (!rawText) {
            return [];
        }

        // Split on newlines, carriage returns, or tabs; preserve exact text and leading zeros.
        const tokens = rawText.split(/[\r\n\t]+/);
        const seen = new Set<string>();
        const result: string[] = [];

        for (const token of tokens) {
            const trimmed = token.trim();
            if (trimmed.length === 0) {
                continue;
            }
            if (!seen.has(trimmed)) {
                seen.add(trimmed);
                result.push(trimmed);
            }
        }

        return result;
    }

    private refreshCounter(): void {
        const uniqueSerials = this.parseSerialNumbers(this.textareaElement.value);
        this.counterElement.textContent = `${uniqueSerials.length} unique serial${uniqueSerials.length === 1 ? "" : "s"}`;
    }

    private applySerialFilter(): void {
        const uniqueSerials = this.parseSerialNumbers(this.textareaElement.value);
        this.refreshCounter();

        if (uniqueSerials.length === 0) {
            this.clearSerialFilter();
            this.statusElement.textContent = "No valid serial numbers entered; filter cleared.";
            return;
        }

        const target = {
            table: TARGET_TABLE,
            column: TARGET_COLUMN
        };

        const conditions: IAdvancedFilterCondition[] = [
            {
                operator: "In",
                values: uniqueSerials
            }
        ];

        const filter = new AdvancedFilter(target, "Or", conditions);
        this.host.applyJsonFilter(filter, "filter", "apply", FilterAction.merge);
        this.statusElement.textContent = `Applied exact filter for ${uniqueSerials.length} serial number(s).`;
    }

    private clearSerialFilter(): void {
        const target = {
            table: TARGET_TABLE,
            column: TARGET_COLUMN
        };
        const emptyFilter = new AdvancedFilter(target, "Or", []);
        this.host.applyJsonFilter(emptyFilter, "filter", "apply", FilterAction.remove);
        this.textareaElement.value = "";
        this.refreshCounter();
        this.statusElement.textContent = "Filter cleared.";
    }
}
