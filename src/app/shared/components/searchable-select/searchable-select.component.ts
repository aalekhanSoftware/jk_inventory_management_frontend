import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, forwardRef, ElementRef, HostListener, HostBinding, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-searchable-select',
  templateUrl: './searchable-select.component.html',
  styleUrls: ['./searchable-select.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true
    }
  ],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ]
})
export class SearchableSelectComponent implements ControlValueAccessor, OnInit, OnChanges {
  @Input() options: any[] = [];
  @Input() labelKey: string = 'name';
  @Input() valueKey: string = 'id';
  @Input() placeholder: string = 'Select an option';
  @Input() defaultOption: { label: string; value: any } | null = null;
  @Input() searchPlaceholder: string = 'Search...';
  @Input() multiple = false;
  /** Extra option fields included in filtering (e.g. product code). */
  @Input() searchKeys: string[] = [];
  /** Show an × button to clear the selection (medonix default: on). */
  @Input() allowClear = true;
  /** Panel max height (also bound to the dropdown element). */
  @Input() maxHeight: string = '320px';
  /** Force the open panel to be at least this wide (px); trigger stays 100%. */
  @Input() focusWidthPx?: number;

  searchText: string = '';
  isOpen: boolean = false;
  selectedValue: any = '';
  selectedValues: any[] = [];
  filteredOptions: any[] = [];
  highlightedIndex: number = -1;

  onChange: any = () => {};
  onTouch: any = () => {};

  isMobile = window.innerWidth <= 768;
  private currentScrollPosition = 0;
  isKeyboardScrolling = false;
  /** Opens upward when there is no room below (desktop tables). */
  dropUp = false;
  /**
   * True while the pointer is down inside the options container (scrollbar
   * drag) or a touch scroll is in progress. The input blurs in both cases —
   * without this guard the blur timer would close the list mid-scroll.
   * Option taps are unaffected (they close via selectOption explicitly).
   */
  private containerPointerActive = false;
  private containerTouchActive = false;

  /** Wide panel override while open (medonix pattern); trigger keeps its width. */
  @HostBinding('style.--dropdown-min-width')
  get dropdownMinWidth(): string | null {
    return this.isOpen && this.focusWidthPx ? `${this.focusWidthPx}px` : null;
  }

  constructor(private el: ElementRef) {}

  ngOnInit() {
    this.filteredOptions = this.options ? [...this.options] : [];
    this.syncSearchTextWithSelection();
  }

  // Close the dropdown when clicking/tapping anywhere outside this component.
  // Scoped with ElementRef.contains so multiple selects on the same page
  // (e.g. one per product row) work independently.
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

  @HostListener('window:resize')
  onWindowResize(): void {
    this.isMobile = window.innerWidth <= 768;
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isOpen) {
      this.closeDropdown();
    }
  }

  writeValue(value: any): void {
    if (this.multiple) {
      this.selectedValues = value || [];
      this.syncSearchTextWithSelection();
    } else {
      this.selectedValue = value;
      this.syncSearchTextWithSelection();
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouch = fn;
  }

  toggleDropdown(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.searchText = '';
      this.filterOptions();
      this.adjustDropDirection();
    } else {
      this.syncSearchTextWithSelection();
    }
  }

  /**
   * Opens upward when there is no room below (desktop tables). Mobile keeps
   * the bottom-sheet positioning from CSS.
   */
  private adjustDropDirection(): void {
    this.dropUp = false;
    setTimeout(() => {
      if (!this.isOpen || window.innerWidth <= 768) {
        return;
      }
      const host = this.el.nativeElement as HTMLElement;
      const dd = host.querySelector('.select-dropdown') as HTMLElement | null;
      if (!dd) {
        return;
      }
      const rect = host.getBoundingClientRect();
      const need = Math.min(dd.offsetHeight || 220, parseInt(this.maxHeight, 10) || 220);
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < need && rect.top > need) {
        this.dropUp = true;
      }
    }, 0);
  }

  onFocus() {
    // In multiple mode the closed input shows the chosen names as plain
    // display text, so start every search from a clean slate.
    if (this.multiple) {
      this.searchText = '';
    }
    this.isOpen = true;
    this.filterOptions();
    this.highlightedIndex = -1;
    this.adjustDropDirection();
  }

  onBlur(event?: FocusEvent) {
    const target = event?.relatedTarget as HTMLElement | null;
    if (target?.classList?.contains('scroll-btn') || this.isKeyboardScrolling) {
      if (event) {
        event.preventDefault();
      }
      return;
    }

    setTimeout(() => {
      // Never close mid-scroll: scrollbar drag (desktop) and touch scroll
      // (mobile) both blur the input while the gesture is still running.
      if (this.containerPointerActive || this.containerTouchActive) {
        return;
      }
      this.closeDropdown();
    }, 100);
  }

  /** Scrollbar drag / touch scroll starting inside the list: keep it open. */
  onContainerPointerDown(): void {
    this.containerPointerActive = true;
  }

  onContainerTouchStart(): void {
    this.containerTouchActive = true;
  }

  onContainerTouchEnd(): void {
    setTimeout(() => {
      this.containerTouchActive = false;
    }, 150);
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    if (this.containerPointerActive) {
      setTimeout(() => {
        this.containerPointerActive = false;
      }, 150);
    }
  }

  closeDropdown(): void {
    if (!this.isOpen && this.highlightedIndex === -1) {
      return;
    }
    this.isOpen = false;
    this.highlightedIndex = -1;
    this.syncSearchTextWithSelection();
  }

  private syncSearchTextWithSelection(): void {
    if (this.multiple) {
      // Show the chosen names right inside the input while closed, so the
      // selection stays visible without opening the dropdown. Labels resolve
      // once async options land; until then fall back to a plain count.
      const labels = this.getSelectedLabels();
      this.searchText = labels.length > 0
        ? labels.join(', ')
        : (this.selectedValues.length ? `${this.selectedValues.length} selected` : '');
      return;
    }
    const selected = this.findOption(this.selectedValue);
    this.searchText = selected ? selected[this.labelKey] : '';
  }

  /**
   * Type-tolerant option lookup (medonix pattern): matches 5, '5' and ' 5 '
   * so values arriving as strings/numbers from different sources still
   * resolve to a label instead of a stuck placeholder.
   */
  private findOption(value: any): any {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const opts = this.options || [];
    let found = opts.find(opt => opt[this.valueKey] === value);
    if (!found && typeof value === 'number') {
      found = opts.find(opt => opt[this.valueKey] === String(value));
    }
    if (!found && typeof value === 'string' && /^\d+$/.test(value.trim())) {
      found = opts.find(opt => opt[this.valueKey] === Number(value));
    }
    return found;
  }

  getSelectedLabels(): string[] {
    if (!this.multiple) {
      return [];
    }
    const labels: string[] = [];
    for (const value of this.selectedValues) {
      const option = this.findOption(value);
      const label = option ? option[this.labelKey] : null;
      if (label !== null && label !== undefined && String(label).trim() !== '') {
        labels.push(String(label));
      }
    }
    return labels;
  }

  onSearch(event: Event) {
    this.searchText = (event.target as HTMLInputElement).value;
    this.filterOptions();
    this.isOpen = true;
  }

  filterOptions() {
    const query = (this.searchText || '').toLowerCase().trim();
    const matchText = (option: any): string => {
      const parts: any[] = [option[this.labelKey]];
      for (const key of this.searchKeys) {
        if (option[key] !== null && option[key] !== undefined) {
          parts.push(option[key]);
        }
      }
      return parts.filter(v => v !== null && v !== undefined).map(v => String(v).toLowerCase()).join(' ');
    };
    if (!query) {
      this.filteredOptions = [...(this.options || [])];
    } else {
      // Prefix matches first, then contains matches (medonix ordering).
      const startsWith: any[] = [];
      const contains: any[] = [];
      for (const option of (this.options || [])) {
        const text = matchText(option);
        if (text.startsWith(query)) {
          startsWith.push(option);
        } else if (text.includes(query)) {
          contains.push(option);
        }
      }
      this.filteredOptions = [...startsWith, ...contains];
    }
    this.highlightedIndex = this.filteredOptions.length > 0 ? 0 : -1;
  }

  onOptionPointerDown(event: Event, option: any): void {
    // Prevent default on mousedown so the search input keeps focus and the
    // parent form never submits; selection itself is handled here explicitly
    // which also covers touch (touch generates a mousedown).
    event.preventDefault();
    event.stopPropagation();
    this.selectOption(option);
  }

  selectOption(option: any) {
    if (this.multiple) {
      const value = option[this.valueKey];
      const index = this.selectedValues.indexOf(value);

      if (index === -1) {
        this.selectedValues = [...this.selectedValues, value];
      } else {
        this.selectedValues = this.selectedValues.filter(v => v !== value);
      }

      this.onChange(this.selectedValues);
    } else {
      this.selectedValue = option[this.valueKey];
      this.searchText = option[this.labelKey];
      this.onChange(this.selectedValue);
      this.isOpen = false;
    }
    this.onTouch();
  }

  isSelected(option: any): boolean {
    const value = option[this.valueKey];
    if (this.multiple) {
      return this.selectedValues.some(v => v === value || String(v) === String(value));
    }
    return value === this.selectedValue
      || (value !== undefined && value !== null
        && this.selectedValue !== undefined && this.selectedValue !== null
        && String(value) === String(this.selectedValue));
  }

  /** Clears the selection (× icon); emits '' / [] like a pristine control. */
  clearSelection(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (this.multiple) {
      this.selectedValues = [];
      this.onChange([]);
    } else {
      this.selectedValue = '';
      this.searchText = '';
      this.onChange('');
    }
    this.onTouch();
  }

  getSelectedLabel(): string {
    if (this.multiple) {
      const labels = this.getSelectedLabels();
      if (labels.length > 0) {
        return labels.join(', ');
      }
      return this.selectedValues.length
        ? `${this.selectedValues.length} selected`
        : this.placeholder;
    }

    if (!this.selectedValue && this.defaultOption) {
      return this.defaultOption.label;
    }
    const selected = this.findOption(this.selectedValue);
    return selected ? selected[this.labelKey] : this.placeholder;
  }

  handleKeydown(event: KeyboardEvent): void {
    if (!this.isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        this.isOpen = true;
        this.highlightedIndex = 0;
        event.preventDefault();
      }
      // Let the parent form decide on Enter when the dropdown is closed.
      return;
    }

    const container: HTMLElement | null =
      this.el.nativeElement.querySelector('.options-container');
    if (!container) return;

    const scrollStep = 160; // Height of 4 options (40px each)

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        this.isKeyboardScrolling = true;
        event.preventDefault();
        event.stopPropagation();

        this.highlightedIndex = Math.min(
          this.highlightedIndex + (event.key === 'ArrowDown' ? 4 : -4),
          this.filteredOptions.length - 1
        );

        container.scrollBy({
          top: event.key === 'ArrowDown' ? scrollStep : -scrollStep,
          behavior: 'smooth'
        });

        setTimeout(() => {
          this.isKeyboardScrolling = false;
        }, 100);
        break;

      case 'Enter':
        // Prevent the parent form from submitting while navigating options.
        event.preventDefault();
        event.stopPropagation();
        if (this.highlightedIndex >= 0 && this.filteredOptions[this.highlightedIndex]) {
          this.selectOption(this.filteredOptions[this.highlightedIndex]);
        }
        break;

      case 'Escape':
        this.closeDropdown();
        event.preventDefault();
        break;

      case 'Tab':
        this.closeDropdown();
        break;
    }
  }

  scrollOptions(direction: 'up' | 'down', event?: Event): void {
    // type="button" is set in the template, but guard anyway so scroll
    // buttons never submit a surrounding form.
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const container: HTMLElement | null =
      this.el.nativeElement.querySelector('.options-container');
    if (!container) return;

    const scrollAmount = 160; // Height of 4 options (40px each)
    const currentScroll = container.scrollTop;

    if (direction === 'up') {
      container.scrollTo({
        top: currentScroll - scrollAmount,
        behavior: 'smooth'
      });
      this.highlightedIndex = Math.max(this.highlightedIndex - 4, 0);
    } else {
      container.scrollTo({
        top: currentScroll + scrollAmount,
        behavior: 'smooth'
      });
      this.highlightedIndex = Math.min(
        this.highlightedIndex + 4,
        this.filteredOptions.length - 1
      );
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['options'] && !changes['options'].firstChange) {
      // Options usually arrive async (products/employees APIs). Re-apply the
      // current search text and restore the selected label once they land.
      this.filterOptions();
      this.syncSearchTextWithSelection();
    }
  }
}
