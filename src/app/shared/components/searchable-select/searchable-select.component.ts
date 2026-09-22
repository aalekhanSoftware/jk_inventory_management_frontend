import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, forwardRef } from '@angular/core';
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
export class SearchableSelectComponent implements ControlValueAccessor {
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

  ngOnInit() {
    this.filteredOptions = this.options;
  }

  writeValue(value: any): void {
    if (this.multiple) {
      this.selectedValues = value || [];
    } else {
      this.selectedValue = value;
      if (value) {
        const selectedOption = this.options.find(opt => opt[this.valueKey] === value);
        if (selectedOption) {
          this.searchText = selectedOption[this.labelKey];
        }
      }
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouch = fn;
  }

  toggleDropdown() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.searchText = '';
      this.filterOptions();
    }
  }

  onFocus() {
    this.isOpen = true;
    this.filterOptions();
    this.highlightedIndex = -1;
  }

  onBlur(event: FocusEvent) {
    const target = event.relatedTarget as HTMLElement;
    if (target?.classList.contains('scroll-btn') || this.isKeyboardScrolling) {
      event.preventDefault();
      return;
    }

    setTimeout(() => {
      this.isOpen = false;
      this.highlightedIndex = -1;
      
      if (!this.multiple) {
        const selected = this.options.find(opt => opt[this.valueKey] === this.selectedValue);
        this.searchText = selected ? selected[this.labelKey] : '';
      }
    }, 100);
  }

  onSearch(event: Event) {
    this.searchText = (event.target as HTMLInputElement).value;
    this.filterOptions();
    this.isOpen = true;
  }

  filterOptions() {
    this.filteredOptions = this.options.filter(option =>
      option[this.labelKey].toLowerCase().includes(this.searchText.toLowerCase())
    );
    this.highlightedIndex = this.filteredOptions.length > 0 ? 0 : -1;
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
      return;
    }

    const container = document.querySelector('.options-container');
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
        if (this.highlightedIndex >= 0 && this.filteredOptions[this.highlightedIndex]) {
          this.selectOption(this.filteredOptions[this.highlightedIndex]);
          event.preventDefault();
        }
        break;

      case 'Escape':
        this.isOpen = false;
        this.highlightedIndex = -1;
        event.preventDefault();
        break;
    }
  }

  scrollOptions(direction: 'up' | 'down'): void {
    const container = document.querySelector('.options-container');
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

  ngOnChanges(changes: any): void {
    if (changes.options && !changes.options.firstChange) {
      if (!this.multiple && this.selectedValue) {
        const selectedOption = this.options.find(opt => opt[this.valueKey] === this.selectedValue);
        if (selectedOption) {
          this.searchText = selectedOption[this.labelKey];
        }
      }
    }
  }
} 