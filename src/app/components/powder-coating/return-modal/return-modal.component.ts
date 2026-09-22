import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ModalService } from '../../../services/modal.service';
import { PowderCoatingService } from '../../../services/powder-coating.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-return-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './return-modal.component.html',
  styleUrls: ['./return-modal.component.scss']
})
export class ReturnModalComponent implements OnInit {
  @Output() returnCreated = new EventEmitter<void>();
  
  returnForm!: FormGroup;
  loading = false;
  processItemId?: number;
  
  display$ = this.modalService.modalState$.pipe(
    map(state => state.isOpen && state.modalType === 'return')
  );

  constructor(
    private fb: FormBuilder,
    private powderCoatingService: PowderCoatingService,
    private snackbar: SnackbarService,
    private modalService: ModalService
  ) {
    this.initForm();
  }

  ngOnInit() {
    this.modalService.modalState$.subscribe(state => {
      if (state.isOpen && state.modalType === 'return' && state.data) {
        this.processItemId = state.data;
        this.initForm();
      }
    });
  }

  private initForm(): void {
    const now = new Date();
    const localISOString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000))
      .toISOString()
      .slice(0, 16);

    this.returnForm = this.fb.group({
      returnQuantity: ['', [Validators.required, Validators.min(1)]],
      returnDate: [localISOString]
    });
  }

  onSubmit(): void {
    if (this.returnForm.valid && this.processItemId) {
      this.loading = true;
      const formData = this.returnForm.value;
      
      const request = {
        processItemId: this.processItemId,
        returnQuantity: formData.returnQuantity,
        returnDate: formData.returnDate ? new Date(formData.returnDate).toLocaleString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }).replace(/\//g, '-').replace(',', '') : undefined
      };

      this.powderCoatingService.createReturn(request).subscribe({
        next: (response) => {
          if (response.success) {
            this.snackbar.success('Return created successfully');
            this.returnCreated.emit();
            this.close();
          }
          this.loading = false;
        },
        error: (error) => {
          this.snackbar.error(error?.error?.message || 'Failed to create return');
          this.loading = false;
        }
      });
    }
  }

  close(): void {
    this.modalService.close();
    this.returnForm.reset();
    this.initForm();
  }
} 