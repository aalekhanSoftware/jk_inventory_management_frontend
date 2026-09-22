import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, forwardRef, ElementRef, HostListener, OnInit, OnChanges, SimpleChanges } from '@angular/core';
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
    } else {
      this.syncSearchTextWithSelection();
    }
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
      this.closeDropdown();
    }, 100);
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
    const selected = (this.options || []).find(opt => opt[this.valueKey] === this.selectedValue);
    this.searchText = selected ? selected[this.labelKey] : '';
  }

  getSelectedLabels(): string[] {
    if (!this.multiple) {
      return [];
    }
    const labels: string[] = [];
    for (const value of this.selectedValues) {
      const option = (this.options || []).find(opt => opt[this.valueKey] === value);
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
    const query = (this.searchText || '').toLowerCase();
    this.filteredOptions = (this.options || []).filter(option =>
      String(option[this.labelKey] ?? '').toLowerCase().includes(query)
    );
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
    return this.multiple
      ? this.selectedValues.includes(value)
      : this.selectedValue === value;
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
    const selected = this.options.find(opt => opt[this.valueKey] === this.selectedValue);
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
