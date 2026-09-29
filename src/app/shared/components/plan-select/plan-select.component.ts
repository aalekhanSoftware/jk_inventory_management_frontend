import { Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { PlanningService } from '../../../services/planning.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';

export interface PlanOption {
  id: number;
  planningNumber: string;
  planningDate?: string;
  status?: string;
}

/**
 * Plan-only dropdown built for 10k-50k rows: never loads all plans.
 * First open fetches the latest 100 (id desc); scrolling near the bottom
 * (~90th row) appends the next 100 via cursor; typing searches (debounced).
 * Lazy: no API call until first opened or a preset value needs its label.
 */
@Component({
  selector: 'app-plan-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plan-select.component.html',
  styleUrls: ['./plan-select.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PlanSelectComponent),
      multi: true
    }
  ]
})
export class PlanSelectComponent implements ControlValueAccessor, OnInit, OnDestroy {
  @Input() placeholder: string = 'Select Planning';
  @Input() searchPlaceholder: string = 'Search planning no...';
  @Input() pageSize: number = 100;
  @Input() searchDebounceMs: number = 400;
  @Output() selectionChange = new EventEmitter<number | null>();

  items: PlanOption[] = [];
  isOpen = false;
  dropUp = false;
  loading = false;
  loadingMore = false;
  hasMore = false;
  searchText = '';
  highlightedIndex = -1;

  selectedPlanId: number | null = null;  private nextCursor: number | null = null;
  private loadedOnce = false;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private destroy$ = new Subject<void>();
  private onChange: (v: number | null) => void = () => {};
  private onTouch: () => void = () => {};

  constructor(
    private el: ElementRef,
    private planningService: PlanningService,
    private snackbar: SnackbarService
  ) {}

  ngOnInit(): void {}

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ---- ControlValueAccessor ----
  writeValue(value: any): void {
    this.selectedPlanId = value === undefined || value === null || value === '' ? null : Number(value);
    const found = this.selectedPlanId ? this.items.find(i => i.id === this.selectedPlanId) : undefined;
    this.searchText = found ? found.planningNumber : '';
    if (this.selectedPlanId && !found) {
      this.resolveLabel(this.selectedPlanId);
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouch = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    // Gated via the wrapping form control; nothing visual to disable here.
    void isDisabled;
  }

  // ---- Data ----
  private labelFor(id: number | null): string {
    const found = id ? this.items.find(i => i.id === id) : undefined;
    return found ? found.planningNumber : '';
  }

  private load(reset: boolean): void {
    if (reset) {
      if (this.loading) {
        return;
      }
      this.loading = true;
    } else {
      if (this.loadingMore || !this.hasMore) {
        return;
      }
      this.loadingMore = true;
    }
    const params: any = {
      search: (this.searchText || '').trim(),
      cursor: reset ? null : this.nextCursor,
      limit: this.pageSize
    };
    this.planningService.searchPlanningDropdown(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            const content = response.data.content || [];
            this.items = reset ? content : [...this.items, ...content];
            this.nextCursor = response.data.nextCursor ?? null;
            this.hasMore = !!response.data.hasMore;
            this.loadedOnce = true;
            if (reset) {
              this.highlightedIndex = this.items.length ? 0 : -1;
            }
          }
          this.loading = false;
          this.loadingMore = false;
        },
        error: (error) => {
          this.snackbar.error(error?.error?.message || 'Failed to load plannings');
          this.loading = false;
          this.loadingMore = false;
        }
      });
  }

  /** Prefetch label for a preset id outside the loaded window (edit flows). */
  private resolveLabel(id: number): void {
    this.planningService.getPlanningDetail(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const d = response.data;
            if (!this.items.some(i => i.id === d.id)) {
              this.items = [{ id: d.id, planningNumber: d.planningNumber, planningDate: d.planningDate, status: d.status }, ...this.items];
            }
            if (this.selectedPlanId === d.id && !this.isOpen) {
              this.searchText = d.planningNumber || '';
            }
          }
        },
        error: () => {}
      });
  }

  // ---- UI ----
  toggleDropdown(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      if (this.selectedPlanId && this.searchText === this.labelFor(this.selectedPlanId)) {
        this.searchText = '';
      }
      if (!this.loadedOnce) {
        this.load(true);
      }
      this.adjustDropDirection();
    }
  }

  onFocus(): void {
    // Start a fresh search when focusing (clear the displayed label text).
    if (this.selectedPlanId && this.searchText === this.labelFor(this.selectedPlanId)) {
      this.searchText = '';
    }
    if (!this.isOpen) {
      this.isOpen = true;
      if (!this.loadedOnce) {
        this.load(true);
      }
      this.adjustDropDirection();
    }
  }

  onBlur(): void {
    setTimeout(() => {
      this.closeDropdown();
    }, 120);
  }

  closeDropdown(): void {
    if (!this.isOpen) {
      return;
    }
    this.isOpen = false;
    this.highlightedIndex = -1;
    // Restore the selected label (or blank) when closing.
    this.searchText = this.labelFor(this.selectedPlanId);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen && !this.el.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }

  @HostListener('document:touchstart', ['$event'])
  onDocumentTouchStart(event: TouchEvent): void {
    if (this.isOpen && !this.el.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }

  onSearchInput(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    // Debounced server search: reset to the first 100 matches.
    this.searchTimer = setTimeout(() => {
      this.nextCursor = null;
      this.load(true);
    }, this.searchDebounceMs);
  }

  onListScroll(event: Event): void {
    const target = event.target as HTMLElement;
    const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    // At ~90-92 of 100 rows the remaining ~8-10 rows are ~300px; prefetch next page.
    if (distanceToBottom < 320 && this.hasMore && !this.loadingMore && !this.loading) {
      this.load(false);
    }
  }

  selectOption(option: PlanOption, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.selectedPlanId = option.id;
    this.searchText = option.planningNumber;
    this.onChange(option.id);
    this.onTouch();
    this.selectionChange.emit(option.id);
    this.isOpen = false;
  }

  clearSelection(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.selectedPlanId = null;
    this.searchText = '';
    this.onChange(null);
    this.onTouch();
    this.selectionChange.emit(null);
  }

  isSelected(option: PlanOption): boolean {
    return this.selectedPlanId !== null && option.id === this.selectedPlanId;
  }

  handleKeydown(event: KeyboardEvent): void {
    if (!this.isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        this.toggleDropdown(event);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      this.highlightedIndex = Math.min(this.highlightedIndex + 1, this.items.length - 1);
      event.preventDefault();
    } else if (event.key === 'ArrowUp') {
      this.highlightedIndex = Math.max(this.highlightedIndex - 1, 0);
      event.preventDefault();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      if (this.highlightedIndex >= 0 && this.items[this.highlightedIndex]) {
        this.selectOption(this.items[this.highlightedIndex]);
      }
    } else if (event.key === 'Escape') {
      this.closeDropdown();
      event.preventDefault();
    }
  }

  private adjustDropDirection(): void {
    this.dropUp = false;
    setTimeout(() => {
      if (!this.isOpen || window.innerWidth <= 768) {
        return;
      }
      const host = this.el.nativeElement as HTMLElement;
      const dd = host.querySelector('.plan-select-dropdown') as HTMLElement | null;
      if (!dd) {
        return;
      }
      const rect = host.getBoundingClientRect();
      const need = Math.min(dd.offsetHeight || 260, 320);
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < need && rect.top > need) {
        this.dropUp = true;
      }
    }, 0);
  }
}
