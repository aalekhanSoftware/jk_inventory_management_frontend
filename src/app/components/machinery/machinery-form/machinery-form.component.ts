import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MachineryService } from '../../../services/machinery.service';
import { LoaderComponent } from '../../../shared/components/loader/loader.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { EncryptionService } from '../../../shared/services/encryption.service';

@Component({
  selector: 'app-machinery-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LoaderComponent,
    RouterLink,
    FormsModule,
    RouterModule
  ],
  templateUrl: './machinery-form.component.html',
  styleUrls: ['./machinery-form.component.scss']
})
export class MachineryFormComponent implements OnInit, OnDestroy {
  machineryForm!: FormGroup;
  isLoading = false;
  isEditMode = false;
  machineryId?: number;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private machineryService: MachineryService,
    private router: Router,
    private route: ActivatedRoute,
    private encryptionService: EncryptionService,
    private snackbar: SnackbarService
  ) {
    this.machineryForm = this.fb.group({
      name: ['', Validators.required],
      code: [''],
      remarks: [''],
      status: ['A', Validators.required]
    });
  }

  ngOnInit(): void {
    // Encrypted id in URL (medonix pattern): decrypt before use.
    const rawId = this.route.snapshot.paramMap.get('id');
    const decrypted = rawId ? Number(this.encryptionService.decrypt(rawId)) : NaN;
    if (rawId && !decrypted) {
      this.snackbar.error('Invalid link');
      this.router.navigate(['/machinery']);
      return;
    }
    if (decrypted) {
      this.isEditMode = true;
      this.machineryId = decrypted;
      this.loadMachinery();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadMachinery(): void {
    if (!this.machineryId) return;
    this.isLoading = true;
    this.machineryService.getMachineryDetail(this.machineryId).subscribe({
      next: (response) => {
        if (response.success) {
          this.machineryForm.patchValue({
            name: response.data.name || '',
            code: response.data.code || '',
            remarks: response.data.remarks || '',
            status: response.data.status || 'A'
          });
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || 'Failed to load machinery details');
        this.isLoading = false;
      }
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.machineryForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  onSubmit(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    Object.keys(this.machineryForm.controls).forEach(k => this.machineryForm.get(k)?.markAsTouched());
    if (this.machineryForm.invalid) {
      this.snackbar.error('Please fix validation errors');
      return;
    }
    this.isLoading = true;
    const v = this.machineryForm.getRawValue();
    const payload: any = {
      name: (v.name || '').trim(),
      code: (v.code || '').trim() || null,
      remarks: v.remarks || '',
      status: v.status
    };
    const request = this.isEditMode
      ? this.machineryService.updateMachinery({ ...payload, id: this.machineryId })
      : this.machineryService.createMachinery(payload);

    request.pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackbar.success(response.message);
          this.router.navigate(['/machinery']);
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.snackbar.error(error?.error?.message || `Failed to ${this.isEditMode ? 'update' : 'create'} machinery`);
        this.isLoading = false;
      }
    });
  }
}
